export type Persistence = "cloud" | "session" | "unavailable";
export interface SaveSlot {
	index: number;
	occupied: boolean;
	completed: boolean;
	kills: number;
	bestTime?: number;
	updatedAt?: number;
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
	slot: number;
	kills: number;
	elapsed: number;
}
export interface MissionStarted {
	kind: "Started";
	slot: number;
	aircraft: Model;
}
export interface Telemetry {
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
