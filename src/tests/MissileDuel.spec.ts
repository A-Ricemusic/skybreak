import { describe, expect, it } from "@rbxts/jest-globals";
import { DifficultyKind } from "../shared/Difficulty";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { GuidedMissile, MissileEvent, MissileProfile, MissileRules } from "../shared/MissileRules";
import { FlightInput } from "../shared/Types";
import { DuelResult, DuelSetup, MissileDuel } from "./MissileDuel";

// Closed-loop dodge contracts: the real flight model against real missiles, fired through the
// bandit fire gate the way CombatService fires them and cued the way the HUD shows BREAK (see
// MissileDuel). Also runs in the offline Luau VM (toBe only). docs/flight-mechanics.md has the table.
//
// Every act and level flies the same grid: a bandit starting its windup at every 30 degrees around
// the jet, at six ranges across the act's fire range, at two telemetry phases, against a pilot
// circling at cruise. The cue pilot flies each BREAK exactly as the cue checked it, so a single hit
// on it is a broken promise: every grid requires zero, not a dodge percentage.

/** CombatService.TUNING.fireRange by act. */
const FIRE_RANGE = [[450, 1700], [400, 1900], [350, 2100]];
/** How long before the cue pilot's break the "too early" break starts. */
const EARLY = 0.7;
/** The 10 Hz telemetry clock's offset from launch: on the step, and halfway between. */
const PHASES = [0, 0.05];

interface Tally {
	shots: number;
	/** Ignored missiles that hit, and of those how many showed BREAK at least once. */
	hits: number; cuedHits: number;
	/**
	 * Shots where the cue pilot broke as cued, and how many of those still hit, letting go after
	 * BreakHold or keeping the pull to the end (both must be 0).
	 */
	breaks: number; failed: number; sustainedFailed: number;
	/** Shots where BREAK first showed late enough to break EARLY seconds sooner, and how many of those early breaks were hit. */
	early: number; earlyHit: number;
	/** Rear-hemisphere shots at a jet running at full throttle, and how many hit. */
	runs: number; runHits: number;
}

const tallies = new Map<string, Tally>();
function grid(level: DifficultyKind, act: number): Tally {
	const key = `${level}${act}`;
	const cached = tallies.get(key);
	if (cached) return cached;
	const tally: Tally = { shots: 0, hits: 0, cuedHits: 0, breaks: 0, failed: 0, sustainedFailed: 0, early: 0, earlyHit: 0, runs: 0, runHits: 0 };
	const [low, high] = FIRE_RANGE[act - 1];
	for (const phase of PHASES) for (let bearing = 0; bearing < 360; bearing += 30) {
		for (let step = 0; step <= 5; step++) {
			const range = low + 50 + (high - low - 100) * step / 5;
			const setup: DuelSetup = { level, act, bearing, range, phase, pilot: "ignore" };
			const ignored = MissileDuel.Fly(setup);
			if (ignored.held) continue;
			tally.shots += 1;
			if (ignored.event === "hit") {
				tally.hits += 1;
				if (ignored.cued) tally.cuedHits += 1;
			}
			const cued: DuelResult = MissileDuel.Fly({ ...setup, pilot: "cue" });
			if (cued.breakAge !== undefined) {
				tally.breaks += 1;
				if (cued.event === "hit") tally.failed += 1;
				if (MissileDuel.Fly({ ...setup, pilot: "cue", hold: math.huge }).event === "hit") tally.sustainedFailed += 1;
			}
			const start = cued.cueAge !== undefined ? cued.cueAge + MissileRules.CueReaction : undefined;
			if (start !== undefined && start >= EARLY) {
				tally.early += 1;
				if (MissileDuel.Fly({ ...setup, pilot: "timed", breakAge: start - EARLY, breakX: cued.cueStick, cue: false }).event === "hit") tally.earlyHit += 1;
			}
			if (bearing >= 120 && bearing <= 240) {
				const run = MissileDuel.Fly({ ...setup, pilot: "run", throttle: 1, cue: false });
				if (!run.held) {
					tally.runs += 1;
					if (run.event === "hit") tally.runHits += 1;
				}
			}
		}
	}
	tallies.set(key, tally);
	return tally;
}
function rate(part: number, whole: number): number { return whole > 0 ? part / whole : 0; }

const STEP = MissileRules.StepSeconds;
const REACTION_STEPS = math.floor(MissileRules.CueReaction / STEP + 0.5);
const PULL_STEPS = math.floor(MissileRules.BreakHold / STEP + 0.5);
function copyJet(jet: FlightState): FlightState { return { x: jet.x, y: jet.y, z: jet.z, yaw: jet.yaw, pitch: jet.pitch, roll: jet.roll, speed: jet.speed }; }
function copyMissile(m: GuidedMissile): GuidedMissile { return { position: m.position, direction: m.direction, speed: m.speed, age: m.age, locked: m.locked }; }
/**
 * Flies the break BreakCue checks (or no break) to the very end with MissileRules.Step alone: no
 * early exits, so a blind missile's fuse gets every chance to catch the jet.
 */
function flown(missile: GuidedMissile, profile: MissileProfile, jet: FlightState, input: FlightInput, stick?: number, sustained = false): MissileEvent {
	const m = copyMissile(missile), state = copyJet(jet);
	const pull: FlightInput = { x: stick ?? 0, y: 0.25, throttle: 1 };
	for (let step = 0; step < 15 * 30; step++) {
		const breaking = stick !== undefined && step >= REACTION_STEPS && (sustained || step < REACTION_STEPS + PULL_STEPS);
		FlightMath.Step(state, breaking ? pull : input, STEP);
		const event = MissileRules.Step(m, profile, MissileRules.JetTarget(state), STEP).event;
		if (event !== "flying") return event;
	}
	return "flying";
}

/**
 * The re-review's reproductions (Sol, 2a1dc51): a fair open-sky shot at a jet flying straight; the
 * old prediction called the break safe once the seeker let go, but the blind missile flew on and its
 * fuse caught the jet as the break carried it back across its path (Easy I hit at 3.47 s, Normal III
 * at 6.27 s). Each runs on both sides.
 */
const REPRODUCTIONS: { level: DifficultyKind; act: number; speed: number; bearing: number; range: number }[] = [
	{ level: "easy", act: 1, speed: 320, bearing: 60, range: 1100 },
	{ level: "normal", act: 3, speed: 285, bearing: 120, range: 1500 },
];
interface Replay { cues: number; event: MissileEvent; unsound: number; checked: number }
/** Telemetry at 10 Hz (phase 0.05); the pilot flies the first cue's break exactly as cued, again on a later one. */
function replay(level: DifficultyKind, act: number, speed: number, bearing: number, range: number): Replay {
	const profile = MissileRules.Profile(level, act);
	const jet: FlightState = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed };
	const base: FlightInput = { x: 0, y: 0, throttle: (speed - FlightMath.MinSpeed) / (FlightMath.MaxSpeed - FlightMath.MinSpeed) };
	const angle = math.rad(bearing);
	const from = { x: math.sin(angle) * range, y: 400, z: -math.cos(angle) * range };
	expect(MissileRules.ShotClear(from, { x: 0, y: 0, z: 0 }, MissileRules.JetTarget(jet), profile)).toBe(true);
	const missile = MissileRules.Launch(from, MissileRules.LaunchHeading(from, profile, MissileRules.JetTarget(jet)), profile);
	const result: Replay = { cues: 0, event: "flying", unsound: 0, checked: 0 };
	let clock = 0.05, pendingStep: number | undefined, pendingX = 0, pullUntil = -1, pullX = 0;
	for (let step = 0; step < 15 * 30; step++) {
		if (pendingStep !== undefined && step >= pendingStep) { pullUntil = step + PULL_STEPS; pullX = pendingX; pendingStep = undefined; }
		const input = step < pullUntil ? { x: pullX, y: 0.25, throttle: 1 } : base;
		FlightMath.Step(jet, input, STEP);
		result.event = MissileRules.Step(missile, profile, MissileRules.JetTarget(jet), STEP).event;
		if (result.event !== "flying") return result;
		clock += STEP;
		if (clock < 0.1 - 1e-9) continue;
		clock -= 0.1;
		// Soundness at every sample: whenever the prediction calls a break safe, flying it to the end agrees.
		for (const stick of [-1, 1]) for (const sustained of [false, true]) {
			if (!MissileRules.Misses(missile, profile, jet, input, MissileRules.CueReaction, stick, sustained ? math.huge : MissileRules.BreakHold)) continue;
			result.checked += 1;
			if (flown(missile, profile, jet, input, stick, sustained) === "hit") result.unsound += 1;
		}
		const cue = MissileRules.BreakCue(missile, profile, jet, input);
		if (cue === undefined) continue;
		result.cues += 1;
		if (pendingStep === undefined && step + 1 >= pullUntil) { pendingStep = step + 1 + REACTION_STEPS; pendingX = cue; }
	}
	return result;
}

describe("Missile dodging, closed loop", () => {
	it("Normal: ignored missiles hit, BREAK shows for nearly every one, and a break flown as cued never loses", () => {
		for (const act of [1, 2, 3]) {
			const t = grid("normal", act);
			expect(t.shots >= 20).toBe(true);
			expect(rate(t.hits, t.shots) >= 0.85).toBe(true);
			expect(rate(t.cuedHits, t.hits) >= 0.9).toBe(true);
			expect(t.failed).toBe(0);
			expect(t.sustainedFailed).toBe(0);
		}
	});
	it("Easy: a break flown as cued never loses, a tail shot can be outrun, and an ignored missile still hits", () => {
		for (const act of [1, 2, 3]) {
			const t = grid("easy", act);
			expect(t.breaks > 0).toBe(true);
			expect(t.failed).toBe(0);
			expect(t.sustainedFailed).toBe(0);
			expect(rate(t.runs - t.runHits, t.runs) >= 0.4).toBe(true);
			expect(rate(t.hits, t.shots) >= 0.5).toBe(true);
		}
	});
	it("Ace: a break flown as cued never loses, one started early is followed", () => {
		let early = 0, earlyHit = 0;
		for (const act of [1, 2, 3]) {
			const t = grid("ace", act);
			expect(rate(t.hits, t.shots) >= 0.85).toBe(true);
			// BREAK shows for at least half the missiles that would hit, and following it always escapes.
			expect(rate(t.cuedHits, t.hits) >= 0.5).toBe(true);
			expect(t.failed).toBe(0);
			expect(t.sustainedFailed).toBe(0);
			early += t.early; earlyHit += t.earlyHit;
		}
		expect(early >= 10).toBe(true);
		expect(rate(earlyHit, early) >= 0.75).toBe(true);
	});
	it("only asks for a turn that wins, even head-on (the review's losing-window case)", () => {
		// Normal Act III, the jet at full speed heading -Z and the missile launched 1500 studs ahead.
		const profile = MissileRules.Profile("normal", 3);
		const jet: FlightState = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 320 };
		const target = () => {
			const [x, y, z] = FlightMath.Forward(jet.yaw, jet.pitch);
			return { position: { x: jet.x, y: jet.y, z: jet.z }, velocity: { x: x * jet.speed, y: y * jet.speed, z: z * jet.speed } };
		};
		const from = { x: 0, y: 400, z: -1500 };
		const missile = MissileRules.Launch(from, MissileRules.LaunchHeading(from, profile, target()), profile);
		let input = { x: 0, y: 0, throttle: 1 };
		let cue: number | undefined, breakAt: number | undefined;
		let event = "flying";
		for (let step = 0; step < 15 * 30 && event === "flying"; step++) {
			if (breakAt !== undefined && missile.age >= breakAt - 1e-6) input = { x: cue!, y: 0.25, throttle: 1 };
			FlightMath.Step(jet, input, 1 / 30);
			event = MissileRules.Step(missile, profile, target(), 1 / 30).event;
			// Every telemetry tick until the first cue; the pilot answers it CueReaction later.
			if (cue === undefined && step % 3 === 2) {
				cue = MissileRules.BreakCue(missile, profile, jet, input);
				if (cue !== undefined) breakAt = missile.age + MissileRules.CueReaction;
			}
		}
		expect(cue !== undefined).toBe(true);
		expect(event === "hit").toBe(false);
	});
	it("never calls a break safe while a blind missile's fuse can still catch it (the re-review's reproductions)", () => {
		for (const r of REPRODUCTIONS) for (const side of [1, -1]) {
			const result = replay(r.level, r.act, r.speed, r.bearing * side, r.range);
			expect(result.checked > 0).toBe(true);
			expect(result.unsound).toBe(0);
			expect(result.cues > 0).toBe(true);
			expect(result.event === "hit").toBe(false);
		}
	});
	it("flies a blind missile until it can no longer hit, not just past the jet", () => {
		const profile = MissileRules.Profile("normal", 3);
		// Blind, 200 studs past a jet flying the same way at full speed: still burning, it pulls away.
		const jet: FlightState = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 320 };
		const ahead = { position: { x: 0, y: 400, z: -200 }, direction: { x: 0, y: 0, z: -1 }, speed: profile.burnSpeed, age: 1, locked: false };
		expect(MissileRules.BlindPast(ahead, profile, jet)).toBe(true);
		// The same missile late in its coast, slower than the jet: 60 studs ahead the jet catches its fuse.
		const slow = { ...ahead, position: { x: 0, y: 400, z: -60 }, age: profile.burnSeconds + 3, speed: MissileRules.SpeedAt(profile, profile.burnSeconds + 3) };
		expect(MissileRules.BlindPast(slow, profile, jet)).toBe(false);
		expect(MissileRules.Misses(slow, profile, jet, { x: 0, y: 0, throttle: 1 })).toBe(false);
		// Blind and dead ahead, coming at the jet: losing the lock is not a miss.
		const facing = { position: { x: 0, y: 400, z: -900 }, direction: { x: 0, y: 0, z: 1 }, speed: profile.burnSpeed, age: 1, locked: false };
		expect(MissileRules.BlindPast(facing, profile, jet)).toBe(false);
		expect(MissileRules.Misses(facing, profile, jet, { x: 0, y: 0, throttle: 1 })).toBe(false);
		// Remaining life and travel agree with stepping the speed profile.
		expect(MissileRules.Remaining(profile, 0)).toBe(math.min(profile.life, profile.burnSeconds + math.log(profile.burnSpeed / MissileRules.MinSpeed) / MissileRules.CoastDrag));
		let travelled = 0;
		for (let age = 1 + STEP / 2; age < 5; age += STEP) travelled += MissileRules.SpeedAt(profile, age) * STEP;
		expect(math.abs(MissileRules.Travel(profile, 1, 4) - travelled) < 1).toBe(true);
	});
	it("stays dark for a missile that will miss anyway and for one that has lost its lock", () => {
		const profile = MissileRules.Profile("easy", 1);
		// A long tail shot at a jet running at full throttle: the missile burns out before it arrives.
		const jet: FlightState = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 320 };
		const run = { x: 0, y: 0, throttle: 1 };
		const missile = MissileRules.Launch({ x: 0, y: 400, z: 1300 }, { x: 0, y: 0, z: -1 }, profile);
		expect(MissileRules.Misses(missile, profile, jet, run)).toBe(true);
		expect(MissileRules.BreakCue(missile, profile, jet, run)).toBe(undefined);
		missile.locked = false;
		expect(MissileRules.BreakCue(missile, profile, jet, run)).toBe(undefined);
	});
	it("holds a point-blank shot but takes a fair one", () => {
		const profile = MissileRules.Profile("normal", 3);
		const jet = { position: { x: 0, y: 400, z: 0 }, velocity: { x: 0, y: 0, z: -250 } };
		// Head-on, closing at ~535 studs/s: clear at 2000 studs now, not after a 1.7 s windup.
		const from = { x: 0, y: 400, z: -2000 }, velocity = { x: 0, y: 0, z: 285 };
		expect(MissileRules.ShotClear(from, velocity, jet, profile)).toBe(true);
		expect(MissileRules.ShotClear(from, velocity, jet, profile, 1.7)).toBe(false);
		// A tail shot closes at 620 - 250 = 370 studs/s: 450 studs is 1.2 s (held), 800 studs 2.2 s (taken).
		const chase = { x: 0, y: 0, z: -275 };
		expect(MissileRules.ShotClear({ x: 0, y: 400, z: 450 }, chase, jet, profile)).toBe(false);
		expect(MissileRules.ShotClear({ x: 0, y: 400, z: 800 }, chase, jet, profile)).toBe(true);
		// From the standoff the shot is fair now; a chaser at 350 (100 studs/s of closure) for a 1.7 s windup would end inside it.
		const standoff = MissileRules.Standoff(profile, 250, 0.3);
		expect(MissileRules.ShotClear({ x: 0, y: 400, z: standoff }, { x: 0, y: 0, z: -250 }, jet, profile, 1.7)).toBe(true);
		expect(MissileRules.ChaseClear({ x: 0, y: 400, z: standoff }, 350, jet, profile, 1.7)).toBe(false);
		expect(MissileRules.ChaseClear({ x: 0, y: 400, z: standoff + 300 }, 350, jet, profile, 1.7)).toBe(true);
	});
});
