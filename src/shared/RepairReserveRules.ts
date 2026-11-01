// Opt-in field repair (missions 15-17), sector reinforcement reserves and cheap armour eligibility (pure). Formerly EngineBatchD11.
import type { MissionPhaseBlueprint } from "./MissionCatalog";
import type { GroundProgressPlan, SectorState } from "./GroundSectorRules";
import type { TypedGroundTarget } from "./CampaignEncounters";

/** D-500: authoring identity, never a client-provided repair permission. */
export function repairAllowed(missionId: number | undefined, optedIn: boolean): boolean {
 return optedIn && (missionId===15 || missionId===16 || missionId===17);
}
/** Reinforcements are preallocated dormant contacts in D6's whole-sortie inventory.
 * No spawning, killing or crediting occurs here. A secured zone releases each surviving contact once. */
export function sectorReinforcementReady(id: string | undefined, plan?: GroundProgressPlan, states?: SectorState[]): boolean {
 if(id===undefined) return true;
 if(!plan || !states) return false;
 for(let i=0;i<plan.sectors.size();i++) if(plan.sectors[i].id===id) return states[i]?.secured===true && states[i].health>0;
 return false;
}
/** Cheap armour rendering is opt-in for missions 15-17; other missions keep their full ground-target models. */
export function cheapArmourAllowed(missionId?: number): boolean { return missionId===15 || missionId===16 || missionId===17; }
/** Armed/moving armour must retain its original firing, collision and aim geometry. */
export function cheapArmourEligible(spec: TypedGroundTarget): boolean {
 return ["tank","vehicle","artillery","bunker"].includes(spec.type) && !spec.route && !spec.parentId && !spec.sam;
}
export function validateRepairReservePhases(phases: MissionPhaseBlueprint[], missionId?: number): void {
 for(const p of phases) {
  if(p.rearm?.health) assert(repairAllowed(missionId,true),"Repair is opt-in for missions 15–17 only");
  for(const t of p.groundTargets ?? []) {
   const id=t.reinforceAfterSector;
   if(id===undefined) continue;
   const plan=p.groundProgress;
   assert(p.kind==="score_threshold" && p.cheapContacts===true && plan!==undefined,"Zone reserves need a budgeted ground-support strike");
   const index=plan.sectors.findIndex(s=>s.id===id);
   assert(index>=0 && !t.required,"Unknown reserve sector or required reserve");
   // A gate cannot depend on its own reserve, or on a reserve from a later sector.
   for(let i=0;i<=index;i++) assert(!plan.sectors[i].clearTargetIds.includes(t.id),"Circular reinforcement clearance gate");
  }
  for(const s of p.groundProgress?.sectors ?? []) if(s.formation!==undefined) {
   assert(s.formation==="city_squad" || s.formation==="desert_column","Invalid ground formation");
   assert(s.kind===(s.formation==="city_squad" ? "troops" : "column"),"Formation must use D5 route kind");
  }
  // D4 remains sole owner of bomber hold/escape/site loss; no second city defence clock.
  if(p.interceptHold && p.groundProgress) assert(false,"City interception follows ground support as its own D4 phase");
 }
}
