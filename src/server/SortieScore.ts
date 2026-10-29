// Shared server kill admission: objective validation runs before points are awarded.
// No client input or requiredness-based role inference enters the ledger.
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";
import { EncounterRole } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";

export function recordScoredKill(state: BlueprintState, ledger: TargetScore, id: string,
	kind: "air" | "ground" | "ace", required: boolean, now: number, role?: EncounterRole): boolean {
	if (!BlueprintRunner.RecordKill(state, id, kind, required, now)) return false;
	ledger.RecordKill(id, kind === "ground" ? "ground" : role ?? (kind === "ace" ? "ace" : "bandit"));
	return true;
}
