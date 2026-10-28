import { FlightMath } from "./FlightMath";
import { GameConfig } from "./GameConfig";
import { WorldAirspace } from "./WorldAirspace";

/** Runtime enemy/scoring roles already used by combat, plus the first campaign additions. */
export type EncounterRole = "bandit" | "raider" | "courier" | "ace" | "ground" | "bomber" | "escort";

export interface MissionAirspacePolicy {
	softHalfWidth: number;
	hardHalfWidth: number;
	spawnLimit: number;
	radarRange: number;
}

export interface MissionStartPolicy {
	kind: "airborne" | "carrier_flyoff";
	x: number;
	y: number;
	z: number;
	headingDegrees: number;
	speed?: number;
}

export interface MissionScoringPolicy {
	/**
	 * Points by encounter role. Existing keys are bandit, raider, courier, ace and ground;
	 * new mission profiles may add documented roles such as bomber and escort.
	 */
	points: { [role: string]: number };
	/** Score thresholds, best rank first. A score below C receives D. */
	rank: { S: number; A: number; B: number; C: number };
}

/** Optional mission-owned policy. Omitted fields preserve the current campaign. */
export interface MissionPolicy {
	countdownSeconds?: number;
	airspace?: MissionAirspacePolicy;
	start?: MissionStartPolicy;
	scoring?: MissionScoringPolicy;
	/** Future world-plan selector. Omitted missions continue to use their region. */
	worldKey?: string;
	/** Future release gate. Omitted missions remain available as they are today. */
	available?: boolean;
}

export const LEGACY_MISSION_AIRSPACE: MissionAirspacePolicy = {
	softHalfWidth: WorldAirspace.soft,
	hardHalfWidth: WorldAirspace.hard,
	spawnLimit: WorldAirspace.spawnLimit,
	radarRange: WorldAirspace.radarRange,
};

export const LEGACY_MISSION_START: MissionStartPolicy = {
	kind: "airborne",
	x: 0,
	y: 250,
	z: 500,
	headingDegrees: 0,
	speed: FlightMath.CruiseSpeed,
};

/** Legacy target points and performance-rating cuts used by MissionScore today. */
export const LEGACY_MISSION_SCORING: MissionScoringPolicy = {
	points: { bandit: 100, raider: 100, courier: 100, ace: 100, ground: 150 },
	rank: { S: 90, A: 75, B: 55, C: 35 },
};

export const LEGACY_MISSION_COUNTDOWN = GameConfig.Campaign.MissionTimeLimit;

function finite(value: number): boolean {
	return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
}

/** Validates only the optional policy surface; catalog content validation remains in MissionCatalog. */
export function validateMissionPolicy(policy: MissionPolicy, missionId: number): void {
	const tag = `Mission ${missionId} policy`;
	if (policy.countdownSeconds !== undefined) {
		assert(finite(policy.countdownSeconds) && policy.countdownSeconds > 0, `${tag} countdownSeconds must be finite and > 0`);
	}
	if (policy.airspace !== undefined) {
		const airspace = policy.airspace;
		for (const [name, value] of pairs(airspace)) {
			assert(finite(value) && value > 0, `${tag} airspace.${name} must be finite and > 0`);
		}
		assert(airspace.hardHalfWidth >= airspace.softHalfWidth, `${tag} airspace hardHalfWidth must be >= softHalfWidth`);
		assert(airspace.spawnLimit <= airspace.hardHalfWidth, `${tag} airspace spawnLimit must be <= hardHalfWidth`);
	}
	if (policy.start !== undefined) {
		const start = policy.start;
		assert(start.kind === "airborne" || start.kind === "carrier_flyoff", `${tag} start.kind is invalid`);
		for (const [name, value] of pairs({ x: start.x, y: start.y, z: start.z, headingDegrees: start.headingDegrees })) {
			assert(finite(value), `${tag} start.${name} must be finite`);
		}
		if (start.speed !== undefined) assert(finite(start.speed) && start.speed > 0, `${tag} start.speed must be finite and > 0`);
		if (policy.airspace !== undefined) {
			assert(math.abs(start.x) <= policy.airspace.hardHalfWidth && math.abs(start.z) <= policy.airspace.hardHalfWidth,
				`${tag} start must be inside airspace.hardHalfWidth`);
		}
	}
	if (policy.scoring !== undefined) {
		let roles = 0;
		for (const [role, points] of pairs(policy.scoring.points)) {
			roles += 1;
			assert(typeIs(role, "string") && role.size() > 0, `${tag} scoring point roles must not be empty`);
			assert(finite(points) && points >= 0, `${tag} scoring.points.${role} must be finite and >= 0`);
		}
		assert(roles > 0, `${tag} scoring.points must define at least one role`);
		const rank = policy.scoring.rank;
		for (const [name, value] of pairs(rank)) assert(finite(value), `${tag} scoring.rank.${name} must be finite`);
		assert(rank.S > rank.A && rank.A > rank.B && rank.B > rank.C && rank.C >= 0,
			`${tag} scoring rank thresholds must satisfy S > A > B > C >= 0`);
	}
	if (policy.worldKey !== undefined) assert(policy.worldKey.size() > 0, `${tag} worldKey must not be empty`);
	if (policy.available !== undefined) assert(typeIs(policy.available, "boolean"), `${tag} available must be boolean`);
}
