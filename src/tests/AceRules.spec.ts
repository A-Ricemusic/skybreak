import { describe, expect, it } from "@rbxts/jest-globals";
import { AceRules } from "../shared/AceRules";

// Pure ace stage contracts; also run in the offline Luau VM (toBe/toBeUndefined only).
describe("Ace stages", () => {
	it("splits the fight at 2/3 and 1/3 and caps a hit at the next line", () => {
		expect(AceRules.StageLine(300, 0)).toBe(200);
		expect(AceRules.StageLine(300, 1)).toBe(100);
		expect(AceRules.StageLine(300, 2)).toBe(-1);
		expect(AceRules.CapDamage(220, 300, 0, 55)).toBe(20);
		expect(AceRules.CapDamage(300, 300, 0, 55)).toBe(55);
		expect(AceRules.CapDamage(60, 300, 2, 55)).toBe(55);
	});
	it("needs three stages of hits: 500 hull at 55 a missile is twelve hits, not ten", () => {
		const state = AceRules.New();
		let health = 500, hits = 0, now = 0;
		while (health > 0 && hits < 50) {
			now += 5; // every hit lands after any invulnerability has ended
			const damage = AceRules.CapDamage(health, 500, state.stage, 55);
			const before = health;
			health -= damage; hits += 1;
			AceRules.Cross(state, 500, before, health, now, false);
		}
		expect(hits).toBe(12);
		expect(state.stage).toBe(2);
	});
	it("crossing a line advances the stage once, with 3 s of invulnerability", () => {
		const state = AceRules.New();
		expect(AceRules.Cross(state, 300, 250, 210, 10, true)).toBe(false);
		expect(AceRules.Cross(state, 300, 210, 200, 10, true)).toBe(true);
		expect(state.stage).toBe(1);
		expect(AceRules.Invulnerable(state, 12.9)).toBe(true);
		expect(AceRules.Invulnerable(state, 13)).toBe(false);
		expect(state.mode).toBe("retreat");
		expect(AceRules.Fights(state)).toBe(false);
		// The same line does not fire twice.
		expect(AceRules.Cross(state, 300, 200, 190, 11, true)).toBe(false);
	});
	it("retreats past 1800 studs, calls its wing, holds while they fight, then turns back in", () => {
		const state = AceRules.New();
		AceRules.Cross(state, 400, 300, 260, 0, true);
		expect(AceRules.Step(state, 1, 1500, 0)).toBeUndefined();
		expect(AceRules.Step(state, 1, 1801, 0)).toBe("called");
		expect(state.mode).toBe("hold");
		expect(AceRules.Step(state, 5, 2100, 2)).toBeUndefined();
		// Wing still up: the ace keeps holding until they are down (after the minimum hold).
		expect(AceRules.Step(state, 1, 2100, 1)).toBeUndefined();
		expect(AceRules.Step(state, 1, 2100, 0)).toBe("returned");
		expect(AceRules.Fights(state)).toBe(true);
	});
	it("never stalls: a retreat ends after 10 s and a hold after 25 s whatever happens", () => {
		const state = AceRules.New();
		AceRules.Cross(state, 300, 250, 190, 0, true);
		let event: string | undefined;
		for (let t = 0; t < 10.05 && event === undefined; t += 0.1) event = AceRules.Step(state, 0.1, 500, 0);
		expect(event).toBe("called");
		event = undefined;
		let held = 0;
		while (event === undefined && held < 30) { held += 0.1; event = AceRules.Step(state, 0.1, 2000, 3); }
		expect(event).toBe("returned");
		expect(math.abs(held - AceRules.HoldMaxSeconds) < 0.2).toBe(true);
	});
	it("stays in the fight at a stage line when it has no wing to call", () => {
		const state = AceRules.New();
		expect(AceRules.Cross(state, 165, 165, 100, 0, false)).toBe(true);
		expect(state.mode).toBe("fight");
		expect(AceRules.Step(state, 1, 3000, 0)).toBeUndefined();
	});
	it("splits a phase's raiders between the two calls, the larger half first", () => {
		expect(AceRules.RaidersForStage(4, 1)).toBe(2);
		expect(AceRules.RaidersForStage(4, 2)).toBe(2);
		expect(AceRules.RaidersForStage(3, 1)).toBe(2);
		expect(AceRules.RaidersForStage(3, 2)).toBe(1);
		expect(AceRules.RaidersForStage(1, 2)).toBe(0);
		expect(AceRules.RaidersForStage(0, 1)).toBe(0);
	});
});
