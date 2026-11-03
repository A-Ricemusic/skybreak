// Progression and scoring writes for a CombatSession: the mission clock sync, kill admission into the
// runner and score ledger, and the runner tick. Every function here mutates session.blueprintState,
// session.targetScore or session.elapsed. Read-only views live in SessionQueries.
import type { CombatSession, TargetKind } from "./CombatSession";
import { recordScoredKill } from "./SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";

/** Sync elapsed from the authoritative runner. */
export function syncElapsed(session: CombatSession): void {
	if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
}

/**
 * Admit a player kill into the runner and the score ledger (idempotent per target id). Settlement
 * derives its kill totals from the runner (SessionQueries.sessionAllKills), so no separate tally
 * needs updating after a call.
 */
export function sessionRecordKill(
	session: CombatSession,
	id: string,
	kind: TargetKind,
	required: boolean,
	now: number,
	role?: string,
	breakdownRole?: string,
): boolean {
	if (session.blueprintState)
		return recordScoredKill(
			session.blueprintState,
			session.targetScore,
			id,
			kind,
			required,
			now,
			role,
			breakdownRole,
		);
	return false;
}

/** Advance the runner clock and phase state, publishing the ledger total as the runner's score first. */
export function sessionTick(session: CombatSession, now: number, health: number): void {
	if (session.blueprintState) {
		session.blueprintState.score = session.targetScore.Total();
		BlueprintRunner.Tick(session.blueprintState, now, health);
	}
}
