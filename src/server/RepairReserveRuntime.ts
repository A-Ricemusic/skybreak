// Server adapters for RepairReserveRules: zone reserve release and rearm repair. Formerly EngineBatchD11Runtime.
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { repairAllowed, sectorReinforcementReady } from "../shared/RepairReserveRules";
import type { CombatSession, Enemy } from "./CombatSession";
/** Invoked only by D5's running director. Retains target IDs/health and the existing once-only kill ledger. */
export function releaseZoneReserves(s: CombatSession): void {
 const bs=s.blueprintState, runtime=s.groundDirector;
 if(!bs || !runtime || runtime.phase!==bs.phaseIndex) return;
 const plan=BlueprintRunner.ActivePhase(bs)?.groundProgress;
 for(const e of s.enemies ?? []) {
  const gate=e.typedGround?.reinforceAfterSector;
  if(gate===undefined || e.enabled || e.health<=0 || e.phaseOwner!==bs.phaseIndex || !sectorReinforcementReady(gate,plan,runtime.states)) continue;
  e.reserveReleased=true;
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

/** Shared phase presentation: D11 reserve state never changes legacy survivor visibility. */
export function applyGroundPhase(enemies: Enemy[], phaseIndex: number): void {
	for (const enemy of enemies) if (enemy.typedGround) {
		enemy.enabled=enemy.typedGround.type!=="wreck" && enemy.phaseOwner === phaseIndex && enemy.health>0 && enemy.typedGround.reinforceAfterSector===undefined;
		// Only released reserves may become standing survivors; unopened gates stay hidden until sortie cleanup.
		const released=enemy.typedGround.reinforceAfterSector===undefined || enemy.reserveReleased===true;
		const shown=released && ((enemy.typedGround.type==="wreck" && enemy.phaseOwner===phaseIndex) || enemy.enabled || (enemy.health>0 && (enemy.phaseOwner ?? 0)<phaseIndex));
		for(const item of enemy.model.GetDescendants()) if(item.IsA("BasePart")) {
			item.Transparency=shown ? (item.GetAttribute("OriginalTransparency") as number ?? 0) : 1;
			item.CanQuery=enemy.enabled && item.GetAttribute("FlightSolid") === true;
		}
		enemy.model.SetAttribute("SkybreakEnemy",enemy.enabled);
		enemy.model.SetAttribute("RequiredTarget",enemy.enabled && enemy.required);
	}
}
