import { dampedSteer, pursuitDestination, guidedDirection } from "../shared/EncounterKinematics";
import { describe, expect, it } from "@rbxts/jest-globals";
import { M11_AIRCRAFT, M11_WAVES, M11_SAFE_SECONDS, M11_HEALTH } from "../shared/missions/m11";
import { protectedHealth, protectedPose } from "../shared/EngineBatchD7";
import { authoredAirPose } from "../shared/CampaignEncounters";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { CombatBalance as B } from "../shared/CombatBalance";
import { ThreatRules as T, Point } from "../shared/ThreatRules";
import { WeaponRules } from "../shared/WeaponRules";
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n,z:a.z*n});
const sub=(a:Point,b:Point)=>add(a,mul(b,-1));
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=(a:Point)=>math.sqrt(dot(a,a));
const unit=(a:Point)=>mul(a,1/math.max(0.000001,length(a)));
const steer=(a:Point,b:Point,rate:number,dt:number)=>dampedSteer(a,unit(b),rate,dt);
interface Attacker { p:Point; d:Point; pass:Point; band:number; index:number; side:number; spawn:number; admitted:boolean; kill:number; reload:number; windup:number; extend:number }
interface Missile { p:Point; d:Point; band:number; age:number }
/** Faithful fixed-step CombatService model: authoredAirPose, 285-stud pursuit at player
 * speed 160, lead/bracket/weave, 3s overshoot extension, damped turn, range/aim gate,
 * reload, shared windup gate/cap, 2300 launch cutoff, homing lead and swept fuse.
 * No terrain rays (open-sky encounter); no player lock-break randomness; defence
 * is an explicit scheduled removal budget, not a claim of measured pilot skill.
 */
function encounter(d:DifficultyKind, neglected=-1, lapse=-1, dt=0.05, homing=true) {
 const health=M11_AIRCRAFT.map(a=>protectedHealth(a,d)), hits=[0,0], first=[-1,-1],lostAt=[-1,-1];
 const enemies:Attacker[]=[], missiles:Missile[]=[];
 let cleared=0,lastBand=1,serial=0;
 for(const w of M11_WAVES) {
  assert(w.trigger.kind==="time"); const at=w.trigger.seconds,band=M11_AIRCRAFT.findIndex(a=>a.id===w.attackProtected);
  const count=w.count; // Authored arrivals bypass generic extra-raider waves.
  const start=math.max(at,cleared+(lastBand===band?0:25))+(lapse===band?30:0);
  // Only the first wave in the selected band incurs the lapse.
  if(lapse===band) lapse=-1;
  cleared=start+count*10;lastBand=band;
  for(let i=0;i<count;i++) {
   const pose=authoredAirPose(w.spawn!,w.headingDegrees!,i,false,0);
   enemies.push({p:pose.position,d:pose.facing,pass:pose.facing,band,index:serial,side:serial++%2===0?1:-1,spawn:at,admitted:false,
    kill:band===neglected?math.huge:start+(i+1)*10,reload:4+i*1.5,windup:0,extend:0});
  }
 }
 // Spend the allied group's one kill on the first neglected attacker, before it fires.
 if(neglected>=0) enemies.find(e=>e.band===neglected)!.kill=0;
 const scale=(knob:Parameters<typeof Difficulty.Scale>[1],v:number)=>Difficulty.Scale(d,knob,v);
 let last=-100;
 for(let now=0;now<M11_SAFE_SECONDS;now+=dt) {
  const poses=M11_AIRCRAFT.map(a=>protectedPose(a,now));
  let room=6-enemies.filter(e=>e.admitted && now<e.kill).size();
  for(const e of enemies) if(!e.admitted && now>=e.spawn && now<e.kill && room>0) {e.admitted=true;room--;}
  const live=enemies.filter(e=>e.admitted && now<e.kill);
  let threats=missiles.size()+live.filter(e=>e.windup>0).size();
  let ready=T.FlightReady({sinceLastWindup:now-last,gate:T.FlightGate(scale("hostileGate",B.flightGate[1]),live.size(),scale("flightDivisor",B.flightDivisor[1])),threats,cap:T.ThreatCap(live.size(),scale("threatCap",B.threatCap[1]))});
  for(const e of live) {
   const target=poses[e.band].position,velocity=mul(poses[e.band].facing,M11_AIRCRAFT[e.band].route.speed),delta=sub(target,e.p),range=length(delta);
   // Player heading south gives lateral +X; bracket sides and weave vary per serial.
   e.extend=math.max(0,e.extend-dt);
   if(range<280 && e.extend===0) {e.extend=3;e.pass=unit(add(e.d,{x:e.side*0.6,y:0.3,z:0}));}
   const destination=pursuitDestination(target,velocity,{x:1,y:0,z:0},range,160,now,e.index,e.side,false);
   e.d=steer(e.d,e.extend>0?e.pass:sub(destination,e.p),2.1,dt);
   e.p=add(e.p,mul(e.d,(e.extend>0?180:285)*dt));e.p.y=math.clamp(e.p.y,170,2800);
   e.reload=math.max(0,e.reload-dt);
   if(e.windup>0) {
    e.windup=math.max(0,e.windup-dt);
    if(e.windup===0) {if(length(sub(target,e.p))<2300) missiles.push({p:e.p,d:unit(sub(target,e.p)),band:e.band,age:0});e.reload=B.banditReload[1];}
   } else if(e.extend===0 && ready && T.MayFire({separation:range,aimDot:dot(e.d,unit(sub(target,e.p))),fireTimer:e.reload,globalReady:true,evading:true,playerStraight:false,minRange:B.fireRange[1][0],maxRange:B.fireRange[1][1],aimThreshold:0.55,straightRelax:0.25},true)) {
    e.windup=scale("windup",B.windup[1]);last=now;ready=false;threats++;
    if(first[e.band]<0) first[e.band]=now;
   }
  }
  for(let i=missiles.size()-1;i>=0;i--) {
   const m=missiles[i];m.age+=dt;
   if(m.age>B.missileLife[1]) {missiles.remove(i);continue;}
   const target=poses[m.band].position,velocity=mul(poses[m.band].facing,M11_AIRCRAFT[m.band].route.speed);
   if(homing) m.d=guidedDirection(m.p,m.d,target,velocity,B.missileSpeed[1],0.9,scale("missileTurn",2.2),dt);
   const moved=add(m.p,mul(m.d,B.missileSpeed[1]*dt));
   if(WeaponRules.SegmentDistance(target,m.p,moved)<scale("missileTurn",40)) {health[m.band]-=scale("hostileDamage",B.hostileDamage[1]);hits[m.band]++;if(health[m.band]<=0 && lostAt[m.band]<0) lostAt[m.band]=now;missiles.remove(i);} else m.p=moved;
  }
 }
 return {health,hits,first,lostAt,cleared};
}
describe("M11 deterministic acquisition and interception",()=>{
 it("selects mission-only difficulty hulls and preserves default aircraft",()=>{for(const d of Difficulty.Order) for(const a of M11_AIRCRAFT) {expect(protectedHealth(a,d)).toBe(M11_HEALTH[d]);expect(protectedHealth({...a,healthByDifficulty:undefined},d)).toBe(a.health);}});
 for(const d of Difficulty.Order) {
  it(`${d}: either neglected altitude loses after real acquisition and interception`,()=>{
   for(const band of [0,1]) {const s=encounter(d,band);print(d,band,s.hits[band],s.first[band],s.lostAt[band]);expect(s.health[band]).toBeLessThanOrEqual(0);expect(s.first[band]).toBeGreaterThan(0);expect(s.lostAt[band]).toBeLessThan(M11_SAFE_SECONDS);}
  });
  it(`${d}: attentive defence and one 30s lapse at either altitude survive`,()=>{
   for(const lapse of [-1,0,1]) {const s=encounter(d,-1,lapse);print(d,lapse,s.hits[0],s.hits[1]);expect(s.cleared).toBeLessThan(M11_SAFE_SECONDS);for(const h of s.health) expect(h).toBeGreaterThan(0);}
  });
 }
 it("requires homing for the neglect damage budget",()=>{const guided=encounter("easy",0),ballistic=encounter("easy",0,-1,0.05,false);expect(guided.hits[0]).toBeGreaterThan(ballistic.hits[0]);});
});
