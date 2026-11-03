// Shared server kill admission: objective validation runs before points are awarded.
// No client input or requiredness-based role inference enters the ledger.
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";
import { AlliedRules } from "../shared/AlliedRules";
import { MissionAllies } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";

export function recordScoredKill(
	state: BlueprintState,
	ledger: TargetScore,
	id: string,
	kind: "air" | "ground" | "ace",
	required: boolean,
	now: number,
	role?: string,
	breakdownRole?: string,
): boolean {
	if (!BlueprintRunner.RecordKill(state, id, kind, required, now)) return false;
	ledger.RecordKill(id, role ?? (kind === "ground" ? "ground" : kind === "ace" ? "ace" : "bandit"), breakdownRole);
	state.score = ledger.Total();
	return true;
}

/** Destruction admission is independent of player credit. Default allied kills never enter objectives or points. */
export function recordAlliedKill(
	state: BlueprintState,
	ledger: TargetScore,
	destroyed: string[],
	policy: MissionAllies,
	id: string,
	kind: "air" | "ground" | "ace",
	required: boolean,
	now: number,
	role?: string,
	breakdownRole?: string,
	scoringRole = role,
): boolean {
	if (
		!AlliedRules.BudgetRemaining(policy, destroyed.size()) ||
		required ||
		id === "" ||
		state.killedIds.has(id) ||
		destroyed.includes(id) ||
		!AlliedRules.MayDestroy(policy) ||
		!AlliedRules.CanEngage(policy, { required, role, enabled: true, health: 1 })
	)
		return false;
	if (
		AlliedRules.Credit(policy) &&
		!recordScoredKill(state, ledger, id, kind, required, now, scoringRole, breakdownRole)
	)
		return false;
	state.killedIds.add(id);
	destroyed.push(id);
	return true;
}

/**
 * Settlement kill totals, derived only from runner state: required air, the required ace, required
 * ground, optional air (raiders, optional aces) and optional ground. Uncredited allied kills never reach
 * these counters (recordAlliedKill marks the id only), and credited ones arrive through recordScoredKill.
 */
export function runnerAllKills(state: BlueprintState | undefined): number {
	if (!state) return 0;
	return (
		state.requiredAirKills +
		(state.aceKilled ? 1 : 0) +
		state.requiredGroundKills +
		state.optionalAirKills +
		state.optionalGroundKills
	);
}

/** The ground subset of runnerAllKills; settlement treats `kills - groundKills` as air kills. */
export function runnerGroundKills(state: BlueprintState | undefined): number {
	if (!state) return 0;
	return state.requiredGroundKills + state.optionalGroundKills;
}
