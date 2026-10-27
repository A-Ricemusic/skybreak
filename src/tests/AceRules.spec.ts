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
	it("a hit while the ace retreats cannot start the next stage before it has called its wing", () => {
		// M9: 300 hull, crossed 2/3 into a retreat; a 110-damage lance hit lands 3.1 s later, out of invulnerability.
		const state = AceRules.New();
		expect(AceRules.Cross(state, 300, 230, 200, 0, true)).toBe(true);
		expect(AceRules.Step(state, 3.1, 900, 0)).toBeUndefined();
		expect(AceRules.Invulnerable(state, 3.1)).toBe(false);
		let health = 200;
		const damage = AceRules.CapHit(state, health, 300, 110);
		expect(damage).toBe(99);
		health -= damage;
		expect(AceRules.Cross(state, 300, 200, health, 3.1, true)).toBe(false);
		// Even a raw crossing is refused mid-sequence: the retreat is never overwritten.
		expect(AceRules.Cross(state, 300, 101, 50, 3.2, true)).toBe(false);
		expect(state.stage).toBe(1);
		expect(state.mode).toBe("retreat");
		expect(AceRules.CapHit(state, health, 300, 55)).toBe(0);
		// The stage plays out: it calls the wing, holds and turns back in, and only then can stage two start.
		expect(AceRules.Step(state, 1, 1900, 0)).toBe("called");
		expect(AceRules.CapHit(state, health, 300, 55)).toBe(0);
		expect(AceRules.Step(state, AceRules.HoldMinSeconds, 2000, 0)).toBe("returned");
		const crossing = AceRules.CapHit(state, health, 300, 55);
		expect(crossing).toBe(1);
		expect(AceRules.Cross(state, 300, health, health - crossing, 20, true)).toBe(true);
		expect(state.stage).toBe(2);
		expect(state.mode).toBe("retreat");
	});
	it("a hit while the ace holds in its last stage cannot kill it before it turns back in", () => {
		const state = AceRules.New();
		AceRules.Cross(state, 300, 210, 200, 0, true);
		AceRules.Step(state, 10, 2000, 0);
		AceRules.Step(state, AceRules.HoldMaxSeconds, 2000, 2);
		expect(AceRules.Cross(state, 300, 110, 100, 40, true)).toBe(true);
		expect(AceRules.Step(state, 1, 1900, 0)).toBe("called");
		expect(state.mode).toBe("hold");
		// Last stage: no line left, but the hold still ends in a return before the kill.
		let health = 100;
		for (let hit = 0; hit < 4; hit++) health -= AceRules.CapHit(state, health, 300, 55);
		expect(health).toBe(1);
		expect(AceRules.Cross(state, 300, 45, 1, 45, true)).toBe(false);
		expect(AceRules.Step(state, AceRules.HoldMinSeconds, 2000, 0)).toBe("returned");
		expect(AceRules.CapHit(state, health, 300, 55)).toBe(55);
	});
	it("a fighting ace takes the ordinary capped hit", () => {
		const state = AceRules.New();
		expect(AceRules.CapHit(state, 220, 300, 55)).toBe(20);
		expect(AceRules.CapHit(state, 300, 300, 55)).toBe(55);
		// An ace with no wing to call stays in the fight at the line, so hits keep landing in full.
		AceRules.Cross(state, 165, 165, 110, 0, false);
		expect(AceRules.CapHit(state, 110, 165, 55)).toBe(55);
	});
	it("is hurtable only when a hit would take health: not while immune or held at a stage floor", () => {
		const state = AceRules.New();
		expect(AceRules.CanHurt(state, 165, 165, 0)).toBe(true);
		// Crossing 110 at elapsed 10: immune for three seconds, hittable again after.
		AceRules.Cross(state, 165, 120, 110, 10, true);
		expect(AceRules.CanHurt(state, 110, 165, 11)).toBe(false);
		expect(AceRules.CapHit(state, 110, 165, 40)).toBeGreaterThan(0);
		expect(AceRules.CanHurt(state, 110, 165, 13)).toBe(true);
		// Retreating above the floor (55 + 1) it still takes damage; at the floor it takes none.
		expect(AceRules.CanHurt(state, 75, 165, 20)).toBe(true);
		expect(AceRules.CapHit(state, 75, 165, 40)).toBe(19);
		expect(AceRules.CanHurt(state, 56, 165, 20)).toBe(false);
		expect(AceRules.CapHit(state, 56, 165, 40)).toBe(0);
		AceRules.Step(state, 11, 0, 3);
		expect(state.mode).toBe("hold");
		expect(AceRules.CanHurt(state, 56, 165, 31)).toBe(false);
		// Turning back in, the same health is hittable again.
		AceRules.Step(state, 25, 0, 0);
		expect(state.mode).toBe("fight");
		expect(AceRules.CanHurt(state, 56, 165, 56)).toBe(true);
		// Last stage, held: its final point is protected until it returns.
		const last = { stage: 2, mode: "hold" as const, modeTime: 0, invulnerableUntil: 0 };
		expect(AceRules.CanHurt(last, 1, 165, 100)).toBe(false);
		expect(AceRules.CanHurt(last, 2, 165, 100)).toBe(true);
		expect(AceRules.CanHurt({ ...last, mode: "fight" }, 1, 165, 100)).toBe(true);
	});
});
