import { Difficulty } from "../shared/Difficulty";
import { retainProtection, type ProtectedActor } from "../server/EngineBatchD7Runtime";
import type { CombatSession } from "../server/CombatSession";
import { describe, expect, it } from "@rbxts/jest-globals";
import { mission, M13_PLANE, M13_JAMMING, M13_WAVES, M13_ESCORTS, M13_HEALTH } from "../shared/missions/m13";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { m13JammerLayout, m13Ground, m13RouteX, M13_WORLD_KEY } from "../shared/M13WorldPlan";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { coveringJammers, navigationStep } from "../shared/EngineBatchD9";
import { protectedHealth, protectedDuration, protectedPose, stepProtected, damageProtected, protectionResult, sameProtectedPlan } from "../shared/EngineBatchD7";
import type { ProtectedState } from "../shared/EngineBatchD7";
import { AlliedRules } from "../shared/AlliedRules";
import { ThreatRules } from "../shared/ThreatRules";
import { GunRules } from "../shared/SortieArmament";
import { CombatBalance } from "../shared/CombatBalance";
import { TargetScore } from "../shared/TargetScore";
import { MissionScore } from "../shared/MissionScore";
import { recordScoredKill, recordAlliedKill } from "../server/SortieScore";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, serializeProfile, normalizeProfile } from "../server/CampaignRepository";
function sweep() {const s=BlueprintRunner.NewState(mission,0);s.score=1300;BlueprintRunner.Tick(s,420);return s;}
describe("M13 EVIDENCE THROUGH THE GREY",()=>{
 it("validates clocks, world identity, gun and original subtitle story",()=>{
  MissionCatalog.ValidatePolicy(mission);expect(MissionCatalog.Available(13)).toBe(true);expect(mission.worldKey).toBe(M13_WORLD_KEY);
  expect(mission.phases.map(p=>p.kind)).toEqual(["score_threshold","required_air"]);
  expect(mission.phases[0].scoreThreshold).toEqual({points:1300,seconds:420,waitForExpiry:true});
  expect(mission.phases[1].update!.countdownSeconds).toBe(900);expect(mission.allies!.killBudget).toBe(1);
  expect(MissionCatalog.RequiredAirKills(mission)).toBe(8);
 });
 it("adopts all 32 world jammer ids and protected identity with no duplicate rosters",()=>{
  const layout=m13JammerLayout();expect(M13_JAMMING.airships.size()).toBe(32);
  expect(new Set([...layout.map(t=>t.id),M13_PLANE.id]).size()).toBe(33);
  layout.forEach((t,i)=>{const a=M13_JAMMING.airships[i];expect(a.id).toBe(t.id);expect(a.position).toEqual({x:t.x,y:t.y,z:t.z});});
  expect(sameProtectedPlan(mission.phases[0].protection!.aircraft[0],mission.phases[1].protection!.aircraft[0])).toBe(true);
 });
 it("retains the exact damaged runtime actor, route clock and navigation hold before phase cleanup",()=>{
  const bs=sweep(), state:ProtectedState={health:60,elapsed:400,safe:false,warned:true};
  const actor={plan:M13_PLANE,state,navigationHeld:13,aircraft:{health:60}} as ProtectedActor;
  const flight={phase:0,actors:[actor]}, session={blueprintState:bs,protectedFlight:flight} as CombatSession;
  expect(retainProtection(session)).toBe(true);expect(flight.phase).toBe(1);
  expect(session.protectedFlight!.actors[0]).toBe(actor);expect(actor.aircraft.health).toBe(60);
  expect(actor.state.elapsed).toBe(400);expect(actor.navigationHeld).toBe(13);
  bs.phaseIndex=2;expect(retainProtection(session)).toBe(false);
 });
 it("rejects a healed or rerouted continuation and hostile identity collisions",()=>{
  for(const change of ["health","route","wave"]) {
   const b={...mission,phases:mission.phases.map(p=>({...p,protection:{...p.protection!,aircraft:p.protection!.aircraft.map(a=>({...a,route:{...a.route,waypoints:a.route.waypoints.map(v=>({...v}))}}))},fighterWaves:p.fighterWaves?.map(w=>({...w}))}))};
   if(change==="health") b.phases[1].protection.aircraft[0].health+=1;
   if(change==="route") b.phases[1].protection.aircraft[0].route.waypoints[0].x+=1;
   if(change==="wave") b.phases[1].fighterWaves![0].id=M13_PLANE.id;
   expect(pcall(()=>MissionCatalog.ValidatePolicy(b))[0]).toBe(false);
  }
 });
 it("covers every cluster crossing, clears locally while distant airships live, and caps navigation holds",()=>{
  const ids=M13_JAMMING.airships.map(a=>a.id);
  for(let c=0;c<8;c++) {
   const corridor=M13_JAMMING.corridors[c*4],p={x:(corridor.a.x+corridor.b.x)/2,y:383,z:(corridor.a.z+corridor.b.z)/2};
   expect(coveringJammers(M13_JAMMING,p,ids)).toBeGreaterThan(0);
   expect(coveringJammers(M13_JAMMING,p,ids.filter(id=>!ids.filter((_,i)=>i>=c*4 && i<c*4+4).includes(id)))).toBe(0);
  }
  expect(coveringJammers(M13_JAMMING,M13_PLANE.route.waypoints[0],ids)).toBe(0);
  expect(navigationStep(25,true,0,20)).toEqual({advance:5,held:20});expect(navigationStep(1,true,20,20).advance).toBe(1);
 });
 it("offers a gun approach to every hull and 3x the perfect-hit ammunition budget",()=>{
  let needed=0;
  for(const a of M13_JAMMING.airships) {
   needed+=math.ceil(a.health/GunRules.Damage);
   const from={x:m13RouteX(a.position.z),y:a.position.y,z:a.position.z};
   const dx=a.position.x-from.x,dz=a.position.z-from.z,length=math.sqrt(dx*dx+dz*dz);
   expect(from.y-m13Ground(from.x,from.z)).toBeGreaterThan(30);
   expect(GunRules.Resolve(from,{x:dx/length,y:0,z:dz/length},[{position:a.position,ground:false,allowed:true}])).toBe(0);
  }
  expect(needed).toBe(384);expect(mission.armament!.gun!.rounds).toBeGreaterThanOrEqual(needed*3);
 });
 it("scores optional escorts without raising the achievable rank cuts",()=>{
  const requiredScore=32*100+M13_WAVES.reduce((n,w)=>n+w.count*60,0);
  const max=requiredScore+M13_ESCORTS.reduce((n,w)=>n+w.count*60,0)+240;expect(max).toBe(4040);
  expect(MissionScore.RankPoints(requiredScore,true,mission.scoring!)).toBe("S");
  for(const [score,rank] of [[1299,"D"],[1300,"C"],[1900,"B"],[2100,"A"],[2800,"S"],[max,"S"]] as [number,string][]) expect(MissionScore.RankPoints(score,true,mission.scoring!)).toBe(rank);
  expect(MissionScore.RankPoints(max,false,mission.scoring!)).toBe("D");
  expect(M13_WAVES.every(w=>w.route===undefined && w.attackProtected===M13_PLANE.id)).toBe(true);
 });
 it("holds the sweep after 13 kills, admits all 32 once and preserves score across update",()=>{
  const s=BlueprintRunner.NewState(mission,0),ledger=new TargetScore(mission.scoring!);
  for(const a of M13_JAMMING.airships) {
   expect(recordScoredKill(s,ledger,a.id,"air",false,100,"jammer")).toBe(true);
   expect(recordScoredKill(s,ledger,a.id,"air",false,100,"jammer")).toBe(false);
  }
  BlueprintRunner.ObserveProtection(s,1,false);expect(s.phaseIndex).toBe(0);
  BlueprintRunner.Tick(s,419.99);expect(s.phaseIndex).toBe(0);BlueprintRunner.Tick(s,420);expect(s.phaseIndex).toBe(1);
  expect(BlueprintRunner.TimeRemaining(s)).toBe(900);expect(ledger.Total()).toBe(3200);
  for(let i=0;i<8;i++) expect(recordScoredKill(s,ledger,`fighter${i}`,"air",true,520,"fighter")).toBe(true);
  expect(s.outcome).toBeUndefined();BlueprintRunner.ObserveProtection(s,1,false);expect(s.outcome).toBe("won");expect(ledger.Total()).toBe(3680);
 });
 it("requires both safety and all attackers, regardless of completion order",()=>{
  const s=sweep();BlueprintRunner.ObserveProtection(s,1,false);expect(s.outcome).toBeUndefined();
  for(let i=0;i<8;i++) BlueprintRunner.RecordKill(s,`f${i}`,"air",true,500);
  expect(s.outcome).toBe("won");
  const s2=sweep();BlueprintRunner.ObserveProtection(s2,0,true);expect(s2.reason).toBe("protected_lost");
  const first=BlueprintRunner.NewState(mission,0);BlueprintRunner.ObserveProtection(first,0,true);expect(first.reason).toBe("protected_lost");
  const low=BlueprintRunner.NewState(mission,0);low.score=1299;BlueprintRunner.Tick(low,420);expect(low.reason).toBe("timeout");
  const late=sweep();BlueprintRunner.Tick(late,1320);expect(late.reason).toBe("timeout");
  for(const st of [BlueprintRunner.NewState(mission,0),sweep()]) {BlueprintRunner.Tick(st,st.elapsed+1,0);expect(st.reason).toBe("destroyed");}
 });
 it("derives conditional damage and fire envelopes for Easy, Normal and Hard without assumed acquisition or hits",()=>{
  const budgets=Difficulty.Order.map(d=>{
   const hull=protectedHealth(M13_PLANE,d),hit=Difficulty.Scale(d,"hostileDamage",CombatBalance.hostileDamage[2]);
   const hits=math.ceil(hull/hit),state:ProtectedState={health:hull,elapsed:0,safe:false,warned:false};
   for(let i=1;i<hits;i++) damageProtected(state,hit);
   expect(state.health).toBeGreaterThan(0);damageProtected(state,hit);expect(protectionResult([state])).toBe("lost");
   const gate=ThreatRules.FlightGate(Difficulty.Scale(d,"hostileGate",CombatBalance.flightGate[2]),M13_WAVES.reduce((n,w)=>n+w.count,0),Difficulty.Scale(d,"flightDivisor",CombatBalance.flightDivisor[2]),false);
   const windup=Difficulty.Scale(d,"windup",CombatBalance.windup[2]);
   // Conditional earliest saturated damage bound, not a prediction of acquisition/impact.
   return {hits,window:(hits-1)*gate+windup,gate};
  });
  for(let i=1;i<budgets.size();i++) {
   expect(budgets[i-1].hits).toBeGreaterThan(budgets[i].hits);
   expect(budgets[i-1].window).toBeGreaterThan(budgets[i].window);
   expect(budgets[i-1].gate).toBeGreaterThan(budgets[i].gate);
  }
  expect(math.abs(protectedDuration(M13_PLANE)-600)).toBeLessThan(0.001);
  for(const hold of [0,M13_JAMMING.navigationHoldSeconds]) {
   const safe:ProtectedState={health:M13_HEALTH,elapsed:0,safe:false,warned:false};
   stepProtected(safe,M13_PLANE,protectedDuration(M13_PLANE)-hold-0.01);
   expect(safe.safe).toBe(false);stepProtected(safe,M13_PLANE,hold+0.02);
   expect(safe.safe).toBe(true);expect(damageProtected(safe,1000)).toBe(false);
  }
  for(let i=0;i<=600;i++) {const p=protectedPose(M13_PLANE,i).position;expect(p.y-m13Ground(p.x,p.z)).toBeGreaterThan(100);}
 });
 it("bounds the gun sweep using real damage, rate, clock and stock on every difficulty",()=>{
  const phase=mission.phases[0],threshold=phase.scoreThreshold!;
  const shots=M13_JAMMING.airships.map(a=>math.ceil(a.health/GunRules.Damage));
  const required=math.ceil(threshold.points/mission.scoring!.points.jammer);
  const full=shots.reduce((n,v)=>n+v,0),minimum=shots.filter((_,i)=>i<required).reduce((n,v)=>n+v,0);
  expect(required).toBeLessThanOrEqual(M13_JAMMING.airships.size());
  expect(full/GunRules.Rate).toBeLessThan(threshold.seconds);
  expect(mission.armament!.gun!.rounds).toBeGreaterThanOrEqual(full*3);
  // Airships and cannon are difficulty-invariant: no claimed travel, aim or pilot outcome.
  const slack=Difficulty.Order.map(()=>threshold.seconds-minimum/GunRules.Rate);
  expect(slack[0]).toBeGreaterThanOrEqual(slack[1]);expect(slack[1]).toBeGreaterThanOrEqual(slack[2]);
 });
 it("gives both allies eligible escorts but shares one kill without player credit or required progress",()=>{
  const s=sweep(),ledger=new TargetScore(mission.scoring!),destroyed:string[]=[];
  const escorts=mission.phases[1].fighterWaves!.filter(w=>AlliedRules.CanEngage(mission.allies!,{required:w.required===true,role:w.role,enabled:true,health:100}));
  expect(escorts).toEqual(M13_ESCORTS);expect(escorts.reduce((n,w)=>n+w.count,0)).toBe(2);
  const w=escorts[0];expect(w.attackProtected).toBeUndefined();
  expect(recordAlliedKill(s,ledger,destroyed,mission.allies!,`${w.id}_1`,"air",false,421,w.role)).toBe(true);
  expect(AlliedRules.ShotDamage(mission.allies!,destroyed.size(),false,30)).toBe(0);
  expect(recordAlliedKill(s,ledger,destroyed,mission.allies!,`${w.id}_2`,"air",false,422,w.role)).toBe(false);
  expect(destroyed.size()).toBe(1);expect(ledger.Total()).toBe(0);
  expect(s.requiredAirKills).toBe(0);expect(s.optionalAirKills).toBe(0);expect(s.phaseProgress).toBe(0);
  expect(recordScoredKill(s,ledger,`${w.id}_1`,"air",false,423,"fighter")).toBe(false);
  expect(recordScoredKill(s,ledger,`${w.id}_2`,"air",false,424,"fighter")).toBe(true);
  expect(ledger.Total()).toBe(60);
 });
 it("keeps every required raider, jammer and VEIL player-only before the allied budget is spent",()=>{
  const s=sweep(),ledger=new TargetScore(mission.scoring!);
  const candidates=[...M13_WAVES.map(w=>({id:w.id,required:w.required===true,role:w.role})),
   ...M13_JAMMING.airships.map(a=>({id:a.id,required:false,role:"bomber"})),
   {id:mission.phases[1].standaloneAce!.id,required:false,role:"ace"}];
  for(const c of candidates) {
   expect(AlliedRules.CanEngage(mission.allies!,{...c,enabled:true,health:100})).toBe(false);
   expect(recordAlliedKill(s,ledger,[],mission.allies!,c.id,c.role==="ace"?"ace":"air",c.required,421,c.role)).toBe(false);
  }
  expect(mission.phases[1].fighterWaves!.some(w=>w.id===M13_PLANE.id)).toBe(false);
 });
 it("unlocks only after M12 sequentially and rejects forged settlement while persisting qualified results",()=>{
  const before=MISSIONS.map(m=>m.available);for(let i=0;i<12;i++) MISSIONS[i].available=true;
  const [ok,err]=pcall(()=>{
   const c=new CampaignCoordinator("m13",undefined,{now:()=>1000,defer:()=>undefined});c.load();
   const finish=(id:number,phases=MissionCatalog.TotalPhases(MissionCatalog.Get(id)),ledger?:TargetScore)=>completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(MissionCatalog.Get(id))+MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)),groundKills:MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)),completedPhases:phases,elapsed:id===13?620:100,targetScore:ledger?.Snapshot()},()=>undefined,0);
   expect(finish(13)).toBe(false);
   for(let id=1;id<=11;id++) {expect(canLaunchMission(13,c.getSlots()[0])).toBe(false);expect(finish(id)).toBe(true);}
   expect(canLaunchMission(13,c.getSlots()[0])).toBe(false);
   const forged=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];forged.missions![13]={completed:true};expect(canLaunchMission(13,forged)).toBe(false);
   expect(finish(12)).toBe(true);expect(highestUnlocked(c.getSlots()[0])).toBe(13);
   expect(finish(13,1)).toBe(true);expect(c.getSlots()[0].missions?.[13]?.completed===true).toBe(false);
   const ledger=new TargetScore(mission.scoring!);for(const a of M13_JAMMING.airships) ledger.RecordKill(a.id,"jammer");for(let i=0;i<8;i++)ledger.RecordKill(`f${i}`,"fighter");ledger.RecordKill("veil","ace");for(let i=0;i<2;i++)ledger.RecordKill(`escort${i}`,"fighter");
   expect(finish(13,2,ledger)).toBe(true);const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];
   expect(saved.missions![13].completed).toBe(true);expect(saved.missions![13].bestScore).toBe(4040);
  });
  MISSIONS.forEach((m,i)=>m.available=before[i]);if(!ok) error(err,0);
 });
});
