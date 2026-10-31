import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { M08_SITE, M08_SITE_ID, M08_BOMBER_IDS } from "../shared/missions/m08";
import { M08_WORLD_KEY, m08TargetLayout } from "../shared/M08WorldPlan";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill, recordAlliedKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { WavePlan, AirRequest } from "../shared/WavePlan";
const bp=MissionCatalog.Get(8), battle=bp.phases[0], hold=bp.phases[1];
function ready() { const s=R.NewState(bp,0);s.score=800;R.Tick(s,420);return s; }
function prerequisites(fn:()=>void) {
 const before=MISSIONS.map(m=>m.available);
 const [ok,err]=pcall(fn);MISSIONS.forEach((m,i)=>m.available=before[i]);if(!ok) error(err,0);
}
describe("Mission 8 OPEN FREQUENCY",()=>{
 it("validates air-only data and adopts the world's protected mast pose",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.worldKey).toBe(M08_WORLD_KEY);
  const mast=m08TargetLayout().filter(t=>t.id===M08_SITE_ID)[0];expect(M08_SITE).toEqual({x:mast.x,y:mast.y,z:mast.z});
  expect(hold.interceptHold!.siteId).toBe(M08_SITE_ID);expect(hold.interceptHold!.site).toEqual(M08_SITE);expect(bp.ground.size()).toBe(0);
  expect(MissionCatalog.RequiredGroundKills(bp)).toBe(0);expect(MissionCatalog.RequiredAirKills(bp)).toBe(6);
  expect(hold.bombers!.targetIds).toEqual(M08_BOMBER_IDS);expect(new Set(M08_BOMBER_IDS).size()).toBe(6);
 });
 it("has a finite 47-aircraft 3710-point ledger, reachable provisional ranks and bounded queues",()=>{
  const points=bp.scoring!.points;
  const total=bp.phases.reduce((n,p)=>n+(p.fighterWaves??[]).reduce((v,w)=>v+w.count*points[w.scoreRole],0)+(p.standaloneAce ? points.ace : 0)+(p.bombers?.count??0)*points.bomber,0);
  expect(bp.phases.reduce((n,p)=>n+(p.fighterWaves??[]).reduce((v,w)=>v+w.count,0)+(p.standaloneAce?1:0)+(p.bombers?.count??0),0)).toBe(47);expect(total).toBe(3710);expect(total-240>=bp.scoring!.rank.S).toBe(true);
  expect(bp.scoring!.rank).toEqual({S:2900,A:2400,B:1700,C:800});
  const queue:AirRequest[]=[{role:"raider",count:32,behind:false}];let admitted=0;
  for(let i=0;i<4;i++) { const a=WavePlan.Admit(queue,battle.concurrentFighters!);const n=a.reduce((v,w)=>v+w.count,0);expect(n<=8).toBe(true);admitted+=n; }
  expect(admitted).toBe(32);expect(queue.size()).toBe(0);
 });
 it("keeps seven minutes despite the goal, resets six minutes and holds after the last bomber",()=>{
  const s=R.NewState(bp,0);s.score=800;R.Tick(s,419.99);expect(s.phaseIndex).toBe(0);R.Tick(s,420);
  expect(s.phaseIndex).toBe(1);expect(s.score).toBe(800);expect(R.TimeRemaining(s)).toBe(360);
  for(const id of M08_BOMBER_IDS) expect(R.RecordKill(s,id,"air",true,500)).toBe(true);
  expect(R.RecordKill(s,M08_BOMBER_IDS[0],"air",true,501)).toBe(false);expect(s.outcome).toBeUndefined();
  R.Tick(s,744.99);expect(s.ignitionAnnounced).toBeUndefined();R.Tick(s,745);expect(s.ignitionAnnounced).toBe(true);
  const calls=s.radioQueue.size();R.Tick(s,746);expect(s.radioQueue.size()).toBe(calls);
  R.Tick(s,779.99);expect(s.outcome).toBeUndefined();R.Tick(s,780);expect(s.outcome).toBe("won");expect(s.elapsed).toBe(780);
 });
 it("requires all six authored bombers at expiry even after partial stream kills",()=>{
  for(let killed=1;killed<M08_BOMBER_IDS.size();killed++) {
   const s=ready();
   for(let slot=0;slot<killed;slot++) expect(R.RecordKill(s,M08_BOMBER_IDS[slot],"air",true,421+slot*15)).toBe(true);
   expect(s.requiredAirKills).toBe(killed);expect(s.phaseProgress).toBe(killed);
   R.Tick(s,779.99);expect(s.phaseIndex).toBe(1);expect(s.outcome).toBeUndefined();
   R.Tick(s,780);expect(s.outcome).toBe("failed");expect(s.reason).toBe("timeout");
  }
 });
 it("streams bombers west to site on separate clocks, with fair travel time before failure",()=>{
  const b=hold.bombers!,route=compileBomberEncounter(b);
  expect(b.arrivalSeconds).toEqual([0,15,30,45,60,75]);expect(route.duration>250).toBe(true);expect(route.duration+75<=360).toBe(true);
  expect(BomberRules.Sample(route,0).slots[0].facing.x>0).toBe(true);
  expect(BomberRules.Sample(route,route.duration).escaped).toBe(true);expect(BomberRules.Sample(route,route.duration-75).escaped).toBe(false);
  expect(b.escape.x).toBe(M08_SITE.x);expect(b.escape.z).toBe(M08_SITE.z);
  const s=ready();R.EscapeBombers(s);expect(s.reason).toBe("bombers_escaped");expect(s.protectedHealth).toBe(0);
 });
 it("fails low score, missing intercepts and destruction; proximity never counts",()=>{
  const low=R.NewState(bp,0);low.score=799;R.Tick(low,420);expect(low.reason).toBe("timeout");
  const incomplete=ready();R.ObserveFlight(incomplete,M08_SITE,M08_SITE,0.1,421);expect(incomplete.phaseProgress).toBe(0);R.Tick(incomplete,780);expect(incomplete.reason).toBe("timeout");
  const dead=ready();R.Tick(dead,430,0);expect(dead.reason).toBe("destroyed");
 });
 it("keeps the entire allied flight to one optional kill without player score or required credit",()=>{
  const s=ready(),ledger=new TargetScore(bp.scoring!),destroyed:string[]=[];
  expect(recordAlliedKill(s,ledger,destroyed,bp.allies!,"cover1","air",false,421,"raider")).toBe(true);
  expect(recordAlliedKill(s,ledger,destroyed,bp.allies!,"cover2","air",false,422,"raider")).toBe(false);
  expect(recordAlliedKill(s,ledger,[],bp.allies!,M08_BOMBER_IDS[0],"air",true,422,"bomber")).toBe(false);
  expect(ledger.Total()).toBe(0);expect(s.requiredAirKills).toBe(0);
 });
 it("requires sequential mission 7 completion, rejects forged launch/results and persists full settlement",()=>prerequisites(()=>{
  const c=new CampaignCoordinator("m08",undefined,{now:()=>1000,defer:()=>undefined});c.load();
  const finish=(id:number,phases=MissionCatalog.TotalPhases(MissionCatalog.Get(id)),elapsed=100,ledger?:TargetScore)=>completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(MissionCatalog.Get(id)),groundKills:MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)),completedPhases:phases,elapsed,targetScore:ledger?.Snapshot()},()=>undefined,0);
  expect(finish(8)).toBe(false);expect(canLaunchMission(8,c.getSlots()[0])).toBe(false);
  for(let id=1;id<=6;id++) expect(finish(id)).toBe(true);
  expect(highestUnlocked(c.getSlots()[0])).toBe(7);expect(finish(8)).toBe(false);expect(finish(7)).toBe(true);
  expect(canLaunchMission(8,c.getSlots()[0])).toBe(true);expect(canLaunchMission("8",c.getSlots()[0])).toBe(false);
  expect(finish(8,1)).toBe(true);expect(c.getSlots()[0].missions?.[8]?.completed===true).toBe(false);
  expect(finish(8,2,MissionCatalog.MaxMissionSeconds(bp))).toBe(true);expect(c.getSlots()[0].missions?.[8]?.completed===true).toBe(false);
  const s=ready(),ledger=new TargetScore(bp.scoring!);for(const id of M08_BOMBER_IDS) expect(recordScoredKill(s,ledger,id,"air",true,500,"bomber")).toBe(true);
  R.Tick(s,780);expect(finish(8,s.phaseIndex,s.elapsed,ledger)).toBe(true);
  expect(normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions?.[8]?.completed).toBe(true);
  MISSIONS[6].available=false;expect(canLaunchMission(8,c.getSlots()[0])).toBe(false);
 }));
});
