// Read-only views of a CombatSession used by the combat loop, telemetry and
// settlement: kill tallies, outcome, objective text, ownership and geometry
// helpers. No Instances are created and nothing here mutates the world.
import * as FinaleDuelRuntime from "./FinaleDuelRuntime";
import { AlliedRules } from "../shared/AlliedRules";
import type { MissionReason } from "../shared/OutcomeReason";
import { CombatSession, Enemy, TargetKind } from "./CombatSession";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { recordScoredKill } from "./SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { AceRules } from "../shared/AceRules";

/** Authoritative simulation step; every session advances by this much per sub-step. */
export const FIXED_STEP = 1 / 30;

export function sessionAct(session: CombatSession): 1 | 2 | 3 {
	return session.missionId <= 2 ? 1 : session.blueprint!.act;
}

/** The drawn jet: the attitude quaternion plus the cosmetic turn lean (same as the client's frameFor). */
export function frameFor(state: FlightState): CFrame {
	const [qx, qy, qz, qw] = FlightMath.Visual(state);
	return new CFrame(state.x, state.y, state.z, qx, qy, qz, qw);
}

export function positionFor(state: FlightState): Vector3 { return new Vector3(state.x, state.y, state.z); }

export function directionFor(state: FlightState): Vector3 {
	const [x, y, z] = FlightMath.ForwardOf(state);
	return new Vector3(x, y, z);
}

/** Horizontal side axis of the player's jet: the nose's right-hand perpendicular, or the wings when the nose is vertical. */
export function lateralFor(state: FlightState, forward: Vector3): Vector3 {
	const side = new Vector3(-forward.Z, 0, forward.X);
	if (side.Magnitude > 0.05) return side;
	const [x, , z] = FlightMath.RightOf(state);
	return new Vector3(x, 0, z).mul(0.05 / math.max(math.sqrt(x * x + z * z), 1e-3));
}

export function unitOr(vector: Vector3, fallback: Vector3): Vector3 { return vector.Magnitude > 0.01 ? vector.Unit : fallback; }

export function point(vector: Vector3): { x: number; y: number; z: number } { return { x: vector.X, y: vector.Y, z: vector.Z }; }

export function ownsEnemy(session: CombatSession, enemy: Enemy | undefined): enemy is Enemy {
	return enemy !== undefined && FinaleDuelRuntime.finaleTargetAllowed(session,enemy) && enemy.typedGround?.type !== "wreck" && AlliedRules.PlayerTarget(enemy) && enemy.model.Parent === session.folder;
}

export function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}

export function sessionTotalRequired(session: CombatSession): number {
	// Required air + required ground + ace = all required destructions.
	const bp = session.blueprint!;
	return MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp);
}

/** Required destructions so far: bandits, couriers, the ace and ground targets (never raiders). */
export function sessionRequiredKills(session: CombatSession): number {
	const state = session.blueprintState;
	if (!state) return 0;
	const ground = state.requiredGroundKills;
	return state.requiredAirKills + (state.aceKilled ? 1 : 0) + ground;
}

/** Every destruction, air and ground, required or optional. */
export function sessionAllKills(session: CombatSession): number {
	return sessionRequiredKills(session) + (session.blueprintState?.optionalAirKills ?? 0) + (session.blueprintState?.optionalGroundKills ?? 0);
}

/** Sync elapsed from the authoritative runner. */
export function syncElapsed(session: CombatSession): void {
	if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
}

export function sessionGroundKills(session: CombatSession): number {
	return (session.blueprintState?.requiredGroundKills ?? 0) + (session.blueprintState?.optionalGroundKills ?? 0);
}

export function sessionCanDamage(session: CombatSession, kind: TargetKind, required: boolean): boolean {
	if (session.blueprintState) {
		const stateKind = kind === "ace" ? "ace" : kind;
		return BlueprintRunner.CanDamage(session.blueprintState, stateKind, required);
	}
	return false;
}

export function sessionRecordKill(session: CombatSession, id: string, kind: TargetKind, required: boolean, now: number, role?: string, breakdownRole?: string): boolean {
	if (session.blueprintState) return recordScoredKill(session.blueprintState, session.targetScore, id, kind, required, now, role, breakdownRole);
	return false;
}

export function sessionTick(session: CombatSession, now: number, health: number): void {
	if (session.blueprintState) { session.blueprintState.score=session.targetScore.Total(); BlueprintRunner.Tick(session.blueprintState, now, health); }
}

export function sessionOutcome(session: CombatSession): "won" | "failed" | undefined {
	return session.crashReason !== undefined ? "failed" : session.blueprintState?.outcome;
}

export function sessionReason(session: CombatSession): MissionReason | undefined {
	return session.crashReason ?? session.blueprintState?.reason;
}

export function sessionTimeRemaining(session: CombatSession): number {
	if (session.blueprintState) return BlueprintRunner.TimeRemaining(session.blueprintState);
	return 0;
}

export function sessionObjective(session: CombatSession): {
	phase: string;
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: string;
} {
	assert(session.blueprintState, "session must have blueprintState");
	const info = BlueprintRunner.Objective(session.blueprintState);
	return {
		phase: info.phase,
		objective: info.objective,
		objectiveProgress: info.objectiveProgress,
		objectiveTotal: info.objectiveTotal,
		tutorialStep: info.tutorialStep,
	};
}

/** Would a missile hurt `enemy` right now: owned, damageable this phase and, for an ace, not immune or held at a stage floor (strikeEnemy). */
export function canHurt(session: CombatSession, enemy: Enemy | undefined): boolean {
	return ownsEnemy(session, enemy) && sessionCanDamage(session, enemy.kind, enemy.required)
		&& (enemy.aceState === undefined || AceRules.CanHurt(enemy.aceState, enemy.health, enemy.maxHealth, session.elapsed));
}
