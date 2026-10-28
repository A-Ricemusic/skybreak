import { Lighting, Workspace } from "@rbxts/services";
import { ENVIRONMENT_ATTRIBUTE, environmentFor, type Rgb } from "../shared/EnvironmentPresets";
import type { EnvironmentPreset } from "../shared/WorldTypes";

// Applies one EnvironmentPresets entry to Lighting, the sky, clouds, post
// effects and terrain water. The server owns these (they replicate); phones
// trim them locally in client/MobileGraphics and the client adds the weather
// (rain, lightning, dust, aurora) in client/Weather from the Lighting attribute.

const EFFECTS = ["SkybreakAtmosphere", "SkybreakColor", "SkybreakBloom", "MissionAtmosphere", "MissionGrade", "MissionSky", "MissionBloom"];
const rgb = (c: Rgb) => Color3.fromRGB(c[0], c[1], c[2]);

// Terrain material colours persist across Terrain:Clear(), so each build starts from the
// engine defaults captured once at server start (the menu and M1/M2 never inherit a mission's palette).
const TINTED = [Enum.Material.Grass, Enum.Material.LeafyGrass, Enum.Material.Ground, Enum.Material.Mud, Enum.Material.Sand, Enum.Material.Sandstone, Enum.Material.Rock, Enum.Material.Slate, Enum.Material.Basalt, Enum.Material.Snow, Enum.Material.Concrete, Enum.Material.Pavement];
const DEFAULT_COLORS = new Map<Enum.Material, Color3>();
for (const m of TINTED) DEFAULT_COLORS.set(m, Workspace.Terrain.GetMaterialColor(m));

function clear(): void {
	for (const [m, color] of DEFAULT_COLORS) Workspace.Terrain.SetMaterialColor(m, color);
	for (const name of EFFECTS) Lighting.FindFirstChild(name)?.Destroy();
	Workspace.Terrain.FindFirstChild("SkybreakClouds")?.Destroy();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
}

export const WorldEnvironment = {
	Apply(preset: EnvironmentPreset): void {
		clear();
		const e = environmentFor(preset);
		Lighting.ClockTime = e.clock;
		Lighting.Brightness = e.brightness;
		Lighting.ExposureCompensation = e.exposure;
		Lighting.Ambient = rgb(e.ambient);
		Lighting.OutdoorAmbient = rgb(e.outdoorAmbient);
		Lighting.EnvironmentDiffuseScale = e.diffuse;
		Lighting.EnvironmentSpecularScale = e.specular;
		// No sun shadow map in sorties: a fast camera over a large world is the worst case for
		// shadow cascades on phones. The menu turns it back on.
		Lighting.GlobalShadows = false;
		Lighting.SetAttribute(ENVIRONMENT_ATTRIBUTE, preset);

		const sky = new Instance("Sky");
		sky.Name = "MissionSky";
		sky.StarCount = e.starCount;
		sky.SunAngularSize = math.max(e.sunSize, 0.01);
		sky.MoonAngularSize = math.max(e.moonSize, 0.01);
		// Overcast and fog decks hide the discs entirely.
		sky.CelestialBodiesShown = e.sky !== "overcast";
		sky.Parent = Lighting;

		const atmosphere = new Instance("Atmosphere");
		atmosphere.Name = "MissionAtmosphere";
		atmosphere.Density = e.atmosphere.density;
		atmosphere.Offset = e.atmosphere.offset;
		atmosphere.Haze = e.atmosphere.haze;
		atmosphere.Glare = e.atmosphere.glare;
		atmosphere.Color = rgb(e.atmosphere.color);
		atmosphere.Decay = rgb(e.atmosphere.decay);
		atmosphere.Parent = Lighting;

		const grade = new Instance("ColorCorrectionEffect");
		grade.Name = "MissionGrade";
		grade.Saturation = e.grade.saturation;
		grade.Contrast = e.grade.contrast;
		grade.Brightness = e.grade.brightness;
		grade.TintColor = rgb(e.grade.tint);
		grade.Parent = Lighting;

		if (e.bloom.intensity > 0) {
			const bloom = new Instance("BloomEffect");
			bloom.Name = "MissionBloom";
			bloom.Intensity = e.bloom.intensity;
			bloom.Size = e.bloom.size;
			bloom.Threshold = e.bloom.threshold;
			bloom.Parent = Lighting;
		}

		if (e.clouds.cover > 0) {
			const clouds = new Instance("Clouds");
			clouds.Name = "MissionClouds";
			clouds.Cover = e.clouds.cover;
			clouds.Density = e.clouds.density; // <= 0.3 in every preset: the volumetric fill is the phone cost
			clouds.Color = rgb(e.clouds.color);
			clouds.Parent = Workspace.Terrain;
		}

		const terrain = Workspace.Terrain;
		terrain.WaterColor = rgb(e.water.color);
		terrain.WaterReflectance = e.water.reflectance;
		terrain.WaterTransparency = e.water.transparency;
		terrain.WaterWaveSize = e.water.waveSize;
		terrain.WaterWaveSpeed = e.water.waveSpeed;
	},
	Clear(): void {
		clear();
		Lighting.SetAttribute(ENVIRONMENT_ATTRIBUTE, undefined);
	},
};
