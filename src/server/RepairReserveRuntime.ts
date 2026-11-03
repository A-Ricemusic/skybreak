// Server adapters for RepairReserveRules: zone reserve release and rearm repair.
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { repairAllowed, sectorReinforcementReady } from "../shared/RepairReserveRules";
import type { CombatSession, Enemy } from "./CombatSession";
/** Invoked only by the running ground-sector director. Retains target IDs/health and the existing once-only kill ledger. */
export function releaseZoneReserves(session: CombatSession): void {
	const blueprintState = session.blueprintState;
	const runtime = session.groundDirector;
	if (!blueprintState || !runtime || runtime.phase !== blueprintState.phaseIndex) return;
	const plan = BlueprintRunner.ActivePhase(blueprintState)?.groundProgress;
	for (const enemy of session.enemies ?? []) {
		const gate = enemy.typedGround?.reinforceAfterSector;
		if (
			gate === undefined ||
			enemy.enabled ||
			enemy.health <= 0 ||
			enemy.phaseOwner !== blueprintState.phaseIndex ||
			!sectorReinforcementReady(gate, plan, runtime.states)
		)
			continue;
		enemy.reserveReleased = true;
		enemy.enabled = true;
		for (const item of enemy.model.GetDescendants())
			if (item.IsA("BasePart")) {
				item.Transparency = (item.GetAttribute("OriginalTransparency") as number) ?? 0;
				item.CanQuery = item.GetAttribute("FlightSolid") === true;
			}
		enemy.model.SetAttribute("SkybreakEnemy", true);
		enemy.model.SetAttribute("RequiredTarget", false);
	}
}
/** Repair at completed service only. Historical damage counters remain untouched for debrief/rank. */
export function completeRearmRepair(session: CombatSession, optedIn: boolean): void {
	if (repairAllowed(session.blueprint?.id, optedIn) && session.health > 0) session.health = 100;
}

/** Shared phase presentation: reserve state never changes legacy survivor visibility. */
export function applyGroundPhase(enemies: Enemy[], phaseIndex: number): void {
	for (const enemy of enemies)
		if (enemy.typedGround) {
			enemy.enabled =
				enemy.typedGround.type !== "wreck" &&
				enemy.phaseOwner === phaseIndex &&
				enemy.health > 0 &&
				enemy.typedGround.reinforceAfterSector === undefined;
			// Only released reserves may become standing survivors; unopened gates stay hidden until sortie cleanup.
			const released = enemy.typedGround.reinforceAfterSector === undefined || enemy.reserveReleased === true;
			const shown =
				released &&
				((enemy.typedGround.type === "wreck" && enemy.phaseOwner === phaseIndex) ||
					enemy.enabled ||
					(enemy.health > 0 && (enemy.phaseOwner ?? 0) < phaseIndex));
			for (const item of enemy.model.GetDescendants())
				if (item.IsA("BasePart")) {
					item.Transparency = shown ? ((item.GetAttribute("OriginalTransparency") as number) ?? 0) : 1;
					item.CanQuery = enemy.enabled && item.GetAttribute("FlightSolid") === true;
				}
			enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled);
			enemy.model.SetAttribute("RequiredTarget", enemy.enabled && enemy.required);
		}
}
