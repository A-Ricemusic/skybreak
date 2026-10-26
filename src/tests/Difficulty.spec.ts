import { describe, expect, it } from "@rbxts/jest-globals";
import { Difficulty } from "../shared/Difficulty";
import { MissionScore, ScoreInput } from "../shared/MissionScore";

// Also runs in the offline Luau VM (tools/test-relay-offline.ts), whose assertions
// are limited to toBe and toBeUndefined.

const perfect: ScoreInput = { won: true, airKills: 4, groundKills: 1, elapsed: 60, par: 120, missilesFired: 8, missileHits: 8, damageTaken: 0 };

describe("Difficulty catalog", () => {
	it("offers three levels in order with Normal as the default", () => {
		expect(Difficulty.Order.size()).toBe(3);
		expect(Difficulty.Order[0]).toBe("easy");
		expect(Difficulty.Order[1]).toBe("normal");
		expect(Difficulty.Order[2]).toBe("ace");
		expect(Difficulty.Default).toBe("normal");
		expect(Difficulty.IsKind(Difficulty.Default)).toBe(true);
	});
	it("accepts only the three level names", () => {
		expect(Difficulty.IsKind("easy")).toBe(true);
		expect(Difficulty.IsKind("ace")).toBe(true);
		expect(Difficulty.IsKind("hard")).toBe(false);
		expect(Difficulty.IsKind("")).toBe(false);
		expect(Difficulty.IsKind(2)).toBe(false);
		expect(Difficulty.IsKind(undefined)).toBe(false);
		expect(Difficulty.Coerce("ace")).toBe("ace");
		expect(Difficulty.Coerce("bogus")).toBe("normal");
		expect(Difficulty.Coerce(undefined)).toBe("normal");
	});
	it("names and describes every level briefly", () => {
		expect(Difficulty.All().size()).toBe(3);
		for (const definition of Difficulty.All()) {
			expect(Difficulty.Get(definition.kind).kind).toBe(definition.kind);
			expect(definition.name.size() > 0).toBe(true);
			expect(definition.short.size()).toBe(3);
			expect(definition.description.size() > 0 && definition.description.size() <= 100).toBe(true);
		}
	});
});

describe("Difficulty multipliers", () => {
	it("leaves every knob at 1 on Normal", () => {
		for (const knob of Difficulty.Knobs) {
			expect(Difficulty.Multiplier("normal", knob)).toBe(1);
			expect(Difficulty.Scale("normal", knob, 37.5)).toBe(37.5);
		}
	});
	it("makes Ace harsher and Easy gentler on every threat knob", () => {
		// Higher is harsher.
		for (const knob of ["hostileDamage", "missileTurn", "aceHealth", "banditHealth", "breakChance"] as const) {
			expect(Difficulty.Multiplier("ace", knob) > 1).toBe(true);
			expect(Difficulty.Multiplier("easy", knob) < 1).toBe(true);
		}
		// Longer is gentler: fire gates and windups.
		for (const knob of ["hostileGate", "windup"] as const) {
			expect(Difficulty.Multiplier("ace", knob) < 1).toBe(true);
			expect(Difficulty.Multiplier("easy", knob) > 1).toBe(true);
		}
	});
	it("scales values proportionally and passes non-finite input through", () => {
		expect(Difficulty.Scale("ace", "hostileDamage", 10)).toBe(14);
		expect(Difficulty.Scale("easy", "hostileDamage", 10)).toBe(6);
		expect(Difficulty.Scale("easy", "hostileGate", 8)).toBe(12);
		expect(Difficulty.Scale("ace", "aceHealth", 100)).toBe(130);
		expect(Difficulty.Scale("ace", "hostileDamage", 0)).toBe(0);
		expect(Difficulty.Scale("ace", "hostileDamage", math.huge)).toBe(math.huge);
		const nan = Difficulty.Scale("ace", "hostileDamage", 0 / 0);
		expect(nan === nan).toBe(false);
	});
});

describe("Difficulty and mission score", () => {
	it("pays a bonus on Ace, a penalty on Easy and leaves Normal and unknown levels alone", () => {
		const normal = MissionScore.Compute(perfect).score;
		expect(normal).toBe(5550);
		expect(MissionScore.Compute({ ...perfect, difficulty: "normal" }).score).toBe(normal);
		expect(MissionScore.Compute({ ...perfect, difficulty: "weird" }).score).toBe(normal);
		expect(MissionScore.Compute({ ...perfect, difficulty: "ace" }).score).toBe(math.floor(normal * 1.2));
		expect(MissionScore.Compute({ ...perfect, difficulty: "easy" }).score).toBe(math.floor(normal * 0.85));
	});
	it("never changes the rank or the rating", () => {
		for (const difficulty of Difficulty.Order) {
			const result = MissionScore.Compute({ ...perfect, difficulty });
			expect(result.rank).toBe("S");
			expect(result.rating).toBe(100);
			expect(MissionScore.Compute({ ...perfect, missileHits: 4, difficulty }).rank).toBe("A");
		}
	});
	it("scales the kill points of a failed sortie too", () => {
		expect(MissionScore.Compute({ ...perfect, won: false }).score).toBe(550);
		expect(MissionScore.Compute({ ...perfect, won: false, difficulty: "ace" }).score).toBe(660);
		expect(MissionScore.Compute({ ...perfect, won: false, difficulty: "easy" }).score).toBe(467);
	});
});
