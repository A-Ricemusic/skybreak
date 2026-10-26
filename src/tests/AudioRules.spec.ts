import { describe, expect, it } from "@rbxts/jest-globals";
import { AudioRules } from "../shared/AudioRules";

describe("flight audio priorities and mix", () => {
	it("lets an incoming missile override damage, boundaries and searching", () => {
		expect(AudioRules.Warning(true, 10, true, 0.5, true)).toBe("incoming");
		expect(AudioRules.Warning(false, 10, true, 0.5, true)).toBe("lowHull");
		expect(AudioRules.Warning(false, 100, true, 0.5, true)).toBe("boundary");
		expect(AudioRules.Warning(false, 100, false, 0.5, true)).toBe("lockSearch");
	});
	it("silences search after lock, target loss, and at idle", () => {
		expect(AudioRules.Warning(false, 100, false, 1, true)).toBeUndefined();
		expect(AudioRules.Warning(false, 100, false, 0.5, false)).toBeUndefined();
		expect(AudioRules.Warning(false, 100, false, 0, true)).toBeUndefined();
		expect(AudioRules.Warning(false, 0, false, 0, false)).toBeUndefined();
	});
	it("keeps a cruise bed and adds afterburner only above cruise throttle", () => {
		const cruise = AudioRules.EngineMix(0.65, 230, 0.016);
		const full = AudioRules.EngineMix(1, 320, 0.016);
		expect(cruise.burn).toBe(0);
		expect(full.burn).toBeCloseTo(0.32, 5);
		expect(full.cruise > 0 && full.wind > cruise.wind && full.pitch > cruise.pitch).toBe(true);
		expect(full.cruise + full.burn + full.wind < 1).toBe(true);
	});
	it("bounds extreme input and frame stalls without volume jumps", () => {
		const idle = AudioRules.EngineMix(-100, -100, -1);
		const high = AudioRules.EngineMix(100, 10000, 100);
		expect(idle.burn).toBe(0); expect(idle.wind).toBe(0); expect(idle.alpha).toBe(0);
		expect(high.wind).toBeCloseTo(0.12, 5);
		expect(high.alpha < 0.3).toBe(true);
	});
});
