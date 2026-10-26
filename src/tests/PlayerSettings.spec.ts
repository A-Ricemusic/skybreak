import { describe, expect, it } from "@rbxts/jest-globals";
import {
	clampSetting,
	defaultSettings,
	effectiveHudScale,
	formatSetting,
	readSettings,
	SETTING_ATTRIBUTES,
	SETTING_ORDER,
	SETTING_RANGES,
	stepSetting,
} from "../shared/PlayerSettings";

describe("client comfort settings", () => {
	it("defaults to no inversion, full shake, 100% HUD and sticks, full volume", () => {
		expect(defaultSettings()).toEqual({ invertY: false, shake: 1, hudScale: 1, stickScale: 1, music: 1, sfx: 1, voice: 1 });
		expect(SETTING_ORDER.size()).toBe(7);
	});
	it("uses the audio contract attribute names", () => {
		expect(SETTING_ATTRIBUTES.music).toBe("MusicVolume");
		expect(SETTING_ATTRIBUTES.sfx).toBe("SfxVolume");
		expect(SETTING_ATTRIBUTES.voice).toBe("VoiceVolume");
	});
	it("keeps every value in its range and on its step grid", () => {
		expect(SETTING_RANGES.hudScale.min).toBe(0.8);
		expect(SETTING_RANGES.hudScale.max).toBe(1.3);
		expect(clampSetting("hudScale", 2)).toBe(1.3);
		expect(clampSetting("hudScale", 0.1)).toBe(0.8);
		expect(clampSetting("shake", 0.6)).toBe(0.5);
		expect(clampSetting("music", 0.33)).toBe(0.3);
		expect(clampSetting("sfx", 0 / 0)).toBe(1);
		expect(clampSetting("stickScale", "big")).toBe(1);
	});
	it("steps up and down without drifting off the grid", () => {
		let volume = 1;
		for (let index = 0; index < 10; index++) volume = stepSetting("music", volume, -1);
		expect(volume).toBe(0);
		expect(stepSetting("music", volume, -1)).toBe(0);
		let scale = 0.8;
		for (let index = 0; index < 5; index++) scale = stepSetting("hudScale", scale, 1);
		expect(scale).toBe(1.3);
		expect(stepSetting("stickScale", 1, 1)).toBe(1.15);
		expect(stepSetting("shake", 1, -1)).toBe(0.75);
	});
	it("reads attributes back, defaulting anything missing or invalid", () => {
		const stored: { [name: string]: unknown } = { InvertY: true, CameraShake: 0.25, HudScale: 5, MusicVolume: 0.4, SfxVolume: "loud", VoiceVolume: 0.7 };
		const settings = readSettings((name) => stored[name]);
		expect(settings).toEqual({ invertY: true, shake: 0.25, hudScale: 1.3, stickScale: 1, music: 0.4, sfx: 1, voice: 0.7 });
		expect(readSettings(() => undefined)).toEqual(defaultSettings());
	});
	it("formats values for the sheet", () => {
		const settings = defaultSettings();
		expect(formatSetting("invertY", settings)).toBe("OFF");
		expect(formatSetting("hudScale", settings)).toBe("100%");
		settings.shake = 0;
		expect(formatSetting("shake", settings)).toBe("OFF");
	});
	it("never shrinks touch HUDs below 100% and never shrinks the virtual root below 320x160", () => {
		expect(effectiveHudScale(0.8, false, 1920, 854)).toBe(0.8);
		expect(effectiveHudScale(0.8, true, 844, 390)).toBe(1);
		expect(effectiveHudScale(1.3, true, 844, 390)).toBe(1.3);
		// 320x182: a 1.3 request would leave a 246 px virtual root.
		expect(effectiveHudScale(1.3, true, 320, 182)).toBe(1);
		expect(effectiveHudScale(1.3, false, 400, 400)).toBe(1.25);
		for (const [width, height] of [[320, 182], [667, 375], [800, 390], [1920, 854]]) for (const touch of [true, false]) for (const requested of [0.8, 1, 1.3]) {
			const scale = effectiveHudScale(requested, touch, width, height);
			expect(width / scale).toBeGreaterThanOrEqual(touch ? math.min(width, 320) : 320 * 0.999);
			expect(scale).toBeGreaterThanOrEqual(touch ? 1 : 0.8);
		}
	});
});
