// Pure authoritative mission progression. Callers report observed controls and real kills;
// this module never creates targets, applies damage, or trusts a client result.
export type MissionPhase = "tutorial_move" | "tutorial_target" | "tutorial_missile" | "tutorial_bandits" | "intercept" | "warehouses" | "ace";
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
export const MissionRules = {
	Duration: 600,
	MovementDuration: 0.6,
	NewState(missionId: number, startedAt: number): MissionRuleState {
		assert(missionId === 1 || missionId === 2, "Unknown mission");
		assert(finite(startedAt), "Mission clock must be finite");
		return {
			missionId, phase: missionId === 1 ? "tutorial_move" : "intercept", startedAt, elapsed: 0,
			turnObserved: 0, pitchObserved: 0, requiredAirKills: 0, optionalAirKills: 0,
			groundKills: 0, aceKilled: false, killedIds: new Set<string>(),
		};
	},
	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		// Absolute monotonic time, independent of fixed-step simulation catch-up caps.
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
		if (kind === "air") return required ? state.phase === "intercept" : state.optionalAirKills < 5 && (state.phase === "warehouses" || state.phase === "ace");
		if (kind === "ground") return required && state.phase === "warehouses";
		return required && state.phase === "ace";
	},
	RecordKill(state: MissionRuleState, id: string, kind: TargetKind, required: boolean, now: number): boolean {
		MissionRules.Tick(state, now);
		if (id === "" || state.killedIds.has(id) || !MissionRules.CanDamage(state, kind, required)) return false;
		state.killedIds.add(id);
		if (kind === "ground") {
			state.groundKills += 1;
			if (state.missionId === 1) state.phase = "tutorial_bandits";
			else if (state.groundKills === 5) state.phase = "ace";
		} else if (kind === "ace") {
			state.aceKilled = true;
			finish(state, "won", "complete");
		} else if (required) {
			state.requiredAirKills += 1;
			if (state.requiredAirKills === 3) {
				if (state.missionId === 1) finish(state, "won", "complete");
				else state.phase = "warehouses";
			}
		} else state.optionalAirKills += 1;
		return true;
	},
	TimeRemaining(state: MissionRuleState): number { return math.max(0, MissionRules.Duration - state.elapsed); },
	Objective(state: MissionRuleState): MissionObjective {
		const phase = state.phase;
		if (phase === "tutorial_move") return { objective: "Turn and pitch using the flight controls", objectiveProgress: (state.turnObserved >= MissionRules.MovementDuration ? 1 : 0) + (state.pitchObserved >= MissionRules.MovementDuration ? 1 : 0), objectiveTotal: 2, tutorialStep: "move" };
		if (phase === "tutorial_target") return { objective: "Cycle target to select the practice target", objectiveProgress: 0, objectiveTotal: 1, tutorialStep: "target" };
		if (phase === "tutorial_missile") return { objective: "Aim at the practice target, wait for lock, then fire a missile", objectiveProgress: state.groundKills, objectiveTotal: 1, tutorialStep: "missile" };
		if (phase === "tutorial_bandits" || phase === "intercept") return { objective: "Destroy all three required bandits", objectiveProgress: state.requiredAirKills, objectiveTotal: 3, tutorialStep: "" };
		if (phase === "warehouses") return { objective: "Destroy all five warehouses; fighters are optional threats", objectiveProgress: state.groundKills, objectiveTotal: 5, tutorialStep: "" };
		return { objective: "Destroy the ace; surviving fighters remain dangerous", objectiveProgress: state.aceKilled ? 1 : 0, objectiveTotal: 1, tutorialStep: "" };
	},
};
