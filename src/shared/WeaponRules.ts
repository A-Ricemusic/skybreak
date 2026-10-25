// Pure weapon rules shared by the server (authoritative) and the HUD (presentation).
// Nothing here touches instances; CombatService adapts Vector3 to plain points.
export type CombatActionKind = "FireMissile" | "Evade" | "CycleTarget";
export type FireDenied = "no_ammo" | "cooldown";
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
const ACTION_KINDS: CombatActionKind[] = ["FireMissile", "Evade", "CycleTarget"];
/** Minimum spacing between accepted events of the same action kind. */
const ACTION_WINDOW = 0.09;
const LOCK_RANGE = 2450;
const LOCK_DOT = math.cos(math.rad(62));
const LOCKED_AT = 0.99;
/** Unguided missile: detonates when its sweep passes within this many studs of a damageable enemy. */
const FUSE_RADIUS = 36;
export const WeaponRules = {
	ActionWindow: ACTION_WINDOW,
	LockRange: LOCK_RANGE,
	LockDot: LOCK_DOT,
	LockedAt: LOCKED_AT,
	FuseRadius: FUSE_RADIUS,
	UnguidedLifetime: 5,
	GuidedLifetime: 8,
	MissileSpeed: 750,
	IsActionKind(value: unknown): value is CombatActionKind {
		return ACTION_KINDS.includes(value as CombatActionKind);
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
		const locked = input.hasTarget && finite(input.lockProgress) && input.lockProgress >= LOCKED_AT;
		const inEnvelope = finite(input.distance) && finite(input.dot) && input.distance <= LOCK_RANGE && input.dot >= LOCK_DOT;
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
		if (!finite(missiles) || missiles <= 0) return { text: "EMPTY", filled: false, enabled: false, dimmed: false };
		if (finite(missileCooldown) && missileCooldown > 0) return { text: string.format("%.1f", missileCooldown), filled: false, enabled: false, dimmed: false };
		const lock = hasTarget && finite(lockProgress) ? math.clamp(lockProgress, 0, 1) : 0;
		if (lock >= LOCKED_AT) return { text: "FIRE", filled: true, enabled: true, dimmed: false };
		if (lock > 0.01) return { text: string.format("LOCK %d%%", math.floor(lock * 100)), filled: false, enabled: true, dimmed: true };
		return { text: "FIRE", filled: false, enabled: true, dimmed: false };
	},
};
