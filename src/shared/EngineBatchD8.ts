import { finiteNumber } from "./EngineBatchB";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";
import type { AreaAttack } from "./EngineBatchD3";
/** Precision fit on SALVO: one locked ground victim through D3's shared special path. */
export interface GuidedBomb extends AreaAttack {}
export interface EliteFormation { ejectionFlag: "vulture_two_recovered" }
/** Each live gun sweeps an authored bearing in the horizontal plane. */
export interface RingSweep {
 /** Absolute sea-datum safe altitude; absent preserves the original unbounded sweep. */
 ceiling?: number;
 guns: { targetId: string; source: FlightPoint; bearingDegrees: number }[];
 warningSeconds: number; countdownSeconds: number; intervalSeconds: number; damage: number;
 sweepDegrees: number; halfWidth: number; range: number;
}
export function inRingLine(plan: RingSweep, gun: RingSweep["guns"][number], player: FlightPoint, fraction: number): boolean {
 if (plan.ceiling !== undefined && player.y > plan.ceiling) return false;
 const angle=math.rad(gun.bearingDegrees+plan.sweepDegrees*(math.clamp(fraction,0,1)-0.5));
 const dx=player.x-gun.source.x,dz=player.z-gun.source.z;
 const along=dx*math.sin(angle)-dz*math.cos(angle);
 return along>0 && along<=plan.range && math.abs(dx*math.cos(angle)+dz*math.sin(angle))<=plan.halfWidth;
}
/** Closest bearing traversed by the sweep; exact wedge, no coarse ray sampling gaps. */
export function inRingSweep(plan: RingSweep, gun: RingSweep["guns"][number], player: FlightPoint): boolean {
 const bearing=math.deg(math.atan2(player.x-gun.source.x,-(player.z-gun.source.z)));
 const delta=(bearing-gun.bearingDegrees+540)%360-180;
 const half=math.abs(plan.sweepDegrees)/2;
 const closest=math.clamp(delta,-half,half);
 const fraction=plan.sweepDegrees===0 ? 0.5 : closest/plan.sweepDegrees+0.5;
 return inRingLine(plan,gun,player,fraction);
}
export function validateBatchD8(phases: MissionPhaseBlueprint[], limit: number): void {
 assert(phases.filter(p=>p.eliteFormation!==undefined).size()<=1,"One elite recovery event per sortie");
 for(const phase of phases) {
  const targets=phase.groundTargets ?? [];
  for(const t of targets) {
   if(t.type==="wreck") assert(!t.required && !t.sam && !t.naval && t.route===undefined && t.parentId===undefined && !t.ecm,"Wreck is scenery only");
   assert(t.ecm===undefined || (t.ecm===true && t.type==="ground_ecm"),"ECM needs a ground ECM target");
  }
  if(phase.eliteFormation) {
   assert(phase.eliteFormation.ejectionFlag==="vulture_two_recovered","Unknown elite story flag");
   assert(phase.kind==="required_air" && phase.count===5 && phase.execution?.directSpawn===true && !phase.bombers && !phase.interceptHold && phase.update?.countdownSeconds!==undefined,"Elite needs five direct required fighters and a fresh clock");
   assert(!phase.execution?.preservePursuers,"Elite retreat must own cleanup");
  }
  const p=phase.ringSweep;
  if(!p) continue;
  assert(p.ceiling === undefined || (finiteNumber(p.ceiling) && p.ceiling > 0 && p.ceiling <= 2000), "Invalid absolute ring ceiling");
  assert(phase.kind==="required_ground" && !phase.canyonEscape,"Ring sweep belongs to a strike");
  for(const n of [p.warningSeconds,p.countdownSeconds,p.intervalSeconds,p.damage,p.halfWidth,p.range]) assert(finiteNumber(n) && n>0,"Invalid ring sweep budget");
  assert(p.warningSeconds>=2 && p.countdownSeconds>=2 && p.intervalSeconds>=p.warningSeconds+p.countdownSeconds && p.intervalSeconds<=120 && p.damage<=100 && p.halfWidth<=200 && p.range<=45000 && finiteNumber(p.sweepDegrees) && math.abs(p.sweepDegrees)<=180,"Ring sweep exceeds budget");
  assert(p.guns.size()>0 && p.guns.size()<=7,"Ring needs one to seven live guns");
  const ids=new Set<string>();
  for(const g of p.guns) {
   assert(!ids.has(g.targetId) && targets.some(t=>t.id===g.targetId && t.type==="railgun_emplacement" && t.required),"Ring source needs a unique required railgun"); ids.add(g.targetId);
   assert(finiteNumber(g.bearingDegrees),"Invalid sweep bearing");
   assert(finiteNumber(g.source.x) && finiteNumber(g.source.y) && finiteNumber(g.source.z) && math.abs(g.source.x)<=limit && math.abs(g.source.z)<=limit && g.source.y>=0 && g.source.y<=2000,"Ring source outside airspace");
  }
 }
}
