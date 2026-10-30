import { describe, expect, it } from "@rbxts/jest-globals";
import { ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { PHONE_SHARE, lightningGap, phoneClouds, weatherPlan } from "../shared/WeatherRules";

// Pure weather contracts; also run in the offline Luau VM.
describe("Mission weather", () => {
	it("resolves M04 clear-noon weather and phone clouds from its published world key", () => {
		expect(weatherPlan("m04_inland_hills",false,false)).toEqual({});
		expect(phoneClouds("m04_inland_hills",0.15,0.2)).toEqual({cover:0.15,density:0.18});
	});
	it("gives storms rain and lightning, dust and fog drift, and the aurora its sky", () => {
		for (const name of ["farm_storm", "ocean_storm"] as const) {
			const plan = weatherPlan(name, false, false);
			expect(plan.rain).toBeDefined();
			expect(plan.lightning).toBeDefined();
		}
		expect(weatherPlan("canyon_dusk", false, false).drift).toBeDefined();
		expect(weatherPlan("harbor_fog", false, false).drift).toBeDefined();
		expect(weatherPlan("relay_aurora", false, false).aurora).toBeDefined();
		expect(weatherPlan("canyon_noon", false, false).rain).toBeUndefined();
		expect(weatherPlan(undefined, false, false).rain).toBeUndefined();
	});
	it("keeps storms visible on phones at a clamped particle cost", () => {
		const desk = weatherPlan("ocean_storm", false, false), phone = weatherPlan("ocean_storm", true, false);
		expect(phone.rain!.rate).toBeGreaterThan(0);
		expect(phone.rain!.rate).toBeLessThanOrEqual(desk.rain!.rate * PHONE_SHARE + 0.001);
		expect(phone.rain!.rate).toBeLessThanOrEqual(220);
		expect(phone.lightning).toBeDefined();
		for (const name of ENVIRONMENT_NAMES) {
			const p = weatherPlan(name, true, false);
			if (p.drift) expect(p.drift.rate).toBeLessThanOrEqual(14);
			if (p.aurora) expect(p.aurora.segments).toBeLessThanOrEqual(12);
		}
	});
	it("keeps storm and fog cloud decks on phones but always clamps density", () => {
		expect(phoneClouds("farm_storm", 1, 0.3).cover).toBe(1);
		expect(phoneClouds("harbor_fog", 0.9, 0.3).cover).toBe(0.9);
		expect(phoneClouds("farm_storm", 1, 0.3).density).toBe(0.18);
		expect(phoneClouds("farm_morning", 0.4, 0.25).cover).toBe(0.25);
		expect(phoneClouds(undefined, 0.4, 0.25).cover).toBe(0.25);
	});
	it("softens lightning for reduced motion and spaces strikes", () => {
		const calm = weatherPlan("farm_storm", false, true).lightning!, full = weatherPlan("farm_storm", false, false).lightning!;
		expect(calm.flash).toBeLessThan(full.flash);
		expect(calm.flickers).toBe(1);
		expect(lightningGap(full, 0)).toBe(full.minGap);
		expect(lightningGap(full, 1)).toBe(full.maxGap);
		expect(full.minGap).toBeGreaterThanOrEqual(5);
	});
});
