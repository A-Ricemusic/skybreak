import { describe, expect, it } from "@rbxts/jest-globals";
import { ExplosionFx } from "../shared/ExplosionFx";

describe("ExplosionFx sizing and caps", () => {
	it("grows from impacts to air kills to ground kills to aces", () => {
		const size = (kind: Parameters<typeof ExplosionFx.Profile>[0]) => ExplosionFx.Profile(kind).size;
		expect(size("missile") < size("hit")).toBe(true);
		expect(size("hit") < size("wreck")).toBe(true);
		expect(size("wreck") < size("air")).toBe(true);
		expect(size("air") < size("ground")).toBe(true);
		expect(size("ground") < size("ace")).toBe(true);
		expect(ExplosionFx.Profile("ace").fire > ExplosionFx.Profile("air").fire).toBe(true);
	});
	it("scales big targets within bounds and keeps particle bursts modest", () => {
		expect(ExplosionFx.Profile("ground", 2).size).toBe(ExplosionFx.Profile("ground").size * 2);
		expect(ExplosionFx.Profile("ground", 99).size).toBe(ExplosionFx.Profile("ground").size * 2.5);
		expect(ExplosionFx.Profile("hit", 0).size).toBe(ExplosionFx.Profile("hit").size * 0.5);
		for (const kind of ["air", "ace", "ground", "player", "missile", "hit", "wreck"] as const) {
			const profile = ExplosionFx.Profile(kind, 2.5);
			expect(profile.fire + profile.smoke + profile.sparks <= 90).toBe(true);
			expect(profile.size <= 110).toBe(true);
		}
	});
	it("only air kills leave wrecks and only ground kills leave scorches", () => {
		expect(ExplosionFx.Leaves("air")).toBe("wreck");
		expect(ExplosionFx.Leaves("ace")).toBe("wreck");
		expect(ExplosionFx.Leaves("ground")).toBe("scorch");
		expect(ExplosionFx.Leaves("player")).toBeUndefined();
		expect(ExplosionFx.Leaves("missile")).toBeUndefined();
	});
	it("validates packet kinds and evicts the oldest past each cap", () => {
		expect(ExplosionFx.IsKind("ace")).toBe(true);
		expect(ExplosionFx.IsKind("nuke")).toBe(false);
		expect(ExplosionFx.IsKind(3)).toBe(false);
		expect(ExplosionFx.Overflow(0, ExplosionFx.MaxWrecks)).toBe(0);
		expect(ExplosionFx.Overflow(ExplosionFx.MaxWrecks - 1, ExplosionFx.MaxWrecks)).toBe(0);
		expect(ExplosionFx.Overflow(ExplosionFx.MaxWrecks, ExplosionFx.MaxWrecks)).toBe(1);
		expect(ExplosionFx.Overflow(ExplosionFx.MaxWrecks + 2, ExplosionFx.MaxWrecks)).toBe(3);
		expect(ExplosionFx.MaxWrecks <= 4 && ExplosionFx.MaxExplosions <= 10).toBe(true);
		expect(ExplosionFx.WreckSeconds >= 2 && ExplosionFx.WreckSeconds <= 4).toBe(true);
	});
});
