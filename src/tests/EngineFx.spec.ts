import { describe, expect, it } from "@rbxts/jest-globals";
import { EngineFx } from "../shared/EngineFx";

describe("EngineFx afterburner and vapor curves", () => {
	it("keeps the afterburner out at cruise throttle and full at max", () => {
		expect(EngineFx.Intensity(0)).toBe(0);
		expect(EngineFx.Intensity(EngineFx.AfterburnerStart)).toBe(0);
		expect(EngineFx.Intensity(1)).toBe(1);
		expect(EngineFx.Intensity(1.5)).toBe(1);
		expect(EngineFx.Intensity(0 / 0)).toBe(0);
		expect(EngineFx.Intensity(0.65) > 0 && EngineFx.Intensity(0.65) < 0.5).toBe(true);
		let previous = -1;
		for (let throttle = 0; throttle <= 1; throttle += 0.05) {
			const value = EngineFx.Intensity(throttle);
			expect(value >= previous).toBe(true);
			previous = value;
		}
	});
	it("grows every part of the exhaust from idle to max", () => {
		const idle = EngineFx.Look(0);
		const full = EngineFx.Look(1);
		expect(full.flameRate > idle.flameRate).toBe(true);
		expect(full.flameSpeed > idle.flameSpeed).toBe(true);
		expect(full.flameSize > idle.flameSize).toBe(true);
		expect(full.glowSize > idle.glowSize).toBe(true);
		expect(full.lightBrightness > idle.lightBrightness).toBe(true);
		expect(full.trailLifetime > idle.trailLifetime).toBe(true);
		// Mobile budget: flame particles alive at once stay small, trails stay short.
		expect(full.flameRate <= 60).toBe(true);
		expect(full.trailLifetime <= 0.7).toBe(true);
		expect(EngineFx.Look(2).flameRate).toBe(full.flameRate);
	});
	it("spools up faster than it winds down", () => {
		expect(EngineFx.Spool(0, 1, 0.125)).toBe(0.5);
		expect(EngineFx.Spool(1, 0, 0.5)).toBe(0.25);
		expect(EngineFx.Spool(0.5, 0.52, 0.1)).toBe(0.52);
	});
	it("only shows vapor in hard pulls at fighting speed", () => {
		expect(EngineFx.VaporRate(0.5, 320)).toBe(0);
		expect(EngineFx.VaporRate(1, 150)).toBe(0);
		expect(EngineFx.VaporRate(1, 300)).toBe(36);
		expect(EngineFx.VaporRate(-1, 300)).toBe(36);
		expect(EngineFx.VaporRate(0.85, 300) > 0).toBe(true);
	});
	it("quantizes to twentieths", () => {
		expect(EngineFx.Quantize(0.51)).toBe(0.5);
		expect(EngineFx.Quantize(0.53)).toBe(0.55);
		expect(EngineFx.Quantize(3)).toBe(1);
	});
});
