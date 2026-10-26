import { describe, expect, it } from "@rbxts/jest-globals";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { MissileRules } from "../shared/MissileRules";
import { EngageResult, EngageSetup, EngageSim } from "./EngageSim";

// Launch cadence contracts: the real jet circling at cruise against shooters flying stepEnemies'
// pursuit and fire control (see EngageSim). Also runs in the offline Luau VM (toBe only).
// docs/flight-mechanics.md has the tables.
//
// The launch gate (MissileRules.ShotClear) used to starve the ace on Easy and Ace: sat about 600
// studs behind a turning jet it closed inside the shortest fair shot during every windup and held
// 85-90 of ~90 windups (0.1-0.5 launches a minute), so the HUD showed lock warnings with no missile.
// The ace now keeps a fair range through its windup, and a bandit does after a held shot.

const SECONDS = 240;
const SEEDS = [11, 23];
/** Ace launches per minute against the circling pilot, alone, by level. */
const ACE_RATE: { [D in DifficultyKind]: [number, number] } = { easy: [1.2, 2.0], normal: [2.5, 3.5], ace: [5, 6] };

function fly(setup: Omit<EngageSetup, "seed" | "seconds" | "pilot">): EngageResult[] {
	return SEEDS.map((seed) => EngageSim.Run({ ...setup, seed, seconds: SECONDS, pilot: "ignore" }));
}
function perMinute(results: EngageResult[]): number {
	let launches = 0;
	for (const result of results) launches += result.ace.launches;
	return launches / (SECONDS * results.size()) * 60;
}

describe("Engagement cadence, closed loop", () => {
	it("the ace fires at its level's rate in every act, and never lights an empty warning", () => {
		for (const level of Difficulty.Order) for (const act of [1, 2, 3]) {
			const results = fly({ level, act, bandits: 0, ace: true });
			const rate = perMinute(results);
			const [low, high] = ACE_RATE[level];
			expect(rate >= low && rate <= high).toBe(true);
			for (const result of results) expect(result.ace.held).toBe(0);
		}
	});
	it("keeps the ace's rate with its wing up", () => {
		for (const level of Difficulty.Order) {
			const rate = perMinute(fly({ level, act: 3, bandits: 2, ace: true }));
			const [low, high] = ACE_RATE[level];
			expect(rate >= low && rate <= high).toBe(true);
		}
	});
	it("never holds a bandit's shot more than twice in a row, and still launches most windups", () => {
		for (const level of Difficulty.Order) for (const act of [1, 2, 3]) {
			let windups = 0, launches = 0;
			for (const bandits of [1, 2, 4]) for (const result of fly({ level, act, bandits, ace: false })) {
				expect(result.bandits.heldRun <= 2).toBe(true);
				windups += result.bandits.windups;
				launches += result.bandits.launches;
			}
			expect(windups >= 20).toBe(true);
			expect(launches / windups >= 0.7).toBe(true);
		}
	});
	it("keeps the dodge guarantee: every launch gives at least the level's shortest shot", () => {
		for (const level of Difficulty.Order) for (const act of [1, 3]) {
			for (const result of fly({ level, act, bandits: 2, ace: true })) {
				expect(result.bandits.launches > 0 && result.ace.launches > 0).toBe(true);
				expect(result.bandits.shortest! >= MissileRules.Profile(level, act, false).minLaunch).toBe(true);
				expect(result.ace.shortest! >= MissileRules.Profile(level, act, true).minLaunch).toBe(true);
			}
		}
	});
});
