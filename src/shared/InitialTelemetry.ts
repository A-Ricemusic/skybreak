import { AC04Runner } from "./AC04Runner";
import { ac04ValidMission } from "./AC04Progress";
import { GameConfig } from "./GameConfig";
import { SpecialWeapons } from "./SpecialWeapons";
import type { Telemetry } from "./Types";

/** Initial AC04 objective before the first authoritative telemetry packet. */
export function initialTelemetry(missionId: number | undefined): Telemetry {
	const id = ac04ValidMission(missionId) ? missionId : 1;
 const run = AC04Runner.New(id,0), info=AC04Runner.Objective(run);
 const {phase,objective,objectiveTotal,tutorialStep}=info;
	return {
		kind: "Telemetry", health: 100, speed: 0, altitude: 250, kills: 0, total: 3, missiles: 8,
		missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false,
		elapsed: 0, targetDistance: 0, boundaryWarning: false,
		special: SpecialWeapons.Default, specialCharges: 0, specialCooldown: 0, specialActive: 0,
		missionId: id, phase, objective, objectiveProgress: 0, objectiveTotal,
		timeRemaining: GameConfig.Campaign.MissionTimeLimit, tutorialStep, groundKills: 0, targetKind: "air", targetRequired: false,
	};
}
