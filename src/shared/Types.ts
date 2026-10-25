export type Persistence = "cloud" | "session" | "unavailable";
export interface MissionRecord {
	completed: boolean;
	bestTime?: number;
	/** Timestamp of first completion (for cutscene gating). */
	firstCompletedAt?: number;
}
export interface SaveSlot {
	index: number;
	occupied: boolean;
	/** Full campaign (all 27 missions) completed. */
	completed: boolean;
	/** Legacy aggregate total used by presentation code. */
	kills: number;
	bestTime?: number;
	updatedAt?: number;
	/** Highest unlocked mission (1-27). */
	currentMission?: number;
	/** Per-mission records; sparse by missionId (1..27). */
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
}
export interface CampaignResponse {
	ok: boolean;
	error?: string;
	slots?: SaveSlot[];
	persistence?: Persistence;
}
export interface Remotes {
	CampaignRequest: RemoteFunction;
	FlightInput: RemoteEvent;
	CombatAction: RemoteEvent;
	MissionState: RemoteEvent;
}
export interface FlightInput {
	x: number;
	y: number;
	throttle: number;
}
export interface MissionStats {
	missionId?: number;
	groundKills?: number;
	reason?: string;
	completedPhases?: number;
	slot: number;
	kills: number;
	elapsed: number;
}
export interface MissionStarted {
	missionId?: number;
	kind: "Started";
	slot: number;
	aircraft: Model;
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
	kills: number;
	total: number;
	missiles: number;
	missileCooldown: number;
	evadeCooldown: number;
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
	/** Why the latest FIRE press was refused; `fireDeniedSerial` increments on every refusal. */
	fireDenied?: "no_ammo" | "cooldown" | "blind";
	/** False while the current phase protects the selected target (no guided shot possible). */
	targetDamageable?: boolean;
	fireDeniedSerial?: number;
}
export interface MissionFinished extends MissionStats {
	kind: "Completed" | "Failed";
	saved?: boolean;
	persistence?: Persistence;
}
export type MissionMessage = MissionLoading | MissionStarted | Telemetry | MissionFinished;
export type FinishedCallback = (player: Player, won: boolean, stats: MissionStats) => void;
