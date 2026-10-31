import { describe, expect, it } from "@rbxts/jest-globals";
import { mission, M14_SALVOS } from "../shared/missions/m14";
import { FlightMath } from "../shared/FlightMath";
import { WeaponRules as W, Point } from "../shared/WeaponRules";
import { BomberRules } from "../shared/BomberRules";
import { cruiseRadar, cruiseRoute } from "../shared/EngineBatchD10";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { SortieArmament } from "../shared/SortieArmament";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { CruiseBudget } from "../shared/EngineBatchD10";
import { m14Ground } from "../shared/M14WorldPlan";

import { authoredAirRequest } from "../server/PhaseDirectorRules";
import { WavePlan } from "../shared/WavePlan";
import { CombatBalance } from "../shared/CombatBalance";
import { EvadeRules } from "../shared/EvadeRules";
import { ThreatRules } from "../shared/ThreatRules";

const sub=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n,z:a.z*n});
const length=(a:Point)=>math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const unit=(a:Point)=>mul(a,1/math.max(length(a),1e-9));
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y+a.z*b.z;
// Invert the shared half-linear/half-quadratic stick shaping. Inputs remain within [-1,1].
function stick(rate:number):number {
 const v=math.clamp(rate,-1,1);
 return math.sign(v)*(-0.5+math.sqrt(0.25+2*math.abs(v)));
}
function simulate(difficulty:DifficultyKind, attentive:boolean, dt:number) {
 // Cruise actors have fixed health/speed and zero flares on every difficulty.

 expect(SpecialWeapons.StandardDamage>=CruiseBudget.health).toBe(true);
 const start=mission.start!;
 assert(start.kind==="airborne");
 const jet=FlightMath.FromPose(start.x,start.y,start.z,math.rad(start.headingDegrees),0,start.speed!);
 let elapsed=0,ammo=W.MaxMissiles,regen=0,cooldown=0,kills=0,minMargin=math.huge,maxBank=0,maxMove=0;
 // Analytic combat envelope, matching CombatBalance.spec's 60% firing opportunity
 // and 50% connections. No fighter kills or allied relief; not a projectile/Player test.
 let incomingDamage=0, expectedDamage=0, defendedDamage=0, contactClock=0;
 const evade=EvadeRules.New();
 const admittedCounts:number[]=[];
 for(let phaseIndex=0;phaseIndex<M14_SALVOS.size();phaseIndex++) {
  const plan=M14_SALVOS[phaseIndex], phase=mission.phases[phaseIndex];
  // All M14 arrivals trigger at phase start. PhaseDirector clears pursuers/queue
  // on transition. Use its real request constructor and shared slot admission.
  const queue=(phase.fighterWaves??[]).map(arrival=>{
   expect(arrival.trigger.kind).toBe("phase_start");
   return authoredAirRequest(arrival);
  });
  const admitted=WavePlan.Admit(queue,phase.concurrentFighters??WavePlan.Budget(),phase.concurrentRoutes);
  expect(queue.size()).toBe(0);
  const live=admitted.reduce((n,b)=>n+b.count,0);
  admittedCounts.push(live);
  const act=mission.act-1;
  const gate=ThreatRules.FlightGate(Difficulty.Scale(difficulty,"hostileGate",CombatBalance.flightGate[act]),live,
   Difficulty.Scale(difficulty,"flightDivisor",CombatBalance.flightDivisor[act]),phase.directed===true);
  const damage=Difficulty.Scale(difficulty,"hostileDamage",CombatBalance.hostileDamage[act]);
  const leaves=plan.targets.filter(t=>t.separateSeconds===undefined).map(t=>{
   const parent=plan.targets.find(p=>p.id===t.parentId);
   const release=parent?(parent.arrivalSeconds??0)+parent.separateSeconds!:(t.arrivalSeconds??0);
   return {t,release,route:cruiseRoute(t),dead:false};
  });
  let time=0,selected=-1,lock=0;
  const shots:{target:number,position:Point,direction:Point,age:number}[]=[];
  while(!leaves.every(t=>t.dead) && elapsed<1200) {
   // Full opportunity budget deliberately ignores aim/range/cap delays; expected
   // absorption applies the same documented contact assumptions on every difficulty.
   EvadeRules.Tick(evade,dt);
   // Deterministic 60%-opportunity cadence, all shots otherwise connect. Perfectly
   // timed decoys use real charge/recharge limits, carried across phases. This
   // separate defense witness assumes warning reaction, not measured pilot skill.
   contactClock+=dt;
   if(contactClock>=gate/0.6) {
    contactClock-=gate/0.6;
    if(EvadeRules.Use(evade,false)) {
     expect(EvadeRules.Open(evade) && EvadeRules.Decoys(EvadeRules.DecoyRadius,1)).toBe(true);
    } else defendedDamage+=damage;
   }
   incomingDamage+=dt/gate*damage;
   expectedDamage+=dt/gate*damage*0.6*0.5;
   time+=dt;elapsed+=dt;cooldown=math.max(0,cooldown-dt);
   [ammo,regen]=SortieArmament.RackTick(ammo,regen,dt,mission.armament);
   const active=leaves.findIndex(t=>!t.dead && time>=t.release);
   const target=active>=0?leaves[active]:undefined;
   if(leaves.some(t=>!t.dead && time>=t.release+t.route.duration)) return {won:false,kills,elapsed,minMargin,maxBank,maxMove,incomingDamage,expectedDamage,defendedDamage,admittedCounts};
   const pose=target?BomberRules.Sample(target.route,time-target.release).slots[0].position:undefined;
   const before={x:jet.x,y:jet.y,z:jet.z};
   // Chase oldest active leaf at cruise, then hold a full-stick level turn until the next release.
   // Carriers are deliberately allowed to split, exercising the simultaneous triple release.
   const delta=pose?sub(pose,jet):undefined;
   const yaw=delta?math.atan2(-delta.x,-delta.z):jet.yaw;
   const pitch=delta?math.atan2(delta.y,math.sqrt(delta.x**2+delta.z**2)):0;
   FlightMath.Step(jet,{
    x:delta?stick(-FlightMath.WrapAngle(yaw-jet.yaw)*2/FlightMath.TurnRate):1,
    y:stick((pitch-jet.pitch)*2/FlightMath.PitchRate),throttle:FlightMath.CruiseThrottle,
   },dt,mission.airspace);
   maxBank=math.max(maxBank,math.abs(jet.roll));maxMove=math.max(maxMove,length(sub(jet,before)));
   expect(jet.y-m14Ground(jet.x,jet.z)>=60).toBe(true);
   expect(math.abs(jet.x)<mission.airspace!.softHalfWidth && math.abs(jet.z)<mission.airspace!.softHalfWidth).toBe(true);
   if(active!==selected) {selected=active;lock=0;}
   const [fx,fy,fz]=FlightMath.ForwardOf(jet),forward={x:fx,y:fy,z:fz};
   if(pose) {
    const offset=sub(pose,jet),distance=length(offset),nose=dot(unit(offset),forward);
    const visible=cruiseRadar(distance,pose.y-m14Ground(pose.x,pose.z),true);
    const envelope=visible && distance<=W.AirLockRange && nose>=W.LockDot;
    lock=envelope?math.min(1,lock+dt/W.LockBuildSeconds):math.max(0,lock-dt*W.LockDecayPerSecond);
    if(attentive && visible && W.Launch({missiles:ammo,missileCooldown:cooldown,hasTarget:true,lockProgress:lock,distance,dot:nose}).kind==="guided"
     && !shots.some(s=>s.target===active)) {
     shots.push({target:active,position:add(add(jet,mul(forward,16)),{x:0,y:-2,z:0}),direction:forward,age:0});
     ammo--;cooldown=W.MissileFireInterval;
    }
   }
   for(let i=shots.size()-1;i>=0;i--) {
    const shot=shots[i],leaf=leaves[shot.target];shot.age+=dt;
    if(leaf.dead || shot.age>W.GuidedLifetime) {shots.remove(i);continue;}
    const position=BomberRules.Sample(leaf.route,time-leaf.release).slots[0].position;
    const nextPose=BomberRules.Sample(leaf.route,time-leaf.release+dt).slots[0].position;
    const distance=length(sub(position,shot.position));
    const velocity=mul(sub(nextPose,position),1/dt);
    const lead=math.clamp(distance/W.MissileSpeed,0,W.MissileLeadMax);
    const aim=unit(sub(add(position,mul(velocity,lead)),shot.position));
    const alpha=FlightMath.DampAlpha(W.MissileTurnRate(distance),dt);
    shot.direction=unit(add(mul(shot.direction,1-alpha),mul(aim,alpha)));
    const endpoint=add(shot.position,mul(shot.direction,W.MissileSpeed*dt));
    if(W.SegmentDistance(position,shot.position,endpoint)<W.FuseRadius) {
     // D10 cruise health is difficulty-independent, no bandit flares/health multiplier.
     leaf.dead=true;kills++;minMargin=math.min(minMargin,leaf.release+leaf.route.duration-time);shots.remove(i);
    } else shot.position=endpoint;
   }
  }
 }
 return {won:kills===16,kills,elapsed,minMargin,maxBank,maxMove,incomingDamage,expectedDamage,defendedDamage,admittedCounts};
}
describe("M14 continuous flight strategy",()=>{
 for(const dt of [0.05,0.1]) it(`orders admitted hostile pressure and survives Ace under the contact model dt=${dt}`,()=>{
  const results=Difficulty.Order.map(d=>simulate(d,true,dt));
  for(const result of results) {expect(result.won).toBe(true);expect(result.admittedCounts).toEqual([3,6,1]);}
  for(let i=1;i<results.size();i++) {
   expect(results[i].incomingDamage>results[i-1].incomingDamage).toBe(true);
   expect(results[i].expectedDamage>results[i-1].expectedDamage).toBe(true);
  }
  const hard=results[2];
  print(`M14 threat dt=${dt}: expected hull loss Easy=${results[0].expectedDamage}, Normal=${results[1].expectedDamage}, Ace=${hard.expectedDamage}`);
  print(`M14 Ace timely-evade residual damage=${hard.defendedDamage}`);
  expect(hard.defendedDamage<100).toBe(true);
 });
 for(const difficulty of Difficulty.Order) for(const dt of [0.05,0.1]) {
  it(`intercepts every leaf on ${difficulty} at dt=${dt}`,()=>{
   const result=simulate(difficulty,true,dt);
   print(`M14 ${difficulty} dt=${dt}: kills=${result.kills}, seconds=${result.elapsed}, impact margin=${result.minMargin}`);
   expect(result.won).toBe(true);expect(result.kills).toBe(16);
   expect(result.elapsed<1200).toBe(true);expect(result.minMargin>15).toBe(true);
   expect(result.maxBank<=FlightMath.LeanMax+0.001).toBe(true);
   expect(result.maxMove>FlightMath.CruiseSpeed*dt*0.99).toBe(true);
  });
 }
 for(const difficulty of Difficulty.Order) it(`sustained neglect loses on ${difficulty}`,()=>{
  const result=simulate(difficulty,false,0.1);
  expect(result.won).toBe(false);expect(result.kills).toBe(0);expect(result.elapsed<240).toBe(true);
 });
});
