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
export const ThreatRules = {
	InboundRange: INBOUND_RANGE,
	StraightStick: STRAIGHT_STICK,
	/** Whether the player is holding the aircraft steady (no meaningful stick input). */
	PlayerStraight(inputX: number, inputY: number): boolean {
		return math.abs(inputX) < STRAIGHT_STICK && math.abs(inputY) < STRAIGHT_STICK;
	},
	/** May this enemy start a missile windup right now? */
	MayFire(gate: FireGate): boolean {
		if (gate.evading || !gate.globalReady || gate.fireTimer > 0) return false;
		if (gate.separation <= gate.minRange || gate.separation >= gate.maxRange) return false;
		const required = gate.playerStraight ? gate.aimThreshold - gate.straightRelax : gate.aimThreshold;
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
