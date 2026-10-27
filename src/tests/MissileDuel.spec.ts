import { describe, expect, it } from "@rbxts/jest-globals";
import { DifficultyKind } from "../shared/Difficulty";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { GuidedMissile, MissileEvent, MissileProfile, MissileRules } from "../shared/MissileRules";
import { BreakCueState, FlightInput } from "../shared/Types";
import { DuelResult, DuelSetup, MissileDuel } from "./MissileDuel";

// Closed-loop dodge contracts: the real flight model against real missiles, fired through the
// bandit fire gate the way CombatService fires them and cued the way the HUD shows BREAK / HOLD /
// CLEAR (see MissileDuel). Also runs in the offline Luau VM (toBe only). docs/flight-mechanics.md has
// the table.
//
// Every act and level flies the same grid: a bandit starting its windup at every 30 degrees around
// the jet, at six ranges across the act's fire range, at two telemetry phases, against a pilot
// circling at cruise. The cue pilot breaks on BREAK, pulls while HOLD shows and lets go after CLEAR;
// a single hit on it is a broken promise, so every grid requires zero, not a dodge percentage, for
// every release delay sampled after CLEAR (0, 0.1, ... 2 s) and for a pilot who never lets go.

/** CombatService.TUNING.fireRange by act. */
const FIRE_RANGE = [[450, 1700], [400, 1900], [350, 2100]];
/** How long before the cue pilot's break the "too early" break starts. */
const EARLY = 0.7;
/** The 10 Hz telemetry clock's offset from launch: on the step, and halfway between. */
const PHASES = [0, 0.05];
/** Release delays after CLEAR, in 0.1 s telemetry ticks (0 is the cue pilot's own run). */
const DELAY_TICKS = 20;
/** Letting go during HOLD is replayed at every this-many-th HOLD sample (0.3 s apart). */
const HOLD_SAMPLE = 3;

const STEP = MissileRules.StepSeconds;
const REACTION_STEPS = math.floor(MissileRules.CueReaction / STEP + 0.5);
const NEUTRAL: FlightInput = { x: 0, y: 0, throttle: 1 };

interface Tally {
	shots: number;
	/** Ignored missiles that hit, and of those how many showed BREAK at least once. */
	hits: number; cuedHits: number;
	/** Shots where the cue pilot broke on BREAK, and how many of those were hit letting go on CLEAR, or never letting go (both must be 0). */
	breaks: number; failed: number; sustainedFailed: number;
	/** Of those breaks, the ones where CLEAR showed before the missile was gone, and the replays letting go 0.1-2 s after it, and how many were hit (must be 0). */
	cleared: number; delayed: number; delayedFailed: number;
	/**
	 * Breaks that showed HOLD; replays letting go at a HOLD sample (a reaction later), and how many
	 * were hit, also split for the samples within the last second before CLEAR.
	 */
	holds: number; holdReleases: number; holdReleaseHits: number; lateReleases: number; lateReleaseHits: number;
	/** Seconds from the break to CLEAR (sum and longest), over `cleared`. */
	holdSeconds: number; longestHold: number;
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
	const tally: Tally = {
		shots: 0, hits: 0, cuedHits: 0, breaks: 0, failed: 0, sustainedFailed: 0, cleared: 0, delayed: 0, delayedFailed: 0,
		holds: 0, holdReleases: 0, holdReleaseHits: 0, lateReleases: 0, lateReleaseHits: 0, holdSeconds: 0, longestHold: 0, early: 0, earlyHit: 0, runs: 0, runHits: 0,
	};
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
				const sustained = MissileDuel.Fly({ ...setup, pilot: "cue", hold: math.huge });
				if (sustained.event === "hit") tally.sustainedFailed += 1;
				// Replays of the same pull (the cue is deterministic, and a pilot pulling shows the same cue until it lets go).
				const replay = (releaseStep: number) => MissileDuel.Fly({
					...setup, pilot: "timed", breakStep: sustained.breakStep, breakX: cued.cueStick, releaseStep, release: NEUTRAL, cue: false,
				}).event === "hit";
				if (sustained.holdSteps.size() > 0) tally.holds += 1;
				sustained.holdSteps.forEach((hold, index) => {
					if (index % HOLD_SAMPLE !== 0) return;
					const late = sustained.clearStep !== undefined && sustained.clearStep - hold <= 30;
					const hit = replay(hold + 1 + REACTION_STEPS);
					tally.holdReleases += 1;
					if (hit) tally.holdReleaseHits += 1;
					if (late) { tally.lateReleases += 1; if (hit) tally.lateReleaseHits += 1; }
				});
				if (sustained.clearStep !== undefined) {
					tally.cleared += 1;
					const seconds = (sustained.clearStep + 1 - sustained.breakStep!) * STEP;
					tally.holdSeconds += seconds; tally.longestHold = math.max(tally.longestHold, seconds);
					for (let tick = 1; tick <= DELAY_TICKS; tick++) {
						tally.delayed += 1;
						if (replay(sustained.clearStep + 1 + REACTION_STEPS + tick * 3)) tally.delayedFailed += 1;
					}
				}
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
	if (PRINT_GRID) print(`[duel] ${key} shots=${tally.shots} hit=${rate(tally.hits, tally.shots)} shown=${rate(tally.cuedHits, tally.hits)} breaks=${tally.breaks} failed=${tally.failed} sustained=${tally.sustainedFailed} cleared=${tally.cleared} delayed=${tally.delayed}/${tally.delayedFailed} holds=${tally.holds} holdRel=${tally.holdReleases}/${tally.holdReleaseHits} late=${tally.lateReleases}/${tally.lateReleaseHits} meanHold=${rate(tally.holdSeconds, tally.cleared)} longest=${tally.longestHold} early=${tally.early}/${tally.earlyHit} run=${tally.runs}/${tally.runHits}`);
	return tally;
}
/** Print the tallies (docs/flight-mechanics.md tables). */
const PRINT_GRID = false;
function rate(part: number, whole: number): number { return whole > 0 ? part / whole : 0; }

function range(m: GuidedMissile, jet: FlightState): number { return math.sqrt((m.position.x - jet.x) ** 2 + (m.position.y - jet.y) ** 2 + (m.position.z - jet.z) ** 2); }
function copyJet(jet: FlightState): FlightState { return { x: jet.x, y: jet.y, z: jet.z, yaw: jet.yaw, pitch: jet.pitch, roll: jet.roll, speed: jet.speed }; }
function copyMissile(m: GuidedMissile): GuidedMissile { return { position: m.position, direction: m.direction, speed: m.speed, age: m.age, locked: m.locked }; }
/**
 * Flies the break BreakCue checks (or no break) to the very end with MissileRules.Step alone: no
 * early exits, so a blind missile's fuse gets every chance to catch the jet.
 */
function flown(missile: GuidedMissile, profile: MissileProfile, jet: FlightState, input: FlightInput, stick?: number): MissileEvent {
	const m = copyMissile(missile), state = copyJet(jet);
	const pull: FlightInput = { x: stick ?? 0, y: MissileRules.BreakPull, throttle: 1 };
	for (let step = 0; step < 15 * 30; step++) {
		FlightMath.Step(state, stick !== undefined && step >= REACTION_STEPS ? pull : input, STEP);
		const event = MissileRules.Step(m, profile, MissileRules.JetTarget(state), STEP).event;
		if (event !== "flying") return event;
	}
	return "flying";
}

/** A fair open-sky shot from a review, launched straight at a jet flying `base`. */
interface Reproduction { level: DifficultyKind; act: number; speed: number; bearing: number; range: number; base?: FlightInput }
/**
 * The re-review's reproductions (Sol, 2a1dc51): the old prediction called the break safe once the
 * seeker let go, but the blind missile flew on and its fuse caught the jet as the break carried it
 * back across its path (Easy I hit at 3.47 s, Normal III at 6.27 s). Each runs on both sides.
 */
const REPRODUCTIONS: Reproduction[] = [
	{ level: "easy", act: 1, speed: 320, bearing: 60, range: 1100 },
	{ level: "normal", act: 3, speed: 285, bearing: 120, range: 1500 },
];
/**
 * The re-check of 4b09507 (Sol): BREAK's turn escaped letting go after exactly 1.5 s or never, but
 * letting go after 1.6 s was hit at 2.53 s (Normal I, the cruise-circle pilot at 232.5 studs/s,
 * bearing 330 degrees, 1400 studs); Easy I at 320, bearing 30 degrees, after 1.5667 s.
 */
const RELEASE_REPRODUCTIONS: Reproduction[] = [
	{ level: "normal", act: 1, speed: 232.5, bearing: 330, range: 1400, base: { x: -0.35, y: 0, throttle: 0.65 } },
	{ level: "easy", act: 1, speed: 320, bearing: 30, range: 1400 },
];
interface Replay {
	cues: number; event: MissileEvent; unsound: number; checked: number;
	/** The cue on the last telemetry sample before the pilot let go (undefined: none, or never let go). */
	atRelease?: BreakCueState;
	/** Every cue state shown after the first BREAK. */
	states: BreakCueState[];
}
/**
 * Telemetry at 10 Hz (phase 0.05). The pilot answers each BREAK a reaction later with the cued pull,
 * then lets go after `hold` seconds when given (back to `base`), else a reaction after CLEAR
 * (to neutral, at full power).
 */
function replay(r: Reproduction, side: number, hold?: number): Replay {
	const profile = MissileRules.Profile(r.level, r.act);
	const jet: FlightState = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed: r.speed };
	const base: FlightInput = r.base ?? { x: 0, y: 0, throttle: (r.speed - FlightMath.MinSpeed) / (FlightMath.MaxSpeed - FlightMath.MinSpeed) };
	const angle = math.rad(r.bearing * side);
	const from = { x: math.sin(angle) * r.range, y: 400, z: -math.cos(angle) * r.range };
	expect(MissileRules.ShotClear(from, { x: 0, y: 0, z: 0 }, MissileRules.JetTarget(jet), profile)).toBe(true);
	const missile = MissileRules.Launch(from, MissileRules.LaunchHeading(from, profile, MissileRules.JetTarget(jet)), profile);
	const result: Replay = { cues: 0, event: "flying", unsound: 0, checked: 0, states: [] };
	const track = MissileRules.NewTrack();
	let clock = 0.05, pendingStep: number | undefined, pendingX = 0, pullUntil = -1, pullX = 0, released = false;
	let last: BreakCueState | undefined;
	for (let step = 0; step < 15 * 30; step++) {
		if (pendingStep !== undefined && step >= pendingStep) {
			pullUntil = hold !== undefined ? step + math.floor(hold / STEP + 0.5) : math.huge; pullX = pendingX; pendingStep = undefined; released = false;
		}
		if (step === pullUntil) { released = true; result.atRelease = last; }
		const input = step < pullUntil ? { x: pullX, y: MissileRules.BreakPull, throttle: 1 } : released && hold === undefined ? NEUTRAL : base;
		FlightMath.Step(jet, input, STEP);
		result.event = MissileRules.Step(missile, profile, MissileRules.JetTarget(jet), STEP).event;
		if (result.event !== "flying") return result;
		clock += STEP;
		if (clock < 0.1 - 1e-9) continue;
		clock -= 0.1;
		// Soundness at every sample: whenever the prediction calls a break safe, flying it to the end agrees.
		for (const stick of [-1, 1]) {
			if (!MissileRules.Misses(missile, profile, jet, input, MissileRules.CueReaction, stick)) continue;
			result.checked += 1;
			if (flown(missile, profile, jet, input, stick) === "hit") result.unsound += 1;
		}
		const urgent = missile.locked && range(missile, jet) < 1800 ? { missile, profile } : undefined;
		const cue = MissileRules.CueTick(track, (step + 1) * STEP, jet, input, urgent, true);
		last = cue?.state;
		if (cue === undefined) continue;
		if (result.cues > 0 || cue.state === "break") result.states.push(cue.state);
		if (cue.state === "clear" && hold === undefined && step + 1 < pullUntil && pullUntil === math.huge) pullUntil = step + 1 + REACTION_STEPS;
		if (cue.state !== "break") continue;
		result.cues += 1;
		if (pendingStep === undefined && step + 1 >= pullUntil) { pendingStep = step + 1 + REACTION_STEPS; pendingX = cue.stick; }
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
			expect(t.cleared > 0).toBe(true);
			expect(t.delayedFailed).toBe(0);
			// HOLD means something: letting go while it shows can still be hit.
			expect(t.holdReleaseHits > 0).toBe(true);
		}
	});
	it("Easy: a break flown as cued never loses, a tail shot can be outrun, and an ignored missile still hits", () => {
		for (const act of [1, 2, 3]) {
			const t = grid("easy", act);
			expect(t.breaks > 0).toBe(true);
			expect(t.failed).toBe(0);
			expect(t.sustainedFailed).toBe(0);
			expect(t.cleared > 0).toBe(true);
			expect(t.delayedFailed).toBe(0);
			// HOLD means something: letting go while it shows can still be hit.
			expect(t.holdReleaseHits > 0).toBe(true);
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
			expect(t.cleared > 0).toBe(true);
			expect(t.delayedFailed).toBe(0);
			// HOLD means something: letting go while it shows can still be hit.
			expect(t.holdReleaseHits > 0).toBe(true);
			early += t.early; earlyHit += t.earlyHit;
		}
		expect(early >= 10).toBe(true);
		expect(rate(earlyHit, early) >= 0.75).toBe(true);
	});
	it("keeps CLEAR's promise off the grid: any bearing, range, phase and speed, any release step and stick after it", () => {
		// Its own LCG, so Studio and the offline Luau VM draw the same shots.
		let seed = 424242;
		const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
		let breaks = 0, sustainedHits = 0, cleared = 0, releases = 0, hits = 0;
		for (const level of ["easy", "normal", "ace"] as DifficultyKind[]) for (let shot = 0; shot < 60; shot++) {
			const act = 1 + math.floor(random() * 3);
			const [low, high] = FIRE_RANGE[act - 1];
			const setup: DuelSetup = {
				level, act, bearing: random() * 360, range: low + random() * (high - low), phase: random() * 0.1,
				throttle: 0.3 + random() * 0.7, pilot: "cue", hold: math.huge,
			};
			const sustained = MissileDuel.Fly(setup);
			if (sustained.breakStep === undefined) continue;
			// A break taken on BREAK and never let go wins (BREAK's own promise, off the grid).
			breaks += 1;
			if (sustained.event === "hit") sustainedHits += 1;
			if (sustained.clearStep === undefined) continue;
			cleared += 1;
			for (let release = 0; release < 3; release++) {
				releases += 1;
				const releaseStep = sustained.clearStep + 1 + REACTION_STEPS + math.floor(random() * 61);
				const stick: FlightInput = { x: random() * 2 - 1, y: random() * 1.5 - 0.5, throttle: random() };
				const flown = MissileDuel.Fly({ ...setup, pilot: "timed", breakStep: sustained.breakStep, breakX: sustained.cueStick, releaseStep, release: stick, cue: false });
				if (flown.event === "hit") hits += 1;
			}
		}
		if (PRINT_GRID) print(`[offgrid] breaks=${breaks} sustainedHits=${sustainedHits} cleared=${cleared} releases=${releases} hits=${hits}`);
		expect(sustainedHits).toBe(0);
		expect(cleared >= 20).toBe(true);
		expect(hits).toBe(0);
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
			const result = replay(r, side);
			expect(result.checked > 0).toBe(true);
			expect(result.unsound).toBe(0);
			expect(result.cues > 0).toBe(true);
			expect(result.event === "hit").toBe(false);
		}
	});
	it("cues the release: HOLD while letting go would lose, then CLEAR (the re-check's 1.6 s reproductions)", () => {
		for (const r of RELEASE_REPRODUCTIONS) for (const side of [1, -1]) {
			// Letting go after 1.6 s, as the re-check did: the cue still said HOLD.
			const early = replay(r, side, 1.6);
			if (PRINT_GRID) print(`[release] ${r.level}${r.act} side ${side}: 1.6 s ${early.event} at ${early.atRelease} (${early.states.join(" ")})`);
			expect(early.atRelease).toBe("hold");
			// Pulling through HOLD and letting go on CLEAR escapes, and the cue went BREAK, HOLD, CLEAR in that order.
			const cued = replay(r, side);
			if (PRINT_GRID) print(`[release] ${r.level}${r.act} side ${side}: cued ${cued.event} (${cued.states.join(" ")})`);
			expect(cued.event === "hit").toBe(false);
			expect(cued.unsound).toBe(0);
			expect(cued.states[0]).toBe("break");
			expect(cued.states.includes("hold")).toBe(true);
			expect(cued.states.includes("clear")).toBe(true);
			expect(cued.states.indexOf("hold") < cued.states.indexOf("clear")).toBe(true);
		}
		// The Normal case is hit letting go at 1.6 s on the first side, as reported.
		expect(replay(RELEASE_REPRODUCTIONS[0], 1, 1.6).event).toBe("hit");
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
