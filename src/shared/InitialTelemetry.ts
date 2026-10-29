import { BlueprintRunner } from "./BlueprintRunner";
import { MissionCatalog } from "./MissionCatalog";
import { SpecialWeapons } from "./SpecialWeapons";
import type { Telemetry } from "./Types";

/**
 * The HUD telemetry shown before the first server packet of a sortie. Objective fields match what
 * the server sends from the unified runner at mission start so nothing visibly jumps when that packet lands.
 */
export function initialTelemetry(missionId: number | undefined): Telemetry {
	const id = MissionCatalog.IsValidId(missionId) ? missionId : 1;
	const info = BlueprintRunner.Objective(BlueprintRunner.NewState(MissionCatalog.Get(id), 0));
	const { phase, objective, objectiveTotal, tutorialStep } = info;
	return {
		kind: "Telemetry", health: 100, speed: 0, altitude: 250, kills: 0, total: 3, missiles: 8,
		missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false,
		elapsed: 0, targetDistance: 0, boundaryWarning: false,
		special: SpecialWeapons.Default, specialCharges: 0, specialCooldown: 0, specialActive: 0,
		missionId: id, phase, objective, objectiveProgress: 0, objectiveTotal,
		timeRemaining: MissionCatalog.CountdownSeconds(id), tutorialStep, groundKills: 0, targetKind: "air", targetRequired: false,
	};
}
