import { dampedSteer, pursuitDestination, guidedDirection } from "../shared/EncounterKinematics";
import { describe, expect, it } from "@rbxts/jest-globals";
import { M11_AIRCRAFT, M11_WAVES, M11_SAFE_SECONDS, M11_HEALTH, mission } from "../shared/missions/m11";
import { protectedHealth, protectedPose } from "../shared/ProtectedAircraftRules";
import { authoredAirPose } from "../shared/CampaignEncounters";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { CombatBalance as B } from "../shared/CombatBalance";
import { ThreatRules as T, Point } from "../shared/ThreatRules";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { WeaponRules } from "../shared/WeaponRules";
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n,z:a.z*n});
const sub=(a:Point,b:Point)=>add(a,mul(b,-1));
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=(a:Point)=>math.sqrt(dot(a,a));
const unit=(a:Point)=>mul(a,1/math.max(0.000001,length(a)));
const steer=(a:Point,b:Point,rate:number,dt:number)=>dampedSteer(a,unit(b),rate,dt);
interface Attacker { p:Point; d:Point; pass:Point; band:number; index:number; side:number; kill:number; reload:number; windup:number; extend:number }
interface Missile { p:Point; d:Point; band:number; age:number }
/** Deterministic shared-rule budget, NOT a CombatService runtime integration test.
 * Calls pure kinematics, WavePlan.Admit, Difficulty.Scale and combat tables directly;
 * bypasses PhaseDirector/CombatService call sites, instances and frame ordering.
 * Assumes scheduled defence: 10s per contact + 25s per altitude transfer, with one
 * optional 30s lapse. Removals are a budget assumption, not measured pilot skill.
 * Open sky, straight southbound player at speed 160; no terrain avoidance or random
 * lock breaks; stable spawn indices stand in for runtime enemy-list indices.
 * RIME is admitted with ace priority and occupies a fighter slot until
 * safety, but its player-directed combat and effects on player attention are omitted.
 * No claim of faithful runtime balance or observed Player quality.
 */
function encounter(d:DifficultyKind, neglected=-1, lapse=-1, dt=0.05, homing=true) {
 const health=M11_AIRCRAFT.map(a=>protectedHealth(a,d)), hits=[0,0], first=[-1,-1],lostAt=[-1,-1];
 const enemies:Attacker[]=[], missiles:Missile[]=[];
 const phase=mission.phases[0], ace=phase.standaloneAce!;
 const arrivals=[...M11_WAVES,ace];
 const queue:AirRequest[]=[], fired=new Set<string>(), admitted=new Map<string,number>();
 const schedules=new Map<string,number>();
 let cleared=0,lastBand=1,serial=0,aceLive=false,alliedKill=false;
 for(const w of M11_WAVES) {
  assert(w.trigger.kind==="time"); const band=M11_AIRCRAFT.findIndex(a=>a.id===w.attackProtected);
  const start=math.max(w.trigger.seconds,cleared+(lastBand===band?0:25))+(lapse===band?30:0);
  if(lapse===band) lapse=-1;
  schedules.set(w.id,start);cleared=start+w.count*10;lastBand=band;
 }
 const scale=(knob:Parameters<typeof Difficulty.Scale>[1],v:number)=>Difficulty.Scale(d,knob,v);
 let last=-100;
 for(let now=0;now<M11_SAFE_SECONDS;now+=dt) {
  const poses=M11_AIRCRAFT.map(a=>protectedPose(a,now));
  for(const arrival of arrivals) {
   assert(arrival.trigger.kind==="time");
   if(now>=arrival.trigger.seconds && !fired.has(arrival.id)) {
    fired.add(arrival.id);
    queue.push({arrival,role:"name" in arrival?"ace":arrival.role,count:"name" in arrival?1:arrival.count,behind:false});
   }
  }
  const room:number=phase.concurrentFighters!-enemies.filter(e=>now<e.kill).size()-(aceLive?1:0);
  for(const batch of WavePlan.Admit(queue,room)) {
   const w=batch.arrival!;
   if(batch.role==="ace") {aceLive=true;serial++;continue;}
   assert("attackProtected" in w);
   const band=M11_AIRCRAFT.findIndex(a=>a.id===w.attackProtected);
   const sides=WavePlan.BracketSides(serial,batch.count);
   const previous=admitted.get(w.id) ?? 0;
   for(let i=0;i<batch.count;i++) {
    // spawnAir resets formation/reload indices for each actually admitted batch.
    const pose=authoredAirPose(w.spawn!,w.headingDegrees!,i,false,0);
    let kill=band===neglected?math.huge:math.max(now+10,schedules.get(w.id)!+(previous+i+1)*10);
    if(band===neglected && !alliedKill) {kill=now;alliedKill=true;}
    enemies.push({p:pose.position,d:pose.facing,pass:pose.facing,band,index:++serial,side:sides[i],
     kill,reload:4+i*1.5,windup:0,extend:0});
   }
   admitted.set(w.id,previous+batch.count);
  }
  const live=enemies.filter(e=>now<e.kill);
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
    if(e.windup===0) {if(length(sub(target,e.p))<2300) {const launch=add(e.p,mul(e.d,B.hostileLaunchOffset));missiles.push({p:launch,d:unit(sub(target,launch)),band:e.band,age:0});}e.reload=scale("hostileGate",B.banditReload[1]);}
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
 const neglect=Difficulty.Order.map(d=>[encounter(d,0),encounter(d,1)]);
 it("orders neglect survival Easy > Normal > Hard by at least 10% on BOTH routes",()=>{
  for(const band of [0,1]) {
   const easy=neglect[0][band].lostAt[band],normal=neglect[1][band].lostAt[band],hard=neglect[2][band].lostAt[band];
   expect(hard).toBeGreaterThan(0);expect(normal).toBeGreaterThanOrEqual(hard*1.1);expect(easy).toBeGreaterThanOrEqual(normal*1.1);
  }
 });
 for(const d of Difficulty.Order) {
  it(`${d}: either neglected altitude loses after real acquisition and interception`,()=>{
   for(const band of [0,1]) {const s=neglect[Difficulty.Order.indexOf(d)][band];print(d,band,s.hits[band],s.first[band],s.lostAt[band]);expect(s.health[band]).toBeLessThanOrEqual(0);expect(s.first[band]).toBeGreaterThan(0);expect(s.lostAt[band]).toBeLessThan(M11_SAFE_SECONDS);}
  });
  it(`${d}: attentive defence and one 30s lapse at either altitude survive`,()=>{
   for(const lapse of [-1,0,1]) {const s=encounter(d,-1,lapse);print(d,lapse,s.hits[0],s.hits[1]);expect(s.cleared).toBeLessThan(M11_SAFE_SECONDS);for(const h of s.health) expect(h).toBeGreaterThan(0);}
  });
 }
 it("requires homing for the neglect damage budget",()=>{const guided=encounter("easy",0),ballistic=encounter("easy",0,-1,0.05,false);expect(guided.hits[0]).toBeGreaterThan(ballistic.hits[0]);});
});
