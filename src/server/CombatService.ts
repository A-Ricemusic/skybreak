import { WorldAirspace } from "../shared/WorldAirspace";
import { CombatBalance } from "../shared/CombatBalance";
import { AircraftCollision } from "./AircraftCollision";
import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { MissionAssets } from "../shared/MissionAssets";
import { AssetSelection } from "../shared/AssetSelection";
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
import { EvadeRules, EvadeState } from "../shared/EvadeRules";
import { AceRules, AceStageState } from "../shared/AceRules";
import { AirRequest, WavePlan } from "../shared/WavePlan";
import { PauseRules, PauseState, Settlement, SettlementHooks, SettlementState, StepGuard, StepGuardState } from "../shared/SessionGuard";
import { MissionWorld } from "./MissionWorld";
import { ActorFooting, ActorGrounding } from "./ActorGrounding";

type EnemyMode = "attack" | "extend" | "orbit" | "run";
/** What an air enemy is: a required bandit, an optional raider, the courier of a chase phase, or the ace. */
type AirRole = "bandit" | "raider" | "courier" | "ace";
interface Enemy {
	id: string; name: string; model: Model; health: number; maxHealth: number; position: Vector3;
	kind: TargetKind; required: boolean; enabled: boolean;
	direction: Vector3; velocity: Vector3; fireTimer: number; windup: number;
	/** Current maneuver. `extend` is a timed break-away (pass or lock-break), `orbit`/`run` are escort raider cycles. */
	mode: EnemyMode; modeTimer: number; passDirection: Vector3;
	/** +1 or -1: which side of the player's nose this enemy brackets and breaks toward. */
	side: number;
	flares: number; flareTimer: number; speedBonus: number; lockBreakTimer: number;
	/** A popped flare decoys every player missile within ThreatRules.FlareRadius until this elapsed time. */
	flareUntil: number;
	/** Defensive break (lock building close, or a guided missile inbound): cooldown until the next one, and when the current one ends. */
	breakTimer: number; breakUntil: number;
	/** Odds this enemy breaks out of a close lock (act, difficulty and Ace behaviour). */
	lockBreakChance: number;
	role?: AirRole;
	/** Ace only: stage, retreat/hold mode and stage invulnerability (AceRules). */
	aceState?: AceStageState;
	/** Courier only: where it runs. */
	escape?: Vector3;
	/** Retired at a phase change: flying out for the boundary until this elapsed time, then removed. Never targetable. */
	withdrawUntil?: number;
	/** Ground-avoidance: climbing away from scenery ahead until this elapsed time. */
	pullUpUntil?: number;
	warning?: BillboardGui;
	groundIndex?: number;
	hiddenParts: { part: BasePart; transparency: number }[];
	/** Latest pivot from this Heartbeat's sub-steps; applied once by flushPivots. */
	frame?: CFrame;
	/** Last `Damageable` attribute written (publishDamageable), so it only replicates on change. */
	damageable?: boolean;
}
interface Projectile {
	/** A player missile without `target` is a blind (unguided) shot that relies on its proximity fuse. */
	part: Part; position: Vector3; direction: Vector3; target?: Enemy; hostile: boolean; age: number;
	/** Fired by an ace (hostile: tighter guidance), and the damage on impact (hull or enemy health). */
	ace: boolean; damage: number;
	/** Guided flight speed. */
	speed: number;
	/** Hostile only: flight time at launch, so an evade can spot a missile in its last 1.2 s. */
	life?: number;
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
	appliedPhase?: MissionPhase | string;
	/** Elapsed time the flight's last windup started (aces keep their own reloads and ignore it). */
	lastWindupAt: number;
	appliedBlueprintPhaseIndex?: number;
	crashReason?: string;
	collisionParams?: RaycastParams;
	health: number; kills: number; elapsed: number; missiles: number; missileCooldown: number;
	/** Seconds left of the evade barrel roll. */
	evadeRemaining: number; regen: number; lockProgress: number;
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
	/** Evade charges and the decoy window (EvadeRules). */
	evade: EvadeState;
	/** Error isolation and re-entrancy for this session's steps (StepGuard). */
	guard: StepGuardState;
	/** Pause budget and the current pause (PauseRules); nothing steps while paused. */
	pause: PauseState;
	/** Highest client Pause/Resume serial handled, echoed in telemetry so the client knows its request landed. */
	pauseAck: number;
	/** Result save and teardown once the sortie ends (Settlement), and the hooks finish() chose. */
	settlement: SettlementState; settleHooks?: SettlementHooks;
	/** Per-sortie name counters so every bandit and raider has a unique call sign, and a spawn counter for unique kill ids. */
	banditSerial: number; raiderSerial: number; spawnSerial: number;
	/** Staggered groups of the active required_air phase (WavePlan). */
	wave?: { phaseIndex: number; plan: number[]; next: number; lastAt: number };
	/** Reinforcement waves already spawned in the active phase. */
	reinforceIndex: number;
	/** Bandits and raiders waiting for a slot under the live-aircraft budget (WavePlan.Admit). */
	airQueue: AirRequest[];
	/** Phase index whose hazard targets are already lit. */
	hazardPhase?: number;
	/** Mission 1: the post-radar bandits have launched. */
	tutorialBanditsSpawned?: boolean;
	practiceHintAt?: number;
	/** Surfaces protected actors stand on (scenery and terrain only, captured before any actor exists). */
	groundParams?: RaycastParams;
	/** The protected actor's footing, for re-grounding it as it moves. */
	actorFooting?: ActorFooting;
	/** Fixed steps run, for staggering occasional per-enemy work (ground-avoidance rays). */
	stepCount: number;
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
const SPAWN_LIMIT = WorldAirspace.spawnLimit;
/** A retired raider flies for the boundary this long before it is removed. */
const WITHDRAW_SECONDS = 4;
/** Ground-avoidance look-ahead for enemy jets, and how often each jet casts it. */
const AVOID_RANGE = 200;
const AVOID_EVERY = 3;
/** The evade barrel roll (cosmetic, and no new windups start during it); the client predicts the same roll. */
const EVADE_ROLL = FlightPrediction.EvadeRollSeconds;
const STATE_INTERVAL = 1 / 20;
const TELEMETRY_INTERVAL = 0.1;
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
/** Extra raiders per wave for the session's difficulty (Ace: one). */
function extraRaiders(session: CombatSession): number { return Difficulty.Behaviour(session.difficulty).extraRaiders; }
/** A raider wave of `count`, plus the difficulty's extra (legacy Mission 2 keeps its fixed five). */
function raiderWave(session: CombatSession, count: number): number {
	return count > 0 && !session.rules ? count + extraRaiders(session) : count;
}
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

/** Required destructions so far: bandits, couriers, the ace and ground targets (never raiders). */
function sessionRequiredKills(session: CombatSession): number {
	const state = session.rules ?? session.blueprintState;
	if (!state) return 0;
	const ground = session.rules ? session.rules.groundKills : session.blueprintState!.requiredGroundKills;
	return state.requiredAirKills + (state.aceKilled ? 1 : 0) + ground;
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
			// Only the legacy Mission 1 tutorial watches the CycleTarget event.
			if (session.rules) {
				MissionRules.CycleTarget(session.rules, os.clock());
				applyPhase(session);
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
	let lockWarning = false;
	let incomingDistance = math.huge;
	for (const missile of session.projectiles) {
		if (!missile.hostile) continue;
		const range = missile.position.sub(positionFor(session.state)).Magnitude;
		incomingDistance = math.min(incomingDistance, range);
		if (range < 1800) incoming = true;
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
		// The HUD tally counts required destructions only; raiders travel separately so it never reads 7/4.
		kills: sessionRequiredKills(session), total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown, evadeCooldown: EvadeRules.Cooldown(session.evade, session.evadeRemaining),
		lockProgress: session.lockProgress, incoming, lockWarning,
		boundaryWarning: math.max(math.abs(session.state.x), math.abs(session.state.z)) > FlightMath.SoftBoundary,
		targetDamageable: target ? canHurt(session, target) : undefined,
		elapsed: session.elapsed, timeRemaining: sessionTimeRemaining(session),
		objectiveProgress: objective.objectiveProgress, objectiveTotal: objective.objectiveTotal,
		groundKills: sessionGroundKills(session), targetDistance: distance,
		targetHealth: target ? math.clamp(target.health / math.max(1, target.maxHealth), 0, 1) : undefined,
		protectedHealth: phase?.kind === "escort" || phase?.kind === "defend" ? session.blueprintState?.protectedHealth : undefined,
		specialCharges: session.special.charges, specialCooldown: session.special.cooldown, specialActive: session.special.active,
		aceKilled: session.rules?.aceKilled ?? session.blueprintState?.aceKilled ?? false,
		paused: PauseRules.Paused(session.pause),
		pauseAck: session.pauseAck,
		pauseRemaining: PauseRules.Remaining(session.pause, os.clock()),
		turnObserved: session.rules?.phase === "tutorial_move" ? session.rules.turnObserved : undefined,
		pitchObserved: session.rules?.phase === "tutorial_move" ? session.rules.pitchObserved : undefined,
		evadeCharges: session.evade.charges,
		optionalKills: session.rules?.optionalAirKills ?? session.blueprintState?.optionalAirKills ?? 0,
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
/** Debrief counters handed to the completion callback. */
function missionStats(session: CombatSession, won: boolean): MissionStats {
	return {
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
	// Sync elapsed from whichever authoritative runner owns the mission.
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	// Every settlement step is protected: a throw anywhere still tears the world down and releases the player.
	session.settleHooks = settlementHooks(session, outcome === "won");
	Settlement.Begin(session.settlement, session.settleHooks);
}
function refreshSession(session: CombatSession, now: number): boolean {
	if (!session.active) return false;
	// The mission clock is monotonic; never tick it while the client is still loading or the sortie is paused.
	if (session.loading || PauseRules.Paused(session.pause)) return true;
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
interface SpawnOptions {
	/** Arrive from the rear quarter (reinforcements, flanking groups, an ace's wing). */
	behind?: boolean;
	aceHealth?: number;
	/** Courier only: where it runs. */
	escape?: Vector3;
}
function spawnAir(session: CombatSession, count: number, role: AirRole, options: SpawnOptions = {}): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
	const act = sessionAct(session);
	const behaviour = Difficulty.Behaviour(session.difficulty);
	// Taken before the loop: the enemy list grows as each one spawns, which would give a group one side.
	const sides = WavePlan.BracketSides(session.spawnSerial, count);
	for (let index = 0; index < count; index++) {
		let name: string;
		if (role === "ace") name = session.blueprint?.aceName ?? "ACE";
		else if (role === "courier") name = session.missionId === 24 ? "FUEL TANKER" : "COURIER";
		else if (role === "bandit") { session.banditSerial += 1; name = string.format("BANDIT %02d", session.banditSerial); }
		else { session.raiderSerial += 1; name = string.format("RAIDER %02d", session.raiderSerial); }
		const model = JetFactory.Create(name, true, role === "ace" ? AssetSelection.LiveryForAce(session.blueprint?.aceName) : undefined);
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
		const px = math.clamp(spawn.X, -SPAWN_LIMIT, SPAWN_LIMIT), pz = math.clamp(spawn.Z, -SPAWN_LIMIT, SPAWN_LIMIT);
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
		const position = new Vector3(px, py, pz);
		const direction = role === "courier" && options.escape
			? unitOr(options.escape.sub(position), forward)
			: unitOr(positionFor(session.state).sub(position), forward.mul(-1));
		model.Parent = session.folder;
		model.PivotTo(CFrame.lookAt(position, position.add(direction)));
		const baseHealth = role === "ace" ? options.aceHealth ?? 165 : role === "bandit" ? TUNING.banditHealth[act - 1] : role === "courier" ? COURIER_HEALTH : RAIDER_HEALTH;
		const health = math.floor(role === "bandit" ? Difficulty.BanditHealth(session.difficulty, act, baseHealth)
			: role === "ace" ? Difficulty.Scale(session.difficulty, "aceHealth", baseHealth)
			: Difficulty.SupportHealth(session.difficulty, baseHealth));
		// Bandits and couriers break close locks; the opening sorties stay gentle unless the level says every bandit breaks.
		const lockBreakChance = role === "ace" ? 0 : behaviour.banditsAlwaysBreak ? 1 : gentle(session) ? 0 : math.clamp(tuned(session, TUNING.lockBreakChance), 0, 1);
		const flares = role === "ace" ? TUNING.aceFlares[act - 1] : role === "bandit" ? math.max(TUNING.banditFlares[act - 1], behaviour.banditFlares) : 0;
		session.spawnSerial += 1;
		const enemy: Enemy = {
			id: `air_${session.spawnSerial}_${missionSerial}`, name, model, health, maxHealth: health,
			position, direction, velocity: direction.mul(300), kind: role === "ace" ? "ace" : "air", required: role !== "raider", enabled: true,
			fireTimer: role === "courier" ? math.huge : 4 + index * 1.5, windup: 0, mode: "attack", modeTimer: 0, passDirection: direction, side,
			flares, flareTimer: 0, flareUntil: 0, speedBonus: 0, lockBreakTimer: TUNING.aceLockBreak[act - 1],
			breakTimer: 0, breakUntil: 0, lockBreakChance, role,
			aceState: role === "ace" ? AceRules.New() : undefined, escape: options.escape,
			hiddenParts: [], warning: attackWarning(model),
		};
		markTarget(session, enemy);
		session.enemies.push(enemy);
		// Boxed from its first frame when it arrives mid-phase (queued waves, ace calls), not at the next telemetry tick.
		publishEnemyDamageable(session, enemy);
	}
}
/** Hostile aircraft alive and fighting (a withdrawing jet is disabled, silent and gone in 4 s). */
function liveAircraft(session: CombatSession): number {
	let live = 0;
	for (const enemy of session.enemies) if (enemy.kind !== "ground" && ownsEnemy(session, enemy)) live += 1;
	return live;
}
/** Spawns what the live-aircraft budget has room for now; the rest keeps waiting. */
function drainAir(session: CombatSession): void {
	if (session.airQueue.size() === 0) return;
	const room = WavePlan.Budget(extraRaiders(session)) - liveAircraft(session);
	for (const batch of WavePlan.Admit(session.airQueue, room)) {
		spawnAir(session, batch.count, batch.role, { behind: batch.behind });
		// A group's call goes out when it is really in the air, not when it was due.
		if (batch.call !== undefined) radio(session, batch.call);
	}
}
/** Bandits or raiders for missions 3-27: they spawn as the live-aircraft budget allows (WavePlan). */
function requestAir(session: CombatSession, count: number, role: AirRequest["role"], behind = false, call?: string): void {
	if (count <= 0) return;
	session.airQueue.push({ role, count, behind, call });
	drainAir(session);
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
		enemy.enabled = false; enemy.required = false; enemy.windup = 0;
		enemy.withdrawUntil = session.elapsed + WITHDRAW_SECONDS;
		if (enemy.warning) enemy.warning.Enabled = false;
		enemy.model.SetAttribute("AttackWarning", false);
		markTarget(session, enemy);
		const away = unitOr(new Vector3(enemy.position.X - player.X, 0, enemy.position.Z - player.Z), enemy.direction);
		enemy.passDirection = unitOr(away.add(new Vector3(0, 0.25, 0)), away);
		for (let index = session.projectiles.size() - 1; index >= 0; index--) {
			const missile = session.projectiles[index];
			if (missile.hostile || missile.target !== enemy) continue;
			if (!missile.special) session.missiles = math.min(MAX_MISSILES, session.missiles + 1);
			missile.part.Destroy(); session.projectiles.remove(index);
		}
	}
	session.enemies = session.enemies.filter((enemy) => enemy.health > 0);
	if (session.target !== undefined && session.target.health <= 0) session.target = undefined;
}
/** Names the escorted or defended actor for its HUD label. */
function actorName(session: CombatSession, defend: boolean, coast: boolean): string {
	const names: { [id: number]: string } = { 5: "EVACUATION TRUCK", 8: "VARDA TOWER", 12: "TRANSMITTER TRUCK", 18: "MARINE PICKUP", 20: "EVIDENCE LAUNCH", 23: "COMMAND FRIGATE", 25: "LANDING CRAFT" };
	return names[session.missionId] ?? (coast ? "LOYALIST LAUNCH" : defend ? "LOYALIST TOWER" : "LOYALIST TRUCK");
}

// Legacy Mission 1/2 phase application: compatible with the pre-blueprint
// CombatService behavior that the existing engine tests cover.
function applyLegacyPhase(session: CombatSession): void {
	assert(session.rules, "legacy phase application requires MissionRules state");
	if (session.appliedPhase === session.rules.phase || session.rules.outcome !== undefined) return;
	session.appliedPhase = session.rules.phase;
	const phase = session.rules.phase;
	if (phase === "tutorial_target") activateGround(session);
	// Mission 1's bandits launch MissionRules.BanditBeat seconds after SERA's call (see stepSession).
	else if (phase === "intercept") spawnAir(session, 3, "bandit");
	else if (phase === "warehouses") { activateGround(session); spawnAir(session, 5, "raider"); }
	else if (phase === "ace") spawnAir(session, 1, "ace", { aceHealth: 165 });
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
	session.reinforceIndex=0;
	session.wave=undefined;
	// Retire the old phase's pursuers: they visibly fly out instead of lingering, firing, or draining a convoy.
	withdrawAirborne(session);
	// Raiders still waiting belonged to the old phase (its bandits were all out, or it could not have ended).
	session.airQueue.clear();
	session.navigationMarker?.Destroy(); session.navigationMarker=undefined;
	session.navigationActor?.Destroy(); session.navigationActor=undefined; session.actorFooting=undefined;
	// The live list, not the catalog: twists splice new objectives in after the phase that fired them.
	const phases=BlueprintRunner.Phases(state);
	const phase: MissionPhaseBlueprint | undefined=phases[state.phaseIndex];
	if (!phase) return;
	if (phase.kind === "required_ground") activateGround(session,MissionCatalog.GroundStart(phases,state.phaseIndex),phase.count ?? 0);
	else if (phase.kind === "required_air") {
		// Staggered groups: the first now, the rest by WavePlan.Due (stepSession).
		const plan=WavePlan.Groups(phase.count ?? 0,phase.groups ?? 1);
		session.wave={phaseIndex:state.phaseIndex,plan,next:1,lastAt:session.elapsed};
		requestAir(session,plan[0] ?? 0,"bandit");
	}
	else if (phase.kind === "chase") spawnAir(session,phase.count ?? 1,"courier",{escape: phase.escape ? new Vector3(phase.escape.x,phase.escape.y,phase.escape.z) : undefined});
	else if (phase.kind === "ace") spawnAir(session,1,"ace",{aceHealth: session.blueprint.aceHealth ?? 165});
	// Ace phases hold their raiders back for the ace's stage calls; reinforced phases keep part of theirs for mid-phase.
	const initialRaiders=raiderWave(session,MissionCatalog.InitialRaiders(phase));
	requestAir(session,initialRaiders,"raider");
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
		if (phase.kind === "escort" || phase.kind === "defend" || phase.parkedEscort !== undefined) {
			const actorPoint=phase.parkedEscort ?? nav;
			const coast=session.blueprint.region === "coastal_city" || session.blueprint.region === "coastal_harbor" || session.blueprint.region === "ocean_platform";
			const name=actorName(session,phase.kind === "defend",coast);
			const actor=coast ? MissionAssets.CreateHarborLaunch(name) : phase.kind === "defend" ? MissionAssets.CreateCommsRelay(name) : MissionAssets.CreateRelayTruck(name);
			if (!session.active || !session.folder.Parent) {actor.Destroy(); return;}
			// The escorted vehicle moves every step: weld it so one part replicates per move.
			JetFactory.WeldAssembly(actor);
			// Grounded from its own bounds and the surface under it: wheels on the road, a hull at the waterline.
			const footing=ActorGrounding.Footing(actor,coast);
			session.actorFooting=footing;
			const y=session.groundParams ? ActorGrounding.PivotY(footing,actorPoint.x,actorPoint.z,session.groundParams,actorPoint.y) : actorPoint.y;
			actor.SetAttribute("ProtectedObjective",true); actor.Parent=session.folder; session.navigationActor=actor;
			actor.PivotTo(new CFrame(actorPoint.x,y,actorPoint.z));
		}
	}
	// Refresh only at phase transitions: includes new protected actors and drops destroyed ones.
	session.collisionParams = AircraftCollision.Parameters(session.folder);
	acquireTarget(session);
}

function applyPhase(session: CombatSession): void {
	const before = session.rules ? session.appliedPhase : session.appliedBlueprintPhaseIndex;
	if (session.rules) applyLegacyPhase(session);
	else applyBlueprintPhase(session);
	// A phase change flips which enemies are damageable; box them now, not at the next telemetry tick.
	if ((session.rules ? session.appliedPhase : session.appliedBlueprintPhaseIndex) !== before) publishDamageable(session);
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
	enemy.damageable = false;
	enemy.model.SetAttribute("Damageable", false);
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
		direction = unitOr(positionFor(session.state).sub(position), enemy.direction);
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
	session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, direction, hostile), position, direction, target, hostile, age: 0, ace, damage, speed,
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
/** While the evade window is open, every hostile missile inside 350 studs or in its last 1.2 s takes the flares. */
function decoyEvade(session: CombatSession): void {
	const position = positionFor(session.state);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		if (!missile.hostile || !EvadeRules.Decoys(missile.position.sub(position).Magnitude, (missile.life ?? 0) - missile.age)) continue;
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
/** A retreated ace calls the raiders its phase holds for this stage. */
function aceCall(session: CombatSession, enemy: Enemy): void {
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const total = phase?.kind === "ace" ? phase.optionalRaiders ?? 0 : 0;
	const count = raiderWave(session, AceRules.RaidersForStage(total, enemy.aceState?.stage ?? 0));
	if (count <= 0) return;
	radio(session, `SERA: ${enemy.name} pulled back to call his wing. ${count} inbound.`);
	if (session.blueprintState) requestAir(session, count, "raider", true);
	else spawnAir(session, count, "raider", { behind: true });
	// Hand the lock to the wing; the ace is out of reach until it turns back in.
	if (session.target === enemy) acquireTarget(session);
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
		if (!ownsEnemy(session, enemy) || enemy.kind !== "air" || enemy.role === "courier") continue;
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
			if (event === "called") aceCall(session, enemy);
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
		let speed = math.clamp(session.state.speed + (ace ? 48 : 24), ace ? 320 : 285, ace ? 380 : 350) + enemy.speedBonus;
		if (courier) speed = COURIER_SPEED;
		// An extending bandit drops below the player's speed: turn back in and there is a rear shot to take.
		else if (!ace && enemy.mode === "extend") speed = ThreatRules.ExtendSpeed(session.state.speed, 180);
		if (!aceFighting) speed += 40;
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
		if (courier) continue; // the courier never shoots
		const aimDot = enemy.direction.Dot(unitOr(playerPosition.sub(enemy.position), enemy.direction));
		const mayFire = (enemy.mode === "attack" || enemy.mode === "run") && aceFighting && !(aceState && AceRules.Invulnerable(aceState, session.elapsed));
		if (enemy.windup > 0) {
			enemy.windup = math.max(0, enemy.windup - dt);
			if (enemy.windup <= 0) {
				enemy.warning!.Enabled = false;
				enemy.model.SetAttribute("AttackWarning", false);
				// A staged ace that broke off mid-windup holds its shot.
				if (separation < 2300 && aceFighting) {
					const salvo = ace ? aceSalvo : 1;
					for (let shot = 0; shot < salvo; shot++) launchMissile(session, true, enemy, shot, salvo);
				}
				enemy.fireTimer = tuned(session, ace ? TUNING.aceReload : TUNING.banditReload);
			}
		} else if (mayFire && (ace || flightReady) && ThreatRules.MayFire({
			separation, aimDot, fireTimer: enemy.fireTimer, globalReady: true,
			evading: session.evadeRemaining > 0, playerStraight, minRange: fireMin, maxRange: ace ? fireMax + 200 : fireMax,
			aimThreshold, straightRelax,
		})) {
			enemy.windup = windupSeconds;
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
	session.missileHits += 1;
	// Staged ace: the hit bursts harmlessly while it breaks away.
	if (enemy.aceState && AceRules.Invulnerable(enemy.aceState, session.elapsed)) return true;
	let damage = session.projectiles[index].damage > 0 ? session.projectiles[index].damage : PLAYER_MISSILE_DAMAGE;
	// A heavy hit stops at the ace's next stage line, and a hit while it retreats or holds stops above it,
	// so no stage (radio call, retreat, raiders, return) is skipped or cut short.
	if (enemy.aceState) damage = AceRules.CapHit(enemy.aceState, enemy.health, enemy.maxHealth, damage);
	if (enemy.health <= damage) {
		session.projectiles[index].part.Destroy(); session.projectiles.remove(index);
		destroyEnemy(session, enemy);
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
/** Mission 1 target step: after 8 s without a TGT press, say what the step wants. Auto-selection never skips it. */
function stepTutorialHint(session: CombatSession): void {
	if (session.rules?.phase === "tutorial_move" && session.elapsed >= (session.practiceHintAt ?? 6)) {
		session.practiceHintAt = session.elapsed + 10;
		radio(session, "Release holds the nose. Tap opposite pitch to level; avoid long holds.");
	}
	if (session.rules?.phase !== "tutorial_target") { session.targetStepSince = undefined; return; }
	if (session.targetStepSince === undefined) session.targetStepSince = session.elapsed;
	if (session.targetStepHinted || session.elapsed - session.targetStepSince < 8) return;
	session.targetStepHinted = true;
	radio(session, "Select the radar: TGT / Tab / Y");
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
	enemy.windup = 0; enemy.warning!.Enabled = false; enemy.model.SetAttribute("AttackWarning", false);
	if (enemy.mode === "extend") enemy.mode = "attack";
	if (session.target === enemy) session.lockProgress = 0;
	const lines = session.blueprint?.aceStages;
	const fallback = retreats ? `${enemy.name}: Not bad, trainee. Wing, on me.` : aceState.stage === 1 ? `${enemy.name}: Not bad, trainee. Again.` : `${enemy.name}: Enough. Head on.`;
	radio(session, lines?.[aceState.stage - 1] ?? fallback);
}
function stepMissiles(session: CombatSession, dt: number): void {
	stepTutorialHint(session);
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		missile.age += dt;
		const blind = !missile.hostile && missile.target === undefined;
		let removed = missile.age > (missile.hostile ? missile.life ?? tuned(session, TUNING.missileLife) : blind && !missile.lostTrack ? WeaponRules.UnguidedLifetime : WeaponRules.GuidedLifetime)
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
				if (missile.hostile) {
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
	// Legacy Mission 1 observes real control usage during its tutorial phases.
	if (session.rules) MissionRules.ObserveControls(session.rules, session.input.x, session.input.y, dt, os.clock());
	if (sessionOutcome(session) !== undefined) { finish(session); return; }
	applyPhase(session);
	// Mission 1: the bandits launch a radio beat after the training radar dies.
	if (session.rules && !session.tutorialBanditsSpawned && MissionRules.BanditsDue(session.rules)) {
		session.tutorialBanditsSpawned = true;
		spawnAir(session, 3, "bandit");
		acquireTarget(session);
	}
	const from={x:session.state.x,y:session.state.y,z:session.state.z};
	if (session.inputFresh) { session.inputFresh = false; session.inputSteps = 0; }
	FlightMath.Step(session.state, session.input, dt);
	// Resolve impacts before navigation, phase completion, enemy fire or missile kills.
	const hit = AircraftCollision.Sweep(new Vector3(from.x, from.y, from.z), new Vector3(session.state.x, session.state.y, session.state.z), session.collisionParams!);
	if (hit) {
		if (session.rules && MissionRules.RecoverPractice(session.rules, session.state)) {
			session.lockProgress = 0;
			radio(session, "Practice reset; progress saved. Release holds; opposite pitch levels.");
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
		if (nav) for(const enemy of session.enemies) if(ownsEnemy(session,enemy) && enemy.kind !== "ground" && enemy.position.sub(new Vector3(nav.x,230,nav.z)).Magnitude < 650) threats++;
		BlueprintRunner.ObserveFlight(bs,from,{x:session.state.x,y:session.state.y,z:session.state.z},dt,os.clock(),threats,Difficulty.Multiplier(session.difficulty,"protectDrain"));
		if (bs.outcome !== undefined) {finish(session); return;}
		applyPhase(session);
		// Mid-phase "after" twists do not change phase, so applyBlueprintPhase never sees their radio: drain it here.
		for (let line=BlueprintRunner.TakeRadio(bs); line !== undefined; line=BlueprintRunner.TakeRadio(bs)) radio(session,line,7);
		const active=BlueprintRunner.ActivePhase(bs);
		if (active) {
			const fraction=BlueprintRunner.Fraction(bs);
			// Anything held back by the live-aircraft budget takes the slots kills have freed.
			drainAir(session);
			// Mid-phase raider waves, in authored order (each one larger on Ace).
			const waves=active.reinforce ?? [];
			while (session.reinforceIndex < waves.size() && fraction >= waves[session.reinforceIndex].at) {
				requestAir(session,raiderWave(session,waves[session.reinforceIndex].count),"raider",true);
				session.reinforceIndex += 1;
			}
			// Staggered bandit groups: the next comes after `stagger` seconds, once half the last is down, or at its
			// authored share of the phase. A group still waiting for slots holds the next one back.
			const wave=session.wave;
			if (wave && wave.phaseIndex === bs.phaseIndex && WavePlan.Queued(session.airQueue,"bandit") === 0
				&& WavePlan.Due({next:wave.next,plan:wave.plan,sinceLast:session.elapsed-wave.lastAt,stagger:active.stagger ?? WavePlan.DefaultStagger,killed:bs.phaseProgress,groupAt:active.groupAt})) {
				requestAir(session,wave.plan[wave.next],"bandit",active.flank === true,active.groupCalls?.[wave.next-1]);
				wave.next += 1; wave.lastAt=session.elapsed;
			}
			// A hazard lit by the runner (jammers, bank guns): reveal its ground targets and make them strikeable.
			if (active.hazard && bs.hazardFired && session.hazardPhase !== bs.phaseIndex) {
				session.hazardPhase=bs.phaseIndex;
				activateGround(session,MissionCatalog.GroundStart(BlueprintRunner.Phases(bs),bs.phaseIndex),active.hazard.count);
				publishDamageable(session);
				acquireTarget(session);
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
			// A defended site stays where it was grounded; an escorted vehicle re-grounds as it moves.
			if(actor && BlueprintRunner.ActivePhase(bs)!.kind === "escort") {
				const old=actor.GetPivot().Position;
				const direction=new Vector3(pos.X-old.X,0,pos.Z-old.Z);
				const y=session.actorFooting && session.groundParams ? ActorGrounding.PivotY(session.actorFooting,pos.X,pos.Z,session.groundParams,pos.Y) : pos.Y;
				const current=new Vector3(pos.X,y,pos.Z);
				session.actorFrame = direction.Magnitude>.01 ? CFrame.lookAt(current,current.add(direction)) : new CFrame(current);
			}
		}
	}
	let flightFrame = frameFor(session.state);
	if (session.evadeRemaining > 0) flightFrame = flightFrame.mul(CFrame.Angles(0, 0, (1 - session.evadeRemaining / EVADE_ROLL) * math.pi * 2));
	session.aircraftFrame = flightFrame;
	// The evade window stays open for a moment after the press, so a phone's round trip does not eat the timing.
	if (EvadeRules.Open(session.evade)) decoyEvade(session);
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
 * forward by the paused span, so no sortie time passed while paused.
 */
function resumeSession(session: CombatSession, now: number): void {
	if (!PauseRules.Paused(session.pause)) return;
	const shift = PauseRules.Resume(session.pause, now);
	if (session.rules) session.rules.startedAt += shift;
	if (session.blueprintState) session.blueprintState.startedAt += shift;
	session.lastInput = now;
	if (refreshSession(session, now)) { sendTelemetry(session); sendFlightState(session); }
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
				player, slot, folder, aircraft, state, missionId, lastWindupAt: -math.huge, radioSerial: 0, chatterIndex: 0,
				input: { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, health: 100, kills: 0, elapsed: 0,
				missiles: MAX_MISSILES, missileCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				special: SpecialWeapons.New(specialKind),
				difficulty: difficultyKind,
				enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
				inputClientTime: 0, inputFresh: false, inputSteps: 0, stateTime: 0, stateSequence: 0, telemetrySequence: 0,
				missilesFired: 0, missileHits: 0, flareBursts: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
				evade: EvadeRules.New(), guard: StepGuard.New(), pause: PauseRules.New(), pauseAck: 0, settlement: Settlement.New(),
				banditSerial: 0, raiderSerial: 0, spawnSerial: 0, reinforceIndex: 0, airQueue: [], stepCount: 0,
			};
			if (legacy) {
				session.rules = MissionRules.NewState(missionId as 1 | 2, startedAt);
			} else {
				session.blueprint = MissionCatalog.Get(missionId);
				session.blueprintState = BlueprintRunner.NewState(session.blueprint, startedAt, Difficulty.Behaviour(difficultyKind).extraRaiders);
			}
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
				// Legacy Mission 1 hides the training radar until the tutorial activates it; blueprints hide hazards and hidden strikes.
				const hideUntilActivated = missionId === 1 || hiddenGround.has(index);
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
			if (!session?.active || session.loading || session.guard.running || PauseRules.Paused(session.pause) || !typeIs(payload, "table")) return;
			const now = os.clock();
			if (!refreshSession(session, now)) return;
			const data = payload as { x?: unknown; y?: unknown; throttle?: unknown; t?: unknown; assist?: unknown };
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
					else { resumeSession(session, now); sendTelemetry(session); }
					return;
				}
				if (PauseRules.Paused(session.pause) || !refreshSession(session, now)) return;
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
