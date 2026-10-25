// Pure authoritative mission progression for Last Tide.
//
// Mission 1 preserves its original tutorial state machine (observe pitch/turn,
// then cycle target, then fire missile, then three bandits). Mission 2
// preserves its intercept → warehouses → ace progression and keeps five
// optional pursuers alive during the warehouse and ace phases. Missions 3-27
// consume a declarative phase list from MissionCatalog in order: each phase
// awaits `required` kills of the declared kind before advancing, while any
// optional count for an air phase persists as a secondary threat during
// subsequent phases, mirroring Mission 2's famous "five raiders" rule.
//
// This module never creates targets, applies damage, or trusts a client
// result. Callers report observed controls and server-validated kills.

import { getMission, isValidMissionId, MissionDefinition, MissionPhase } from "./MissionCatalog";

export type MissionPhase_LegacyName =
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	| "tutorial_bandits"
	| "intercept"
	| "warehouses"
	| "ace";

export type MissionPhaseString = MissionPhase_LegacyName | string;
export type TargetKind = "air" | "ground" | "ace";
export type MissionReason = "complete" | "timeout" | "destroyed";

export interface MissionRuleState {
	missionId: number;
	phase: MissionPhaseString;
	/** Zero-based index into the mission's catalog phases; -1 for the Mission 1 tutorial sequence. */
	phaseIndex: number;
	/** Required kills remaining in the current phase (missions 3-27 use this). */
	phasePending: number;
	/** Completed navigation gates or elapsed hold seconds in the current phase. */
	phaseProgress: number;
	/** Optional kills available alongside the current phase. */
	phaseOptional: number;
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

/** Classifies a Mission 3-27 phase string ("air_0", "ground_1", "ace_2"). */
function phasePrefix(state: MissionRuleState): MissionPhase["kind"] | undefined {
	const phase = state.phase;
	if (phase === "intercept") return "air";
	if (phase === "warehouses") return "ground";
	if (phase === "ace") return "ace";
	const underscore = phase.find("_")[0];
	if (underscore === undefined) return undefined;
	const kind = phase.sub(1, underscore - 1);
	if (kind === "air" || kind === "ground" || kind === "ace" || kind === "nav" || kind === "hold") return kind;
	return undefined;
}

function buildPhaseString(kind: Exclude<MissionPhase["kind"], "tutorial">, index: number): string {
	return `${kind}_${index}`;
}

function configureGenericPhase(state: MissionRuleState, mission: MissionDefinition, index: number): void {
	const phase = mission.phases[index];
	if (phase === undefined) {
		finish(state, "won", "complete");
		return;
	}
	state.phaseIndex = index;
	state.phasePending = phase.required;
	state.phaseProgress = 0;
	// Optional pursuers survive phase transitions until destroyed.
	state.phaseOptional += phase.optional ?? 0;
	if (phase.kind === "tutorial") {
		// A tutorial phase outside Mission 1 would be a catalog authoring error.
		// Treat it as a no-op auto-advance for safety.
		configureGenericPhase(state, mission, index + 1);
		return;
	}
	state.phase = buildPhaseString(phase.kind, index);
}

export const MissionRules = {
	Duration: 600,
	MovementDuration: 0.6,

	NewState(missionId: number, startedAt: number): MissionRuleState {
		assert(isValidMissionId(missionId), "Unknown mission");
		assert(finite(startedAt), "Mission clock must be finite");
		const state: MissionRuleState = {
			missionId,
			phase: missionId === 1 ? "tutorial_move" : missionId === 2 ? "intercept" : "",
			phaseIndex: missionId === 1 ? -1 : 0,
			phasePending: 0,
			phaseProgress: 0,
			phaseOptional: 0,
			startedAt,
			elapsed: 0,
			turnObserved: 0,
			pitchObserved: 0,
			requiredAirKills: 0,
			optionalAirKills: 0,
			groundKills: 0,
			aceKilled: false,
			killedIds: new Set<string>(),
		};
		if (missionId === 2) {
			state.phasePending = 3;
			state.phaseOptional = 0;
		} else if (missionId >= 3) {
			const mission = getMission(missionId);
			configureGenericPhase(state, mission, 0);
		}
		return state;
	},

	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= MissionRules.Duration) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
	},

	ObserveControls(state: MissionRuleState, x: number, y: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || state.phase !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed = math.clamp(dt, 0, 0.1);
		if (math.abs(x) >= 0.2) state.turnObserved = math.min(MissionRules.MovementDuration, state.turnObserved + observed);
		if (math.abs(y) >= 0.2) state.pitchObserved = math.min(MissionRules.MovementDuration, state.pitchObserved + observed);
		if (state.turnObserved >= MissionRules.MovementDuration && state.pitchObserved >= MissionRules.MovementDuration) state.phase = "tutorial_target";
	},

	CycleTarget(state: MissionRuleState, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome === undefined && state.phase === "tutorial_target") state.phase = "tutorial_missile";
	},

	CanDamage(state: MissionRuleState, kind: TargetKind, required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		if (state.missionId === 1) {
			return required && ((state.phase === "tutorial_missile" && kind === "ground") || (state.phase === "tutorial_bandits" && kind === "air"));
		}
		if (state.missionId === 2) {
			if (kind === "air") return required ? state.phase === "intercept" : state.optionalAirKills < 5 && (state.phase === "warehouses" || state.phase === "ace");
			if (kind === "ground") return required && state.phase === "warehouses";
			return required && state.phase === "ace";
		}
		// Missions 3-27 use the declarative phase sequence.
		const mission = getMission(state.missionId);
		const phase = mission.phases[state.phaseIndex];
		if (phase === undefined) return false;
		const prefix = phasePrefix(state);
		if (required) {
			if (kind !== prefix) return false;
			if (kind === "ace") return state.phasePending > 0;
			return state.phasePending > 0;
		}
		// Optional pursuers may accompany combat or timed-defense phases.
		if (kind !== "air") return false;
		if ((phase.optional ?? 0) > 0) return state.phaseOptional > 0;
		// Air pursuers from earlier phases survive into later ones:
		// let the optional pool continue to accept kills until the mission ends.
		return state.phaseOptional > 0;
	},

	RecordKill(state: MissionRuleState, id: string, kind: TargetKind, required: boolean, now: number): boolean {
		MissionRules.Tick(state, now);
		if (id === "" || state.killedIds.has(id) || !MissionRules.CanDamage(state, kind, required)) return false;
		state.killedIds.add(id);
		if (state.missionId === 1) {
			if (kind === "ground") {
				state.groundKills += 1;
				state.phase = "tutorial_bandits";
			} else if (required) {
				state.requiredAirKills += 1;
				if (state.requiredAirKills === 3) finish(state, "won", "complete");
			}
			return true;
		}
		if (state.missionId === 2) {
			if (kind === "ground") {
				state.groundKills += 1;
				if (state.groundKills === 5) state.phase = "ace";
			} else if (kind === "ace") {
				state.aceKilled = true;
				finish(state, "won", "complete");
			} else if (required) {
				state.requiredAirKills += 1;
				if (state.requiredAirKills === 3) state.phase = "warehouses";
			} else {
				state.optionalAirKills += 1;
			}
			return true;
		}
		// Missions 3-27 generic phase progression.
		const mission = getMission(state.missionId);
		if (required) {
			state.phasePending = math.max(0, state.phasePending - 1);
			if (kind === "air") state.requiredAirKills += 1;
			else if (kind === "ground") state.groundKills += 1;
			else if (kind === "ace") state.aceKilled = true;
			if (state.phasePending === 0) {
				const nextIndex = state.phaseIndex + 1;
				if (nextIndex >= mission.phases.size()) finish(state, "won", "complete");
				else configureGenericPhase(state, mission, nextIndex);
			}
		} else {
			state.optionalAirKills += 1;
			state.phaseOptional = math.max(0, state.phaseOptional - 1);
		}
		return true;
	},

	/**
	 * Advances a non-combat objective from server-observed flight state. Clients
	 * never supply this value. Navigation advances by one reached gate; hold
	 * phases advance by fixed-step seconds while the aircraft remains alive.
	 */
	AdvanceObjective(state: MissionRuleState, kind: "nav" | "hold", amount: number, now: number): boolean {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || !finite(amount) || amount <= 0 || state.missionId < 3) return false;
		const mission = getMission(state.missionId);
		const phase = mission.phases[state.phaseIndex];
		if (phase === undefined || phase.kind !== kind || phasePrefix(state) !== kind || state.phasePending <= 0) return false;
		const accepted = math.min(amount, state.phasePending);
		state.phasePending = math.max(0, state.phasePending - accepted);
		state.phaseProgress = math.min(phase.required, state.phaseProgress + accepted);
		if (state.phasePending <= 0.0001) {
			const nextIndex = state.phaseIndex + 1;
			if (nextIndex >= mission.phases.size()) finish(state, "won", "complete");
			else configureGenericPhase(state, mission, nextIndex);
		}
		return true;
	},

	TimeRemaining(state: MissionRuleState): number {
		return math.max(0, MissionRules.Duration - state.elapsed);
	},

	Objective(state: MissionRuleState): MissionObjective {
		const phase = state.phase;
		if (phase === "tutorial_move") return {
			objective: "Turn and pitch using the flight controls",
			objectiveProgress: (state.turnObserved >= MissionRules.MovementDuration ? 1 : 0) + (state.pitchObserved >= MissionRules.MovementDuration ? 1 : 0),
			objectiveTotal: 2,
			tutorialStep: "move",
		};
		if (phase === "tutorial_target") return {
			objective: "Cycle target to select the practice target",
			objectiveProgress: 0,
			objectiveTotal: 1,
			tutorialStep: "target",
		};
		if (phase === "tutorial_missile") return {
			objective: "Aim at the practice target, wait for lock, then fire a missile",
			objectiveProgress: state.groundKills,
			objectiveTotal: 1,
			tutorialStep: "missile",
		};
		if (phase === "tutorial_bandits" || phase === "intercept") return {
			objective: "Destroy all three required bandits",
			objectiveProgress: state.requiredAirKills,
			objectiveTotal: 3,
			tutorialStep: "",
		};
		if (phase === "warehouses") return {
			objective: "Destroy all five warehouses; fighters are optional threats",
			objectiveProgress: state.groundKills,
			objectiveTotal: 5,
			tutorialStep: "",
		};
		if (phase === "ace" && state.missionId === 2) return {
			objective: "Destroy the ace; surviving fighters remain dangerous",
			objectiveProgress: state.aceKilled ? 1 : 0,
			objectiveTotal: 1,
			tutorialStep: "",
		};
		// Missions 3-27.
		if (state.missionId >= 3) {
			const mission = getMission(state.missionId);
			const current = mission.phases[state.phaseIndex] as MissionPhase | undefined;
			if (current === undefined) {
				return {
					objective: "Return to base",
					objectiveProgress: 1,
					objectiveTotal: 1,
					tutorialStep: "",
				};
			}
			const total = current.required;
			const rawProgress = current.kind === "nav" || current.kind === "hold" ? state.phaseProgress : total - state.phasePending;
			const progress = math.clamp(rawProgress, 0, total);
			return {
				objective: current.label,
				objectiveProgress: current.kind === "hold" ? math.floor(progress) : progress,
				objectiveTotal: total,
				tutorialStep: "",
			};
		}
		return {
			objective: "Complete the mission",
			objectiveProgress: 0,
			objectiveTotal: 1,
			tutorialStep: "",
		};
	},
};
