// Blueprint-driven authoritative runner for missions 3-27. Missions 1 and 2
// continue to use the legacy MissionRules module so their existing tests and
// combat-service behavior remain bit-identical.
//
// The runner is intentionally pure: callers (CombatService in production,
// Jest in tests) feed it observed events; it never spawns objects, applies
// damage, or trusts client-reported results.

import { MissionBlueprint, MissionPhaseBlueprint, PhaseKind } from "./MissionCatalog";

export type BlueprintReason = "complete" | "timeout" | "destroyed";

export interface BlueprintState {
	blueprint: MissionBlueprint;
	startedAt: number;
	elapsed: number;
	/** Index into blueprint.phases that is currently active. */
	phaseIndex: number;
	/** Required progress of the active phase (ground or air kills). */
	phaseProgress: number;
	/** Dedup set of kill IDs recorded by the server. */
	killedIds: Set<string>;
	requiredAirKills: number;
	requiredGroundKills: number;
	optionalAirKills: number;
	aceKilled: boolean;
	outcome?: "won" | "failed";
	reason?: BlueprintReason;
}

export interface BlueprintObjective {
	phase: PhaseKind | "complete";
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: "";
	beat?: string;
}

const DURATION = 600;

function finite(value: number): boolean {
	return value === value && value > -math.huge && value < math.huge;
}

function activePhase(state: BlueprintState): MissionPhaseBlueprint | undefined {
	return state.blueprint.phases[state.phaseIndex];
}

function requiredCount(phase: MissionPhaseBlueprint): number {
	if (phase.kind === "ace") return 1;
	return phase.count ?? 0;
}

function finish(state: BlueprintState, outcome: "won" | "failed", reason: BlueprintReason): void {
	if (state.outcome !== undefined) return;
	state.outcome = outcome;
	state.reason = reason;
}

export const BlueprintRunner = {
	Duration: DURATION,

	NewState(blueprint: MissionBlueprint, startedAt: number): BlueprintState {
		assert(finite(startedAt), "Mission clock must be finite");
		assert(blueprint.phases.size() >= 1, "Blueprint must have at least one phase");
		return {
			blueprint,
			startedAt,
			elapsed: 0,
			phaseIndex: 0,
			phaseProgress: 0,
			killedIds: new Set<string>(),
			requiredAirKills: 0,
			requiredGroundKills: 0,
			optionalAirKills: 0,
			aceKilled: false,
		};
	},

	Tick(state: BlueprintState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= DURATION) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
	},

	TimeRemaining(state: BlueprintState): number {
		return math.max(0, DURATION - state.elapsed);
	},

	ActivePhase(state: BlueprintState): MissionPhaseBlueprint | undefined {
		return activePhase(state);
	},

	/** Which kinds of damage the active phase allows right now. */
	CanDamage(state: BlueprintState, kind: "air" | "ground" | "ace", required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		const phase = activePhase(state);
		if (!phase) return false;
		if (kind === "ace") return required && phase.kind === "ace";
		if (kind === "ground") return required && phase.kind === "required_ground";
		if (kind === "air") {
			if (required) return phase.kind === "required_air";
			// Optional raiders only count during phases that explicitly permit them.
			if ((phase.optionalRaiders ?? 0) <= 0) return false;
			return state.optionalAirKills < BlueprintRunnerPrivate.optionalWindow(state.blueprint);
		}
		return false;
	},

	RecordKill(
		state: BlueprintState,
		id: string,
		kind: "air" | "ground" | "ace",
		required: boolean,
		now: number,
	): boolean {
		BlueprintRunner.Tick(state, now);
		if (id === "" || state.killedIds.has(id)) return false;
		if (!BlueprintRunner.CanDamage(state, kind, required)) return false;
		const phase = activePhase(state)!;
		state.killedIds.add(id);
		if (kind === "ace") {
			state.aceKilled = true;
			state.phaseProgress = 1;
			finish(state, "won", "complete");
			return true;
		}
		if (required) {
			if (kind === "air") state.requiredAirKills += 1;
			else state.requiredGroundKills += 1;
			state.phaseProgress += 1;
			if (state.phaseProgress >= requiredCount(phase)) BlueprintRunnerPrivate.advance(state);
			return true;
		}
		state.optionalAirKills += 1;
		return true;
	},

	Objective(state: BlueprintState): BlueprintObjective {
		if (state.outcome === "won") {
			return { phase: "complete", objective: "Objective complete", objectiveProgress: 1, objectiveTotal: 1, tutorialStep: "" };
		}
		const phase = activePhase(state);
		if (!phase) {
			return { phase: "complete", objective: "Objective complete", objectiveProgress: 1, objectiveTotal: 1, tutorialStep: "" };
		}
		const total = requiredCount(phase);
		return {
			phase: phase.kind,
			objective: phase.label,
			objectiveProgress: math.min(state.phaseProgress, total),
			objectiveTotal: total,
			tutorialStep: "",
			beat: phase.beat,
		};
	},
};

// Advance / optional window helpers kept in a private namespace to avoid
// exposing mutation to callers while still giving tests one entry point.
const BlueprintRunnerPrivate = {
	advance(state: BlueprintState): void {
		if (state.outcome !== undefined) return;
		state.phaseIndex += 1;
		state.phaseProgress = 0;
		if (state.phaseIndex >= state.blueprint.phases.size()) {
			finish(state, "won", "complete");
		}
	},
	optionalWindow(blueprint: MissionBlueprint): number {
		if (blueprint.optionalRaiderMax !== undefined) return blueprint.optionalRaiderMax;
		let total = 0;
		for (const phase of blueprint.phases) total += phase.optionalRaiders ?? 0;
		return total;
	},
};
