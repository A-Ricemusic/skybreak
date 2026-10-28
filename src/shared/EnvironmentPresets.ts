import type { EnvironmentPreset } from "./WorldTypes";

// One table for every mission environment. Pure numbers only (no Roblox types)
// so the offline Luau runner can audit it; the server converts it to Lighting,
// Atmosphere, Clouds, Sky, bloom and Terrain water (RelayWorld), and the client
// reads `weather` for rain, lightning, dust and the aurora (client/Weather.ts).
// Every preset must be visibly distinct: see EnvironmentPresets.spec for the
// pairwise contract.

export type Rgb = [number, number, number];
/** Sky treatment. Every family keeps the engine's default skybox (no texture IDs): `night`
 * shows stars and the moon; `overcast` hides the sun disc behind a full cloud deck. */
export type SkyFamily = "day" | "dusk" | "night" | "overcast";
/** Client particle/flash treatment (client/Weather.ts). */
export type Weather = "none" | "storm" | "dust" | "fog" | "aurora";

export interface AtmosphereSpec { density: number; offset: number; haze: number; glare: number; color: Rgb; decay: Rgb }
export interface CloudSpec { cover: number; density: number; color: Rgb }
export interface GradeSpec { saturation: number; contrast: number; brightness: number; tint: Rgb }
export interface BloomSpec { intensity: number; size: number; threshold: number }
export interface WaterSpec { color: Rgb; reflectance: number; transparency: number; waveSize: number; waveSpeed: number }
export interface EnvironmentSpec {
	label: string;
	clock: number;
	brightness: number;
	exposure: number;
	ambient: Rgb;
	outdoorAmbient: Rgb;
	/** Lighting.EnvironmentDiffuseScale / SpecularScale. */
	diffuse: number;
	specular: number;
	atmosphere: AtmosphereSpec;
	clouds: CloudSpec;
	grade: GradeSpec;
	bloom: BloomSpec;
	sky: SkyFamily;
	starCount: number;
	sunSize: number;
	moonSize: number;
	water: WaterSpec;
	weather: Weather;
}

const spec = (
	label: string, clock: number, brightness: number, exposure: number, ambient: Rgb, outdoorAmbient: Rgb, diffuse: number, specular: number,
	atmosphere: AtmosphereSpec, clouds: CloudSpec, grade: GradeSpec, bloom: BloomSpec, sky: SkyFamily, starCount: number, sunSize: number, moonSize: number, water: WaterSpec, weather: Weather,
): EnvironmentSpec => ({ label, clock, brightness, exposure, ambient, outdoorAmbient, diffuse, specular, atmosphere, clouds, grade, bloom, sky, starCount, sunSize, moonSize, water, weather });
const atmo = (density: number, offset: number, haze: number, glare: number, color: Rgb, decay: Rgb): AtmosphereSpec => ({ density, offset, haze, glare, color, decay });
const cloud = (cover: number, density: number, color: Rgb): CloudSpec => ({ cover, density, color });
const grade = (saturation: number, contrast: number, brightness: number, tint: Rgb): GradeSpec => ({ saturation, contrast, brightness, tint });
const bloom = (intensity: number, size: number, threshold: number): BloomSpec => ({ intensity, size, threshold });
const water = (color: Rgb, reflectance: number, transparency: number, waveSize: number, waveSpeed: number): WaterSpec => ({ color, reflectance, transparency, waveSize, waveSpeed });

const DAY_AMBIENT: Rgb = [100, 118, 140], DAY_OUTDOOR: Rgb = [130, 145, 155];
const SOFT = bloom(0.12, 20, 1.6), NIGHT_GLOW = bloom(0.3, 24, 1.1), NO_BLOOM = bloom(0, 20, 3);
const CLEAR_WATER = water([22, 92, 132], 0.3, 0.2, 0.15, 10);
const WARM_WATER = water([44, 82, 108], 0.28, 0.2, 0.12, 8);
const GREY_WATER = water([60, 78, 86], 0.12, 0.15, 0.2, 12);
const NIGHT_WATER = water([10, 24, 42], 0.24, 0.15, 0.1, 8);

/** Cloud density is capped at 0.3 in every preset: the volumetric fill cost is the phone budget, cover is cheap. */
export const ENVIRONMENTS: Record<EnvironmentPreset, EnvironmentSpec> = {
	canyon_dawn: spec("Canyon dawn", 6.3, 2.2, 0.1, [110, 108, 130], [150, 140, 150], 0.5, 0.6,
		atmo(0.3, 0.25, 1.8, 0.25, [236, 196, 170], [150, 110, 120]), cloud(0.35, 0.25, [255, 222, 200]), grade(0.05, 0.06, 0, [255, 240, 228]), SOFT, "day", 0, 24, 14, CLEAR_WATER, "none"),
	// Desert noon: a warm, dusty haze rather than the clean blue of open ocean.
	canyon_noon: spec("Canyon noon", 12.2, 2.8, 0, DAY_AMBIENT, DAY_OUTDOOR, 0.5, 0.65,
		atmo(0.22, 0.05, 1.0, 0.15, [214, 214, 200], [140, 150, 160]), cloud(0.18, 0.25, [246, 248, 250]), grade(0.1, 0.08, 0, [255, 255, 255]), SOFT, "day", 0, 21, 14, CLEAR_WATER, "none"),
	// The dust front: a tan atmosphere thick enough to swallow the far mesas.
	canyon_dusk: spec("Canyon dusk, dust front", 17.4, 2.0, 0.05, [128, 108, 90], [160, 136, 110], 0.45, 0.4,
		atmo(0.45, 0.35, 3.0, 0.35, [214, 172, 118], [170, 120, 80]), cloud(0.25, 0.2, [230, 190, 150]), grade(-0.05, 0.1, 0, [255, 226, 190]), SOFT, "dusk", 0, 26, 14, WARM_WATER, "dust"),
	canyon_night: spec("Canyon night", 0.6, 1.6, 0.4, [60, 70, 95], [70, 85, 110], 0.35, 0.5,
		atmo(0.28, 0.1, 1.2, 0, [110, 140, 190], [40, 55, 90]), cloud(0.12, 0.2, [90, 100, 130]), grade(-0.1, 0.1, 0, [210, 222, 255]), NIGHT_GLOW, "night", 2500, 21, 20, NIGHT_WATER, "none"),
	farm_morning: spec("Farm morning", 8.2, 2.5, 0.08, [112, 122, 128], [140, 150, 150], 0.5, 0.6,
		atmo(0.32, 0.2, 2.0, 0.2, [226, 230, 214], [150, 170, 160]), cloud(0.4, 0.25, [248, 246, 236]), grade(0.12, 0.04, 0, [255, 250, 236]), SOFT, "day", 0, 22, 14, CLEAR_WATER, "none"),
	farm_overcast: spec("Farm overcast", 11.5, 1.5, -0.05, [120, 128, 135], [140, 148, 155], 0.55, 0.3,
		atmo(0.42, 0.4, 2.6, 0, [176, 184, 190], [120, 128, 136]), cloud(1.0, 0.3, [150, 156, 162]), grade(-0.25, 0.02, 0, [220, 226, 232]), NO_BLOOM, "overcast", 0, 0, 0, GREY_WATER, "none"),
	farm_storm: spec("Farm storm", 13.5, 1.1, -0.12, [85, 92, 104], [105, 112, 124], 0.55, 0.3,
		atmo(0.55, 0.5, 3.2, 0, [112, 120, 132], [70, 76, 88]), cloud(1.0, 0.3, [72, 78, 88]), grade(-0.4, 0.12, -0.02, [200, 210, 226]), NO_BLOOM, "overcast", 0, 0, 0, water([40, 56, 66], 0.2, 0.1, 0.35, 14), "storm"),
	farm_sunset: spec("Farm sunset", 18.1, 2.2, 0.1, [120, 100, 96], [160, 130, 110], 0.5, 0.6,
		atmo(0.36, 0.3, 2.2, 0.5, [250, 170, 110], [160, 90, 70]), cloud(0.45, 0.25, [255, 190, 150]), grade(0.18, 0.08, 0, [255, 228, 200]), SOFT, "dusk", 0, 30, 14, WARM_WATER, "none"),
	relay_night: spec("Relay night", 23.4, 1.4, 0.35, [50, 58, 80], [60, 70, 96], 0.35, 0.5,
		atmo(0.3, 0.12, 1.4, 0, [96, 120, 170], [30, 42, 70]), cloud(0.3, 0.25, [70, 78, 100]), grade(-0.15, 0.12, 0, [200, 214, 255]), NIGHT_GLOW, "night", 1800, 21, 22, NIGHT_WATER, "none"),
	// Clear, cold and cloudless so the ribbons and stars own the sky.
	relay_aurora: spec("Relay aurora", 1.5, 1.3, 0.45, [56, 80, 88], [70, 100, 110], 0.35, 0.5,
		atmo(0.24, 0.05, 0.9, 0, [96, 170, 150], [24, 60, 56]), cloud(0, 0.2, [80, 100, 100]), grade(0.15, 0.1, 0, [210, 255, 236]), NIGHT_GLOW, "night", 4000, 21, 14, water([10, 32, 40], 0.3, 0.15, 0.08, 6), "aurora"),
	// Small sun, almost no glare and no bloom: the evening disc must not white out the frame.
	city_evening: spec("City evening", 18.6, 1.7, 0.02, [118, 100, 104], [150, 128, 126], 0.5, 0.5,
		atmo(0.34, 0.3, 2.4, 0.08, [232, 160, 120], [110, 80, 90]), cloud(0.4, 0.25, [240, 180, 160]), grade(0.1, 0.1, 0, [255, 232, 214]), NO_BLOOM, "dusk", 0, 12, 14, WARM_WATER, "none"),
	city_night: spec("City night", 23.8, 1.2, 0.4, [54, 54, 76], [62, 64, 90], 0.35, 0.5,
		atmo(0.36, 0.2, 1.8, 0, [120, 100, 150], [36, 30, 58]), cloud(0.45, 0.25, [60, 54, 78]), grade(0.05, 0.15, 0, [226, 214, 255]), NIGHT_GLOW, "night", 900, 21, 18, water([14, 20, 40], 0.3, 0.15, 0.1, 8), "none"),
	// Later and hazier than the canyon dawn: the sun is up over a city's morning smog.
	city_dawn: spec("City sunrise", 7.0, 2.3, 0.12, [118, 108, 124], [160, 140, 146], 0.5, 0.6,
		atmo(0.4, 0.3, 2.0, 0.3, [255, 206, 170], [140, 110, 130]), cloud(0.3, 0.25, [255, 210, 190]), grade(0.14, 0.06, 0, [255, 240, 226]), SOFT, "day", 0, 26, 14, water([40, 86, 116], 0.3, 0.2, 0.12, 8), "none"),
	// Real fog: density well past the engine's "haze" range, with no sun disc.
	harbor_fog: spec("Harbor fog", 9.0, 1.6, -0.02, [130, 138, 142], [150, 158, 162], 0.55, 0.25,
		atmo(0.62, 0.55, 3.0, 0, [196, 204, 208], [160, 168, 172]), cloud(0.9, 0.3, [190, 196, 200]), grade(-0.3, -0.02, 0, [228, 234, 236]), NO_BLOOM, "overcast", 0, 0, 0, water([70, 90, 96], 0.05, 0.1, 0.05, 6), "fog"),
	harbor_sunset: spec("Harbor sunset", 17.3, 2.3, 0.05, [105, 119, 134], [140, 151, 159], 0.5, 0.65,
		atmo(0.25, 0.1, 1.4, 0.3, [232, 196, 160], [150, 110, 96]), cloud(0.38, 0.3, [238, 241, 244]), grade(0.08, 0.08, 0, [255, 255, 255]), SOFT, "dusk", 0, 26, 14, WARM_WATER, "none"),
	ocean_storm: spec("Ocean storm", 15.2, 1.0, -0.15, [78, 88, 100], [98, 108, 120], 0.55, 0.3,
		atmo(0.5, 0.45, 3.0, 0, [104, 116, 128], [56, 66, 80]), cloud(1.0, 0.3, [60, 66, 76]), grade(-0.35, 0.14, -0.02, [196, 210, 226]), NO_BLOOM, "overcast", 0, 0, 0, water([20, 40, 58], 0.3, 0.1, 0.45, 14), "storm"),
	ocean_clear: spec("Ocean clear", 13.0, 2.9, 0, [104, 122, 140], [136, 150, 158], 0.5, 0.7,
		atmo(0.18, 0, 0.6, 0.12, [186, 224, 240], [100, 150, 190]), cloud(0.12, 0.2, [250, 252, 255]), grade(0.2, 0.06, 0, [240, 250, 255]), SOFT, "day", 0, 20, 14, water([16, 96, 140], 0.35, 0.25, 0.15, 10), "none"),
	ocean_night: spec("Ocean night", 2.0, 1.3, 0.4, [40, 52, 72], [50, 64, 88], 0.35, 0.5,
		atmo(0.26, 0.08, 1.0, 0, [80, 110, 160], [20, 36, 64]), cloud(0.05, 0.2, [60, 70, 90]), grade(-0.1, 0.12, 0, [200, 216, 255]), NIGHT_GLOW, "night", 3000, 21, 24, water([8, 20, 38], 0.25, 0.15, 0.12, 8), "none"),
};

export const ENVIRONMENT_NAMES: EnvironmentPreset[] = [
	"canyon_dawn", "canyon_noon", "canyon_dusk", "canyon_night", "farm_morning", "farm_overcast", "farm_storm", "farm_sunset", "relay_night", "relay_aurora",
	"city_evening", "city_night", "city_dawn", "harbor_fog", "harbor_sunset", "ocean_storm", "ocean_clear", "ocean_night",
];

/** Lighting attribute naming the active mission preset; the client weather reads it. */
export const ENVIRONMENT_ATTRIBUTE = "MissionEnvironment";

export function environmentFor(preset: EnvironmentPreset): EnvironmentSpec { return ENVIRONMENTS[preset]; }
/** Lit windows and street lamps show from dusk onward and under storm or fog decks. */
export function lampsOn(preset: EnvironmentPreset): boolean {
	const e = ENVIRONMENTS[preset];
	return e.sky === "night" || e.sky === "dusk" || e.weather === "storm" || e.weather === "fog";
}
/** Colour distance in 0..255 units for the distinctness contract. */
export function rgbDistance(a: Rgb, b: Rgb): number {
	return math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]));
}
/** Two presets are "visibly distinct" when at least two independent channels differ by a clear margin. */
export function distinctChannels(a: EnvironmentSpec, b: EnvironmentSpec): number {
	let channels = 0;
	if (math.abs(a.clock - b.clock) >= 0.5) channels += 1;
	if (math.abs(a.atmosphere.density - b.atmosphere.density) >= 0.06) channels += 1;
	if (rgbDistance(a.atmosphere.color, b.atmosphere.color) >= 28) channels += 1;
	if (math.abs(a.clouds.cover - b.clouds.cover) >= 0.15) channels += 1;
	if (a.sky !== b.sky) channels += 1;
	if (a.weather !== b.weather) channels += 1;
	if (math.abs(a.brightness - b.brightness) >= 0.4) channels += 1;
	if (rgbDistance(a.water.color, b.water.color) >= 24) channels += 1;
	return channels;
}
