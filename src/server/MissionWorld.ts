import { Lighting, Workspace } from "@rbxts/services";
import { EnvironmentPresetId, getMission, GroundPlacement, IslandPlacement, SceneryPart } from "../shared/MissionCatalog";
import { MissionAssets } from "../shared/MissionAssets";
import { WorldBuilder } from "./WorldBuilder";

interface EnvironmentStyle {
	clock: number; brightness: number; exposure: number;
	ambient: Color3; outdoor: Color3; atmosphere: Color3; decay: Color3;
	density: number; haze: number; glare: number; cloudCover: number; cloudDensity: number;
	cloudColor: Color3; ocean: Color3; sand: Color3; grass: Color3;
}

const ENVIRONMENTS = new Map<EnvironmentPresetId, EnvironmentStyle>([
	["lagoon_noon", { clock: 10.6, brightness: 2.35, exposure: 0.08, ambient: Color3.fromRGB(103, 122, 137), outdoor: Color3.fromRGB(151, 166, 169), atmosphere: Color3.fromRGB(184, 224, 236), decay: Color3.fromRGB(103, 145, 166), density: 0.2, haze: 0.75, glare: 0.14, cloudCover: 0.18, cloudDensity: 0.28, cloudColor: Color3.fromRGB(244, 248, 248), ocean: Color3.fromRGB(25, 125, 151), sand: Color3.fromRGB(224, 196, 139), grass: Color3.fromRGB(61, 111, 74) }],
	["coral_dawn", { clock: 6.25, brightness: 2.15, exposure: 0.02, ambient: Color3.fromRGB(115, 105, 125), outdoor: Color3.fromRGB(173, 147, 141), atmosphere: Color3.fromRGB(245, 184, 164), decay: Color3.fromRGB(85, 117, 143), density: 0.25, haze: 1.05, glare: 0.2, cloudCover: 0.28, cloudDensity: 0.32, cloudColor: Color3.fromRGB(242, 210, 197), ocean: Color3.fromRGB(34, 105, 135), sand: Color3.fromRGB(220, 181, 128), grass: Color3.fromRGB(66, 102, 69) }],
	["monsoon_dusk", { clock: 17.3, brightness: 1.55, exposure: -0.08, ambient: Color3.fromRGB(66, 82, 98), outdoor: Color3.fromRGB(107, 120, 128), atmosphere: Color3.fromRGB(124, 147, 160), decay: Color3.fromRGB(62, 75, 91), density: 0.38, haze: 2.4, glare: 0.03, cloudCover: 0.72, cloudDensity: 0.72, cloudColor: Color3.fromRGB(104, 115, 125), ocean: Color3.fromRGB(31, 72, 92), sand: Color3.fromRGB(164, 151, 119), grass: Color3.fromRGB(51, 82, 63) }],
	["storm_night", { clock: 1.1, brightness: 0.8, exposure: -0.35, ambient: Color3.fromRGB(24, 35, 54), outdoor: Color3.fromRGB(48, 62, 79), atmosphere: Color3.fromRGB(60, 82, 111), decay: Color3.fromRGB(19, 27, 46), density: 0.46, haze: 3.1, glare: 0, cloudCover: 0.86, cloudDensity: 0.82, cloudColor: Color3.fromRGB(62, 70, 87), ocean: Color3.fromRGB(15, 38, 61), sand: Color3.fromRGB(106, 104, 94), grass: Color3.fromRGB(34, 63, 53) }],
	["harbor_hazy", { clock: 14.6, brightness: 1.85, exposure: -0.02, ambient: Color3.fromRGB(99, 106, 108), outdoor: Color3.fromRGB(143, 146, 139), atmosphere: Color3.fromRGB(190, 185, 166), decay: Color3.fromRGB(104, 119, 126), density: 0.32, haze: 2, glare: 0.06, cloudCover: 0.46, cloudDensity: 0.44, cloudColor: Color3.fromRGB(205, 203, 192), ocean: Color3.fromRGB(43, 84, 101), sand: Color3.fromRGB(185, 166, 124), grass: Color3.fromRGB(61, 88, 65) }],
	["mangrove_mist", { clock: 7.8, brightness: 1.65, exposure: -0.06, ambient: Color3.fromRGB(79, 103, 93), outdoor: Color3.fromRGB(122, 143, 124), atmosphere: Color3.fromRGB(168, 196, 175), decay: Color3.fromRGB(76, 106, 101), density: 0.39, haze: 2.8, glare: 0.02, cloudCover: 0.52, cloudDensity: 0.48, cloudColor: Color3.fromRGB(193, 211, 199), ocean: Color3.fromRGB(40, 91, 88), sand: Color3.fromRGB(161, 153, 112), grass: Color3.fromRGB(42, 88, 58) }],
	["typhoon_eye", { clock: 12.2, brightness: 2.55, exposure: 0.14, ambient: Color3.fromRGB(105, 119, 137), outdoor: Color3.fromRGB(170, 180, 190), atmosphere: Color3.fromRGB(185, 213, 226), decay: Color3.fromRGB(63, 82, 107), density: 0.3, haze: 1.5, glare: 0.28, cloudCover: 0.92, cloudDensity: 0.88, cloudColor: Color3.fromRGB(139, 151, 165), ocean: Color3.fromRGB(27, 79, 111), sand: Color3.fromRGB(190, 177, 139), grass: Color3.fromRGB(54, 92, 66) }],
	["amber_sunset", { clock: 17.15, brightness: 2.15, exposure: 0.08, ambient: Color3.fromRGB(116, 103, 111), outdoor: Color3.fromRGB(176, 151, 137), atmosphere: Color3.fromRGB(230, 196, 165), decay: Color3.fromRGB(105, 122, 151), density: 0.25, haze: 1.25, glare: 0.18, cloudCover: 0.36, cloudDensity: 0.36, cloudColor: Color3.fromRGB(236, 207, 182), ocean: Color3.fromRGB(40, 83, 111), sand: Color3.fromRGB(216, 177, 122), grass: Color3.fromRGB(71, 99, 65) }],
	["flood_twilight", { clock: 18.35, brightness: 1.25, exposure: -0.14, ambient: Color3.fromRGB(55, 68, 88), outdoor: Color3.fromRGB(97, 106, 124), atmosphere: Color3.fromRGB(120, 133, 163), decay: Color3.fromRGB(48, 56, 79), density: 0.4, haze: 2.45, glare: 0.02, cloudCover: 0.7, cloudDensity: 0.68, cloudColor: Color3.fromRGB(104, 111, 134), ocean: Color3.fromRGB(28, 55, 83), sand: Color3.fromRGB(151, 143, 119), grass: Color3.fromRGB(49, 75, 62) }],
	["carrier_dusk", { clock: 16.85, brightness: 1.75, exposure: -0.03, ambient: Color3.fromRGB(81, 87, 105), outdoor: Color3.fromRGB(131, 126, 137), atmosphere: Color3.fromRGB(180, 159, 168), decay: Color3.fromRGB(75, 82, 108), density: 0.3, haze: 1.75, glare: 0.1, cloudCover: 0.54, cloudDensity: 0.5, cloudColor: Color3.fromRGB(179, 169, 176), ocean: Color3.fromRGB(29, 63, 91), sand: Color3.fromRGB(173, 155, 123), grass: Color3.fromRGB(54, 79, 62) }],
	["last_horizon", { clock: 5.45, brightness: 2.3, exposure: 0.12, ambient: Color3.fromRGB(104, 85, 105), outdoor: Color3.fromRGB(172, 136, 137), atmosphere: Color3.fromRGB(238, 157, 153), decay: Color3.fromRGB(78, 89, 129), density: 0.27, haze: 1.4, glare: 0.25, cloudCover: 0.48, cloudDensity: 0.5, cloudColor: Color3.fromRGB(223, 180, 176), ocean: Color3.fromRGB(29, 67, 101), sand: Color3.fromRGB(205, 166, 121), grass: Color3.fromRGB(61, 86, 66) }],
]);

const MATERIALS = new Map<string, Enum.Material>([
	["Concrete", Enum.Material.Concrete], ["Metal", Enum.Material.Metal], ["Asphalt", Enum.Material.Asphalt],
	["Rock", Enum.Material.Rock], ["SmoothPlastic", Enum.Material.SmoothPlastic],
	["CorrodedMetal", Enum.Material.CorrodedMetal], ["Sand", Enum.Material.Sand],
]);

function part(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3, material: Enum.Material = Enum.Material.Concrete): Part {
	const value = new Instance("Part");
	value.Name = name; value.Size = size; value.Position = position; value.Color = color; value.Material = material;
	value.Anchored = true; value.CanCollide = false; value.CanTouch = false; value.CanQuery = false; value.Parent = parent;
	return value;
}

function clearMissionEnvironment(): void {
	for (const name of ["SkybreakAtmosphere", "SkybreakColor", "MissionAtmosphere", "MissionGrade", "MissionSky", "MissionBloom", "MissionSunRays"]) Lighting.FindFirstChild(name)?.Destroy();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
	Workspace.Terrain.FindFirstChild("SkybreakClouds")?.Destroy();
}

function environment(preset: EnvironmentPresetId): EnvironmentStyle {
	clearMissionEnvironment();
	const style = ENVIRONMENTS.get(preset);
	assert(style !== undefined, `Missing environment preset ${preset}`);
	Lighting.ClockTime = style.clock; Lighting.Brightness = style.brightness; Lighting.ExposureCompensation = style.exposure;
	Lighting.Ambient = style.ambient; Lighting.OutdoorAmbient = style.outdoor;
	const sky = new Instance("Sky"); sky.Name = "MissionSky"; sky.StarCount = preset === "storm_night" ? 650 : 0; sky.Parent = Lighting;
	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "MissionAtmosphere"; atmosphere.Density = style.density; atmosphere.Offset = 0.08;
	atmosphere.Color = style.atmosphere; atmosphere.Decay = style.decay; atmosphere.Haze = style.haze; atmosphere.Glare = style.glare; atmosphere.Parent = Lighting;
	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "MissionGrade"; grade.Saturation = preset === "storm_night" ? -0.08 : 0.07; grade.Contrast = 0.09;
	grade.TintColor = style.atmosphere.Lerp(Color3.fromRGB(255, 255, 255), 0.72); grade.Parent = Lighting;
	const bloom = new Instance("BloomEffect"); bloom.Name = "MissionBloom"; bloom.Intensity = preset === "last_horizon" ? 0.26 : 0.12; bloom.Size = 22; bloom.Threshold = 1.4; bloom.Parent = Lighting;
	const clouds = new Instance("Clouds"); clouds.Name = "MissionClouds"; clouds.Cover = style.cloudCover; clouds.Density = style.cloudDensity; clouds.Color = style.cloudColor; clouds.Parent = Workspace.Terrain;
	return style;
}

function island(placement: IslandPlacement, style: EnvironmentStyle): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(placement.x, placement.height - placement.radius - 36, placement.z), placement.radius + 28, Enum.Material.Sand);
	terrain.FillBall(new Vector3(placement.x, placement.height - placement.radius, placement.z), placement.radius, Enum.Material.Rock);
	terrain.FillBall(new Vector3(placement.x, placement.height - placement.radius + 10, placement.z), math.max(16, placement.radius - 8), Enum.Material.Grass);
	terrain.SetMaterialColor(Enum.Material.Sand, style.sand); terrain.SetMaterialColor(Enum.Material.Grass, style.grass);
}

function apron(parent: Instance, placement: IslandPlacement, accent: Color3): void {
	const width = math.clamp(placement.radius * 0.52, 150, 270); const depth = math.clamp(placement.radius * 0.58, 170, 320);
	Workspace.Terrain.FillBlock(new CFrame(placement.x, 300, placement.z), new Vector3(width + 95, 512, depth + 95), Enum.Material.Air);
	Workspace.Terrain.FillBlock(new CFrame(placement.x, 14, placement.z), new Vector3(width + 74, 60, depth + 74), Enum.Material.Rock);
	part(parent, "Apron", new Vector3(width, 4, depth), new Vector3(placement.x, 46, placement.z), Color3.fromRGB(86, 98, 105), Enum.Material.Concrete);
	for (const side of [-1, 1]) part(parent, "SafetyLine", new Vector3(3, 0.3, depth - 12), new Vector3(placement.x + side * (width / 2 - 7), 48.2, placement.z), accent, Enum.Material.SmoothPlastic);
}

function grounded(model: Model, x: number, z: number, yaw: number, surfaceY: number): Model {
	const [bounds, size] = model.GetBoundingBox(); const bottom = bounds.Position.Y - size.Y / 2;
	model.PivotTo(new CFrame(x, surfaceY - bottom, z).mul(CFrame.Angles(0, yaw, 0))); return model;
}

function targetModel(target: GroundPlacement): Model {
	let model: Model;
	if (target.kind === "warehouse") model = MissionAssets.CreateWarehouse(target.name ?? "BLOCKADE DEPOT");
	else if (target.kind === "radar") model = MissionAssets.CreateRadar(target.name ?? "BLOCKADE RELAY");
	else if (target.kind === "corvette") model = MissionAssets.CreateCorvette(target.name ?? "BLOCKADE CORVETTE");
	else model = MissionAssets.CreateSam(target.name ?? "BLOCKADE SAM");
	model.SetAttribute("LastTideKind", target.kind);
	return grounded(model, target.x, target.z, target.yaw ?? 0, target.kind === "corvette" ? -15.5 : 49);
}

function authoredScenery(parent: Instance, item: SceneryPart): void {
	part(parent, item.name, new Vector3(item.size[0], item.size[1], item.size[2]), new Vector3(item.position[0], item.position[1], item.position[2]), Color3.fromRGB(item.color[0], item.color[1], item.color[2]), MATERIALS.get(item.material ?? "Concrete") ?? Enum.Material.Concrete);
}

function islandVillage(parent: Instance, placement: IslandPlacement, missionId: number, islandIndex: number): void {
	if (placement.apron || placement.radius < 330) return;
	const count = 2 + ((missionId + islandIndex) % 3);
	for (let index = 0; index < count; index++) {
		const angle = (index / count) * math.pi * 2 + missionId * 0.31; const radius = placement.radius * 0.22;
		const x = placement.x + math.cos(angle) * radius; const z = placement.z + math.sin(angle) * radius;
		part(parent, "ReefHouse", new Vector3(32, 20, 38), new Vector3(x, 51, z), (missionId + index) % 2 === 0 ? Color3.fromRGB(202, 174, 126) : Color3.fromRGB(116, 157, 153), Enum.Material.WoodPlanks);
		part(parent, "ReefRoof", new Vector3(38, 4, 44), new Vector3(x, 63, z), Color3.fromRGB(80, 91, 97), Enum.Material.Metal);
		part(parent, "RainTank", new Vector3(8, 14, 8), new Vector3(x + 23, 48, z), Color3.fromRGB(82, 117, 130), Enum.Material.Metal);
	}
}

function missionLandmarks(parent: Instance, missionId: number): void {
	const accent = missionId >= 19 ? Color3.fromRGB(232, 96, 70) : missionId >= 10 ? Color3.fromRGB(240, 157, 65) : Color3.fromRGB(57, 214, 196);
	const variant = missionId % 6;
	if (variant === 0) {
		for (const x of [-700, 0, 700]) { part(parent, "FloodPylon", new Vector3(28, 70, 28), new Vector3(x, 20, -2050), Color3.fromRGB(82, 93, 99), Enum.Material.Concrete); part(parent, "FloodSpan", new Vector3(660, 20, 24), new Vector3(x + 350, 42, -2050), accent, Enum.Material.Metal); }
	} else if (variant === 1) {
		for (const x of [-900, 900]) { part(parent, "BeaconMast", new Vector3(12, 150, 12), new Vector3(x, 56, -1250), Color3.fromRGB(63, 71, 82), Enum.Material.Metal); const light = part(parent, "BeaconLamp", new Vector3(24, 8, 24), new Vector3(x, 136, -1250), accent, Enum.Material.Neon); light.Shape = Enum.PartType.Ball; }
	} else if (variant === 2) {
		for (const x of [-850, 850]) { part(parent, "ShipyardCrane", new Vector3(12, 125, 12), new Vector3(x, 46, -1700), Color3.fromRGB(201, 143, 55), Enum.Material.Metal); part(parent, "ShipyardBoom", new Vector3(175, 10, 10), new Vector3(x + 55, 106, -1700), Color3.fromRGB(201, 143, 55), Enum.Material.Metal); }
	} else if (variant === 3) {
		for (let index = -2; index <= 2; index++) part(parent, "WreckRib", new Vector3(12, 85, 8), new Vector3(index * 170, 6, -1850 + math.abs(index) * 90), Color3.fromRGB(88, 71, 58), Enum.Material.CorrodedMetal);
	} else if (variant === 4) {
		part(parent, "Causeway", new Vector3(1500, 18, 44), new Vector3(0, -4, -1900), Color3.fromRGB(78, 88, 91), Enum.Material.Rock);
		for (let x = -700; x <= 700; x += 140) part(parent, "CausewayLight", new Vector3(5, 24, 5), new Vector3(x, 17, -1900), accent, Enum.Material.Neon);
	} else {
		for (const x of [-500, 0, 500]) { part(parent, "WindTower", new Vector3(9, 100, 9), new Vector3(x, 36, -1800), Color3.fromRGB(190, 198, 195), Enum.Material.Metal); part(parent, "WindBlade", new Vector3(78, 5, 8), new Vector3(x, 88, -1800), accent, Enum.Material.Metal); }
	}
}

function runway(parent: Instance, placement: IslandPlacement, missionId: number): void {
	if (missionId !== 1 && missionId % 9 !== 0) return;
	part(parent, "ReefRunway", new Vector3(92, 4, 560), new Vector3(placement.x, 50, placement.z), Color3.fromRGB(39, 49, 57), Enum.Material.Asphalt);
	for (let index = -2; index <= 2; index++) part(parent, "RunwayStripe", new Vector3(4, 0.3, 52), new Vector3(placement.x, 52.2, placement.z + index * 95), Color3.fromRGB(237, 231, 204), Enum.Material.SmoothPlastic);
}

export const MissionWorld = {
	Build(missionId: number, parent: Instance): { groundTargets: Model[] } {
		Workspace.FindFirstChild("World")?.Destroy(); Workspace.Terrain.Clear();
		const mission = getMission(missionId); const style = environment(mission.environment);
		const scenery = new Instance("Folder"); scenery.Name = `Mission${string.format("%02d", missionId)}World`; scenery.SetAttribute("MissionId", missionId); scenery.SetAttribute("EnvironmentPreset", mission.environment); scenery.Parent = parent;
		const ocean = part(scenery, "Ocean", new Vector3(7600, 4, 7600), new Vector3(0, -18, 0), style.ocean, Enum.Material.SmoothPlastic); ocean.Reflectance = mission.environment === "storm_night" ? 0.05 : 0.14;
		const accent = mission.act === 1 ? Color3.fromRGB(61, 220, 201) : mission.act === 2 ? Color3.fromRGB(247, 164, 73) : Color3.fromRGB(239, 94, 75);
		for (let index = 0; index < mission.islands.size(); index++) { const placement = mission.islands[index]; island(placement, style); if (placement.apron) apron(scenery, placement, accent); islandVillage(scenery, placement, missionId, index); if (placement.apron) runway(scenery, placement, missionId); }
		for (const item of mission.scenery ?? []) authoredScenery(scenery, item);
		missionLandmarks(scenery, missionId);
		const groundTargets = new Array<Model>();
		for (const placement of mission.targets) { const model = targetModel(placement); model.Parent = parent; groundTargets.push(model); }
		return { groundTargets };
	},
	RestoreMenu(): void { Workspace.Terrain.Clear(); clearMissionEnvironment(); WorldBuilder.Build(); },
};
