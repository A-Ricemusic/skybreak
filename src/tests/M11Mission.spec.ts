import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { mission as bp, M11_AIRCRAFT, M11_WAVES, M11_SAFE_SECONDS, M11_AIRCRAFT_HEALTH } from "../shared/missions/m11";
import { m11CivilianLayout, m11Ground } from "../shared/M11WorldPlan";
import { protectedDuration, protectedPose, stepProtected, damageProtected, protectionResult, ProtectedState } from "../shared/EngineBatchD7";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { CombatBalance } from "../shared/CombatBalance";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { Difficulty } from "../shared/Difficulty";
import { ThreatRules } from "../shared/ThreatRules";
import { AlliedRules } from "../shared/AlliedRules";
import { CampaignCoordinator, completeMission, serializeProfile, normalizeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
const fresh = ():ProtectedState=>({health:M11_AIRCRAFT_HEALTH,elapsed:0,safe:false,warned:false});
function prerequisites(fn:()=>void) {
 const before=MISSIONS.map(b=>b.available);
 for(let i=0;i<10;i++) MISSIONS[i].available=true;
 const [ok,err]=pcall(fn);
 for(let i=0;i<MISSIONS.size();i++) MISSIONS[i].available=before[i];
 if(!ok) error(err,0);
}
describe("M11 High Crossing",()=>{
 it("validates stable civilian identities, separate bands, finite waves and original story",()=>{
  MissionCatalog.ValidatePolicy(bp); expect(bp.available).toBe(true);expect(bp.worldKey).toBe("m11_high_crossing");expect(bp.countdownSeconds).toBe(330);
  expect(M11_AIRCRAFT.map(a=>a.id)).toEqual(m11CivilianLayout().map(a=>a.id));
  const ids=[...M11_AIRCRAFT.map(a=>a.id),...M11_WAVES.map(w=>w.id),bp.phases[0].standaloneAce!.id];
  expect(new Set(ids).size()).toBe(ids.size());expect(bp.ground.size()).toBe(0);
  for(const a of M11_AIRCRAFT) { expect(a.health).toBe(M11_AIRCRAFT_HEALTH); expect(protectedDuration(a)).toBeCloseTo(M11_SAFE_SECONDS,6);
   for(let t=0;t<=314;t++) {const p=protectedPose(a,t).position;expect(p.y).toBe(a.id==="m11_civilian_high"?2800:900);expect(p.y-m11Ground(p.x,p.z)).toBeGreaterThanOrEqual(150);}
  }
  expect(bp.briefing).toBe(MISSION_STORY_TEXT[11].briefing);expect(bp.phases[0].beat).toBe(MISSION_STORY_TEXT[11].radio[0]);
 });
 it("increases the reference eleven-air pressure while retaining ledger ranks and optional ace",()=>{
  const ordinary=M11_WAVES.reduce((n,w)=>n+w.count,0);expect(ordinary).toBe(17);expect(ordinary+1).toBeGreaterThan(11);
  const maximum=ordinary*60+240;expect(maximum).toBe(1260);
  expect(bp.scoring!.rank).toEqual({S:780,A:360,B:240,C:120});
  // Even after the allied group's single uncredited kill S remains attainable.
  expect(maximum-60).toBeGreaterThan(bp.scoring!.rank.S);
  expect(AlliedRules.BudgetRemaining(bp.allies!,0)).toBe(true);expect(AlliedRules.BudgetRemaining(bp.allies!,1)).toBe(false);expect(AlliedRules.Credit(bp.allies!)).toBe(false);
 });
 it("assigns every ordinary threat to a civilian, bypasses player evade, and excludes civilians from TGT",()=>{
  for(const w of M11_WAVES) {expect(M11_AIRCRAFT.some(a=>a.id===w.attackProtected)).toBe(true);expect(w.aircraft).toBeUndefined();expect(w.route).toBeUndefined();}
  expect(bp.phases[0].concurrentFighters).toBe(6);
  const gate={separation:900,aimDot:0.9,fireTimer:0,globalReady:true,evading:true,playerStraight:false,minRange:400,maxRange:1900,aimThreshold:0.55,straightRelax:0.25};
  expect(ThreatRules.MayFire(gate,true)).toBe(true);expect(ThreatRules.MayFire(gate,false)).toBe(false);
  expect(AlliedRules.PlayerTarget({friendly:true,enabled:true,health:140})).toBe(false);
 });
 it("uses all six pursuit slots with M10 route reservation absent, without losing queued attackers",()=>{
  const phase=bp.phases[0];expect(phase.concurrentRoutes).toBeUndefined();
  const queue:AirRequest[]=M11_WAVES.map(arrival=>({arrival,role:"raider",count:arrival.count,behind:false}));
  queue.push({arrival:phase.standaloneAce!,role:"ace",count:1,behind:false});
  let admitted=0;
  while(queue.size()>0) {
   const batch=WavePlan.Admit(queue,phase.concurrentFighters!);
   const count=batch.reduce((n,w)=>n+w.count,0);
   expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(6);
   if(admitted===0) {expect(count).toBe(6);expect(batch[0].role).toBe("ace");}
   admitted+=count;
  }
  expect(admitted).toBe(18);
 });
 it("bounds Normal pressure against a conservative ten-second intercept budget and warned windups",()=>{
  // Explicit analytical envelope, not a Player flight: 2 missiles/kill (5s replenishment),
  // 5s aiming/reposition, plus 25s per altitude-band change. Gun/specials excluded.
  const killSeconds=10, transition=25, count=M11_WAVES.reduce((n,w)=>n+w.count,0);
  expect(60+count*killSeconds+2*transition).toBeLessThan(M11_SAFE_SECONDS);
  expect(count*2).toBeLessThan(8+math.floor(M11_SAFE_SECONDS/2.5));
  for(let i=1;i<M11_WAVES.size();i++) {
   const prev=M11_WAVES[i-1], following=M11_WAVES[i];
   expect(prev.trigger.kind).toBe("time");expect(following.trigger.kind).toBe("time");
   if(prev.trigger.kind==="time" && following.trigger.kind==="time") expect(prev.count*killSeconds).toBeLessThan(following.trigger.seconds-prev.trigger.seconds);
  }
  const gate=ThreatRules.FlightGate(CombatBalance.flightGate[1],6,CombatBalance.flightDivisor[1]);
  expect(ThreatRules.ThreatCap(6,CombatBalance.threatCap[1])).toBe(1);
  // Pessimistically allow a hit immediately then every shared gate, all aimed at one plane,
  // through a four-air intercept + a band transition. Independent ace chases player.
  const damage=(1+math.ceil((4*killSeconds+transition)/gate))*CombatBalance.hostileDamage[1];
  expect(damage).toBeLessThan(M11_AIRCRAFT_HEALTH);
 });
 // Analytical encounter simulation: guaranteed in-range/aimed shots after acquisition,
 // no misses. Not a CombatService steering or Player test. The neglected band keeps
 // >=2 attackers even after the allied budget; the other band is cleared promptly.
 it("derives all difficulty gates and projectile delay from authoritative combat tables",()=>{
  const gates=[17.857142857,11.428571429,4.857142857];
  for(let i=0;i<Difficulty.Order.size();i++) {
   const d=Difficulty.Order[i];
   const gate=ThreatRules.FlightGate(Difficulty.Scale(d,"hostileGate",CombatBalance.flightGate[1]),6,Difficulty.Scale(d,"flightDivisor",CombatBalance.flightDivisor[1]));
   expect(gate).toBeCloseTo(gates[i],6);
  }
  for(const a of M11_AIRCRAFT) {
   // Even a shot launched at the 2300-stud launch cutoff can catch the
   // receding aircraft within missile life; real steering may still miss.
   expect(2300/(CombatBalance.missileSpeed[1]-a.route.speed)).toBeLessThan(CombatBalance.missileLife[1]);
  }
 });
 it("loses either neglected escort before safety despite acquisition and full-lifetime travel delay",()=>{
  for(const aircraft of M11_AIRCRAFT) {
   const wave=M11_WAVES.find(w=>w.attackProtected===aircraft.id)!;
   assert(wave.trigger.kind==="time");
   const live=wave.count-1; // pessimistically spend the allied kill on this band
   const gate=ThreatRules.FlightGate(CombatBalance.flightGate[1],live,CombatBalance.flightDivisor[1]);
   const windup=CombatBalance.windup[1],travel=CombatBalance.missileLife[1];
   const spacing=math.max(gate,windup+travel,windup+CombatBalance.banditReload[1]);
   const state=fresh(),runner=R.NewState(bp,0);
   let at=wave.trigger.seconds+45+4+windup+travel;
   while(state.health>0 && at<M11_SAFE_SECONDS) {
    stepProtected(state,aircraft,at-state.elapsed);damageProtected(state,CombatBalance.hostileDamage[1]);
    at+=spacing;
   }
   expect(protectionResult([state,fresh()])).toBe("lost");
   expect(state.elapsed).toBeLessThan(M11_SAFE_SECONDS);
   R.ObserveProtection(runner,0,true);expect(runner.reason).toBe("protected_lost");
  }
 });
 it("survives attentive defence and a recoverable 30-second lapse at either altitude",()=>{
  // Clear each wave at 10s/contact, serially; allow 25s per altitude change.
  // A lapse delays one wave by 30s and propagates to subsequent waves.
  // Overstate pressure by ignoring startup/travel, granting a hit at windup
  // completion and every fastest shared gate until the whole wave is cleared.
  const gate=ThreatRules.FlightGate(CombatBalance.flightGate[1],6,CombatBalance.flightDivisor[1]);
  for(const lapseBand of ["none","m11_civilian_low","m11_civilian_high"]) {
   const states=M11_AIRCRAFT.map(()=>fresh());let lapsed=false, clearedAt=0, lastBand="m11_civilian_high";
   for(const wave of M11_WAVES) {
    const index=M11_AIRCRAFT.findIndex(a=>a.id===wave.attackProtected);
    const lapse=!lapsed && wave.attackProtected===lapseBand ? 30 : 0;
    if(lapse>0) lapsed=true;
    assert(wave.trigger.kind==="time");
    const start=math.max(wave.trigger.seconds,clearedAt+(lastBand===wave.attackProtected ? 0 : 25))+lapse;
    clearedAt=start+wave.count*10;lastBand=wave.attackProtected!;
    expect(clearedAt).toBeLessThan(M11_SAFE_SECONDS);
    // After each kill actual live count falls and the gate only gets slower.
    const hits=1+math.floor((clearedAt-wave.trigger.seconds-CombatBalance.windup[1])/gate);
    damageProtected(states[index],hits*CombatBalance.hostileDamage[1]);
   }
   for(let i=0;i<states.size();i++) {expect(states[i].health).toBeGreaterThan(0);stepProtected(states[i],M11_AIRCRAFT[i],M11_SAFE_SECONDS);}
   expect(protectionResult(states)).toBe("safe");
   const runner=R.NewState(bp,0);R.ObserveProtection(runner,2,false);expect(runner.outcome).toBe("won");
  }
 });
 it("needs both safe, never kill count or points, and fails either loss or expiry",()=>{
  const a=fresh(),b=fresh(),s=R.NewState(bp,0);s.score=1260;
  stepProtected(a,M11_AIRCRAFT[0],314);stepProtected(b,M11_AIRCRAFT[1],200);
  expect(protectionResult([a,b])).toBeUndefined();R.ObserveProtection(s,1,false);expect(s.outcome).toBeUndefined();
  stepProtected(b,M11_AIRCRAFT[1],114);expect(protectionResult([a,b])).toBe("safe");R.ObserveProtection(s,2,false);expect(s.outcome).toBe("won");expect(s.killedIds.size()).toBe(0);
  for(const lost of [0,1]) {const states=[fresh(),fresh()];damageProtected(states[lost],140);expect(protectionResult(states)).toBe("lost");const f=R.NewState(bp,0);R.ObserveProtection(f,0,true);expect(f.reason).toBe("protected_lost");}
  const timeout=R.NewState(bp,0);R.Tick(timeout,330);expect(timeout.reason).toBe("timeout");
  const dead=R.NewState(bp,0);R.Tick(dead,1,0);R.ObserveProtection(dead,2,false);expect(dead.reason).toBe("destroyed");
 });
 it("rejects forged sequential unlocks; settles full wins once and persists points",()=>prerequisites(()=>{
  const c=new CampaignCoordinator("m11-test",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions ??= {};
  for(let id=1;id<=18;id++) slot.missions[id]={completed:true};
  for(const missing of [10,8,3]) {slot.missions[missing]={completed:false};expect(canLaunchMission(11,slot)).toBe(false);slot.missions[missing]={completed:true};}
  expect(canLaunchMission(11,slot)).toBe(true);expect(canLaunchMission(12,slot)).toBe(false);slot.missions[11]={completed:false};
  for(let id=1;id<=10;id++) {
   const earlier=MissionCatalog.Get(id);
   completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(earlier)+MissionCatalog.RequiredGroundKills(earlier),groundKills:MissionCatalog.RequiredGroundKills(earlier),completedPhases:MissionCatalog.TotalPhases(earlier),elapsed:100},()=>undefined,0);
  }
  expect(canLaunchMission(11,c.getSlots()[0])).toBe(true);
  const ledger=new TargetScore(bp.scoring!);ledger.RecordKill("first","fighter");ledger.RecordKill("first","fighter");ledger.RecordKill("rime","ace");expect(ledger.Total()).toBe(300);
  const finish=(won:boolean,phases:number,elapsed:number)=>completeMission(c,1,11,won,{slot:1,missionId:11,kills:2,groundKills:0,completedPhases:phases,elapsed,targetScore:ledger.Snapshot()},()=>undefined,0);
  finish(true,0,314);expect(c.getSlots()[0].missions?.[11]?.completed===true).toBe(false);finish(false,1,314);expect(c.getSlots()[0].missions?.[11]?.completed===true).toBe(false);finish(true,1,330);expect(c.getSlots()[0].missions?.[11]?.completed===true).toBe(false);
  finish(true,1,314);expect(c.getSlots()[0].missions?.[11]?.completed).toBe(true);
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![11];expect(saved.bestScore).toBe(300);expect(saved.bestTargetScore?.total).toBe(300);
 }));
});
