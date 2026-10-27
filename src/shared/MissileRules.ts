import { Difficulty, DifficultyKind } from "./Difficulty";
import { FlightMath, FlightState } from "./FlightMath";
import { BreakCueState, FlightInput } from "./Types";

// Pure hostile-missile flight and seeker rules. The server (CombatService) owns every missile and
// only adapts Vector3 to the plain points here, so the same code runs in Roblox, Jest and the
// offline Luau VM.
//
// The model, in the order a missile lives it:
//   0. Launch: the shooter fires on a collision course (LaunchHeading) for the jet's current
//      velocity, so a jet that keeps flying straight needs almost no correction and is hit. A shot
//      that would arrive in under `minLaunch` seconds is never taken (ShotClear, checked at windup
//      start for the end of the windup and again at launch): nothing could answer it.
//   1. Burn: `burnSeconds` at `burnSpeed`. Guidance is proportional navigation (heading rate =
//      navGain x line-of-sight rate, plus a small pursuit term) under a HARD turn-rate cap in rad/s.
//      speed x turnCap is the missile's sideways acceleration, well under a hard-turning jet's
//      (~290 studs/s x 1.12 rad/s = ~325), so a break started in time pulls the jet off its path.
//   2. Coast: after the burn, speed decays by exp(-COAST_DRAG x t). A coasting missile slower than
//      the jet it chases has lost the chase (seeker off); below MIN_SPEED it self-destructs. A
//      long tail shot can be outrun at full throttle.
//   3. Seeker cone: once the jet is more than `gimbal` off the missile's nose the lock is lost for
//      good; the missile flies straight on and self-destructs when `life` runs out.
//   4. Terrain: a step segment that meets terrain or scenery (the injected ray; AircraftCollision's
//      query set on the server) detonates the missile there, harmlessly. Ridges protect.
//   5. Proximity fuse: `fuse` studs from the jet, measured on the path relative to the jet through
//      the step (no tunnelling at 600+ studs/s), and only if that point comes before any terrain hit.
//
// The break cue (BreakCue, then CueTick) tells the pilot when to start AND when to stop a break:
//   BREAK <- / ->  the server flies the most urgent missile forward against the real flight rules and
//                  lights BREAK, with the way to turn, only when the missile would hit a jet that
//                  keeps flying as it is and misses one that breaks hard CUE_REACTION seconds from now
//                  and keeps pulling. So it never asks for a losing turn, never shows for a missile
//                  that will miss anyway, and stays dark both while a break would still be followed
//                  (too early) and once it is too late. There is no fixed window: the dodge window
//                  comes out of the physics, and the tuning below sets how long it is.
//   HOLD <- / ->   while the pilot pulls the cued way against that missile: letting go is not yet safe.
//   CLEAR          the missile can no longer reach the jet whatever the pilot does from now on
//                  (Unreachable: it is gone, or provably out of reach for the rest of its life), so
//                  letting go at any moment from here is safe. Shown CLEAR_SECONDS, then the row clears.
// A break pulled through HOLD is the break BREAK checked, so it wins; letting go during HOLD may not.
// The release moment is a proof about every future, not one predicted release time: a pilot who
// pulls a little longer after CLEAR, or lets go to any stick, is covered by the same proof.
//
// "Misses" means the missile can no longer hit: the prediction flies it, through the same Advance
// the server's stepHostileMissile uses (so the live fuse still fires after the seeker lets go),
// until it hits, self-destructs (life, or coasting below MIN_SPEED), or is Unreachable (blind and
// provably staying more than fuse + CLEAR_MARGIN ahead of the jet, BlindPast, or out of reach for
// the rest of its life). Losing the lock, or passing the jet, is not enough on its own: a blind
// missile flies straight on, and the jet can turn back across its path.
//
// Tuning (studs, seconds, rad/s). Rows are Normal by act; Easy/Ace multiply through the Difficulty
// knobs (missileTurn, missileBurn, missileGimbal); a missile fired by the mission's ace adds the
// last column on top. Checked closed-loop by MissileDuel.spec (table in docs/flight-mechanics.md).
//
//   value          Act I   Act II  Act III   Easy     Ace      ace pilot
//   burnSpeed      560     600     620       x1       x1       -
//   burnSeconds    3.0     3.2     3.4       x0.75    x1.4     -
//   turnCap        0.28    0.30    0.32      x0.75    x1.3     +0.04
//   gimbal (deg)   45      45      45        x1.1     x1.3     +5
//   fuse           18      22      26        -        -        -
//   life           7       8       9         -        -        -
//   minLaunch      1.5 s                     1.6 s    1.8 s    -
//   coast drag     0.35/s; MIN_SPEED 160; navGain 3
//
// Why Ace is different: a harder turn cap, longer burn and wider seeker follow a break started
// before BREAK shows, and its longer minimum launch time means most Ace shots have that early
// phase; the break that works is the one taken on the cue.

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
	/** A shot is only taken when it would arrive at least this many seconds after launch (ShotClear). */
	minLaunch: number;
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

export interface BreakCueShot { missile: GuidedMissile; profile: MissileProfile }
export interface BreakCueOut { state: BreakCueState; stick: number }
/** The server's memory of one break between telemetry ticks (MissileRules.CueTick). */
export interface BreakTrack {
	/** The missile BREAK was raised for, while the cue follows it. */
	shot?: BreakCueShot;
	/** The cued way, -1 left or +1 right. */
	stick: number;
	state?: BreakCueState;
	/** When BREAK was last raised, or CLEAR went up. */
	since: number;
}

const NAV_GAIN = 3;
/** Small pure-pursuit bias (1/s) so a missile launched off the line of sight still swings onto it. */
const PURSUIT = 0.5;
const COAST_DRAG = 0.35;
/** A coasting missile this slow falls out of the fight whatever it is chasing. */
const MIN_SPEED = 160;

const BURN_SPEED = [560, 600, 620];
const BURN_SECONDS = [3.0, 3.2, 3.4];
const TURN_CAP = [0.28, 0.3, 0.32];
const GIMBAL_DEGREES = 45;
const FUSE = [18, 22, 26];
const LIFE = [7, 8, 9];
const ACE_TURN_BONUS = 0.04;
const ACE_GIMBAL_BONUS = 5;
/** Shooters launch this many studs ahead of their nose. */
const LAUNCH_OFFSET = 18;
/** Launches lead the jet by at most this share of the seeker cone. */
const LEAD_SHARE = 0.8;
/** Shortest time to impact a launch may have, by level (ShotClear). */
const MIN_LAUNCH: { [D in DifficultyKind]: number } = { easy: 1.6, normal: 1.5, ace: 1.8 };
/** The break the BREAK cue predicts: full stick and a little back pressure at full power, held until CLEAR. */
const BREAK_PULL = 0.25;
/** A stick at least this far the cued way is the pilot breaking (HOLD tracks it; else they let go). */
const BREAKING_STICK = 0.5;
/** Seconds CLEAR stays on the HUD before the row clears. */
const CLEAR_SECONDS = 1;
/** Seconds the cue keeps following a BREAK's missile while the pilot's stick comes over (reaction, plus a tick). */
const BREAK_GRACE = 0.5;
/**
 * Seconds from the server raising BREAK to the jet's stick moving: up to a 10 Hz telemetry tick,
 * replication, the pilot's hands and the input upload. The cue predicts a break this late.
 */
const CUE_REACTION = 0.3;
/** Only a missile arriving within this many seconds gets a BREAK prediction (bounds the server's cost). */
const CUE_HORIZON = 3.5;
/** CombatService's fixed server step; predictions step at the same rate. */
const STEP_SECONDS = 1 / 30;
/** Studs beyond the fuse a blind missile must stay ahead of the jet for BlindPast. */
const CLEAR_MARGIN = 30;
/** The furthest a jet moves in a second: top speed plus the stall sink (FlightMath.Step). */
const JET_REACH = FlightMath.MaxSpeed + 65;

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
	CueReaction: CUE_REACTION,
	CueHorizon: CUE_HORIZON,
	BreakPull: BREAK_PULL,
	BreakingStick: BREAKING_STICK,
	ClearSeconds: CLEAR_SECONDS,
	StepSeconds: STEP_SECONDS,
	CoastDrag: COAST_DRAG,
	MinSpeed: MIN_SPEED,
	LaunchOffset: LAUNCH_OFFSET,
	/** The act's missile for this level; `acePilot` for a missile launched by the mission's ace. */
	Profile(difficulty: DifficultyKind, actIndex: number, acePilot = false): MissileProfile {
		const index = act(actIndex) - 1;
		const level = Difficulty.Coerce(difficulty);
		return {
			burnSpeed: BURN_SPEED[index],
			burnSeconds: Difficulty.Scale(level, "missileBurn", BURN_SECONDS[index]),
			navGain: NAV_GAIN,
			turnCap: Difficulty.Scale(level, "missileTurn", TURN_CAP[index]) + (acePilot ? ACE_TURN_BONUS : 0),
			gimbal: math.rad(Difficulty.Scale(level, "missileGimbal", GIMBAL_DEGREES) + (acePilot ? ACE_GIMBAL_BONUS : 0)),
			fuse: FUSE[index],
			life: LIFE[index],
			minLaunch: MIN_LAUNCH[level],
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
	/** The jet as a hostile missile sees it: its position and velocity. */
	JetTarget(state: FlightState): MissileTarget {
		const [x, y, z] = FlightMath.Forward(state.yaw, state.pitch);
		return { position: { x: state.x, y: state.y, z: state.z }, velocity: { x: x * state.speed, y: y * state.speed, z: z * state.speed } };
	},
	/**
	 * One step of a hostile missile against the jet's flight state (already stepped to the end of the
	 * tick). The one stepping path: CombatService's stepHostileMissile and the BREAK prediction (Misses)
	 * both fly missiles through it, so the cue's physics cannot drift from the server's.
	 */
	Advance(missile: GuidedMissile, profile: MissileProfile, jet: FlightState, dt: number, ray?: MissileRay): MissileStep {
		return MissileRules.Step(missile, profile, MissileRules.JetTarget(jet), dt, ray);
	},
	/** Seconds until the missile self-destructs at `age`: out of life, or coasting below MIN_SPEED. */
	Remaining(profile: MissileProfile, age: number): number {
		const slow = profile.burnSeconds + math.max(0, math.log(profile.burnSpeed / MIN_SPEED) / COAST_DRAG);
		return math.max(0, math.min(profile.life, slow) - age);
	},
	/** Studs a missile of `age` flies over the next `seconds` (full burn, then drag). */
	Travel(profile: MissileProfile, age: number, seconds: number): number {
		const finish = age + math.max(seconds, 0);
		const burn = math.max(0, math.min(finish, profile.burnSeconds) - age);
		const from = math.max(age, profile.burnSeconds) - profile.burnSeconds, to = finish - profile.burnSeconds;
		const coast = to > from ? profile.burnSpeed / COAST_DRAG * (math.exp(-COAST_DRAG * from) - math.exp(-COAST_DRAG * to)) : 0;
		return profile.burnSpeed * burn + coast;
	},
	/**
	 * A blind missile that can never reach the jet again. It flies straight at a known, falling speed,
	 * so its lead past the jet along its heading can shrink by at most JET_REACH per second less the
	 * missile's own speed. That lead, less what the jet can make up, is concave in time (the missile
	 * only slows), so it is smallest now or at self-destruct: true when both stay beyond fuse +
	 * CLEAR_MARGIN. Conservative for 30 Hz steps (each moves at its end-of-step speed, one step of jet
	 * reach for the fuse's start point, the horizon padded by two steps).
	 */
	BlindPast(missile: GuidedMissile, profile: MissileProfile, jet: FlightState): boolean {
		if (missile.locked) return false;
		const lead = dot(sub(missile.position, { x: jet.x, y: jet.y, z: jet.z }), missile.direction) - JET_REACH * STEP_SECONDS;
		const gap = profile.fuse + CLEAR_MARGIN;
		if (!(lead > gap)) return false;
		const seconds = MissileRules.Remaining(profile, missile.age) + 2 * STEP_SECONDS;
		return lead + MissileRules.Travel(profile, missile.age + STEP_SECONDS, seconds) - JET_REACH * seconds > gap;
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
	/** The launch heading CombatService fires on: the collision course, led by at most LEAD_SHARE of the seeker cone. */
	LaunchHeading(from: Point, profile: MissileProfile, target: MissileTarget): Point {
		return MissileRules.LeadDirection(from, profile.burnSpeed, target, profile.gimbal * LEAD_SHARE);
	},
	/**
	 * May a shooter at `from` (moving at `velocity`) fire `ahead` seconds from now? Both aircraft are
	 * carried on straight lines for `ahead` (a windup), then the shot must take at least
	 * `profile.minLaunch` seconds to arrive. A point-blank shot is never taken: it would be too late
	 * for any BREAK cue or turn, so it could only be a free hit.
	 */
	ShotClear(from: Point, velocity: Point, target: MissileTarget, profile: MissileProfile, ahead = 0): boolean {
		const launch = add(from, mul(velocity, ahead));
		const later = { position: add(target.position, mul(target.velocity, ahead)), velocity: target.velocity };
		const shot = MissileRules.Launch(launch, MissileRules.LaunchHeading(launch, profile, later), profile);
		const seconds = MissileRules.TimeToImpact(shot, later);
		return seconds !== undefined && seconds >= profile.minLaunch;
	},
	/**
	 * ShotClear for a shooter that spends the windup chasing: carried at `speed` straight for where the
	 * jet will be `ahead` seconds from now instead of on its current line, since a pursuit closes on a
	 * turning jet faster than a straight line does. A windup that would end point-blank is never lit.
	 */
	ChaseClear(from: Point, speed: number, target: MissileTarget, profile: MissileProfile, ahead: number): boolean {
		const later = add(target.position, mul(target.velocity, ahead));
		return MissileRules.ShotClear(from, mul(unit(sub(later, from), { x: 0, y: 0, z: -1 }), speed), target, profile, ahead);
	},
	/**
	 * Range straight up the tail of a jet flying at `jetSpeed` from which `profile`'s shot arrives in
	 * `minLaunch + margin` seconds: the closest a shooter sat behind the jet can be and still fire
	 * (ShotClear). A tail chaser that closes inside it holds its shot, so one keeping its range
	 * (ThreatRules.KeepsRange) drops back to it through the windup.
	 */
	Standoff(profile: MissileProfile, jetSpeed: number, margin = 0): number {
		return (profile.minLaunch + margin) * math.max(profile.burnSpeed - jetSpeed, 50) + LAUNCH_OFFSET;
	},
	/**
	 * The missile can no longer reach the jet, whatever the jet does from now on: it is blind and
	 * BlindPast, or it is further away than it and the jet could close together in the rest of its
	 * life (its remaining Travel plus JET_REACH, both padded by two steps, beyond fuse + CLEAR_MARGIN;
	 * a 30 Hz step moves at its end-of-step speed, which only falls, so Travel bounds it). Closed form:
	 * CLEAR is this, and every prediction stops early on it.
	 */
	Unreachable(missile: GuidedMissile, profile: MissileProfile, jet: FlightState): boolean {
		if (MissileRules.BlindPast(missile, profile, jet)) return true;
		const seconds = MissileRules.Remaining(profile, missile.age) + 2 * STEP_SECONDS;
		const range = length(sub(missile.position, { x: jet.x, y: jet.y, z: jet.z }));
		return range - MissileRules.Travel(profile, missile.age, seconds) - JET_REACH * (seconds + STEP_SECONDS) > profile.fuse + CLEAR_MARGIN;
	},
	/**
	 * Flies a copy of the missile against a copy of the jet in open sky, one server step at a time
	 * (Advance). The jet keeps `input`; with a `stick` (-1 left, +1 right) it breaks `delay` seconds
	 * from now: full stick, a little back pressure and full power for `hold` seconds (default: pulling
	 * to the end), then back to `input`. Both are counted in whole steps, so a pilot replaying the
	 * break (MissileDuel, EngageSim) flies exactly it. True only when the missile can no longer hit: it
	 * self-destructs or detonates elsewhere, or Unreachable proves it cannot reach the jet again.
	 * Bounded by the missile's remaining life (at most `life` x 30 steps).
	 */
	Misses(missile: GuidedMissile, profile: MissileProfile, jet: FlightState, input: FlightInput, delay = 0, stick?: number, hold = math.huge): boolean {
		// Step replaces position/direction rather than mutating them, so a shallow copy is independent.
		const copy: GuidedMissile = { position: missile.position, direction: missile.direction, speed: missile.speed, age: missile.age, locked: missile.locked };
		const state: FlightState = { x: jet.x, y: jet.y, z: jet.z, yaw: jet.yaw, pitch: jet.pitch, roll: jet.roll, speed: jet.speed };
		const pull: FlightInput = { x: stick ?? 0, y: BREAK_PULL, throttle: 1 };
		const start = math.floor(delay / STEP_SECONDS + 0.5), stop = start + math.floor(hold / STEP_SECONDS + 0.5);
		const remaining = MissileRules.Remaining(profile, missile.age);
		// Two steps past self-destruct, so Step itself reports it; a non-finite age proves nothing.
		const steps = finite(remaining) ? math.ceil(remaining / STEP_SECONDS) + 2 : 0;
		for (let step = 0; step < steps; step++) {
			FlightMath.Step(state, stick !== undefined && step >= start && step < stop ? pull : input, STEP_SECONDS);
			const result = MissileRules.Advance(copy, profile, state, STEP_SECONDS);
			if (result.event === "hit") return false;
			if (result.event !== "flying") return true;
			if (MissileRules.Unreachable(copy, profile, state)) return true;
		}
		// Not proven safe.
		return false;
	},
	/**
	 * Where BREAK points (-1 left, +1 right): the missile would hit a jet that keeps flying as it is,
	 * but misses one that breaks hard CUE_REACTION seconds from now and keeps pulling; else undefined.
	 * At most three predictions, each bounded by the missile's remaining life (Misses).
	 * Checked against the real flight and missile rules, so the cue never asks for a losing turn, never
	 * shows for a missile that is going to miss anyway, and stays dark while a break would still be
	 * followed (too early) or is already too late. Tries the way the pilot is already turning first
	 * (no flip-flopping mid-break), then away from the missile, then the other way. When to let go is
	 * CueTick's HOLD / CLEAR, not a fixed pull time.
	 */
	BreakCue(missile: GuidedMissile, profile: MissileProfile, jet: FlightState, input: FlightInput, reaction = CUE_REACTION): number | undefined {
		if (!missile.locked) return undefined;
		const target = MissileRules.JetTarget(jet);
		const seconds = MissileRules.TimeToImpact(missile, target);
		if (seconds === undefined || seconds > CUE_HORIZON) return undefined;
		if (MissileRules.Misses(missile, profile, jet, input)) return undefined;
		const away = MissileRules.Bearing(target.position, jet.yaw, missile.position) > 0 ? -1 : 1;
		const first = math.abs(input.x) >= BREAKING_STICK ? math.sign(input.x) : away;
		if (MissileRules.Misses(missile, profile, jet, input, reaction, first)) return first;
		if (MissileRules.Misses(missile, profile, jet, input, reaction, -first)) return -first;
		return undefined;
	},
	/** A fresh BreakTrack: following no break. */
	NewTrack(): BreakTrack {
		return { stick: 0, since: 0 };
	},
	/** Stop following the tracked missile (it hit the jet, or the sortie ended). */
	Forget(track: BreakTrack): void {
		track.shot = undefined; track.state = undefined; track.stick = 0;
	},
	/**
	 * One telemetry tick of the break cue, at time `now` (seconds). `urgent` is the most urgent locked
	 * missile in range (the only one BREAK is predicted for); `trackedAlive` says whether the missile
	 * the track follows is still flying. Returns the cue to show, or undefined for none:
	 *   - Following a BREAK's missile and the pilot pulls the cued way: CLEAR once the missile is gone
	 *     or Unreachable (closed form, no prediction), else HOLD. No missile is predicted while HOLD shows.
	 *   - Otherwise BreakCue for `urgent` (BREAK). A pilot who lets go during HOLD drops the track; one
	 *     who has not reacted to BREAK yet keeps it for BREAK_GRACE.
	 *   - Else CLEAR while it is up (CLEAR_SECONDS), then nothing. A new BREAK replaces CLEAR.
	 * Cost: at most BreakCue's three predictions, and none while HOLD shows.
	 */
	CueTick(track: BreakTrack, now: number, jet: FlightState, input: FlightInput, urgent: BreakCueShot | undefined, trackedAlive: boolean, reaction = CUE_REACTION): BreakCueOut | undefined {
		const shot = track.shot;
		if (shot && track.state !== "clear") {
			const breaking = math.sign(input.x) === track.stick && math.abs(input.x) >= BREAKING_STICK;
			if (breaking) {
				if (!trackedAlive || MissileRules.Unreachable(shot.missile, shot.profile, jet)) {
					track.state = "clear"; track.since = now; track.shot = undefined;
					return { state: "clear", stick: track.stick };
				}
				track.state = "hold";
				return { state: "hold", stick: track.stick };
			}
			if (track.state === "hold" || !trackedAlive || now - track.since > BREAK_GRACE + 1e-6) MissileRules.Forget(track);
		}
		// A new BREAK (another missile) takes over from CLEAR.
		const stick = urgent ? MissileRules.BreakCue(urgent.missile, urgent.profile, jet, input, reaction) : undefined;
		if (stick === undefined || !urgent) {
			if (track.state !== "clear") return undefined;
			if (now - track.since < CLEAR_SECONDS - 1e-6) return { state: "clear", stick: track.stick };
			MissileRules.Forget(track);
			return undefined;
		}
		track.shot = urgent; track.stick = stick; track.state = "break"; track.since = now;
		return { state: "break", stick };
	},
};
