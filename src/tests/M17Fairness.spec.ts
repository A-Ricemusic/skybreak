import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog } from "../shared/MissionCatalog";
import { TargetPriority } from "../shared/TargetPriority";
import { WeaponRules as W, Point } from "../shared/WeaponRules";
import { ThreatRules as T } from "../shared/ThreatRules";
import { guidedDirection } from "../shared/EncounterKinematics";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { CombatBalance as B } from "../shared/CombatBalance";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { WavePlan, AirRequest } from "../shared/WavePlan";
const add=(a:Point,b:Point,n=1):Point=>({x:a.x+b.x*n,y:a.y+b.y*n,z:a.z+b.z*n});
const distance=(a:Point,b:Point)=>math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);
interface Contact {id:number;p:Point;v:Point;hp:number}
// Controlled moving-contact response envelope, not an authored-sortie/Player completion claim.
// Every eligible persistent contact participates in selection; only genuine hits release slots.
function response(id:number,d:DifficultyKind,fault="none") {
 const bp=MissionCatalog.Get(id),dt=0.05,origin={x:0,y:1200,z:0},nose={x:0,y:0,z:-1};
 const queue:AirRequest[]=[{role:"bandit",count:4,behind:false}];
 const contacts:Contact[]=[],shots:{p:Point;dir:Point;target:Contact;age:number;last:number;lost:boolean}[]=[];
 let serial=0,kills=0,lock=0,selected=-1,cool=0,spent=0;
 const cap=bp.phases[0].concurrentFighters??4;
 for(let tick=0;tick<3600;tick++) {
  const now=tick*dt;
  for(const batch of WavePlan.Admit(queue,cap-contacts.filter(c=>c.hp>0).size(),bp.phases[0].concurrentRoutes))for(let i=0;i<batch.count;i++) {
   const n=serial++;contacts.push({id:n,p:{x:40+n*20,y:1200,z:-1000-n*80},v:{x:100,y:0,z:0},hp:Difficulty.BanditHealth(d,3,B.banditHealth[2])});
  }
  // Orbit back across the forward cone instead of expiring live fighters to free capacity.
  for(const c of contacts)if(c.hp>0){c.p=add(c.p,c.v,dt);if(math.abs(c.p.x)>550)c.v.x=-c.v.x;}
  const eligible=contacts.filter(c=>c.hp>0);
  const candidates=eligible.map(c=>{const r=distance(origin,c.p);return {id:c.id,distance:r,dot:-c.p.z/r,inRange:r<W.AirLockRange,blocked:false,onScreen:true};});
  const chosen=fault==="selection"?undefined:TargetPriority.Best(candidates);
  if(chosen!==selected){lock=0;selected=chosen??-1;}
  const target=eligible.find(c=>c.id===chosen),candidate=candidates.find(c=>c.id===chosen);
  lock=candidate&&candidate.dot>=W.LockDot?math.min(1,lock+dt/W.LockBuildSeconds):0;cool=math.max(0,cool-dt);
  if(target&&candidate&&shots.size()===0&&W.Launch({missiles:80-spent,missileCooldown:cool,hasTarget:true,lockProgress:lock,distance:candidate.distance,dot:candidate.dot}).kind==="guided") {
   shots.push({p:origin,dir:nose,target,age:0,last:candidate.distance,lost:false});spent++;cool=B.playerMissileCooldown;
  }
  for(let i=shots.size()-1;i>=0;i--) {
   const s=shots[i],c=s.target,r=distance(s.p,c.p);s.age+=dt;
   s.lost=s.lost||T.LosesTrack({breaking:false,distance:r,previousDistance:s.last,fuseRadius:W.FuseRadius});s.last=r;
   if(!s.lost&&fault!=="homing")s.dir=guidedDirection(s.p,s.dir,c.p,c.v,W.MissileSpeed,W.MissileLeadMax,W.MissileTurnRate(r),dt);
   const advanced=add(s.p,s.dir,W.MissileSpeed*dt);
   const hit=s.lost?W.Fuse(s.p,advanced,eligible,c=>c.p,()=>true)!==undefined:W.SegmentDistance(c.p,s.p,advanced)<W.FuseRadius;
   if(hit){c.hp-=SpecialWeapons.StandardDamage;if(c.hp<=0)kills++;shots.remove(i);}else if(s.age>=W.GuidedLifetime)shots.remove(i);else s.p=advanced;
  }
  if(kills===4)return {won:true,spent,elapsed:now};
 }
 return {won:false,spent,elapsed:180};
}
describe("released late-mission shared combat response envelopes",()=>{
 for(const id of [11,13,14,15,16,17])it(`M${id} selects all live contacts and needs working homing`,()=>{
  const results=Difficulty.Order.map(d=>response(id,d));
  for(const r of results)expect(r.won).toBe(true);
  expect(results[0].spent).toBeLessThanOrEqual(results[1].spent);expect(results[1].spent).toBeLessThanOrEqual(results[2].spent);
  const gates=Difficulty.Order.map(d=>T.FlightGate(Difficulty.Scale(d,"hostileGate",B.flightGate[2]),4,Difficulty.Scale(d,"flightDivisor",B.flightDivisor[2])));
  expect(gates[0]).toBeGreaterThan(gates[1]);expect(gates[1]).toBeGreaterThan(gates[2]);
  for(const fault of ["selection","homing"])expect(response(id,"normal",fault).won).toBe(false);
 });
});
