import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog } from "../shared/MissionCatalog";
import { ENVIRONMENTS as Env, ENVIRONMENT_NAMES, distinctChannels, lampsOn } from "../shared/EnvironmentPresets";

// Pure environment-table contracts; also run in the offline Luau VM.
describe("Environment presets", () => {
	it("has one entry per preset and covers every mission's environment", () => {
		expect(ENVIRONMENT_NAMES.size()).toBe(18);
		for (const name of ENVIRONMENT_NAMES) expect(Env[name]).toBeDefined();
		for (const bp of MissionCatalog.All()) expect(Env[bp.environment]).toBeDefined();
	});
	it("keeps every pair of presets visibly distinct", () => {
		const failures: string[] = [];
		for (let i = 0; i < ENVIRONMENT_NAMES.size(); i++) for (let j = i + 1; j < ENVIRONMENT_NAMES.size(); j++) {
			const a = ENVIRONMENT_NAMES[i], b = ENVIRONMENT_NAMES[j];
			if (distinctChannels(Env[a], Env[b]) < 2) failures.push(`${a} ~ ${b}`);
		}
		expect(failures.join(", ")).toBe("");
	});
	it("gives each weather preset its treatment", () => {
		expect(Env.farm_storm.weather).toBe("storm");
		expect(Env.ocean_storm.weather).toBe("storm");
		expect(Env.harbor_fog.weather).toBe("fog");
		expect(Env.canyon_dusk.weather).toBe("dust");
		expect(Env.relay_aurora.weather).toBe("aurora");
		// Real fog: denser than any clear preset and no sun disc.
		expect(Env.harbor_fog.atmosphere.density).toBeGreaterThan(0.55);
		expect(Env.harbor_fog.sunSize).toBe(0);
		// The city evening sun must not bloom the frame white.
		expect(Env.city_evening.bloom.intensity).toBe(0);
		expect(Env.city_evening.atmosphere.glare).toBeLessThan(0.1);
		expect(Env.city_evening.sunSize).toBeLessThan(15);
	});
	it("stays inside the phone cost envelope", () => {
		for (const name of ENVIRONMENT_NAMES) {
			const e = Env[name];
			expect(e.clouds.density).toBeLessThanOrEqual(0.3);
			expect(e.bloom.intensity).toBeLessThanOrEqual(0.3);
			expect(e.atmosphere.density).toBeLessThanOrEqual(0.65);
			expect(e.clock >= 0 && e.clock < 24).toBe(true);
		}
		expect(lampsOn("city_night")).toBe(true);
		expect(lampsOn("canyon_noon")).toBe(false);
	});
});
