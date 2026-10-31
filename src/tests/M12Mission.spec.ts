import { FlightMath } from "../shared/FlightMath";
import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { M12_TARGETS } from "../shared/missions/m12";
import { M12, m12TargetLayout, m12Ground } from "../shared/M12WorldPlan";
import { inRingSweep } from "../shared/EngineBatchD8";
import { artilleryMasked, newArtillery, stepArtillery } from "../shared/EngineBatchD3";
import { jammedLockAllowed } from "../shared/EngineBatchC";
import { SortieArmament } from "../shared/SortieArmament";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { chapterBeforeMission, storyFor } from "../shared/RelayStory";
const bp=MissionCatalog.Get(12), strike=bp.phases[0], elite=bp.phases[1], sweep=strike.ringSweep!;
const required=M12_TARGETS.filter(t=>t.required);
function clear(s: ReturnType<typeof Runner.NewState>, score: TargetScore, at=400) {
 for(const t of required) recordScoredKill(s,score,t.id,"ground",true,at,t.scoreRole);
}
describe("M12 command ring",()=>{
 it("adopts exactly 24 unique world contacts, seven live guns and no wreck",()=>{
  MissionCatalog.ValidatePolicy(bp); expect(bp.available).toBe(true); expect(bp.worldKey).toBe("m12_command_ring");
  expect(M12_TARGETS.size()).toBe(24); expect(required.size()).toBe(7); expect(new Set(M12_TARGETS.map(t=>t.id)).size()).toBe(24);
  expect(M12_TARGETS.some(t=>t.id==="m12_gun_4")).toBe(false);
  for(const t of M12_TARGETS) { const w=m12TargetLayout().find(w=>w.id===t.id)!; expect(t.position).toEqual({x:w.x,y:w.y,z:w.z}); }
  expect(chapterBeforeMission(12)).toBe(11); expect(storyFor(11).title).toBe("Vulture Two");
 });
 it("preserves the 2240 ground ledger and 3050 reference checksum with a larger finite fighter roster",()=>{
  const ground=M12_TARGETS.reduce((n,t)=>n+bp.scoring!.points[t.scoreRole],0);
  expect(ground).toBe(2240); expect(ground+7*60+240+150).toBe(3050);
  const fighters=strike.fighterWaves!.reduce((n,w)=>n+w.count,0); expect(fighters).toBe(14);
  const max=ground+fighters*60+240+150; expect(max).toBe(3470);
  expect(bp.scoring!.rank).toEqual({S:2900,A:2400,B:2100,C:1750}); expect(max-240>=bp.scoring!.rank.S).toBe(true);
  expect(bp.allies!.killBudget).toBe(1); expect(bp.allies!.allowRequiredTargets).toBe(false); expect(bp.allies!.creditPlayerKills).toBe(false);
  expect(strike.concurrentFighters).toBe(6); expect(strike.fighterWaves!.some(w=>w.route!==undefined)).toBe(false);
 });
 it("requires all seven guns; resets only the elite clock and ends on one defeat without retreat softlock",()=>{
  const s=Runner.NewState(bp,0), score=new TargetScore(bp.scoring!);
  for(const t of M12_TARGETS.filter(t=>!t.required)) recordScoredKill(s,score,t.id,"ground",false,100,t.scoreRole);
  expect(s.phaseIndex).toBe(0); clear(s,score); expect(s.phaseIndex).toBe(1); expect(s.elapsed).toBe(400); expect(Runner.TimeRemaining(s)).toBe(600);
  expect(elite.count).toBe(5); expect(MissionCatalog.RequiredAirKills(bp)).toBe(1);
  expect(recordScoredKill(s,score,"m12_elite_1","air",true,500,"bandit")).toBe(true);
  expect(s.outcome).toBe("won"); expect(s.vultureTwoRecovered).toBe(true); expect(s.requiredAirKills).toBe(1); expect(score.Total()).toBe(2390);
  expect(recordScoredKill(s,score,"m12_elite_1","air",true,501,"bandit")).toBe(false); expect(score.Total()).toBe(2390);
 });
 it("fails either independent clock and player destruction",()=>{
  const a=Runner.NewState(bp,0); Runner.Tick(a,900); expect(a.reason).toBe("timeout");
  const b=Runner.NewState(bp,0); clear(b,new TargetScore(bp.scoring!)); Runner.Tick(b,999); expect(b.outcome).toBeUndefined(); Runner.Tick(b,1000); expect(b.reason).toBe("timeout");
  for(const phase2 of [false,true]) { const s=Runner.NewState(bp,0); if(phase2)clear(s,new TargetScore(bp.scoring!)); Runner.Tick(s,phase2?401:1,0); expect(s.reason).toBe("destroyed"); }
 });
 it("uses ground-only ECM and finite 54/14 stock with damage-preserving strike rearm",()=>{
  expect(M12_TARGETS.filter(t=>t.ecm).size()).toBe(1); expect(M12_TARGETS.find(t=>t.ecm)!.id).toBe("m12_ecm");
  expect(jammedLockAllowed(1,651,strike.jamming)).toBe(false); expect(jammedLockAllowed(1,650,strike.jamming)).toBe(true); expect(jammedLockAllowed(0,10000,strike.jamming)).toBe(true);
  expect(strike.rearm!.health).toBe(false); expect(bp.armament!.guidedBomb!.damage).toBe(180);
  expect(SortieArmament.RackTick(0,0,100,bp.armament)[0]).toBe(0);
  const refill=SortieArmament.Refill(strike.rearm!,bp.armament,"salvo"); expect(refill.missiles).toBe(54); expect(refill.special!.charges).toBe(14);
 });
 it("warns 16 seconds before 25-damage sweeps, with safe altitude, fair ingress and bounded masking",()=>{
  expect(sweep.ceiling).toBe(900); expect(sweep.damage).toBe(25); expect(sweep.warningSeconds+sweep.countdownSeconds).toBe(16);
  const clock={...sweep,ceiling:sweep.ceiling!,source:sweep.guns[0].source,channel:[],clearance:1};
  const h=newArtillery(); expect(stepArtillery(h,clock,0.1).warning).toBe(true); expect(stepArtillery(h,clock,7.9).countdown).toBe(true); expect(stepArtillery(h,clock,8).impact).toBe(true);
  for(const g of sweep.guns) {
   const a=math.rad(g.bearingDegrees), p={x:g.source.x+1000*math.sin(a),y:500,z:g.source.z-1000*math.cos(a)};
   expect(inRingSweep(sweep,g,p)).toBe(true); expect(inRingSweep(sweep,g,{...p,y:901})).toBe(false);
   expect(inRingSweep(sweep,g,M12.start)).toBe(false);
   // 160-stud/s cruise can leave an 80-stud half-width after a 3s reaction in well under 16s.
   expect(3+2*sweep.halfWidth/160).toBeLessThan(16);
   const far={x:g.source.x+20000,y:500,z:g.source.z}; let casts=0,total=0;
   expect(artilleryMasked({...clock,source:g.source},far,(_o,d)=>{ const n=math.sqrt(d.x*d.x+d.y*d.y+d.z*d.z); expect(n).toBeLessThanOrEqual(1000.000001); casts++; total+=n; return total>=19000?1:undefined; })).toBe(true);
   expect(casts).toBeGreaterThan(15);
  }
  // Entire south ingress corridor remains above terrain, below the safe flight ceiling.
  for(let z=10080;z>=3400;z-=32) expect(500-m12Ground(0,z)).toBeGreaterThan(100);
 });
 it("flies above the absolute safe ceiling before the first sweep after a three-second reaction",()=>{
  for(const heading of [0,math.pi/2,math.pi]) {
   const jet=FlightMath.FromPose(0,500,3400,heading,0,160);
   for(let step=0;step<480;step++) {
    const input=step<90?0:math.clamp((0.65-jet.pitch)*4,-1,1);
    FlightMath.Step(jet,{x:0,y:input,throttle:FlightMath.CruiseThrottle},1/30,bp.airspace);
    expect(jet.y-m12Ground(jet.x,jet.z)).toBeGreaterThan(40);
   }
   expect(jet.y).toBeGreaterThan(900);
   for(const g of sweep.guns) expect(inRingSweep(sweep,g,jet)).toBe(false);
  }
 });
 it("requires the whole sequential campaign, rejects forged records and settles only full wins",()=>{
  const availability=MISSIONS.map(m=>m.available);
  const [ok,err]=pcall(()=>{
   for(let i=0;i<11;i++) MISSIONS[i].available=true;
   const c=new CampaignCoordinator("m12-unlock",undefined,{now:()=>1000,defer:()=>undefined}); c.load();
   const slot=c.getSlots()[0]; slot.missions ??= {};
   for(let id=1;id<=18;id++) slot.missions[id]={completed:true};
   slot.missions[11]={completed:false}; expect(canLaunchMission(12,slot)).toBe(false);
   slot.missions[11]={completed:true}; slot.missions[3]={completed:false}; expect(canLaunchMission(12,slot)).toBe(false);
   slot.missions[3]={completed:true}; slot.missions[12]={completed:false}; expect(canLaunchMission(12,slot)).toBe(true);
   for(let id=1;id<=10;id++) {
    const b=MissionCatalog.Get(id);
    completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(b)+MissionCatalog.RequiredGroundKills(b),groundKills:MissionCatalog.RequiredGroundKills(b),completedPhases:MissionCatalog.TotalPhases(b),elapsed:100},()=>undefined,0);
   }
   expect(canLaunchMission(12,c.getSlots()[0])).toBe(false);
   const previous=MissionCatalog.Get(11);
   completeMission(c,1,11,true,{slot:1,missionId:11,kills:MissionCatalog.RequiredAirKills(previous),groundKills:MissionCatalog.RequiredGroundKills(previous),completedPhases:MissionCatalog.TotalPhases(previous),elapsed:100},()=>undefined,0);
   expect(canLaunchMission(12,c.getSlots()[0])).toBe(true);
   const ledger=new TargetScore(bp.scoring!); for(const t of M12_TARGETS)ledger.RecordKill(t.id,t.scoreRole); ledger.RecordKill("elite","bandit");
   const finish=(phases:number,elapsed:number)=>completeMission(c,1,12,true,{slot:1,missionId:12,kills:8,groundKills:7,completedPhases:phases,elapsed,targetScore:ledger.Snapshot()},()=>undefined,0);
   finish(1,500); expect(c.getSlots()[0].missions?.[12]?.completed === true).toBe(false); finish(2,1600); expect(c.getSlots()[0].missions?.[12]?.completed === true).toBe(false);
   finish(2,600); const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![12]; expect(saved.completed).toBe(true); expect(saved.bestScore).toBe(2390);
  });
  for(let i=0;i<MISSIONS.size();i++) MISSIONS[i].available=availability[i]; if(!ok)error(err,0);
 });
});
