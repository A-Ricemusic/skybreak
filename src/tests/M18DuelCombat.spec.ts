import { guidedDirection } from "../shared/EncounterKinematics";
import { m18RuskTuning } from "../shared/M18FinaleRules";
import { describe, expect, it } from "@rbxts/jest-globals";
import { CombatMotion as M } from "../shared/CombatMotion";
import { CombatEnvelope as E } from "../shared/CombatEnvelope";
import { CombatBalance as B } from "../shared/CombatBalance";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { FlightPrediction } from "../shared/FlightPrediction";
import { FlightMath as F } from "../shared/FlightMath";
import { AceRules as A } from "../shared/AceRules";
import { ThreatRules as T, Point } from "../shared/ThreatRules";
import { WeaponRules as W } from "../shared/WeaponRules";
import { EvadeRules as V } from "../shared/EvadeRules";
import { SortieArmament as Rack } from "../shared/SortieArmament";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { boundDuelPosition } from "../shared/FinaleDuelRules";
import { mission as bp } from "../shared/missions/m18";
interface Shot { p:Point; d:Point; age:number; hostile:boolean; last:number; guided:boolean }
function forward(s: Parameters<typeof F.ForwardOf>[0]):Point {const [x,y,z]=F.ForwardOf(s);return {x,y,z};}
/** Fixed 50 Hz, no random hit rolls. Input policy sees target pose and incoming warnings only. */
function combat(difficulty:DifficultyKind,attentive:boolean,dt=0.02) {
 const arena=bp.phases[2].batchD13!.duel!,stage=A.New(),evade=V.New();
 // Representative clear-air entry: vent exit, level cruise, Rusk approaching from ahead.
 const player=F.FromPose(0,1000,-7100,0,0,F.CruiseSpeed);
 let enemy:Point={x:600,y:1200,z:-8500},direction=M.Unit(M.Sub(player,enemy)),pass=direction;
 const max=Difficulty.Scale(difficulty,"aceHealth",bp.aceHealth!);let health=max,hull=100;
 let mode=0,modeTime=0,notch=E.aceLockBreak[2],flares=E.aceFlares[2],flareTimer=0,flareUntil=0;
 let rack=W.MaxMissiles,regen=0,cooldown=0,lock=0,fire=3,windup=0,roll=0;
 const transitions:number[]=[];
 let shots:Shot[]=[],launches=0,hits=0,decoys=0,notches=0,overshoots=0,hostileLaunches=0,evades=0,peakSpeed=0;
 const tuning=m18RuskTuning(bp.id,true,difficulty)!;
 const gate=tuning.reload;
 const damage=Difficulty.Scale(difficulty,"hostileDamage",B.hostileDamage[2])+E.aceDamageBonus;
 for(let tick=0;tick<math.ceil(300/dt);tick++) {
  const now=tick*dt;
  A.Step(stage,dt,M.Length(M.Sub(player,enemy)),0);
  V.Tick(evade,dt);roll=math.max(0,roll-dt);
  if(attentive && shots.some(s=>s.hostile && V.Decoys(M.Length(M.Sub(s.p,player)),E.missileLife[2]-s.age)) && V.Use(evade,roll>0)){roll=FlightPrediction.EvadeRollSeconds;evades++;}
  shots=shots.filter(s=>!(s.hostile && V.Open(evade) && V.Decoys(M.Length(M.Sub(s.p,player)),E.missileLife[2]-s.age)));
  const delta=M.Sub(enemy,player),horizontal=math.sqrt(delta.x*delta.x+delta.z*delta.z);
  const yaw=F.WrapAngle(math.atan2(-delta.x,-delta.z)-player.yaw),pitch=math.atan2(delta.y,horizontal)-player.pitch;
  // Proportional pursuit; throttle closes long range, slows inside the merge to avoid overshooting.
  const x=attentive?math.clamp(-yaw*3,-1,1):0,y=attentive?math.clamp(pitch*3,-1,1):0;
  const speed=horizontal>900?450:horizontal>400?320:180;
  F.Step(player,{x,y,throttle:attentive?F.ThrottleForSpeed(speed):F.CruiseThrottle},dt,bp.airspace);
  const pf=forward(player),lateral={x:-pf.z,y:0,z:pf.x},separation=M.Length(M.Sub(player,enemy));
  modeTime=math.max(0,modeTime-dt);flareTimer=math.max(0,flareTimer-dt);notch=math.max(0,notch-dt);
  if(modeTime<=0)mode=0;
  if(separation<280 && mode===0){mode=1;modeTime=2.2;pass=M.Unit(M.Add(M.Add(direction,M.Mul(lateral,0.6)),{x:0,y:0.3,z:0}));overshoots++;}
  if(notch<=0 && lock>0.6){notch=T.AceLockBreakInterval(E.aceLockBreak[2],health/max);mode=1;modeTime=1;pass=M.Unit(M.Add(lateral,M.Mul(direction,0.3)));lock*=0.4;notches++;}
  const desired=mode===1?pass:M.Pursuit(enemy,player,M.Mul(pf,player.speed),pf,lateral,player.speed,separation,now,0,true,1,direction);
  direction=M.Steer(direction,desired,2.8,dt);
  const aceSpeed=M.AceSpeed(player.speed,stage.stage*E.aceStageSpeed[2]);peakSpeed=math.max(peakSpeed,aceSpeed);
  enemy=boundDuelPosition(M.Add(enemy,M.Mul(direction,aceSpeed*dt)),arena);
  fire=math.max(0,fire-dt);
  if(windup>0){windup=math.max(0,windup-dt);if(windup===0){
   if(M.Length(M.Sub(player,enemy))<2300){
    const p=M.Add(enemy,M.Mul(direction,B.hostileLaunchOffset)),aim=M.Unit(M.Sub(player,p));
    const right=M.Unit({x:-direction.z,y:0,z:direction.x},{x:1,y:0,z:0});
    const salvo=math.max(B.aceSalvo[2],Difficulty.Behaviour(difficulty).aceSalvo);
    for(let shot=0;shot<salvo;shot++){shots.push({p,d:T.SalvoDirection(aim,right,shot,salvo),age:0,hostile:true,last:math.huge,guided:true});hostileLaunches++;}
   }
   fire=gate;
  }}else if(!A.Invulnerable(stage,now) && T.MayFire({separation,aimDot:M.Dot(direction,M.Unit(M.Sub(player,enemy))),fireTimer:fire,globalReady:true,evading:roll>0,playerStraight:T.PlayerStraight(x,y),minRange:tuning.fireMin,maxRange:E.fireRange[2][1]+200,aimThreshold:E.fireAimDot[2],straightRelax:E.straightRelax[2]}))windup=Difficulty.Scale(difficulty,"windup",E.windup[2]);
  const target=M.Sub(enemy,player),distance=M.Length(target),dot=M.Dot(pf,M.Unit(target));
  lock=A.Invulnerable(stage,now)?0:distance<=W.AirLockRange && dot>=W.LockDot?math.min(1,lock+dt/W.LockBuildSeconds):math.max(0,lock-dt*W.LockDecayPerSecond);
  [rack,regen]=Rack.RackTick(rack,regen,dt,bp.armament);cooldown=math.max(0,cooldown-dt);
  if(attentive && W.Launch({missiles:rack,missileCooldown:cooldown,hasTarget:true,lockProgress:lock,distance,dot,canDamage:A.CanHurt(stage,health,max,now)}).kind==="guided"){
   shots.push({p:M.Add(M.Add(player,M.Mul(pf,W.LaunchForward)),{x:0,y:-W.LaunchDrop,z:0}),d:pf,age:0,hostile:false,last:math.huge,guided:true});rack--;cooldown=W.MissileFireInterval;launches++;
  }
  for(let i=shots.size()-1;i>=0;i--){const s=shots[i];s.age+=dt;
   const target=s.hostile?player:enemy,velocity=s.hostile?M.Mul(pf,player.speed):M.Mul(direction,aceSpeed),dist=M.Length(M.Sub(target,s.p));
   let remove=s.age>(s.hostile?E.missileLife[2]:W.GuidedLifetime);
   if(!s.hostile){
    // Ace notches/overshoots do not set breakUntil in CombatService; therefore do not enable bandit-only seeker loss.
    if(T.LosesTrack({breaking:false,distance:dist,previousDistance:s.last,fuseRadius:W.FuseRadius}))s.guided=false;s.last=dist;
    if(!T.FlareDecoys(dist,flareUntil,now) && T.ShouldFlare(dist,flares,flareTimer)){flares--;flareTimer=6;flareUntil=now+T.FlareSeconds;}
    if(T.FlareDecoys(dist,flareUntil,now)){remove=true;decoys++;}
   }
   const missileSpeed=s.hostile?E.missileSpeed[2]:W.MissileSpeed;
   const turn=s.hostile?Difficulty.Scale(difficulty,"missileTurn",E.missileTurn[2]+E.aceMissileTurn[2]):W.MissileTurnRate(dist);
   if(s.guided)s.d=guidedDirection(s.p,s.d,target,velocity,missileSpeed,s.hostile?0.9:W.MissileLeadMax,turn,dt);
   const finish=M.Add(s.p,M.Mul(s.d,missileSpeed*dt));
   if(!remove && W.SegmentDistance(target,s.p,finish)<(s.hostile?Difficulty.Scale(difficulty,"missileTurn",E.missileFuse[2]):W.FuseRadius)){
    remove=true;
    if(s.hostile)hull-=damage;
    else if(A.CanHurt(stage,health,max,now)){const before=health;health-=A.CapHit(stage,health,max,SpecialWeapons.StandardDamage);hits++;
     if(A.Cross(stage,max,before,health,now,false)){transitions.push(now);lock=0;windup=0;mode=0;}
    }
   }
   s.p=finish;if(remove)shots.remove(i);
  }
  if(hull<=0 || health<=0)return {won:health<=0 && hull>0,time:now+dt,hull,launches,hits,decoys,notches,overshoots,hostileLaunches,evades,peakSpeed,transitions};
 }
 return {won:false,time:300,hull,launches,hits,decoys,notches,overshoots,hostileLaunches,evades,peakSpeed,transitions};
}
describe("M18 deterministic combat",()=>{
 it("keeps the aggressive profile exclusive to the M18 duel",()=>{
  for(let id=1;id<18;id++)expect(m18RuskTuning(id,true,"normal")).toBeUndefined();
  expect(m18RuskTuning(18,false,"ace")).toBeUndefined();
  expect(m18RuskTuning(18,true,"easy")).toBeDefined();
 });
 it("wins with pursuit and timed evade on every difficulty; passive flight cannot win",()=>{
  let prior=0,priorHull=math.huge;
  for(const difficulty of Difficulty.Order){const r=combat(difficulty,true);print(`M18 ${difficulty}: ${r.time}s hull=${r.hull} shots=${r.launches} hits=${r.hits} flares=${r.decoys} notches=${r.notches} overshoots=${r.overshoots} hostile=${r.hostileLaunches} evades=${r.evades} stages=${r.transitions.join(",")}`);
   expect(r.won).toBe(true);const low=difficulty==="easy"?75:difficulty==="normal"?120:180,high=difficulty==="easy"?120:difficulty==="normal"?180:260;
   expect(r.time).toBeGreaterThanOrEqual(low);expect(r.time).toBeLessThanOrEqual(high);
   expect(r.hull).toBeGreaterThanOrEqual(difficulty==="easy"?60:difficulty==="normal"?35:20);
   expect(r.hull).toBeLessThan(100);expect(r.hull).toBeLessThan(priorHull);priorHull=r.hull;
   expect(r.time).toBeGreaterThan(prior);prior=r.time;
   expect(r.transitions.size()).toBe(2);
   expect(r.transitions[0]).toBeGreaterThan(15);
   expect(r.transitions[1]-r.transitions[0]).toBeGreaterThan(15);
   expect(r.time-r.transitions[1]).toBeGreaterThan(15);
   expect(r.launches).toBeGreaterThan(W.MaxMissiles);
   expect(r.decoys).toBeGreaterThan(0);expect(r.notches).toBeGreaterThan(0);expect(r.overshoots).toBeGreaterThan(0);expect(r.hostileLaunches).toBeGreaterThan(0);
   const passive=combat(difficulty,false);
   print(`M18 passive ${difficulty}: ${passive.time}s hull=${passive.hull}`);

   expect(passive.won).toBe(false);expect(passive.hull<=0 || passive.time===300).toBe(true);
   expect(r.peakSpeed).toBeGreaterThanOrEqual(320+2*E.aceStageSpeed[2]);
  }
 });
});
