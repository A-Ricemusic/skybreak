import { describe, expect, it } from "@rbxts/jest-globals";
import { DifficultyKind } from "../shared/Difficulty";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { MissileRules } from "../shared/MissileRules";
import { DuelResult, DuelSetup, MissileDuel } from "./MissileDuel";

// Closed-loop dodge contracts: the real flight model against real missiles, fired through the
// bandit fire gate the way CombatService fires them and cued the way the HUD shows BREAK (see
// MissileDuel). Also runs in the offline Luau VM (toBe only). docs/flight-mechanics.md has the table.
//
// Every act and level flies the same grid: a bandit starting its windup at every 30 degrees around
// the jet, at six ranges across the act's fire range, against a pilot circling at cruise.

/** CombatService.TUNING.fireRange by act. */
const FIRE_RANGE = [[450, 1700], [400, 1900], [350, 2100]];
/** How long before the cue pilot's break the "too early" break starts. */
const EARLY = 0.7;

interface Tally {
	shots: number;
	/** Ignored missiles that hit, and of those how many showed BREAK at least once. */
	hits: number; cuedHits: number;
	/** Shots where the cue pilot broke, and how many of those it dodged. */
	breaks: number; dodged: number;
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
	const tally: Tally = { shots: 0, hits: 0, cuedHits: 0, breaks: 0, dodged: 0, early: 0, earlyHit: 0, runs: 0, runHits: 0 };
	const [low, high] = FIRE_RANGE[act - 1];
	for (let bearing = 0; bearing < 360; bearing += 30) {
		for (let step = 0; step <= 5; step++) {
			const range = low + 50 + (high - low - 100) * step / 5;
			const setup: DuelSetup = { level, act, bearing, range, pilot: "ignore" };
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
				if (cued.event !== "hit") tally.dodged += 1;
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

describe("Missile dodging, closed loop", () => {
	it("Normal: ignored missiles hit, BREAK shows for nearly every one, and a break on BREAK dodges", () => {
		for (const act of [1, 2, 3]) {
			const t = grid("normal", act);
			expect(t.shots >= 20).toBe(true);
			expect(rate(t.hits, t.shots) >= 0.85).toBe(true);
			expect(rate(t.cuedHits, t.hits) >= 0.9).toBe(true);
			expect(rate(t.dodged, t.breaks) >= 0.7).toBe(true);
		}
	});
	it("Easy: a break on BREAK dodges, a tail shot can be outrun, and an ignored missile still hits", () => {
		for (const act of [1, 2, 3]) {
			const t = grid("easy", act);
			expect(rate(t.dodged, t.breaks) >= 0.85).toBe(true);
			expect(rate(t.runs - t.runHits, t.runs) >= 0.4).toBe(true);
			expect(rate(t.hits, t.shots) >= 0.5).toBe(true);
		}
	});
	it("Ace: a break timed on BREAK dodges, one started early is followed", () => {
		let early = 0, earlyHit = 0;
		for (const act of [1, 2, 3]) {
			const t = grid("ace", act);
			expect(rate(t.hits, t.shots) >= 0.85).toBe(true);
			// Of all the missiles that would hit, the share a pilot breaking on BREAK escapes.
			expect(rate(t.cuedHits, t.hits) * rate(t.dodged, t.breaks) >= 0.5).toBe(true);
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
