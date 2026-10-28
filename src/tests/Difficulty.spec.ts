import { describe, expect, it } from "@rbxts/jest-globals";
import { Difficulty } from "../shared/Difficulty";

// Also runs in the offline Luau VM (tools/test-relay-offline.ts), whose assertions
// are limited to toBe and toBeUndefined.


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
		for (const knob of ["hostileDamage", "missileTurn", "aceHealth", "breakChance", "protectDrain"] as const) {
			expect(Difficulty.Multiplier("ace", knob) > 1).toBe(true);
			expect(Difficulty.Multiplier("easy", knob) < 1).toBe(true);
		}
		// Ace restores armor; Easy reduces the two-missile Normal hull.
		expect(Difficulty.Multiplier("ace", "banditHealth")).toBe(1.6);
		expect(Difficulty.Multiplier("easy", "banditHealth")).toBe(0.6);
		expect(Difficulty.Scale("easy", "banditHealth", 130) < 110).toBe(true);
		expect(Difficulty.Multiplier("easy", "hostileGate")).toBe(1.25);
		// Longer is gentler: fire gates and windups.
		for (const knob of ["hostileGate", "windup"] as const) {
			expect(Difficulty.Multiplier("ace", knob) < 1).toBe(true);
			expect(Difficulty.Multiplier("easy", knob) > 1).toBe(true);
		}
	});
	it("scales values proportionally and passes non-finite input through", () => {
		expect(Difficulty.Scale("ace", "hostileDamage", 10)).toBe(17.5);
		expect(Difficulty.Scale("easy", "hostileDamage", 10)).toBe(6);
		expect(Difficulty.Scale("easy", "hostileGate", 8)).toBe(10);
		expect(Difficulty.Scale("ace", "aceHealth", 100)).toBe(160);
		expect(Difficulty.Scale("ace", "hostileDamage", 0)).toBe(0);
		expect(Difficulty.Scale("ace", "hostileDamage", math.huge)).toBe(math.huge);
		const nan = Difficulty.Scale("ace", "hostileDamage", 0 / 0);
		expect(nan === nan).toBe(false);
	});
});

describe("Difficulty behaviour", () => {
	it("adds behaviour on Ace: every bandit breaks and flares, aces reload faster, one more raider a wave", () => {
		const ace = Difficulty.Behaviour("ace");
		expect(ace.banditsAlwaysBreak).toBe(true);
		expect(ace.banditFlares).toBe(1);
		expect(ace.aceSalvo).toBe(1);
		expect(ace.extraRaiders).toBe(1);
	});
	it("leaves Normal and Easy on the act tuning", () => {
		for (const kind of ["normal", "easy"] as const) {
			const behaviour = Difficulty.Behaviour(kind);
			expect(behaviour.banditsAlwaysBreak).toBe(false);
			expect(behaviour.banditFlares).toBe(0);
			expect(behaviour.aceSalvo).toBe(1);
			expect(behaviour.extraRaiders).toBe(0);
		}
		expect(Difficulty.Behaviour("bogus" as never).extraRaiders).toBe(0);
	});
});
