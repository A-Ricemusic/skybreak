import { LaunchStage } from "../shared/LaunchStage";
import { AlliedRules } from "../shared/AlliedRules";
import type { MissionReason } from "../shared/OutcomeReason";
import { createPhaseDirector, SpawnOptions } from "./PhaseDirector";
import { fixedRaiders } from "./PhaseDirectorRules";
import { CombatSession, Enemy, AirRole, TargetKind } from "./CombatSession";
export type { CombatSession } from "./CombatSession";
import { airspaceWarning, clampAirSpawn } from "../shared/WorldAirspace";
import { GameConfig } from "../shared/GameConfig";
import { CombatBalance } from "../shared/CombatBalance";
import { AircraftCollision } from "./AircraftCollision";
import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { AssetSelection } from "../shared/AssetSelection";
import { JetFactory } from "../shared/JetFactory";
import { BomberFactory } from "../shared/BomberFactory";
import { BomberRules } from "../shared/BomberRules";
import { recordAlliedKill, recordScoredKill } from "./SortieScore";
import { TargetScore, targetScoreStats } from "../shared/TargetScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { CombatEffectPacket, FinishedCallback, FlightInput, HudState, MissionLoading, MissionStats, Remotes } from "../shared/Types";
import { ExplosionKind } from "../shared/ExplosionFx";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { LoadingGate } from "../shared/LoadingGate";
import { countParts } from "../shared/MissionParts";
import { FireNotice, WeaponRules } from "../shared/WeaponRules";
import { SalvoCandidate, SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty, DifficultyKind, DifficultyKnob } from "../shared/Difficulty";
import { ThreatRules } from "../shared/ThreatRules";
import { EvadeRules } from "../shared/EvadeRules";
import { AceRules } from "../shared/AceRules";
import { WavePlan } from "../shared/WavePlan";
import { PauseRules, Settlement, SettlementHooks, StepGuard } from "../shared/SessionGuard";
import { MissionWorld } from "./MissionWorld";
import { ActorGrounding } from "./ActorGrounding";

const sessions = new Map<Player, CombatSession>();
const completing = new Set<Player>();
const connections: RBXScriptConnection[] = [];
let missionSerial = 0;
let buildingMission = false;
let missionRoot: Instance | undefined;
let missionState: RemoteEvent | undefined;
let flightStateRemote: UnreliableRemoteEvent | undefined;
let telemetryRemote: UnreliableRemoteEvent | undefined;
let combatEffectRemote: RemoteEvent | undefined;
let onFinished: FinishedCallback | undefined;
const FIXED_STEP = 1 / 30;
const MAX_MISSILES = WeaponRules.MaxMissiles;
const PLAYER_MISSILE_DAMAGE = SpecialWeapons.StandardDamage;
// Threat tuning indexed by act (1-3). Missions 1-2 use act 1. Every knob is a plain per-act array so the
// difficulty selector can multiply it in tuned() without touching the combat code. Missions 1-4 use GENTLE
// for the flight gate instead (one threat at a time, the slowest cadence).
//   hostileDamage   hull lost per hostile missile hit (aces add ACE_DAMAGE_BONUS).
//   windup          seconds a shooter shows MISSILE WARNING before launch.
//   flightGate      seconds between windup starts for a lone bandit. More live hostiles divide it
//                   (ThreatRules.FlightGate: +50% per extra hostile, up to flightDivisor), never below
//                   the 1.5 s global spacing, so five bandits really are more dangerous than one.
//   flightDivisor   the most a flight can divide flightGate by.
//   threatCap       most concurrent hostile threats (windups lit plus missiles in flight); scales with
//                   live hostiles (one per two) up to this. Aces are outside the cap and the gate.
//   banditReload    one bandit's own reload after it fires; aceReload is the ace's (its whole gate).
//   fireAimDot      nose dot a shooter needs on the player; straightRelax is subtracted while the stick is centered.
//   fireRange       [min, max] launch range for bandits.
//   banditHealth    required bandits: two missiles on Normal; Ace restores heavier flights. Raiders stay at RAIDER_HEALTH.
//   banditFlares    flares a required bandit carries (Act III: one).
//   lockBreakChance odds a bandit breaks out of a lock building inside 900 studs (once per 12 s).
//   aceFlares       flares an ace carries; each decoys every player missile within 260 studs for 2.5 s.
//   aceLockBreak    seconds between ace lock-break notches (x0.6 below a third of health).
//   aceStageSpeed   speed bonus an ace gains at each stage line.
//   aceSalvo        hostile missiles per ace launch.
//   missileTurn     hostile missile steering rate (aces add aceMissileTurn): Act I can be out-turned, Act III must be evaded.
//   missileSpeed    hostile missile speed; missileLife its flight time; missileFuse its proximity radius on the player.
//   breakChance     odds a bandit breaks against an inbound guided player missile (shares the 12 s break cooldown).
//   breakSeconds    how long a break lasts; breakTurn the bandit's steering rate while breaking.
const TUNING = {
	hostileDamage: CombatBalance.hostileDamage,
	windup: [2.4, 2.0, 1.7],
	flightGate: CombatBalance.flightGate,
	flightDivisor: CombatBalance.flightDivisor,
	threatCap: CombatBalance.threatCap,
	banditReload: [10, 7.5, 5.5],
	aceReload: CombatBalance.aceReload,
	fireAimDot: [0.65, 0.55, 0.45],
	straightRelax: [0.2, 0.25, 0.3],
	fireRange: [[450, 1700], [400, 1900], [350, 2100]],
	banditHealth: CombatBalance.banditHealth,
	banditFlares: [0, 0, 1],
	lockBreakChance: [0.5, 1, 1],
	aceFlares: [2, 3, 4],
	aceLockBreak: [7, 5.5, 4],
	aceStageSpeed: [30, 40, 55],
	aceSalvo: CombatBalance.aceSalvo,
	missileTurn: [1.6, 2.2, 2.8],
	aceMissileTurn: [0.6, 0.9, 1.2],
	missileSpeed: [580, 660, 740],
	missileLife: [7, 8, 9],
	missileFuse: [32, 40, 48],
	breakChance: [0.15, 0.4, 0.6],
	breakSeconds: [1.4, 1.6, 1.8],
	breakTurn: [3.5, 4.5, 5.5],
};
/** Missions 1-4 (the rim's first sorties): the slowest gate, a small divisor, one threat at a time and no lock breaks. */
const GENTLE = CombatBalance.gentle;
const RAIDER_HEALTH = 100;
const COURIER_HEALTH = 160;
/** Faster than cruise (255) but slower than full throttle (320): a chase you win by committing to it. */
const COURIER_SPEED = 275;
const ACE_DAMAGE_BONUS = 2;
/** Required waves arrive this far out (an approach before the lock); reinforcements from behind come a little closer. */
const SPAWN_FRONT: [number, number] = [2600, 3200];
const SPAWN_BEHIND: [number, number] = [2000, 2400];
/** A retired raider flies for the boundary this long before it is removed. */
const WITHDRAW_SECONDS = 4;
/** Ground-avoidance look-ahead for enemy jets, and how often each jet casts it. */
const AVOID_RANGE = 200;
const AVOID_EVERY = 3;
/** The evade barrel roll (cosmetic, and no new windups start during it); the client predicts the same roll. */
const EVADE_ROLL = FlightPrediction.EvadeRollSeconds;
const STATE_INTERVAL = 1 / 20;
const TELEMETRY_INTERVAL = 0.1;
/** FlightInput token bucket: the client sends at most 20 Hz; anything far above that is dropped. */
const INPUT_RATE = 60;
const INPUT_BURST = 10;
function sessionAct(session: CombatSession): 1 | 2 | 3 {
	return session.missionId <= 2 ? 1 : session.blueprint!.act;
}
// Which difficulty knob scales each act-indexed TUNING table; tables absent here are not scaled.
const TUNING_KNOBS = new Map<number[], DifficultyKnob>([
	[TUNING.hostileDamage, "hostileDamage"],
	[TUNING.windup, "windup"],
	[TUNING.flightGate, "hostileGate"],
	[TUNING.banditReload, "hostileGate"],
	[TUNING.aceReload, "aceGate"],
	[TUNING.flightDivisor, "flightDivisor"],
	[TUNING.threatCap, "threatCap"],
	[TUNING.missileTurn, "missileTurn"],
	[TUNING.aceMissileTurn, "missileTurn"],
	[TUNING.missileFuse, "missileTurn"],
	[TUNING.breakChance, "breakChance"],
	[TUNING.lockBreakChance, "breakChance"],
]);
/** The act's value from a TUNING table, scaled for the session's difficulty. */
function tuned(session: CombatSession, values: number[]): number {
	const value = values[sessionAct(session) - 1];
	const knob = TUNING_KNOBS.get(values);
	return knob === undefined ? value : Difficulty.Scale(session.difficulty, knob, value);
}
/** Missions 1-4 fire on the gentle gate. */
function gentle(session: CombatSession): boolean { return session.missionId <= GENTLE.lastMission; }
function remote<K extends keyof Remotes>(remotes: Remotes | Instance, name: K): Remotes[K] {
	if (typeIs(remotes, "Instance")) return remotes.WaitForChild(name) as Remotes[K];
	assert(remotes[name], `Missing combat remote: ${name}`);
	return remotes[name];
}
/** The drawn jet: the attitude quaternion plus the cosmetic turn lean (same as the client's frameFor). */
function frameFor(state: FlightState): CFrame {
	const [qx, qy, qz, qw] = FlightMath.Visual(state);
	return new CFrame(state.x, state.y, state.z, qx, qy, qz, qw);
}
function positionFor(state: FlightState): Vector3 { return new Vector3(state.x, state.y, state.z); }
function directionFor(state: FlightState): Vector3 {
	const [x, y, z] = FlightMath.ForwardOf(state);
	return new Vector3(x, y, z);
}
/** Horizontal side axis of the player's jet: the nose's right-hand perpendicular, or the wings when the nose is vertical. */
function lateralFor(state: FlightState, forward: Vector3): Vector3 {
	const side = new Vector3(-forward.Z, 0, forward.X);
	if (side.Magnitude > 0.05) return side;
	const [x, , z] = FlightMath.RightOf(state);
	return new Vector3(x, 0, z).mul(0.05 / math.max(math.sqrt(x * x + z * z), 1e-3));
}
function unitOr(vector: Vector3, fallback: Vector3): Vector3 { return vector.Magnitude > 0.01 ? vector.Unit : fallback; }
function point(vector: Vector3): { x: number; y: number; z: number } { return { x: vector.X, y: vector.Y, z: vector.Z }; }
function ownsEnemy(session: CombatSession, enemy: Enemy | undefined): enemy is Enemy {
	return enemy !== undefined && AlliedRules.PlayerTarget(enemy) && enemy.model.Parent === session.folder;
}
function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}

function sessionTotalRequired(session: CombatSession): number {
	// Required air + required ground + ace = all required destructions.
	const bp = session.blueprint!;
	return MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp);
}

/** Required destructions so far: bandits, couriers, the ace and ground targets (never raiders). */
function sessionRequiredKills(session: CombatSession): number {
	const state = session.blueprintState;
	if (!state) return 0;
	const ground = state.requiredGroundKills;
	return state.requiredAirKills + (state.aceKilled ? 1 : 0) + ground;
}

/** Every destruction, air and ground, required or optional. */
function sessionAllKills(session: CombatSession): number {
	return sessionRequiredKills(session) + (session.blueprintState?.optionalAirKills ?? 0);
}
/** Sync elapsed from the authoritative runner. */
function syncElapsed(session: CombatSession): void {
	if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
}

function sessionGroundKills(session: CombatSession): number {
	return session.blueprintState?.requiredGroundKills ?? 0;
}

function sessionCanDamage(session: CombatSession, kind: TargetKind, required: boolean): boolean {
	if (session.blueprintState) {
		const stateKind = kind === "ace" ? "ace" : kind;
		return BlueprintRunner.CanDamage(session.blueprintState, stateKind, required);
	}
	return false;
}

function sessionRecordKill(session: CombatSession, id: string, kind: TargetKind, required: boolean, now: number, role?: AirRole): boolean {
	if (session.blueprintState) return recordScoredKill(session.blueprintState, session.targetScore, id, kind, required, now, role);
	return false;
}

function sessionTick(session: CombatSession, now: number, health: number): void {
	if (session.blueprintState) BlueprintRunner.Tick(session.blueprintState, now, health);
}

function sessionOutcome(session: CombatSession): "won" | "failed" | undefined {
	return session.crashReason !== undefined ? "failed" : session.blueprintState?.outcome;
}

function sessionReason(session: CombatSession): MissionReason | undefined {
	return session.crashReason ?? session.blueprintState?.reason;
}

function sessionTimeRemaining(session: CombatSession): number {
	if (session.blueprintState) return BlueprintRunner.TimeRemaining(session.blueprintState);
	return 0;
}

function sessionObjective(session: CombatSession): {
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

function acquireTarget(session: CombatSession): void {
	let best: Enemy | undefined;
	let score = math.huge;
	// Required targets first, except an ace that has broken off to call its wing: its raiders come first then.
	const priority = (enemy: Enemy) => enemy.required && !(enemy.aceState !== undefined && !AceRules.Fights(enemy.aceState));
	let bestPriority = false;
	for (const enemy of session.enemies) {
		if (!ownsEnemy(session, enemy)) continue;
		const [distance, dot] = targetMetrics(session, enemy);
		const candidateScore = distance + (dot < 0 ? 5000 : (1 - dot) * 700);
		const first = priority(enemy);
		if (!best || (first && !bestPriority) || (first === bestPriority && candidateScore < score)) {
			best = enemy; score = candidateScore; bestPriority = first;
		}
	}
	session.target = best;
	session.lockProgress = 0;
}
function cycleTarget(session: CombatSession): void {
	const current = session.target === undefined ? -1 : session.enemies.indexOf(session.target);
	for (let offset = 1; offset <= session.enemies.size(); offset++) {
		const candidate = session.enemies[(current + offset) % session.enemies.size()];
		if (ownsEnemy(session, candidate)) {
			session.target = candidate; session.lockProgress = 0;
			// The Mission 1 tutorial watches the CycleTarget event.
			if (session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_target") {
				BlueprintRunner.CycleTarget(session.blueprintState, os.clock());
				phaseDirector.Apply(session);
			}
			return;
		}
	}
}
/** Would a missile hurt `enemy` right now: owned, damageable this phase and, for an ace, not immune or held at a stage floor (strikeEnemy). */
function canHurt(session: CombatSession, enemy: Enemy | undefined): boolean {
	return ownsEnemy(session, enemy) && sessionCanDamage(session, enemy.kind, enemy.required)
		&& (enemy.aceState === undefined || AceRules.CanHurt(enemy.aceState, enemy.health, enemy.maxHealth, session.elapsed));
}
/** Replicates canHurt as `Damageable`, only on change: the HUD boxes exactly these. */
function publishEnemyDamageable(session: CombatSession, enemy: Enemy): void {
	const damageable = canHurt(session, enemy);
	if (enemy.damageable === damageable) return;
	enemy.damageable = damageable;
	enemy.model.SetAttribute("Damageable", damageable);
}
function publishDamageable(session: CombatSession): void {
	for (const enemy of session.enemies) publishEnemyDamageable(session, enemy);
}
function sendTelemetry(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	publishDamageable(session);
	let incoming = false;
	let evadeThreat = false;
	let lockWarning = false;
	let incomingDistance = math.huge;
	for (const missile of session.projectiles) {
		if (!missile.hostile || missile.wingman !== undefined) continue;
		const range = missile.position.sub(positionFor(session.state)).Magnitude;
		incomingDistance = math.min(incomingDistance, range);
		if (range < 1800) incoming = true;
		if (EvadeRules.Decoys(range, (missile.life ?? 0) - missile.age)) evadeThreat = true;
	}
	// A windup is a lock warning, not a missile: evading now would waste the countermeasure.
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.windup > 0 && AlliedRules.WarnsPlayer(enemy.windupTarget)) { lockWarning = true; break; }
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	let distance = 0;
	if (target) { const [targetDistance] = targetMetrics(session, target); distance = targetDistance; }
	const objective = sessionObjective(session);
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	// Protected-actor health is a replicated attribute; 10 Hz here is plenty for the HUD.
	if (session.blueprintState && session.navigationActor?.Parent) session.navigationActor.SetAttribute("Health", session.blueprintState.protectedHealth);
	sendHud(session, objective, target, phase);
	session.telemetrySequence += 1;
	telemetryRemote!.FireClient(session.player, TelemetryCodec.Encode(session.telemetrySequence, {
		health: session.health, speed: session.state.speed, altitude: session.state.y,
		// The HUD tally counts required destructions only; raiders travel separately so it never reads 7/4.
		kills: sessionRequiredKills(session), total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown, evadeCooldown: EvadeRules.Cooldown(session.evade, session.evadeRemaining),
		lockProgress: session.lockProgress, incoming, lockWarning, evadeThreat,
		boundaryWarning: airspaceWarning(session.state.x, session.state.z, session.airspace),
		targetDamageable: target ? canHurt(session, target) : undefined,
		elapsed: session.elapsed, timeRemaining: sessionTimeRemaining(session),
		objectiveProgress: objective.objectiveProgress, objectiveTotal: objective.objectiveTotal,
		groundKills: sessionGroundKills(session), targetDistance: distance,
		targetHealth: target ? math.clamp(target.health / math.max(1, target.maxHealth), 0, 1) : undefined,
		protectedHealth: phase?.kind === "escort" || phase?.kind === "defend" ? session.blueprintState?.protectedHealth : undefined,
		specialCharges: session.special.charges, specialCooldown: session.special.cooldown, specialActive: session.special.active,
		aceKilled: session.blueprintState?.aceKilled ?? false,
		paused: PauseRules.Paused(session.pause),
		pauseAck: session.pauseAck,
		pauseRemaining: PauseRules.Remaining(session.pause, os.clock()),
		turnObserved: session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_move" ? session.blueprintState.turnObserved : undefined,
		pitchObserved: session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_move" ? session.blueprintState.pitchObserved : undefined,
		evadeCharges: session.evade.charges,
		optionalKills: session.blueprintState?.optionalAirKills ?? 0,
		incomingDistance: incomingDistance < math.huge ? incomingDistance : undefined,
	}));
}
/**
 * Text, the target Model and navigation go out on the reliable MissionState
 * remote, and only when one of them changed. That keeps the 10 Hz packet small,
 * never loses a radio line, and guarantees the target Model has replicated
 * before the reference to it arrives (reliable events are ordered with
 * instance replication; unreliable ones are not).
 */
function sendHud(session: CombatSession, objective: ReturnType<typeof sessionObjective>, target: Enemy | undefined, phase: MissionPhaseBlueprint | undefined): void {
	const nav = session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState) : undefined;
	const previous = session.hud;
	const targetKind = target ? (target.kind === "ground" ? "ground" : "air") : "";
	if (previous && previous.missionId === session.missionId && previous.phase === objective.phase && previous.objective === objective.objective
		&& previous.tutorialStep === objective.tutorialStep && previous.target === target?.model && previous.targetName === (target?.name ?? "")
		&& previous.targetKind === targetKind && previous.targetRequired === (target?.required ?? false)
		&& previous.navigationRadius === phase?.radius && previous.navigationCeiling === phase?.ceiling
		&& previous.radioSerial === session.radioSerial && previous.fireDeniedSerial === session.fireDeniedSerial && previous.special === session.special.kind
		// A moving escort point only re-sends after it travels 20 studs (the cue is a screen marker, not a hitbox).
		&& (nav ? previous.navigation !== undefined && math.abs(previous.navigation.X - nav.x) + math.abs(previous.navigation.Y - nav.y) + math.abs(previous.navigation.Z - nav.z) < 20 : previous.navigation === undefined)) return;
	const hud: HudState = {
		kind: "HudState", missionId: session.missionId, phase: objective.phase, objective: objective.objective, tutorialStep: objective.tutorialStep,
		target: target?.model, targetName: target?.name ?? "", targetKind, targetRequired: target?.required ?? false,
		navigation: nav ? new Vector3(nav.x, nav.y, nav.z) : undefined, navigationRadius: phase?.radius, navigationCeiling: phase?.ceiling,
		radio: session.radio, radioSerial: session.radioSerial, radioSeconds: session.radioSeconds, radioPriority: session.radioPriority,
		fireDenied: session.fireDenied, fireDeniedSerial: session.fireDeniedSerial, special: session.special.kind,
	};
	session.hud = hud;
	missionState!.FireClient(session.player, hud);
}
/** Only the reliable HudState (radio, FIRE refusals, target, objective), sent at once if anything in it changed. */
function sendHudNow(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	sendHud(session, sessionObjective(session), target, session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined);
}
/** 20 Hz authoritative flight state for the client's prediction (unreliable, ~100 bytes). */
function sendFlightState(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	session.stateSequence += 1;
	// Simulated time this state has run on the newest input. The client stamps each
	// input with the predicted time at which it starts applying it, so the matching
	// prediction is exactly echoedClientTime + hold, independent of either network leg.
	const hold = session.inputClientTime > 0 ? session.inputSteps * FIXED_STEP : 0;
	flightStateRemote!.FireClient(session.player, FlightPrediction.Encode(session.stateSequence, session.state, session.evadeRemaining, session.inputClientTime, hold));
}
/** Push a radio line to the HUD immediately (phase beats, chatter, ace stages, flares). */
function radio(session: CombatSession, text: string, seconds?: number, priority = false): void {
	session.radio = text;
	session.radioSerial += 1;
	session.radioSeconds = seconds;
	session.radioPriority = priority;
	// The line travels on HudState alone: the server keeps one radio slot, so it must go out now, but the 10 Hz numbers need not.
	if (session.active && sessions.get(session.player) === session) sendHudNow(session);
}
/** Tell the HUD why a FIRE press did nothing; the serial makes every repeated press visible. */
function denyFire(session: CombatSession, reason: FireNotice): void {
	session.fireDenied = reason;
	session.fireDeniedSerial = (session.fireDeniedSerial ?? 0) + 1;
	if (session.active && sessions.get(session.player) === session) sendHudNow(session);
}
/** Catalog phases completed by the one authoritative runner. */
function sessionCompletedPhases(session: CombatSession, _won: boolean): number | undefined {
 return session.blueprintState?.phaseIndex;
}
/** Cosmetic explosion, drawn by the client (src/client/CombatEffects.ts) so no effect parts replicate. */
function effect(session: CombatSession, kind: ExplosionKind, position: Vector3, extra?: Omit<CombatEffectPacket, "kind" | "position">): void {
	if (session.cleaned || session.player.Parent !== Players) return;
	combatEffectRemote?.FireClient(session.player, { kind, position, ...extra });
}
function restoreMenu(): void {
	if (sessions.size() > 0) return;
	const [ok, message] = pcall(() => MissionWorld.RestoreMenu());
	if (!ok) warn(`SKYBREAK menu restoration failed: ${tostring(message)}`);
}
function cleanupSession(session: CombatSession, restore = true): void {
	if (session.cleaned) return;
	session.cleaned = true;
	session.active = false;
	if (sessions.get(session.player) === session) {
		sessions.delete(session.player);
		if (session.characterRoot?.Parent) session.characterRoot.Anchored = session.wasAnchored ?? false;
		if (session.player.Parent === Players) session.player.ReplicationFocus = session.previousReplicationFocus;
	}
	session.folder.Destroy();
	session.projectiles.clear();
	session.enemies.clear();
	session.target = undefined;
	if (restore) restoreMenu();
}
/** Debrief counters handed to the completion callback. */
function missionStats(session: CombatSession, won: boolean): MissionStats {
	return {
		...targetScoreStats(session.targetScore, MissionCatalog.Scoring(session.missionId)),
		kills: session.kills,
		groundKills: sessionGroundKills(session),
		missionId: session.missionId,
		elapsed: session.elapsed,
		slot: session.slot,
		reason: sessionReason(session),
		completedPhases: sessionCompletedPhases(session, won),
		optionalKills: session.blueprintState?.optionalAirKills ?? 0,
		missilesFired: session.missilesFired,
		missileHits: session.missileHits,
		damageTaken: session.damageTaken,
		lowestHealth: session.lowestHealth,
		evades: session.evades,
		difficulty: session.difficulty,
	};
}
/** How this session settles (see Settlement): `won` is fixed when the sortie ends. */
function settlementHooks(session: CombatSession, won: boolean): SettlementHooks {
	const callback = onFinished;
	let stats: MissionStats | undefined;
	return {
		announce: () => {
			const crashed = session.crashReason !== undefined && session.crashReason !== "internal_error";
			if (!won && (session.health <= 0 || crashed)) effect(session, "player", positionFor(session.state), { velocity: directionFor(session.state).mul(session.state.speed) });
			// The result screen waits up to a few seconds for the save; say the outcome on the HUD right away.
			session.radio = won ? "MISSION ACCOMPLISHED · RETURN TO BASE" : "MISSION FAILED";
			session.radioSerial += 1;
			session.radioSeconds = 6;
			session.radioPriority = true;
			sendTelemetry(session);
		},
		schedule: (complete) => {
			stats = missionStats(session, won);
			// The player may leave (session cleaned) in the same frame; the result is still theirs to keep.
			task.defer(complete);
		},
		save: () => {
			assert(callback && stats, "No completion callback or result");
			callback(session.player, won, stats);
		},
		unsaved: () => {
			if (session.cleaned || session.player.Parent !== Players) return;
			missionState!.FireClient(session.player, stats
				? { kind: won ? "Completed" : "Failed", ...stats, saved: false }
				: { kind: won ? "Completed" : "Failed", slot: session.slot, missionId: session.missionId, kills: session.kills, elapsed: session.elapsed, reason: sessionReason(session) ?? "internal_error", saved: false });
		},
		teardown: () => cleanupSession(session),
		release: () => {
			// A teardown that threw part-way must not leave the session registered either.
			if (sessions.get(session.player) === session) { sessions.delete(session.player); restoreMenu(); }
			completing.delete(session.player);
		},
		warn: (message) => warn(`SKYBREAK mission ${session.missionId} settlement: ${message}`),
	};
}
function finish(session: CombatSession): void {
	if (!session.active || session.finished) return;
	const outcome = sessionOutcome(session);
	if (outcome === undefined) return;
	session.finished = true;
	session.active = false;
	completing.add(session.player);
	syncElapsed(session);
	// Every settlement step is protected: a throw anywhere still tears the world down and releases the player.
	session.settleHooks = settlementHooks(session, outcome === "won");
	Settlement.Begin(session.settlement, session.settleHooks);
}
function refreshSession(session: CombatSession, now: number): boolean {
	if (!session.active) return false;
	// The mission clock is monotonic; never tick it while the client is still loading or the sortie is paused.
	if (!LaunchStage.CanControl(session.loading !== undefined, session.launch, PauseRules.Paused(session.pause))) return true;
	sessionTick(session, now, session.health);
	syncElapsed(session);
	if (sessionOutcome(session) !== undefined) { finish(session); return false; }
	return true;
}
// Leaves loading for either player control or the opt-in scripted launch.
function beginPlay(session: CombatSession): void {
	if (!session.loading || !session.active || session.cleaned) return;
	session.loading = undefined;
	session.launch = LaunchStage.New(MissionCatalog.Start(session.missionId));
	const now = os.clock();
	if (session.blueprintState) BlueprintRunner.BeginControl(session.blueprintState, now);
	session.elapsed = 0;
	session.lastInput = now;
	session.telemetryTime = 0;
	session.stateTime = 0;
	session.hud = undefined; // the first HUD message after Started is always complete
	if (session.player.Parent !== Players) { cleanupSession(session); return; }
	missionState!.FireClient(session.player, { kind: "Started", slot: session.slot, missionId: session.missionId, aircraft: session.aircraft, airspace: session.airspace, difficulty: session.difficulty, initialState: session.blueprint?.start ? session.state : undefined, launchIntro: session.launch !== undefined });
	if (refreshSession(session, now)) { sendTelemetry(session); sendFlightState(session); }
}
function markTarget(session: CombatSession, enemy: Enemy): void {
	enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled && enemy.friendly !== true);
	enemy.model.SetAttribute("SkybreakFriendly", enemy.enabled && enemy.friendly === true);
	enemy.model.SetAttribute("SkybreakOwner", session.player.UserId);
	enemy.model.SetAttribute("TargetKind", enemy.kind === "ground" ? "ground" : "air");
	enemy.model.SetAttribute("RequiredTarget", enemy.enabled && enemy.required);
	enemy.model.SetAttribute("Health", enemy.health);
}
function activateGround(session: CombatSession, start=0, count=math.huge): void {
	for (const enemy of session.enemies) {
		if (enemy.kind !== "ground" || enemy.enabled || enemy.health <= 0 || (enemy.groundIndex ?? 0) < start || (enemy.groundIndex ?? 0) >= start+count) continue;
		enemy.enabled = true;
		for (const hidden of enemy.hiddenParts) { hidden.part.Transparency = hidden.transparency; hidden.part.CanQuery = hidden.part.GetAttribute("FlightSolid") === true; }
		enemy.hiddenParts.clear();
		markTarget(session, enemy);
	}
}
function attackWarning(model: Model): BillboardGui {
	const warning = new Instance("BillboardGui");
	warning.Name = "MissileWarning";
	warning.Adornee = model.PrimaryPart;
	warning.Size = UDim2.fromOffset(135, 28);
	warning.StudsOffsetWorldSpace = new Vector3(0, 18, 0);
	warning.MaxDistance = 2300;
	warning.AlwaysOnTop = true;
	warning.Enabled = false;
	warning.Parent = model;
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromScale(1, 1);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.GothamBold;
	label.TextSize = 16;
	label.TextColor3 = Color3.fromRGB(255, 130, 85);
	label.TextStrokeTransparency = 0.2;
	label.Text = "MISSILE WARNING";
	label.Parent = warning;
	return warning;
}
function spawnAir(session: CombatSession, count: number, role: AirRole, options: SpawnOptions = {}): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
	const act = sessionAct(session);
	const behaviour = Difficulty.Behaviour(session.difficulty);
	// Taken before the loop: the enemy list grows as each one spawns, which would give a group one side.
	const friendly = options.friendly === true;
	const sides = WavePlan.BracketSides(AlliedRules.AirSerial(friendly, session.spawnSerial, session.allySerial), count);
	for (let index = 0; index < count; index++) {
		let name: string;
		if (options.name !== undefined) name = options.name;
		else if (role === "bomber") name = "HEAVY BOMBER";
		else if (role === "escort") name = `ESCORT ${session.spawnSerial + 1}`;
		else if (role === "ace") name = session.blueprint?.aceName ?? "ACE";
		else if (role === "courier") name = session.missionId === 24 ? "FUEL TANKER" : "COURIER";
		else if (role === "bandit") { session.banditSerial += 1; name = string.format("BANDIT %02d", session.banditSerial); }
		else { session.raiderSerial += 1; name = string.format("RAIDER %02d", session.raiderSerial); }
		const model = role === BomberRules.Role.role ? BomberFactory.Create(name) : JetFactory.Create(name, options.friendly !== true, role === "ace" ? AssetSelection.LiveryForAce(options.name, session.blueprint?.aceName) : undefined);
		if (!session.active || session.folder.Parent === undefined) { model.Destroy(); return; }
		// The replicated model is hidden on the client behind a smoothed local clone; only the clone draws trails.
		JetFactory.SetTrails(model, false);
		// Required waves arrive 2600-3200 studs out and 60-75 degrees off the nose: an approach, then a turn
		// into the merge, and nothing is lockable on the first frame. Reinforcements come from the rear quarter.
		const side = sides[index];
		const [near, far] = options.behind ? SPAWN_BEHIND : SPAWN_FRONT;
		const angle = math.rad(options.behind ? 150 + math.random() * 20 : 60 + math.random() * 15);
		const distance = near + math.random() * (far - near);
		const offset = forward.mul(math.cos(angle) * distance).add(right.mul(math.sin(angle) * side * distance));
		const spawn = positionFor(session.state).add(offset);
		const px = clampAirSpawn(spawn.X, session.airspace), pz = clampAirSpawn(spawn.Z, session.airspace);
		let py = math.clamp(spawn.Y + 60 + math.random() * 60, 230, 900);
		// The former horizon is now flyable: clamping XZ alone could put an
		// arriving wave inside its ridges. Probe scenery + terrain, not actors,
		// around the hull and along the initial approach before exposing it.
		if (session.groundParams !== undefined) {
			const toward = unitOr(positionFor(session.state).sub(new Vector3(px, py, pz)), forward.mul(-1));
			for (const [dx, dz] of [[0, 0], [-80, 0], [80, 0], [0, -80], [0, 80], [toward.X * 200, toward.Z * 200]]) {
				const surface = ActorGrounding.Sample(px + dx, pz + dz, session.groundParams);
				if (surface !== undefined) py = math.max(py, surface.y + 120);
			}
		}
		const pose = options.pose;
		const position = pose ? new Vector3(pose.position.x, pose.position.y, pose.position.z) : new Vector3(px, py, pz);
		const direction = pose ? new Vector3(pose.facing.x, pose.facing.y, pose.facing.z) : role === "courier" && options.escape
			? unitOr(options.escape.sub(position), forward)
			: unitOr(positionFor(session.state).sub(position), forward.mul(-1));
		model.Parent = session.folder;
		model.PivotTo(CFrame.lookAt(position, position.add(direction)));
		const baseHealth = role === "bomber" ? 180 : role === "ace" ? options.aceHealth ?? 165 : role === "bandit" ? TUNING.banditHealth[act - 1] : role === "courier" ? COURIER_HEALTH : RAIDER_HEALTH;
		const health = math.floor(role === "bandit" ? Difficulty.BanditHealth(session.difficulty, act, baseHealth)
			: role === "ace" ? Difficulty.Scale(session.difficulty, "aceHealth", baseHealth)
			: Difficulty.SupportHealth(session.difficulty, baseHealth));
		// Bandits and couriers break close locks; the opening sorties stay gentle unless the level says every bandit breaks.
		const lockBreakChance = role === "ace" ? 0 : behaviour.banditsAlwaysBreak ? 1 : gentle(session) ? 0 : math.clamp(tuned(session, TUNING.lockBreakChance), 0, 1);
		const flares = role === "ace" ? TUNING.aceFlares[act - 1] : role === "bandit" ? math.max(TUNING.banditFlares[act - 1], behaviour.banditFlares) : 0;
		let serial: number;
		if (friendly) { session.allySerial += 1; serial = session.allySerial; }
		else { session.spawnSerial += 1; serial = session.spawnSerial; }
		const enemy: Enemy = {
			friendly: options.friendly, alliedAmmo: options.friendly ? AlliedRules.MissilesPerWingman : undefined,
			id: `${friendly ? "ally" : "air"}_${serial}_${missionSerial}`, name, model, health, maxHealth: health,
			position, direction, velocity: direction.mul(300), kind: role === "ace" ? "ace" : "air", required: options.optional !== true && role !== "raider" && role !== "escort", enabled: true,
			fireTimer: role === "courier" ? math.huge : 4 + index * 1.5, windup: 0, mode: "attack", modeTimer: 0, passDirection: direction, side,
			flares, flareTimer: 0, flareUntil: 0, speedBonus: 0, lockBreakTimer: TUNING.aceLockBreak[act - 1],
			breakTimer: 0, breakUntil: 0, lockBreakChance, role, bomberSlot: options.bomberSlot, escortSlot: options.escortSlot,
			aceState: role === "ace" ? AceRules.New() : undefined, escape: options.escape,
			hiddenParts: [], warning: attackWarning(model),
		};
		markTarget(session, enemy);
		(options.friendly ? session.allies : session.enemies).push(enemy);
		// Boxed from its first frame when it arrives mid-phase (queued waves, ace calls), not at the next telemetry tick.
		publishEnemyDamageable(session, enemy);
	}
}
/** Fighter budget only. Opt-in non-firing route bombers have six separate slots; withdrawing jets do not count. */
function liveAircraft(session: CombatSession): number {
	let count = 0;
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.kind !== "ground" && enemy.role !== "bomber") count += 1;
	return count;
}
/**
 * Phase change: every airborne enemy still alive breaks off and runs for the boundary for
 * WITHDRAW_SECONDS (untargetable, silent), and any missile chasing one is refunded. Dead
 * enemies are compacted out of the list so longer sorties never walk their corpses.
 */
function withdrawAirborne(session: CombatSession): void {
	const player = positionFor(session.state);
	for (const enemy of session.enemies) {
		if (enemy.kind === "ground" || enemy.health <= 0 || enemy.withdrawUntil !== undefined) continue;
		enemy.enabled = false; enemy.required = false; enemy.windup = 0; enemy.windupTarget = undefined;
		enemy.withdrawUntil = session.elapsed + WITHDRAW_SECONDS;
		if (enemy.warning) enemy.warning.Enabled = false;
		enemy.model.SetAttribute("AttackWarning", false);
		markTarget(session, enemy);
		const away = unitOr(new Vector3(enemy.position.X - player.X, 0, enemy.position.Z - player.Z), enemy.direction);
		enemy.passDirection = unitOr(away.add(new Vector3(0, 0.25, 0)), away);
		for (let index = session.projectiles.size() - 1; index >= 0; index--) {
			const missile = session.projectiles[index];
			if (missile.hostile || missile.target !== enemy) continue;
			if (!missile.special && !missile.allied) session.missiles = math.min(MAX_MISSILES, session.missiles + 1);
			missile.part.Destroy(); session.projectiles.remove(index);
		}
	}
	session.enemies = session.enemies.filter((enemy) => enemy.health > 0);
	if (session.target !== undefined && session.target.health <= 0) session.target = undefined;
}
function destroyEnemy(session: CombatSession, enemy: Enemy, allied = false): void {
	if (!ownsEnemy(session, enemy)) return;
	const accepted = allied && session.blueprintState && session.blueprint?.allies
		? recordAlliedKill(session.blueprintState, session.targetScore, session.alliedKills, session.blueprint.allies, enemy.id, enemy.kind, enemy.required, os.clock(), enemy.role)
		: sessionRecordKill(session, enemy.id, enemy.kind, enemy.required, os.clock(), enemy.role);
	syncElapsed(session);
	if (!accepted) { if (sessionOutcome(session) !== undefined) finish(session); return; }
	enemy.health = 0;
	enemy.enabled = false;
	enemy.model.SetAttribute("Health", 0);
	enemy.model.SetAttribute("SkybreakEnemy", false);
	enemy.model.SetAttribute("RequiredTarget", false);
	enemy.damageable = false;
	enemy.model.SetAttribute("Damageable", false);
	// Fired before Destroy so the model reference still resolves on the client (its visual becomes the wreck).
	if (enemy.kind === "ground") effect(session, "ground", enemy.position, { scale: math.clamp(enemy.model.GetExtentsSize().Magnitude / 60, 0.7, 2.2) });
	else effect(session, enemy.kind, enemy.position, { velocity: enemy.velocity, model: enemy.model });
	enemy.model.Destroy();
	// Kills count every destruction, air and ground, so the HUD tally matches sessionTotalRequired.
	if (session.blueprintState) session.kills = sessionAllKills(session);
	phaseDirector.Apply(session);
	// A kill can fill a raider cap or clear a hazard without a phase change.
	publishDamageable(session);
	if (session.target === enemy || !ownsEnemy(session, session.target)) acquireTarget(session);
	if (sessionOutcome(session) !== undefined) finish(session);
}
/** Hostile launch: `salvoIndex`/`salvoCount` fan an ace's second missile out so both cannot be dodged by one notch. */
function launchMissile(session: CombatSession, hostile: boolean, enemy?: Enemy, salvoIndex = 0, salvoCount = 1): void {
	let position: Vector3;
	let direction: Vector3;
	let target: Enemy | undefined;
	let ace = false;
	let damage = 0;
	if (hostile) {
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") return;
		position = enemy.position.add(enemy.direction.mul(18));
		direction = unitOr((enemy.windupTarget?.position ?? positionFor(session.state)).sub(position), enemy.direction);
		const right = unitOr(new Vector3(-enemy.direction.Z, 0, enemy.direction.X), new Vector3(1, 0, 0));
		const fanned = ThreatRules.SalvoDirection(point(direction), point(right), salvoIndex, salvoCount);
		direction = new Vector3(fanned.x, fanned.y, fanned.z);
		ace = enemy.kind === "ace";
		damage = tuned(session, TUNING.hostileDamage) + (ace ? ACE_DAMAGE_BONUS : 0);
	} else {
		// A FIRE press always does something: a guided shot with a full lock inside the envelope,
		// otherwise a blind shot straight ahead (proximity fused), or a stated refusal.
		const current = ownsEnemy(session, session.target) ? session.target : undefined;
		let distance = 0, dot = 0;
		if (current) [distance, dot] = targetMetrics(session, current);
		const decision = WeaponRules.Launch({
			missiles: session.missiles, missileCooldown: session.missileCooldown,
			hasTarget: current !== undefined, lockProgress: session.lockProgress, distance, dot, groundTarget: current?.kind === "ground",
			canDamage: current ? sessionCanDamage(session, current.kind, current.required) : false,
			lockRange: SpecialWeapons.StandardLockRange(session.special),
		});
		if (decision.kind === "denied") { denyFire(session, decision.reason); return; }
		position = positionFor(session.state).add(directionFor(session.state).mul(16)).sub(new Vector3(0, 2, 0));
		direction = directionFor(session.state);
		target = decision.kind === "guided" ? session.target : undefined;
		session.missiles -= 1;
		session.missilesFired += 1;
		session.missileCooldown = 1.15;
		damage = PLAYER_MISSILE_DAMAGE;
		// Blind launches report on the weapons channel so story radio lines are never overwritten.
		if (target === undefined) denyFire(session, "blind");
	}
	const speed = hostile ? tuned(session, TUNING.missileSpeed) : WeaponRules.MissileSpeed;
	session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, direction, hostile), position, direction, target, hostile, wingman: hostile ? enemy?.windupTarget : undefined, age: 0, ace, damage, speed,
		life: hostile ? tuned(session, TUNING.missileLife) : undefined });
}
/** A guided missile from the special slot at `enemy`; `lateral` offsets the launch rail so a salvo fans out. */
function launchSpecialMissile(session: CombatSession, enemy: Enemy, lateral: number): void {
	const forward = directionFor(session.state);
	const right = lateralFor(session.state, forward);
	const position = positionFor(session.state).add(forward.mul(14)).add(right.mul(lateral)).sub(new Vector3(0, 2.5, 0));
	const direction = unitOr(forward.add(right.mul(lateral * 0.03)), forward);
	const kind = session.special.kind;
	// Special launches count toward accuracy the same as standard ones; their hits already do.
	session.missilesFired += 1;
	session.projectiles.push({
		part: JetFactory.CreateMissile(session.folder, position, direction, false), position, direction, target: enemy, hostile: false, age: 0,
		ace: false, damage: SpecialWeapons.MissileDamage(kind), speed: SpecialWeapons.MissileSpeed(kind), special: true,
	});
}
/** Hostile missiles inside the flare cloud take the bait (ace missiles sometimes see through it). */
function decoyWithFlares(session: CombatSession): void {
	const position = positionFor(session.state);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		if (!missile.hostile || missile.wingman !== undefined || missile.flareRolled === session.flareBursts || missile.position.sub(position).Magnitude > SpecialWeapons.FlareDecoyRadius) continue;
		missile.flareRolled = session.flareBursts;
		if (!SpecialWeapons.FlareDecoys(math.random(), missile.ace)) continue;
		JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
		missile.part.Destroy(); session.projectiles.remove(index);
	}
}
/** SPECIAL press: the server decides, spends the charge and applies the effect, or explains the refusal. */
function activateSpecial(session: CombatSession): void {
	const state = session.special;
	const current = ownsEnemy(session, session.target) ? session.target : undefined;
	const range = SpecialWeapons.LockRange(state);
	let targets = 1;
	let salvo: number[] = [];
	if (state.kind === "salvo") {
		const candidates: SalvoCandidate[] = session.enemies.map((enemy) => {
			const allowed = ownsEnemy(session, enemy) && sessionCanDamage(session, enemy.kind, enemy.required);
			let distance = math.huge, dot = -1;
			if (allowed) [distance, dot] = targetMetrics(session, enemy);
			return { distance, dot, ground: enemy.kind === "ground", required: enemy.required, allowed, current: enemy === current };
		});
		salvo = SpecialWeapons.SalvoTargets(candidates, range);
		targets = salvo.size();
	} else if (state.kind === "lance") {
		let locked = false;
		if (current && sessionCanDamage(session, current.kind, current.required) && session.lockProgress >= WeaponRules.LockedAt) {
			const [distance, dot] = targetMetrics(session, current);
			locked = distance <= WeaponRules.EnvelopeRange(range, current.kind === "ground") && dot >= WeaponRules.LockDotFor(current.kind === "ground");
		}
		targets = locked ? 1 : 0;
	}
	const decision = SpecialWeapons.Activate(state, targets);
	if (decision.kind === "denied") { denyFire(session, decision.reason); return; }
	if (state.kind === "uav") {
		radio(session, "Recon drone up: all contacts marked", 3);
	} else if (state.kind === "flares") {
		// A fresh cloud: every hostile missile, even one that saw through the last, rolls again.
		session.flareBursts += 1;
		JetFactory.Flares(session.folder, positionFor(session.state), frameFor(session.state));
		decoyWithFlares(session);
	} else if (state.kind === "salvo") {
		for (let index = 0; index < salvo.size(); index++) launchSpecialMissile(session, session.enemies[salvo[index]], (index % 2 === 0 ? 1 : -1) * (6 + math.floor(index / 2) * 5));
	} else if (state.kind === "lance") {
		launchSpecialMissile(session, current!, 0);
	}
	if (session.active && sessions.get(session.player) === session) sendTelemetry(session);
}
/**
 * EVADE (any input: key, gamepad or the touch button): spends a charge and opens the decoy
 * window. Only missiles already close, or about to burn out, are decoyed; a press with
 * nothing near wastes the charge. The roll itself grants no immunity.
 */
function evade(session: CombatSession): void {
	if (!EvadeRules.Use(session.evade, session.evadeRemaining > 0)) return;
	session.evadeRemaining = EVADE_ROLL;
	session.evades += 1;
	JetFactory.Flares(session.folder, positionFor(session.state), frameFor(session.state));
	decoyEvade(session);
}
/** While the evade window is open, every hostile missile inside 450 studs or in its last 1.2 s takes the flares. */
function decoyEvade(session: CombatSession): void {
	const position = positionFor(session.state);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		if (!missile.hostile || missile.wingman !== undefined || !EvadeRules.Decoys(missile.position.sub(position).Magnitude, (missile.life ?? 0) - missile.age)) continue;
		JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
		missile.part.Destroy(); session.projectiles.remove(index);
	}
}
/** A retired enemy flies out for WITHDRAW_SECONDS, then is removed (no explosion: it got away). */
function stepWithdrawing(session: CombatSession, enemy: Enemy, dt: number): void {
	if (session.elapsed >= (enemy.withdrawUntil ?? 0)) {
		enemy.health = 0; enemy.frame = undefined;
		enemy.model.Destroy();
		return;
	}
	enemy.direction = unitOr(enemy.direction.Lerp(enemy.passDirection, FlightMath.DampAlpha(2.5, dt)), enemy.direction);
	enemy.velocity = enemy.direction.mul(330);
	const moved = enemy.position.add(enemy.velocity.mul(dt));
	enemy.position = new Vector3(math.clamp(moved.X, -2900, 2900), math.clamp(moved.Y, 170, 1200), math.clamp(moved.Z, -2900, 2900));
	enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction));
}
/** Same damped pursuit steering for both sides; player flight math is untouched. */
function steerAircraft(direction: Vector3, desired: Vector3, turn: number, dt: number): Vector3 {
	return unitOr(direction.Lerp(desired, FlightMath.DampAlpha(turn, dt)), direction);
}
function liveWingman(session: CombatSession, ally: Enemy): boolean {
	return ally.friendly === true && ally.enabled && ally.health > 0 && ally.model.Parent === session.folder;
}
function nearestWingman(session: CombatSession, hostile: Enemy): Enemy | undefined {
	if (hostile.kind === "ace" || hostile.role === "courier") return undefined;
	const playerDistance = positionFor(session.state).sub(hostile.position).Magnitude;
	const current = hostile.combatTarget;
	if (current !== undefined && liveWingman(session, current)
		&& AlliedRules.HostileTargetsWingman(hostile.kind, hostile.role, playerDistance, current.position.sub(hostile.position).Magnitude, true)) return current;
	let nearest: Enemy | undefined;
	let distance = math.huge;
	for (const ally of session.allies) {
		const range = ally.position.sub(hostile.position).Magnitude;
		if (liveWingman(session, ally) && range < distance) { distance = range; nearest = ally; }
	}
	return nearest !== undefined && AlliedRules.HostileTargetsWingman(hostile.kind, hostile.role, playerDistance, distance, false) ? nearest : undefined;
}
/** Director calls this once: casualties persist across phases, no respawn. */
function spawnAllies(session: CombatSession): void {
	const policy = session.blueprint?.allies;
	if (!policy || session.alliesSpawned) return;
	session.alliesSpawned = true;
	const frame = frameFor(session.state);
	for (let index = 0; index < AlliedRules.Count(policy); index++) {
		const offset = policy.formation[index];
		const position = frame.PointToWorldSpace(new Vector3(offset.x, offset.y, offset.z));
		spawnAir(session, 1, "raider", { friendly: true, optional: true, name: `${policy.callsignPrefix} ${index + 1}`,
			pose: { position: point(position), facing: point(directionFor(session.state)) } });
	}
}
function stepAllies(session: CombatSession, dt: number, weaponsEnabled = true): void {
	const policy = session.blueprint?.allies;
	if (!policy) return;
	const player = positionFor(session.state);
	const frame = frameFor(session.state);
	let inFlight = 0;
	for (const missile of session.projectiles) if (missile.allied) inFlight += 1;
	for (let index = 0; index < session.allies.size(); index++) {
		const ally = session.allies[index];
		if (!liveWingman(session, ally)) continue;
		const offset = policy.formation[index];
		const station = frame.PointToWorldSpace(new Vector3(offset.x, offset.y, offset.z));
		let target: Enemy | undefined;
		let range = AlliedRules.Range;
		if (weaponsEnabled && ally.position.sub(player).Magnitude < AlliedRules.Leash) for (const enemy of session.enemies) {
			const distance = enemy.position.sub(ally.position).Magnitude;
			if (distance < range && AlliedRules.CanEngage(policy, enemy, weaponsEnabled) && canHurt(session, enemy)) { target = enemy; range = distance; }
		}
		const destination = target ? target.position.add(target.velocity.mul(math.min(range / 600, 0.65))) : station;
		let desired = unitOr(destination.sub(ally.position), directionFor(session.state));
		if ((session.stepCount + index) % AVOID_EVERY === 0 && session.collisionParams
			&& Workspace.Raycast(ally.position, ally.direction.mul(AVOID_RANGE), session.collisionParams)) ally.pullUpUntil = session.elapsed + 0.8;
		if ((ally.pullUpUntil ?? 0) > session.elapsed) desired = unitOr(desired.add(new Vector3(0, 2, 0)), desired);
		if (target && range < 280) desired = unitOr(ally.direction.add(frame.RightVector.mul(index % 2 === 0 ? 1 : -1)), ally.direction);
		ally.direction = steerAircraft(ally.direction, desired, 2.1, dt);
		const speed = target ? math.clamp(session.state.speed + 24, 285, CombatBalance.banditSpeedCap) : AlliedRules.FormationSpeed(session.state.speed, station.sub(ally.position).Magnitude);
		ally.velocity = ally.direction.mul(speed);
		const moved = ally.position.add(ally.velocity.mul(dt));
		ally.position = new Vector3(math.clamp(moved.X, -session.airspace.spawnLimit, session.airspace.spawnLimit), math.max(170, moved.Y), math.clamp(moved.Z, -session.airspace.spawnLimit, session.airspace.spawnLimit));
		ally.frame = CFrame.lookAt(ally.position, ally.position.add(ally.direction));
		ally.fireTimer = math.max(0, ally.fireTimer - dt);
		if (target && (ally.alliedAmmo ?? 0) > 0 && inFlight < AlliedRules.MaxInFlight && session.elapsed - session.alliedFireAt >= AlliedRules.FlightSpacing
			&& ThreatRules.MayFire({ separation: range, aimDot: ally.direction.Dot(unitOr(target.position.sub(ally.position), ally.direction)), fireTimer: ally.fireTimer,
				globalReady: true, evading: false, playerStraight: false, minRange: 300, maxRange: 1800, aimThreshold: 0.9, straightRelax: 0 })) {
			const position = ally.position.add(ally.direction.mul(18));
			session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, ally.direction, false), position, direction: ally.direction,
				target, hostile: false, allied: true, age: 0, ace: false, damage: AlliedRules.Damage, speed: WeaponRules.MissileSpeed });
			ally.alliedAmmo = (ally.alliedAmmo ?? 0) - 1;
			ally.fireTimer = AlliedRules.Reload;
			session.alliedFireAt = session.elapsed;
			inFlight += 1;
		}
	}
}

function stepEnemies(session: CombatSession, dt: number): void {
	const playerPosition = positionFor(session.state);
	const playerForward = directionFor(session.state);
	const playerVelocity = playerForward.mul(session.state.speed);
	const lateral = lateralFor(session.state, playerForward);
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const site = session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState) : undefined;
	const protectPhase = site !== undefined && (phase?.kind === "escort" || phase?.kind === "defend");
	const act = sessionAct(session);
	const behaviour = Difficulty.Behaviour(session.difficulty);
	const windupSeconds = tuned(session, TUNING.windup);
	const [fireMin, fireMax] = TUNING.fireRange[act - 1];
	const aimThreshold = tuned(session, TUNING.fireAimDot);
	const straightRelax = tuned(session, TUNING.straightRelax);
	const playerStraight = ThreatRules.PlayerStraight(session.input.x, session.input.y);
	const breakChance = tuned(session, TUNING.breakChance);
	const breakSeconds = tuned(session, TUNING.breakSeconds);
	const breakTurn = tuned(session, TUNING.breakTurn);
	const aceLockBreak = tuned(session, TUNING.aceLockBreak);
	const aceSalvo = math.max(tuned(session, TUNING.aceSalvo), behaviour.aceSalvo);
	// Flight-wide fire control for bandits and raiders: the gate shrinks as more hostiles are live, a cap
	// limits concurrent threats (lit windups plus missiles in flight), and a radar-directed phase halves the
	// gate. Aces keep their own reload and ignore both, so an ace fires while its wingmen wind up.
	const soft = gentle(session);
	const gateBase = soft ? Difficulty.Scale(session.difficulty, "hostileGate", GENTLE.flightGate) : tuned(session, TUNING.flightGate);
	const maxDivisor = soft ? Difficulty.Scale(session.difficulty, "flightDivisor", GENTLE.flightDivisor) : tuned(session, TUNING.flightDivisor);
	const maxCap = soft ? GENTLE.threatCap : tuned(session, TUNING.threatCap);
	let live = 0, threats = 0, raidersAlive = 0;
	for (const enemy of session.enemies) {
		if (!ownsEnemy(session, enemy) || enemy.kind !== "air" || enemy.role === "courier" || enemy.role === "bomber" || (enemy.escortSlot !== undefined && !enemy.escortEngaged)) continue;
		live += 1;
		if (enemy.windup > 0) threats += 1;
		if (!enemy.required) raidersAlive += 1;
	}
	for (const missile of session.projectiles) if (missile.hostile && !missile.ace) threats += 1;
	const flightGate = ThreatRules.FlightGate(gateBase, live, maxDivisor, phase?.directed === true);
	const cap = ThreatRules.ThreatCap(live, maxCap);
	let flightReady = ThreatRules.FlightReady({ sinceLastWindup: session.elapsed - session.lastWindupAt, gate: flightGate, threats, cap });
	for (let index = 0; index < session.enemies.size(); index++) {
		const enemy = session.enemies[index];
		if (enemy.withdrawUntil !== undefined) { if (enemy.health > 0) stepWithdrawing(session, enemy, dt); continue; }
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") continue;
		// Route actors are stepped only by PhaseDirector and never enter fighter/fire logic.
		if (enemy.role === BomberRules.Role.role || (enemy.escortSlot !== undefined && !enemy.escortEngaged)) continue;
		enemy.combatTarget = nearestWingman(session, enemy);
		const playerPosition = enemy.combatTarget?.position ?? positionFor(session.state);
		const playerVelocity = enemy.combatTarget?.velocity ?? directionFor(session.state).mul(session.state.speed);
		const ace = enemy.kind === "ace";
		const courier = enemy.role === "courier";
		const aceState = enemy.aceState;
		const separation = playerPosition.sub(enemy.position).Magnitude;
		enemy.modeTimer = math.max(0, enemy.modeTimer - dt);
		enemy.flareTimer = math.max(0, enemy.flareTimer - dt);
		enemy.breakTimer = math.max(0, enemy.breakTimer - dt);
		if (enemy.mode === "extend" && enemy.modeTimer <= 0) enemy.mode = "attack";
		// Ace stages: retreat out of lock range, call the wing, hold off, then turn back in.
		if (aceState) {
			const event = AceRules.Step(aceState, dt, separation, raidersAlive);
			if (event === "called") phaseDirector.AceCall(session, enemy);
			else if (event === "returned") radio(session, session.blueprint?.aceReturns?.[aceState.stage - 1] ?? `SERA: ${enemy.name} is turning back in.`);
			// Immunity running out and the turn back in both make it hittable again (cached: no write unless it changed).
			publishEnemyDamageable(session, enemy);
		}
		const aceFighting = aceState === undefined || AceRules.Fights(aceState);
		// Defensive break, at most once per 12 s: a lock building past 80% inside 900 studs (this bandit's odds,
		// rolled once per attempt), or a guided missile inbound (the act's odds). A failed roll waits 3 s.
		if (!ace && enemy.mode !== "extend" && enemy.breakTimer <= 0) {
			const lockClose = session.target === enemy && ThreatRules.ShouldLockBreak({
				lockProgress: session.lockProgress, distance: separation, cooldownRemaining: 0, extending: false, roll: 0, chance: 1,
			});
			const inbound = !lockClose && ThreatRules.Inbound(enemy, session.projectiles, (missile) => missile.target, (missile) => missile.position.sub(enemy.position).Magnitude);
			if (lockClose || inbound) {
				if (math.random() < (lockClose ? enemy.lockBreakChance : breakChance)) {
					enemy.mode = "extend"; enemy.modeTimer = breakSeconds;
					enemy.breakTimer = ThreatRules.BreakCooldown; enemy.breakUntil = session.elapsed + breakSeconds;
					const pass = ThreatRules.BreakDirection(point(enemy.direction), point(lateral), enemy.side);
					enemy.passDirection = new Vector3(pass.x, pass.y, pass.z);
				} else enemy.breakTimer = 3;
			}
		}
		// Escort/defend raiders alternate 9 s orbits of the site with 4 s attack runs, staggered by index.
		const protects = protectPhase && !enemy.required;
		if (enemy.mode !== "extend") {
			if (protects) enemy.mode = (session.elapsed + index * 4.3) % 13 < 9 ? "orbit" : "run";
			else if (enemy.mode === "orbit" || enemy.mode === "run") enemy.mode = "attack";
		}
		// Overshoot: break away to the bracket side and climb instead of orbiting the player's tail.
		if (!courier && aceFighting && separation < 280 && enemy.mode !== "extend") {
			enemy.mode = "extend"; enemy.modeTimer = ace ? 2.2 : 3.0;
			enemy.passDirection = unitOr(enemy.direction.add(lateral.mul(enemy.side * 0.6)).add(new Vector3(0, 0.3, 0)), enemy.direction);
		}
		// Aces notch hard on the act's cadence when a lock is building on them; a desperate ace notches faster.
		if (ace && aceFighting) {
			enemy.lockBreakTimer = math.max(0, enemy.lockBreakTimer - dt);
			if (enemy.lockBreakTimer <= 0 && session.target === enemy && session.lockProgress > 0.6) {
				enemy.lockBreakTimer = ThreatRules.AceLockBreakInterval(aceLockBreak, enemy.health / enemy.maxHealth);
				enemy.mode = "extend"; enemy.modeTimer = 1.0;
				enemy.passDirection = unitOr(lateral.mul(enemy.side).add(enemy.direction.mul(0.3)), enemy.direction);
				session.lockProgress *= 0.4;
			}
		}
		let desired: Vector3;
		if (aceState?.mode === "retreat") {
			// Run straight away from the player, climbing a little, until out of lock range.
			const away = unitOr(new Vector3(enemy.position.X - playerPosition.X, 0, enemy.position.Z - playerPosition.Z), enemy.direction);
			desired = unitOr(away.add(new Vector3(0, 0.15, 0)), away);
		} else if (aceState?.mode === "hold") {
			// Loiter out of lock range while the wing fights: circle the player about 2100 studs out.
			const away = unitOr(new Vector3(enemy.position.X - playerPosition.X, 0, enemy.position.Z - playerPosition.Z), lateral);
			const station = playerPosition.add(away.mul(2100)).add(new Vector3(-away.Z, 0, away.X).mul(500));
			desired = unitOr(new Vector3(station.X, math.max(playerPosition.Y + 150, 300), station.Z).sub(enemy.position), enemy.direction);
		} else if (enemy.mode === "extend") desired = enemy.passDirection;
		else if (courier) {
			// The courier runs for its escape point, weaving; once there it circles until its clock runs out.
			const goal = enemy.escape ?? playerPosition.add(playerForward.mul(-2000));
			const toGoal = goal.sub(enemy.position);
			const right = new Vector3(-enemy.direction.Z, 0, enemy.direction.X);
			desired = toGoal.Magnitude < 400
				? unitOr(new Vector3(-toGoal.Z, 0, toGoal.X).add(toGoal.mul(0.3)), enemy.direction)
				: unitOr(toGoal.Unit.add(right.mul(math.sin(session.elapsed * 0.9 + index) * 0.35)), enemy.direction);
		} else if (enemy.mode === "orbit") {
			const orbit = new Vector3(site!.x + math.sin(session.elapsed * .4 + index) * 240, 230, site!.z + math.cos(session.elapsed * .4 + index) * 240);
			desired = unitOr(orbit.sub(enemy.position), enemy.direction);
		} else {
			const lead = math.clamp(separation / (350 + session.state.speed), 0.35, 1.8);
			const weave = math.sin(session.elapsed * (ace ? 1.7 : 0.65) + index * 1.8) * (ace ? 125 : 45);
			let destination = playerPosition.add(playerVelocity.mul(lead)).add(lateral.mul(weave)).add(new Vector3(0, ace ? math.sin(session.elapsed * 1.4) * 65 : 25, 0));
			// Bracket from the side while far out; aces also bias toward the player's rear quarter.
			if (separation > 1100) destination = destination.add(lateral.mul(enemy.side * 500));
			if (ace && separation > 600) destination = destination.sub(playerForward.mul(250));
			desired = unitOr(destination.sub(enemy.position), enemy.direction);
		}
		// Ground avoidance (shared with the world pass): a short ray ahead every few steps; scenery inside
		// 200 studs pulls the jet up for a moment instead of letting it fly through a mesa or tower.
		if ((session.stepCount + index) % AVOID_EVERY === 0 && session.collisionParams) {
			if (Workspace.Raycast(enemy.position, enemy.direction.mul(AVOID_RANGE), session.collisionParams)) enemy.pullUpUntil = session.elapsed + 0.8;
		}
		if ((enemy.pullUpUntil ?? 0) > session.elapsed) desired = unitOr(new Vector3(desired.X * 0.5, math.max(0.8, desired.Y + 1), desired.Z * 0.5), desired);
		let speed = math.clamp(session.state.speed + (ace ? 48 : 24), ace ? 320 : 285, ace ? 380 : CombatBalance.banditSpeedCap) + enemy.speedBonus;
		if (courier) speed = COURIER_SPEED;
		// A break stays below the ordinary bandit speed cap, even when the player flies at 600.
		else if (!ace && enemy.mode === "extend") speed = ThreatRules.ExtendSpeed(session.state.speed, 180);
		if (!aceFighting) speed += 40;
		const oldDirection = enemy.direction;
		const breaking = enemy.breakUntil > session.elapsed;
		enemy.direction = steerAircraft(oldDirection, desired, breaking ? breakTurn : ace ? 2.8 : 2.1, dt);
		enemy.velocity = enemy.direction.mul(speed);
		const moved = enemy.position.add(enemy.velocity.mul(dt));
		enemy.position = new Vector3(math.clamp(moved.X, -(session.bomberEncounter ? session.airspace.spawnLimit : 2700), session.bomberEncounter ? session.airspace.spawnLimit : 2700), math.clamp(moved.Y, 170, 1000), math.clamp(moved.Z, -(session.bomberEncounter ? session.airspace.spawnLimit : 2700), session.bomberEncounter ? session.airspace.spawnLimit : 2700));
		const bank = math.clamp(-oldDirection.Cross(enemy.direction).Y * 26, -0.65, 0.65);
		// Applied once per Heartbeat by flushPivots: a hitch's catch-up sub-steps replicate one CFrame, not five.
		enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction)).mul(CFrame.Angles(0, 0, bank));
		enemy.fireTimer = math.max(0, enemy.fireTimer - dt);
		if (courier) continue; // the courier never shoots
		const aimDot = enemy.direction.Dot(unitOr(playerPosition.sub(enemy.position), enemy.direction));
		const mayFire = (enemy.mode === "attack" || enemy.mode === "run") && aceFighting && !(aceState && AceRules.Invulnerable(aceState, session.elapsed));
		if (enemy.windup > 0) {
			enemy.windup = math.max(0, enemy.windup - dt);
			if (enemy.windup <= 0) {
				enemy.warning!.Enabled = false;
				enemy.model.SetAttribute("AttackWarning", false);
				// A staged ace that broke off mid-windup holds its shot.
				const windupTarget = enemy.windupTarget;
				const windupSeparation = (windupTarget?.position ?? positionFor(session.state)).sub(enemy.position).Magnitude;
				if (windupSeparation < 2300 && aceFighting && (windupTarget === undefined || liveWingman(session, windupTarget))) {
					const salvo = ace ? aceSalvo : 1;
					for (let shot = 0; shot < salvo; shot++) launchMissile(session, true, enemy, shot, salvo);
				}
				enemy.windupTarget = undefined;
				enemy.fireTimer = tuned(session, ace ? TUNING.aceReload : TUNING.banditReload);
			}
		} else if (mayFire && (ace || flightReady) && ThreatRules.MayFire({
			separation, aimDot, fireTimer: enemy.fireTimer, globalReady: true,
			evading: session.evadeRemaining > 0, playerStraight, minRange: fireMin, maxRange: ace ? fireMax + 200 : fireMax,
			aimThreshold, straightRelax,
		})) {
			enemy.windup = windupSeconds;
			enemy.windupTarget = AlliedRules.CommitWindupTarget(enemy.combatTarget);
			enemy.warning!.Enabled = true;
			enemy.model.SetAttribute("AttackWarning", true);
			if (!ace) {
				session.lastWindupAt = session.elapsed;
				threats += 1;
				flightReady = false;
			}
		}
	}
}
function segmentDistance(target: Vector3, startPosition: Vector3, endPosition: Vector3): number {
	return WeaponRules.SegmentDistance(point(target), point(startPosition), point(endPosition));
}
/**
 * A player missile at `index` hits `enemy`. Returns false when the caller must stop handling
 * that projectile: a kill removed it (and may have spliced the list) or ended the session.
 */
function strikeEnemy(session: CombatSession, enemy: Enemy, index: number): boolean {
	const allied = session.projectiles[index].allied === true;
	if (!allied) session.missileHits += 1;
	// Staged ace: the hit bursts harmlessly while it breaks away.
	if (enemy.aceState && AceRules.Invulnerable(enemy.aceState, session.elapsed)) return true;
	let damage = session.projectiles[index].damage > 0 ? session.projectiles[index].damage : PLAYER_MISSILE_DAMAGE;
	// A heavy hit stops at the ace's next stage line, and a hit while it retreats or holds stops above it,
	// so no stage (radio call, retreat, raiders, return) is skipped or cut short.
	if (enemy.aceState) damage = AceRules.CapHit(enemy.aceState, enemy.health, enemy.maxHealth, damage);
	if (allied && session.blueprint?.allies && !AlliedRules.MayDestroy(session.blueprint.allies)) damage = math.min(damage, math.max(0, enemy.health - 1));
	if (enemy.health <= damage) {
		session.projectiles[index].part.Destroy(); session.projectiles.remove(index);
		destroyEnemy(session, enemy, allied);
		return false;
	}
	const before = enemy.health;
	enemy.health -= damage;
	enemy.model.SetAttribute("Health", enemy.health);
	if (enemy.aceState) { aceStage(session, enemy, before, enemy.health); publishEnemyDamageable(session, enemy); }
	return true;
}
/**
 * A player missile `distance` studs from `enemy`: true when the enemy's flare eats it. A burning
 * flare decoys every missile inside 260 studs for 2.5 s; a fresh one pops when the first gets close.
 */
function flareDecoys(session: CombatSession, enemy: Enemy, distance: number, missilePosition: Vector3): boolean {
	let decoyed = ThreatRules.FlareDecoys(distance, enemy.flareUntil, session.elapsed);
	if (!decoyed && ThreatRules.ShouldFlare(distance, enemy.flares, enemy.flareTimer)) {
		enemy.flares -= 1; enemy.flareTimer = 6; enemy.flareUntil = session.elapsed + ThreatRules.FlareSeconds;
		JetFactory.Flares(session.folder, enemy.position);
		if (enemy.kind === "ace") radio(session, `${enemy.name} deployed flares`);
		decoyed = true;
	}
	if (decoyed) JetFactory.Burst(session.folder, missilePosition, Color3.fromRGB(255, 220, 142), 4);
	return decoyed;
}
/**
 * An ace crossing 2/3 or 1/3 health: a stage call (radio line), 3 s invulnerability, the lock on it reset,
 * more speed, and (when its phase holds raiders for this stage) a retreat to call them (AceRules).
 */
function aceStage(session: CombatSession, enemy: Enemy, before: number, after: number): void {
	const aceState = enemy.aceState!;
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const raiders = phase?.kind === "ace" ? phase.optionalRaiders ?? 0 : 0;
	const retreats = AceRules.RaidersForStage(raiders, aceState.stage + 1) > 0;
	if (!AceRules.Cross(aceState, enemy.maxHealth, before, after, session.elapsed, retreats)) return;
	enemy.speedBonus += tuned(session, TUNING.aceStageSpeed);
	enemy.windup = 0; enemy.windupTarget = undefined; enemy.warning!.Enabled = false; enemy.model.SetAttribute("AttackWarning", false);
	if (enemy.mode === "extend") enemy.mode = "attack";
	if (session.target === enemy) session.lockProgress = 0;
	const lines = session.blueprint?.aceStages;
	const fallback = retreats ? `${enemy.name}: Not bad, trainee. Wing, on me.` : aceState.stage === 1 ? `${enemy.name}: Not bad, trainee. Again.` : `${enemy.name}: Enough. Head on.`;
	radio(session, lines?.[aceState.stage - 1] ?? fallback);
}
function stepMissiles(session: CombatSession, dt: number): void {
	phaseDirector.TutorialHint(session);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		missile.age += dt;
		const blind = !missile.hostile && missile.target === undefined;
		let removed = missile.age > (missile.hostile ? missile.life ?? tuned(session, TUNING.missileLife) : blind && !missile.lostTrack ? WeaponRules.UnguidedLifetime : WeaponRules.GuidedLifetime)
			|| (!missile.hostile && !blind && !ownsEnemy(session, missile.target))
			|| (missile.wingman !== undefined && !liveWingman(session, missile.wingman))
			|| (missile.allied === true && (session.blueprint?.allies === undefined || !AlliedRules.CanEngage(session.blueprint.allies, missile.target!)));
		// A blind shot that reaches end of life bursts harmlessly where it is.
		if (removed && blind) effect(session, "missile", missile.position);
		if (!removed && blind) {
			// Unguided: straight flight; the proximity fuse fires on the closest damageable enemy the sweep passes.
			const nextPosition = missile.position.add(missile.direction.mul(missile.speed * dt));
			const hit = WeaponRules.Fuse(point(missile.position), point(nextPosition), session.enemies, (enemy) => point(enemy.position),
				(enemy) => ownsEnemy(session, enemy) && sessionCanDamage(session, enemy.kind, enemy.required));
			if (hit !== undefined) {
				const enemy = session.enemies[hit];
				removed = true;
				// Flares decoy blind shots exactly like guided ones.
				if (flareDecoys(session, enemy, 0, missile.position)) {
					// eaten by the flare cloud
				} else {
				effect(session, "hit", enemy.position);
				if (!strikeEnemy(session, enemy, index)) {
					if (!session.active) return;
					index = math.min(index, session.projectiles.size());
					continue;
				}
				}
			} else {
				missile.position = nextPosition;
				missile.part.CFrame = CFrame.lookAt(nextPosition, nextPosition.add(missile.direction));
			}
		} else if (!removed) {
			const targetPosition = missile.hostile ? missile.wingman?.position ?? positionFor(session.state) : missile.target!.position;
			const velocity = missile.hostile ? missile.wingman?.velocity ?? directionFor(session.state).mul(session.state.speed) : missile.target!.velocity;
			const speed = missile.speed;
			const distance = targetPosition.sub(missile.position).Magnitude;
			// A live flare cloud: each hostile missile that enters it rolls once to be decoyed.
			if (missile.hostile && !missile.wingman && missile.flareRolled !== session.flareBursts && session.special.kind === "flares" && session.special.active > 0 && distance <= SpecialWeapons.FlareDecoyRadius) {
				missile.flareRolled = session.flareBursts;
				if (SpecialWeapons.FlareDecoys(math.random(), missile.ace)) {
					JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
					missile.part.Destroy(); session.projectiles.remove(index);
					continue;
				}
			}
			if (!missile.hostile) {
				const target = missile.target!;
				// A bandit mid defensive break that the missile has started to overshoot slips the seeker: the shot flies on blind.
				if (ThreatRules.LosesTrack({ breaking: target.breakUntil > session.elapsed, distance, previousDistance: missile.lastDistance ?? distance, fuseRadius: WeaponRules.FuseRadius })) {
					if (missile.allied) { missile.part.Destroy(); session.projectiles.remove(index); continue; }
					missile.target = undefined; missile.lostTrack = true;
					missile.position = missile.position.add(missile.direction.mul(speed * dt));
					missile.part.CFrame = CFrame.lookAt(missile.position, missile.position.add(missile.direction));
					continue;
				}
				missile.lastDistance = distance;
				// Bandit and ace flares: one pops when a missile closes, then eats every missile inside 260 studs for 2.5 s.
				if (flareDecoys(session, target, distance, missile.position)) {
					missile.part.Destroy(); session.projectiles.remove(index);
					continue;
				}
			}
			// Hostile missiles steer for their whole flight; ace missiles turn harder.
			const lead = math.clamp(distance / speed, 0, missile.hostile ? 0.9 : 0.65);
			const delta = targetPosition.add(velocity.mul(lead)).sub(missile.position);
			// Player missiles turn much harder inside 300 studs so an orbit launch at 80 degrees off the nose still connects.
			const playerTurn = distance < 300 ? 14 : 7;
			missile.direction = unitOr(missile.direction.Lerp(unitOr(delta, missile.direction), FlightMath.DampAlpha(missile.hostile ? tuned(session, TUNING.missileTurn) + (missile.ace ? tuned(session, TUNING.aceMissileTurn) : 0) : playerTurn, dt)), missile.direction);
			const nextPosition = missile.position.add(missile.direction.mul(speed * dt));
			if (segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile ? tuned(session, TUNING.missileFuse) : WeaponRules.FuseRadius)) {
				removed = true;
				effect(session, "hit", targetPosition);
				if (missile.hostile && missile.wingman) {
					const ally = missile.wingman;
					ally.health = math.max(0, ally.health - missile.damage);
					ally.model.SetAttribute("Health", ally.health);
					if (ally.health <= 0) {
						ally.enabled = false;
						effect(session, "air", ally.position, { velocity: ally.velocity, model: ally.model });
						ally.model.Destroy();
						radio(session, `CONTROL: ${ally.name} is down. Keep your spacing.`, 4);
					}
				} else if (missile.hostile) {
					// The evade roll is no shield: only a well-timed press (decoyEvade) saves the hull.
					const lost = math.min(session.health, missile.damage);
					session.health -= lost;
					session.damageTaken += lost;
					session.lowestHealth = math.min(session.lowestHealth, session.health);
					if (session.health <= 0) {
						// A fatal hit settles the sortie before any later kill in this step can count.
						missile.part.Destroy(); session.projectiles.remove(index);
						refreshSession(session, os.clock());
						return;
					}
				} else if (sessionCanDamage(session, missile.target!.kind, missile.target!.required)) {
					if (!strikeEnemy(session, missile.target!, index)) {
						if (!session.active) return;
						// A phase change inside destroyEnemy may have withdrawn raiders and spliced
						// out missiles below this index; clamp so the backward sweep stays valid.
						index = math.min(index, session.projectiles.size());
						continue;
					}
				}
			} else {
				missile.position = nextPosition;
				missile.part.CFrame = CFrame.lookAt(nextPosition, nextPosition.add(missile.direction));
			}
		}
		if (removed) { missile.part.Destroy(); session.projectiles.remove(index); }
	}
	// One rules tick per step covers hostile hits; destroyEnemy already finishes
	// the session itself when a kill settles the outcome.
	refreshSession(session, os.clock());
}
function stepSession(session: CombatSession, dt: number): void {
	if (session.launch) {
		const from = new Vector3(session.state.x, session.state.y, session.state.z);
		const ready = LaunchStage.Advance(session.launch, session.state, dt);
		const hit = AircraftCollision.Sweep(from, new Vector3(session.state.x, session.state.y, session.state.z), session.collisionParams!);
		if (hit) { session.crashReason = AircraftCollision.Reason(hit); finish(session); return; }
		session.aircraftFrame = frameFor(session.state);
		// Wingmen visibly hold station through the scripted path; hostiles and all weapons remain frozen.
		stepAllies(session, dt, false);
		if (ready) {
			session.input = { x: 0, y: 0, throttle: FlightMath.CruiseThrottle };
			session.inputClientTime = 0; session.inputFresh = false; session.inputSteps = 0;
			// Phase setup may yield for asset construction; it must not spend playable time.
			phaseDirector.Apply(session);
			if (!session.active || session.cleaned || session.player.Parent !== Players) return;
			session.launch = undefined;
			const now = os.clock();
			if (session.blueprintState) BlueprintRunner.BeginControl(session.blueprintState, now);
			session.elapsed = 0; session.lastInput = now;
			missionState!.FireClient(session.player, { kind: "FlightControl", state: session.state, sequence: session.stateSequence });
			sendFlightState(session); sendTelemetry(session);
		}
		return;
	}

	if (!refreshSession(session, os.clock())) return;
	session.stepCount += 1;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	EvadeRules.Tick(session.evade, dt);
	SpecialWeapons.Tick(session.special, dt);
	session.regen += dt;
	if (session.regen >= 2.5) { session.regen -= 2.5; session.missiles = math.min(MAX_MISSILES, session.missiles + 1); }
	// Input silence (a suspended phone app, a dropped connection): centre the stick and ease the
	// jet level, since a centred stick alone would now hold whatever dive it was in.
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; session.input.assist = true; }
	// Mission 1 observes real control usage during its tutorial phases.
	if (session.blueprintState) BlueprintRunner.ObserveControls(session.blueprintState, session.input.x, session.input.y, dt, os.clock());
	if (sessionOutcome(session) !== undefined) { finish(session); return; }
	phaseDirector.Apply(session);
	phaseDirector.LaunchDue(session);
	const from={x:session.state.x,y:session.state.y,z:session.state.z};
	if (session.inputFresh) { session.inputFresh = false; session.inputSteps = 0; }
	FlightMath.Step(session.state, session.input, dt, session.airspace);
	// Resolve impacts before navigation, phase completion, enemy fire or missile kills.
	const hit = AircraftCollision.Sweep(new Vector3(from.x, from.y, from.z), new Vector3(session.state.x, session.state.y, session.state.z), session.collisionParams!);
	if (hit) {
		if (session.blueprintState && BlueprintRunner.RecoverPractice(session.blueprintState, session.state)) {
			session.lockProgress = 0;
			// During grace the safety warning must remain visible, even after another reset.
			if (session.blueprintState.banditsDueAt === undefined) radio(session, BlueprintRunner.PracticeReset);
		} else {
			session.crashReason = AircraftCollision.Reason(hit);
			finish(session);
			return;
		}
	}
	session.inputSteps += 1;
	if (session.blueprintState) {
		const bs=session.blueprintState, nav=BlueprintRunner.NavigationPoint(bs);
		let threats=0;
		if (nav) { const navPoint=new Vector3(nav.x,230,nav.z); for(const enemy of session.enemies) if(ownsEnemy(session,enemy) && enemy.kind !== "ground" && enemy.position.sub(navPoint).Magnitude < 650) threats++; }
		BlueprintRunner.ObserveFlight(bs,from,{x:session.state.x,y:session.state.y,z:session.state.z},dt,os.clock(),threats,Difficulty.Multiplier(session.difficulty,"protectDrain"));
		if (bs.outcome !== undefined) {finish(session); return;}
		phaseDirector.Apply(session);
		phaseDirector.Step(session);
		if (bs.outcome !== undefined) { finish(session); return; }
	}
	let flightFrame = frameFor(session.state);
	if (session.evadeRemaining > 0) flightFrame = flightFrame.mul(CFrame.Angles(0, 0, (1 - session.evadeRemaining / EVADE_ROLL) * math.pi * 2));
	session.aircraftFrame = flightFrame;
	// The evade window stays open for a moment after the press, so a phone's round trip does not eat the timing.
	if (EvadeRules.Open(session.evade)) decoyEvade(session);
	stepAllies(session, dt);
	stepEnemies(session, dt);
	if (!ownsEnemy(session, session.target)) acquireTarget(session);
	if (session.target) {
		const [distance, dot] = targetMetrics(session, session.target);
		const ground = session.target.kind === "ground";
		// Air targets lock inside 40 degrees and 1800 studs; ground targets keep the wide 80 degree, 2450-stud cone.
		const inEnvelope = distance <= WeaponRules.EnvelopeRange(SpecialWeapons.LockRange(session.special), ground) && dot >= WeaponRules.LockDotFor(ground);
		const staged = session.target.aceState !== undefined && AceRules.Invulnerable(session.target.aceState, session.elapsed);
		session.lockProgress = staged ? 0 : inEnvelope
			? math.min(1, session.lockProgress + dt / SpecialWeapons.LockBuildSeconds(session.special)) : math.max(0, session.lockProgress - dt * WeaponRules.LockDecayPerSecond);
	}
	stepMissiles(session, dt);
	if (!refreshSession(session, os.clock())) return;
	session.stateTime += dt;
	if (session.stateTime >= STATE_INTERVAL) { session.stateTime = math.min(session.stateTime - STATE_INTERVAL, STATE_INTERVAL); sendFlightState(session); }
	session.telemetryTime += dt;
	if (session.telemetryTime >= TELEMETRY_INTERVAL) { session.telemetryTime = math.min(session.telemetryTime - TELEMETRY_INTERVAL, TELEMETRY_INTERVAL); sendTelemetry(session); }
}
// Pivot scratch arrays reused every Heartbeat.
const pivotParts: BasePart[] = [];
const pivotFrames: CFrame[] = [];
function queue(model: Model | undefined, frame: CFrame | undefined): void {
	const root = model?.PrimaryPart;
	if (frame === undefined || root === undefined || model!.Parent === undefined) return;
	pivotParts.push(root);
	pivotFrames.push(frame);
}
/**
 * Applies this Heartbeat's final pivots in one BulkMoveTo. Each aircraft and the
 * escorted vehicle are welded assemblies, so moving the root part moves the
 * model and only that root's CFrame replicates.
 */
function flushPivots(session: CombatSession): void {
	pivotParts.clear();
	pivotFrames.clear();
	queue(session.aircraft, session.aircraftFrame);
	session.aircraftFrame = undefined;
	queue(session.navigationActor, session.actorFrame);
	session.actorFrame = undefined;
	for (const enemy of session.enemies) {
		if (enemy.frame !== undefined && enemy.health > 0) queue(enemy.model, enemy.frame);
		enemy.frame = undefined;
	}
	for (const enemy of session.allies) {
		if (enemy.frame !== undefined && enemy.health > 0) queue(enemy.model, enemy.frame);
		enemy.frame = undefined;
	}
	if (pivotParts.size() > 0) Workspace.BulkMoveTo(pivotParts, pivotFrames, Enum.BulkMoveMode.FireCFrameChanged);
}

/** A session the Heartbeat should simulate: live, loaded, not paused. */
function stepping(session: CombatSession): boolean {
	return session.active && !session.loading && !PauseRules.Paused(session.pause);
}
/**
 * A step or action threw. Warn once, settle the sortie as failed with reason "internal_error"
 * (saved like any failure), and if even that fails, tell the client and tear the session down.
 */
function abortSession(session: CombatSession, message: string): void {
	warn(`SKYBREAK mission ${session.missionId} stopped after a server error: ${message}`);
	session.crashReason = "internal_error";
	const [ok, err] = pcall(() => finish(session));
	if (!ok) warn(`SKYBREAK mission ${session.missionId} could not settle cleanly: ${tostring(err)}`);
	// Unless a completion task is already coming, report the result unsaved, tear down and release now.
	Settlement.Abandon(session.settlement, session.settleHooks ?? settlementHooks(session, false));
}
/** CombatAction "Pause": single-player, so the whole sortie freezes; the clock is settled first. */
function pauseSession(session: CombatSession, now: number): void {
	if (!session.active || session.finished || !refreshSession(session, now)) return;
	// A refused pause (budget spent) still answers, so the client un-freezes instead of waiting.
	if (!PauseRules.Pause(session.pause, now)) { sendTelemetry(session); return; }
	session.input.x = 0; session.input.y = 0;
	sendTelemetry(session);
}
/**
 * CombatAction "Resume" (or the 5-minute budget running out): the mission clock moves its start
 * forward by the paused span, so no sortie time passed while paused. Returns whether it sent telemetry.
 */
function resumeSession(session: CombatSession, now: number): boolean {
	if (!PauseRules.Paused(session.pause)) return false;
	const shift = PauseRules.Resume(session.pause, now);
	if (session.blueprintState) session.blueprintState.startedAt += shift;
	session.lastInput = now;
	if (!refreshSession(session, now)) return false;
	sendTelemetry(session); sendFlightState(session);
	return true;
}

const phaseDirector = createPhaseDirector({
	spawnAllies, spawnAir, activateGround, withdrawAirborne, liveAircraft, radio, acquireTarget, publishDamageable,
	isCurrent: (session) => sessions.get(session.player) === session,
});

// Clients supply validated controls and button events, never damage or results.
export const CombatService = {
	EndMission(player: Player): void {
		const session = sessions.get(player);
		if (session) cleanupSession(session);
	},
	GetSession(player: Player): CombatSession | undefined { return sessions.get(player); },
	StartMission(player: Player, slot: number, missionId = 1, special?: unknown, difficulty?: unknown): LuaTuple<[boolean, string?]> {
		if (!missionState || !onFinished) return $tuple(false, "CombatService is not initialized");
		if (!FlightMath.IsFinite(slot) || slot % 1 !== 0 || slot < 1 || slot > 4) return $tuple(false, "Choose a save slot from 1 to 4");
		if (!MissionCatalog.IsValidId(missionId) || !MissionCatalog.Available(missionId)) return $tuple(false, "Choose a valid mission");
		if (special !== undefined && !SpecialWeapons.IsKind(special)) return $tuple(false, "Choose a valid special weapon");
		const specialKind: SpecialKind = SpecialWeapons.IsKind(special) ? special : SpecialWeapons.Default;
		if (difficulty !== undefined && !Difficulty.IsKind(difficulty)) return $tuple(false, "Choose a valid difficulty");
		const difficultyKind: DifficultyKind = Difficulty.Coerce(difficulty);
		if (!typeIs(player, "Instance") || !player.IsA("Player") || player.Parent !== Players) return $tuple(false, "Player is unavailable");
		if (completing.has(player)) return $tuple(false, "Your mission result is still being saved");
		if (sessions.has(player)) return $tuple(false, "A mission is already in progress or its result is being saved");
		if (buildingMission || sessions.size() > 0) return $tuple(false, "This mission world is single-player");
		buildingMission = true;
		const startedAt = os.clock();
		missionSerial += 1;
		const folder = new Instance("Folder");
		folder.Name = `Mission_${player.UserId}_${missionSerial}`;
		folder.Parent = missionRoot;
		const [ok, result] = pcall(() => {
			const world = MissionWorld.Build(missionId, folder);
			assert(player.Parent === Players, "Player left during world construction");
			const blueprint = MissionCatalog.Get(missionId);
			assert(world.groundTargets.size() === blueprint.ground.size(), `Mission ${missionId} world ground target count mismatch`);
			const aircraft = JetFactory.Create("SKYBREAK - Kestrel", false);
			assert(player.Parent === Players, "Player left during aircraft construction");
			aircraft.SetAttribute("SkybreakOwner", player.UserId);
			aircraft.SetAttribute("SkybreakPlayer", true);
			JetFactory.SetTrails(aircraft, false); // the client flies a predicted local clone that owns the trails
			aircraft.Parent = folder;
			const state = blueprint.start ? LaunchStage.Pose(MissionCatalog.Start(missionId)) : FlightMath.NewState();
			aircraft.PivotTo(frameFor(state));
			const session: CombatSession = {
				targetScore: new TargetScore(MissionCatalog.Scoring(missionId)),
				player, slot, folder, aircraft, state, missionId, airspace: MissionCatalog.Airspace(missionId), lastWindupAt: -math.huge, radioSerial: 0, chatterIndex: 0,
				input: { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, health: 100, kills: 0, elapsed: 0,
				missiles: MAX_MISSILES, missileCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				special: SpecialWeapons.New(specialKind),
				difficulty: difficultyKind,
				allies: [], alliedKills: [], alliedFireAt: -math.huge, enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
				inputClientTime: 0, inputFresh: false, inputSteps: 0, inputTokens: INPUT_BURST, inputTokensAt: os.clock(), stateTime: 0, stateSequence: 0, telemetrySequence: 0,
				missilesFired: 0, missileHits: 0, flareBursts: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
				evade: EvadeRules.New(), guard: StepGuard.New(), pause: PauseRules.New(), pauseAck: 0, settlement: Settlement.New(),
				banditSerial: 0, raiderSerial: 0, spawnSerial: 0, allySerial: 0, reinforceIndex: 0, airQueue: [], stepCount: 0,
			};
			session.blueprint = MissionCatalog.Get(missionId);
			session.blueprintState = BlueprintRunner.NewState(session.blueprint, startedAt, fixedRaiders(session.blueprint) ? 0 : Difficulty.Behaviour(difficultyKind).extraRaiders);
			// Hazard targets and hidden strikes stay out of sight until their phase lights them.
			const hiddenGround = session.blueprint ? MissionCatalog.HiddenGround(session.blueprint) : new Set<number>();
			for (let index = 0; index < world.groundTargets.size(); index++) {
				const model = world.groundTargets[index];
				assert(model.Parent === folder && model.PrimaryPart !== undefined, "Ground target must have a stationary aim center in its session");
				const enemy: Enemy = {
					id: `ground_${index + 1}_${missionSerial}`, name: model.Name, model, health: 55, maxHealth: 55,
					position: model.PrimaryPart.Position, direction: new Vector3(0, 0, -1), velocity: Vector3.zero,
					kind: "ground", groundIndex: index, required: true, enabled: false, fireTimer: 0, windup: 0,
					mode: "attack", modeTimer: 0, passDirection: new Vector3(0, 0, -1), side: 1,
					flares: 0, flareTimer: 0, flareUntil: 0, speedBonus: 0, lockBreakTimer: 0, breakTimer: 0, breakUntil: 0, lockBreakChance: 0, hiddenParts: [],
				};
				// Mission 1 hides the training radar until the tutorial activates it; blueprints hide hazards and hidden strikes.
				const hideUntilActivated = missionId === 0 || hiddenGround.has(index);
				for (const item of model.GetDescendants()) {
					if (item.IsA("BasePart")) {
						item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = item.Transparency < 1;
						item.SetAttribute("FlightSolid", item.CanQuery);
						if (hideUntilActivated) { enemy.hiddenParts.push({ part: item, transparency: item.Transparency }); item.Transparency = 1; item.CanQuery = false; }
					}
				}
				markTarget(session, enemy);
				session.enemies.push(enemy);
			}
			session.collisionParams = AircraftCollision.Parameters(folder);
			// Protected actors stand on scenery and terrain only, never on each other or on an aircraft.
			session.groundParams = AircraftCollision.Parameters(folder);
			// The opening wave is created here (JetFactory may yield on first mesh
			// generation, which is safe on this RemoteFunction thread) so its parts
			// replicate under the loading screen. Enemy timers only advance once play
			// begins, so this is gameplay-equivalent to spawning at launch.
			phaseDirector.Apply(session);
			assert(player.Parent === Players, "Player left during mission setup");
			// Hold in the loading gate: no clock, stepping or input until the client
			// confirms replication (CombatAction "Ready") or the timeout elapses.
			session.loading = LoadingGate.New(os.clock());
			sessions.set(player, session);
			player.ReplicationFocus = aircraft.PrimaryPart;
			const characterRoot = player.Character?.FindFirstChild("HumanoidRootPart");
			if (characterRoot?.IsA("BasePart")) {
				session.characterRoot = characterRoot; session.wasAnchored = characterRoot.Anchored; characterRoot.Anchored = true;
			}
			const loading: MissionLoading = { kind: "Loading", slot, missionId, aircraft, expectedParts: countParts(folder) };
			missionState!.FireClient(player, loading);
		});
		buildingMission = false;
		if (!ok) {
			const session = sessions.get(player);
			if (session) cleanupSession(session, false);
			folder.Destroy();
			restoreMenu();
			warn(`SKYBREAK mission construction failed: ${tostring(result)}`);
			return $tuple(false, "The mission world could not be built. Please retry.");
		}
		return $tuple(true);
	},
	Init(remotes: Remotes | Instance, finishedCallback: FinishedCallback): void {
		assert(typeIs(finishedCallback, "function"), "CombatService.Init requires onFinished");
		for (const connection of connections) connection.Disconnect();
		connections.clear();
		for (const [, session] of sessions) cleanupSession(session, false);
		onFinished = finishedCallback;
		missionState = remote(remotes, "MissionState");
		flightStateRemote = remote(remotes, "FlightState");
		telemetryRemote = remote(remotes, "Telemetry");
		combatEffectRemote = remote(remotes, "CombatEffect");
		missionRoot = Workspace.FindFirstChild("SkybreakCombat");
		if (!missionRoot) { missionRoot = new Instance("Folder"); missionRoot.Name = "SkybreakCombat"; missionRoot.Parent = Workspace; }
		connections.push(remote(remotes, "FlightInput").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || session.loading || session.launch || session.guard.running || PauseRules.Paused(session.pause) || !typeIs(payload, "table")) return;
			const now = os.clock();
			// Heartbeat runs refreshSession every frame, so this unguarded handler only takes input.
			// A token bucket caps the packet rate whatever the stamps claim.
			session.inputTokens = math.min(INPUT_BURST, session.inputTokens + (now - session.inputTokensAt) * INPUT_RATE);
			session.inputTokensAt = now;
			if (session.inputTokens < 1) return;
			session.inputTokens -= 1;
			const data = payload as { x?: unknown; y?: unknown; throttle?: unknown; t?: unknown; assist?: unknown };
			if (!FlightMath.IsFinite(data.x) || !FlightMath.IsFinite(data.y) || !FlightMath.IsFinite(data.throttle)) return;
			// Unreliable packets can arrive out of order or bunched together. Staleness is
			// decided by the client's stamp first, so the newest of two packets that land in
			// the same few milliseconds always wins. A repeated stamp is legitimate: stamps are
			// fixed-step boundaries, so the first send after a resume reuses the frozen one.
			// The per-session token bucket, not this check, limits floods.
			// Unstamped packets keep the old 1/40 s floor.
			const clientTime = FlightMath.IsFinite(data.t) && data.t > 0 ? data.t : 0;
			if (clientTime > 0) {
				if (clientTime < session.inputClientTime) return;
			} else if (now - session.lastInputEvent < 1 / 40) return;
			session.lastInputEvent = now;
			session.input.x = math.clamp(data.x, -1, 1);
			session.input.y = math.clamp(data.y, -1, 1);
			session.input.throttle = math.clamp(data.throttle, 0, 1);
			session.input.assist = data.assist === true;
			session.lastInput = now;
			// The echo counts fixed steps from the first one that uses this input (see sendFlightState).
			if (clientTime > 0) { session.inputClientTime = clientTime; session.inputFresh = true; }
		}));
		connections.push(remote(remotes, "CombatAction").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || !typeIs(payload, "table")) return;
			const data = payload as { action?: unknown; serial?: unknown };
			if (!typeIs(data.action, "string")) return;
			const now = os.clock();
			if (session.loading) {
				// The client has the aircraft and world locally; release the gate now.
				if (data.action === "Ready") { LoadingGate.MarkReady(session.loading); if (LoadingGate.Release(session.loading, now)) beginPlay(session); }
				return;
			}
			if (!WeaponRules.IsActionKind(data.action)) return;
			// Rate limited per action kind: a TGT tap followed closely by FIRE still fires.
			session.actionGate ??= WeaponRules.NewActionGate();
			if (!WeaponRules.AcceptAction(session.actionGate, data.action, now)) return;
			const action = data.action;
			// Every action runs under the session's guard: a throw ends the sortie cleanly, and nothing
			// mutates the session while a step is suspended mid-yield.
			StepGuard.Run(session.guard, () => {
				if (action === "Pause" || action === "Resume") {
					// Acknowledge the client's request serial (bounded, monotonic) before acting, so the telemetry this sends carries it.
					const serial = data.serial;
					if (typeIs(serial, "number") && serial === serial && serial >= 0 && serial < 1e9) session.pauseAck = math.max(session.pauseAck, math.floor(serial));
					if (action === "Pause") pauseSession(session, now);
					// A resume that changed nothing still answers, so the telemetry carries pauseAck.
					else if (!resumeSession(session, now)) sendTelemetry(session);
					return;
				}
				if (!LaunchStage.CanControl(false, session.launch, PauseRules.Paused(session.pause)) || !refreshSession(session, now)) return;
				if (action === "FireMissile") launchMissile(session, false);
				else if (action === "Evade") evade(session);
				else if (action === "CycleTarget") cycleTarget(session);
				else if (action === "Special") activateSpecial(session);
			}, (message) => abortSession(session, message));
		}));
		connections.push(Players.PlayerRemoving.Connect((player) => CombatService.EndMission(player)));
		let accumulator = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			const now = os.clock();
			// Each session's work runs under its StepGuard: an error finishes that sortie with reason
			// "internal_error" (warned once) instead of throwing every frame, and a step suspended in a
			// yield is never re-entered by the next Heartbeat.
			for (const [, session] of sessions) {
				StepGuard.Run(session.guard, () => {
					if (session.loading) { if (LoadingGate.Release(session.loading, now)) beginPlay(session); return; }
					if (PauseRules.Paused(session.pause)) {
						if (PauseRules.Expired(session.pause, now)) resumeSession(session, now);
						else if (math.ceil(PauseRules.Remaining(session.pause, now)) !== math.ceil(PauseRules.Remaining(session.pause, now - dt))) sendTelemetry(session);
						return;
					}
					refreshSession(session, now);
				}, (message) => abortSession(session, message));
			}
			if (!FlightMath.IsFinite(dt) || dt <= 0) return;
			accumulator = math.min(accumulator + dt, FIXED_STEP * 5);
			while (accumulator >= FIXED_STEP) {
				accumulator -= FIXED_STEP;
				for (const [, session] of sessions) if (stepping(session)) StepGuard.Run(session.guard, () => stepSession(session, FIXED_STEP), (message) => abortSession(session, message));
			}
			// Only the last sub-step's pivots matter; move every model once per Heartbeat.
			for (const [, session] of sessions) if (stepping(session)) StepGuard.Run(session.guard, () => flushPivots(session), (message) => abortSession(session, message));
		}));
	},
};
