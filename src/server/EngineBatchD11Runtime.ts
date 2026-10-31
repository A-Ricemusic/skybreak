import { BlueprintRunner } from "../shared/BlueprintRunner";
import { repairAllowed, sectorReinforcementReady } from "../shared/EngineBatchD11";
import type { CombatSession } from "./CombatSession";
/** Invoked only by D5's running director. Retains target IDs/health and the existing once-only kill ledger. */
export function releaseZoneReserves(s: CombatSession): void {
 const bs=s.blueprintState, runtime=s.groundDirector;
 if(!bs || !runtime || runtime.phase!==bs.phaseIndex) return;
 const plan=BlueprintRunner.ActivePhase(bs)?.groundProgress;
 for(const e of s.enemies ?? []) {
  const gate=e.typedGround?.reinforceAfterSector;
  if(gate===undefined || e.enabled || e.health<=0 || e.phaseOwner!==bs.phaseIndex || !sectorReinforcementReady(gate,plan,runtime.states)) continue;
  e.enabled=true;
  for(const item of e.model.GetDescendants()) if(item.IsA("BasePart")) {
   item.Transparency=item.GetAttribute("OriginalTransparency") as number ?? 0;
   item.CanQuery=item.GetAttribute("FlightSolid")===true;
  }
  e.model.SetAttribute("SkybreakEnemy",true);
  e.model.SetAttribute("RequiredTarget",false);
 }
}
/** Repair at completed service only. Historical damage counters remain untouched for debrief/rank. */
export function completeRearmRepair(s: CombatSession, optedIn: boolean): void {
 if(repairAllowed(s.blueprint?.id,optedIn) && s.health>0) s.health=100;
}
