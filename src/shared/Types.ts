import type { MissionReason } from "./OutcomeReason";
import type { MissionAirspacePolicy } from "./MissionPolicy";
import type { FireNotice } from "./WeaponRules";
export type Persistence = "cloud" | "session" | "unavailable";
export interface MissionRecord {
	/** Layout revision that produced bestTime (absent on old saves). */
	timeVersion?: number;
	completed: boolean;
	bestTime?: number;
	/** Timestamp of first completion (for cutscene gating). */
	firstCompletedAt?: number;
	/** Highest debrief score on a completed run (MissionScore). */
	bestScore?: number;
	/** Optional points ledger associated with bestScore; absent from legacy records. */
	bestTargetScore?: import("./TargetScore").TargetScoreSnapshot;
	/** Best debrief rank on a completed run: S, A, B, C or D. */
	bestRank?: string;
}
export interface SaveSlot {
	index: number;
	occupied: boolean;
	/** Full campaign (all 18 missions) completed. */
	completed: boolean;
	/** Legacy aggregate total used by presentation code. */
	kills: number;
	bestTime?: number;
	updatedAt?: number;
	/** Highest unlocked mission (1-18). */
	currentMission?: number;
	/** Per-mission records; sparse by missionId (0 = practice, 1..18 = campaign). */
	missions?: { [missionId: number]: MissionRecord };
	// Legacy v2 fields retained for presentation code and compatibility.
	mission1Completed?: boolean;
	mission2Completed?: boolean;
	mission1BestTime?: number;
	mission2BestTime?: number;
	/** Opening cinematic viewed on this slot. */
	introSeen?: boolean;
	/** Set of mission briefing cinematics viewed on this slot. */
	cutscenesSeen?: number[];
	/** Bumped each time the player deletes this slot; a higher generation replaces older data instead of merging. */
	generation?: number;
	/** Last special weapon chosen on the briefing screen for this slot (SpecialWeapons kind). */
	special?: string;
	/** Last difficulty chosen on the briefing screen for this slot (Difficulty kind). */
	difficulty?: string;
}
export type DeletionStatus = "confirmed" | "pending" | "failed" | "session-only";
export interface SlotDeletion {
	slot: number;
	generation: number;
	status: DeletionStatus;
}
/** String-keyed dictionaries survive Roblox remote serialization, including practice 0. */
export type WireSaveSlot = Omit<SaveSlot, "missions"> & {
 missions?: { [missionId: string]: MissionRecord } | SaveSlot["missions"];
};
export interface CampaignResponse {
	/** Local acceptance is distinct from durable deletion confirmation. */
	deletions?: SlotDeletion[];
	ok: boolean;
	error?: string;
	slots?: WireSaveSlot[];
	persistence?: Persistence;
}
export interface Remotes {
	CampaignRequest: RemoteFunction;
	/** Client -> server stick/throttle at <= 20 Hz. Unreliable: a lost packet is superseded by the next. */
	FlightInput: UnreliableRemoteEvent;
	CombatAction: RemoteEvent;
	/** Reliable lifecycle (Loading/Started/Completed/Failed) plus HUD text/target changes (`HudState`). */
	MissionState: RemoteEvent;
	/** Server -> client authoritative flight state at 20 Hz for prediction (FlightStatePacket). */
	FlightState: UnreliableRemoteEvent;
	/** Server -> client HUD numbers at 10 Hz (TelemetryPacket). */
	Telemetry: UnreliableRemoteEvent;
	/** Server -> client cosmetic kill/impact explosions (CombatEffectPacket); drawn locally. */
	CombatEffect: RemoteEvent;
}
/** `model` (air kills) lets the client turn its smoothed visual into a falling wreck. */
export interface CombatEffectPacket {
	kind: string;
	position: Vector3;
	velocity?: Vector3;
	scale?: number;
	model?: Model;
}
export interface FlightInput {
	/** Turn stick, -1 (left) .. 1 (right): heading rate, not a target heading. */
	x: number;
	/** Pitch stick, -1 (nose down) .. 1 (nose up): pitch rate; centred holds the attitude. */
	y: number;
	/** Absolute chosen speed: 0 = 75 mph, 0.65 = 800 mph, 1 = 3000 mph; retained on release. */
	throttle: number;
	/** Opt-in level-out assist (settings): a centred stick eases back to wings-level flight. */
	assist?: boolean;
}
/** FlightInput on the wire: `t` is the client's os.clock() at send, echoed back for round-trip timing; `assist` is the level-out setting. */
export interface FlightInputPacket extends FlightInput {
	t: number;
}
/**
 * HUD fields that change rarely (text, target reference, navigation). Sent on the
 * reliable MissionState remote only when one of them changes, so an Instance
 * reference never races its own replication and a radio line is never lost.
 */
export interface HudState {
	kind: "HudState";
	missionId?: number;
	phase?: string;
	objective?: string;
	tutorialStep?: string;
	targetName: string;
	targetKind?: string;
	targetRequired?: boolean;
	target?: Model;
	navigation?: Vector3;
	navigationRadius?: number;
	navigationCeiling?: number;
	radio?: string;
	radioSerial?: number;
	radioSeconds?: number;
	radioPriority?: boolean;
	fireDenied?: FireNotice;
	fireDeniedSerial?: number;
	/** Equipped special weapon (SpecialWeapons kind); constant for the sortie. */
	special?: string;
}
export interface MissionStats {
	/** Server-owned target ledger; present only for points-basis sorties. */
	targetScore?: import("./TargetScore").TargetScoreSnapshot;
	missionId?: number;
	groundKills?: number;
	reason?: MissionReason;
	completedPhases?: number;
	slot: number;
	kills: number;
	elapsed: number;
	/** Debrief counters tracked by CombatService. */
	optionalKills?: number;
	missilesFired?: number;
	missileHits?: number;
	damageTaken?: number;
	lowestHealth?: number;
	evades?: number;
	/** Level the sortie was flown on (Difficulty kind). */
	difficulty?: string;
}
/** Reliable transition, including an exact prediction reset before accepting controls. */
export interface FlightControlHandoff {
	kind: "FlightControl";
	state: import("./FlightMath").FlightState;
	sequence: number;
}
export interface MissionStarted {
	initialState?: import("./FlightMath").FlightState;
	launchIntro?: boolean;
	/** Effective session limits delivered reliably before client control; absent on old servers. */
	airspace?: MissionAirspacePolicy;
	missionId?: number;
	kind: "Started";
	slot: number;
	aircraft: Model;
	/** Level the sortie is flown on (Difficulty kind). */
	difficulty?: string;
}
/** World and aircraft exist on the server; play begins on "Started" once the client is ready or the server times out. */
export interface MissionLoading {
	missionId?: number;
	kind: "Loading";
	slot: number;
	aircraft: Model;
	/** BaseParts in the mission folder when it was sent, for client progress only. */
	expectedParts?: number;
}
export interface Telemetry {
	radarJammed?: boolean;
 radarPartial?: boolean;
 jamVisualRange?: number;
 missionPoints?: number;
 terrainClearance?: number;
	missionUpdateSeconds?: number;
	missionId?: number;
	phase?: string;
	navigation?: Vector3;
	navigationRadius?: number;
	navigationCeiling?: number;
	protectedHealth?: number;
	objective?: string;
	objectiveProgress?: number;
	objectiveTotal?: number;
	timeRemaining?: number;
	tutorialStep?: string;
	groundKills?: number;
	targetKind?: string;
	targetRequired?: boolean;
	kind: "Telemetry";
	health: number;
	speed: number;
	altitude: number;
	/** Required destructions so far (bandits, ace, ground targets); never exceeds `total`. */
	kills: number;
	total: number;
	/** Optional raiders downed this sortie (separate, so the required tally cannot read 7/4). */
	optionalKills?: number;
	missiles: number;
	missileCooldown: number;
	/** Seconds until EVADE can be pressed again (0 with a charge in hand and no roll running). */
	evadeCooldown: number;
	/** Evade charges in hand (0-3); each recharges in 10 s. Absent from older servers (the HUD then treats evade as one charge). */
	evadeCharges?: number;
	/** Studs to the nearest hostile missile, when one is in the air. */
	incomingDistance?: number;
	/** A hostile missile currently satisfies the server decoy timing rule. */
	evadeThreat?: boolean;
	target?: Model;
	targetName: string;
	lockProgress: number;
	incoming: boolean;
	/** An enemy is winding up a launch; the missile itself is not in the air yet. */
	lockWarning?: boolean;
	elapsed: number;
	targetDistance?: number;
	boundaryWarning?: boolean;
	/** Latest radio line (phase beat, chatter, ace stage, flares). */
	radio?: string;
	/** Increments whenever `radio` changes so repeated lines still show. */
	radioSerial?: number;
	/** Current target's health fraction (0-1), when known. */
	targetHealth?: number;
	/** How long the HUD should hold `radio` (seconds); the HUD default applies when absent. */
	radioSeconds?: number;
	radioPriority?: boolean;
	/** Why the latest FIRE or SPECIAL press was refused; `fireDeniedSerial` increments on every refusal. */
	fireDenied?: FireNotice;
	/** Second weapon slot: equipped kind, charges left, seconds until the next use, seconds of effect remaining. */
	special?: string;
	specialCharges?: number;
	specialCooldown?: number;
	specialActive?: number;
	/** False while the current phase protects the selected target (no guided shot possible). */
	targetDamageable?: boolean;
	fireDeniedSerial?: number;
	/** The sortie's ace has been destroyed (telemetry flag); drives the ACE DOWN callout. */
	aceKilled?: boolean;
	/** The server is holding the sortie paused (telemetry flag); the client follows it, e.g. when the pause budget runs out. */
	paused?: boolean;
	/** Highest Pause/Resume serial the server has handled; the client follows `paused` only once its own request is acknowledged. */
	pauseAck?: number;
	/** Server-measured seconds left in this sortie’s shared pause budget; absent on older packets. */
	pauseRemaining?: number;
	/** Authoritative M1 movement seconds; absent outside the movement lesson/older packets. */
	turnObserved?: number;
	pitchObserved?: number;
}
export interface MissionFinished extends MissionStats {
	kind: "Completed" | "Failed";
	saved?: boolean;
	persistence?: Persistence;
	/** Server-computed debrief score and rank (MissionScore) and the par it was judged against. */
	score?: number;
	rank?: string;
	par?: number;
	/** A completed run that beat the slot's saved best score or rank for this mission. */
	newBestScore?: boolean;
	newBestRank?: boolean;
	/** Saved bests for this mission after this result. */
	bestScore?: number;
	bestRank?: string;
}
export interface LandingStarted { kind: "LandingStarted"; plan: import("./EngineBatchB").LandingPlan }
export type MissionMessage = LandingStarted | MissionLoading | MissionStarted | FlightControlHandoff | HudState | MissionFinished;
export type FinishedCallback = (player: Player, won: boolean, stats: MissionStats) => void;
