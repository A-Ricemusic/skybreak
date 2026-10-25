// Pure authoritative mission progression. Callers report observed controls and real kills;
// this module never creates targets, applies damage, or trusts a client result.
//
// Embers of Home preserves the exact tutorial contract of Mission 1 (observe
// pitch/turn, cycle target, destroy radar, down three bandits) and the Mission
// 2 contract (three required intercept, five warehouses with five optional
// pursuers, then an ace). Missions 3-27 execute a declarative phase sequence
// supplied by MissionCatalog.
import { MissionCatalog, PhaseDef, PhaseKind } from "./MissionCatalog";

export type MissionPhase = PhaseKind;
export type TargetKind = "air" | "ground" | "ace";
export type MissionReason = "complete" | "timeout" | "destroyed";
export interface MissionRuleState {
	missionId: number;
	phases: PhaseDef[];
	phaseIndex: number;
	/** Convenience accessor for the current phase name. */
	phase: MissionPhase;
	startedAt: number;
	elapsed: number;
	turnObserved: number;
	pitchObserved: number;
	requiredAirKills: number;
	optionalAirKills: number;
	groundKills: number;
	aceKilled: boolean;
	/** Air kills accumulated in the current required-air phase (resets on phase advance). */
	phaseAirKills: number;
	/** Ground kills accumulated in the current required-ground phase (resets on phase advance). */
	phaseGroundKills: number;
	/** Optional air kills accumulated in the current phase; capped by optionalAirCap. */
	phaseOptionalAirKills: number;
	/** Elapsed time at which the current phase started; used for survive phases. */
	phaseStartedAt: number;
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
function finite(value: number): boolean { return value === value && value > -math.huge && value < math.huge; }
function finish(state: MissionRuleState, outcome: "won" | "failed", reason: MissionReason): void {
	if (state.outcome !== undefined) return;
	state.outcome = outcome;
	state.reason = reason;
}

function phaseAt(state: MissionRuleState, index: number): PhaseDef | undefined {
	return state.phases[index];
}

function advancePhase(state: MissionRuleState): void {
	if (state.outcome !== undefined) return;
	const nextIndex = state.phaseIndex + 1;
	if (nextIndex >= state.phases.size()) {
		finish(state, "won", "complete");
		return;
	}
	state.phaseIndex = nextIndex;
	state.phase = state.phases[nextIndex].kind;
	state.phaseStartedAt = state.elapsed;
	state.phaseAirKills = 0;
	state.phaseGroundKills = 0;
	state.phaseOptionalAirKills = 0;
}

function tryAdvanceSurvive(state: MissionRuleState, phase: PhaseDef): void {
	if (phase.surviveSeconds === undefined || state.outcome !== undefined) return;
	if (state.elapsed - state.phaseStartedAt >= phase.surviveSeconds) advancePhase(state);
}

export const MissionRules = {
	Duration: 600,
	MovementDuration: 0.6,
	NewState(missionId: number, startedAt: number): MissionRuleState {
		assert(finite(startedAt), "Mission clock must be finite");
		const mission = MissionCatalog.Get(missionId);
		assert(mission !== undefined, "Unknown mission");
		const phases = mission.phases;
		assert(phases.size() > 0, "Mission must have at least one phase");
		return {
			missionId,
			phases,
			phaseIndex: 0,
			phase: phases[0].kind,
			startedAt,
			elapsed: 0,
			turnObserved: 0,
			pitchObserved: 0,
			requiredAirKills: 0,
			optionalAirKills: 0,
			groundKills: 0,
			aceKilled: false,
			phaseAirKills: 0,
			phaseGroundKills: 0,
			phaseOptionalAirKills: 0,
			phaseStartedAt: 0,
			killedIds: new Set<string>(),
		};
	},
	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		// Absolute monotonic time, independent of fixed-step simulation catch-up caps.
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= MissionRules.Duration) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
		else {
			const phase = phaseAt(state, state.phaseIndex);
			if (phase) tryAdvanceSurvive(state, phase);
		}
	},
	ObserveControls(state: MissionRuleState, x: number, y: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || state.phase !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed = math.clamp(dt, 0, 0.1);
		if (math.abs(x) >= 0.2) state.turnObserved = math.min(MissionRules.MovementDuration, state.turnObserved + observed);
		if (math.abs(y) >= 0.2) state.pitchObserved = math.min(MissionRules.MovementDuration, state.pitchObserved + observed);
		if (state.turnObserved >= MissionRules.MovementDuration && state.pitchObserved >= MissionRules.MovementDuration) advancePhase(state);
	},
	CycleTarget(state: MissionRuleState, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome === undefined && state.phase === "tutorial_target") advancePhase(state);
	},
	CanDamage(state: MissionRuleState, kind: TargetKind, required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		const phase = phaseAt(state, state.phaseIndex);
		if (!phase) return false;
		// Tutorial phases: hand-authored exact gates, preserved verbatim from v2.
		if (phase.kind === "tutorial_move" || phase.kind === "tutorial_target") return false;
		if (phase.kind === "tutorial_missile") return required && kind === "ground";
		if (phase.kind === "tutorial_bandits") return required && kind === "air";
		// Non-tutorial phases apply explicit per-phase rules.
		if (kind === "ace") return phase.requiresAce === true && required;
		if (kind === "ground") return required && phase.requiredGround !== undefined && state.phaseGroundKills < phase.requiredGround;
		// Air kills: required for phases with requiredAir; optional when phase caps it.
		if (required) return phase.requiredAir !== undefined && state.phaseAirKills < phase.requiredAir;
		return phase.optionalAirCap !== undefined && state.optionalAirKills < phase.optionalAirCap;
	},
	RecordKill(state: MissionRuleState, id: string, kind: TargetKind, required: boolean, now: number): boolean {
		MissionRules.Tick(state, now);
		if (id === "" || state.killedIds.has(id) || !MissionRules.CanDamage(state, kind, required)) return false;
		const phase = phaseAt(state, state.phaseIndex);
		if (!phase) return false;
		state.killedIds.add(id);
		if (kind === "ace") {
			state.aceKilled = true;
			// An ace kill advances past this phase (and typically completes the mission).
			advancePhase(state);
		} else if (kind === "ground") {
			state.groundKills += 1;
			state.phaseGroundKills += 1;
			if (phase.kind === "tutorial_missile") {
				// Preserve tutorial contract: missile kill advances to the bandit phase.
				advancePhase(state);
			} else if (phase.requiredGround !== undefined && state.phaseGroundKills >= phase.requiredGround) {
				// A phase that only requires ground kills completes with the last one.
				const needsAir = phase.requiredAir !== undefined && state.phaseAirKills < phase.requiredAir;
				const needsAce = phase.requiresAce === true && !state.aceKilled;
				if (!needsAir && !needsAce) advancePhase(state);
			}
		} else if (required) {
			state.requiredAirKills += 1;
			state.phaseAirKills += 1;
			if (phase.requiredAir !== undefined && state.phaseAirKills >= phase.requiredAir) {
				const needsGround = phase.requiredGround !== undefined && state.phaseGroundKills < phase.requiredGround;
				const needsAce = phase.requiresAce === true && !state.aceKilled;
				if (!needsGround && !needsAce) advancePhase(state);
			}
		} else {
			state.optionalAirKills += 1;
			state.phaseOptionalAirKills += 1;
		}
		return true;
	},
	TimeRemaining(state: MissionRuleState): number { return math.max(0, MissionRules.Duration - state.elapsed); },
	/** Returns the phase definition of the currently active phase, if any. */
	CurrentPhase(state: MissionRuleState): PhaseDef | undefined {
		return phaseAt(state, state.phaseIndex);
	},
	Objective(state: MissionRuleState): MissionObjective {
		const phase = phaseAt(state, state.phaseIndex);
		if (!phase) return { objective: "Return to menu", objectiveProgress: 0, objectiveTotal: 0, tutorialStep: "" };
		const tutorialStep = phase.tutorialStep ?? "";
		if (phase.kind === "tutorial_move") {
			const progress = (state.turnObserved >= MissionRules.MovementDuration ? 1 : 0) + (state.pitchObserved >= MissionRules.MovementDuration ? 1 : 0);
			return { objective: phase.objective, objectiveProgress: progress, objectiveTotal: 2, tutorialStep };
		}
		if (phase.kind === "tutorial_target") return { objective: phase.objective, objectiveProgress: 0, objectiveTotal: 1, tutorialStep };
		if (phase.kind === "tutorial_missile") return { objective: phase.objective, objectiveProgress: state.phaseGroundKills, objectiveTotal: 1, tutorialStep };
		if (phase.surviveSeconds !== undefined) {
			const elapsedPhase = math.max(0, math.min(phase.surviveSeconds, state.elapsed - state.phaseStartedAt));
			return { objective: phase.objective, objectiveProgress: math.floor(elapsedPhase), objectiveTotal: math.floor(phase.surviveSeconds), tutorialStep };
		}
		if (phase.requiresAce === true) {
			return { objective: phase.objective, objectiveProgress: state.aceKilled ? 1 : 0, objectiveTotal: 1, tutorialStep };
		}
		if (phase.requiredGround !== undefined) {
			return { objective: phase.objective, objectiveProgress: state.phaseGroundKills, objectiveTotal: phase.requiredGround, tutorialStep };
		}
		if (phase.requiredAir !== undefined) {
			return { objective: phase.objective, objectiveProgress: state.phaseAirKills, objectiveTotal: phase.requiredAir, tutorialStep };
		}
		return { objective: phase.objective, objectiveProgress: 0, objectiveTotal: 0, tutorialStep };
	},
};
