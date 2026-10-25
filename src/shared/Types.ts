export type Persistence = "cloud" | "session" | "unavailable";
export interface SaveSlot {
	index: number;
	occupied: boolean;
	/** True only after every mission in the catalog has been completed at least once. */
	completed: boolean;
	kills: number;
	bestTime?: number;
	updatedAt?: number;
	/** Mission the player should resume on; equals highestUnlocked. */
	currentMission?: number;
	/** 1..MissionCount; the furthest mission the player can launch. */
	highestUnlocked?: number;
	/** Per-mission completion flags. */
	missionCompleted?: Map<number, boolean>;
	/** Per-mission best times (seconds). */
	missionBestTime?: Map<number, number>;
	// Legacy v2 scalar fields; preserved for UI and rollback compatibility.
	mission1Completed?: boolean;
	mission2Completed?: boolean;
	mission1BestTime?: number;
	mission2BestTime?: number;
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
	objective?: string;
	objectiveProgress?: number;
	objectiveTotal?: number;
	timeRemaining?: number;
	tutorialStep?: string;
	groundKills?: number;
	targetKind?: "air" | "ground" | "navigation" | "";
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
