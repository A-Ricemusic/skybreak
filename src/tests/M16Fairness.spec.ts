import { TargetPriority } from "../shared/TargetPriority";
import { guidedDirection } from "../shared/EncounterKinematics";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { BomberRules } from "../shared/BomberRules";
import { describe, expect, it } from "@rbxts/jest-globals";
import { mission, M16_COLUMN, M16_WAVES } from "../shared/missions/m16";
import { SquadAttackRules as A, newGroundProgress, damageSector, stepGroundProgress, groundProgressPose } from "../shared/EngineBatchD5";
import { authoredAirPose, takeArrival } from "../shared/CampaignEncounters";
import { WeaponRules as W, Point } from "../shared/WeaponRules";
import { FlightMath as F } from "../shared/FlightMath";
import { ThreatRules as T } from "../shared/ThreatRules";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { CombatBalance } from "../shared/CombatBalance";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { AlliedRules } from "../shared/AlliedRules";
import { m16Height } from "../shared/M16WorldPlan";
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n,z:a.z*n});
const sub=(a:Point,b:Point)=>add(a,mul(b,-1));
const len=(a:Point)=>math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const unit=(a:Point)=>mul(a,1/math.max(1e-9,len(a)));
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y+a.z*b.z;
const steer=(a:Point,b:Point,n:number)=>unit(add(mul(a,1-n),mul(b,n)));
// Terrain LOS only. Authored props/actors are an explicit remaining Player acceptance gap.
function los(a:Point,b:Point):boolean {
 for(let i=0;i<=20;i++) {const p=add(a,mul(sub(b,a),i/20));if(p.y<=m16Height(p.x,p.z)) return false;}return true;
}
interface Attacker {p:Point;d:Point;v:Point;hp:number;sector:number;fire:number;wind:number;flares:number;flareUntil:number;admittedAt:number;breakUntil:number;}
interface Shot {p:Point;d:Point;target:Attacker;age:number;last?:number;lost:boolean;}
function fly(kind:DifficultyKind,attentive:boolean,moving=false,fault="none") {
 const dt=0.05,states=newGroundProgress(M16_COLUMN),fired=new Set<string>();
 const queue:AirRequest[]=[],cover:{until:number;routed:boolean;contact:Attacker;route?:ReturnType<typeof BomberRules.Create>;born:number}[]=[];
 const enemies:Attacker[]=[],shots:Shot[]=[];let lastPress=-math.huge;let target:Attacker|undefined,lock=0,cool=0,spent=0,kills=0,decoys=0,maxKillDelay=0;
 const start=mission.start!;const player=F.FromPose(start.x,start.y,start.z,-math.rad(start.headingDegrees),0,0);player.speed=start.speed!;
 for(let tick=0;tick<24000;tick++) {
  const now=tick*dt;
  if(moving) {
   const cleared=new Set<string>();for(let i=0;i<3;i++) if(now>=[60,300,650][i]) for(const id of M16_COLUMN.sectors[i].clearTargetIds) cleared.add(id);
   stepGroundProgress(M16_COLUMN,states,cleared,dt);
  }
  for(let i=cover.size()-1;i>=0;i--)if(cover[i].until<=now)cover.remove(i);
  for(const w of M16_WAVES) if(takeArrival(w.id,w.trigger,{elapsed:now,phase:0,requiredKills:0,destroyed:new Set<string>(),targets:[]},fired))queue.push({arrival:w,role:w.role,count:w.count,behind:false});
  for(const batch of WavePlan.Admit(queue,mission.phases[0].concurrentFighters!-cover.size()-enemies.filter(e=>e.hp>0).size(),mission.phases[0].concurrentRoutes!-cover.filter(e=>e.routed).size())) {
   const w=batch.arrival!;
   if(!("attackSector" in w)||!w.attackSector){
    const route="route" in w?w.route:undefined;
    for(let i=0;i<batch.count;i++) {
     const path=route?BomberRules.Create(route.waypoints,route.speed,[{x:i*60,y:0,z:0}]):undefined;
     const heading=w.headingDegrees??0;
     const pose=authoredAirPose(w.spawn??{x:player.x-math.sin(math.rad(heading))*2800,y:math.max(240,player.y),z:player.z+math.cos(math.rad(heading))*2800},heading,i,false,0);
     const contact:Attacker={p:path?BomberRules.Sample(path,0).slots[0].position:pose.position,d:pose.facing,v:mul(pose.facing,A.speed),hp:Difficulty.SupportHealth(kind,100),sector:-1,fire:0,wind:0,flares:0,flareUntil:0,admittedAt:now,breakUntil:0};
     cover.push({until:path?now+path.duration:math.huge,routed:path!==undefined,contact,route:path,born:now});
    }
    continue;
   }
   for(let i=0;i<batch.count;i++) {const pose=authoredAirPose(w.spawn!,w.headingDegrees!,i,false,0);
    enemies.push({p:pose.position,d:pose.facing,v:mul(pose.facing,A.speed),hp:Difficulty.SupportHealth(kind,100),sector:M16_COLUMN.sectors.findIndex(s=>s.id===w.attackSector),fire:4+i*1.5,wind:0,flares:AlliedRules.PressureFlare(mission.pressure,false,w.role,kind)?1:0,flareUntil:0,admittedAt:now,breakUntil:0});
   }
  }
  for(const e of enemies) if(e.hp>0) {
   const p=groundProgressPose(M16_COLUMN.sectors[e.sector],states[e.sector]),distance=len(sub(p,e.p));
   let desired=unit(sub(add(p,{x:0,y:240,z:0}),e.p));if(distance<400) desired=unit(add(e.d,{x:0,y:0.3,z:0}));
   e.d=steer(e.d,desired,dt*1.5);e.v=mul(e.d,A.speed);e.p=add(e.p,mul(e.v,dt));e.p.y=math.clamp(e.p.y,170,2000);
   e.fire=math.max(0,e.fire-dt);
   if(e.wind>0) {e.wind=math.max(0,e.wind-dt);if(e.wind===0) {e.fire=A.reload;if(distance<=A.range && los(e.p,p)) damageSector(states[e.sector],A.damage);}}
   else if(e.fire<=0 && distance<=A.range) e.wind=A.warning;
  }
  // Cover remains live and selectable; routed contacts follow their authored paths.
  // Pursuing cover is an envelope approximation, not a Player survivability test.
  for(const c of cover) {
   if(c.route)c.contact.p=BomberRules.Sample(c.route,now-c.born).slots[0].position;
   else {const e=c.contact;e.d=steer(e.d,unit(sub(player,e.p)),dt*1.5);e.v=mul(e.d,A.speed);e.p=add(e.p,mul(e.v,dt));}
  }
  if(states.some(s=>s.health<=0)) return {states,spent,kills,decoys,maxKillDelay,failedAt:now};
  if(!attentive) continue;
  const contacts=[...enemies,...cover.map(c=>c.contact)];
  const [nx,ny,nz]=F.ForwardOf(player),[rx,ry,rz]=F.RightOf(player),[ux,uy,uz]=F.UpOf(player);
  const view=TargetPriority.Frustum(player,{x:nx,y:ny,z:nz},{x:rx,y:ry,z:rz},{x:ux,y:uy,z:uz},75,16/9)!;
  const candidates=contacts.map((e,id)=>{const delta=sub(e.p,player),distance=len(delta);return {id,distance,dot:dot({x:nx,y:ny,z:nz},unit(delta)),inRange:distance<=W.AirLockRange,blocked:!los(player,e.p),onScreen:TargetPriority.InView(view,e.p)};}).filter(c=>contacts[c.id].hp>0);
  // Recognise column attack warnings, steer toward that bearing, and tap TGT through
  // distracting cover. No attacker handle can become the weapon target directly.
  const cue=enemies.find(e=>e.hp>0);
  const previous=target;
  const current=target?contacts.indexOf(target):undefined;
  let selected=current;
  if(!target || target.hp<=0)selected=TargetPriority.Best(candidates);
  if((!target || target.hp<=0 || target.sector<0) && now-lastPress>=0.15) {
   selected=TargetPriority.Press(candidates,selected,now-lastPress<=TargetPriority.CycleChainSeconds);lastPress=now;
  }
  target=fault==="acquisition"?undefined:selected===undefined?undefined:contacts[selected];
  if(target!==previous)lock=0;
  const steering=target && target.sector>=0?target:cue;
  if(!target && steering) {
   const desired=unit(sub(steering.p,player));
   F.Step(player,{x:math.clamp(-F.WrapAngle(math.atan2(-desired.x,-desired.z)-player.yaw)*4,-1,1),y:math.clamp((math.asin(desired.y)-player.pitch)*4,-1,1),throttle:0.9},dt,mission.airspace);
  }
  if(target) {
   const delta=sub(target.p,player),distance=len(delta),desired=unit(sub((steering??target).p,player));
   const yaw=math.atan2(-desired.x,-desired.z),pitch=math.asin(desired.y);
   F.Step(player,{x:math.clamp(-F.WrapAngle(yaw-player.yaw)*4,-1,1),y:math.clamp((pitch-player.pitch)*4,-1,1),throttle:distance>1200?0.9:0.65},dt,mission.airspace);
   const [x,y,z]=F.ForwardOf(player),nose={x,y,z};
   const visible=los(player,target.p),aim=dot(nose,desired);
   lock=distance<=W.AirLockRange && aim>=W.LockDot && visible?math.min(1,lock+dt/W.LockBuildSeconds):math.max(0,lock-dt*W.LockDecayPerSecond);
   cool=math.max(0,cool-dt);
   // Wait for each result and for the flare cloud to burn out; no volley lost to one flare.
   if(target.sector>=0 && shots.size()===0 && now>=target.flareUntil && W.Launch({missiles:mission.armament!.stock!.missiles-spent,missileCooldown:cool,hasTarget:visible,lockProgress:lock,distance,dot:aim}).kind==="guided") {
    shots.push({p:{x:player.x,y:player.y,z:player.z},d:nose,target,age:0,lost:false});spent++;cool=CombatBalance.playerMissileCooldown;
   }
  }
  for(let i=shots.size()-1;i>=0;i--) {
   const s=shots[i],e=s.target,distance=len(sub(e.p,s.p));s.age+=dt;
   if(T.ShouldFlare(distance,e.flares,0)) {e.flares--;e.flareUntil=now+T.FlareSeconds;}
   if(T.FlareDecoys(distance,e.flareUntil,now)) {decoys++;shots.remove(i);continue;}
   if(now>=e.breakUntil&&AlliedRules.ForcePressureBreak(mission.pressure,kind,false,true)&&distance<T.InboundRange)e.breakUntil=now+T.BreakCooldown;
   s.lost=s.lost||T.LosesTrack({breaking:now<e.breakUntil,previousDistance:s.last??distance,distance,fuseRadius:W.FuseRadius});s.last=distance;
   if(!s.lost&&fault!=="homing")s.d=guidedDirection(s.p,s.d,e.p,e.v,W.MissileSpeed,W.MissileLeadMax,W.MissileTurnRate(distance),dt);
   const nextPosition=add(s.p,mul(s.d,W.MissileSpeed*dt));
   const hit=s.lost?W.Fuse(s.p,nextPosition,[e],a=>a.p,()=>true)!==undefined:W.SegmentDistance(e.p,s.p,nextPosition)<W.FuseRadius;
   if(hit) {e.hp-=SpecialWeapons.StandardDamage;if(e.hp<=0) {kills++;maxKillDelay=math.max(maxKillDelay,now-e.admittedAt);}shots.remove(i);}
   else if(s.age>W.GuidedLifetime || !los(s.p,nextPosition)) shots.remove(i);else s.p=nextPosition;
  }
 }
 return {states,spent,kills,decoys,maxKillDelay,failedAt:1200};
}
describe("M16 rule-derived response envelope",()=>{
 it("fails attentive protection when acquisition or guidance is broken",()=>{
  for(const fault of ["acquisition","homing"]) {
   const r=fly("normal",true,false,fault);
   expect(r.kills===21&&r.states.every(s=>s.health>0)).toBe(false);
   if(fault==="acquisition") {expect(r.kills).toBe(0);expect(r.spent).toBe(0);expect(r.failedAt).toBeLessThan(180);}
  }
 });
 it("neglect loses, sequential acquisition/interception survives on Easy, Normal and Hard (Ace)",()=>{
  const results=Difficulty.Order.map(kind=>{
   const ignored=fly(kind,false);expect(ignored.failedAt).toBeLessThan(180);
   const response=fly(kind,true);
   print(kind,"stationary",response.kills,response.spent,response.states[0].health,response.states[1].health,response.states[2].health);
   expect(response.maxKillDelay).toBeLessThan(159);expect(response.kills).toBe(21);expect(response.states.every(s=>s.health>0)).toBe(true);expect(response.spent).toBeLessThanOrEqual(80);
   return response;
  });
  expect(results[0].spent).toBeLessThan(results[1].spent);
  expect(results[1].spent).toBeLessThanOrEqual(results[2].spent);
  // D5 bypasses ordinary hostile fire gates: column pressure is identical Normal/Hard.
  // Persistent cover's REAL flight gate still orders overall threat strictly.
  const gates=Difficulty.Order.map(d=>T.FlightGate(Difficulty.Scale(d,"hostileGate",CombatBalance.flightGate[2]),6,Difficulty.Scale(d,"flightDivisor",CombatBalance.flightDivisor[2])));
  expect(gates[0]).toBeGreaterThan(gates[1]);expect(gates[1]).toBeGreaterThan(gates[2]);
 });
 it("also defends a clearance-gated moving column with the same flight strategy",()=>{
  for(const kind of Difficulty.Order) {
   const response=fly(kind,true,true);
   print(kind,"moving",response.kills,response.spent,response.states[0].health,response.states[1].health,response.states[2].health);
   expect(response.maxKillDelay).toBeLessThan(159);expect(response.kills).toBe(21);expect(response.states.every(s=>s.health>0 && s.secured)).toBe(true);expect(response.spent).toBeLessThanOrEqual(80);
  }
 });
 it("terrain LOS blocks low shots rather than awarding damage through terrain",()=>{
  expect(los({x:0,y:70,z:9600},{x:0,y:104,z:9600})).toBe(false);
  expect(los({x:0,y:650,z:9600},{x:0,y:104,z:9600})).toBe(true);
 });
});
