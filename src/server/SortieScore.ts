// Shared server kill admission: objective validation runs before points are awarded.
// No client input or requiredness-based role inference enters the ledger.
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";
import { AlliedRules } from "../shared/AlliedRules";
import { MissionAllies } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";

export function recordScoredKill(state: BlueprintState, ledger: TargetScore, id: string,
	kind: "air" | "ground" | "ace", required: boolean, now: number, role?: string, breakdownRole?: string): boolean {
	if (!BlueprintRunner.RecordKill(state, id, kind, required, now)) return false;
	ledger.RecordKill(id, role ?? (kind === "ground" ? "ground" : (kind === "ace" ? "ace" : "bandit")), breakdownRole);
	state.score=ledger.Total();
	return true;
}

/** Destruction admission is independent of player credit. Default allied kills never enter objectives or points. */
export function recordAlliedKill(state: BlueprintState, ledger: TargetScore, destroyed: string[], policy: MissionAllies,
	id: string, kind: "air" | "ground" | "ace", required: boolean, now: number, role?: string, breakdownRole?: string, scoringRole = role): boolean {
	if (id === "" || state.killedIds.has(id) || destroyed.includes(id) || !AlliedRules.MayDestroy(policy) || !AlliedRules.CanEngage(policy, { required, role, enabled: true, health: 1 })) return false;
	if (AlliedRules.Credit(policy) && !recordScoredKill(state, ledger, id, kind, required, now, scoringRole, breakdownRole)) return false;
	state.killedIds.add(id);
	destroyed.push(id);
	return true;
}
