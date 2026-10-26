import { AircraftCollision } from "./AircraftCollision";
import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { MissionAssets } from "../shared/MissionAssets";
import { JetFactory } from "../shared/JetFactory";
import { MissionPhase, MissionRules, MissionRuleState, TargetKind } from "../shared/MissionRules";
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";
import { MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { CombatEffectPacket, FinishedCallback, FlightInput, HudState, MissionLoading, MissionStats, Remotes } from "../shared/Types";
import { ExplosionKind } from "../shared/ExplosionFx";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { LoadingGate, LoadingGateState } from "../shared/LoadingGate";
import { ActionGateState, FireNotice, WeaponRules } from "../shared/WeaponRules";
import { SalvoCandidate, SpecialKind, SpecialState, SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty, DifficultyKind, DifficultyKnob } from "../shared/Difficulty";
import { ThreatRules } from "../shared/ThreatRules";
import { MissionWorld } from "./MissionWorld";

type EnemyMode = "attack" | "extend" | "orbit" | "run";
interface Enemy {
	id: string; name: string; model: Model; health: number; maxHealth: number; position: Vector3;
	kind: TargetKind; required: boolean; enabled: boolean;
	direction: Vector3; velocity: Vector3; fireTimer: number; windup: number;
	/** Current maneuver. `extend` is a timed break-away (pass or lock-break), `orbit`/`run` are escort raider cycles. */
	mode: EnemyMode; modeTimer: number; passDirection: Vector3;
	/** +1 or -1: which side of the player's nose this enemy brackets and breaks toward. */
	side: number;
	flares: number; flareTimer: number; stage: number; invulnerableUntil: number; speedBonus: number; lockBreakTimer: number;
	/** Defensive break against an inbound player missile: cooldown until the next roll, and when the current one ends. */
	breakTimer: number; breakUntil: number;
	warning?: BillboardGui;
	groundIndex?: number;
	hiddenParts: { part: BasePart; transparency: number }[];
	/** Latest pivot from this Heartbeat's sub-steps; applied once by flushPivots. */
	frame?: CFrame;
}
interface Projectile {
	/** A player missile without `target` is a blind (unguided) shot that relies on its proximity fuse. */
	part: Part; position: Vector3; direction: Vector3; target?: Enemy; hostile: boolean; age: number;
	/** Fired by an ace (hostile: tighter guidance), and the damage on impact (hull or enemy health). */
	ace: boolean; damage: number;
	/** Guided flight speed. */
	speed: number;
	/** Launched by the special slot: never refunded as a standard missile. */
	special?: boolean;
	/** Hostile only: this missile has already rolled against the player's flare cloud. */
	/** Which flare cloud (session.flareBursts) this missile already rolled against. */
	flareRolled?: number;
	/** Player guided only: range to the target last step, to detect an overshoot of a breaking bandit. */
	lastDistance?: number;
	/** Player guided shot that overshot a breaking bandit: now unguided but keeps its guided lifetime and speed. */
	lostTrack?: boolean;
}
export interface CombatSession {
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	rules?: MissionRuleState;
	blueprintState?: BlueprintState;
	blueprint?: MissionBlueprint;
	missionId: number;
	appliedPhase?: MissionPhase | string; nextHostileAt: number;
	appliedBlueprintPhaseIndex?: number;
	crashReason?: string;
	collisionParams?: RaycastParams;
	health: number; kills: number; elapsed: number; missiles: number; missileCooldown: number;
	evadeCooldown: number; evadeRemaining: number; regen: number; lockProgress: number;
	/** Second weapon slot chosen at the briefing; authoritative charges, cooldown and effect timer. */
	special: SpecialState;
	/** Level chosen at the briefing; scales the act tuning through `tuned()` and enemy health. */
	difficulty: DifficultyKind;
	enemies: Enemy[]; projectiles: Projectile[]; target?: Enemy; telemetryTime: number;
	lastInput: number; lastInputEvent: number; active: boolean; finished: boolean; cleaned: boolean;
	/** Per-action-kind rate limiting for CombatAction events. */
	actionGate?: ActionGateState;
	navigationMarker?: Part; navigationActor?: Model;
	previousReplicationFocus?: BasePart; characterRoot?: BasePart; wasAnchored?: boolean;
	/** Present while the client is still receiving the world; nothing simulates until it is released. */
	loading?: LoadingGateState;
	/** Latest radio line and a serial so the client can detect repeats. */
	radio?: string; radioSerial: number; radioSeconds?: number;
	/** Latest refused FIRE and its serial, so the HUD can show the reason once per press. */
	fireDenied?: FireNotice; fireDeniedSerial?: number;
	/** Mission 1: elapsed time when the tutorial target step began, and whether its hint has aired. */
	targetStepSince?: number; targetStepHinted?: boolean;
	/** Next unfired chatter line of the active phase. */
	chatterIndex: number;
	/** Blueprint phase index whose mid-phase reinforcement has already spawned. */
	reinforcedPhase?: number;
	/** Client stamp of the newest FlightInput, whether a step has used it yet, and how many fixed steps have. */
	inputClientTime: number; inputFresh: boolean; inputSteps: number;
	/** 20 Hz FlightState accumulator and packet sequences for both unreliable streams. */
	stateTime: number; stateSequence: number; telemetrySequence: number;
	/** Last HudState sent; a new one goes out (reliably) only when a field differs. */
	hud?: HudState;
	/** Pending pivots applied once per Heartbeat, after every fixed sub-step. */
	aircraftFrame?: CFrame; actorFrame?: CFrame;
	/** Debrief counters: player missiles launched and connected, hull lost, lowest hull, evades used. */
	missilesFired: number; missileHits: number; flareBursts: number; damageTaken: number; lowestHealth: number; evades: number;
}
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
const MAX_MISSILES = 8;
const PLAYER_MISSILE_DAMAGE = SpecialWeapons.StandardDamage;
// Threat tuning indexed by act (1-3). Missions 1-2 use act 1. Every knob is a plain per-act array so a
// difficulty selector can multiply them in tuned() without touching the combat code.
//   hostileDamage   hull lost per hostile missile hit (aces add 4).
//   windup          seconds a shooter shows MISSILE WARNING before launch.
//   hostileGate     flight-wide spacing after a launch: no enemy starts a new windup until this has elapsed, so the
//                   effective worst-case cadence is windup + gate. Kept >= windup so MISSILE WARNING is never lit permanently.
//   aceGate         the same spacing after an ace launch.
//   banditReload    one bandit's own reload after it fires; aceReload is the ace's.
//   fireAimDot      nose dot a shooter needs on the player; straightRelax is subtracted while the stick is centered.
//   fireRange       [min, max] launch range for bandits.
//   banditHealth    two player missiles still kill a bandit in every act; threat scales through cadence.
//   aceFlares       countermeasures an ace carries.
//   aceHealthScale  multiplier on the catalog aceHealth.
//   aceLockBreak    seconds between ace lock-break notches (x0.6 below a third of health).
//   aceStageSpeed   speed bonus an ace gains at each stage line.
//   aceSalvo        hostile missiles per ace launch.
//   missileTurn     hostile missile steering rate (aces add aceMissileTurn): Act I can be out-turned, Act III must be evaded.
//   missileSpeed    hostile missile speed; missileLife its flight time; missileFuse its proximity radius on the player.
//   breakChance     odds a bandit breaks against an inbound player missile; breakCooldown seconds before it may roll again.
//   breakSeconds    how long the break lasts; breakTurn the bandit's steering rate while breaking.
const TUNING = {
	hostileDamage: [10, 12, 14],
	windup: [2.4, 2.0, 1.7],
	hostileGate: [4.5, 3.5, 3],
	aceGate: [5, 4.5, 4],
	banditReload: [10, 7.5, 5.5],
	aceReload: [7, 5, 3.5],
	fireAimDot: [0.65, 0.55, 0.45],
	straightRelax: [0.2, 0.25, 0.3],
	fireRange: [[450, 1700], [400, 1900], [350, 2100]],
	banditHealth: [100, 110, 110],
	aceFlares: [2, 3, 4],
	aceHealthScale: [1, 1.15, 1.3],
	aceLockBreak: [7, 5.5, 4],
	aceStageSpeed: [30, 40, 55],
	aceSalvo: [1, 1, 2],
	missileTurn: [1.6, 2.2, 2.8],
	aceMissileTurn: [0.6, 0.9, 1.2],
	missileSpeed: [580, 660, 740],
	missileLife: [7, 8, 9],
	missileFuse: [32, 40, 48],
	breakChance: [0.15, 0.4, 0.6],
	breakCooldown: [9, 6, 4],
	breakSeconds: [1.4, 1.6, 1.8],
	breakTurn: [3.5, 4.5, 5.5],
};
const EVADE_COOLDOWN = 6;
const EVADE_INVULNERABLE = FlightPrediction.EvadeRollSeconds; // 1.6 s; the client predicts the same roll
const STATE_INTERVAL = 1 / 20;
const TELEMETRY_INTERVAL = 0.1;
const EVADE_RADIUS = 700;
const FLARE_RADIUS = 260;
function sessionAct(session: CombatSession): 1 | 2 | 3 {
	return session.missionId <= 2 ? 1 : session.blueprint!.act;
}
// Which difficulty knob scales each act-indexed TUNING table; tables absent here are not scaled.
const TUNING_KNOBS = new Map<number[], DifficultyKnob>([
	[TUNING.hostileDamage, "hostileDamage"],
	[TUNING.windup, "windup"],
	[TUNING.hostileGate, "hostileGate"],
	[TUNING.aceGate, "hostileGate"],
	[TUNING.banditReload, "hostileGate"],
	[TUNING.aceReload, "hostileGate"],
	[TUNING.missileTurn, "missileTurn"],
	[TUNING.aceMissileTurn, "missileTurn"],
	[TUNING.missileFuse, "missileTurn"],
	[TUNING.breakChance, "breakChance"],
]);
/** The act's value from a TUNING table, scaled for the session's difficulty. */
function tuned(session: CombatSession, values: number[]): number {
	const value = values[sessionAct(session) - 1];
	const knob = TUNING_KNOBS.get(values);
	return knob === undefined ? value : Difficulty.Scale(session.difficulty, knob, value);
}
function remote<K extends keyof Remotes>(remotes: Remotes | Instance, name: K): Remotes[K] {
	if (typeIs(remotes, "Instance")) return remotes.WaitForChild(name) as Remotes[K];
	assert(remotes[name], `Missing combat remote: ${name}`);
	return remotes[name];
}
function frameFor(state: FlightState): CFrame {
	return new CFrame(state.x, state.y, state.z).mul(CFrame.Angles(0, state.yaw, 0)).mul(CFrame.Angles(state.pitch, 0, state.roll));
}
function positionFor(state: FlightState): Vector3 { return new Vector3(state.x, state.y, state.z); }
function directionFor(state: FlightState): Vector3 {
	const [x, y, z] = FlightMath.Forward(state.yaw, state.pitch);
	return new Vector3(x, y, z);
}
function unitOr(vector: Vector3, fallback: Vector3): Vector3 { return vector.Magnitude > 0.01 ? vector.Unit : fallback; }
function point(vector: Vector3): { x: number; y: number; z: number } { return { x: vector.X, y: vector.Y, z: vector.Z }; }
function ownsEnemy(session: CombatSession, enemy: Enemy | undefined): enemy is Enemy {
	return enemy !== undefined && enemy.enabled && enemy.health > 0 && enemy.model.Parent === session.folder
		&& enemy.model.GetAttribute("SkybreakOwner") === session.player.UserId;
}
function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}

function sessionTotalRequired(session: CombatSession): number {
	if (session.missionId === 1) return 4;
	if (session.missionId === 2) return 9;
	// Required air + required ground + ace = all required destructions.
	const bp = session.blueprint!;
	return MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp);
}

function sessionGroundKills(session: CombatSession): number {
	return session.rules?.groundKills ?? session.blueprintState?.requiredGroundKills ?? 0;
}

function sessionCanDamage(session: CombatSession, kind: TargetKind, required: boolean): boolean {
	if (session.rules) return MissionRules.CanDamage(session.rules, kind, required);
	if (session.blueprintState) {
		const stateKind = kind === "ace" ? "ace" : kind;
		return BlueprintRunner.CanDamage(session.blueprintState, stateKind, required);
	}
	return false;
}

function sessionRecordKill(session: CombatSession, id: string, kind: TargetKind, required: boolean, now: number): boolean {
	if (session.rules) return MissionRules.RecordKill(session.rules, id, kind, required, now);
	if (session.blueprintState) return BlueprintRunner.RecordKill(session.blueprintState, id, kind, required, now);
	return false;
}

function sessionTick(session: CombatSession, now: number, health: number): void {
	if (session.rules) MissionRules.Tick(session.rules, now, health);
	else if (session.blueprintState) BlueprintRunner.Tick(session.blueprintState, now, health);
}

function sessionOutcome(session: CombatSession): "won" | "failed" | undefined {
	return session.crashReason !== undefined ? "failed" : session.rules?.outcome ?? session.blueprintState?.outcome;
}

function sessionReason(session: CombatSession): string | undefined {
	return session.crashReason ?? session.rules?.reason ?? session.blueprintState?.reason;
}

function sessionTimeRemaining(session: CombatSession): number {
	if (session.rules) return MissionRules.TimeRemaining(session.rules);
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
	if (session.rules) {
		const info = MissionRules.Objective(session.rules);
		return {
			phase: session.rules.phase,
			objective: info.objective,
			objectiveProgress: info.objectiveProgress,
			objectiveTotal: info.objectiveTotal,
			tutorialStep: info.tutorialStep,
		};
	}
	assert(session.blueprintState, "session must have rules or blueprintState");
	const info = BlueprintRunner.Objective(session.blueprintState);
	return {
		phase: info.phase,
		objective: info.objective,
		objectiveProgress: info.objectiveProgress,
		objectiveTotal: info.objectiveTotal,
		tutorialStep: "",
	};
}

function acquireTarget(session: CombatSession): void {
	let best: Enemy | undefined;
	let score = math.huge;
	for (const enemy of session.enemies) {
		if (!ownsEnemy(session, enemy)) continue;
		const [distance, dot] = targetMetrics(session, enemy);
		const candidateScore = distance + (dot < 0 ? 5000 : (1 - dot) * 700);
		if (!best || (enemy.required && !best.required) || (enemy.required === best.required && candidateScore < score)) {
			best = enemy; score = candidateScore;
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
			// Only the legacy Mission 1 tutorial watches the CycleTarget event.
			if (session.rules) {
				MissionRules.CycleTarget(session.rules, os.clock());
				applyPhase(session);
			}
			return;
		}
	}
}
function sendTelemetry(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	let incoming = false;
	let lockWarning = false;
	for (const missile of session.projectiles) {
		if (missile.hostile && missile.position.sub(positionFor(session.state)).Magnitude < 1800) { incoming = true; break; }
	}
	// A windup is a lock warning, not a missile: evading now would waste the countermeasure.
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.windup > 0) { lockWarning = true; break; }
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
		kills: session.kills, total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown, evadeCooldown: session.evadeCooldown,
		lockProgress: session.lockProgress, incoming, lockWarning,
		boundaryWarning: math.max(math.abs(session.state.x), math.abs(session.state.z)) > FlightMath.SoftBoundary,
		targetDamageable: target ? sessionCanDamage(session, target.kind, target.required) : undefined,
		elapsed: session.elapsed, timeRemaining: sessionTimeRemaining(session),
		objectiveProgress: objective.objectiveProgress, objectiveTotal: objective.objectiveTotal,
		groundKills: sessionGroundKills(session), targetDistance: distance,
		targetHealth: target ? math.clamp(target.health / math.max(1, target.maxHealth), 0, 1) : undefined,
		protectedHealth: phase?.kind === "escort" || phase?.kind === "defend" ? session.blueprintState?.protectedHealth : undefined,
		specialCharges: session.special.charges, specialCooldown: session.special.cooldown, specialActive: session.special.active,
		aceKilled: session.rules?.aceKilled ?? session.blueprintState?.aceKilled ?? false,
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
		radio: session.radio, radioSerial: session.radioSerial, radioSeconds: session.radioSeconds,
		fireDenied: session.fireDenied, fireDeniedSerial: session.fireDeniedSerial, special: session.special.kind,
	};
	session.hud = hud;
	missionState!.FireClient(session.player, hud);
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
function radio(session: CombatSession, text: string, seconds?: number): void {
	session.radio = text;
	session.radioSerial += 1;
	session.radioSeconds = seconds;
	if (session.active && sessions.get(session.player) === session) sendTelemetry(session);
}
/** Tell the HUD why a FIRE press did nothing; the serial makes every repeated press visible. */
function denyFire(session: CombatSession, reason: FireNotice): void {
	session.fireDenied = reason;
	session.fireDeniedSerial = (session.fireDeniedSerial ?? 0) + 1;
	if (session.active && sessions.get(session.player) === session) sendTelemetry(session);
}
/** Catalog phase index that mirrors a legacy MissionRules phase, so missions 1-2 share the authored beats. */
function legacyPhaseIndex(missionId: number, phase: MissionPhase): number | undefined {
	if (missionId === 1) {
		if (phase === "tutorial_move") return 0;
		if (phase === "tutorial_target") return 1;
		if (phase === "tutorial_missile") return 2;
		if (phase === "tutorial_bandits") return 3;
	} else if (missionId === 2) {
		if (phase === "intercept") return 0;
		if (phase === "warehouses") return 1;
		if (phase === "ace") return 2;
	}
	return undefined;
}
/** Catalog phases finished: the blueprint index, or the legacy phase mapped onto the catalog for missions 1-2. */
function sessionCompletedPhases(session: CombatSession, won: boolean): number | undefined {
	if (session.blueprintState) return session.blueprintState.phaseIndex;
	if (!session.rules) return undefined;
	if (won) return MissionCatalog.Get(session.missionId).phases.size();
	return legacyPhaseIndex(session.missionId, session.rules.phase) ?? 0;
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
function finish(session: CombatSession): void {
	if (!session.active || session.finished) return;
	const outcome = sessionOutcome(session);
	if (outcome === undefined) return;
	session.finished = true;
	session.active = false;
	completing.add(session.player);
	// Sync elapsed from whichever authoritative runner owns the mission.
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	const won = outcome === "won";
	if (!won && (session.health <= 0 || session.crashReason !== undefined)) effect(session, "player", positionFor(session.state), { velocity: directionFor(session.state).mul(session.state.speed) });
	// The result screen waits up to a few seconds for the save; say the outcome on the HUD right away.
	session.radio = won ? "MISSION ACCOMPLISHED · RETURN TO BASE" : "MISSION FAILED";
	session.radioSerial += 1;
	session.radioSeconds = 6;
	sendTelemetry(session);
	const stats: MissionStats = {
		kills: session.kills,
		groundKills: sessionGroundKills(session),
		missionId: session.missionId,
		elapsed: session.elapsed,
		slot: session.slot,
		reason: sessionReason(session),
		completedPhases: sessionCompletedPhases(session, won),
		optionalKills: session.rules?.optionalAirKills ?? session.blueprintState?.optionalAirKills ?? 0,
		missilesFired: session.missilesFired,
		missileHits: session.missileHits,
		damageTaken: session.damageTaken,
		lowestHealth: session.lowestHealth,
		evades: session.evades,
		difficulty: session.difficulty,
	};
	const callback = onFinished!;
	task.defer(() => {
		// The player may have left (session cleaned) in the same frame; the result is still theirs to keep.
		const [ok, message] = pcall(callback, session.player, won, stats);
		if (!ok) {
			warn(`SKYBREAK mission completion callback: ${tostring(message)}`);
			if (!session.cleaned && session.player.Parent === Players) missionState!.FireClient(session.player, {
				kind: won ? "Completed" : "Failed", ...stats, saved: false,
			});
		}
		cleanupSession(session);
		completing.delete(session.player);
	});
}
function refreshSession(session: CombatSession, now: number): boolean {
	if (!session.active) return false;
	// The mission clock is monotonic; never tick it while the client is still loading.
	if (session.loading) return true;
	sessionTick(session, now, session.health);
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	if (sessionOutcome(session) !== undefined) { finish(session); return false; }
	return true;
}
function countParts(root: Instance): number {
	let count = 0;
	for (const item of root.GetDescendants()) if (item.IsA("BasePart")) count++;
	return count;
}
// Leaves the loading gate: the playable clock starts now, and the client gets
// the same "Started" message it always did.
function beginPlay(session: CombatSession): void {
	if (!session.loading || !session.active || session.cleaned) return;
	session.loading = undefined;
	const now = os.clock();
	if (session.rules) { session.rules.startedAt = now; session.rules.elapsed = 0; }
	if (session.blueprintState) { session.blueprintState.startedAt = now; session.blueprintState.elapsed = 0; }
	session.elapsed = 0;
	session.lastInput = now;
	session.telemetryTime = 0;
	session.stateTime = 0;
	session.hud = undefined; // the first HUD message after Started is always complete
	if (session.player.Parent !== Players) { cleanupSession(session); return; }
	missionState!.FireClient(session.player, { kind: "Started", slot: session.slot, missionId: session.missionId, aircraft: session.aircraft, difficulty: session.difficulty });
	if (refreshSession(session, now)) { sendTelemetry(session); sendFlightState(session); }
}
function markTarget(session: CombatSession, enemy: Enemy): void {
	enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled);
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
function spawnAir(session: CombatSession, count: number, required: boolean, ace = false, aceHealth = 165, behind = false): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
	const act = sessionAct(session);
	const aceName = session.blueprint?.aceName ?? "ACE";
	for (let index = 0; index < count; index++) {
		const name = ace ? aceName : `${required ? "BANDIT" : "RAIDER"} 0${index + 1}`;
		const model = JetFactory.Create(name, true);
		if (!session.active || session.folder.Parent === undefined) { model.Destroy(); return; }
		// The replicated model is hidden on the client behind a smoothed local clone; only the clone draws trails.
		JetFactory.SetTrails(model, false);
		// Bandits arrive 1300-1500 studs out and 60-75 degrees off the nose so the first merge is a turn, not a joust.
		// Reinforcements (behind) come from the rear quarter.
		const side = index % 2 === 0 ? 1 : -1;
		const angle = math.rad(behind ? 150 + math.random() * 20 : 60 + math.random() * 15);
		const distance = 1300 + math.random() * 200;
		const offset = forward.mul(math.cos(angle) * distance).add(right.mul(math.sin(angle) * side * distance));
		const spawn = positionFor(session.state).add(offset);
		const position = new Vector3(math.clamp(spawn.X, -2400, 2400), math.clamp(spawn.Y + 60 + math.random() * 60, 230, 900), math.clamp(spawn.Z, -2400, 2400));
		const direction = unitOr(positionFor(session.state).sub(position), forward.mul(-1));
		model.Parent = session.folder;
		model.PivotTo(CFrame.lookAt(position, position.add(direction)));
		const health = math.floor(ace
			? Difficulty.Scale(session.difficulty, "aceHealth", ThreatRules.ScaledHealth(aceHealth, TUNING.aceHealthScale[act - 1]))
			: Difficulty.Scale(session.difficulty, "banditHealth", required ? TUNING.banditHealth[act - 1] : 100));
		const enemy: Enemy = {
			id: `air_${session.enemies.size() + 1}_${missionSerial}`, name, model, health, maxHealth: health,
			position, direction, velocity: direction.mul(300), kind: ace ? "ace" : "air", required, enabled: true,
			fireTimer: 4 + index * 1.5, windup: 0, mode: "attack", modeTimer: 0, passDirection: direction, side,
			flares: ace ? TUNING.aceFlares[act - 1] : 0, flareTimer: 0, stage: 0, invulnerableUntil: 0, speedBonus: 0, lockBreakTimer: TUNING.aceLockBreak[act - 1],
			breakTimer: 0, breakUntil: 0,
			hiddenParts: [], warning: attackWarning(model),
		};
		markTarget(session, enemy);
		session.enemies.push(enemy);
	}
}

// Legacy Mission 1/2 phase application: byte-for-byte compatible with the
// pre-blueprint CombatService behavior that the existing engine tests cover.
function applyLegacyPhase(session: CombatSession): void {
	assert(session.rules, "legacy phase application requires MissionRules state");
	if (session.appliedPhase === session.rules.phase || session.rules.outcome !== undefined) return;
	session.appliedPhase = session.rules.phase;
	const phase = session.rules.phase;
	if (phase === "tutorial_target") activateGround(session);
	else if (phase === "tutorial_bandits" || phase === "intercept") spawnAir(session, 3, true);
	else if (phase === "warehouses") { activateGround(session); spawnAir(session, 5, false); }
	else if (phase === "ace") spawnAir(session, 1, true, true);
	acquireTarget(session);
	const catalogIndex = legacyPhaseIndex(session.missionId, phase);
	const beat = catalogIndex !== undefined ? MissionCatalog.Get(session.missionId).phases[catalogIndex]?.beat : undefined;
	if (beat !== undefined) radio(session, beat);
}

// Blueprint-driven phase application for missions 3-27.
function applyBlueprintPhase(session: CombatSession): void {
	assert(session.blueprintState && session.blueprint, "blueprint phase application requires blueprint state");
	const state=session.blueprintState;
	if (state.outcome !== undefined || session.appliedBlueprintPhaseIndex === state.phaseIndex) return;
	session.appliedBlueprintPhaseIndex=state.phaseIndex;
	session.chatterIndex=0;
	// Retire optional pursuers at the end of their authored window. Never let
	// invisible old waves damage a convoy or count in a later phase. They visibly
	// withdraw, and any missile still chasing them is refunded.
	for (const enemy of session.enemies) if (enemy.kind !== "ground" && enemy.health > 0) {
		enemy.enabled=false; enemy.health=0;
		JetFactory.Burst(session.folder, enemy.position, Color3.fromRGB(240, 244, 248), 6);
		enemy.model.Destroy();
		for (let index = session.projectiles.size() - 1; index >= 0; index--) {
			const missile = session.projectiles[index];
			if (missile.hostile || missile.target !== enemy) continue;
			if (!missile.special) session.missiles = math.min(MAX_MISSILES, session.missiles + 1);
			missile.part.Destroy(); session.projectiles.remove(index);
		}
	}
	session.navigationMarker?.Destroy(); session.navigationMarker=undefined;
	session.navigationActor?.Destroy(); session.navigationActor=undefined;
	// The live list, not the catalog: twists splice new objectives in after the phase that fired them.
	const phases=BlueprintRunner.Phases(state);
	const phase: MissionPhaseBlueprint | undefined=phases[state.phaseIndex];
	if (!phase) return;
	if (phase.kind === "required_ground") {
		let start=0;
		for(let i=0;i<state.phaseIndex;i++) if(phases[i].kind === "required_ground") start+=phases[i].count ?? 0;
		activateGround(session,start,phase.count ?? 0);
	} else if (phase.kind === "required_air") spawnAir(session,phase.count ?? 0,true);
	else if (phase.kind === "ace") spawnAir(session,1,true,true,session.blueprint.aceHealth ?? 165);
	// Ace phases hold their raiders back for the ace's stage calls; reinforced phases keep part of theirs for mid-phase.
	const initialRaiders = phase.kind === "ace" ? 0 : (phase.optionalRaiders ?? 0) - (phase.reinforce?.count ?? 0);
	if (initialRaiders>0) spawnAir(session,initialRaiders,false);
	// A twist that changed the objective speaks first: radio() overwrites, so its call goes out now and
	// the new phase's beat follows a few seconds later (if the sortie is still on this phase). This runs
	// for both the tick path and the synchronous kill path (destroyEnemy -> advance -> applyPhase).
	let twisted=false;
	for (let line=BlueprintRunner.TakeRadio(state); line !== undefined; line=BlueprintRunner.TakeRadio(state)) { radio(session,line,7); twisted=true; }
	if (phase.beat !== undefined) {
		if (!twisted) radio(session, phase.beat);
		else {
			const beat=phase.beat, index=state.phaseIndex;
			task.delay(4, () => { if (session.active && sessions.get(session.player) === session && state.phaseIndex === index && state.outcome === undefined) radio(session, beat); });
		}
	}
	const nav=BlueprintRunner.NavigationPoint(state);
	if (nav) {
		const marker=new Instance("Part"); marker.Name="Flight objective"; marker.Size=new Vector3(20,20,20); marker.Shape=Enum.PartType.Ball;
		marker.Anchored=true; marker.CanCollide=false; marker.CanTouch=false; marker.CanQuery=false;
		marker.Color=Color3.fromRGB(75,238,212); marker.Material=Enum.Material.Neon; marker.Transparency=.3;
		marker.Position=new Vector3(nav.x,nav.y,nav.z); marker.Parent=session.folder;
		marker.SetAttribute("ObjectiveRadius",phase.radius); marker.SetAttribute("ObjectiveCeiling",phase.ceiling);
		session.navigationMarker=marker;
		const gui=new Instance("BillboardGui"); gui.Size=UDim2.fromOffset(160,38); gui.AlwaysOnTop=true; gui.StudsOffsetWorldSpace=new Vector3(0,30,0); gui.Parent=marker;
		const label=new Instance("TextLabel"); label.Size=UDim2.fromScale(1,1); label.BackgroundTransparency=.25;
		label.BackgroundColor3=Color3.fromRGB(7,23,30); label.TextColor3=marker.Color; label.Text=phase.kind === "route" ? "FLIGHT BEACON" : phase.kind === "escort" ? "PROTECT CONVOY" : phase.kind === "defend" ? "PROTECT SITE" : "SIGNAL VOLUME";
		label.TextSize=13; label.Font=Enum.Font.GothamBold; label.Parent=gui;
		if (phase.kind === "escort" || phase.kind === "defend") {
			const coast=session.blueprint.region === "coastal_city" || session.blueprint.region === "ocean_platform";
			const actor=coast ? MissionAssets.CreateHarborLaunch("LOYALIST LAUNCH") : phase.kind === "defend" ? MissionAssets.CreateCommsRelay("LOYALIST TOWER") : MissionAssets.CreateRelayTruck("LOYALIST TRUCK");
			if (!session.active || !session.folder.Parent) {actor.Destroy(); return;}
			// The escorted vehicle moves every step: weld it so one part replicates per move.
			JetFactory.WeldAssembly(actor);
			actor.SetAttribute("ProtectedObjective",true); actor.Parent=session.folder; session.navigationActor=actor;
			actor.PivotTo(new CFrame(nav.x,phase.kind === "defend" ? 92 : nav.y,nav.z));
		}
	}
	// Refresh only at phase transitions: includes new protected actors and drops destroyed ones.
	session.collisionParams = AircraftCollision.Parameters(session.folder);
	acquireTarget(session);
}

function applyPhase(session: CombatSession): void {
	if (session.rules) applyLegacyPhase(session);
	else applyBlueprintPhase(session);
}

function destroyEnemy(session: CombatSession, enemy: Enemy): void {
	if (!ownsEnemy(session, enemy)) return;
	const accepted = sessionRecordKill(session, enemy.id, enemy.kind, enemy.required, os.clock());
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	if (!accepted) { if (sessionOutcome(session) !== undefined) finish(session); return; }
	enemy.health = 0;
	enemy.enabled = false;
	enemy.model.SetAttribute("Health", 0);
	enemy.model.SetAttribute("SkybreakEnemy", false);
	enemy.model.SetAttribute("RequiredTarget", false);
	// Fired before Destroy so the model reference still resolves on the client (its visual becomes the wreck).
	if (enemy.kind === "ground") effect(session, "ground", enemy.position, { scale: math.clamp(enemy.model.GetExtentsSize().Magnitude / 60, 0.7, 2.2) });
	else effect(session, enemy.kind, enemy.position, { velocity: enemy.velocity, model: enemy.model });
	enemy.model.Destroy();
	// Kills count every destruction, air and ground, so the HUD tally matches sessionTotalRequired.
	if (session.rules) {
		session.kills = session.rules.requiredAirKills + session.rules.optionalAirKills + (session.rules.aceKilled ? 1 : 0) + session.rules.groundKills;
	} else if (session.blueprintState) {
		const bs = session.blueprintState;
		session.kills = bs.requiredAirKills + bs.optionalAirKills + (bs.aceKilled ? 1 : 0) + bs.requiredGroundKills;
	}
	applyPhase(session);
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
		direction = unitOr(positionFor(session.state).sub(position), enemy.direction);
		const right = unitOr(new Vector3(-enemy.direction.Z, 0, enemy.direction.X), new Vector3(1, 0, 0));
		const fanned = ThreatRules.SalvoDirection(point(direction), point(right), salvoIndex, salvoCount);
		direction = new Vector3(fanned.x, fanned.y, fanned.z);
		ace = enemy.kind === "ace";
		damage = tuned(session, TUNING.hostileDamage) + (ace ? 4 : 0);
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
	session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, direction, hostile), position, direction, target, hostile, age: 0, ace, damage, speed });
}
/** A guided missile from the special slot at `enemy`; `lateral` offsets the launch rail so a salvo fans out. */
function launchSpecialMissile(session: CombatSession, enemy: Enemy, lateral: number): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
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
		if (!missile.hostile || missile.flareRolled === session.flareBursts || missile.position.sub(position).Magnitude > SpecialWeapons.FlareDecoyRadius) continue;
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
			locked = distance <= range && dot >= WeaponRules.LockDotFor(current.kind === "ground");
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
function evade(session: CombatSession): void {
	if (session.evadeCooldown > 0) return;
	session.evadeCooldown = EVADE_COOLDOWN;
	session.evadeRemaining = EVADE_INVULNERABLE;
	session.evades += 1;
	const position = positionFor(session.state);
	JetFactory.Flares(session.folder, position, frameFor(session.state));
	// Only missiles already close are decoyed; windups in progress still launch, so timing matters.
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		if (missile.hostile && missile.position.sub(position).Magnitude <= EVADE_RADIUS) {
			JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
			missile.part.Destroy(); session.projectiles.remove(index);
		}
	}
}
function stepEnemies(session: CombatSession, dt: number): void {
	const playerPosition = positionFor(session.state);
	const playerForward = directionFor(session.state);
	const playerVelocity = playerForward.mul(session.state.speed);
	const lateral = new Vector3(-playerForward.Z, 0, playerForward.X);
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const site = session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState) : undefined;
	const protectPhase = site !== undefined && (phase?.kind === "escort" || phase?.kind === "defend");
	const windupSeconds = tuned(session, TUNING.windup);
	const hostileGate = tuned(session, TUNING.hostileGate);
	const aceGate = tuned(session, TUNING.aceGate);
	const [fireMin, fireMax] = TUNING.fireRange[sessionAct(session) - 1];
	const aimThreshold = tuned(session, TUNING.fireAimDot);
	const straightRelax = tuned(session, TUNING.straightRelax);
	const playerStraight = ThreatRules.PlayerStraight(session.input.x, session.input.y);
	const breakChance = tuned(session, TUNING.breakChance);
	const breakCooldown = tuned(session, TUNING.breakCooldown);
	const breakSeconds = tuned(session, TUNING.breakSeconds);
	const breakTurn = tuned(session, TUNING.breakTurn);
	const aceLockBreak = tuned(session, TUNING.aceLockBreak);
	// One windup at a time across the flight: the gate starts at launch, so the warning itself must hold the others.
	let windingUp = false;
	for (const enemy of session.enemies) if (enemy.windup > 0 && ownsEnemy(session, enemy)) windingUp = true;
	for (let index = 0; index < session.enemies.size(); index++) {
		const enemy = session.enemies[index];
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") continue;
		const ace = enemy.kind === "ace";
		const separation = playerPosition.sub(enemy.position).Magnitude;
		const speed = math.clamp(session.state.speed + (ace ? 48 : 24), ace ? 320 : 285, ace ? 380 : 350) + enemy.speedBonus;
		enemy.modeTimer = math.max(0, enemy.modeTimer - dt);
		enemy.flareTimer = math.max(0, enemy.flareTimer - dt);
		enemy.breakTimer = math.max(0, enemy.breakTimer - dt);
		if (enemy.mode === "extend" && enemy.modeTimer <= 0) enemy.mode = "attack";
		// Defensive break: a bandit with a player missile inbound may roll to notch hard and dive so the shot overshoots.
		if (!ace && ThreatRules.ShouldBreak({
			inbound: ThreatRules.Inbound(enemy, session.projectiles, (missile) => missile.target, (missile) => missile.position.sub(enemy.position).Magnitude),
			cooldownRemaining: enemy.breakTimer, extending: enemy.mode === "extend", roll: math.random(), chance: breakChance,
		})) {
			enemy.mode = "extend"; enemy.modeTimer = breakSeconds;
			enemy.breakTimer = breakCooldown; enemy.breakUntil = session.elapsed + breakSeconds;
			const pass = ThreatRules.BreakDirection(point(enemy.direction), point(lateral), enemy.side);
			enemy.passDirection = new Vector3(pass.x, pass.y, pass.z);
		}
		// Escort/defend raiders alternate 9 s orbits of the site with 4 s attack runs, staggered by index.
		const protects = protectPhase && !enemy.required;
		if (enemy.mode !== "extend") {
			if (protects) enemy.mode = (session.elapsed + index * 4.3) % 13 < 9 ? "orbit" : "run";
			else if (enemy.mode === "orbit" || enemy.mode === "run") enemy.mode = "attack";
		}
		// Overshoot: break away to the bracket side and climb instead of orbiting the player's tail.
		if (separation < 280 && enemy.mode !== "extend") {
			enemy.mode = "extend"; enemy.modeTimer = ace ? 2.2 : 3.0;
			enemy.passDirection = unitOr(enemy.direction.add(lateral.mul(enemy.side * 0.6)).add(new Vector3(0, 0.3, 0)), enemy.direction);
		}
		// Aces notch hard on the act's cadence when a lock is building on them; a desperate ace notches faster.
		if (ace) {
			enemy.lockBreakTimer = math.max(0, enemy.lockBreakTimer - dt);
			if (enemy.lockBreakTimer <= 0 && session.target === enemy && session.lockProgress > 0.6) {
				enemy.lockBreakTimer = ThreatRules.AceLockBreakInterval(aceLockBreak, enemy.health / enemy.maxHealth);
				enemy.mode = "extend"; enemy.modeTimer = 1.0;
				enemy.passDirection = unitOr(lateral.mul(enemy.side).add(enemy.direction.mul(0.3)), enemy.direction);
				session.lockProgress *= 0.4;
			}
		}
		let desired: Vector3;
		if (enemy.mode === "extend") desired = enemy.passDirection;
		else if (enemy.mode === "orbit") {
			const orbit = new Vector3(site!.x + math.sin(session.elapsed * .4 + index) * 240, 230, site!.z + math.cos(session.elapsed * .4 + index) * 240);
			desired = unitOr(orbit.sub(enemy.position), enemy.direction);
		} else {
			const lead = math.clamp(separation / (speed + session.state.speed), 0.35, 1.8);
			const weave = math.sin(session.elapsed * (ace ? 1.7 : 0.65) + index * 1.8) * (ace ? 125 : 45);
			let destination = playerPosition.add(playerVelocity.mul(lead)).add(lateral.mul(weave)).add(new Vector3(0, ace ? math.sin(session.elapsed * 1.4) * 65 : 25, 0));
			// Bracket from the side while far out; aces also bias toward the player's rear quarter.
			if (separation > 1100) destination = destination.add(lateral.mul(enemy.side * 500));
			if (ace && separation > 600) destination = destination.sub(playerForward.mul(250));
			desired = unitOr(destination.sub(enemy.position), enemy.direction);
		}
		const oldDirection = enemy.direction;
		const breaking = enemy.breakUntil > session.elapsed;
		enemy.direction = unitOr(oldDirection.Lerp(desired, FlightMath.DampAlpha(breaking ? breakTurn : ace ? 2.8 : 2.1, dt)), oldDirection);
		enemy.velocity = enemy.direction.mul(speed);
		const moved = enemy.position.add(enemy.velocity.mul(dt));
		enemy.position = new Vector3(math.clamp(moved.X, -2700, 2700), math.clamp(moved.Y, 170, 1000), math.clamp(moved.Z, -2700, 2700));
		const bank = math.clamp(-oldDirection.Cross(enemy.direction).Y * 26, -0.65, 0.65);
		// Applied once per Heartbeat by flushPivots: a hitch's catch-up sub-steps replicate one CFrame, not five.
		enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction)).mul(CFrame.Angles(0, 0, bank));
		enemy.fireTimer = math.max(0, enemy.fireTimer - dt);
		const aimDot = enemy.direction.Dot(unitOr(playerPosition.sub(enemy.position), enemy.direction));
		const mayFire = enemy.mode === "attack" || enemy.mode === "run";
		if (enemy.windup > 0) {
			enemy.windup = math.max(0, enemy.windup - dt);
			if (enemy.windup <= 0) {
				enemy.warning!.Enabled = false;
				enemy.model.SetAttribute("AttackWarning", false);
				if (separation < 2300) {
					const salvo = ace ? tuned(session, TUNING.aceSalvo) : 1;
					for (let shot = 0; shot < salvo; shot++) launchMissile(session, true, enemy, shot, salvo);
				}
				enemy.fireTimer = tuned(session, ace ? TUNING.aceReload : TUNING.banditReload);
				// The flight-wide gate runs from the launch, so the warning light and the lull never overlap.
				session.nextHostileAt = session.elapsed + (ace ? aceGate : hostileGate);
			}
		} else if (mayFire && ThreatRules.MayFire({
			separation, aimDot, fireTimer: enemy.fireTimer, globalReady: !windingUp && session.elapsed >= session.nextHostileAt,
			evading: session.evadeRemaining > 0, playerStraight, minRange: fireMin, maxRange: ace ? fireMax + 200 : fireMax,
			aimThreshold, straightRelax,
		})) {
			enemy.windup = windupSeconds; windingUp = true;
			enemy.warning!.Enabled = true;
			enemy.model.SetAttribute("AttackWarning", true);
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
	session.missileHits += 1;
	// Staged ace: the hit bursts harmlessly while it breaks away.
	if (enemy.invulnerableUntil > session.elapsed) return true;
	let damage = session.projectiles[index].damage > 0 ? session.projectiles[index].damage : PLAYER_MISSILE_DAMAGE;
	// A heavy hit stops at the ace's next stage line so no stage (radio call, raiders) is skipped.
	if (enemy.kind === "ace" && enemy.stage < 2) {
		const stageLine = enemy.maxHealth * (enemy.stage === 0 ? 2 / 3 : 1 / 3);
		if (enemy.health > stageLine) damage = math.min(damage, enemy.health - stageLine);
	}
	if (enemy.health <= damage) {
		session.projectiles[index].part.Destroy(); session.projectiles.remove(index);
		destroyEnemy(session, enemy);
		return false;
	}
	const before = enemy.health / enemy.maxHealth;
	enemy.health -= damage;
	enemy.model.SetAttribute("Health", enemy.health);
	if (enemy.kind === "ace") aceStage(session, enemy, before, enemy.health / enemy.maxHealth);
	return true;
}
/** Mission 1 target step: after 8 s without a TGT press, say what the step wants. Auto-selection never skips it. */
function stepTutorialHint(session: CombatSession): void {
	if (session.rules?.phase !== "tutorial_target") { session.targetStepSince = undefined; return; }
	if (session.targetStepSince === undefined) session.targetStepSince = session.elapsed;
	if (session.targetStepHinted || session.elapsed - session.targetStepSince < 8) return;
	session.targetStepHinted = true;
	radio(session, "Select the radar: TGT / Tab / Y");
}
/** An ace crossing 2/3 or 1/3 health calls a stage: brief invulnerability, a radio line, more speed and its held-back raiders. */
function aceStage(session: CombatSession, enemy: Enemy, before: number, after: number): void {
	const threshold = enemy.stage === 0 ? 2 / 3 : enemy.stage === 1 ? 1 / 3 : -1;
	if (threshold < 0 || !(before > threshold && after <= threshold)) return;
	enemy.stage += 1;
	enemy.invulnerableUntil = session.elapsed + 1.2;
	enemy.speedBonus += tuned(session, TUNING.aceStageSpeed);
	const lines = session.blueprint?.aceStages;
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const raiders = phase?.kind === "ace" ? phase.optionalRaiders ?? 0 : 0;
	const first = math.ceil(raiders / 2);
	const count = enemy.stage === 1 ? first : raiders - first;
	const fallback = count > 0 ? `${enemy.name}: Not bad, trainee. Wing, on me.` : enemy.stage === 1 ? `${enemy.name}: Not bad, trainee. Again.` : `${enemy.name}: Enough. Head on.`;
	radio(session, lines?.[enemy.stage - 1] ?? fallback);
	if (count > 0) spawnAir(session, count, false, false, 165, true);
}
function stepMissiles(session: CombatSession, dt: number): void {
	stepTutorialHint(session);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		missile.age += dt;
		const blind = !missile.hostile && missile.target === undefined;
		let removed = missile.age > (missile.hostile ? tuned(session, TUNING.missileLife) : blind && !missile.lostTrack ? WeaponRules.UnguidedLifetime : WeaponRules.GuidedLifetime)
			|| (!missile.hostile && !blind && !ownsEnemy(session, missile.target));
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
				// Aces decoy blind shots exactly like guided ones.
				if (enemy.kind === "ace" && enemy.flares > 0 && enemy.flareTimer <= 0) {
					enemy.flares -= 1; enemy.flareTimer = 5;
					JetFactory.Flares(session.folder, enemy.position);
					JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 4);
					radio(session, `${enemy.name} deployed flares`);
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
			const targetPosition = missile.hostile ? positionFor(session.state) : missile.target!.position;
			const velocity = missile.hostile ? directionFor(session.state).mul(session.state.speed) : missile.target!.velocity;
			const speed = missile.speed;
			const distance = targetPosition.sub(missile.position).Magnitude;
			// A live flare cloud: each hostile missile that enters it rolls once to be decoyed.
			if (missile.hostile && missile.flareRolled !== session.flareBursts && session.special.kind === "flares" && session.special.active > 0 && distance <= SpecialWeapons.FlareDecoyRadius) {
				missile.flareRolled = session.flareBursts;
				if (SpecialWeapons.FlareDecoys(math.random(), missile.ace)) {
					JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
					missile.part.Destroy(); session.projectiles.remove(index);
					continue;
				}
			}
			// Ace flares decoy a player missile that gets close while the ace still has countermeasures.
			if (!missile.hostile) {
				const target = missile.target!;
				// A bandit mid defensive break that the missile has started to overshoot slips the seeker: the shot flies on blind.
				if (ThreatRules.LosesTrack({ breaking: target.breakUntil > session.elapsed, distance, previousDistance: missile.lastDistance ?? distance, fuseRadius: WeaponRules.FuseRadius })) {
					missile.target = undefined; missile.lostTrack = true;
					missile.position = missile.position.add(missile.direction.mul(speed * dt));
					missile.part.CFrame = CFrame.lookAt(missile.position, missile.position.add(missile.direction));
					continue;
				}
				missile.lastDistance = distance;
				if (target.kind === "ace" && target.flares > 0 && target.flareTimer <= 0 && distance < FLARE_RADIUS) {
					target.flares -= 1; target.flareTimer = 5;
					JetFactory.Flares(session.folder, target.position);
					JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 4);
					radio(session, `${target.name} deployed flares`);
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
				if (missile.hostile) {
					if (session.evadeRemaining <= 0) {
						const lost = math.min(session.health, missile.damage);
						session.health -= lost;
						session.damageTaken += lost;
						session.lowestHealth = math.min(session.lowestHealth, session.health);
					}
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
	if (!refreshSession(session, os.clock())) return;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeCooldown = math.max(0, session.evadeCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	SpecialWeapons.Tick(session.special, dt);
	session.regen += dt;
	if (session.regen >= 2.5) { session.regen -= 2.5; session.missiles = math.min(MAX_MISSILES, session.missiles + 1); }
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; }
	// Legacy Mission 1 observes real control usage during its tutorial phases.
	if (session.rules) MissionRules.ObserveControls(session.rules, session.input.x, session.input.y, dt, os.clock());
	if (sessionOutcome(session) !== undefined) { finish(session); return; }
	applyPhase(session);
	const from={x:session.state.x,y:session.state.y,z:session.state.z};
	if (session.inputFresh) { session.inputFresh = false; session.inputSteps = 0; }
	FlightMath.Step(session.state, session.input, dt);
	// Resolve impacts before navigation, phase completion, enemy fire or missile kills.
	const hit = AircraftCollision.Sweep(new Vector3(from.x, from.y, from.z), new Vector3(session.state.x, session.state.y, session.state.z), session.collisionParams!);
	if (hit) {
		session.crashReason = AircraftCollision.Reason(hit);
		finish(session);
		return;
	}
	session.inputSteps += 1;
	if (session.blueprintState) {
		const bs=session.blueprintState, nav=BlueprintRunner.NavigationPoint(bs);
		let threats=0;
		if (nav) for(const enemy of session.enemies) if(ownsEnemy(session,enemy) && enemy.kind !== "ground" && enemy.position.sub(new Vector3(nav.x,230,nav.z)).Magnitude < 650) threats++;
		BlueprintRunner.ObserveFlight(bs,from,{x:session.state.x,y:session.state.y,z:session.state.z},dt,os.clock(),threats);
		if (bs.outcome !== undefined) {finish(session); return;}
		applyPhase(session);
		// Mid-phase "after" twists do not change phase, so applyBlueprintPhase never sees their radio: drain it here.
		for (let line=BlueprintRunner.TakeRadio(bs); line !== undefined; line=BlueprintRunner.TakeRadio(bs)) radio(session,line,7);
		const active=BlueprintRunner.ActivePhase(bs);
		if (active) {
			const fraction=BlueprintRunner.Fraction(bs);
			if (active.reinforce && session.reinforcedPhase !== bs.phaseIndex && fraction >= active.reinforce.at) {
				session.reinforcedPhase=bs.phaseIndex;
				spawnAir(session,active.reinforce.count,false,false,165,true);
			}
			const chatter=active.chatter;
			if (chatter) while (session.chatterIndex < chatter.size() && fraction >= chatter[session.chatterIndex].at) {
				radio(session,chatter[session.chatterIndex].text);
				session.chatterIndex += 1;
			}
		}
		const point=BlueprintRunner.NavigationPoint(bs);
		if (point && session.navigationMarker) {
			const pos=new Vector3(point.x,point.y,point.z);
			session.navigationMarker.Position=pos;
			const actor=session.navigationActor;
			if(actor) {
				const phase=BlueprintRunner.ActivePhase(bs)!;
				const old=actor.GetPivot().Position;
				const direction=new Vector3(pos.X-old.X,0,pos.Z-old.Z);
				const y=phase.kind === "defend" ? 92 : pos.Y;
				const current=new Vector3(pos.X,y,pos.Z);
				session.actorFrame = direction.Magnitude>.01 ? CFrame.lookAt(current,current.add(direction)) : new CFrame(current);
			}
		}
	}
	let flightFrame = frameFor(session.state);
	if (session.evadeRemaining > 0) flightFrame = flightFrame.mul(CFrame.Angles(0, 0, (1 - session.evadeRemaining / EVADE_INVULNERABLE) * math.pi * 2));
	session.aircraftFrame = flightFrame;
	stepEnemies(session, dt);
	if (!ownsEnemy(session, session.target)) acquireTarget(session);
	if (session.target) {
		const [distance, dot] = targetMetrics(session, session.target);
		session.lockProgress = distance <= SpecialWeapons.LockRange(session.special) && dot >= WeaponRules.LockDotFor(session.target.kind === "ground")
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
	if (pivotParts.size() > 0) Workspace.BulkMoveTo(pivotParts, pivotFrames, Enum.BulkMoveMode.FireCFrameChanged);
}

// Clients supply validated controls and button events, never damage or results.
export const CombatService = {
	EndMission(player: Player): void {
		const session = sessions.get(player);
		if (session) cleanupSession(session);
	},
	GetSession(player: Player): CombatSession | undefined { return sessions.get(player); },
	IsActive(player: Player): boolean { return sessions.get(player)?.active ?? false; },
	StartMission(player: Player, slot: number, missionId = 1, special?: unknown, difficulty?: unknown): LuaTuple<[boolean, string?]> {
		if (!missionState || !onFinished) return $tuple(false, "CombatService is not initialized");
		if (!FlightMath.IsFinite(slot) || slot % 1 !== 0 || slot < 1 || slot > 4) return $tuple(false, "Choose a save slot from 1 to 4");
		if (!MissionCatalog.IsValidId(missionId)) return $tuple(false, "Choose a valid mission");
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
			const legacy = missionId === 1 || missionId === 2;
			const world = MissionWorld.Build(missionId, folder);
			assert(player.Parent === Players, "Player left during world construction");
			if (legacy) {
				assert(world.groundTargets.size() === (missionId === 1 ? 1 : 5), "Mission world has an incorrect ground target count");
			} else {
				const blueprint = MissionCatalog.Get(missionId);
				assert(world.groundTargets.size() === blueprint.ground.size(), `Mission ${missionId} world ground target count mismatch`);
			}
			const aircraft = JetFactory.Create("SKYBREAK - Kestrel", false);
			assert(player.Parent === Players, "Player left during aircraft construction");
			aircraft.SetAttribute("SkybreakOwner", player.UserId);
			aircraft.SetAttribute("SkybreakPlayer", true);
			JetFactory.SetTrails(aircraft, false); // the client flies a predicted local clone that owns the trails
			aircraft.Parent = folder;
			const state = FlightMath.NewState();
			aircraft.PivotTo(frameFor(state));
			const session: CombatSession = {
				player, slot, folder, aircraft, state, missionId, nextHostileAt: 4, radioSerial: 0, chatterIndex: 0,
				input: { x: 0, y: 0, throttle: 0.65 }, health: 100, kills: 0, elapsed: 0,
				missiles: MAX_MISSILES, missileCooldown: 0, evadeCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				special: SpecialWeapons.New(specialKind),
				difficulty: difficultyKind,
				enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
				inputClientTime: 0, inputFresh: false, inputSteps: 0, stateTime: 0, stateSequence: 0, telemetrySequence: 0,
				missilesFired: 0, missileHits: 0, flareBursts: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
			};
			if (legacy) {
				session.rules = MissionRules.NewState(missionId as 1 | 2, startedAt);
			} else {
				session.blueprint = MissionCatalog.Get(missionId);
				session.blueprintState = BlueprintRunner.NewState(session.blueprint, startedAt);
			}
			for (let index = 0; index < world.groundTargets.size(); index++) {
				const model = world.groundTargets[index];
				assert(model.Parent === folder && model.PrimaryPart !== undefined, "Ground target must have a stationary aim center in its session");
				const enemy: Enemy = {
					id: `ground_${index + 1}_${missionSerial}`, name: model.Name, model, health: 55, maxHealth: 55,
					position: model.PrimaryPart.Position, direction: new Vector3(0, 0, -1), velocity: Vector3.zero,
					kind: "ground", groundIndex: index, required: true, enabled: false, fireTimer: 0, windup: 0,
					mode: "attack", modeTimer: 0, passDirection: new Vector3(0, 0, -1), side: 1,
					flares: 0, flareTimer: 0, stage: 0, invulnerableUntil: 0, speedBonus: 0, lockBreakTimer: 0, breakTimer: 0, breakUntil: 0, hiddenParts: [],
				};
				// Legacy Mission 1 hides the training radar until the tutorial activates it.
				const hideUntilActivated = missionId === 1;
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
			// The opening wave is created here (JetFactory may yield on first mesh
			// generation, which is safe on this RemoteFunction thread) so its parts
			// replicate under the loading screen. Enemy timers only advance once play
			// begins, so this is gameplay-equivalent to spawning at launch.
			applyPhase(session);
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
			if (!session?.active || session.loading || !typeIs(payload, "table")) return;
			const now = os.clock();
			if (!refreshSession(session, now)) return;
			const data = payload as { x?: unknown; y?: unknown; throttle?: unknown; t?: unknown };
			if (!FlightMath.IsFinite(data.x) || !FlightMath.IsFinite(data.y) || !FlightMath.IsFinite(data.throttle)) return;
			// Unreliable packets can arrive out of order or bunched together. Staleness is
			// decided by the client's stamp first, so the newest of two packets that land in
			// the same few milliseconds always wins (the client already caps its own rate).
			// Unstamped packets keep the old 1/40 s floor.
			const clientTime = FlightMath.IsFinite(data.t) && data.t > 0 ? data.t : 0;
			if (clientTime > 0) {
				if (clientTime < session.inputClientTime) return;
			} else if (now - session.lastInputEvent < 1 / 40) return;
			session.lastInputEvent = now;
			session.input.x = math.clamp(data.x, -1, 1);
			session.input.y = math.clamp(data.y, -1, 1);
			session.input.throttle = math.clamp(data.throttle, 0, 1);
			session.lastInput = now;
			// The echo counts fixed steps from the first one that uses this input (see sendFlightState).
			if (clientTime > 0) { session.inputClientTime = clientTime; session.inputFresh = true; }
		}));
		connections.push(remote(remotes, "CombatAction").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || !typeIs(payload, "table")) return;
			const data = payload as { action?: unknown };
			if (!typeIs(data.action, "string")) return;
			const now = os.clock();
			if (session.loading) {
				// The client has the aircraft and world locally; release the gate now.
				if (data.action === "Ready") { LoadingGate.MarkReady(session.loading); if (LoadingGate.Release(session.loading, now)) beginPlay(session); }
				return;
			}
			if (!refreshSession(session, now) || !WeaponRules.IsActionKind(data.action)) return;
			// Rate limited per action kind: a TGT tap followed closely by FIRE still fires.
			session.actionGate ??= WeaponRules.NewActionGate();
			if (!WeaponRules.AcceptAction(session.actionGate, data.action, now)) return;
			if (data.action === "FireMissile") launchMissile(session, false);
			else if (data.action === "Evade") evade(session);
			else if (data.action === "CycleTarget") cycleTarget(session);
			else if (data.action === "Special") activateSpecial(session);
		}));
		connections.push(Players.PlayerRemoving.Connect((player) => CombatService.EndMission(player)));
		let accumulator = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			const now = os.clock();
			for (const [, session] of sessions) {
				if (session.loading) { if (LoadingGate.Release(session.loading, now)) beginPlay(session); continue; }
				refreshSession(session, now);
			}
			if (!FlightMath.IsFinite(dt) || dt <= 0) return;
			accumulator = math.min(accumulator + dt, FIXED_STEP * 5);
			while (accumulator >= FIXED_STEP) {
				accumulator -= FIXED_STEP;
				for (const [, session] of sessions) if (session.active && !session.loading) stepSession(session, FIXED_STEP);
			}
			// Only the last sub-step's pivots matter; move every model once per Heartbeat.
			for (const [, session] of sessions) if (session.active && !session.loading) flushPivots(session);
		}));
	},
};
