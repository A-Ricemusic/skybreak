import { DifficultyKind } from "../shared/Difficulty";
import { readTargetScore } from "../shared/TargetScore";
import { MissionFinished, MissionStats } from "../shared/Types";
import { CampaignCoordinator, completeMission } from "./CampaignRepository";

/** Server-owned launch identity; menu cleanup may forget it after admission. */
export interface CampaignSortie {
	readonly identity: unknown;
	readonly slot: number;
	readonly missionId: number;
	readonly difficulty: DifficultyKind;
}

export interface CampaignSettlement {
	readonly sortie: CampaignSortie;
	readonly won: boolean;
	readonly stats: Readonly<MissionStats>;
	readonly result: Readonly<MissionFinished>;
}

/** No yields or cloud calls: earned progress belongs to the coordinator before cleanup can run. */
export function admitCampaignSettlement(
	coordinator: CampaignCoordinator,
	sortie: CampaignSortie,
	identity: unknown,
	won: boolean,
	stats: MissionStats,
): CampaignSettlement | undefined {
	if (identity === undefined || identity !== sortie.identity) return undefined;
	const targetScore = readTargetScore(stats.targetScore);
	if (targetScore) {
		table.freeze(targetScore.kills);
		table.freeze(targetScore.points);
		table.freeze(targetScore);
	}
	const snapshot = table.freeze({ ...stats, difficulty: sortie.difficulty, targetScore });
	let result: MissionFinished | undefined;
	completeMission(
		coordinator,
		sortie.slot,
		sortie.missionId,
		won,
		snapshot,
		(message) => {
			result = message;
		},
		0,
	);
	if (!result) return undefined;
	return table.freeze({ sortie: table.freeze({ ...sortie }), won, stats: snapshot, result: table.freeze(result) });
}

/** Cloud confirmation and messages may yield; never consult mutable active-flight fields here. */
export function finishCampaignSettlement(
	coordinator: CampaignCoordinator,
	settlement: CampaignSettlement,
	notify: (message: MissionFinished) => void,
): void {
	coordinator.flush(3);
	notify({ ...settlement.result, saved: !coordinator.hasPendingSave(), persistence: coordinator.getPersistence() });
}
