// Pure weapon rules shared by the server (authoritative) and the HUD (presentation).
// Nothing here touches instances; CombatService adapts Vector3 to plain points.
/** Pause and Resume freeze the sortie on the server (single-player): no stepping, and the clock is shifted. */
/** GunStart/GunStop hold and release the opt-in player gun (SortieArmament); a sortie without a gun ignores them. */
export type CombatActionKind = "FireMissile" | "Evade" | "CycleTarget" | "SelectTarget" | "Special" | "Pause" | "Resume" | "SkipLanding" | "RearmTakeoff" | "GunStart" | "GunStop";
export type FireDenied = "no_ammo" | "cooldown";
/** Why a SPECIAL press did nothing (see SpecialWeapons.Activate). */
export type SpecialDenied = "special_empty" | "special_cooldown" | "special_active" | "special_no_target" | "anti_ship_hull_only";
/** Opt-in armament refusals: a finite missile stock is spent, or the gun magazine is empty. */
export type ArmamentDenied = "missiles_spent" | "gun_empty";
/** What the weapons channel reports after a FIRE, GUN or SPECIAL press: a refusal or a blind launch. */
export type FireNotice = FireDenied | "blind" | SpecialDenied | ArmamentDenied;
/** Keyed by every FireNotice, so a new reason that is not listed here fails to compile. */
const FIRE_NOTICES: Record<FireNotice, true> = {
	no_ammo: true, cooldown: true, blind: true,
	special_empty: true, special_cooldown: true, special_active: true, special_no_target: true, anti_ship_hull_only: true,
	missiles_spent: true, gun_empty: true,
};
export interface Point { x: number; y: number; z: number }
export interface ActionGateState { last: Map<CombatActionKind, number> }
export type LaunchDecision = { kind: "denied"; reason: FireDenied } | { kind: "guided" } | { kind: "blind" };
export interface LaunchInput {
	missiles: number;
	missileCooldown: number;
	hasTarget: boolean;
	lockProgress: number;
	/** Distance and nose dot to the current target; ignored without a target. */
	distance: number;
	dot: number;
	/** Ground targets lock through a wider cone: you orbit them, you do not chase them. */
	groundTarget?: boolean;
	/** False when the current phase protects the target; a guided shot would burst for nothing. */
	canDamage?: boolean;
	/** Ground-scale envelope range; defaults to LockRange (a recon drone extends it). Air targets use AirRangeFactor of it. */
	lockRange?: number;
}
export interface FireButtonState {
	text: string;
	/** Solid accent: a guided shot is available right now. */
	filled: boolean;
	/** Tapping sends a shot (guided or blind). */
	enabled: boolean;
	/** Lock still building: the label is shown dimmed. */
	dimmed: boolean;
}
function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}
/** Shortest distance from `point` to the segment `from` -> `to`. */
function segmentDistance(point: Point, from: Point, to: Point): number {
	const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
	const lengthSquared = dx * dx + dy * dy + dz * dz;
	const t = lengthSquared > 0 ? math.clamp(((point.x - from.x) * dx + (point.y - from.y) * dy + (point.z - from.z) * dz) / lengthSquared, 0, 1) : 0;
	const cx = from.x + dx * t - point.x, cy = from.y + dy * t - point.y, cz = from.z + dz * t - point.z;
	return math.sqrt(cx * cx + cy * cy + cz * cz);
}
const ACTION_KINDS: CombatActionKind[] = ["FireMissile", "Evade", "CycleTarget", "SelectTarget", "Special", "Pause", "Resume", "SkipLanding", "RearmTakeoff", "GunStart", "GunStop"];
/** Minimum spacing between accepted events of the same action kind. */
const ACTION_WINDOW = 0.09;
/** Ground envelope: 80 degree half-cone out to 2450 studs (you orbit a target, you do not chase it). */
const LOCK_RANGE = 2450;
const GROUND_LOCK_DOT = math.cos(math.rad(80));
/** Air envelope: 40 degree half-cone out to 1800 studs, so a bandit has to be pointed at and approached. */
const AIR_LOCK_RANGE = 1800;
const LOCK_DOT = math.cos(math.rad(40));
/** Specials that extend the envelope (drone, lance) scale the air range by the same ratio. */
const AIR_RANGE_FACTOR = AIR_LOCK_RANGE / LOCK_RANGE;
/** Lock builds in 0.45 s and decays more slowly so a brief slip off the target is forgiven. */
const LOCK_BUILD_SECONDS = 0.45;
const LOCK_DECAY_PER_SECOND = 0.8;
const LOCKED_AT = 0.99;
/** Unguided missile: detonates when its sweep passes within this many studs of a damageable enemy. */
const FUSE_RADIUS = 36;
/** Missile rack size: a sortie starts full and regenerates up to it. */
const MAX_MISSILES = 8;

export const WeaponRules = {
	MaxMissiles: MAX_MISSILES,
	ActionWindow: ACTION_WINDOW,
	LockRange: LOCK_RANGE,
	AirLockRange: AIR_LOCK_RANGE,
	AirRangeFactor: AIR_RANGE_FACTOR,
	LockDot: LOCK_DOT,
	GroundLockDot: GROUND_LOCK_DOT,
	LockBuildSeconds: LOCK_BUILD_SECONDS,
	LockDecayPerSecond: LOCK_DECAY_PER_SECOND,
	LockDotFor(groundTarget: boolean): number { return groundTarget ? GROUND_LOCK_DOT : LOCK_DOT; },
	/** The envelope range for a target kind, from a ground-scale `range` (LockRange, or a special's extension). */
	EnvelopeRange(range: number, groundTarget: boolean): number { return groundTarget ? range : range * AIR_RANGE_FACTOR; },
	LockedAt: LOCKED_AT,
	FuseRadius: FUSE_RADIUS,
	UnguidedLifetime: 5,
	GuidedLifetime: 8,
	MissileSpeed: 750,
	MissileFireInterval: 1.15,
	MissileLeadMax: 0.65,
	MissileTurnRate(distance: number): number { return distance < 300 ? 14 : 7; },
	IsActionKind(value: unknown): value is CombatActionKind {
		return ACTION_KINDS.includes(value as CombatActionKind);
	},
	IsFireNotice(value: unknown): value is FireNotice {
		return typeIs(value, "string") && FIRE_NOTICES[value as FireNotice] === true;
	},
	NewActionGate(): ActionGateState { return { last: new Map<CombatActionKind, number>() }; },
	/**
	 * Per-kind rate limit. A duplicate of the same kind inside the window is dropped without
	 * extending the window, so a FIRE that lands right after a TGT tap (or a second copy of the
	 * same tap) never costs the next legitimate event.
	 */
	AcceptAction(gate: ActionGateState, kind: CombatActionKind, now: number): boolean {
		if (!finite(now)) return false;
		const last = gate.last.get(kind);
		if (last !== undefined && now - last < ACTION_WINDOW) return false;
		gate.last.set(kind, now);
		return true;
	},
	/** Why a player FIRE is refused, or whether it is guided (full lock in the envelope) or blind. */
	Launch(input: LaunchInput): LaunchDecision {
		if (!finite(input.missiles) || input.missiles <= 0) return { kind: "denied", reason: "no_ammo" };
		if (finite(input.missileCooldown) && input.missileCooldown > 0) return { kind: "denied", reason: "cooldown" };
		const locked = input.hasTarget && input.canDamage !== false && finite(input.lockProgress) && input.lockProgress >= LOCKED_AT;
		const base = finite(input.lockRange) && input.lockRange > 0 ? input.lockRange : LOCK_RANGE;
		const range = WeaponRules.EnvelopeRange(base, input.groundTarget === true);
		const inEnvelope = finite(input.distance) && finite(input.dot) && input.distance <= range && input.dot >= WeaponRules.LockDotFor(input.groundTarget === true);
		return locked && inEnvelope ? { kind: "guided" } : { kind: "blind" };
	},
	SegmentDistance: segmentDistance,
	/**
	 * Proximity fuse for an unguided missile sweeping `from` -> `to`: the index of the closest
	 * candidate the sweep passes within `radius` of (only candidates `allowed` returns true for),
	 * or undefined when it detonates on nothing this step.
	 */
	Fuse<T>(from: Point, to: Point, candidates: readonly T[], positionOf: (candidate: T) => Point, allowed: (candidate: T) => boolean, radius: number = FUSE_RADIUS): number | undefined {
		let bestIndex: number | undefined;
		let best = radius;
		for (let index = 0; index < candidates.size(); index++) {
			const candidate = candidates[index];
			if (!allowed(candidate)) continue;
			const distance = segmentDistance(positionOf(candidate), from, to);
			if (distance < best || (bestIndex === undefined && distance <= best)) { best = distance; bestIndex = index; }
		}
		return bestIndex;
	},
	/** FIRE button label and state from HUD telemetry. */
	FireButton(missiles: number, missileCooldown: number, hasTarget: boolean, lockProgress: number): FireButtonState {
		// Always enabled: the server answers every press, so a refusal is explained instead of swallowed.
		if (!finite(missiles) || missiles <= 0) return { text: "EMPTY", filled: false, enabled: true, dimmed: true };
		if (finite(missileCooldown) && missileCooldown > 0) return { text: string.format("%.1f", missileCooldown), filled: false, enabled: true, dimmed: true };
		const lock = hasTarget && finite(lockProgress) ? math.clamp(lockProgress, 0, 1) : 0;
		if (lock >= LOCKED_AT) return { text: "FIRE", filled: true, enabled: true, dimmed: false };
		if (lock > 0.01) return { text: string.format("LOCK %d%%", math.floor(lock * 100)), filled: false, enabled: true, dimmed: true };
		return { text: "FIRE", filled: false, enabled: true, dimmed: false };
	},
};
