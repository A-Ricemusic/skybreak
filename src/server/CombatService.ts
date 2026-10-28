import { ac04ScheduleCapturedCompletion } from "./AC04Settlement";
import { AC04Runner, AC04Run } from "../shared/AC04Runner";
import { AC04MissionData, AC04UnitGroup } from "../shared/AC04MissionData";
import { AC04WorldPlanner } from "../shared/AC04WorldData";
import { lateFormationWaypoint, lateLockDenied, lateM14FinalMissileOffset, lateM14WaveTwoLaneX, lateOpenMegalithHatch, lateOpenMegalithGate, lateMissilePastDefense } from "../shared/ac04/rebuild/LateRuntime";
import { lateMegalithEscapeUpdate, type LateEscapeTracker } from "../shared/ac04/rebuild/LateMegalith";
import { middleHullHasComponents, middleEscortSpawn } from "../shared/ac04/rebuild/MiddleWorld";
import { AC04World } from "./AC04World";
import { ac04GunHitDistance } from "./AC04Gun";
import { ac04Aircraft } from "../shared/AC04Aircraft";
import { AC04MissionNarrative } from "../shared/ac04/AC04Story";
import { AC04RadioQueue } from "../shared/ac04/AC04Radio";
import { ac04BarrageState } from "../shared/AC04Barrage";
import { WorldAirspace } from "../shared/WorldAirspace";
import { CombatBalance } from "../shared/CombatBalance";
import { AircraftCollision } from "./AircraftCollision";
import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { JetFactory } from "../shared/JetFactory";
import { CombatEffectPacket, FinishedCallback, FlightInput, HudState, MissionLoading, MissionStats, Remotes } from "../shared/Types";
import { ExplosionKind } from "../shared/ExplosionFx";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { LoadingGate, LoadingGateState } from "../shared/LoadingGate";
import { countParts } from "../shared/MissionParts";
import { ActionGateState, FireNotice, WeaponRules } from "../shared/WeaponRules";
import { SalvoCandidate, SpecialKind, SpecialState, SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty, DifficultyKind, DifficultyKnob } from "../shared/Difficulty";
import { ThreatRules } from "../shared/ThreatRules";
import { EvadeRules, EvadeState } from "../shared/EvadeRules";
import { AceRules, AceStageState } from "../shared/AceRules";
import { PauseRules, PauseState, Settlement, SettlementHooks, SettlementState, StepGuard, StepGuardState } from "../shared/SessionGuard";

type TargetKind = "air" | "ground" | "ace";
type EnemyMode = "attack" | "extend" | "orbit" | "run";
/** What an air enemy is: a required bandit, an optional raider, the courier of a chase phase, or the ace. */
type AirRole = "bandit" | "raider" | "courier" | "ace";
interface Enemy {
	ac04Group?: AC04UnitGroup; ac04PathIndex?: number; ac04Station?: Vector3;
	ac04Index?: number; ac04SpawnedAt?: number; ac04FormationAnchor?: Vector3;
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
	protectedTarget?: Enemy;
	/** Hostile ground fire excludes its own launcher, while retaining other cover. */
	obstructionParams?: RaycastParams;
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
	ac04Radio?: AC04RadioQueue; ac04RadioEvents?: Set<string>; lateEscape?: LateEscapeTracker;
	campaignId?: string; ac04?: AC04Run; ac04ReturnZ?: number; aircraftType?: string; gunAmmo?: number; gunCooldown?: number; rearmUntil?: number; rearmAt?: number; barrageAt?: number;
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	missionId: number;
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
	radio?: string; radioSerial: number; radioSeconds?: number; radioPriority?: boolean;
	/** Latest refused FIRE and its serial, so the HUD can show the reason once per press. */
	fireDenied?: FireNotice; fireDeniedSerial?: number;
	/** Mission 1: elapsed time when the tutorial target step began, and whether its hint has aired. */
	/** Next unfired chatter line of the active phase. */
	chatterIndex: number;
	/** Client stamp of the newest FlightInput, whether a step has used it yet, and how many fixed steps have. */
	inputClientTime: number; inputFresh: boolean; inputSteps: number;
	/** FlightInput token bucket: tokens left and when it was last refilled. */
	inputTokens: number; inputTokensAt: number;
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
	/** Reinforcement waves already spawned in the active phase. */
	reinforceIndex: number;
	/** Bandits and raiders waiting for a slot under the live-aircraft budget (WavePlan.Admit). */
	/** Phase index whose hazard targets are already lit. */
	hazardPhase?: number;
	/** Mission 1: the post-radar bandits have launched. */
	/** Surfaces protected actors stand on (scenery and terrain only, captured before any actor exists). */
	groundParams?: RaycastParams;
	/** The protected actor's footing, for re-grounding it as it moves. */
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
/** FlightInput token bucket: the client sends at most 20 Hz; anything far above that is dropped. */
const INPUT_RATE = 60;
const INPUT_BURST = 10;
function sessionAct(session: CombatSession): 1 | 2 | 3 {
	return session.missionId <= 6 ? 1 : session.missionId <= 12 ? 2 : 3;
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

/** A raider wave of `count`, plus the difficulty's extra (legacy Mission 2 keeps its fixed five). */

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
	return enemy !== undefined && enemy.ac04Group?.protected !== true && enemy.enabled && enemy.health > 0 && enemy.model.Parent === session.folder;
}
function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}

function sessionTotalRequired(session: CombatSession): number { let total=0; for(const g of session.ac04!.mission.roster) if(g.required) total+=g.count; return total; }
function sessionRequiredKills(session: CombatSession): number { return session.ac04!.requiredKills; }
function sessionAllKills(session: CombatSession): number { return sessionRequiredKills(session)+session.ac04!.optionalKills; }
function syncElapsed(session: CombatSession): void { session.elapsed=session.ac04!.elapsed; }
function sessionGroundKills(session: CombatSession): number { return session.ac04!.groundKills; }
function sessionCanDamage(session: CombatSession, kind: TargetKind, required: boolean): boolean { return session.ac04!.outcome === undefined; }
function sessionRecordKill(session: CombatSession, id: string, kind: TargetKind, required: boolean, now: number): boolean { const enemy=session.enemies.find(e=>e.id===id); return enemy?.ac04Group !== undefined && AC04Runner.RecordKill(session.ac04!,enemy.ac04Group,id,now); }
function sessionTick(session: CombatSession, now: number, health: number): void { AC04Runner.Tick(session.ac04!,now,health); }
function sessionOutcome(session: CombatSession): "won" | "failed" | undefined { return session.crashReason !== undefined ? "failed" : session.ac04!.outcome; }
function sessionReason(session: CombatSession): string | undefined { return session.crashReason ?? session.ac04!.reason; }
function sessionTimeRemaining(session: CombatSession): number { return AC04Runner.Remaining(session.ac04!); }
function sessionObjective(session: CombatSession) { return AC04Runner.Objective(session.ac04!); }

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
			return;
		}
	}
}
/** Would a missile hurt `enemy` right now: owned, damageable this phase and, for an ace, not immune or held at a stage floor (strikeEnemy). */
function canHurt(session: CombatSession, enemy: Enemy | undefined): boolean {
	return ownsEnemy(session, enemy) && (enemy.ac04Group?.invulnerable !== true || session.missionId === 8) && sessionCanDamage(session, enemy.kind, enemy.required)
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
	if (session.ac04) missionState!.FireClient(session.player, { kind: "AC04State", campaignId: "ac04", score: session.ac04.score, gunAmmo: session.gunAmmo, rearmSeconds: math.max(0, (session.rearmUntil ?? 0) - session.elapsed), returnZ: session.ac04ReturnZ });
	publishDamageable(session);
	let incoming = false;
	let evadeThreat = false;
	let lockWarning = false;
	let incomingDistance = math.huge;
	for (const missile of session.projectiles) {
		if (!missile.hostile) continue;
		const range = missile.position.sub(positionFor(session.state)).Magnitude;
		incomingDistance = math.min(incomingDistance, range);
		if (range < 1800) incoming = true;
		if (EvadeRules.Decoys(range, (missile.life ?? 0) - missile.age)) evadeThreat = true;
	}
	// A windup is a lock warning, not a missile: evading now would waste the countermeasure.
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.windup > 0) { lockWarning = true; break; }
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	let distance = 0;
	if (target) { const [targetDistance] = targetMetrics(session, target); distance = targetDistance; }
	const objective = sessionObjective(session);
	// Protected-actor health is a replicated attribute; 10 Hz here is plenty for the HUD.
	sendHud(session, objective, target);
	session.telemetrySequence += 1;
	telemetryRemote!.FireClient(session.player, TelemetryCodec.Encode(session.telemetrySequence, {
		health: session.health, speed: session.state.speed, altitude: session.state.y,
		// The HUD tally counts required destructions only; raiders travel separately so it never reads 7/4.
		kills: sessionRequiredKills(session), total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown, evadeCooldown: EvadeRules.Cooldown(session.evade, session.evadeRemaining),
		lockProgress: session.lockProgress, incoming, lockWarning, evadeThreat,
		boundaryWarning: math.max(math.abs(session.state.x), math.abs(session.state.z)) > FlightMath.SoftBoundary,
		targetDamageable: target ? canHurt(session, target) : undefined,
		elapsed: session.elapsed, timeRemaining: sessionTimeRemaining(session),
		objectiveProgress: objective.objectiveProgress, objectiveTotal: objective.objectiveTotal,
		groundKills: sessionGroundKills(session), targetDistance: distance,
		targetHealth: target ? math.clamp(target.health / math.max(1, target.maxHealth), 0, 1) : undefined,
		specialCharges: session.special.charges, specialCooldown: session.special.cooldown, specialActive: session.special.active,
		paused: PauseRules.Paused(session.pause),
		pauseAck: session.pauseAck,
		pauseRemaining: PauseRules.Remaining(session.pause, os.clock()),
		evadeCharges: session.evade.charges,
		optionalKills: session.ac04!.optionalKills,
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
function sendHud(session: CombatSession, objective: ReturnType<typeof sessionObjective>, target: Enemy | undefined): void {
	const line = session.ac04 ? AC04Runner.ReturnNavigation(session.ac04, session.ac04ReturnZ ?? 3200) : undefined;
	const nav = line ? new Vector3(line.x,line.y,line.z) : undefined;
	const previous = session.hud;
	const targetKind = target ? (target.kind === "ground" ? "ground" : "air") : "";
	if (previous && previous.missionId === session.missionId && previous.phase === objective.phase && previous.objective === objective.objective
		&& previous.tutorialStep === objective.tutorialStep && previous.target === target?.model && previous.targetName === (target?.name ?? "")
		&& previous.targetKind === targetKind && previous.targetRequired === (target?.required ?? false)
		&& previous.navigationRadius === undefined && previous.navigationCeiling === undefined
		&& previous.radioSerial === session.radioSerial && previous.fireDeniedSerial === session.fireDeniedSerial && previous.special === session.special.kind
		// A moving escort point only re-sends after it travels 20 studs (the cue is a screen marker, not a hitbox).
		&& previous.navigation === nav) return;
	const hud: HudState = {
		kind: "HudState", missionId: session.missionId, phase: objective.phase, objective: objective.objective, tutorialStep: objective.tutorialStep,
		target: target?.model, targetName: target?.name ?? "", targetKind, targetRequired: target?.required ?? false,
		navigation: nav, navigationRadius: undefined, navigationCeiling: undefined,
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
	sendHud(session, sessionObjective(session), target);
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
function sessionCompletedPhases(session: CombatSession, won: boolean): number { return session.ac04!.phaseIndex; }
/** Cosmetic explosion, drawn by the client (src/client/CombatEffects.ts) so no effect parts replicate. */
function effect(session: CombatSession, kind: ExplosionKind, position: Vector3, extra?: Omit<CombatEffectPacket, "kind" | "position">): void {
	if (session.cleaned || session.player.Parent !== Players) return;
	combatEffectRemote?.FireClient(session.player, { kind, position, ...extra });
}
function restoreMenu(): void { /* AC04 menu does not require a legacy world. */ }
function cleanupSession(session: CombatSession, restore = true): void {
	if (session.cleaned) return;
	session.cleaned = true;
	session.lateEscape = undefined;
	session.active = false;
	session.ac04Radio?.Clear();
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
		campaignId: session.campaignId, score: session.ac04?.score,
		kills: session.kills,
		groundKills: sessionGroundKills(session),
		missionId: session.missionId,
		elapsed: session.elapsed,
		slot: session.slot,
		reason: sessionReason(session),
		completedPhases: sessionCompletedPhases(session, won),
		optionalKills: session.ac04!.optionalKills,
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
	let persistResult: (() => void) | void;
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
			// Capture campaign progress synchronously before removal can discard its state.
			// The callback consumes the active sortie without yielding and returns its cloud work.
			assert(callback, "No completion callback");
			ac04ScheduleCapturedCompletion(() => { persistResult = callback(session.player, won, stats!); }, complete, (work) => { task.defer(work); });
		},
		save: () => {
			// Save/report under settlement before teardown releases admission to a new sortie.
			assert(stats, "No completion result");
			if (persistResult) persistResult();
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
	session.ac04Radio?.Clear();
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
	if (session.loading || PauseRules.Paused(session.pause)) return true;
	sessionTick(session, now, session.health);
	syncElapsed(session);
	if (sessionOutcome(session) !== undefined) { finish(session); return false; }
	return true;
}
// Leaves the loading gate: the playable clock starts now, and the client gets
// the same "Started" message it always did.
function beginPlay(session: CombatSession): void {
	if (!session.loading || !session.active || session.cleaned) return;
	session.loading = undefined;
	const now = os.clock();
	if (session.ac04) { session.ac04.startedAt = now; session.ac04.elapsed = 0; session.ac04.phaseAt = 0; }
	session.elapsed = 0;
	session.lastInput = now;
	session.telemetryTime = 0;
	session.stateTime = 0;
	session.hud = undefined; // the first HUD message after Started is always complete
	if (session.player.Parent !== Players) { cleanupSession(session); return; }
	missionState!.FireClient(session.player, { kind: "Started", campaignId: session.campaignId, slot: session.slot, missionId: session.missionId, aircraft: session.aircraft, difficulty: session.difficulty });
	if (refreshSession(session, now)) { sendTelemetry(session); sendFlightState(session); }
}
function markTarget(session: CombatSession, enemy: Enemy): void {
	enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled && enemy.ac04Group?.protected !== true);
	if (enemy.ac04Group?.protected) enemy.model.SetAttribute("ProtectedObjective", true);
	enemy.model.SetAttribute("SkybreakOwner", session.player.UserId);
	enemy.model.SetAttribute("TargetKind", enemy.kind === "ground" ? "ground" : "air");
	enemy.model.SetAttribute("RequiredTarget", enemy.enabled && enemy.required);
	enemy.model.SetAttribute("Health", enemy.health);
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
function prepareAC04Aircraft(model: Model): void {
	for (const part of model.GetDescendants()) if (part.IsA("BasePart")) { part.SetAttribute("FlightSolid", false); part.CanQuery = false; part.CanCollide = false; }
	JetFactory.WeldAssembly(model);
}
function ac04RadioTick(session: CombatSession, dt = 0): void {
	const line = session.ac04Radio?.Tick(dt);
	if (line !== undefined) radio(session, line, math.clamp(line.size() / 17 + 1, 4, 14), true);
}
function ac04RadioEvent(session: CombatSession, eventId: string, once = true): void {
	if (!session.ac04Radio || (once && session.ac04RadioEvents?.has(eventId))) return;
	const lines = AC04MissionNarrative[session.missionId]?.events?.[eventId];
	if (!lines) return;
	session.ac04RadioEvents?.add(eventId);
	session.ac04Radio.Add(lines, true); ac04RadioTick(session);
}
function retireAC04Units(session: CombatSession): void {
	const run = session.ac04!;
	for (const enemy of session.enemies) {
		if (!enemy.ac04Group || !AC04Runner.Retired(run, enemy.ac04Group)) continue;
		enemy.enabled = false; enemy.damageable = false;
		enemy.model.SetAttribute("SkybreakEnemy", false); enemy.model.SetAttribute("RequiredTarget", false); enemy.model.SetAttribute("Damageable", false);
		if (session.missionId === 13) {
			// Balloons remain visible scenery, but no longer receive locks, gun hits or score.
			for (const part of enemy.model.GetDescendants()) if (part.IsA("BasePart")) { part.CanQuery = false; part.SetAttribute("FlightSolid", false); }
		} else enemy.model.Destroy();
		if (session.target === enemy) { session.target = undefined; session.lockProgress = 0; }
	}
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const projectile = session.projectiles[index], group = projectile.target?.ac04Group;
		if (group && AC04Runner.Retired(run, group)) { projectile.part.Destroy(); session.projectiles.remove(index); }
	}
}
/** AC04 uses authored manifests directly. No seven-aircraft admission queue is applied. */
function applyAC04Phase(session: CombatSession): void {
	const run = session.ac04!;
	if (run.outcome !== undefined) return;
	const changed = session.appliedBlueprintPhaseIndex !== run.phaseIndex;
	if (changed) {
		session.appliedBlueprintPhaseIndex = run.phaseIndex;
		const narrative = AC04MissionNarrative[session.missionId];
		const lines = run.phaseIndex === 0 ? narrative?.radio.primary : narrative?.radio.update;
		session.ac04Radio?.SetScope(tostring(run.phaseIndex), lines ?? [AC04Runner.Phase(run).label]);
		ac04RadioTick(session);
		retireAC04Units(session);
		if (session.missionId === 5 && run.phaseIndex === 1) {
			// The source update relocates Mobius near the rigs and clears the preceding battle.
			for (const projectile of session.projectiles) projectile.part.Destroy();
			session.projectiles.clear(); session.target = undefined; session.lockProgress = 0;
			const rigs = AC04WorldPlanner.Layout(5).sites.rigs;
			session.state.x = rigs.x; session.state.z = rigs.z; session.state.y = math.max(600, session.state.y);
			session.aircraftFrame = frameFor(session.state); session.aircraft.PivotTo(session.aircraftFrame);
			session.ac04ReturnZ = math.min(3550, (session.ac04ReturnZ ?? 3100) + 250);
		}
		if (session.missionId === 13 && run.phaseIndex === 1) session.ac04Radio?.Add(narrative?.events?.jamCleared ?? []);
		if (session.missionId === 18 && run.phaseIndex === 1) {
			lateOpenMegalithGate(session.folder, run);
		}
	}
	for (const group of run.mission.roster) {
		if (!AC04Runner.GroupDue(run, group)) continue;
		run.spawned.add(group.id);
		if (session.missionId === 14 && group.id === "missile-2") ac04RadioEvent(session, "missile-wave-2");
		if (session.missionId === 14 && group.id === "missile-final") ac04RadioEvent(session, "missile-final");
		if (group.domain === "ground" || group.domain === "naval") {
			for (const enemy of session.enemies) if (enemy.ac04Group?.id === group.id) {
				enemy.enabled = true;
				for (const hidden of enemy.hiddenParts) { hidden.part.Transparency = hidden.transparency; hidden.part.CanQuery = hidden.part.GetAttribute("FlightSolid") === true; }
				enemy.hiddenParts.clear(); markTarget(session, enemy);
			}
			continue;
		}
		for (let index = 0; index < group.count; index++) {
			const id = AC04MissionData.InstanceId(group, index);
			let point = AC04WorldPlanner.UnitPosition(session.missionId, group, index);
			// AC04-MIDDLE-REBUILD: M11 waves appear at fixed offsets from their live airliner (Mitoro M11).
			const liner = session.enemies.find((e) => e.enabled && e.health > 0 && e.ac04Group?.protected === true && e.ac04Group.site === group.site);
			const live = liner ? middleEscortSpawn(session.missionId, group, index, liner.position.Y) : undefined;
			if (liner && live) point = { x: math.clamp(liner.position.X + live.dx, -3600, 3600), y: live.y, z: math.clamp(liner.position.Z + live.dz, -3600, 3700) };
			const name = group.count > 1 ? `${group.type} ${index + 1}` : group.type;
			const model = AC04World.CreateAircraft(group.type, name);
			prepareAC04Aircraft(model);
			model.Parent = session.folder;
			const position = new Vector3(point.x, point.y, point.z), direction = new Vector3(0, 0, 1);
			model.PivotTo(CFrame.lookAt(position, position.add(direction)));
			const health = group.health ?? (group.type.find("YELLOW")[0] !== undefined ? 150 : 100);
			const enemy: Enemy = {
				id, name, model, health, maxHealth: health, position, direction, velocity: Vector3.zero,
				kind: "air", required: group.required, enabled: true, role: group.required ? "bandit" : "raider",
				fireTimer: 7 + index * 0.4, windup: 0, mode: "attack", modeTimer: 0, passDirection: direction, side: index % 2 === 0 ? 1 : -1,
				flares: 0, flareTimer: 0, flareUntil: 0, speedBonus: 0, lockBreakTimer: 8, breakTimer: 0, breakUntil: 0, lockBreakChance: 0.2,
				hiddenParts: [], warning: group.protected ? undefined : attackWarning(model), ac04Group: group, ac04PathIndex: 0, ac04Station: position,
				ac04Index: index, ac04SpawnedAt: session.elapsed,
				// Immutable authored leader origin, retained even after leader death.
				ac04FormationAnchor: (() => { const a = AC04WorldPlanner.UnitPosition(session.missionId, group, 0); return new Vector3(a.x, a.y, a.z); })(),
			};
			markTarget(session, enemy); session.enemies.push(enemy);
		}
	}
	if (changed || !ownsEnemy(session, session.target)) acquireTarget(session);
}
function ac04ProtectedTarget(session: CombatSession, attacker: Enemy): Enemy | undefined {
	if (!session.ac04 || !attacker.ac04Group || attacker.ac04Group.protected) return undefined;
	const actors = session.enemies.filter((e) => e.enabled && e.health > 0 && e.ac04Group?.protected === true);
	if (actors.size() === 0) return undefined;
	const same = actors.find((e) => e.ac04Group?.site === attacker.ac04Group?.site);
	return same ?? actors[0];
}
function ac04ProtectedHit(session: CombatSession, enemy: Enemy): boolean {
	if (!session.ac04) return false;
	if (enemy.ac04Group && AC04Runner.Retired(session.ac04, enemy.ac04Group)) return true;
	if (session.missionId === 15 && enemy.ac04Group?.id === "yellow" && (session.ac04.groupKills.get("yellow") ?? 0) >= 4) return true;
	if (enemy.ac04Group?.invulnerable) {
		if (session.missionId === 8) {
			for (const yellow of session.enemies) if (yellow.ac04Group?.id === "yellow") {
				yellow.enabled = false; yellow.withdrawUntil = session.elapsed + 5; yellow.passDirection = new Vector3(0, .15, -1); markTarget(session, yellow);
			}
			radio(session, "SkyEye: Yellow Squadron is disengaging. Stay with the launch defense.", 6);
		}
		return true;
	}
	return false;
}
function ac04Jammed(session: CombatSession, target: Enemy): boolean {
	if (!session.ac04) return false;
	if (lateLockDenied(session.missionId, target.ac04Group?.id ?? "")) return true;
	const phase = AC04Runner.Phase(session.ac04);
	if (phase.special === "stonehenge-jammer" && target.kind === "ground")
		return session.enemies.some((e) => e.ac04Group?.id === "jammer" && ownsEnemy(session, e));
	if (phase.special === "airborne-jammers")
		return session.enemies.some((e) => e.ac04Group?.id === "jammers" && ownsEnemy(session, e) && e.position.sub(target.position).Magnitude < 1600);
	return false;
}
/** Returns true when this unit has its own transport/defense behavior instead of fighter AI. */
function stepAC04Unit(session: CombatSession, enemy: Enemy, dt: number): boolean {
	const group = enemy.ac04Group;
	if (!group || !enemy.enabled || enemy.health <= 0 || enemy.model.Parent !== session.folder) return true;
	const actor = ac04ProtectedTarget(session, enemy);
	const ground = group.domain === "ground" || group.domain === "naval";
	if (ground) {
		const defense = group.type.find("SAM")[0] !== undefined || group.type.find("AA GUN")[0] !== undefined || group.type.find("FLAK")[0] !== undefined || group.type === "GUN" || (group.domain === "naval" && !middleHullHasComponents(session.ac04!.mission, group.id));
		if (defense) {
			enemy.fireTimer -= dt;
			if (enemy.fireTimer <= 0 && enemy.position.sub(positionFor(session.state)).Magnitude < 1800) {
				launchMissile(session, true, enemy); enemy.fireTimer = 8;
			}
		}
		return true;
	}
	const transport = group.protected === true || group.domain === "missile" || group.speed !== undefined || group.type.find("CH%-47")[0] !== undefined || group.type.find("KC%-10")[0] !== undefined || group.type.find("E%-767")[0] !== undefined;
	if (!transport && !actor) return false;
	let destination: Vector3;
	const path = group.path;
	if (actor && !transport) destination = actor.position;
	else if (path && path.size() > 0) {
		let waypoint = path[math.min(enemy.ac04PathIndex ?? 0, path.size() - 1)];
		if (session.missionId === 15 && group.id === "tu160" && enemy.ac04Station && enemy.ac04FormationAnchor) {
			const a = enemy.ac04Station, lead = enemy.ac04FormationAnchor;
			waypoint = lateFormationWaypoint(waypoint, { x: a.X, y: a.Y, z: a.Z }, { x: lead.X, y: lead.Y, z: lead.Z });
		}
		destination = new Vector3(waypoint.x, waypoint.y, waypoint.z);
		if (destination.sub(enemy.position).Magnitude < 80 && (enemy.ac04PathIndex ?? 0) < path.size() - 1) enemy.ac04PathIndex = (enemy.ac04PathIndex ?? 0) + 1;
	} else if (group.domain === "missile") {
		const station = enemy.ac04Station ?? enemy.position;
		if (session.missionId === 14 && group.id === "missile-final") {
			const offset = lateM14FinalMissileOffset(session.elapsed - (enemy.ac04SpawnedAt ?? session.elapsed));
			destination = new Vector3(offset.x, station.Y + offset.dy, session.ac04ReturnZ ?? 3200);
		} else {
			const attacked = session.enemies.some((e) => e.ac04Group?.id === "missile-2" && e.health < e.maxHealth);
			const lane = session.missionId === 14 && group.id === "missile-2" ? lateM14WaveTwoLaneX(enemy.ac04Index ?? 0, station.X, attacked) : station.X;
			destination = new Vector3(lane, station.Y, session.ac04ReturnZ ?? 3200);
		}
	} else if (group.protected) {
		// Flights reach their return line at the authored arrival clock; preserve their distinct altitudes.
		const station = enemy.ac04Station!;
		const fraction = math.clamp((session.elapsed - session.ac04!.phaseAt) / AC04Runner.Phase(session.ac04!).seconds, 0, 1);
		destination = new Vector3(station.X + (1600 - station.X) * fraction, station.Y, station.Z + ((session.ac04ReturnZ ?? 3200) - station.Z) * fraction);
		enemy.position = destination; enemy.velocity = new Vector3(0, 0, group.speed ?? 35);
		enemy.frame = CFrame.lookAt(destination, destination.add(new Vector3(0.2, 0, 1))); return true;
	} else {
		const station = enemy.ac04Station!;
		// Large, continuous routes keep bombers/transports in their mission area without pursuing the player.
		const a = session.elapsed * (group.speed ?? 70) / 1800;
		destination = new Vector3(math.clamp(station.X + math.sin(a) * 900, -3200, 3200), station.Y, math.clamp(station.Z + (1 - math.cos(a)) * 1500, -3200, 3200));
	}
	const delta = destination.sub(enemy.position);
	const desired = unitOr(delta, enemy.direction);
	enemy.direction = unitOr(enemy.direction.Lerp(desired, FlightMath.DampAlpha(group.domain === "missile" ? 3 : 1.2, dt)), desired);
	const speed = actor && !transport ? 160 : group.speed ?? 70;
	enemy.velocity = enemy.direction.mul(speed); enemy.position = enemy.position.add(enemy.velocity.mul(dt));
	enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction));
	if (group.domain === "missile" && lateMissilePastDefense(enemy.position.Z, session.ac04ReturnZ ?? 3200)) AC04Runner.Fail(session.ac04!, "missile_escaped");
	if (actor && !transport) {
		enemy.fireTimer -= dt;
		if (enemy.fireTimer <= 0 && delta.Magnitude < 1700) { launchMissile(session, true, enemy); enemy.fireTimer = 8; }
	}
	return true;
}
function fireAC04Gun(session: CombatSession): void {
	if (!session.ac04 || session.rearmUntil !== undefined || (session.gunAmmo ?? 0) <= 0 || (session.gunCooldown ?? 0) > 0) return;
	session.gunAmmo = math.max(0, (session.gunAmmo ?? 0) - 5); session.gunCooldown = .1;
	const origin = positionFor(session.state), forward = directionFor(session.state);
	const hit = Workspace.Raycast(origin, forward.mul(1200), session.collisionParams!);
	const reach = hit ? hit.Distance : 1200;
	let target: Enemy | undefined, distance = math.huge;
	for (const enemy of session.enemies) {
		if (!ownsEnemy(session, enemy) || !canHurt(session, enemy)) continue;
		const hitDistance = ac04GunHitDistance(enemy.model, enemy.position, origin, forward, 1200, hit);
		if (hitDistance !== undefined && hitDistance < distance) { target = enemy; distance = hitDistance; }
	}
	effect(session, "hit", origin.add(forward.mul(math.min(reach, distance, 1200))), { scale: .12 });
	if (!target || ac04ProtectedHit(session, target)) return;
	if (target.health <= 16) destroyEnemy(session, target);
	else { target.health -= 16; target.model.SetAttribute("Health", target.health); }
}
function requestAC04Rearm(session: CombatSession): void {
	if (!session.ac04 || session.rearmUntil !== undefined || session.elapsed - (session.rearmAt ?? -100) < 15) return;
	if (session.state.z < (session.ac04ReturnZ ?? 3200) - 120) { radio(session, "Cross the southern return line to replenish weapons.", 4); return; }
	if (AC04Runner.Phase(session.ac04).kind === "return") { AC04Runner.CrossReturn(session.ac04, os.clock()); return; }
	// A skipped landing turnaround: time continues. Full landing/takeoff presentation is a separate fidelity gate.
	const aircraft = ac04Aircraft(session.aircraftType ?? "F-4E");
	session.missiles = aircraft.missiles; session.gunAmmo = aircraft.gun; session.special = SpecialWeapons.New("salvo");
	session.health = 100; session.rearmAt = session.elapsed;
	radio(session, "Base control: Aircraft serviced. Weapons replenished. Resume the operation.", 6);
}
function stepAC04Flight(session: CombatSession, from: { x: number; y: number; z: number }, dt: number): void {
	const run = session.ac04!;
	ac04RadioTick(session, dt);
	session.gunCooldown = math.max(0, (session.gunCooldown ?? 0) - dt);
	const p = AC04Runner.Phase(run);
	const crossed = from.z < (session.ac04ReturnZ ?? 3200) && session.state.z >= (session.ac04ReturnZ ?? 3200);
	if (crossed) { if (p.kind === "return") AC04Runner.CrossReturn(run, os.clock()); else if (p.kind !== "escape") requestAC04Rearm(session); }
	if (p.kind === "escape") {
		const layout = AC04WorldPlanner.Layout(session.missionId);
		const escape = layout.escape;
		if (escape) {
			session.lateEscape ??= {};
			if (session.lateEscape.previous === undefined) lateMegalithEscapeUpdate(session.lateEscape, escape, layout.escapeRadius ?? 250, from.x, from.y, from.z, session.elapsed);
			if (lateMegalithEscapeUpdate(session.lateEscape, escape, layout.escapeRadius ?? 250, session.state.x, session.state.y, session.state.z, session.elapsed)) AC04Runner.Escape(run, os.clock());
		}
	}
	if (p.special === "stonehenge-escape" || p.special === "stonehenge-periodic") {
		const elapsed = run.elapsed - run.phaseAt;
		const barrage = ac04BarrageState(elapsed, p.special === "stonehenge-escape");
		if (barrage.warning !== undefined && session.barrageAt !== barrage.warning) {
				session.barrageAt = barrage.warning;
				session.ac04Radio?.Add(["SkyEye: Stonehenge firing. Get below 2,000 feet!"], true); ac04RadioTick(session);
		}
		if (barrage.damaging && session.state.y > 400) {
				const damage = 20 * dt; session.health = math.max(0, session.health - damage); session.damageTaken += damage; session.lowestHealth = math.min(session.lowestHealth, session.health);
		}
	}
	if (session.missionId === 15 && (run.groupKills.get("yellow") ?? 0) >= 4) {
		for (const enemy of session.enemies) if (enemy.ac04Group?.id === "yellow" && ownsEnemy(session, enemy)) { enemy.enabled = false; enemy.withdrawUntil = session.elapsed + 5; enemy.passDirection = new Vector3(0, .2, -1); markTarget(session, enemy); }
	}
	applyAC04Phase(session);
}

function applyPhase(session: CombatSession): void { applyAC04Phase(session); }

function destroyEnemy(session: CombatSession, enemy: Enemy): void {
	if (!ownsEnemy(session, enemy)) return;
	const accepted = sessionRecordKill(session, enemy.id, enemy.kind, enemy.required, os.clock());
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
	session.kills = sessionAllKills(session);
	applyPhase(session);
	if (session.ac04?.outcome === undefined) {
		if (session.missionId === 18 && enemy.ac04Group?.id === "core") { lateOpenMegalithHatch(session.folder, session.ac04!); ac04RadioEvent(session, "core"); }
		else if (session.missionId === 18 && session.ac04?.phaseIndex === 0 && enemy.ac04Group?.id.find("generator")[0] !== undefined) ac04RadioEvent(session, "generator", false);
		else if (session.missionId === 1 && !enemy.required) ac04RadioEvent(session, "bombersRemain");
	}
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
	let protectedTarget: Enemy | undefined;
	if (hostile) {
		if (!ownsEnemy(session, enemy) || (!session.ac04 && enemy.kind === "ground")) return;
		position = enemy.position.add(enemy.direction.mul(18));
		protectedTarget = ac04ProtectedTarget(session, enemy);
		if (protectedTarget && session.missionId === 11) ac04RadioEvent(session, "threatened");
		direction = unitOr((protectedTarget?.position ?? positionFor(session.state)).sub(position), enemy.direction);
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
			canDamage: current ? canHurt(session, current) && !ac04Jammed(session, current) : false,
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
	session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, direction, hostile), position, direction, target, protectedTarget, hostile, age: 0, ace, damage, speed,
		obstructionParams: hostile && session.ac04 && enemy?.kind === "ground" ? AircraftCollision.WithoutShooter(session.collisionParams!, enemy.model) : undefined,
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
			const allowed = canHurt(session, enemy) && !ac04Jammed(session, enemy);
			let distance = math.huge, dot = -1;
			if (allowed) [distance, dot] = targetMetrics(session, enemy);
			return { distance, dot, ground: enemy.kind === "ground", required: enemy.required, allowed, current: enemy === current };
		});
		salvo = SpecialWeapons.SalvoTargets(candidates, range);
		targets = salvo.size();
	} else if (state.kind === "lance") {
		let locked = false;
		if (current && canHurt(session, current) && !ac04Jammed(session, current) && session.lockProgress >= WeaponRules.LockedAt) {
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
function aceCall(session: CombatSession, enemy: Enemy): void { if (session.target === enemy) acquireTarget(session); }
function stepEnemies(session: CombatSession, dt: number): void {
	const playerPosition = positionFor(session.state);
	const playerForward = directionFor(session.state);
	const playerVelocity = playerForward.mul(session.state.speed);
	const lateral = lateralFor(session.state, playerForward);
	const site: {x:number;y:number;z:number} | undefined = undefined;
	const protectPhase = false;
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
	const flightGate = ThreatRules.FlightGate(gateBase, live, maxDivisor, false);
	const cap = ThreatRules.ThreatCap(live, maxCap);
	let flightReady = ThreatRules.FlightReady({ sinceLastWindup: session.elapsed - session.lastWindupAt, gate: flightGate, threats, cap });
	for (let index = 0; index < session.enemies.size(); index++) {
		const enemy = session.enemies[index];
		if (enemy.withdrawUntil !== undefined) { if (enemy.health > 0) stepWithdrawing(session, enemy, dt); continue; }
		if (session.ac04 && stepAC04Unit(session, enemy, dt)) continue;
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
			else if (event === "returned") radio(session, `SkyEye: ${enemy.name} is turning back in.`);
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
	if (ac04ProtectedHit(session, enemy)) return true;
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

/**
 * An ace crossing 2/3 or 1/3 health: a stage call (radio line), 3 s invulnerability, the lock on it reset,
 * more speed, and (when its phase holds raiders for this stage) a retreat to call them (AceRules).
 */
function aceStage(session: CombatSession, enemy: Enemy, before: number, after: number): void {
	const aceState = enemy.aceState!;
	const raiders = 0;
	const retreats = AceRules.RaidersForStage(raiders, aceState.stage + 1) > 0;
	if (!AceRules.Cross(aceState, enemy.maxHealth, before, after, session.elapsed, retreats)) return;
	enemy.speedBonus += tuned(session, TUNING.aceStageSpeed);
	enemy.windup = 0; enemy.warning!.Enabled = false; enemy.model.SetAttribute("AttackWarning", false);
	if (enemy.mode === "extend") enemy.mode = "attack";
	if (session.target === enemy) session.lockProgress = 0;
	const lines: string[] | undefined = undefined;
	const fallback = retreats ? `${enemy.name}: Not bad, trainee. Wing, on me.` : aceState.stage === 1 ? `${enemy.name}: Not bad, trainee. Again.` : `${enemy.name}: Enough. Head on.`;
	radio(session, lines?.[aceState.stage - 1] ?? fallback);
}
function stepMissiles(session: CombatSession, dt: number): void {
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
			const obstruction = session.ac04 ? Workspace.Raycast(missile.position, nextPosition.sub(missile.position), session.collisionParams!) : undefined;
			if (obstruction && (hit === undefined || !obstruction.Instance.IsDescendantOf(session.enemies[hit].model))) { removed = true; effect(session, "missile", obstruction.Position); }
			else if (hit !== undefined) {
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
			const targetPosition = missile.hostile ? missile.protectedTarget?.position ?? positionFor(session.state) : missile.target!.position;
			const velocity = missile.hostile ? missile.protectedTarget?.velocity ?? directionFor(session.state).mul(session.state.speed) : missile.target!.velocity;
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
			const obstruction = session.ac04 ? Workspace.Raycast(missile.position, nextPosition.sub(missile.position), missile.obstructionParams ?? session.collisionParams!) : undefined;
			const hitTargetSurface = obstruction !== undefined && !missile.hostile && missile.target !== undefined && obstruction.Instance.IsDescendantOf(missile.target.model);
			if (obstruction && !hitTargetSurface) { removed = true; effect(session, "missile", obstruction.Position); }
			else if (hitTargetSurface || segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile ? tuned(session, TUNING.missileFuse) : WeaponRules.FuseRadius)) {
				removed = true;
				effect(session, "hit", targetPosition);
				if (missile.hostile && missile.protectedTarget) {
					const actor = missile.protectedTarget; actor.health = math.max(0, actor.health - missile.damage); actor.model.SetAttribute("Health", actor.health);
					if (actor.health <= 0 && session.ac04) AC04Runner.Fail(session.ac04, "protected_lost");
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
	if (!refreshSession(session, os.clock())) return;
	session.stepCount += 1;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	EvadeRules.Tick(session.evade, dt);
	SpecialWeapons.Tick(session.special, dt);
	session.regen += dt;

	// Input silence (a suspended phone app, a dropped connection): centre the stick and ease the
	// jet level, since a centred stick alone would now hold whatever dive it was in.
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; session.input.assist = true; }
	if (sessionOutcome(session) !== undefined) { finish(session); return; }
	applyPhase(session);
	const from={x:session.state.x,y:session.state.y,z:session.state.z};
	if (session.inputFresh) { session.inputFresh = false; session.inputSteps = 0; }
	FlightMath.Step(session.state, session.input, dt);
	// Resolve impacts before navigation, phase completion, enemy fire or missile kills.
	const hit = AircraftCollision.Sweep(new Vector3(from.x, from.y, from.z), new Vector3(session.state.x, session.state.y, session.state.z), session.collisionParams!);
	if (hit) { session.crashReason = AircraftCollision.Reason(hit); finish(session); return; }
	session.inputSteps += 1;
	if (session.ac04) { stepAC04Flight(session, from, dt); if (sessionOutcome(session) !== undefined) { finish(session); return; } }
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
		const staged = ac04Jammed(session, session.target) || session.target.aceState !== undefined && AceRules.Invulnerable(session.target.aceState, session.elapsed);
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
 * forward by the paused span, so no sortie time passed while paused. Returns whether it sent telemetry.
 */
function resumeSession(session: CombatSession, now: number): boolean {
	if (!PauseRules.Paused(session.pause)) return false;
	const shift = PauseRules.Resume(session.pause, now);
	if (session.ac04) session.ac04.startedAt += shift;
	session.lastInput = now;
	if (!refreshSession(session, now)) return false;
	sendTelemetry(session); sendFlightState(session);
	return true;
}

// Clients supply validated controls and button events, never damage or results.
export const CombatService = {
	EndMission(player: Player): void {
		const session = sessions.get(player);
		if (session) cleanupSession(session);
	},
	GetSession(player: Player): CombatSession | undefined { return sessions.get(player); },
	StartMission(player: Player, slot: number, missionId = 1, aircraftType = "F-4E"): LuaTuple<[boolean, string?]> {
		if (!missionState || !onFinished) return $tuple(false, "CombatService is not initialized");
		if (!FlightMath.IsFinite(slot) || slot % 1 !== 0 || slot < 1 || slot > 4) return $tuple(false, "Choose a save slot from 1 to 4");
		if (!(FlightMath.IsFinite(missionId) && missionId >= 1 && missionId <= 18 && missionId % 1 === 0)) return $tuple(false, "Choose a valid mission");
		const campaignId = "ac04", specialKind: SpecialKind = "salvo", difficultyKind: DifficultyKind = "normal";
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
			const ac04 = true;
			const ac04World = AC04World.Build(missionId, folder, () => player.Parent === Players && folder.Parent !== undefined);
			const world = {groundTargets: ac04World.groundTargets.map(t=>t.model)};
			assert(player.Parent === Players, "Player left during world construction");
			const aircraft = AC04World.CreateAircraft(aircraftType, `MOBIUS 1 · ${aircraftType}`);
			assert(player.Parent === Players, "Player left during aircraft construction");
			prepareAC04Aircraft(aircraft);
			aircraft.SetAttribute("SkybreakOwner", player.UserId);
			aircraft.SetAttribute("SkybreakPlayer", true);
			JetFactory.SetTrails(aircraft, false); // the client flies a predicted local clone that owns the trails
			aircraft.Parent = folder;
			const state = FlightMath.NewState();
			if (ac04World) { state.x = ac04World.spawn.x; state.y = ac04World.spawn.y; state.z = ac04World.spawn.z; }
			aircraft.PivotTo(frameFor(state));
			const session: CombatSession = {
				player, slot, folder, aircraft, state, missionId, campaignId, aircraftType,
				ac04ReturnZ: ac04World?.returnZ, gunAmmo: ac04 ? ac04Aircraft(aircraftType).gun : undefined,
				lastWindupAt: -math.huge, radioSerial: 0, chatterIndex: 0,
				input: { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, health: 100, kills: 0, elapsed: 0,
				missiles: ac04 ? ac04Aircraft(aircraftType).missiles : MAX_MISSILES, missileCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				special: SpecialWeapons.New(specialKind),
				difficulty: difficultyKind,
				enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
				inputClientTime: 0, inputFresh: false, inputSteps: 0, inputTokens: INPUT_BURST, inputTokensAt: os.clock(), stateTime: 0, stateSequence: 0, telemetrySequence: 0,
				missilesFired: 0, missileHits: 0, flareBursts: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
				evade: EvadeRules.New(), guard: StepGuard.New(), pause: PauseRules.New(), pauseAck: 0, settlement: Settlement.New(),
				banditSerial: 0, raiderSerial: 0, spawnSerial: 0, reinforceIndex: 0, stepCount: 0,
			};
			session.ac04 = AC04Runner.New(missionId, startedAt); session.ac04Radio = new AC04RadioQueue(); session.ac04RadioEvents = new Set();
			for (let index = 0; index < world.groundTargets.size(); index++) {
				const model = world.groundTargets[index];
				const ac04Target = ac04World?.groundTargets[index];
				const group = ac04Target ? session.ac04!.mission.roster.find((g) => g.id === ac04Target.groupId) : undefined;
				assert(model.Parent === folder && model.PrimaryPart !== undefined, "Ground target must have a stationary aim center in its session");
				const enemy: Enemy = {
					id: ac04Target?.id ?? `ground_${index + 1}_${missionSerial}`, name: model.Name, model, health: group?.health ?? 55, maxHealth: group?.health ?? 55, ac04Group: group,
					position: model.PrimaryPart.Position, direction: new Vector3(0, 0, -1), velocity: Vector3.zero,
					kind: "ground", groundIndex: index, required: group?.required ?? true, enabled: false, fireTimer: 0, windup: 0,
					mode: "attack", modeTimer: 0, passDirection: new Vector3(0, 0, -1), side: 1,
					flares: 0, flareTimer: 0, flareUntil: 0, speedBonus: 0, lockBreakTimer: 0, breakTimer: 0, breakUntil: 0, lockBreakChance: 0, hiddenParts: [],
				};
				// AC04 phase activation reveals the authored ground groups.
				const hideUntilActivated = true;
				for (const item of model.GetDescendants()) {
					if (item.IsA("BasePart")) {
						item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = item.Transparency < 1;
						const originalTransparency = item.GetAttribute("NativeTransparency");
						const originalSolid = item.GetAttribute("NativeFlightSolid");
						if (ac04 && typeIs(originalSolid, "boolean")) item.SetAttribute("FlightSolid", originalSolid);
						else item.SetAttribute("FlightSolid", item.CanQuery);
						if (ac04 && typeIs(originalTransparency, "number")) item.Transparency = originalTransparency;
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
			const loading: MissionLoading = { kind: "Loading", campaignId, slot, missionId, aircraft, expectedParts: countParts(folder) };
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
				if (PauseRules.Paused(session.pause) || !refreshSession(session, now)) return;
				if (action === "FireGun") fireAC04Gun(session);
				else if (action === "Rearm") requestAC04Rearm(session);
				else if (action === "FireMissile") launchMissile(session, false);
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
