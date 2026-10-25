import { MissionCatalog, MissionPhase as PhaseDefinition, PhaseKind } from "./MissionCatalog";

// Pure progression. Combat supplies observed controls/position/escort state and
// real server kills. Each phase has an index, including consecutive same kinds.
export type MissionPhase = PhaseKind | "tutorial_bandits" | "intercept" | "warehouses" | "ace";
export type TargetKind = "air" | "ground" | "ace";
export type MissionReason = "complete" | "timeout" | "destroyed" | "asset_lost";
export interface MissionRuleState {
	missionId: number; phase: MissionPhase; phaseIndex: number; phaseProgress: number; phaseStarted: number;
	startedAt: number; elapsed: number; turnObserved: number; pitchObserved: number;
	requiredAirKills: number; optionalAirKills: number; groundKills: number; aceKills: number; aceKilled: boolean;
	killedIds: Set<string>; outcome?: "won" | "failed"; reason?: MissionReason;
}
export interface MissionObjective {
	objective: string; objectiveProgress: number; objectiveTotal: number;
	tutorialStep: "move" | "target" | "missile" | "";
}
function finite(value: number): boolean { return value === value && math.abs(value) < math.huge; }
function finish(state: MissionRuleState, outcome: "won" | "failed", reason: MissionReason): void {
	if (state.outcome !== undefined) return;
	state.outcome = outcome; state.reason = reason;
}
function phaseName(id: number, index: number): MissionPhase {
	if (id === 1 && index === 3) return "tutorial_bandits";
	if (id === 2) return index === 0 ? "intercept" : index === 1 ? "warehouses" : "ace";
	return MissionCatalog.Get(id).phases[index].kind;
}
function advance(state: MissionRuleState): void {
	if (state.phaseIndex + 1 >= MissionCatalog.Get(state.missionId).phases.size()) { finish(state, "won", "complete"); return; }
	state.phaseIndex += 1; state.phaseProgress = 0; state.phaseStarted = state.elapsed;
	state.phase = phaseName(state.missionId, state.phaseIndex);
}
export const MissionRules = {
	Duration: 600,
	MovementDuration: 0.6,
	Phase(state: MissionRuleState): PhaseDefinition { return MissionCatalog.Get(state.missionId).phases[state.phaseIndex]; },
	NewState(missionId: number, startedAt: number): MissionRuleState {
		assert(MissionCatalog.IsValidId(missionId), "Unknown mission"); assert(finite(startedAt), "Mission clock must be finite");
		return { missionId, phase: phaseName(missionId, 0), phaseIndex: 0, phaseProgress: 0, phaseStarted: 0, startedAt, elapsed: 0,
			turnObserved: 0, pitchObserved: 0, requiredAirKills: 0, optionalAirKills: 0, groundKills: 0,
			aceKills: 0, aceKilled: false, killedIds: new Set<string>() };
	},
	Tick(state: MissionRuleState, now: number, health = 100): void {
		if (state.outcome !== undefined || !finite(now)) return;
		state.elapsed = math.max(state.elapsed, now - state.startedAt, 0);
		if (state.elapsed >= MissionRules.Duration) finish(state, "failed", "timeout");
		else if (finite(health) && health <= 0) finish(state, "failed", "destroyed");
		else if (MissionRules.Phase(state).kind === "survive_pursuit") {
			state.phaseProgress = state.elapsed - state.phaseStarted;
			if (state.phaseProgress >= (MissionRules.Phase(state).duration ?? 45)) advance(state);
		}
	},
	ObserveControls(state: MissionRuleState, x: number, y: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || state.phase !== "tutorial_move" || !finite(x) || !finite(y) || !finite(dt)) return;
		const observed = math.clamp(dt, 0, 0.1);
		if (math.abs(x) >= 0.2) state.turnObserved = math.min(0.6, state.turnObserved + observed);
		if (math.abs(y) >= 0.2) state.pitchObserved = math.min(0.6, state.pitchObserved + observed);
		if (state.turnObserved >= 0.6 && state.pitchObserved >= 0.6) advance(state);
	},
	CycleTarget(state: MissionRuleState, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome === undefined && state.phase === "tutorial_target") advance(state);
	},
	ObservePosition(state: MissionRuleState, x: number, y: number, z: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || !finite(x) || !finite(y) || !finite(z)) return;
		const phase = MissionRules.Phase(state);
		if (phase.kind !== "recon_route") return;
		const point = phase.route?.[state.phaseProgress];
		if (point && (x - point[0]) ** 2 + (y - point[1]) ** 2 + (z - point[2]) ** 2 <= 360 ** 2) {
			state.phaseProgress += 1;
			if (state.phaseProgress >= phase.route!.size()) advance(state);
		}
	},
	ObserveEscort(state: MissionRuleState, near: boolean, health: number, dt: number, now: number): void {
		MissionRules.Tick(state, now);
		if (state.outcome !== undefined || MissionRules.Phase(state).kind !== "escort_convoy") return;
		if (!finite(health) || health <= 0) { finish(state, "failed", "asset_lost"); return; }
		if (near && finite(dt)) state.phaseProgress += math.clamp(dt, 0, 0.1);
		if (state.phaseProgress >= (MissionRules.Phase(state).duration ?? 60)) advance(state);
	},
	LoseProtectedAsset(state: MissionRuleState): void { finish(state, "failed", "asset_lost"); },
	CanDamage(state: MissionRuleState, kind: TargetKind, required: boolean): boolean {
		if (state.outcome !== undefined) return false;
		const phase = MissionRules.Phase(state).kind;
		if (!required) {
			if (kind === "ground") return state.missionId >= 3;
			const spec = MissionCatalog.Get(state.missionId).optionalRaiders;
			return kind === "air" && state.optionalAirKills < (state.missionId === 2 ? spec?.count ?? 5 : 20)
				&& (state.missionId !== 2 || state.phaseIndex >= 1);
		}
		return kind === "ground" ? phase === "tutorial_missile" || phase === "destroy_ground_required"
			: kind === "ace" ? phase === "destroy_ace_required" : phase === "destroy_air_required" || phase === "intercept_bombers";
	},
	RecordKill(state: MissionRuleState, id: string, kind: TargetKind, required: boolean, now: number): boolean {
		MissionRules.Tick(state, now);
		if (id === "" || state.killedIds.has(id) || !MissionRules.CanDamage(state, kind, required)) return false;
		state.killedIds.add(id);
		if (kind === "ground") { if (required) state.groundKills += 1; }
		else if (kind === "ace") { state.aceKills += 1; state.aceKilled = true; }
		else if (required) state.requiredAirKills += 1;
		else state.optionalAirKills += 1;
		if (required) {
			state.phaseProgress += 1;
			if (state.phaseProgress >= (MissionRules.Phase(state).count ?? 1)) advance(state);
		}
		return true;
	},
	TimeRemaining(state: MissionRuleState): number { return math.max(0, 600 - state.elapsed); },
	Objective(state: MissionRuleState): MissionObjective {
		const phase = MissionRules.Phase(state);
		const tutorialStep = phase.kind === "tutorial_move" ? "move" : phase.kind === "tutorial_target" ? "target" : phase.kind === "tutorial_missile" ? "missile" : "";
		return { objective: phase.objective, tutorialStep,
			objectiveProgress: phase.kind === "tutorial_move" ? (state.turnObserved >= 0.6 ? 1 : 0) + (state.pitchObserved >= 0.6 ? 1 : 0) : state.phaseProgress,
			objectiveTotal: phase.kind === "tutorial_move" ? 2 : phase.count ?? phase.duration ?? 1 };
	},
};
