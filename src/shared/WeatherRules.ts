import { M02_ENVIRONMENT, M02_WORLD_KEY } from "./M02WorldPlan";
import { M01_ENVIRONMENT, M01_WORLD_KEY } from "./M01WorldPlan";
import { ENVIRONMENTS, type Rgb } from "./EnvironmentPresets";
import type { EnvironmentPreset } from "./MissionCatalog";

// Pure weather and phone-trim rules (client/Weather and client/MobileGraphics
// apply them; WeatherRules.spec runs them offline). Every effect is event or
// timer driven: emitters ride on the local jet visual (which already moves
// each frame), lightning fires on a timer, the aurora is static beams.

export interface RainSpec { rate: number; lifetime: number; fall: number; size: number; transparency: number }
export interface LightningSpec { minGap: number; maxGap: number; flash: number; flickers: number; bolt: boolean }
export interface DriftSpec { rate: number; size: [number, number]; transparency: number; lifetime: number; color: Rgb; wind: [number, number, number] }
export interface AuroraSpec { bands: number; segments: number; colors: Rgb[] }
export interface WeatherPlan { rain?: RainSpec; lightning?: LightningSpec; drift?: DriftSpec; aurora?: AuroraSpec }

/** Side of the cube of air around the jet that rain and drift particles spawn in. */
export const WEATHER_VOLUME = 340;
/** Phones keep the effect but at this share of the particles (and never above the caps). */
export const PHONE_SHARE = 0.45;
const PHONE_RAIN_CAP = 220;
const PHONE_DRIFT_CAP = 14;
const PHONE_CLOUD_DENSITY = 0.18;
const PHONE_CLOUD_COVER = 0.25;

export function weatherPlan(preset: EnvironmentPreset | typeof M01_WORLD_KEY | typeof M02_WORLD_KEY | undefined, phone: boolean, reducedMotion: boolean): WeatherPlan {
	if (preset === undefined) return {};
	const e = preset === M02_WORLD_KEY ? M02_ENVIRONMENT : preset === M01_WORLD_KEY ? M01_ENVIRONMENT : ENVIRONMENTS[preset];
	const share = phone ? PHONE_SHARE : 1;
	if (e.weather === "storm") {
		const heavy = preset === "ocean_storm";
		const rate = (heavy ? 520 : 420) * share;
		return {
			rain: { rate: phone ? math.min(rate, PHONE_RAIN_CAP) : rate, lifetime: 0.7, fall: heavy ? 950 : 850, size: phone ? 0.5 : 0.4, transparency: 0.35 },
			// Reduced motion keeps the bolts (they read the storm) but drops the full-screen flash flicker.
			lightning: { minGap: heavy ? 5 : 7, maxGap: heavy ? 11 : 15, flash: reducedMotion ? 0.08 : 0.32, flickers: reducedMotion ? 1 : 2, bolt: true },
		};
	}
	if (e.weather === "dust") {
		const rate = 26 * share;
		return { drift: { rate: phone ? math.min(rate, PHONE_DRIFT_CAP) : rate, size: [40, 90], transparency: 0.86, lifetime: 4, color: [206, 168, 118], wind: [70, 4, 25] } };
	}
	if (e.weather === "fog") {
		const rate = 22 * share;
		return { drift: { rate: phone ? math.min(rate, PHONE_DRIFT_CAP) : rate, size: [70, 140], transparency: 0.9, lifetime: 5, color: [214, 220, 222], wind: [12, 0, 6] } };
	}
	if (e.weather === "aurora") {
		return { aurora: { bands: phone ? 3 : 5, segments: phone ? 12 : 28, colors: [[90, 255, 170], [60, 220, 200], [150, 120, 255]] } };
	}
	return {};
}

/**
 * Phone cloud trim. Density (the volumetric fill) is always clamped; cover is cheap, so storm,
 * fog and overcast decks keep theirs on phones (a storm with a clear sky does not read as a storm).
 */
export function phoneClouds(preset: EnvironmentPreset | typeof M01_WORLD_KEY | typeof M02_WORLD_KEY | undefined, cover: number, density: number): { cover: number; density: number } {
	const e = preset === M02_WORLD_KEY ? M02_ENVIRONMENT : preset === M01_WORLD_KEY ? M01_ENVIRONMENT : preset !== undefined ? ENVIRONMENTS[preset] : undefined;
	const keepDeck = e !== undefined && (preset === M01_WORLD_KEY || e.weather === "storm" || e.weather === "fog" || e.sky === "overcast");
	return { cover: keepDeck && e !== undefined ? e.clouds.cover : math.min(cover, PHONE_CLOUD_COVER), density: math.min(density, PHONE_CLOUD_DENSITY) };
}

/** Seconds to the next lightning strike for a 0..1 roll. */
export function lightningGap(spec: LightningSpec, roll: number): number {
	return spec.minGap + (spec.maxGap - spec.minGap) * math.clamp(roll, 0, 1);
}
