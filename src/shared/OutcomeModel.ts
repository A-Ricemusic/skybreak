// Pure results-screen model: maps a MissionFinished payload plus the sortie's last telemetry onto the
// OutcomeScreen state. No Roblox services, globals or React, so it also runs in the offline Luau VM
// (tools/test-relay-offline.ts). GameUI owns the colours and the persistence normalisation and passes them in.
import { Difficulty } from "./Difficulty";
import { finiteOr } from "./Finite";
import { MissionCatalog } from "./MissionCatalog";
import { MissionScore } from "./MissionScore";
import { isMissionReason } from "./OutcomeReason";
import { isTargetScoreSnapshot } from "./TargetScore";
import type { MissionFinished, Persistence, Telemetry } from "./Types";
import type { OutcomeState } from "../client/screens/OutcomeScreen";

/** Save-status colours; GameUI supplies Theme Color3s, the offline spec supplies plain labels. */
export interface OutcomePalette<Color> {
	accent: Color;
	muted: Color;
	orange: Color;
}

/** OutcomeState with the save colour left generic so the model stays free of Color3. */
export type OutcomeModel<Color> = Omit<OutcomeState, "saveColor"> & { saveColor: Color };

/** The mission the results screen debriefs: the payload's id when valid, else the HUD's, else Practice. */
export function outcomeMissionId(finished: MissionFinished, current: Telemetry): number {
	return MissionCatalog.IsValidId(finished.missionId) ? finished.missionId : (current.missionId ?? 1);
}

/**
 * Builds the debrief shown after a sortie. Every payload field falls back to the last telemetry or a
 * catalog default when missing or malformed, so an older or partial server message still debriefs.
 * `resultPersistence` is the already-normalised persistence the result was saved under.
 */
export function buildOutcome<Color>(
	finished: MissionFinished,
	current: Telemetry,
	resultPersistence: Persistence,
	palette: OutcomePalette<Color>,
): OutcomeModel<Color> {
	const won = finished.kind === "Completed";
	const missionId = outcomeMissionId(finished, current);
	const saveText =
		won && finished.saved === true && resultPersistence === "cloud"
			? "FLIGHT RECORD SAVED TO CLOUD"
			: resultPersistence === "session"
				? "RESULT HELD FOR THIS SESSION ONLY"
				: resultPersistence === "unavailable"
					? "SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST"
					: won
						? "RESULT RECEIVED — SAVE NOT CONFIRMED"
						: "";
	const targetScore = isTargetScoreSnapshot(finished.targetScore) ? finished.targetScore : undefined;
	const count = (value: unknown, fallback = 0) => math.max(0, math.floor(finiteOr(value, fallback)));
	const kills = count(finished.kills, current.kills);
	const groundKills = math.min(kills, count(finished.groundKills, current.groundKills ?? 0));
	const elapsed = math.max(0, finiteOr(finished.elapsed, current.elapsed));
	const par = finiteOr(finished.par, 0) > 0 ? finished.par! : MissionScore.ParSeconds(MissionCatalog.Get(missionId));
	const missilesFired = count(finished.missilesFired);
	const missileHits = math.min(missilesFired, count(finished.missileHits));
	const damageTaken = math.clamp(finiteOr(finished.damageTaken, 100 - current.health), 0, 100);
	// The server scores the run; an older or fallback message is scored here for display only.
	const fallback = MissionScore.Compute(
		{
			won,
			airKills: kills - groundKills,
			groundKills,
			elapsed,
			par,
			missilesFired,
			missileHits,
			damageTaken,
			difficulty: Difficulty.IsKind(finished.difficulty) ? finished.difficulty : undefined,
			targetPoints: targetScore?.total,
		},
		MissionCatalog.Scoring(missionId),
	);
	return {
		won,
		missionId,
		targetScore: MissionCatalog.Scoring(missionId).basis === "points" ? targetScore : undefined,
		airKills: kills - groundKills,
		optionalKills: count(finished.optionalKills),
		groundKills,
		elapsed,
		par,
		completedPhases: count(
			finished.completedPhases,
			won ? MissionCatalog.TotalPhases(MissionCatalog.Get(missionId)) : 0,
		),
		missilesFired,
		missileHits,
		damageTaken,
		lowestHealth: math.clamp(finiteOr(finished.lowestHealth, current.health), 0, 100),
		evades: count(finished.evades),
		score: finiteOr(finished.score, -1) >= 0 ? math.floor(finished.score!) : fallback.score,
		rank: MissionScore.IsRank(finished.rank) ? finished.rank : fallback.rank,
		newBestScore: finished.newBestScore === true,
		newBestRank: finished.newBestRank === true,
		bestScore: finiteOr(finished.bestScore, -1) >= 0 ? math.floor(finished.bestScore!) : undefined,
		bestRank: MissionScore.IsRank(finished.bestRank) ? finished.bestRank : undefined,
		reason: isMissionReason(finished.reason) ? finished.reason : undefined,
		difficulty: Difficulty.IsKind(finished.difficulty) ? finished.difficulty : undefined,
		saveText,
		saveColor:
			won && finished.saved === true && resultPersistence === "cloud"
				? palette.accent
				: resultPersistence === "cloud"
					? palette.muted
					: palette.orange,
	};
}
