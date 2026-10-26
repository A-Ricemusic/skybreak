// Client comfort settings. Pure rules here; the client stores the values as
// attributes on PlayerGui (they outlive respawns and every React remount, and
// need no server or DataStore). Audio (workstream D) reads `MusicVolume` and
// `SfxVolume` straight from PlayerGui, 0–1, default 1; voice-over reads `VoiceVolume`.

export interface PlayerSettings {
	/** Pushing the stick (or W) up dives instead of climbing. */
	invertY: boolean;
	/** Camera shake strength, 0 (off) – 1 (full). */
	shake: number;
	/** Whole-HUD scale, 0.8 – 1.3 (touch never shrinks below 1 so buttons stay ≥ 44 px). */
	hudScale: number;
	/** Touch stick scale against the 80 px default, 0.85 – 1.3. */
	stickScale: number;
	music: number;
	sfx: number;
	/** Voice-over (cutscenes and radio), 0–1. */
	voice: number;
}

export type SettingKey = keyof PlayerSettings;
export type NumericSettingKey = Exclude<SettingKey, "invertY">;

export interface SettingRange {
	min: number;
	max: number;
	step: number;
}

export const SETTING_RANGES: { [key in NumericSettingKey]: SettingRange } = {
	shake: { min: 0, max: 1, step: 0.25 },
	hudScale: { min: 0.8, max: 1.3, step: 0.1 },
	stickScale: { min: 0.85, max: 1.3, step: 0.15 },
	music: { min: 0, max: 1, step: 0.1 },
	sfx: { min: 0, max: 1, step: 0.1 },
	voice: { min: 0, max: 1, step: 0.1 },
};

/** PlayerGui attribute names. MusicVolume / SfxVolume / VoiceVolume are the audio contract. */
export const SETTING_ATTRIBUTES: { [key in SettingKey]: string } = {
	invertY: "InvertY",
	shake: "CameraShake",
	hudScale: "HudScale",
	stickScale: "StickScale",
	music: "MusicVolume",
	sfx: "SfxVolume",
	voice: "VoiceVolume",
};

export const SETTING_ORDER: SettingKey[] = ["invertY", "shake", "hudScale", "stickScale", "music", "sfx", "voice"];

export const SETTING_LABELS: { [key in SettingKey]: string } = {
	invertY: "INVERT PITCH",
	shake: "CAMERA SHAKE",
	hudScale: "HUD SCALE",
	stickScale: "STICK SIZE",
	music: "MUSIC VOLUME",
	sfx: "EFFECTS VOLUME",
	voice: "VOICE VOLUME",
};

export function defaultSettings(): PlayerSettings {
	return { invertY: false, shake: 1, hudScale: 1, stickScale: 1, music: 1, sfx: 1, voice: 1 };
}

function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) !== math.huge;
}

/** Snaps to the range's step grid (keeps 0.1 steps from drifting) and clamps. */
export function clampSetting(key: NumericSettingKey, value: unknown): number {
	const range = SETTING_RANGES[key];
	const fallback = defaultSettings()[key];
	if (!finite(value)) return fallback;
	const steps = math.floor((value - range.min) / range.step + 0.5);
	return math.clamp(math.floor((range.min + steps * range.step) * 100 + 0.5) / 100, range.min, range.max);
}

/** One press of a − / + stepper. */
export function stepSetting(key: NumericSettingKey, value: number, direction: 1 | -1): number {
	return clampSetting(key, clampSetting(key, value) + SETTING_RANGES[key].step * direction);
}

/** Builds a complete, valid settings table from raw attribute values (anything missing or bad → default). */
export function readSettings(read: (attribute: string) => unknown): PlayerSettings {
	const settings = defaultSettings();
	settings.invertY = read(SETTING_ATTRIBUTES.invertY) === true;
	for (const key of ["shake", "hudScale", "stickScale", "music", "sfx", "voice"] as NumericSettingKey[]) {
		const raw = read(SETTING_ATTRIBUTES[key]);
		settings[key] = raw === undefined ? settings[key] : clampSetting(key, raw);
	}
	return settings;
}

/** Display text for a setting value. */
export function formatSetting(key: SettingKey, settings: PlayerSettings): string {
	if (key === "invertY") return settings.invertY ? "ON" : "OFF";
	const value = settings[key];
	if (key === "shake" && value <= 0) return "OFF";
	return `${math.floor(value * 100 + 0.5)}%`;
}

/** Scale actually applied to the HUD: touch keeps every control at least its 44 px minimum. */
export function effectiveHudScale(requested: number, touch: boolean, viewportWidth: number, viewportHeight: number): number {
	let scale = clampSetting("hudScale", requested);
	if (touch) scale = math.max(1, scale);
	// Larger scales never shrink the virtual root below the smallest supported layout (320x160).
	const cap = math.min(math.max(1, viewportWidth) / 320, math.max(1, viewportHeight) / 160);
	return math.min(scale, math.max(cap, touch ? 1 : SETTING_RANGES.hudScale.min));
}
