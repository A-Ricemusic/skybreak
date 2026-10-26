import { Difficulty, DifficultyKind } from "./Difficulty";

// Pure hostile-missile flight and seeker rules. The server (CombatService) owns every missile and
// only adapts Vector3 to the plain points here, so the same code runs in Roblox, Jest and the
// offline Luau VM.
//
// The model, in the order a missile lives it:
//   0. Launch: the shooter fires on a collision course (LeadDirection) for the jet's current
//      velocity, so a jet that keeps flying straight needs almost no correction and is hit.
//   1. Burn: `burnSeconds` at `burnSpeed`. Guidance is proportional navigation (heading rate =
//      navGain x line-of-sight rate, plus a small pursuit term) under a HARD turn-rate cap in rad/s.
//      speed x turnCap is the missile's sideways acceleration; it is kept at or below the jet's
//      (320 studs/s x 1.12 rad/s = ~358 at full throttle, ~260 at cruise), so a hard break turn
//      started in time pulls the jet off the missile's path faster than the missile can follow.
//   2. Coast: after the burn, speed decays by exp(-COAST_DRAG x t). A coasting missile slower than
//      the jet it chases has lost the chase (seeker off); below MIN_SPEED it self-destructs. A
//      long tail shot can be outrun at full throttle.
//   3. Seeker cone: once the jet is more than `gimbal` off the missile's nose the lock is lost for
//      good; the missile flies straight on and self-destructs when `life` runs out. Out-turning a
//      missile late in its flight is how a break turn actually wins.
//   4. Terrain: a step segment that meets terrain or scenery (the injected ray; AircraftCollision's
//      query set on the server) detonates the missile there, harmlessly. Ridges protect.
//   5. Proximity fuse: `fuse` studs from the jet, measured on the path relative to the jet through
//      the step (no tunnelling at 600+ studs/s), and only if that point comes before any terrain hit.
//
// Tuning (studs, seconds, rad/s). Rows are Normal by act; Easy/Ace multiply through the Difficulty
// knobs (missileTurn, missileBurn, missileGimbal); a missile fired by the mission's ace adds the
// last column on top.
//
//   value          Act I   Act II  Act III   Easy     Ace      ace pilot
//   burnSpeed      560     600     620       x1       x1       -
//   burnSeconds    2.6     3.0     3.4       x0.6     x1.15    -
//   turnCap        0.32    0.36    0.40      x0.75    x1.25    +0.04
//   gimbal (deg)   45      45      45        x1.1     x1.2     +5
//   fuse           18      22      26        -        -        -
//   life           7       8       9         -        -        -
//   coast drag     0.35/s; MIN_SPEED 160; navGain 3
//   BREAK cue      seconds-to-impact window: Easy 0.7-2.4, Normal 0.9-1.8, Ace 1.1-1.7
//
// Why the Ace window is narrower: a harder turn cap and a wider seeker cone mean the missile
// follows an early break and still connects on a late one, so only a break in the window works.

export interface Point { x: number; y: number; z: number }

export interface MissileProfile {
	burnSpeed: number;
	burnSeconds: number;
	/** Hard cap on the heading change, rad/s. */
	turnCap: number;
	/** Proportional-navigation gain: heading rate = navGain x line-of-sight rate (before the cap). */
	navGain: number;
	/** Seeker half-angle, radians: the jet further than this off the nose breaks the lock. */
	gimbal: number;
	fuse: number;
	life: number;
	/** BREAK cue: time-to-impact range (seconds) in which a hard break turn makes the missile overshoot. */
	breakEarly: number; breakLate: number;
}

export interface GuidedMissile {
	position: Point;
	/** Unit heading. */
	direction: Point;
	speed: number;
	age: number;
	/** Seeker tracking the jet. Once false it never comes back (flies straight, then self-destructs). */
	locked: boolean;
}

export interface MissileTarget { position: Point; velocity: Point }

/** Returns where the segment from `from` to `to` meets terrain or scenery, or undefined when clear. */
export type MissileRay = (from: Point, to: Point) => Point | undefined;

export type MissileEvent = "flying" | "hit" | "terrain" | "expired";
export interface MissileStep { event: MissileEvent; at?: Point }

const NAV_GAIN = 3;
/** Small pure-pursuit bias (1/s) so a missile launched off the line of sight still swings onto it. */
const PURSUIT = 0.5;
const COAST_DRAG = 0.35;
/** A coasting missile this slow falls out of the fight whatever it is chasing. */
const MIN_SPEED = 160;

const BURN_SPEED = [560, 600, 620];
const BURN_SECONDS = [2.6, 3.0, 3.4];
const TURN_CAP = [0.32, 0.36, 0.4];
const GIMBAL_DEGREES = 45;
const FUSE = [18, 22, 26];
const LIFE = [7, 8, 9];
const ACE_TURN_BONUS = 0.04;
const ACE_GIMBAL_BONUS = 5;
/** BREAK cue window [latest, earliest] in seconds to impact by level; Ace's is narrower. */
const BREAK_WINDOW: { [D in DifficultyKind]: [number, number] } = { easy: [0.7, 2.4], normal: [0.9, 1.8], ace: [1.1, 1.7] };

function finite(value: number): boolean { return value === value && math.abs(value) !== math.huge; }
function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function mul(a: Point, s: number): Point { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Point, b: Point): Point { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function length(a: Point): number { return math.sqrt(dot(a, a)); }
function unit(a: Point, fallback: Point): Point { const size = length(a); return size > 1e-6 ? mul(a, 1 / size) : fallback; }
function act(value: number): number { return math.clamp(math.floor(finite(value) ? value : 1), 1, 3); }

/** Distance from the origin to the segment a-b, and where along it (0-1) the closest point is. */
function closest(a: Point, b: Point): [number, number] {
	const segment = sub(b, a);
	const span = dot(segment, segment);
	const t = span > 1e-9 ? math.clamp(-dot(a, segment) / span, 0, 1) : 0;
	return [length(add(a, mul(segment, t))), t];
}

export const MissileRules = {
	NavGain: NAV_GAIN,
	CoastDrag: COAST_DRAG,
	MinSpeed: MIN_SPEED,
	/** The act's missile for this level; `acePilot` for a missile launched by the mission's ace. */
	Profile(difficulty: DifficultyKind, actIndex: number, acePilot = false): MissileProfile {
		const index = act(actIndex) - 1;
		const level = Difficulty.Coerce(difficulty);
		const [late, early] = BREAK_WINDOW[level];
		return {
			burnSpeed: BURN_SPEED[index],
			burnSeconds: Difficulty.Scale(level, "missileBurn", BURN_SECONDS[index]),
			navGain: NAV_GAIN,
			turnCap: Difficulty.Scale(level, "missileTurn", TURN_CAP[index]) + (acePilot ? ACE_TURN_BONUS : 0),
			gimbal: math.rad(Difficulty.Scale(level, "missileGimbal", GIMBAL_DEGREES) + (acePilot ? ACE_GIMBAL_BONUS : 0)),
			fuse: FUSE[index],
			life: LIFE[index],
			breakEarly: early, breakLate: late,
		};
	},
	/**
	 * The launcher's collision-course heading from `from` at `speed` onto a jet flying straight,
	 * held inside `maxLead` radians of the direct line. Falls back to the direct line when no
	 * intercept exists. A straight-flying jet then needs almost no turn from the missile.
	 */
	LeadDirection(from: Point, speed: number, target: MissileTarget, maxLead: number): Point {
		const line = sub(target.position, from);
		const direct = unit(line, { x: 0, y: 0, z: -1 });
		// |line + v t| = speed t  ->  (v.v - s^2) t^2 + 2 (line.v) t + line.line = 0
		const a = dot(target.velocity, target.velocity) - speed * speed;
		const b = 2 * dot(line, target.velocity);
		const c = dot(line, line);
		let time = -1;
		if (math.abs(a) < 1e-6) time = b < 0 ? -c / b : -1;
		else {
			const disc = b * b - 4 * a * c;
			if (disc >= 0) {
				const root = math.sqrt(disc);
				const t1 = (-b - root) / (2 * a), t2 = (-b + root) / (2 * a);
				time = t1 > 0 && t2 > 0 ? math.min(t1, t2) : math.max(t1, t2);
			}
		}
		if (!(time > 0) || !finite(time)) return direct;
		const lead = unit(add(line, mul(target.velocity, time)), direct);
		const angle = math.acos(math.clamp(dot(lead, direct), -1, 1));
		if (angle <= maxLead || angle < 1e-6) return lead;
		// Rotate from the direct line toward the lead by maxLead.
		const across = unit(sub(lead, mul(direct, dot(lead, direct))), direct);
		return add(mul(direct, math.cos(maxLead)), mul(across, math.sin(maxLead)));
	},
	Launch(position: Point, direction: Point, profile: MissileProfile): GuidedMissile {
		return { position, direction: unit(direction, { x: 0, y: 0, z: -1 }), speed: profile.burnSpeed, age: 0, locked: true };
	},
	/** Speed at `age`: full burn, then exponential drag. */
	SpeedAt(profile: MissileProfile, age: number): number {
		const coast = math.max(0, age - profile.burnSeconds);
		return profile.burnSpeed * math.exp(-COAST_DRAG * coast);
	},
	/** Angle (radians) between the missile's nose and the line to `position`. */
	OffBoresight(missile: GuidedMissile, position: Point): number {
		const line = unit(sub(position, missile.position), missile.direction);
		return math.acos(math.clamp(dot(line, missile.direction), -1, 1));
	},
	/**
	 * Advances one missile by `dt` against the jet (already stepped to the end of this tick).
	 * `ray` is the terrain query; omit it for open sky.
	 */
	Step(missile: GuidedMissile, profile: MissileProfile, target: MissileTarget, dt: number, ray?: MissileRay): MissileStep {
		if (!finite(dt) || dt <= 0) return { event: "flying" };
		missile.age += dt;
		if (missile.age > profile.life) return { event: "expired", at: missile.position };
		missile.speed = MissileRules.SpeedAt(profile, missile.age);
		const coasting = missile.age > profile.burnSeconds;
		if (coasting && missile.speed < MIN_SPEED) return { event: "expired", at: missile.position };
		if (missile.locked) {
			if (MissileRules.OffBoresight(missile, target.position) > profile.gimbal) missile.locked = false;
			else if (coasting && missile.speed < length(target.velocity)) missile.locked = false;
		}
		if (missile.locked) {
			const line = sub(target.position, missile.position);
			const range = length(line);
			if (range > 1e-3) {
				const sight = mul(line, 1 / range);
				const relative = sub(target.velocity, mul(missile.direction, missile.speed));
				// Proportional navigation: the heading turns NAV_GAIN times as fast as the line of sight.
				const sightRate = mul(cross(line, relative), 1 / (range * range));
				let turn = cross(mul(sightRate, profile.navGain), missile.direction);
				turn = add(turn, mul(sub(sight, mul(missile.direction, dot(sight, missile.direction))), PURSUIT));
				const rate = length(turn);
				if (rate > profile.turnCap) turn = mul(turn, profile.turnCap / rate);
				missile.direction = unit(add(missile.direction, mul(turn, dt)), missile.direction);
			}
		}
		const from = missile.position;
		const to = add(from, mul(missile.direction, missile.speed * dt));
		// Fuse on the path relative to the jet: where the jet was at the start of the step to where it is now.
		const jetFrom = sub(target.position, mul(target.velocity, dt));
		const [miss, along] = closest(sub(from, jetFrom), sub(to, target.position));
		const blocked = ray ? ray(from, to) : undefined;
		const travel = length(sub(to, from));
		const blockedAlong = blocked && travel > 1e-6 ? length(sub(blocked, from)) / travel : 2;
		if (miss <= profile.fuse && along <= blockedAlong) { missile.position = add(from, mul(sub(to, from), along)); return { event: "hit", at: missile.position }; }
		if (blocked) { missile.position = blocked; return { event: "terrain", at: blocked }; }
		missile.position = to;
		return { event: "flying" };
	},
	/** Seconds until the missile reaches the jet at the current closing speed, or undefined when it is not closing. */
	TimeToImpact(missile: GuidedMissile, target: MissileTarget): number | undefined {
		const line = sub(target.position, missile.position);
		const range = length(line);
		if (range < 1e-3) return 0;
		const closing = -dot(sub(target.velocity, mul(missile.direction, missile.speed)), line) / range;
		return closing > 1 ? range / closing : undefined;
	},
	/**
	 * Where the missile is relative to the jet's nose, in degrees: 0 dead ahead, +90 right wing,
	 * -90 left wing, +/-180 on the tail. Uses heading only (yaw), like the radar.
	 */
	Bearing(jet: Point, yaw: number, missile: Point): number {
		const dx = missile.x - jet.x, dz = missile.z - jet.z;
		// FlightMath.Forward at pitch 0 is (-sin yaw, 0, -cos yaw); right is (cos yaw, 0, -sin yaw).
		const ahead = -math.sin(yaw) * dx - math.cos(yaw) * dz;
		const right = math.cos(yaw) * dx - math.sin(yaw) * dz;
		if (math.abs(ahead) + math.abs(right) < 1e-6) return 0;
		return math.deg(math.atan2(right, ahead));
	},
	/** Inside the profile's ideal break window (the BREAK cue). */
	InBreakWindow(profile: MissileProfile, timeToImpact: number | undefined): boolean {
		return timeToImpact !== undefined && timeToImpact >= profile.breakLate && timeToImpact <= profile.breakEarly;
	},
};
