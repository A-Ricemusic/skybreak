import { DifficultyKind } from "../shared/Difficulty";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { MissileProfile, MissileRules, MissileTarget, Point } from "../shared/MissileRules";
import { FlightInput } from "../shared/Types";

// Closed-loop missile duel for MissileDuel.spec: the real FlightMath jet against a real
// MissileRules missile, fired the way CombatService fires a bandit's shot and cued the way the HUD
// receives it. Test-only (ServerStorage.Tests in Studio, the offline Luau VM otherwise).
//
//   1. A bandit sits `range` studs out at `bearing` from the jet's nose, nose on the jet (the fire
//      gate's separation and aim dot), and starts its windup if MissileRules.ChaseClear predicts a
//      fair shot at the end of it (a fresh bandit chases through its windup). It chases for the windup the way stepEnemies flies an attacking
//      bandit (lead pursuit, side bracket beyond 1100 studs), checks ShotClear again, and launches
//      18 studs ahead of its nose on MissileRules.LaunchHeading.
//   2. Every 1/30 s the jet steps (FlightMath), then the missile (MissileRules). Every 0.1 s the
//      server's telemetry samples MissileRules.BreakCue; the pilot moves the stick `reaction` later.
//
// Pilots (all circle left at 0.35 stick and cruise throttle until they act):
//   ignore   never reacts (the live test's "straight" pilot).
//   cue      on BREAK, pulls full stick the way the cue's arrow points, 0.25 back, full throttle,
//            for 1.6 s; again on a later cue (the live test's "break" pilot, reading the arrow).
//   away     the same pull, but always away from the missile's side (the old HUD's arrow).
//   beam     a competent pilot: on BREAK, turns hard onto the nearer heading square to the missile's
//            line of sight and holds it at full throttle.
//   timed    the cue pilot's pull at missile age `breakAge`, stick `breakX` (an early or late break).
//   run      full throttle straight ahead from launch (outrunning a tail shot).

export type DuelPilot = "ignore" | "cue" | "away" | "beam" | "timed" | "run";
export interface DuelSetup {
	level: DifficultyKind;
	act: number;
	/** Bandit position at windup start: degrees from the jet's nose (+right) and studs. */
	bearing: number;
	range: number;
	pilot: DuelPilot;
	/** Seconds from the server raising BREAK to the jet's stick moving. Default MissileRules.CueReaction. */
	reaction?: number;
	/** Where the 10 Hz telemetry clock sits relative to launch (0-0.1 s). */
	phase?: number;
	/** Override the act/level missile, for tuning sweeps. */
	profile?: MissileProfile;
	/** "timed": missile age at which the pull starts, and its stick (default away from the missile). */
	breakAge?: number;
	breakX?: number;
	/** Back pressure during the pull (default 0.25). */
	pull?: number;
	/** Sample the BREAK cue (default true); a pilot that ignores it may skip the prediction cost. */
	cue?: boolean;
	/** The jet's throttle before it acts (default cruise 0.65), starting at its matching speed. */
	throttle?: number;
}
export interface DuelResult {
	/** The bandit held its fire (ShotClear) at windup start or launch: no missile. */
	held: boolean;
	event: "hit" | "terrain" | "expired" | "flying";
	/** BREAK was on in at least one telemetry sample; the first one's missile age and arrow. */
	cued: boolean;
	cueAge?: number;
	cueStick?: number;
	/** Missile age when the jet's first pull started. */
	breakAge?: number;
	/** Missile age at the end; time to impact and range at launch. */
	age: number;
	launchSeconds?: number;
	launchRange: number;
}

const STEP = 1 / 30;
const TELEMETRY = 0.1;
const CIRCLE: FlightInput = { x: -0.35, y: 0, throttle: 0.65 };
const PULL_SECONDS = 1.6;
/** CombatService's Act I-III bandit windups (Difficulty "windup": Easy x1.3, Ace x0.8). */
const WINDUP = [2.4, 2.0, 1.7];
const WINDUP_SCALE: { [D in DifficultyKind]: number } = { easy: 1.3, normal: 1, ace: 0.8 };

function target(state: FlightState): MissileTarget {
	const [x, y, z] = FlightMath.Forward(state.yaw, state.pitch);
	return { position: { x: state.x, y: state.y, z: state.z }, velocity: { x: x * state.speed, y: y * state.speed, z: z * state.speed } };
}
function unit(x: number, y: number, z: number): Point {
	const size = math.sqrt(x * x + y * y + z * z);
	return size > 1e-6 ? { x: x / size, y: y / size, z: z / size } : { x: 0, y: 0, z: -1 };
}
function scale(a: Point, s: number): Point { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function distance(a: Point, b: Point): number { return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2); }

/** The heading (yaw) on the nearer side that puts the missile square off the wing. */
function beamHeading(jet: FlightState, missile: Point): number {
	const bearing = math.rad(MissileRules.Bearing({ x: jet.x, y: jet.y, z: jet.z }, jet.yaw, missile));
	// The missile at bearing b sits on a wing once the nose points at b -/+ 90 degrees (bearing +right, yaw +left).
	const right = FlightMath.WrapAngle(bearing - math.pi / 2), left = FlightMath.WrapAngle(bearing + math.pi / 2);
	return FlightMath.WrapAngle(jet.yaw - (math.abs(right) < math.abs(left) ? right : left));
}

export const MissileDuel = {
	Fly(setup: DuelSetup): DuelResult {
		const profile = setup.profile ?? MissileRules.Profile(setup.level, setup.act);
		const reaction = setup.reaction ?? MissileRules.CueReaction;
		const circle: FlightInput = { x: CIRCLE.x, y: 0, throttle: setup.throttle ?? CIRCLE.throttle };
		const jet: FlightState = { x: 0, y: 500, z: 0, yaw: 0, pitch: 0, roll: 0, speed: FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * circle.throttle };
		const angle = math.rad(setup.bearing);
		// The jet faces -Z with +X on its right wing; the bandit points at it.
		let bandit: Point = { x: math.sin(angle) * setup.range, y: 500, z: -math.cos(angle) * setup.range };
		let heading = unit(-bandit.x, 0, -bandit.z);
		const side = math.sin(angle) >= 0 ? 1 : -1;
		const banditSpeed = () => math.clamp(jet.speed + 24, 285, 350);
		const windup = WINDUP[math.clamp(setup.act, 1, 3) - 1] * WINDUP_SCALE[setup.level];
		const result: DuelResult = { held: true, event: "flying", cued: false, age: 0, launchRange: 0 };
		const start = { x: bandit.x + heading.x * MissileRules.LaunchOffset, y: bandit.y + heading.y * MissileRules.LaunchOffset, z: bandit.z + heading.z * MissileRules.LaunchOffset };
		if (!MissileRules.ChaseClear(start, banditSpeed(), target(jet), profile, windup)) return result;
		for (let time = 0; time < windup; time += STEP) {
			FlightMath.Step(jet, circle, STEP);
			const now = target(jet);
			const forward = unit(now.velocity.x, now.velocity.y, now.velocity.z);
			const separation = distance(now.position, bandit);
			const lead = math.clamp(separation / (350 + jet.speed), 0.35, 1.8);
			const bracket = separation > 1100 ? 500 * side : 0;
			const goal = {
				x: jet.x + now.velocity.x * lead - forward.z * bracket,
				y: jet.y + now.velocity.y * lead + 25,
				z: jet.z + now.velocity.z * lead + forward.x * bracket,
			};
			const desired = unit(goal.x - bandit.x, goal.y - bandit.y, goal.z - bandit.z);
			const alpha = FlightMath.DampAlpha(2.1, STEP);
			heading = unit(heading.x + (desired.x - heading.x) * alpha, heading.y + (desired.y - heading.y) * alpha, heading.z + (desired.z - heading.z) * alpha);
			const speed = banditSpeed();
			bandit = { x: bandit.x + heading.x * speed * STEP, y: bandit.y + heading.y * speed * STEP, z: bandit.z + heading.z * speed * STEP };
		}
		const from = { x: bandit.x + heading.x * MissileRules.LaunchOffset, y: bandit.y + heading.y * MissileRules.LaunchOffset, z: bandit.z + heading.z * MissileRules.LaunchOffset };
		if (!MissileRules.ShotClear(from, scale(heading, banditSpeed()), target(jet), profile)) return result;
		const missile = MissileRules.Launch(from, MissileRules.LaunchHeading(from, profile, target(jet)), profile);
		result.held = false;
		result.launchRange = distance(from, target(jet).position);
		result.launchSeconds = MissileRules.TimeToImpact(missile, target(jet));
		const pilot = setup.pilot;
		const pull = setup.pull ?? 0.25;
		let telemetry = setup.phase ?? 0;
		let pendingAt: number | undefined, pendingX = 0;
		let pullUntil = -1, pullX = 0;
		let beam: number | undefined;
		if (pilot === "timed") {
			pendingAt = setup.breakAge ?? 0;
			pendingX = setup.breakX ?? (MissileRules.Bearing(target(jet).position, jet.yaw, missile.position) > 0 ? -1 : 1);
		}
		let input: FlightInput = circle;
		for (let step = 0; step < 15 * 30; step++) {
			const age = missile.age;
			if (pendingAt !== undefined && age >= pendingAt - 1e-6) {
				if (pilot === "beam") beam = beamHeading(jet, missile.position);
				pullUntil = age + PULL_SECONDS; pullX = pendingX; pendingAt = undefined;
				if (result.breakAge === undefined) result.breakAge = age;
			}
			input = circle;
			if (pilot === "run") input = { x: 0, y: 0, throttle: 1 };
			else if (beam !== undefined) {
				const turn = FlightMath.WrapAngle(beam - jet.yaw);
				input = { x: math.clamp(-turn / (1.12 * STEP * 3), -1, 1), y: 0.1, throttle: 1 };
			} else if (age < pullUntil) input = { x: pullX, y: pull, throttle: 1 };
			FlightMath.Step(jet, input, STEP);
			const outcome = MissileRules.Step(missile, profile, target(jet), STEP);
			result.age = missile.age;
			if (outcome.event !== "flying") { result.event = outcome.event; return result; }
			telemetry += STEP;
			if (telemetry < TELEMETRY - 1e-9 || setup.cue === false) continue;
			telemetry -= TELEMETRY;
			// sendTelemetry: only a locked missile inside 1800 studs is incoming and can carry BREAK.
			if (!missile.locked || distance(missile.position, target(jet).position) >= 1800) continue;
			const stick = MissileRules.BreakCue(missile, profile, jet, input);
			if (stick === undefined) continue;
			if (!result.cued) { result.cued = true; result.cueAge = missile.age; result.cueStick = stick; }
			const busy = pendingAt !== undefined || missile.age < pullUntil || beam !== undefined;
			if (busy || (pilot !== "cue" && pilot !== "away" && pilot !== "beam")) continue;
			pendingAt = missile.age + reaction;
			pendingX = pilot === "away" ? (MissileRules.Bearing(target(jet).position, jet.yaw, missile.position) > 0 ? -1 : 1) : stick;
		}
		return result;
	},
};
