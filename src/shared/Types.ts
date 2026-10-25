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
	elapsed: number;
	targetDistance?: number;
	boundaryWarning?: boolean;
}
export interface MissionFinished extends MissionStats {
	kind: "Completed" | "Failed";
	saved?: boolean;
	persistence?: Persistence;
}
export type MissionMessage = MissionStarted | Telemetry | MissionFinished;
export type FinishedCallback = (player: Player, won: boolean, stats: MissionStats) => void;
