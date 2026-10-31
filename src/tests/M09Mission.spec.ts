import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { mission, M09_TARGETS, M09_REARM, M09_GROUND_PROGRESS, M09_ATTACK_WAVES } from "../shared/missions/m09";
import { m09TargetLayout, M09_WORLD_KEY, M09_SERVICE } from "../shared/M09WorldPlan";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionScore } from "../shared/MissionScore";
import { SortieArmament } from "../shared/SortieArmament";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill, recordAlliedKill } from "../server/SortieScore";
import { newGroundProgress, stepGroundProgress, damageSector, validateBatchD5 } from "../shared/EngineBatchD5";
import { landingDuration, landingPose } from "../shared/EngineBatchB";
import { rearmDuration, rearmPose } from "../shared/EngineBatchC";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { takeArrival } from "../shared/CampaignEncounters";
const scoring=mission.scoring!;
function winState() { const s=BlueprintRunner.NewState(mission,0); s.score=2200; BlueprintRunner.Tick(s,600); return s; }
function withEarlier(fn:()=>void) {
 const before=MISSIONS.map(m=>m.available); for(let i=0;i<8;i++) MISSIONS[i].available=true;
 const [ok,err]=pcall(fn); MISSIONS.forEach((m,i)=>m.available=before[i]); if(!ok) error(err,0);
}
function finish(c:CampaignCoordinator,id:number,phases=MissionCatalog.TotalPhases(MissionCatalog.Get(id)), ledger?:TargetScore) {
 const b=MissionCatalog.Get(id); return completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(b)+MissionCatalog.RequiredGroundKills(b),groundKills:MissionCatalog.RequiredGroundKills(b),completedPhases:phases,elapsed:id===9 ? 900 : 100,targetScore:ledger?.Snapshot()},()=>undefined,0);
}
describe("M09 GREEN BEACON",()=>{
 it("validates the released world, original story and phase-owned clocks",()=>{
  MissionCatalog.ValidatePolicy(mission); expect(MissionCatalog.Available(9)).toBe(true); expect(MissionCatalog.WorldKey(9)).toBe(M09_WORLD_KEY);
  expect(mission.phases.map(p=>p.kind)).toEqual(["score_threshold","required_air"]);
  expect(mission.phases[0].scoreThreshold).toEqual({points:2200,seconds:600,waitForExpiry:true}); expect(mission.phases[1].update!.countdownSeconds).toBe(420);
  expect(MissionCatalog.RequiredAirKills(mission)).toBe(9); expect(mission.allies!.killBudget).toBe(1);
 });
 it("adopts exactly 55 world ids and their poses; preserves the 3260-point provisional ledger",()=>{
  const layout=m09TargetLayout(); expect(M09_TARGETS.size()).toBe(55); expect(new Set(M09_TARGETS.map(t=>t.id)).size()).toBe(55);
  layout.forEach((t,i)=>{ expect(M09_TARGETS[i].id).toBe(t.id); expect(M09_TARGETS[i].position).toEqual({x:t.x,y:t.y,z:t.z}); expect(M09_TARGETS[i].required).toBe(false); });
  expect(M09_TARGETS.reduce((n,t)=>n+scoring.points[t.scoreRole],0)).toBe(3260); expect(scoring.points.heavy_aa).toBe(40);
  expect(M09_TARGETS.filter(t=>t.scoreRole==="heavy_aa").size()).toBe(1);
 });
 it("has finite 21 aircraft, maximum 5030, and provisional ranks inside the observed S bound",()=>{
  const waves=mission.phases[0].fighterWaves!; expect(waves.reduce((n,w)=>n+w.count,0)+1+9).toBe(21);
  const max=3260+waves.reduce((n,w)=>n+w.count*scoring.points[w.scoreRole],0)+240+900; expect(max).toBe(5030);
  for(const [score,rank] of [[2200,"C"],[3200,"B"],[4000,"A"],[4390,"A"],[4490,"S"],[5030,"S"]] as [number,string][]) expect(MissionScore.RankPoints(score,true,scoring)).toBe(rank);
  expect(MissionScore.RankPoints(max,false,scoring)).toBe("D");
 });
 it("holds at 2200 until expiry, resets the clock, credits each required attacker once, and wins on the ninth",()=>{
  const s=BlueprintRunner.NewState(mission,0), ledger=new TargetScore(scoring);
  for(const t of M09_TARGETS) recordScoredKill(s,ledger,t.id,"ground",false,100,t.scoreRole);
  BlueprintRunner.Tick(s,599); expect(s.phaseIndex).toBe(0); BlueprintRunner.Tick(s,600); expect(s.phaseIndex).toBe(1); expect(BlueprintRunner.TimeRemaining(s)).toBe(420); expect(ledger.Total()).toBe(3260);
  expect(recordScoredKill(s,ledger,M09_TARGETS[0].id,"ground",false,601,"radar")).toBe(false);
  const fired=new Set<string>(); const ctx={elapsed:624,phase:1,requiredKills:0,destroyed:new Set<string>(),targets:M09_TARGETS};
  expect(takeArrival(M09_ATTACK_WAVES[1].id,M09_ATTACK_WAVES[1].trigger,ctx,fired)).toBe(false); ctx.elapsed=625; expect(takeArrival(M09_ATTACK_WAVES[1].id,M09_ATTACK_WAVES[1].trigger,ctx,fired)).toBe(true); expect(takeArrival(M09_ATTACK_WAVES[1].id,M09_ATTACK_WAVES[1].trigger,ctx,fired)).toBe(false);
  for(let i=0;i<9;i++) { expect(recordScoredKill(s,ledger,`attack-${i}`,"air",true,700+i,"attack")).toBe(true); if(i<8) expect(s.outcome).toBeUndefined(); }
  expect(s.outcome).toBe("won"); expect(ledger.Total()).toBe(4160); expect(recordScoredKill(s,ledger,"attack-8","air",true,710,"attack")).toBe(false);
 });
 it("fails on insufficient score, phase-two expiry, player loss and a destroyed landing force",()=>{
  const low=BlueprintRunner.NewState(mission,0); low.score=2199; BlueprintRunner.Tick(low,600); expect(low.reason).toBe("timeout");
  const late=winState(); BlueprintRunner.Tick(late,1020); expect(late.reason).toBe("timeout");
  for(const s of [BlueprintRunner.NewState(mission,0),winState()]) { BlueprintRunner.Tick(s,s.elapsed+1,0); expect(s.reason).toBe("destroyed"); }
  const plan=M09_GROUND_PROGRESS, states=newGroundProgress(plan), cleared=new Set<string>(); expect(stepGroundProgress(plan,states,cleared,90).size()).toBe(0);
  for(const id of plan.sectors[0].clearTargetIds) cleared.add(id); expect(stepGroundProgress(plan,states,cleared,90).size()).toBe(2); expect(states[0].secured).toBe(true); expect(states[1].started).toBe(false);
  damageSector(states[1],300); expect(states[1].health).toBe(0); for(const t of M09_TARGETS) cleared.add(t.id); stepGroundProgress(plan,states,cleared,100); expect(states[1].secured).toBe(false);
 });
 it("uses deck-safe carrier landing, taxi, fly-off and paused service",()=>{
  const p=M09_REARM; validateBatchD5(mission.phases,16000); expect(SortieArmament.Refill(p,mission.armament,"salvo").missiles).toBe(60); expect(SortieArmament.Refill(p,mission.armament,"salvo").gunRounds).toBe(1200); expect(p.health).toBe(false); expect(p.gun).toBe(true); expect(p.special).toBe(true);
  expect(p.landing.touchdown.y).toBe(M09_SERVICE.deckY+6); const rollout=landingPose(p.landing,landingDuration(p.landing)); expect(rollout.z).toBe(11480);
  expect(rearmPose(p,rearmDuration(p)).z).toBeLessThan(p.carrier!.catapult.z);
  const s=BlueprintRunner.NewState(mission,0); s.rearmActive=true; BlueprintRunner.Tick(s,900); expect(s.elapsed).toBe(0); expect(s.outcome).toBeUndefined();
 });
 it("gives the whole allied group one optional kill and no required attack credits",()=>{
  const s=BlueprintRunner.NewState(mission,0), ledger=new TargetScore(scoring), ids:string[]=[];
  expect(recordAlliedKill(s,ledger,ids,mission.allies!,"required","air",true,1,"raider")).toBe(false);
  expect(recordAlliedKill(s,ledger,ids,mission.allies!,"cover1","air",false,1,"raider")).toBe(true);
  expect(recordAlliedKill(s,ledger,ids,mission.allies!,"cover2","air",false,2,"raider")).toBe(false); expect(ledger.Total()).toBe(0); expect(s.requiredAirKills).toBe(0);
 });
 it("unlocks only after M08 in sequence, rejects forged/skipped settlement and persists a qualified M09 win",()=>withEarlier(()=>{
  const c=new CampaignCoordinator("m09",undefined,{now:()=>1000,defer:()=>undefined}); c.load(); expect(finish(c,9)).toBe(false);
  for(let id=1;id<=7;id++) { expect(canLaunchMission(9,c.getSlots()[0])).toBe(false); expect(finish(c,id)).toBe(true); }
  expect(finish(c,9)).toBe(false); expect(finish(c,8)).toBe(true); expect(highestUnlocked(c.getSlots()[0])).toBe(9);
  expect(finish(c,9,1)).toBe(true); expect(c.getSlots()[0].missions?.[9]?.completed===true).toBe(false);
  const ledger=new TargetScore(scoring); for(const t of M09_TARGETS) ledger.RecordKill(t.id,t.scoreRole); for(let i=0;i<9;i++) ledger.RecordKill(`a-${i}`,"attack");
  expect(finish(c,9,2,ledger)).toBe(true); const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0]; expect(saved.missions![9].completed).toBe(true); expect(saved.missions![9].bestScore).toBe(4160); expect(canLaunchMission(10,saved)).toBe(false);
  const old=MISSIONS[7].available; MISSIONS[7].available=false; for(let id=1;id<=18;id++) saved.missions![id]={completed:true}; expect(highestUnlocked(saved)).toBe(7); expect(canLaunchMission(9,saved)).toBe(false); MISSIONS[7].available=old;
 }));
});
