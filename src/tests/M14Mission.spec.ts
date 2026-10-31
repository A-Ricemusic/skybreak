import { authoredAirRequest } from "../server/PhaseDirectorRules";
import { WavePlan } from "../shared/WavePlan";
import { Difficulty } from "../shared/Difficulty";
import { CombatBalance } from "../shared/CombatBalance";
import { ThreatRules } from "../shared/ThreatRules";
import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M14_SALVOS, M14_SITE } from "../shared/missions/m14";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { cruiseRoute, cruiseDestroyed, cruiseComplete, newCruiseStates } from "../shared/EngineBatchD10";
import { BomberRules } from "../shared/BomberRules";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { canLaunchMission } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { AlliedRules } from "../shared/AlliedRules";
import { m14Ground, m14TargetLayout } from "../shared/M14WorldPlan";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
function prerequisites(fn:()=>void) {
 const before=MISSIONS.map(m=>m.available);
 for(let i=0;i<13;i++) MISSIONS[i].available=true;
 const [ok,err]=pcall(fn);
 for(let i=0;i<MISSIONS.size();i++) MISSIONS[i].available=before[i];
 if(!ok) error(err,0);
}
function fullLedger() {
 const ledger=new TargetScore(bp.scoring!);
 for(const p of M14_SALVOS) for(const t of p.targets) if(!t.separateSeconds) ledger.RecordKill(t.id,t.scoreRole);
 for(let i=0;i<9;i++) ledger.RecordKill(`fighter_${i}`,"stealth_fighter");
 ledger.RecordKill("bomber","strategic_bomber");return ledger;
}
describe("M14 Aurora shield",()=>{
 it("validates stable world kill slots, protected station, subtitles and allied limits",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.phases.size()).toBe(3);
  const leaves=M14_SALVOS.reduce<string[]>((ids,p)=>[...ids,...p.targets.filter(t=>!t.separateSeconds).map(t=>t.id)],[]);
  expect(leaves.size()).toBe(16);expect(new Set(leaves).size()).toBe(16);
  for(const t of m14TargetLayout().filter(t=>t.group==="intercept")) expect(leaves.includes(t.id)).toBe(true);
  expect(M14_SITE.id).toBe("m14_crown_station");expect(bp.ground.size()).toBe(0);expect(MissionCatalog.RequiredAirKills(bp)).toBe(0);
  expect(bp.briefing).toBe(MISSION_STORY_TEXT[14].briefing);expect(bp.allies!.killBudget).toBe(1);expect(bp.allies!.creditPlayerKills).toBe(false);
  expect(AlliedRules.CanEngage(bp.allies!,{required:false,role:"raider",enabled:true,health:100})).toBe(true);
  expect(AlliedRules.CanEngage(bp.allies!,{required:true,role:"bomber",enabled:true,health:24})).toBe(false);
  for(const p of bp.phases) {expect(p.concurrentRoutes).toBe(1);expect(p.concurrentFighters).toBe(8);}
 });
 it("orders optional fighter pressure Easy/Normal/Hard from runtime rules without changing the intercept clock",()=>{
  const reaction=Difficulty.Order.map(d=>{
   const queue=bp.phases[1].fighterWaves!.map(authoredAirRequest);
   const live=WavePlan.Admit(queue,bp.phases[1].concurrentFighters!,bp.phases[1].concurrentRoutes).reduce((n,b)=>n+b.count,0);
   expect(live).toBe(6);expect(queue.size()).toBe(0);
   const gate=ThreatRules.FlightGate(Difficulty.Scale(d,"hostileGate",CombatBalance.flightGate[2]),live,Difficulty.Scale(d,"flightDivisor",CombatBalance.flightDivisor[2]));
   const damage=Difficulty.Scale(d,"hostileDamage",CombatBalance.hostileDamage[2]);
   const windup=Difficulty.Scale(d,"windup",CombatBalance.windup[2]);
   // Conditional perfect-hit envelope; no claim about pursuit, player survival or human reaction.
   return windup+gate*math.ceil(100/damage);
  });
  expect(reaction[0]).toBeGreaterThan(reaction[1]);expect(reaction[1]).toBeGreaterThan(reaction[2]);
  for(const d of Difficulty.Order) {

   expect(bp.phases[2].concurrentRoutes).toBe(1);
  }
  expect(bp.countdownSeconds).toBe(1200);
 });
 it("reconciles the 1700 missile ledger, increased pressure and attainable provisional ranks",()=>{
  let missile=0;for(const p of M14_SALVOS) for(const t of p.targets) if(!t.separateSeconds) missile+=bp.scoring!.points[t.scoreRole];
  expect(missile).toBe(1700);expect(fullLedger().Total()).toBe(2980);
  expect(fullLedger().Total()-120>=bp.scoring!.rank.S).toBe(true);
  expect(bp.scoring!.rank).toEqual({S:2260,A:2000,B:1850,C:1700});
  expect(bp.phases.reduce((n,p)=>n+(p.fighterWaves??[]).reduce((m,w)=>m+w.count,0),0)).toBe(10);
 });
 it("keeps every cruise route clear of terrain",()=>{
  for(const p of M14_SALVOS) for(const t of p.targets) for(let sec=0;sec<=cruiseRoute(t).duration;sec++) {
   const v=BomberRules.Sample(cruiseRoute(t),sec).slots[0].position;
   expect(v.y-m14Ground(v.x,v.z)>=60).toBe(true);
  }
 });
 it("awards the forgone child value for early carrier kills without synthetic child kills",()=>{
  const state=Runner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  let kills=0;
  for(const plan of M14_SALVOS) {
   const states=newCruiseStates(plan);
   for(let i=0;i<plan.targets.size();i++) {
    const t=plan.targets[i]; if(t.parentId) continue;
    states[i].status="active";cruiseDestroyed(plan,states,i);
    expect(recordScoredKill(state,ledger,t.id,"air",true,10,t.scoreRole)).toBe(true);kills++;
    expect(recordScoredKill(state,ledger,t.id,"air",true,10,t.scoreRole)).toBe(false);
   }
   expect(cruiseComplete(states)).toBe(true);Runner.ResolveCruise(state,true);
  }
  expect(state.outcome).toBe("won");expect(kills).toBe(12);
  expect(ledger.Total()).toBe(1700);expect(ledger.Total()>=bp.scoring!.rank.C).toBe(true);
  expect(ledger.RoleKills("cruise_carrier")).toBe(2);
 });
 it("makes neglect an impact loss, separation no credit and the final director authoritative",()=>{
  const s=Runner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(const p of M14_SALVOS) {
   for(const t of p.targets) if(!t.separateSeconds) expect(recordScoredKill(s,ledger,t.id,"air",true,10,t.scoreRole)).toBe(true);
   expect(s.outcome).toBeUndefined();Runner.ResolveCruise(s,true);
  }
  expect(s.outcome).toBe("won");expect(ledger.Total()).toBe(1700);
  expect(recordScoredKill(s,ledger,"late","air",true,20,"cruise")).toBe(false);
  const p=M14_SALVOS[1],states=newCruiseStates(p);states[0].status="active";cruiseDestroyed(p,states,0);
  expect(states[0].status).toBe("destroyed");for(let i=1;i<=3;i++) expect(states[i].status).toBe("cancelled");
  const split=newCruiseStates(p);split[0].status="separated";expect(cruiseComplete(split)).toBe(false);
  const lost=Runner.NewState(bp,0);const firstImpact=20+cruiseRoute(M14_SALVOS[0].targets[0]).duration;
  expect(firstImpact<240).toBe(true);Runner.Tick(lost,firstImpact);Runner.ResolveCruise(lost,false);Runner.ResolveCruise(lost,true);expect(lost.reason).toBe("protected_lost");
  const expired=Runner.NewState(bp,0);Runner.Tick(expired,1200);expect(expired.outcome).toBe("failed");
  const dead=Runner.NewState(bp,0);Runner.Tick(dead,1,0);expect(dead.reason).toBe("destroyed");
 });
 it("rejects forged prerequisite holes and settles only a completed sortie",()=>prerequisites(()=>{
  const c=new CampaignCoordinator("m14",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions??={};
  for(let n=1;n<=18;n++) slot.missions[n]={completed:true};
  for(let n=1;n<=13;n++) {slot.missions[n]={completed:false};expect(canLaunchMission(14,slot)).toBe(false);slot.missions[n]={completed:true};}
  expect(canLaunchMission(14,slot)).toBe(true);slot.missions[14]={completed:false};
  for(let n=1;n<=13;n++) c.recordMissionResult(1,n,true,100,100);
  const ledger=fullLedger();
  const settle=(phases:number)=>completeMission(c,1,14,true,{slot:1,missionId:14,kills:26,groundKills:0,completedPhases:phases,elapsed:800,targetScore:ledger.Snapshot()},()=>undefined,0);
  settle(2);expect(slot.missions[14].completed).toBe(false);settle(3);settle(3);
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![14];
  expect(saved.completed).toBe(true);expect(saved.bestTargetScore!.total).toBe(2980);
  let lowWon=false;
  completeMission(c,1,14,true,{slot:1,missionId:14,kills:12,groundKills:0,completedPhases:3,elapsed:700},message=>{lowWon=message.kind==="Completed";},0);
  expect(lowWon).toBe(true);
 }));
});
