export type Persistence = "cloud" | "session" | "unavailable";
export interface MissionRecord {
	id: number;
	completed: boolean;
	bestTime?: number;
}
export interface SaveSlot {
	index: number;
	occupied: boolean;
	completed: boolean;
	kills: number;
	bestTime?: number;
	updatedAt?: number;
	currentMission?: number;
	// Legacy v2 compatibility accessors preserved so older presentation layers continue to work.
	mission1Completed?: boolean;
	mission2Completed?: boolean;
	mission1BestTime?: number;
	mission2BestTime?: number;
	// Aurora Line v3: a dense per-mission completion list for the 27 missions.
	missions?: MissionRecord[];
	// Highest mission id ever launched (useful for debriefs); never trusted for unlock.
	highestUnlocked?: number;
	// Cutscene ids the player has seen at least once. Used for first-time-only cutscenes.
	seenCutscenes?: string[];
	reducedMotion?: boolean;
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
