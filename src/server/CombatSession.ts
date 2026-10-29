import type { BomberEncounterState } from "../shared/BomberEncounter";
import type { MissionAirspacePolicy } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";
import { FlightState } from "../shared/FlightMath";
import { BlueprintState } from "../shared/BlueprintRunner";
import { MissionBlueprint } from "../shared/MissionCatalog";
import { FlightInput, HudState } from "../shared/Types";
import { ActionGateState, FireNotice } from "../shared/WeaponRules";
import { SpecialState } from "../shared/SpecialWeapons";
import { DifficultyKind } from "../shared/Difficulty";
import { EvadeState } from "../shared/EvadeRules";
import { AceStageState } from "../shared/AceRules";
import { AirRequest } from "../shared/WavePlan";
import { LoadingGateState } from "../shared/LoadingGate";
import { PauseState, SettlementHooks, SettlementState, StepGuardState } from "../shared/SessionGuard";
import { ActorFooting } from "./ActorGrounding";

export type TargetKind = "air" | "ground" | "ace";

export type EnemyMode = "attack" | "extend" | "orbit" | "run";
/** What an air enemy is: a required bandit, an optional raider, the courier of a chase phase, or the ace. */
export type AirRole = "bandit" | "raider" | "courier" | "ace" | "bomber" | "escort";
export interface Enemy {
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
	bomberSlot?: number;
	escortSlot?: number;
	escortEngaged?: boolean;
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
export interface Projectile {
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
	airspace: MissionAirspacePolicy;
	targetScore: TargetScore;
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	blueprintState?: BlueprintState;
	blueprint?: MissionBlueprint;
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
	targetStepSince?: number; targetStepHinted?: boolean;
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
	bomberEncounter?: BomberEncounterState;
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
