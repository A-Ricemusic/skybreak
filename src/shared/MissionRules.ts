// Pure authoritative mission progression. Callers report observed controls and real kills;
// this module never creates targets, applies damage, or trusts a client result.
import { FlightMath, FlightState } from "./FlightMath";
import { GameConfig } from "./GameConfig";
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
	/** Mission 1: elapsed time the current teaching step began, and whether TGT was pressed during it. */
	stepSince: number;
	cycled: boolean;
	/** Mission 1: elapsed time the bandits may launch, a radio beat after the radar dies. */
	banditsDueAt?: number;
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
/** Required bandits before the mission moves on; Mission 2's ace is tracked separately (aceKilled) yet counts as one air kill. */
function requiredAirTarget(missionId: number): number {
	return missionId === 1 ? GameConfig.Campaign.Missions[1].RequiredAirKills : GameConfig.Campaign.Missions[2].RequiredAirKills - 1;
}
/** Every teaching step stays up at least this long so its prompt can be read. */
const TEACH_MINIMUM = 2.5;
/** Seconds between the radar kill (and SERA's call) and the bandits' arrival. */
const BANDIT_BEAT = 4;
function enter(state: MissionRuleState, phase: MissionPhase): void {
	state.phase = phase;
	state.stepSince = state.elapsed;
	state.cycled = false;
}
/**
 * Mission 1: a step whose action is done advances once its prompt has been up long enough. The
 * radar hit is latched (groundKills) the moment it lands, so a lock built during the target step
 * cannot skip the missile prompt; SERA's beat before the bandits starts when the step really ends.
 */
function advanceTutorial(state: MissionRuleState): void {
	if (state.outcome !== undefined || state.missionId !== 1) return;
	const dwelt = state.elapsed - state.stepSince >= TEACH_MINIMUM;
	if (state.phase === "tutorial_move" && dwelt && state.turnObserved >= MissionRules.MovementDuration && state.pitchObserved >= MissionRules.MovementDuration) enter(state, "tutorial_target");
	else if (state.phase === "tutorial_target" && dwelt && state.cycled) enter(state, "tutorial_missile");
	else if (state.phase === "tutorial_missile" && dwelt && state.groundKills > 0) {
		enter(state, "tutorial_bandits");
		state.banditsDueAt = state.elapsed + BANDIT_BEAT;
	}
}
export const MissionRules = {
	/** The sortie deadline in seconds (GameConfig.Campaign.MissionTimeLimit). */
	Duration: GameConfig.Campaign.MissionTimeLimit,
	/** Seconds of real turning and of real pitching the first teaching step needs. */
	MovementDuration: 3,
	TeachMinimum: TEACH_MINIMUM,
	BanditBeat: BANDIT_BEAT,
	LiveWarning: "Protection OFF now: impacts fatal. LOCK, fire; EVADE / F / B missiles.",
	PracticeReset: "Practice reset; progress saved. Release holds; opposite pitch levels.",
	NewState(missionId: number, startedAt: number): MissionRuleState {
		assert(missionId === 1 || missionId === 2, "Unknown mission");
		assert(finite(startedAt), "Mission clock must be finite");
		return {
			missionId, phase: missionId === 1 ? "tutorial_move" : "intercept", startedAt, elapsed: 0,
			turnObserved: 0, pitchObserved: 0, stepSince: 0, cycled: false, requiredAirKills: 0, optionalAirKills: 0,
			groundKills: 0, aceKilled: false, killedIds: new Set<string>(),
		};
	},
	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		// Absolute monotonic time, independent of fixed-step simulation catch-up caps.
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= MissionRules.Duration) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
		advanceTutorial(state);
	},
	ObserveControls(state: MissionRuleState, x: number, y: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || state.phase !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed = math.clamp(dt, 0, 0.1);
		if (math.abs(x) >= 0.2) state.turnObserved = math.min(MissionRules.MovementDuration, state.turnObserved + observed);
		if (math.abs(y) >= 0.2) state.pitchObserved = math.min(MissionRules.MovementDuration, state.pitchObserved + observed);
		advanceTutorial(state);
	},
	/** A real TGT press during the target step; the step advances once its prompt has been up 2.5 s. */
	CycleTarget(state: MissionRuleState, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome === undefined && state.phase === "tutorial_target") { state.cycled = true; advanceTutorial(state); }
	},
	/** Practice impacts restart the approach without erasing progress or changing selected speed.
	 * Protection includes the pre-bandit grace and ends exactly when bandits are due. */
	RecoverPractice(state: MissionRuleState, flight: FlightState): boolean {
		if (state.missionId !== 1 || state.outcome !== undefined
			|| (state.phase !== "tutorial_move" && state.phase !== "tutorial_target" && state.phase !== "tutorial_missile"
				&& !(state.phase === "tutorial_bandits" && state.banditsDueAt !== undefined && state.elapsed < state.banditsDueAt))) return false;
		flight.x = 0; flight.y = 800; flight.z = 500; flight.lean = 0;
		FlightMath.SetAttitude(flight, 0, 0);
		return true;
	},
	/** Mission 1: the radar is down and SERA's beat has played; the server may launch the bandits now. */
	BanditsDue(state: MissionRuleState): boolean {
		return state.missionId === 1 && state.outcome === undefined && state.phase === "tutorial_bandits"
			&& state.banditsDueAt !== undefined && state.elapsed >= state.banditsDueAt;
	},
	CanDamage(state: MissionRuleState, kind: TargetKind, required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		if (state.missionId === 1) {
			// One radar: once its hit is latched, nothing more is damageable until the bandits are up.
			return required && ((state.phase === "tutorial_missile" && kind === "ground" && state.groundKills === 0) || (state.phase === "tutorial_bandits" && kind === "air"));
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
			if (state.missionId === 1) advanceTutorial(state);
			else if (state.groundKills === GameConfig.Campaign.Missions[2].RequiredGroundKills) state.phase = "ace";
		} else if (kind === "ace") {
			state.aceKilled = true;
			finish(state, "won", "complete");
		} else if (required) {
			state.requiredAirKills += 1;
			if (state.requiredAirKills === requiredAirTarget(state.missionId)) {
				if (state.missionId === 1) finish(state, "won", "complete");
				else state.phase = "warehouses";
			}
		} else state.optionalAirKills += 1;
		return true;
	},
	TimeRemaining(state: MissionRuleState): number { return math.max(0, MissionRules.Duration - state.elapsed); },
	Objective(state: MissionRuleState): MissionObjective {
		const phase = state.phase;
		if (phase === "tutorial_move") return { objective: "Tap turn and pitch; release to hold, opposite input to level", objectiveProgress: math.floor(state.turnObserved + 1e-6) + math.floor(state.pitchObserved + 1e-6), objectiveTotal: MissionRules.MovementDuration * 2, tutorialStep: "move" };
		if (phase === "tutorial_target") return { objective: "Press TGT to select the practice target", objectiveProgress: state.cycled ? 1 : 0, objectiveTotal: 1, tutorialStep: "target" };
		if (phase === "tutorial_missile") return { objective: "Aim at the practice target, wait for lock, then fire a missile", objectiveProgress: state.groundKills, objectiveTotal: 1, tutorialStep: "missile" };
		if (phase === "tutorial_bandits" && !MissionRules.BanditsDue(state)) return { objective: "Protection ends when bandits arrive; prepare to fight", objectiveProgress: 0, objectiveTotal: 3, tutorialStep: "" };
		if (phase === "tutorial_bandits") return { objective: "Live flight: select a bandit, aim for LOCK, fire; EVADE incoming missiles", objectiveProgress: state.requiredAirKills, objectiveTotal: 3, tutorialStep: "" };
		if (phase === "intercept") return { objective: "Shoot down all three bandits", objectiveProgress: state.requiredAirKills, objectiveTotal: 3, tutorialStep: "" };
		if (phase === "warehouses") return { objective: "Destroy all five warehouses; raiders may chase you", objectiveProgress: state.groundKills, objectiveTotal: 5, tutorialStep: "" };
		return { objective: "Destroy the ace; his raiders are still dangerous", objectiveProgress: state.aceKilled ? 1 : 0, objectiveTotal: 1, tutorialStep: "" };
	},
};
