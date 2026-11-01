// Protected (escorted) aircraft plans, health, poses and protection outcomes (pure). Formerly EngineBatchD7.
import type { DifficultyKind } from "./Difficulty";
import { finiteNumber } from "./LandingRules";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";

export interface ProtectedAircraftPlan {
 id: string;
 callsign: string;
 health: number;
 healthByDifficulty?: { easy: number; normal: number; ace: number };
 route: { waypoints: FlightPoint[]; speed: number };
}
export function protectedHealth(plan:ProtectedAircraftPlan,difficulty:DifficultyKind):number {
 return plan.healthByDifficulty?.[difficulty] ?? plan.health;
}
export interface ProtectionPlan {
 aircraft: ProtectedAircraftPlan[];
 /** Aircraft persist through adjacent score/kill phases; safety also gates the final kill phase. */
 accompaniment?: true;
 /** Compressed D-016 band, never a change to player flight physics. */
 altitudeCeiling?: number;
}
export interface ProtectedState { health: number; elapsed: number; safe: boolean; warned: boolean }
export function protectedDuration(plan: ProtectedAircraftPlan): number {
 let distance=0;
 for(let i=1;i<plan.route.waypoints.size();i++) {
  const a=plan.route.waypoints[i-1], b=plan.route.waypoints[i];
  distance+=math.sqrt((b.x-a.x)**2+(b.y-a.y)**2+(b.z-a.z)**2);
 }
 return distance/plan.route.speed;
}
/** Piecewise authored routes keep every sampled point inside the validated envelope. */
export function protectedPose(plan: ProtectedAircraftPlan, elapsed: number): {position: FlightPoint; facing: FlightPoint} {
 let remaining=math.max(0,elapsed)*plan.route.speed;
 const points=plan.route.waypoints;
 for(let i=1;i<points.size();i++) {
  const a=points[i-1], b=points[i], dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
  const length=math.sqrt(dx*dx+dy*dy+dz*dz);
  if(remaining<=length || i===points.size()-1) {
   const t=math.clamp(remaining/length,0,1);
   return {position:{x:a.x+dx*t,y:a.y+dy*t,z:a.z+dz*t},facing:{x:dx/length,y:dy/length,z:dz/length}};
  }
  remaining-=length;
 }
 error("Protected route needs two points");
}
export function stepProtected(state: ProtectedState, plan: ProtectedAircraftPlan, dt: number): void {
 if(state.health<=0 || state.safe || !finiteNumber(dt) || dt<0) return;
 state.elapsed+=dt; state.safe=state.elapsed>=protectedDuration(plan);
}
/** No friendly fire or score path; dead/safe aircraft cannot receive another hit. */
export function damageProtected(state: ProtectedState, damage: number): boolean {
 if(state.safe || state.health<=0 || !finiteNumber(damage) || damage<=0) return false;
 state.health=math.max(0,state.health-damage);
 const warning=!state.warned; state.warned=true; return warning;
}
export function protectionResult(states: ProtectedState[]): "safe" | "lost" | undefined {
 if(states.some(s=>s.health<=0)) return "lost";
 return states.size()>0 && states.every(s=>s.safe) ? "safe" : undefined;
}
export function validateProtectedAircraftPhases(phases: MissionPhaseBlueprint[], limit: number): void {
 const ids=new Set<string>();
 let previous: ProtectionPlan | undefined;
 for(const p of phases) {
  const plan=p.protection;
  assert(p.kind!=="protected_air" || plan!==undefined,"Protected phase needs its aircraft plan");
  assert(!plan || (p.kind==="protected_air" && plan.accompaniment===undefined) || (plan.accompaniment===true && (p.kind==="score_threshold" || p.kind==="required_air")),"Invalid accompanying protection");
  if(!plan) { previous=undefined; for(const w of p.fighterWaves ?? []) assert(w.attackProtected===undefined,"Protected attackers need protected aircraft"); continue; }
  assert(plan.aircraft.size()>=1 && plan.aircraft.size()<=2,"Protect one or two aircraft");
  const ceiling=plan.altitudeCeiling ?? 2000;
  assert(finiteNumber(ceiling) && ceiling>=2000 && ceiling<=3200,"Protected altitude ceiling must be 2000–3200");
  assert(p.points===undefined && p.parkedEscort===undefined && (plan.accompaniment || p.count===undefined) && p.seconds===undefined && p.twist===undefined && p.hazard===undefined && p.bombers===undefined && (plan.accompaniment || p.scoreThreshold===undefined) && p.interceptHold===undefined && p.returnLine===undefined && p.landing===undefined && p.rearm===undefined && p.canyonEscape===undefined,"Protection owns phase progress");
  const localIds=new Set<string>();
  for(const a of plan.aircraft) {
   const prior: ProtectedAircraftPlan | undefined=previous?.accompaniment && plan.accompaniment ? previous.aircraft.find(v=>v.id===a.id) : undefined;
   assert(a.id.size()>0 && !localIds.has(a.id) && (!ids.has(a.id) || (prior!==undefined && sameProtectedPlan(prior,a))),"Protected ids must be unique or unchanged across adjacent accompanying phases"); ids.add(a.id); localIds.add(a.id);
   assert(a.callsign.size()>0 && a.callsign.size()<=24,"Protected callsign must fit HUD");
   assert(finiteNumber(a.health) && a.health>0 && a.health<=1000,"Invalid protected health");
   for(const h of a.healthByDifficulty ? [a.healthByDifficulty.easy,a.healthByDifficulty.normal,a.healthByDifficulty.ace] : []) assert(finiteNumber(h) && h>0 && h<=1000,"Invalid difficulty protected health");
   assert(finiteNumber(a.route.speed) && a.route.speed>=20 && a.route.speed<=200 && a.route.waypoints.size()>=2 && a.route.waypoints.size()<=32,"Invalid protected route");
   for(const v of a.route.waypoints) assert(finiteNumber(v.x) && finiteNumber(v.y) && finiteNumber(v.z) && math.abs(v.x)<=limit && math.abs(v.z)<=limit && v.y>=170 && v.y<=ceiling,"Protected route outside envelope");
   for(let i=1;i<a.route.waypoints.size();i++) { const a0=a.route.waypoints[i-1], b=a.route.waypoints[i]; assert((a0.x-b.x)**2+(a0.z-b.z)**2>1,"Protected route has duplicate/vertical leg"); }
  }
  previous=plan;
  for(const w of p.fighterWaves ?? []) if(w.attackProtected!==undefined) assert(localIds.has(w.attackProtected) && w.aircraft===undefined && w.scramble!==true,"Invalid protected attacker assignment");
 }
}

export function sameProtectedPlan(a:ProtectedAircraftPlan,b:ProtectedAircraftPlan):boolean {
 return a.healthByDifficulty?.easy===b.healthByDifficulty?.easy && a.healthByDifficulty?.normal===b.healthByDifficulty?.normal && a.healthByDifficulty?.ace===b.healthByDifficulty?.ace && a.id===b.id && a.health===b.health && a.callsign===b.callsign && a.route.speed===b.route.speed && a.route.waypoints.size()===b.route.waypoints.size() && a.route.waypoints.every((v,i)=>{const w=b.route.waypoints[i];return v.x===w.x && v.y===w.y && v.z===w.z;});
}
