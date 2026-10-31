// Pure targeting order: nose-first automatic acquisition and the closest-on-screen TGT press.
// Plain records only: no Roblox Instances or vectors, so the offline runner and Jest can check it.

/** A plain world point or unit axis (CombatService adapts Vector3). */
export interface Point { x: number; y: number; z: number }
/**
 * The player's camera as a view frustum: where it is, its three unit axes, the tangent of half the
 * vertical field of view and the viewport aspect (width / height). Built by Frustum() from the
 * client's TGT payload, or from the jet's nose when that payload is missing or implausible.
 */
export interface ViewFrustum { position: Point; look: Point; right: Point; up: Point; tanHalfFov: number; aspect: number }

/** One targetable contact as seen from the jet. */
export interface TargetCandidate {
	/** Caller's handle (the session enemy index); also the stable tie-break. */
	id: number;
	/** Studs from the jet. */
	distance: number;
	/** Nose alignment: 1 dead ahead, 0 abeam, -1 behind. */
	dot: number;
	/** Counts toward the objective (an ace that has broken off to call its wing does not, see CombatService). */
	required?: boolean;
	/** Inside the lock envelope range for its kind; undefined means unknown and is treated as in range. */
	inRange?: boolean;
	/** Terrain or flight-solid scenery between the jet and the contact (only the leading few are checked). */
	blocked?: boolean;
	/** The server will not let a shot land right now (a retreating ace). */
	held?: boolean;
	/** Inside the player's camera frustum and within jam visual range: the player sees its box right now (TGT press only). */
	onScreen?: boolean;
}

/** A required target wins over an optional one within about 18 degrees of the same bearing, never over a clearly nose-aligned optional. */
const REQUIRED_BONUS = 0.05;
/** Of two contacts at the same bearing the nearer wins; the bias never exceeds 0.01 dot. */
const DISTANCE_BIAS = 0.01;
const DISTANCE_SCALE = 1000;
/** Line of sight is checked for this many leading candidates, at most every LOS_INTERVAL seconds per contact. */
const LOS_CANDIDATES = 4;
const LOS_INTERVAL = 0.1;
/** TGT presses this close together walk on to the next-closest instead of snapping back to the closest. */
const CYCLE_CHAIN_SECONDS = 2.5;
/** A required contact beats an optional one that is up to this many studs nearer: a tie-break, never a priority. */
const REQUIRED_TIE_STUDS = 30;
/** The client's camera must sit within this many studs of the server's jet; anything else is replaced by the nose view. */
const MAX_CAMERA_OFFSET = 500;
/** Vertical field of view accepted from the client (Roblox allows 1 to 120); the default is the chase camera's cruise value. */
const FOV_MIN = 20, FOV_MAX = 120, DEFAULT_FOV = 75;
/** Viewport aspect accepted from the client; the default is a landscape phone or monitor. */
const ASPECT_MIN = 0.3, ASPECT_MAX = 4, DEFAULT_ASPECT = 16 / 9;
/** A contact closer than this along the look axis is not "on screen": it is at or behind the camera. */
const NEAR_STUDS = 1;

function finite(value: number): boolean { return value === value && value !== math.huge && value !== -math.huge; }
function finitePoint(point: Point): boolean { return finite(point.x) && finite(point.y) && finite(point.z); }
function distanceBetween(a: Point, b: Point): number {
	const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
	return math.sqrt(dx * dx + dy * dy + dz * dz);
}
/** A unit copy of a near-unit axis; undefined when it is not finite or not close to unit length. */
function unit(axis: Point): Point | undefined {
	if (!finitePoint(axis)) return undefined;
	const length = math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
	if (length < 0.9 || length > 1.1) return undefined;
	return { x: axis.x / length, y: axis.y / length, z: axis.z / length };
}
/** TGT press tiers. 0: on screen, clear and damageable. 1: on screen but blocked or held. 2: off screen (including behind). */
function pressTier(candidate: TargetCandidate): number {
	if (candidate.onScreen !== true) return 2;
	return candidate.blocked === true || candidate.held === true ? 1 : 0;
}
/** Distance for the press order: a required contact counts RequiredTieStuds nearer; a non-finite distance sorts last. */
function pressDistance(candidate: TargetCandidate): number {
	const distance = finite(candidate.distance) && candidate.distance >= 0 ? candidate.distance : math.huge;
	return distance === math.huge ? distance : distance - (candidate.required === true ? REQUIRED_TIE_STUDS : 0);
}

/** 0: ahead, in range, clear. 1: ahead and in range but blocked or held. 2: ahead but out of range. 3: behind the jet. */
function tier(candidate: TargetCandidate): number {
	const dot = finite(candidate.dot) ? candidate.dot : -1;
	if (dot < 0) return 3;
	if (candidate.inRange === false) return 2;
	return candidate.blocked === true || candidate.held === true ? 1 : 0;
}

/** Higher is better within a tier: nose alignment, a bounded required bonus, a bounded nearness bias. */
function score(candidate: TargetCandidate): number {
	const dot = finite(candidate.dot) ? math.clamp(candidate.dot, -1, 1) : -1;
	const distance = finite(candidate.distance) && candidate.distance >= 0 ? candidate.distance : math.huge;
	const bias = distance === math.huge ? DISTANCE_BIAS : DISTANCE_BIAS * distance / (distance + DISTANCE_SCALE);
	return dot + (candidate.required === true ? REQUIRED_BONUS : 0) - bias;
}

export const TargetPriority = {
	RequiredBonus: REQUIRED_BONUS,
	LosCandidates: LOS_CANDIDATES,
	LosInterval: LOS_INTERVAL,
	CycleChainSeconds: CYCLE_CHAIN_SECONDS,
	Tier: tier,
	Score: score,
	/** A new list, nose-best first. Tiers first, then score, then id, so the order is total and stable. */
	Order<T extends TargetCandidate>(candidates: readonly T[]): T[] {
		return [...candidates].sort((a, b) => {
			const ta = tier(a), tb = tier(b);
			if (ta !== tb) return ta < tb;
			const sa = score(a), sb = score(b);
			return sa !== sb ? sa > sb : a.id < b.id;
		});
	},
	/** The leading candidates that are worth a line-of-sight check: ahead and in range. */
	LosChecks<T extends TargetCandidate>(candidates: readonly T[], limit = LOS_CANDIDATES): T[] {
		const leading: T[] = [];
		for (const candidate of TargetPriority.Order(candidates)) {
			if (leading.size() >= limit || tier(candidate) > 1) break;
			leading.push(candidate);
		}
		return leading;
	},
	/** Automatic acquisition: the nose-best, or undefined with nothing to target. */
	Best(candidates: readonly TargetCandidate[]): number | undefined {
		return TargetPriority.Order(candidates)[0]?.id;
	},
	RequiredTieStuds: REQUIRED_TIE_STUDS,
	MaxCameraOffset: MAX_CAMERA_OFFSET,
	FovBounds: { min: FOV_MIN, max: FOV_MAX, default: DEFAULT_FOV },
	AspectBounds: { min: ASPECT_MIN, max: ASPECT_MAX, default: DEFAULT_ASPECT },
	/**
	 * A view frustum from the client's camera, or undefined when the position or axes are not finite
	 * unit-length vectors or the camera sits implausibly far from the jet (the caller then uses the nose
	 * view). FOV and aspect are clamped into their bounds; a missing or non-finite value takes the default.
	 */
	Frustum(position: Point, look: Point, right: Point, up: Point, fov: unknown, aspect: unknown, jet?: Point): ViewFrustum | undefined {
		if (!finitePoint(position)) return undefined;
		const lookAxis = unit(look), rightAxis = unit(right), upAxis = unit(up);
		if (lookAxis === undefined || rightAxis === undefined || upAxis === undefined) return undefined;
		if (jet !== undefined && (!finitePoint(jet) || distanceBetween(position, jet) > MAX_CAMERA_OFFSET)) return undefined;
		const fovDegrees = typeIs(fov, "number") && finite(fov) ? math.clamp(fov, FOV_MIN, FOV_MAX) : DEFAULT_FOV;
		const ratio = typeIs(aspect, "number") && finite(aspect) ? math.clamp(aspect, ASPECT_MIN, ASPECT_MAX) : DEFAULT_ASPECT;
		return { position: { ...position }, look: lookAxis, right: rightAxis, up: upAxis, tanHalfFov: math.tan(math.rad(fovDegrees) / 2), aspect: ratio };
	},
	/** Is `target` inside the frustum: ahead of the camera and within the vertical and horizontal half-angles. */
	InView(view: ViewFrustum, target: Point): boolean {
		if (!finitePoint(target)) return false;
		const dx = target.x - view.position.x, dy = target.y - view.position.y, dz = target.z - view.position.z;
		const depth = dx * view.look.x + dy * view.look.y + dz * view.look.z;
		if (depth < NEAR_STUDS) return false;
		const vertical = dx * view.up.x + dy * view.up.y + dz * view.up.z;
		const horizontal = dx * view.right.x + dy * view.right.y + dz * view.right.z;
		const halfHeight = depth * view.tanHalfFov;
		return math.abs(vertical) <= halfHeight && math.abs(horizontal) <= halfHeight * view.aspect;
	},
	PressTier: pressTier,
	/** A new list in TGT press order: on screen and clear first, on screen but blocked or held next, off screen last; nearest first within a tier. */
	PressOrder<T extends TargetCandidate>(candidates: readonly T[]): T[] {
		return [...candidates].sort((a, b) => {
			const ta = pressTier(a), tb = pressTier(b);
			if (ta !== tb) return ta < tb;
			const da = pressDistance(a), db = pressDistance(b);
			return da !== db ? da < db : a.id < b.id;
		});
	},
	/** The nearest on-screen, damageable contacts, the only ones a TGT press spends line-of-sight raycasts on. */
	PressLosChecks<T extends TargetCandidate>(candidates: readonly T[], limit = LOS_CANDIDATES): T[] {
		const leading: T[] = [];
		for (const candidate of TargetPriority.PressOrder(candidates)) {
			if (leading.size() >= limit || pressTier(candidate) > 0) break;
			leading.push(candidate);
		}
		return leading;
	},
	/**
	 * A TGT press. The closest on-screen contact, unless that is already the current target: then the
	 * second closest. `chained` (a press within CycleChainSeconds of the last, target unchanged since)
	 * walks on to the contact after the current one in PressOrder and wraps, so every contact stays
	 * reachable. With nothing on screen the order falls through to the closest contact overall.
	 */
	Press(candidates: readonly TargetCandidate[], current?: number, chained = false): number | undefined {
		const ordered = TargetPriority.PressOrder(candidates);
		const count = ordered.size();
		if (count === 0) return undefined;
		const index = ordered.findIndex((candidate) => candidate.id === current);
		if (index < 0) return ordered[0].id;
		if (!chained) return ordered[index === 0 ? 1 % count : 0].id;
		return ordered[(index + 1) % count].id;
	},
};
