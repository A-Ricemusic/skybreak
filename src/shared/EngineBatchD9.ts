import { finiteNumber } from "./EngineBatchB";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";

/** Static, unarmed visual-gun targets; points use the existing authored score role. */
export interface AirshipJammer { id: string; position: FlightPoint; health: number; scoreRole: string }
export interface JammerCorridor { sourceId: string; a: FlightPoint; b: FlightPoint; radius: number }
export interface SpatialJamming {
 airships: AirshipJammer[];
 /** Three-dimensional capsules, not a global 'any alive' switch. */
 corridors: JammerCorridor[];
 /** Maximum total navigation hold per protected aircraft, in simulation seconds. */
 navigationHoldSeconds: number;
}
export function inJammingCorridor(p: FlightPoint, c: JammerCorridor): boolean {
 const dx=c.b.x-c.a.x,dy=c.b.y-c.a.y,dz=c.b.z-c.a.z;
 const length=dx*dx+dy*dy+dz*dz;
 const t=length>0 ? math.clamp(((p.x-c.a.x)*dx+(p.y-c.a.y)*dy+(p.z-c.a.z)*dz)/length,0,1) : 0;
 return (p.x-c.a.x-dx*t)**2+(p.y-c.a.y-dy*t)**2+(p.z-c.a.z-dz*t)**2<=c.radius*c.radius;
}
/** Count unique sources so overlapping capsules do not inflate partial-radar state. */
export function coveringJammers(plan: SpatialJamming, p: FlightPoint, liveIds: string[]): number {
 const covered=new Set<string>();
 for(const c of plan.corridors) if(liveIds.includes(c.sourceId) && inJammingCorridor(p,c)) covered.add(c.sourceId);
 return covered.size();
}
export function navigationStep(dt: number, jammed: boolean, held: number, limit: number): {advance: number; held: number} {
 if(!finiteNumber(dt) || dt<=0) return {advance:0,held};
 const pause=jammed ? math.min(dt,math.max(0,limit-held)) : 0;
 return {advance:dt-pause,held:held+pause};
}
export function validateBatchD9(phases: MissionPhaseBlueprint[], limit: number, gun: boolean, points?: { [role: string]: number }): void {
 const ids=new Set<string>();
 const point=(p:FlightPoint)=>assert(finiteNumber(p.x) && finiteNumber(p.y) && finiteNumber(p.z) && math.abs(p.x)<=limit && math.abs(p.z)<=limit && p.y>=170 && p.y<=2000,"D9 point outside airspace");
 for(const phase of phases) {
  const p=phase.spatialJamming;if(!p) continue;
  assert(phase.jamming!==undefined,"Spatial coverage needs radar settings");
  assert(p.airships.size()<=32 && p.corridors.size()>0 && p.corridors.size()<=64,"D9 source/coverage budget exceeded");
  assert(finiteNumber(p.navigationHoldSeconds) && p.navigationHoldSeconds>=0 && p.navigationHoldSeconds<=60,"Navigation hold must be bounded");
  assert(p.airships.size()===0 || (gun && (phase.execution?.raiderKillCap ?? 0)>=p.airships.size()),"Airships need a gun and sufficient optional kill budget");
  const sources=new Set<string>();
  for(const a of p.airships) {
   assert(a.id.size()>0 && !ids.has(a.id) && !(phase.fighterWaves ?? []).some(w=>w.id===a.id),"Duplicate airship identity");ids.add(a.id);sources.add(a.id);
   assert(points?.[a.scoreRole]===100,"Airship jammer score must be authored as 100 points");
   point(a.position);assert(finiteNumber(a.health) && a.health>0 && a.health<=1000 && a.scoreRole.size()>0,"Invalid airship health/score role");
  }

  for(const c of p.corridors) {assert(sources.has(c.sourceId),"Coverage needs an authored jammer source");point(c.a);point(c.b);assert(finiteNumber(c.radius) && c.radius>0 && c.radius<=4000,"Invalid corridor radius");}
  for(const a of p.airships) assert(p.corridors.some(c=>c.sourceId===a.id),"Airship needs coverage");
 }
}
