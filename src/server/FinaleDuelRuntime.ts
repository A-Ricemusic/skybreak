// Server adapters for FinaleDuelRules: duel activity, target permission and finale steps.
import { clearCruise } from "./CruiseMissileRuntime";
import { AircraftCollision } from "./AircraftCollision";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { resolveEnvironment } from "../shared/WorldEnvironments";
import { WorldEnvironment } from "./WorldEnvironment";
import type { CombatSession, Enemy } from "./CombatSession";

/** Session-scoped ownership. New retry session restores the world through its normal builder. */
export function duelActive(session: CombatSession): boolean {
	return (
		session.blueprintState !== undefined &&
		BlueprintRunner.ActivePhase(session.blueprintState)?.finale?.duel !== undefined
	);
}
export function finaleTargetAllowed(session: CombatSession, enemy: Enemy): boolean {
	const blueprintState = session.blueprintState;
	const finale = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.finale;
	if (finale?.duel) return enemy.kind === "ace" && enemy.required && enemy.phaseOwner === blueprintState!.phaseIndex;
	if (finale?.vent && enemy.id === finale.vent.core)
		return (
			blueprintState!.vent !== undefined &&
			blueprintState!.vent!.elapsed >= finale.vent.openingSeconds &&
			blueprintState!.vent!.checkpoint >= finale.vent.checkpoints.size()
		);
	return true;
}
export function stepFinaleDuel(session: CombatSession, say: (line: string) => void): void {
	const blueprintState = session.blueprintState;
	const finale = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.finale;
	if (!blueprintState || !finale) return;
	if (session.finaleDuel?.phase !== blueprintState.phaseIndex) {
		session.finaleDuel?.gate?.Destroy();
		session.finaleDuel?.beacon?.Destroy();
		session.finaleDuel = { phase: blueprintState.phaseIndex };
		if (finale.vent) {
			const gateVolume = finale.vent.gate;
			const shutter = new Instance("Part");
			shutter.Name = "Vent timed shutter";
			shutter.Anchored = true;
			shutter.CanCollide = false;
			shutter.CanTouch = false;
			shutter.Size = new Vector3(gateVolume.half.x * 2, gateVolume.half.y * 2, 4);
			shutter.Position = new Vector3(gateVolume.center.x, gateVolume.center.y, gateVolume.center.z);
			shutter.Material = Enum.Material.Neon;
			shutter.Color = Color3.fromRGB(255, 150, 50);
			shutter.SetAttribute("FlightSolid", true);
			shutter.Parent = session.folder;
			session.finaleDuel.gate = shutter;
			session.collisionParams = AircraftCollision.Parameters(session.folder);
			const beacon = new Instance("Part");
			beacon.Name = "Vent route beacon";
			beacon.Anchored = true;
			beacon.CanCollide = false;
			beacon.CanTouch = false;
			beacon.CanQuery = false;
			beacon.Size = new Vector3(12, 12, 12);
			beacon.Shape = Enum.PartType.Ball;
			beacon.Material = Enum.Material.Neon;
			beacon.Color = Color3.fromRGB(70, 255, 230);
			beacon.Parent = session.folder;
			session.finaleDuel.beacon = beacon;
			say("CORE ROUTE REVEALED · AMBER SHUTTER OPENS ON COUNTDOWN · FOLLOW CYAN BEACONS");
		}
		if ((finale.environment ?? "") !== "") {
			const environment = resolveEnvironment(finale.environment);
			assert(environment !== undefined, "Validated environment missing");
			// Replaces named atmosphere/clouds through the existing single world owner.
			// NightLighting only owns local lamps and never writes Lighting.
			WorldEnvironment.ApplySpec(environment, finale.environment!);
		}
		if (finale.duel) {
			clearCruise(session);
			session.airQueue.clear();
			for (let i = session.projectiles.size() - 1; i >= 0; i--) {
				session.projectiles[i].part.Destroy();
				session.projectiles.remove(i);
			}
			for (const enemy of session.enemies) {
				if (enemy.kind === "ace" && enemy.required && enemy.phaseOwner === blueprintState.phaseIndex) continue;
				enemy.enabled = false;
				enemy.windup = 0;
				enemy.model.SetAttribute("AttackWarning", false);
				if (enemy.warning) enemy.warning.Enabled = false;
				if (enemy.kind !== "ground") {
					enemy.health = 0;
					enemy.model.Destroy();
				}
			}
			for (const ally of session.allies) {
				ally.windup = 0;
				ally.combatTarget = undefined;
			}
			session.target = undefined;
			session.lockProgress = 0;
			say("RUSK ALONE · ALLIES HOLD FIRE · FIVE MINUTES");
		}
	}
	if (finale.vent && blueprintState.vent) {
		if (blueprintState.vent.elapsed >= finale.vent.openingSeconds && session.finaleDuel?.gate) {
			session.finaleDuel.gate.Destroy();
			session.finaleDuel.gate = undefined;
			say("VENT OPEN · FOLLOW CYAN CHECKPOINTS · EXIT REQUIRED AFTER CORE");
		}
		const target = finale.vent.checkpoints[blueprintState.vent.checkpoint]?.center ?? finale.vent.exit.center;
		if (session.finaleDuel?.beacon) session.finaleDuel.beacon.Position = new Vector3(target.x, target.y, target.z);
	}
}
