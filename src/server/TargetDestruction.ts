import type { Enemy } from "./CombatSession";

/** Retained geometry must never retain a live combat actor, warning or queued shot. */
export function disableDestroyedTarget(enemy: Pick<Enemy, "health" | "enabled" | "damageable" | "windup" | "windupTarget" | "warning" | "model">): void {
	enemy.health = 0;
	enemy.enabled = false;
	enemy.damageable = false;
	enemy.windup = 0;
	enemy.windupTarget = undefined;
	if (enemy.warning) enemy.warning.Enabled = false;
	enemy.model.SetAttribute("Health", 0);
	for (const flag of ["SkybreakEnemy", "RequiredTarget", "Damageable", "AttackWarning"]) enemy.model.SetAttribute(flag, false);
}

/** Opt-in scenery stays in the sortie folder, whose destruction owns end/retry cleanup. */
export function destroyTargetVisual(model: Model, wreckColor: Color3): void {
	if (model.GetAttribute("LeaveWreck") !== true) { model.Destroy(); return; }
	model.SetAttribute("Wreck", true);
	model.SetAttribute("TargetId", undefined);
	for (const part of model.GetDescendants()) {
		if (part.IsA("BasePart")) {
			part.Anchored = true;
			part.CanCollide = false;
			part.CanTouch = false;
			part.CanQuery = false;
			part.SetAttribute("FlightSolid", false);
			part.Color = wreckColor;
		} else if (part.IsA("BillboardGui") || part.IsA("Highlight") || part.IsA("Light")) part.Enabled = false;
	}
}
