import { BomberPoint, BomberRoute, BomberRules } from "./BomberRules";
import { finiteNumber } from "./EngineBatchB";
import type { MissionPhaseBlueprint } from "./MissionCatalog";
/** Original provisional tuning: below player pursuit cap, one standard missile or a short gun burst. */
export const CruiseBudget = { inventory: 32, active: 12, speedMin: 60, speedMax: 180, health: 24, clearance: 60, radarLow: 180, radarRange: 2200, lowRadarRange: 1200 } as const;
export interface CruiseTarget {
 id: string; route: BomberPoint[]; speed: number; scoreRole: string;
 /** Roots arrive on phase active time; children release on their parent's local clock. */
 arrivalSeconds?: number; parentId?: string; separateSeconds?: number;
}
export interface CruisePlan { site: BomberPoint; targets: CruiseTarget[] }
export interface CruiseState { elapsed: number; status: "waiting" | "active" | "destroyed" | "separated" | "cancelled" | "impact" }
export function newCruiseStates(p: CruisePlan): CruiseState[] { return p.targets.map(()=>({elapsed:0,status:"waiting"})); }
export function cruiseRoute(t: CruiseTarget): BomberRoute { return BomberRules.Create(t.route,t.speed,[{x:0,y:0,z:0}]); }
export function cruiseRadar(distance: number, agl: number, clear: boolean): boolean {
 return finiteNumber(distance) && distance>=0 && finiteNumber(agl) && agl>=0 && clear && distance<=(agl<CruiseBudget.radarLow ? CruiseBudget.lowRadarRange : CruiseBudget.radarRange);
}
/** Resolve a dead carrier before separation; children are cancelled, never credited as kills. */
export function cruiseDestroyed(p: CruisePlan, states: CruiseState[], index: number): void {
 if(states[index].status!=="active") return;
 states[index].status="destroyed";
 for(let i=0;i<p.targets.size();i++) if(p.targets[i].parentId===p.targets[index].id && states[i].status==="waiting") states[i].status="cancelled";
}
export function cruiseComplete(states: CruiseState[]): boolean { return states.every(s=>s.status==="destroyed" || s.status==="separated" || s.status==="cancelled"); }
export function validateBatchD10(phases: MissionPhaseBlueprint[], limit: number): void {
 const sortieIds=new Set<string>();
 for(const phase of phases) {
  for(const t of phase.groundTargets ?? []) sortieIds.add(t.id);
  for(const w of phase.fighterWaves ?? []) sortieIds.add(w.id);
  if(phase.standaloneAce) sortieIds.add(phase.standaloneAce.id);
 }
 for(const phase of phases) {
  const p: CruisePlan | undefined=phase.cruiseIntercept; if(!p) continue;
  assert(phase.kind==="required_air" && phase.count===p.targets.size() && !phase.bombers && !phase.interceptHold && !phase.execution && !phase.scoreThreshold,"D10 needs its own required-air director phase");
  assert(p.targets.size()>0 && p.targets.size()<=CruiseBudget.inventory,"D10 inventory budget");
  const point=(v:BomberPoint)=>assert(finiteNumber(v.x) && finiteNumber(v.y) && finiteNumber(v.z) && math.abs(v.x)<=limit && math.abs(v.z)<=limit && v.y>=0 && v.y<=2000,"D10 point outside airspace");
  point(p.site); const ids=new Set<string>(); let roots=0;
  for(const t of p.targets) {
   assert(t.id.size()>0 && !ids.has(t.id) && !sortieIds.has(t.id) && t.scoreRole.size()>0,"D10 unique identities and score roles required"); ids.add(t.id); sortieIds.add(t.id);
   assert(finiteNumber(t.speed) && t.speed>=CruiseBudget.speedMin && t.speed<=CruiseBudget.speedMax,"D10 pursuit speed");
   assert(t.route.size()>=2 && t.route.size()<=16,"D10 route budget"); for(const v of t.route) point(v);
   const r=cruiseRoute(t), endpoint=t.route[t.route.size()-1];
   for(let sample=0;sample<=64;sample++) point(BomberRules.Sample(r,r.duration*sample/64).slots[0].position);
   assert((endpoint.x-p.site.x)**2+(endpoint.z-p.site.z)**2<=100**2,"D10 route must terminate at protected site");
   if(t.parentId===undefined) { roots++; assert(finiteNumber(t.arrivalSeconds ?? 0) && (t.arrivalSeconds ?? 0)>=0 && (t.arrivalSeconds ?? 0)<=1200,"D10 arrival time"); }
   else assert(t.arrivalSeconds===undefined,"D10 child cannot arrive independently");
   if(t.separateSeconds!==undefined) assert(finiteNumber(t.separateSeconds) && t.separateSeconds>=3 && t.separateSeconds<r.duration,"D10 separation must precede impact");
  }
  // Reserve enough independent slots for every possible leaf; a release never waits behind fighters or another carrier.
  let leaves=0;
  for(const t of p.targets) {
   const children: CruiseTarget[]=p.targets.filter(c=>c.parentId===t.id);
   if(children.size()===0) {leaves++; assert(t.separateSeconds===undefined,"D10 empty separation");}
   else assert(t.parentId===undefined && t.separateSeconds!==undefined && children.size()>=2,"D10 supports one bounded separation generation");
   if(t.parentId!==undefined) {
    const parent: CruiseTarget | undefined=p.targets.find(c=>c.id===t.parentId); assert(parent!==undefined && p.targets.indexOf(parent)<p.targets.indexOf(t) && parent.separateSeconds!==undefined,"D10 unknown parent");
    const release: BomberPoint=BomberRules.Sample(cruiseRoute(parent),parent.separateSeconds).slots[0].position; const start: BomberPoint=t.route[0];
    assert((release.x-start.x)**2+(release.z-start.z)**2+(release.y-start.y)**2<=16**2,"D10 child must begin at release point");
   }
  }
  assert(roots<=CruiseBudget.active && leaves<=CruiseBudget.active,"D10 independent active budget");
 }
}
