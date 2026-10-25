export type Persistence = "cloud" | "session" | "unavailable";

/** v3 per-mission record; absent entries default to not completed. */
export interface MissionProgress {
	completed: boolean;
	bestTime?: number;
}

export interface SaveSlot {
	index: number;
	occupied: boolean;
	/** True only when every catalog mission has been completed on this slot. */
	completed: boolean;
	kills: number;
	bestTime?: number;
	updatedAt?: number;
	/** The next uncompleted mission for this slot (clamped to the mission count). */
	currentMission?: number;
	/** Mirrored legacy fields for v1/v2 presentation and migration. */
	mission1Completed?: boolean;
	mission2Completed?: boolean;
	mission1BestTime?: number;
	mission2BestTime?: number;
	/** v3 fields. */
	missionsCompleted?: number;
	missions?: MissionProgress[];
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
	Cutscene: RemoteEvent;
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
	protectedHealth?: number;
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

/** Server-authored cinematic payload sent from CutsceneService to the client player. */
export interface CutsceneBeat {
	speaker: string;
	text: string;
	shot: string;
	seconds: number;
}

export interface CutscenePayload {
	kind: "Cutscene";
	cutsceneId: string;
	title: string;
	tone: string;
	beats: CutsceneBeat[];
	/** The context the client should restore after the cutscene ends. */
	returnScreen: "menu" | "briefing" | "outcome";
	/** Server-supplied token the client echoes back when it finishes or skips. */
	token: string;
}

export interface CutsceneAck {
	kind: "Ack";
	token: string;
	completed: boolean;
}

export type CutsceneMessage = CutscenePayload | CutsceneAck;
