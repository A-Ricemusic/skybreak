import { CombatBalance } from "./CombatBalance";

// Pure enemy-threat rules shared by the server (authoritative) and tests.
// Nothing here touches instances; CombatService adapts Vector3 to plain points.
// Every act-dependent number is passed in from CombatService.TUNING so a later
// difficulty selector only has to scale those arrays.
export interface Point { x: number; y: number; z: number }
export interface FireGate {
	separation: number;
	aimDot: number;
	fireTimer: number;
	globalReady: boolean;
	evading: boolean;
	playerStraight: boolean;
	minRange: number;
	maxRange: number;
	aimThreshold: number;
	straightRelax: number;
}
export interface BreakInput {
	/** A player missile guided onto this enemy is within `InboundRange`. */
	inbound: boolean;
	/** Seconds until this enemy may break again (<= 0 means ready). */
	cooldownRemaining: number;
	/** Already in a timed break-away; never restart one mid-maneuver. */
	extending: boolean;
	/** Uniform roll in [0, 1) and the act's break chance. */
	roll: number;
	chance: number;
}
export interface LockBreakInput {
	/** The player's lock progress on this bandit (0-1) and the range between them. */
	lockProgress: number;
	distance: number;
	cooldownRemaining: number;
	extending: boolean;
	roll: number;
	chance: number;
}
export interface FlightGateInput {
	/** Seconds since the flight's last windup started, and the gate it must clear. */
	sinceLastWindup: number;
	gate: number;
	/** Hostile threats already live (windups lit plus hostile missiles in flight) and the cap. */
	threats: number;
	cap: number;
}
export interface TrackInput {
	/** The target is mid defensive break. */
	breaking: boolean;
	distance: number;
	previousDistance: number;
	fuseRadius: number;
}
function normalize(point: Point, fallback: Point): Point {
	const length = math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
	return length > 0.01 ? { x: point.x / length, y: point.y / length, z: point.z / length } : fallback;
}
/** Stick deflection below this on both axes counts as flying straight. */
const STRAIGHT_STICK = 0.25;
/** A player missile guided onto an enemy inside this range may trigger a defensive break. */
const INBOUND_RANGE = 700;
/** Below this health fraction an ace notches on a shorter cadence. */
const ACE_DESPERATE_FRACTION = 1 / 3;
const ACE_DESPERATE_SCALE = 0.6;
/** No two flight windups start closer together than this, whatever the hostile count. */
const GLOBAL_SPACING = 1.5;
/** A bandit breaks out of a lock building past this inside LOCK_BREAK_RANGE studs, once per BREAK_COOLDOWN seconds. */
const LOCK_BREAK_PROGRESS = 0.8;
const LOCK_BREAK_RANGE = 900;
const BREAK_COOLDOWN = 12;
/** A flare (bandit or ace) decoys every player missile within this radius for FLARE_SECONDS. */
const FLARE_RADIUS = 260;
const FLARE_SECONDS = 2.5;
/** An extending bandit drops to the player's speed minus this, so a hard turn earns a rear shot. */
const EXTEND_SPEED_DEFICIT = 10;
export const ThreatRules = {
	InboundRange: INBOUND_RANGE,
	GlobalSpacing: GLOBAL_SPACING,
	LockBreakProgress: LOCK_BREAK_PROGRESS,
	LockBreakRange: LOCK_BREAK_RANGE,
	BreakCooldown: BREAK_COOLDOWN,
	FlareRadius: FLARE_RADIUS,
	FlareSeconds: FLARE_SECONDS,
	ExtendSpeedDeficit: EXTEND_SPEED_DEFICIT,
	/**
	 * How much faster a flight fires than a single bandit: +50% per extra live hostile, capped
	 * at `maxDivisor`. One bandit shoots on the base gate; five shoot on base / 3 (if the cap allows).
	 */
	FlightDivisor(live: number, maxDivisor: number): number {
		return math.clamp(1 + 0.5 * (math.max(1, math.floor(live)) - 1), 1, math.max(1, maxDivisor));
	},
	/**
	 * Seconds between windup starts across the flight: the per-act base divided by the live-hostile
	 * divisor (halved again while a radar directs the flight), never below the global 1.5 s spacing.
	 */
	FlightGate(base: number, live: number, maxDivisor: number, directed = false): number {
		const gate = base / ThreatRules.FlightDivisor(live, maxDivisor) * (directed ? 0.5 : 1);
		return math.max(GLOBAL_SPACING, gate);
	},
	/** Concurrent hostile threats (windups plus missiles in flight) allowed: one per two live hostiles, 1 to `maxCap`. */
	ThreatCap(live: number, maxCap: number): number {
		return math.clamp(math.ceil(math.max(1, live) / 2), 1, math.max(1, maxCap));
	},
	/** Whether the flight may light a new windup now. Aces never consult this: they keep their own gate. */
	FlightReady(input: FlightGateInput): boolean {
		return input.threats < input.cap && input.sinceLastWindup >= math.max(GLOBAL_SPACING, input.gate);
	},
	/**
	 * A bandit with a lock building on it inside 900 studs breaks hard, once per 12 s (the act's
	 * chance, scaled by difficulty, decides whether this bandit is a breaker at all).
	 */
	ShouldLockBreak(input: LockBreakInput): boolean {
		if (input.extending || input.cooldownRemaining > 0) return false;
		if (input.lockProgress <= LOCK_BREAK_PROGRESS || input.distance >= LOCK_BREAK_RANGE) return false;
		return input.roll < input.chance;
	},
	/** A break offers a rear shot; it must never accelerate a bandit past its ordinary pursuit cap. */
	ExtendSpeed(playerSpeed: number, floor: number): number {
		return math.min(CombatBalance.banditSpeedCap, math.max(floor, playerSpeed - EXTEND_SPEED_DEFICIT));
	},
	/** Should an enemy with `flares` left and `cooldown` to go pop one against a missile `distance` studs away? */
	ShouldFlare(distance: number, flares: number, cooldown: number): boolean {
		return flares > 0 && cooldown <= 0 && distance < FLARE_RADIUS;
	},
	/** Is a player missile `distance` studs from an enemy whose flare burns until `flareUntil` decoyed at `now`? */
	FlareDecoys(distance: number, flareUntil: number, now: number): boolean {
		return now < flareUntil && distance < FLARE_RADIUS;
	},
	StraightStick: STRAIGHT_STICK,
	/** Whether the player is holding the aircraft steady (no meaningful stick input). */
	PlayerStraight(inputX: number, inputY: number): boolean {
		return math.abs(inputX) < STRAIGHT_STICK && math.abs(inputY) < STRAIGHT_STICK;
	},
	/** Only protected-aircraft attackers ignore player evasion and always receive aim relaxation. */
	MayFire(gate: FireGate, targetingProtectedAircraft = false): boolean {
		if ((!targetingProtectedAircraft && gate.evading) || !gate.globalReady || gate.fireTimer > 0) return false;
		if (gate.separation <= gate.minRange || gate.separation >= gate.maxRange) return false;
		const required = (targetingProtectedAircraft || gate.playerStraight) ? gate.aimThreshold - gate.straightRelax : gate.aimThreshold;
		return gate.aimDot > required;
	},
	/** Is any player missile guided onto `enemy` within InboundRange? */
	Inbound<E, P>(enemy: E, projectiles: P[], targetOf: (projectile: P) => E | undefined, distanceTo: (projectile: P) => number): boolean {
		for (const projectile of projectiles) {
			if (targetOf(projectile) === enemy && distanceTo(projectile) <= INBOUND_RANGE) return true;
		}
		return false;
	},
	/** Roll a defensive break against an inbound missile. */
	ShouldBreak(input: BreakInput): boolean {
		if (!input.inbound || input.extending || input.cooldownRemaining > 0) return false;
		return input.roll < input.chance;
	},
	/** Hard break: full lateral pull to the bracket side, a little forward carry, and a dive. */
	BreakDirection(direction: Point, lateral: Point, side: number): Point {
		return normalize({ x: lateral.x * side + direction.x * 0.25, y: -0.5, z: lateral.z * side + direction.z * 0.25 }, direction);
	},
	/**
	 * A guided missile that was already close (inside InboundRange) to a breaking target and has started
	 * opening range again has overshot the notch: it loses track and flies on as an unguided shot.
	 */
	LosesTrack(input: TrackInput): boolean {
		return input.breaking && input.previousDistance <= INBOUND_RANGE && input.distance > input.previousDistance && input.distance > input.fuseRadius * 2;
	},
	/** Seconds between ace lock-breaks: the act's base cadence, shortened once the ace is below a third. */
	AceLockBreakInterval(base: number, healthFraction: number): number {
		return healthFraction <= ACE_DESPERATE_FRACTION ? base * ACE_DESPERATE_SCALE : base;
	},
	/** Ace health after the act multiplier, never below the catalog value. */
	ScaledHealth(base: number, scale: number): number {
		return math.round(base * math.max(scale, 1));
	},
	/** Direction of missile `index` of a `count`-missile salvo: the first flies true, later ones fan out to the right/left. */
	SalvoDirection(direction: Point, right: Point, index: number, count: number): Point {
		if (count <= 1 || index === 0) return direction;
		const sign = index % 2 === 1 ? 1 : -1;
		const spread = 0.12 * math.ceil(index / 2) * sign;
		return normalize({ x: direction.x + right.x * spread, y: direction.y, z: direction.z + right.z * spread }, direction);
	},
};
