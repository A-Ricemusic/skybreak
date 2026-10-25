// Pure authoritative mission progression. Callers report observed controls and real kills;
// this module never creates targets, applies damage, or trusts a client result.
//
// Aurora Line generalization: a mission is a chain of ObjectiveStep entries from the
// AuroraLineManifest. Mission 01 and Mission 02 are preserved bit-identical. All of
// the following remain publicly accessible so the preserved tests continue to pass:
//   - "tutorial_move", "tutorial_target", "tutorial_missile", "tutorial_bandits",
//     "intercept", "warehouses", "ace" phase names
//   - MovementDuration = 0.6
//   - Duration = 600
//   - the same Objective() strings for every reachable M1/M2 phase

import { AuroraLineManifest, MissionPlan, ObjectiveStep } from "./AuroraLineManifest";

export type MissionPhase =
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	| "tutorial_bandits"
	| "intercept"
	| "warehouses"
	| "ace"
	| "escort"
	| "protect"
	| "strike"
	| "intercept_wave" // required-kills step after the first for mission 03+
	| "complete";
export type TargetKind = "air" | "ground" | "ace";
export type MissionReason = "complete" | "timeout" | "destroyed";

export interface MissionRuleState {
	missionId: number;
	phase: MissionPhase;
	startedAt: number;
	elapsed: number;
	turnObserved: number;
	pitchObserved: number;
	requiredAirKills: number;
	optionalAirKills: number;
	groundKills: number;
	aceKilled: boolean;
	killedIds: Set<string>;
	outcome?: "won" | "failed";
	reason?: MissionReason;
	// Aurora Line generalization: step index into the mission plan steps and
	// progress toward the current step. For the preserved M1/M2 missions these
	// are a shadow of (phase, groundKills, requiredAirKills, aceKilled).
	stepIndex: number;
	stepProgress: number;
}
export interface MissionObjective {
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: "move" | "target" | "missile" | "";
}
function finite(value: number): boolean {
	return value === value && value > -math.huge && value < math.huge;
}
function finish(state: MissionRuleState, outcome: "won" | "failed", reason: MissionReason): void {
	if (state.outcome !== undefined) return;
	state.outcome = outcome;
	state.reason = reason;
}

function plan(state: MissionRuleState): MissionPlan {
	return AuroraLineManifest.GetPlan(state.missionId);
}

function currentStep(state: MissionRuleState): ObjectiveStep | undefined {
	return plan(state).steps[state.stepIndex];
}

function phaseForStep(step: ObjectiveStep | undefined, missionId: number, stepIndex: number): MissionPhase {
	if (step === undefined) return "complete";
	if (step.kind === "tutorial_move") return "tutorial_move";
	if (step.kind === "tutorial_target") return "tutorial_target";
	if (step.kind === "tutorial_missile") return "tutorial_missile";
	if (step.kind === "ace") return "ace";
	if (step.kind === "strike") {
		// Mission 02 keeps the preserved phase name "warehouses".
		return missionId === 2 ? "warehouses" : "strike";
	}
	if (step.kind === "intercept") {
		// Mission 01: after tutorial_missile the preserved phase is tutorial_bandits.
		if (missionId === 1 && stepIndex > 0) return "tutorial_bandits";
		// Mission 02: the first intercept step is preserved as "intercept".
		if (missionId === 2 && stepIndex === 0) return "intercept";
		// Mission 03+: the first intercept step is "intercept"; later ones get a
		// distinct name so UI can disambiguate from a second wave.
		return stepIndex === 0 ? "intercept" : "intercept_wave";
	}
	if (step.kind === "escort") return "escort";
	return "protect";
}

function advanceStep(state: MissionRuleState): void {
	if (state.outcome !== undefined) return;
	state.stepIndex += 1;
	state.stepProgress = 0;
	const step = currentStep(state);
	state.phase = phaseForStep(step, state.missionId, state.stepIndex);
	if (step === undefined) {
		finish(state, "won", "complete");
	}
}

export const MissionRules = {
	Duration: 600,
	MovementDuration: 0.6,
	NewState(missionId: number, startedAt: number): MissionRuleState {
		const target = AuroraLineManifest.GetPlan(missionId);
		assert(target !== undefined, "Unknown mission");
		assert(finite(startedAt), "Mission clock must be finite");
		const firstStep = target.steps[0];
		const state: MissionRuleState = {
			missionId,
			phase: phaseForStep(firstStep, missionId, 0),
			startedAt,
			elapsed: 0,
			turnObserved: 0,
			pitchObserved: 0,
			requiredAirKills: 0,
			optionalAirKills: 0,
			groundKills: 0,
			aceKilled: false,
			killedIds: new Set<string>(),
			stepIndex: 0,
			stepProgress: 0,
		};
		return state;
	},
	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= MissionRules.Duration) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
	},
	Fail(state: MissionRuleState, now: number, reason: MissionReason = "destroyed"): void {
		MissionRules.Tick(state, now);
		if (state.outcome === undefined) finish(state, "failed", reason);
	},
	ObserveControls(state: MissionRuleState, x: number, y: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || state.phase !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed = math.clamp(dt, 0, 0.1);
		if (math.abs(x) >= 0.2) state.turnObserved = math.min(MissionRules.MovementDuration, state.turnObserved + observed);
		if (math.abs(y) >= 0.2) state.pitchObserved = math.min(MissionRules.MovementDuration, state.pitchObserved + observed);
		if (state.turnObserved >= MissionRules.MovementDuration && state.pitchObserved >= MissionRules.MovementDuration) {
			advanceStep(state);
		}
	},
	CycleTarget(state: MissionRuleState, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined) return;
		if (state.phase === "tutorial_target") advanceStep(state);
	},
	CanDamage(state: MissionRuleState, kind: TargetKind, required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		const step = currentStep(state);
		if (step === undefined) return false;
		// Mission 01 preserved: no optional kills at all.
		if (state.missionId === 1) {
			return required && (
				(state.phase === "tutorial_missile" && kind === "ground") ||
				(state.phase === "tutorial_bandits" && kind === "air")
			);
		}
		// Mission 02 preserved: ground only during warehouses, optional air during warehouses+ace.
		if (state.missionId === 2) {
			if (kind === "air") {
				if (required) return state.phase === "intercept";
				return state.optionalAirKills < 5 && (state.phase === "warehouses" || state.phase === "ace");
			}
			if (kind === "ground") return required && state.phase === "warehouses";
			return required && state.phase === "ace";
		}
		// Mission 03+: optional kills are not permitted (no optional raider fleet).
		if (!required) return false;
		if (kind === "air") return step.kind === "intercept" || step.kind === "escort" || step.kind === "protect";
		if (kind === "ground") return step.kind === "strike";
		return step.kind === "ace";
	},
	RecordKill(state: MissionRuleState, id: string, kind: TargetKind, required: boolean, now: number): boolean {
		MissionRules.Tick(state, now);
		if (id === "" || state.killedIds.has(id) || !MissionRules.CanDamage(state, kind, required)) return false;
		state.killedIds.add(id);
		const step = currentStep(state);
		if (step === undefined) return false;
		if (state.missionId === 1) {
			// Preserve the two-mission tutorial contract exactly.
			if (kind === "ground") {
				state.groundKills += 1;
				advanceStep(state); // tutorial_missile -> tutorial_bandits
			} else if (required) {
				state.requiredAirKills += 1;
				if (state.requiredAirKills === 3) {
					advanceStep(state); // tutorial_bandits -> complete
				}
			}
			return true;
		}
		if (state.missionId === 2) {
			// Preserve Iron Coast behavior exactly.
			if (kind === "ace") {
				state.aceKilled = true;
				finish(state, "won", "complete");
			} else if (kind === "ground") {
				state.groundKills += 1;
				if (state.groundKills === 5) advanceStep(state); // warehouses -> ace
			} else if (required) {
				state.requiredAirKills += 1;
				if (state.requiredAirKills === 3) advanceStep(state); // intercept -> warehouses
			} else {
				state.optionalAirKills += 1;
			}
			return true;
		}
		// Mission 03+: generalized progress on the current step.
		if (kind === "ace") {
			state.aceKilled = true;
			state.stepProgress = step.required;
			advanceStep(state); // may finish
			return true;
		}
		if (kind === "ground") state.groundKills += 1;
		else if (required) state.requiredAirKills += 1;
		state.stepProgress = math.min(step.required, state.stepProgress + 1);
		if (state.stepProgress >= step.required) advanceStep(state);
		return true;
	},
	TimeRemaining(state: MissionRuleState): number {
		return math.max(0, MissionRules.Duration - state.elapsed);
	},
	StepLabel(state: MissionRuleState): string {
		const step = currentStep(state);
		return step?.label ?? "";
	},
	Objective(state: MissionRuleState): MissionObjective {
		const phase = state.phase;
		if (phase === "tutorial_move") return {
			objective: "Turn and pitch using the flight controls",
			objectiveProgress: (state.turnObserved >= MissionRules.MovementDuration ? 1 : 0) + (state.pitchObserved >= MissionRules.MovementDuration ? 1 : 0),
			objectiveTotal: 2, tutorialStep: "move",
		};
		if (phase === "tutorial_target") return {
			objective: "Cycle target to select the practice target",
			objectiveProgress: 0, objectiveTotal: 1, tutorialStep: "target",
		};
		if (phase === "tutorial_missile") return {
			objective: "Aim at the practice target, wait for lock, then fire a missile",
			objectiveProgress: state.groundKills, objectiveTotal: 1, tutorialStep: "missile",
		};
		// Mission 01 preserved bandits phase.
		if (phase === "tutorial_bandits") return {
			objective: "Destroy all three required bandits",
			objectiveProgress: state.requiredAirKills, objectiveTotal: 3, tutorialStep: "",
		};
		// Mission 02 preserved intercept and warehouses labels.
		if (state.missionId === 2 && phase === "intercept") return {
			objective: "Destroy all three required bandits",
			objectiveProgress: state.requiredAirKills, objectiveTotal: 3, tutorialStep: "",
		};
		if (phase === "warehouses") return {
			objective: "Destroy all five warehouses; fighters are optional threats",
			objectiveProgress: state.groundKills, objectiveTotal: 5, tutorialStep: "",
		};
		if (phase === "ace" && state.missionId === 2) return {
			objective: "Destroy the ace; surviving fighters remain dangerous",
			objectiveProgress: state.aceKilled ? 1 : 0, objectiveTotal: 1, tutorialStep: "",
		};
		// Aurora Line (missions 03..27).
		const step = currentStep(state);
		if (step === undefined) return { objective: "Mission complete", objectiveProgress: 1, objectiveTotal: 1, tutorialStep: "" };
		return {
			objective: step.label,
			objectiveProgress: state.stepProgress,
			objectiveTotal: step.required,
			tutorialStep: "",
		};
	},
	CurrentStep(state: MissionRuleState): ObjectiveStep | undefined {
		return currentStep(state);
	},
	CurrentStepKind(state: MissionRuleState): ObjectiveStep["kind"] | undefined {
		return currentStep(state)?.kind;
	},
	TotalRequiredKills(missionId: number): number {
		const target = AuroraLineManifest.GetPlan(missionId);
		let total = 0;
		for (const step of target.steps) {
			if (step.kind === "intercept" || step.kind === "escort" || step.kind === "protect") total += step.required;
			else if (step.kind === "ace") total += 1;
		}
		return total;
	},
};
