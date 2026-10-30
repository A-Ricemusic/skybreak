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
	/**
	 * What the rank thresholds are measured against. "points": the mission's total score
	 * (reference-matched missions, e.g. S at 800 points). "rating": today's 0-100 performance
	 * rating from MissionScore (time, accuracy, survival), which every current mission uses.
	 */
	basis: "points" | "rating";
	/** Thresholds on `basis`, best rank first. A value below C receives D. */
	rank: { S: number; A: number; B: number; C: number };
}

/** One sortie-wide flight; offsets are player-local right/up/aft studs. */
export interface MissionAllies {
	count: number;
	formation: { x: number; y: number; z: number }[];
	/** Existing friendly Kestrel family (v2 preferred with normal fallback). */
	model: "Kestrel";
	callsignPrefix: string;
	/** Default true: allies may destroy eligible optional enemies. */
	mayKill?: boolean;
	/** Default false: no player points, kill tally or objective credit. Proposed owner decision. */
	creditPlayerKills?: boolean;
	/** Default false; true requires explicit creditPlayerKills to keep objectives completable. */
	allowRequiredTargets?: boolean;
}

/** Optional mission-owned policy. Omitted fields preserve the current campaign. */
export interface MissionPressure {
	/** Fraction of five staggered eight-second targeting slots reserved for the player. */
	playerPriority: number;
	/** Raider approach half-cone, degrees either side of the nose. */
	forwardConeDegrees: number;
	/** Tail reactions use existing break cooldown, turn rate and threat budget. */
	tailDefence: boolean;
}

export interface MissionPolicy {
	pressure?: MissionPressure;
	allies?: MissionAllies;
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
	basis: "rating",
	rank: { S: 90, A: 75, B: 55, C: 35 },
};

export const LEGACY_MISSION_COUNTDOWN = GameConfig.Campaign.MissionTimeLimit;

function finite(value: number): boolean {
	return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
}

/** Validates only the optional policy surface; catalog content validation remains in MissionCatalog. */
export function validateMissionPolicy(policy: MissionPolicy, missionId: number): void {
	const tag = `Mission ${missionId} policy`;
	if (policy.pressure !== undefined) {
		const p = policy.pressure;
		assert(finite(p.playerPriority) && p.playerPriority >= 0 && p.playerPriority <= 1, `${tag} playerPriority must be 0..1`);
		assert(finite(p.forwardConeDegrees) && p.forwardConeDegrees >= 10 && p.forwardConeDegrees <= 75, `${tag} forward cone must be 10..75`);
		assert(typeIs(p.tailDefence, "boolean"), `${tag} tailDefence must be boolean`);
	}
	if (policy.allies !== undefined) {
		const a = policy.allies;
		assert(finite(a.count) && a.count % 1 === 0 && a.count >= 1 && a.count <= 6, `${tag} allies.count must be 1..6`);
		assert(a.model === "Kestrel", `${tag} allies.model must be friendly Kestrel`);
		assert(a.callsignPrefix.size() > 0 && a.callsignPrefix.size() <= 24, `${tag} allies callsign must be 1..24 characters, original text only`);
		assert(a.formation.size() === a.count, `${tag} allies formation must match count`);
		for (const offset of a.formation) {
			for (const value of [offset.x, offset.y, offset.z]) assert(finite(value) && math.abs(value) <= 1500, `${tag} allies offsets must be finite within 1500 studs`);
			assert(offset.x * offset.x + offset.y * offset.y + offset.z * offset.z >= 6400, `${tag} allies need 80 studs clearance`);
		}
		for (const value of [a.mayKill, a.creditPlayerKills, a.allowRequiredTargets]) if (value !== undefined) assert(typeIs(value, "boolean"), `${tag} allies switches must be boolean`);
		assert(!a.allowRequiredTargets || a.creditPlayerKills === true, `${tag} required allied kills must explicitly credit objective progress`);
	}
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
		const basis = policy.scoring.basis;
		assert(basis === "points" || basis === "rating", `${tag} scoring.basis must be "points" or "rating"`);
		const rank = policy.scoring.rank;
		if (basis === "rating") assert(rank.S <= 100, `${tag} scoring.rank thresholds on the rating basis must be <= 100`);
		for (const [name, value] of pairs(rank)) assert(finite(value), `${tag} scoring.rank.${name} must be finite`);
		assert(rank.S > rank.A && rank.A > rank.B && rank.B > rank.C && rank.C >= 0,
			`${tag} scoring rank thresholds must satisfy S > A > B > C >= 0`);
	}
	if (policy.worldKey !== undefined) assert(policy.worldKey.size() > 0, `${tag} worldKey must not be empty`);
	if (policy.available !== undefined) assert(typeIs(policy.available, "boolean"), `${tag} available must be boolean`);
}
