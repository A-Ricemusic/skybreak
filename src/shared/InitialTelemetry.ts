import { BlueprintRunner } from "./BlueprintRunner";
import { GameConfig } from "./GameConfig";
import { MissionCatalog } from "./MissionCatalog";
import { MissionRules } from "./MissionRules";
import { SpecialWeapons } from "./SpecialWeapons";
import type { Telemetry } from "./Types";

/**
 * The HUD telemetry shown before the first server packet of a sortie. Objective fields match what
 * the server sends at mission start (MissionRules for missions 1-2, the first blueprint phase for
 * the rest) so nothing visibly jumps when that packet lands.
 */
export function initialTelemetry(missionId: number | undefined): Telemetry {
	const id = MissionCatalog.IsValidId(missionId) ? missionId : 1;
	let phase: string;
	let objective: string;
	let objectiveTotal: number;
	let tutorialStep: string;
	if (id <= 2) {
		const state = MissionRules.NewState(id, 0);
		const info = MissionRules.Objective(state);
		phase = state.phase;
		objective = info.objective;
		objectiveTotal = info.objectiveTotal;
		tutorialStep = info.tutorialStep;
	} else {
		const first = MissionCatalog.Get(id).phases[0];
		phase = first.kind;
		objective = first.label;
		objectiveTotal = BlueprintRunner.Total(first);
		tutorialStep = "";
	}
	return {
		kind: "Telemetry", health: 100, speed: 0, altitude: 250, kills: 0, total: 3, missiles: 8,
		missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false,
		elapsed: 0, targetDistance: 0, boundaryWarning: false,
		special: SpecialWeapons.Default, specialCharges: 0, specialCooldown: 0, specialActive: 0,
		missionId: id, phase, objective, objectiveProgress: 0, objectiveTotal,
		timeRemaining: GameConfig.Campaign.MissionTimeLimit, tutorialStep, groundKills: 0, targetKind: "air", targetRequired: false,
	};
}
