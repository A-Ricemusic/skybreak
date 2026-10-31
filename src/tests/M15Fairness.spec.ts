import { TargetPriority } from "../shared/TargetPriority";
import { guidedDirection } from "../shared/EncounterKinematics";
import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M15_GROUND, M15_WAVES } from "../shared/missions/m15";
import { buildM15ScenePlan, m15Ground } from "../shared/M15WorldPlan";
import { damageSector, groundProgressPose, newGroundProgress, SquadAttackRules as D5, squadStrikeReachable, stepGroundProgress } from "../shared/EngineBatchD5";
import { FlightMath } from "../shared/FlightMath";
import { NavigationPilot } from "../shared/NavigationPilot";
import { WeaponRules as W, Point } from "../shared/WeaponRules";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { CombatBalance as C } from "../shared/CombatBalance";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { ThreatRules as T } from "../shared/ThreatRules";
import { EvadeRules as E } from "../shared/EvadeRules";
import { AlliedRules } from "../shared/AlliedRules";
import { AirRequest, WavePlan } from "../shared/WavePlan";
import { arrivalDue } from "../shared/CampaignEncounters";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
const dt=0.1;
const limit=bp.airspace!.spawnLimit;
const parts=buildM15ScenePlan().parts.filter(p=>p.solid);
function distance(a:Point,b:Point){return math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);}
// Segment vs authored solid boxes. All M15 solids have zero yaw; excludes destroyed relay only.
let blocker="";
function blocked(a:Point,b:Point){
 for(const p of parts){
  if(p.name==="m15_command_relay")continue;
  if(math.min(a.y,b.y)>p.y+p.sy/2||math.max(a.y,b.y)<p.y-p.sy/2||math.min(a.x,b.x)>p.x+p.sx/2||math.max(a.x,b.x)<p.x-p.sx/2||math.min(a.z,b.z)>p.z+p.sz/2||math.max(a.z,b.z)<p.z-p.sz/2)continue;
  let lo=0,hi=1;
  for(const [v,d,c,h] of [[a.x,b.x-a.x,p.x,p.sx/2],[a.y,b.y-a.y,p.y,p.sy/2],[a.z,b.z-a.z,p.z,p.sz/2]]){
   if(math.abs(d)<0.00001){if(v<c-h||v>c+h){lo=2;break;}}
   else {const x=(c-h-v)/d,y=(c+h-v)/d;lo=math.max(lo,math.min(x,y));hi=math.min(hi,math.max(x,y));}
  }
  if(lo<=hi){blocker=p.name;return true;}
 }
 return false;
}
/** Scripted pilot uses ordinary FlightMath rate controls, no pose teleport or instant turns. */
function fly(s:ReturnType<typeof FlightMath.FromPose>,p:Point){
 const input=NavigationPilot.Controls(s,p,0,false); input.throttle=FlightMath.CruiseThrottle;
 FlightMath.Step(s,input,dt,bp.airspace);
}
type Fault="none"|"acquisition"|"homing";
interface Contact {id:number;p:Point;previous:Point;health:number;required:boolean;flares:number;flareUntil:number;breakUntil:number}
interface Missile {p:Point;direction:Point;target:Contact;age:number;last?:number;lost:boolean}
function weapon(){return {lock:0,selected:-1,cooldown:0,stock:bp.armament!.stock!.missiles!,hits:[] as Missile[]};}
function shoot(s:ReturnType<typeof FlightMath.FromPose>,contacts:Contact[],w:ReturnType<typeof weapon>,time:number,kind:DifficultyKind,fault:Fault){
 const [x,y,z]=FlightMath.ForwardOf(s),live=contacts.filter(a=>a.health>0);
 const candidates=live.map(a=>{const r=distance(s,a.p);return {id:a.id,distance:r,dot:((a.p.x-s.x)*x+(a.p.y-s.y)*y+(a.p.z-s.z)*z)/math.max(1,r),inRange:r<=W.AirLockRange,blocked:blocked(s,a.p),required:a.required};});
 const selected=live.some(a=>a.id===w.selected)?w.selected:TargetPriority.Best(candidates),c=candidates.find(c=>c.id===selected),target=live.find(a=>a.id===selected);
 if(w.selected!==selected){w.lock=0;w.selected=selected??-1;}
 const inCone=c!==undefined&&c.inRange&&c.dot>=W.LockDot&&!c.blocked;
 w.lock=fault==="acquisition"?0:inCone?math.min(1,w.lock+dt/W.LockBuildSeconds):math.max(0,w.lock-dt*W.LockDecayPerSecond);
 w.cooldown=math.max(0,w.cooldown-dt);
 // Attentive fire discipline: wait out visible flares and do not overkill with queued missiles.
 if(W.Launch({missiles:w.stock,missileCooldown:w.cooldown,hasTarget:target!==undefined,lockProgress:w.lock,distance:c?.distance??math.huge,dot:c?.dot??-1,canDamage:c!==undefined&&!c.blocked}).kind==="guided"&&target&&w.hits.filter(m=>m.target===target).size()*SpecialWeapons.StandardDamage<target.health&&time>=target.flareUntil){
  w.stock--;w.cooldown=C.playerMissileCooldown;
  w.hits.push({p:{x:s.x,y:s.y,z:s.z},direction:{x,y,z},target,age:0,lost:false});
 }
 for(let i=w.hits.size()-1;i>=0;i--){
  const m=w.hits[i],a=m.target,r=distance(m.p,a.p);m.age+=dt;
  if(m.age>W.GuidedLifetime||a.health<=0){w.hits.remove(i);continue;}
  if(!m.lost){
   if(time>=a.breakUntil&&AlliedRules.ForcePressureBreak(bp.pressure,kind,false,true)&&!a.required&&r<T.InboundRange)a.breakUntil=time+T.BreakCooldown;
   m.lost=T.LosesTrack({breaking:time<a.breakUntil,previousDistance:m.last??r,distance:r,fuseRadius:W.FuseRadius});m.last=r;
   if(r<=T.FlareRadius&&a.flares>0){a.flares--;a.flareUntil=time+T.FlareSeconds;}
   if(time<a.flareUntil&&r<=T.FlareRadius){w.hits.remove(i);continue;}
   const velocity={x:(a.p.x-a.previous.x)/dt,y:(a.p.y-a.previous.y)/dt,z:(a.p.z-a.previous.z)/dt};
   if(!m.lost&&fault!=="homing")m.direction=guidedDirection(m.p,m.direction,a.p,velocity,W.MissileSpeed,W.MissileLeadMax,W.MissileTurnRate(r),dt);
  }
  const nextPosition={x:m.p.x+m.direction.x*W.MissileSpeed*dt,y:m.p.y+m.direction.y*W.MissileSpeed*dt,z:m.p.z+m.direction.z*W.MissileSpeed*dt};
  const hit=m.lost?W.Fuse(m.p,nextPosition,live,a=>a.p,()=>true):W.SegmentDistance(a.p,m.p,nextPosition)<W.FuseRadius?live.indexOf(a):undefined;
  if(blocked(m.p,nextPosition)){w.hits.remove(i);continue;}
  if(hit!==undefined){live[hit].health-=SpecialWeapons.StandardDamage;w.hits.remove(i);}else m.p=nextPosition;
 }
}
function contact(id:number,p:Point,health:number,required:boolean,kind:DifficultyKind):Contact{return {id,p,previous:p,health,required,flares:!required&&AlliedRules.PressureFlare(bp.pressure,false,"raider",kind)?1:0,flareUntil:0,breakUntil:0};}
/** Incoming cover exposure envelope: gates/aim/reload/windup and finite evade charges.
 * Every admitted shot hits unless a correctly timed evade decoys it. Geometry is worst-case
 * while the player is in a firing envelope; transit outside combat is assumed off-axis. */
function defence(kind:DifficultyKind){
 const evade=E.New();let health=100,last=-100,reload=0,windup=0,shots=0;
 const live=bp.phases[1].fighterWaves![0].count;
 const gate=T.FlightGate(Difficulty.Scale(kind,"hostileGate",C.flightGate[2]),live,Difficulty.Scale(kind,"flightDivisor",C.flightDivisor[2]));
 return {step(time:number,exposed:boolean,attentive:boolean){
  E.Tick(evade,dt);reload=math.max(0,reload-dt);
  if(windup>0){windup-=dt;if(windup<=0){shots++;reload=Difficulty.Scale(kind,"hostileGate",C.banditReload[2]);
   const decoy=attentive&&E.Use(evade,false)&&E.Open(evade)&&E.Decoys(E.DecoyRadius,0);
   if(!decoy)health-=Difficulty.Scale(kind,"hostileDamage",C.hostileDamage[2]);
  }}else if(exposed&&T.FlightReady({sinceLastWindup:time-last,gate,threats:0,cap:T.ThreatCap(live,Difficulty.Scale(kind,"threatCap",C.threatCap[2]))})&&T.MayFire({separation:1000,aimDot:1,fireTimer:reload,globalReady:true,evading:E.Open(evade),playerStraight:true,minRange:C.fireRange[2][0],maxRange:C.fireRange[2][1],aimThreshold:C.fireAimDot[2],straightRelax:C.straightRelax[2]})){
   windup=Difficulty.Scale(kind,"windup",C.windup[2]);last=time;
  }
  return health;
 },shots:()=>shots,health:()=>health,gate};
}
function bombers(kind:DifficultyKind,corner:Point,attentive:boolean,fault:Fault="none"){
 const route=compileBomberEncounter(bp.phases[1].bombers!),s=FlightMath.FromPose(corner.x,corner.y,corner.z,math.pi,0,0);s.speed=FlightMath.CruiseSpeed;
 const actors=BomberRules.Sample(route,0).slots.map((a,i)=>contact(i,a.position,math.floor(Difficulty.SupportHealth(kind,C.bomberHealth)),true,kind)),w=weapon(),d=defence(kind);
 let time=0;
 for(;time<route.duration&&actors.some(a=>a.health>0);time+=dt){
  const poses=BomberRules.Sample(route,time).slots;
  for(let i=0;i<actors.size();i++){actors[i].previous=actors[i].p;actors[i].p=poses[i].position;}
  const target=(actors.find(a=>a.health>0&&a.id===w.selected)??actors.find(a=>a.health>0))!;
  if(attentive){fly(s,target.p);shoot(s,actors,w,time,kind,fault);}
  d.step(time,attentive?distance(s,target.p)<=W.AirLockRange:true,attentive);
  if(d.health()<=0)break;
 }
 return {killed:actors.filter(a=>a.health<=0).size(),time,health:d.health(),shots:d.shots(),stock:w.stock,escaped:time>=route.duration};
}
function squads(kind:DifficultyKind,attentive:boolean,fault:Fault="none"){
 const states=newGroundProgress(M15_GROUND),destroyed=new Set<string>();
 const queue:AirRequest[]=[],fired=new Set<string>(),s=FlightMath.FromPose(bp.start!.x,bp.start!.y,bp.start!.z,0,0,0);s.speed=FlightMath.CruiseSpeed;
 const actors:(Contact&{sector:number;next:number;route?:Point[];speed:number;waypoint:number})[]=[],w=weapon();let kills=0,maxLive=0,serial=0,optionalKills=0;
 const waves=[...M15_WAVES,bp.phases[0].standaloneAce!];
 for(let time=0;time<600;time+=dt){
  // Explicit ground attack schedule, not a pre-cleared fixture: sectors start on their real routes.
  for(let i=0;i<M15_GROUND.sectors.size();i++)if(time>=60+i*25)for(const id of M15_GROUND.sectors[i].clearTargetIds)destroyed.add(id);
  stepGroundProgress(M15_GROUND,states,destroyed,dt);
  for(const wave of waves)if(!fired.has(wave.id)&&arrivalDue(wave.trigger,{elapsed:time,phase:0,requiredKills:0,destroyed,targets:[]})){
   fired.add(wave.id);queue.push({role:"role" in wave?wave.role:"ace",count:"count" in wave?wave.count:1,behind:false,arrival:wave});
  }
  const live=actors.filter(a=>a.health>0);
  for(const batch of WavePlan.Admit(queue,bp.phases[0].concurrentFighters!-live.size(),bp.phases[0].concurrentRoutes!-live.filter(a=>a.route!==undefined).size()))for(let i=0;i<batch.count;i++){
   const a=batch.arrival!,sector="attackSector" in a?M15_GROUND.sectors.findIndex(sec=>sec.id===a.attackSector):-1;
   const route="route" in a?a.route:undefined,p="spawn" in a&&a.spawn?a.spawn:route?.waypoints[0]??{x:s.x+800,y:s.y,z:s.z-1200};
   actors.push({...contact(serial++,{...p},math.floor(Difficulty.SupportHealth(kind,"health" in a?a.health:C.raiderHealth)),false,kind),sector,next:time+D5.warning,route:route?.waypoints,speed:route?.speed??D5.speed,waypoint:1});
  }
  maxLive=math.max(maxLive,actors.filter(a=>a.health>0).size());
  for(const a of actors.filter(a=>a.health>0)){
   a.previous=a.p;
   const ground=a.sector>=0?groundProgressPose(M15_GROUND.sectors[a.sector],states[a.sector]):undefined;
   const station=ground?{...ground,y:ground.y+240}:a.route?a.route[a.waypoint%a.route.size()]:{x:s.x+500,y:s.y+100,z:s.z-500};
   const r=distance(a.p,station),f=math.min(1,a.speed*dt/math.max(1,r));a.p={x:a.p.x+(station.x-a.p.x)*f,y:a.p.y+(station.y-a.p.y)*f,z:a.p.z+(station.z-a.p.z)*f};
   if(r<20&&a.route)a.waypoint++;
   if(ground&&time>=a.next){if(squadStrikeReachable(distance(a.p,ground),blocked(a.p,ground)))damageSector(states[a.sector],D5.damage);a.next=time+D5.warning+D5.reload;}
  }
  if(attentive){const target=actors.find(a=>a.health>0&&a.id===w.selected)??actors.find(a=>a.health>0&&a.sector>=0)??actors.find(a=>a.health>0);if(target){fly(s,target.p);shoot(s,actors,w,time,kind,fault);}}
  kills=actors.filter(a=>a.health<=0&&a.sector>=0).size();optionalKills=actors.filter(a=>a.health<=0&&a.sector<0).size();
  if(states.some(s=>s.health<=0))break;
 }
 return {states,kills,maxLive,queue:queue.size(),optionalKills,stock:w.stock};
}
describe("M15 rule-derived fairness envelope",()=>{
 it("fails attentive squad protection when acquisition or homing is broken",()=>{
  for(const fault of ["acquisition","homing"] as Fault[]){
   const r=squads("normal",true,fault);
   expect(r.kills===12&&r.states.every(s=>s.health>0)).toBe(false);
  }
 });
 it("keeps every route above terrain/solids and exposes secured squads after relay destruction",()=>{
  const states=newGroundProgress(M15_GROUND),cleared=new Set<string>();for(const s of M15_GROUND.sectors)for(const id of s.clearTargetIds)cleared.add(id);
  stepGroundProgress(M15_GROUND,states,cleared,60);
  for(let i=0;i<states.size();i++){
   const sec=M15_GROUND.sectors[i];
   for(let t=0;t<=sec.seconds;t++){
    const p=groundProgressPose(sec,{...states[i],elapsed:t});expect(p.y-2.5-m15Ground(p.x,p.z)).toBeGreaterThanOrEqual(3);
    for(const x of [-5,0,5])for(const z of [-6,0,6])assert(!blocked({x:p.x+x,y:p.y-5.5,z:p.z+z},{x:p.x+x,y:p.y+2.5,z:p.z+z}),sec.id+" at "+t+" blocked by "+blocker);
   }
   const p=groundProgressPose(sec,states[i]),a={...p,y:p.y+240};expect(states[i].secured).toBe(true);
   assert(squadStrikeReachable(distance(a,p),blocked(a,p)),sec.id+" secured LOS blocked");damageSector(states[i],D5.damage);expect(states[i].health).toBe(sec.health-D5.damage);
   expect(squadStrikeReachable(D5.range+1,false)).toBe(false);expect(squadStrikeReachable(240,true)).toBe(false);
  }
 });
 it("queues pressure behind saturated optional aircraft and admits it when slots open",()=>{
  const q:AirRequest[]=M15_WAVES.map(a=>({arrival:a,role:a.role,count:a.count,behind:false}));
  const first=WavePlan.Admit(q,bp.phases[0].concurrentFighters!,bp.phases[0].concurrentRoutes!);
  expect(first.reduce((n,b)=>n+b.count,0)).toBe(bp.phases[0].concurrentFighters!);expect(q.size()).toBeGreaterThan(0);
  expect(WavePlan.Admit(q,0).size()).toBe(0);
  let n=first.reduce((n,b)=>n+b.count,0);while(q.size()>0)n+=WavePlan.Admit(q,bp.phases[0].concurrentFighters!,bp.phases[0].concurrentRoutes!).reduce((n,b)=>n+b.count,0);
  expect(n).toBe(M15_WAVES.reduce((n,w)=>n+w.count,0));
 });
 it("loses neglected squads and clears all twelve admitted attackers through locks/hull/cooldowns",()=>{
  const health:number[]=[];
  for(const kind of Difficulty.Order){const ignored=squads(kind,false),active=squads(kind,true);
   health.push(active.states.reduce((n,s)=>n+s.health,0));expect(active.stock).toBeGreaterThanOrEqual(0);
   expect(ignored.states.some(s=>s.health<=0)).toBe(true);expect(active.kills).toBe(12);expect(active.optionalKills).toBeGreaterThan(0);expect(active.states.every(s=>s.health>0)).toBe(true);print("M15_SQUADS",kind,"remaining health",active.states.map(s=>tostring(s.health)).join(","));expect(active.maxLive).toBeLessThanOrEqual(bp.phases[0].concurrentFighters!);
  }
  expect(health[0]).toBeGreaterThan(health[1]);expect(health[1]).toBeGreaterThanOrEqual(health[2]);
 });
 it("intercepts all six moving hulls from every airspace corner on Easy/Normal/Hard; neglect loses",()=>{
  const results:number[]=[],gates:number[]=[],neglected:number[]=[];
  for(const kind of Difficulty.Order){
   let worst=0;for(const x of [-limit,limit])for(const z of [-limit,limit]){
    const r=bombers(kind,{x,y:850,z},true);expect(r.killed).toBe(6);expect(r.health).toBeGreaterThan(0);expect(r.stock).toBeGreaterThanOrEqual(0);worst=math.max(worst,r.time);
   }
   print("M15_INTERCEPT",kind,"worst seconds",worst,"gate",defence(kind).gate);results.push(worst);gates.push(defence(kind).gate);
   const ignored=bombers(kind,{x:limit,y:850,z:limit},false);expect(ignored.killed).toBe(0);expect(ignored.health<=0||ignored.escaped).toBe(true);neglected.push(ignored.time);
  }
  expect(results[0]).toBeLessThan(results[1]);expect(results[1]).toBeLessThanOrEqual(results[2]);
  expect(neglected[0]).toBeGreaterThan(neglected[1]);expect(neglected[1]).toBeGreaterThan(neglected[2]);
  expect(gates[0]).toBeGreaterThan(gates[1]);expect(gates[1]).toBeGreaterThan(gates[2]);
  const start=bp.phases[1].bombers!.waypoints[0];expect(distance({x:limit,y:850,z:limit},start)/FlightMath.CruiseSpeed).toBeGreaterThan(226);
 });
});
