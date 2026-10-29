import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog } from "../shared/MissionCatalog";
import { m04TargetLayout } from "../shared/M04WorldPlan";
import { compileBomberEncounter, laterEscortsDue } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import { arrivalDue, takeArrival, TriggerContext } from "../shared/CampaignEncounters";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { MissionScore } from "../shared/MissionScore";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { jammedLockAllowed } from "../shared/EngineBatchC";
import { MissionFinished } from "../shared/Types";
const bp=MissionCatalog.Get(4), p=bp.phases[0], b=p.bombers!, waves=p.fighterWaves!, ace=p.standaloneAce!;
function stats(id:number) { const m=MissionCatalog.Get(id); return {slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(m)+MissionCatalog.RequiredGroundKills(m),groundKills:MissionCatalog.RequiredGroundKills(m),completedPhases:MissionCatalog.TotalPhases(m),elapsed:100}; }
describe("Mission 4 jammed transport intercept",()=>{
 it("validates the released airborne 12-minute mission and exact world ids and initial poses",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.worldKey).toBe("m04_inland_hills");expect(bp.start?.kind).toBe("airborne");expect(bp.start?.y).toBe(1202);expect(bp.countdownSeconds).toBe(720);expect(bp.allies?.count).toBe(2);
  expect(MissionCatalog.RequiredAirKills(bp)).toBe(3);expect(MissionCatalog.RequiredGroundKills(bp)).toBe(0);expect(bp.phases.size()).toBe(1);
  const ids=[...b.targetIds!,...waves.map(w=>w.id),ace.id];expect(ids.size()).toBe(15);expect(new Set(ids).size()).toBe(15);
  for(const t of m04TargetLayout()) expect(ids.includes(t.id)).toBe(true);
  const initial=BomberRules.Sample(compileBomberEncounter(b),0);
  m04TargetLayout().filter(t=>t.type==="transport").forEach((t,i)=>{expect(initial.slots[i].position.x).toBeCloseTo(t.x);expect(initial.slots[i].position.y).toBeCloseTo(t.y);expect(initial.slots[i].position.z).toBeCloseTo(t.z);});
  expect(laterEscortsDue(b,{route:compileBomberEncounter(b),startedAt:0,laterSpawned:false,escortsSpawned:0},999)).toBe(false);
 });
 it("starts five escorts, two jammers and the ace, then admits four escorts exactly once after the first transport",()=>{
  const context:TriggerContext={elapsed:0,phase:0,requiredKills:0,destroyed:new Set(),targets:[]};
  expect(waves.filter(w=>arrivalDue(w.trigger,context)).size()).toBe(7);expect(arrivalDue(ace.trigger,context)).toBe(true);
  const escorts=waves.filter(w=>w.aircraft===undefined);expect(escorts.filter(w=>w.livery===undefined).size()).toBe(3);expect(escorts.filter(w=>w.livery==="Vulture").size()).toBe(2);expect(escorts.filter(w=>w.livery==="Elite").size()).toBe(4);expect(ace.livery).toBe("Vulture");
  const late=waves.filter(w=>w.trigger.kind==="required_count");expect(late.size()).toBe(4);
  const fired=new Set<string>();for(const w of late) {expect(takeArrival(w.id,w.trigger,context,fired)).toBe(false);expect(takeArrival(w.id,w.trigger,{...context,requiredKills:1},fired)).toBe(true);expect(takeArrival(w.id,w.trigger,{...context,requiredKills:2},fired)).toBe(false);}
 });
 it("keeps jamming lock restrictions through the first jammer and restores them after the last",()=>{
  expect(waves.filter(w=>w.aircraft==="jammer").size()).toBe(2);
  for(const n of [2,1]) {expect(jammedLockAllowed(n,1200,p.jamming)).toBe(true);expect(jammedLockAllowed(n,1201,p.jamming)).toBe(false);}
  expect(jammedLockAllowed(0,9000,p.jamming)).toBe(true);
 });
 it("scores all fifteen once for 1540 and ends immediately on the third required transport",()=>{
  const run=Runner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(const w of waves) expect(recordScoredKill(run,ledger,w.id,"air",false,10,w.scoreRole)).toBe(true);
  expect(recordScoredKill(run,ledger,ace.id,"ace",false,11,"ace")).toBe(true);
  expect(recordScoredKill(run,ledger,ace.id,"ace",false,11,"ace")).toBe(false);
  expect(run.outcome).toBeUndefined();
  for(const id of b.targetIds!) expect(recordScoredKill(run,ledger,id,"air",true,100,"transport")).toBe(true);
  expect(run.outcome).toBe("won");expect(ledger.Total()).toBe(1540);expect(bp.scoring?.rank).toEqual({S:1300,A:800,B:650,C:480});
  const minimum=Runner.NewState(bp,0);for(const id of b.targetIds!) Runner.RecordKill(minimum,id,"air",true,100);expect(minimum.outcome).toBe("won");
 });
 it("uses exact provisional rank boundaries without time or accuracy gates",()=>{
  for(const [score,rank] of [[479,"D"],[480,"C"],[649,"C"],[650,"B"],[799,"B"],[800,"A"],[1299,"A"],[1300,"S"],[1540,"S"]] as const) expect(MissionScore.RankPoints(score,true,bp.scoring!)).toBe(rank);
 });
 it("fails escape, death and the exact deadline",()=>{
  const escape=Runner.NewState(bp,0);Runner.EscapeBombers(escape);expect(escape.outcome).toBe("failed");
  const timeout=Runner.NewState(bp,0);Runner.Tick(timeout,720);expect(timeout.reason).toBe("timeout");
  const death=Runner.NewState(bp,0);Runner.Tick(death,1,0);expect(death.reason).toBe("destroyed");
  const route=compileBomberEncounter(b);expect(BomberRules.Sample(route,route.duration).escaped).toBe(true);expect(route.duration).toBeLessThan(720);
 });
 it("rejects forged launch/results, unlocks only after sequential 1–3 completion and persists M04 settlement",()=>{
  const m3=MissionCatalog.Get(3),available=m3.available;m3.available=true;
  const [ok,message]=pcall(()=>{
   const c=new CampaignCoordinator("m04-test",undefined,{now:()=>1000,defer:()=>undefined});c.load();
   let notifications=0;const settle=(id:number)=>completeMission(c,1,id,true,stats(id),()=>{notifications++;},0);
   expect(canLaunchMission(4,c.getSlots()[0])).toBe(false);expect(settle(4)).toBe(false);expect(notifications).toBe(0);
   for(const id of [1,2]) {expect(settle(id)).toBe(true);expect(canLaunchMission(4,c.getSlots()[0])).toBe(false);expect(settle(4)).toBe(false);}
   expect(settle(3)).toBe(true);expect(canLaunchMission(4,c.getSlots()[0])).toBe(true);
   const before=c.getSlots()[0].missions![1],ledger=new TargetScore(bp.scoring!);
   for(const t of m04TargetLayout()) ledger.RecordKill(t.id,t.type==="escort"?"escort":t.type);
   let packet:MissionFinished|undefined;
   expect(completeMission(c,1,4,true,{...stats(4),kills:15,targetScore:ledger.Snapshot()},m=>{packet=m;},0)).toBe(true);
   expect(packet?.score).toBe(1540);expect(packet?.rank).toBe("S");expect(packet?.kind).toBe("Completed");
   const loaded=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];expect(loaded.missions![4].bestScore).toBe(1540);expect(loaded.missions![1]).toEqual(before);
  });m3.available=available;if(!ok) error(tostring(message));
 });
});
