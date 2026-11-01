// Mission 18 finale: vent run volumes, duel arena bounds and ascending targets (pure). Formerly EngineBatchD13; the blueprint field is still `batchD13`.
import type { FlightPoint, MissionBlueprint, MissionPhaseBlueprint } from "./MissionCatalog";
import { finiteNumber } from "./LandingRules";
import { ENVIRONMENTS } from "./EnvironmentPresets";
import type { EnvironmentPreset } from "./MissionCatalog";

export interface VentVolume { center: FlightPoint; half: FlightPoint }
export interface VentRun {
 generators: string[];
 core: string;
 checkpoints: VentVolume[];
 /** Opens permanently after this many active flight seconds. No closing trap. */
 openingSeconds: number;
 gate: VentVolume;
 exit: VentVolume;
}
export interface DuelArena { center: FlightPoint; radius: number; minY: number; maxY: number }
import type { AscendingTarget } from "./M18FinaleRules";
export interface FinaleDuelPhase { enclosed?: true; ascending?: AscendingTarget[]; vent?: VentRun; duel?: DuelArena; environment?: string }
/** Reserved sortie identity, shared by admission and the authoritative spawn. */
export function duelTargetId(phaseIndex: number): string { return `d13_duel_${phaseIndex}`; }
export interface VentState { checkpoint: number; elapsed: number; exited: boolean }
export function newVent(): VentState { return {checkpoint:0,elapsed:0,exited:false}; }
/** Swept AABB catches fast crossings; generous authored boxes do not require centre hits. */
export function crossesVolume(v: VentVolume, a: FlightPoint, b: FlightPoint): boolean {
 let lo=0,hi=1;
 for(const axis of ["x","y","z"] as const) {
  const d=b[axis]-a[axis],low=v.center[axis]-v.half[axis],high=v.center[axis]+v.half[axis];
  if(math.abs(d)<1e-6) { if(a[axis]<low || a[axis]>high) return false; }
  else { const t1=(low-a[axis])/d,t2=(high-a[axis])/d; lo=math.max(lo,math.min(t1,t2)); hi=math.min(hi,math.max(t1,t2)); }
 }
 return lo<=hi;
}
export function dependenciesMet(p: VentRun, killed: ReadonlySet<string>): boolean { return p.generators.every(id=>killed.has(id)); }
export function stepVent(s: VentState,p: VentRun,killed: ReadonlySet<string>,a: FlightPoint,b: FlightPoint,dt: number): void {
 if(!finiteNumber(dt) || dt<=0 || dt>0.1 || !dependenciesMet(p,killed)) return;
 s.elapsed+=dt;
 const checkpoint=p.checkpoints[s.checkpoint];
 // One checkpoint per observation prevents a shortcut across multiple volumes.
 if(checkpoint && crossesVolume(checkpoint,a,b) && (s.checkpoint>0 || s.elapsed>=p.openingSeconds)) s.checkpoint++;
 if(s.checkpoint===p.checkpoints.size() && s.elapsed>=p.openingSeconds && killed.has(p.core) && !crossesVolume(p.exit,a,a) && crossesVolume(p.exit,a,b)) s.exited=true;
}
export function validateFinaleDuel(b: MissionBlueprint): void {
 const phases=b.phases, used=phases.some(p=>p.batchD13!==undefined);
 if(!used) return;
 assert(b.id===18 && !b.armament?.stock,"D13 requires M18 regenerating rack");
 const vents=phases.filter(p=>p.batchD13?.vent!==undefined),duels=phases.filter(p=>p.batchD13?.duel!==undefined);
 assert(vents.size()===1 && duels.size()===1,"D13 needs one vent and one duel");
 const vi=phases.indexOf(vents[0]),di=phases.indexOf(duels[0]);
 assert(phases.every(p=>!p.twist),"D13 uses a fixed reveal sequence");
 assert(vi>0 && di===vi+1 && di===phases.size()-1,"D13 reveal, vent and final duel must be ordered");
 for(const phase of phases) {
  const d:FinaleDuelPhase | undefined=phase.batchD13;
  if(!d) continue;
  assert(!phase.twist && !phase.rearm && !phase.returnLine && !phase.interceptHold && !phase.cruiseIntercept && !phase.protection && !phase.spatialJamming && !phase.eliteFormation && !phase.ringSweep,"D13 has exclusive phase ownership");
  if(d.environment) assert(d.environment==="m18_voice_breaks" || ENVIRONMENTS[d.environment as EnvironmentPreset]!==undefined,"Unknown D13 environment");
  if(d.ascending) {
   assert(b.id===18 && d.vent!==undefined && d.ascending.size()===4,"Ascending launches belong to M18 vent");
   for(const t of d.ascending) assert([t.start.x,t.start.y,t.start.z,t.end.x,t.end.y,t.end.z].every(finiteNumber) && t.start.y<t.end.y && finiteNumber(t.speed) && t.speed>0 && t.speed<=40 && t.start.x===t.end.x && t.start.z===t.end.z && t.start.y>=400 && t.end.y===2000 && math.abs(t.start.x)<14000 && math.abs(t.start.z)<14000,"Invalid ascending route");
  }
  const v:VentRun | undefined=d.vent;
  if(v) {
   assert(!d.duel && !phase.points && !phase.hazard && !phase.bombers,"Vent owns navigation and objective progression");
   assert(phase.kind==="required_ground" && phase.hidden===true && phase.count===1 && phase.groundTargets?.size()===1 && phase.groundTargets[0].id===v.core && phase.groundTargets[0].required,"Vent needs one hidden required core");
   assert(v.generators.size()===3 && new Set(v.generators).size()===3,"Three unique generators required");
   const previous:MissionPhaseBlueprint=phases[vi-1];
   assert(previous.kind==="required_ground" && previous.count===3 && previous.groundTargets?.filter(t=>t.required).size()===3 && v.generators.every(id=>previous.groundTargets?.some(t=>t.id===id && t.type==="generator" && t.required)),"Generators must gate core reveal");
   assert(v.checkpoints.size()>=2 && v.checkpoints.size()<=16 && finiteNumber(v.openingSeconds) && v.openingSeconds>=3 && v.openingSeconds<=60,"Invalid vent timing/sequence");
   for(const axis of ["x","y","z"] as const) assert(v.checkpoints[0].center[axis]===v.gate.center[axis],"First checkpoint must be the timed opening");
   const limit=b.airspace?.hardHalfWidth ?? 15360;
   for(const box of [...v.checkpoints,v.gate,v.exit]) for(const axis of ["x","y","z"] as const)
    assert(finiteNumber(box.center[axis]) && finiteNumber(box.half[axis]) && box.half[axis]>=20 && box.half[axis]<=600 && math.abs(box.center[axis])+box.half[axis]<=limit,"Invalid forgiving vent volume");
   assert(phase.groundTargets[0].type==="core","Vent objective must be a core");
  }
  if(d.duel) {
   const a:DuelArena=d.duel;
   assert(phase.kind==="ace" && (phase.optionalRaiders ?? 0)===0 && !phase.fighterWaves && !phase.standaloneAce && !phase.bombers && !phase.hazard && !phase.groundTargets && !phase.reinforce && phase.update?.countdownSeconds===300,"Duel requires isolated ace and fresh 5:00 clock");
   assert([a.center.x,a.center.y,a.center.z,a.radius,a.minY,a.maxY].every(finiteNumber) && a.radius>=1000 && a.radius<=6000 && a.minY>=800 && a.maxY>a.minY && a.maxY<=3000 && math.abs(a.center.x)+a.radius<=(b.airspace?.hardHalfWidth ?? 15360) && math.abs(a.center.z)+a.radius<=(b.airspace?.hardHalfWidth ?? 15360),"Invalid open-air duel arena");
  }
 }
}
/** Full enclosed sightline, with every engine ray <=1,000 studs (Roblox cap: 15,000). */
export function ventObstructed(a: FlightPoint,b: FlightPoint,cast:(origin:FlightPoint,delta:FlightPoint)=>number|undefined, margin=2):boolean {
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=math.sqrt(dx*dx+dy*dy+dz*dz);
 if(!finiteNumber(length) || length>100000) return true;
 if(length<=margin) return false;
 for(let offset=0;offset<length-margin;offset+=1000) {
  const size=math.min(1000,length-margin-offset);
  const hit=cast({x:a.x+dx*offset/length,y:a.y+dy*offset/length,z:a.z+dz*offset/length},{x:dx*size/length,y:dy*size/length,z:dz*size/length});
  if(hit!==undefined) return true;
 }
 return false;
}

/** Authored cylindrical arena, applied after integration instead of the legacy world clamp. */
export function boundDuelPosition(p: FlightPoint,a: DuelArena): FlightPoint {
 const dx=p.x-a.center.x,dz=p.z-a.center.z,r=math.sqrt(dx*dx+dz*dz);
 const scale=r>a.radius ? a.radius/r : 1;
 return {x:a.center.x+dx*scale,y:math.clamp(p.y,a.minY,a.maxY),z:a.center.z+dz*scale};
}
/** Projectile contact point on a swept segment; stop checking at the fuse, not beyond the target. */
export function projectileContact(a: FlightPoint,b: FlightPoint,target: FlightPoint): FlightPoint {
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,n=dx*dx+dy*dy+dz*dz;
 const t=n>0 ? math.clamp(((target.x-a.x)*dx+(target.y-a.y)*dy+(target.z-a.z)*dz)/n,0,1) : 0;
 return {x:a.x+dx*t,y:a.y+dy*t,z:a.z+dz*t};
}
