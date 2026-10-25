import { Lighting, Workspace } from "@rbxts/services";
import { BiomeId, GroundTargetSpec, MissionCatalog } from "../shared/MissionCatalog";
import { MissionAssets } from "../shared/MissionAssets";
import { WorldBuilder } from "./WorldBuilder";

// One place owns one disposable world. Every mission selects an authored
// composition transform in addition to its catalog layout, biome and targets.
interface Composition {
	yaw: number;
	dx: number;
	dz: number;
	landmark: "village" | "lighthouse" | "wreck" | "windfarm" | "foundry" | "ice" | "convoy";
}

const COMPOSITIONS: Composition[] = [
	{ yaw: 0, dx: 0, dz: 0, landmark: "village" },
	{ yaw: 0.08, dx: 80, dz: -40, landmark: "foundry" },
	{ yaw: -0.16, dx: -120, dz: 100, landmark: "convoy" },
	{ yaw: 0.24, dx: 150, dz: 20, landmark: "lighthouse" },
	{ yaw: -0.31, dx: -70, dz: -130, landmark: "wreck" },
	{ yaw: 0.39, dx: 110, dz: 120, landmark: "windfarm" },
	{ yaw: -0.48, dx: -160, dz: -30, landmark: "lighthouse" },
	{ yaw: 0.56, dx: 40, dz: -150, landmark: "village" },
	{ yaw: -0.63, dx: 170, dz: 90, landmark: "convoy" },
	{ yaw: 0.71, dx: -90, dz: 160, landmark: "ice" },
	{ yaw: -0.78, dx: 130, dz: -110, landmark: "lighthouse" },
	{ yaw: 0.86, dx: -180, dz: 40, landmark: "convoy" },
	{ yaw: -0.94, dx: 60, dz: 180, landmark: "village" },
	{ yaw: 1.02, dx: 180, dz: -80, landmark: "windfarm" },
	{ yaw: -1.10, dx: -130, dz: -160, landmark: "wreck" },
	{ yaw: 1.18, dx: 20, dz: 130, landmark: "village" },
	{ yaw: -1.26, dx: 150, dz: 150, landmark: "convoy" },
	{ yaw: 1.34, dx: -170, dz: -100, landmark: "foundry" },
	{ yaw: -1.42, dx: 100, dz: 40, landmark: "ice" },
	{ yaw: 1.50, dx: -40, dz: -180, landmark: "foundry" },
	{ yaw: -1.58, dx: 190, dz: 10, landmark: "wreck" },
	{ yaw: 1.66, dx: -110, dz: 120, landmark: "windfarm" },
	{ yaw: -1.74, dx: 30, dz: -120, landmark: "convoy" },
	{ yaw: 1.82, dx: 140, dz: 170, landmark: "foundry" },
	{ yaw: -1.90, dx: -190, dz: -10, landmark: "ice" },
	{ yaw: 1.98, dx: 90, dz: -170, landmark: "foundry" },
	{ yaw: -2.06, dx: -30, dz: 80, landmark: "village" },
];

interface Palette {
	ocean: Color3;
	rock: Enum.Material;
	ground: Enum.Material;
	clock: number;
	atmosphere: Color3;
	decay: Color3;
	cloudCover: number;
	cloudDensity: number;
	saturation: number;
	contrast: number;
}

const PALETTES: Record<BiomeId, Palette> = {
	warm_coast: { ocean: Color3.fromRGB(29, 125, 151), rock: Enum.Material.Rock, ground: Enum.Material.Grass, clock: 9.8, atmosphere: Color3.fromRGB(187, 224, 235), decay: Color3.fromRGB(111, 153, 174), cloudCover: 0.18, cloudDensity: 0.28, saturation: 0.12, contrast: 0.05 },
	burning_coast: { ocean: Color3.fromRGB(45, 82, 102), rock: Enum.Material.Slate, ground: Enum.Material.Ground, clock: 17.7, atmosphere: Color3.fromRGB(226, 166, 128), decay: Color3.fromRGB(91, 67, 74), cloudCover: 0.48, cloudDensity: 0.46, saturation: -0.08, contrast: 0.16 },
	harbor_dusk: { ocean: Color3.fromRGB(38, 94, 122), rock: Enum.Material.Slate, ground: Enum.Material.Grass, clock: 18.35, atmosphere: Color3.fromRGB(175, 163, 193), decay: Color3.fromRGB(86, 92, 130), cloudCover: 0.30, cloudDensity: 0.33, saturation: -0.02, contrast: 0.13 },
	storm_sea: { ocean: Color3.fromRGB(31, 59, 73), rock: Enum.Material.Slate, ground: Enum.Material.Mud, clock: 13.0, atmosphere: Color3.fromRGB(108, 129, 143), decay: Color3.fromRGB(55, 68, 83), cloudCover: 0.86, cloudDensity: 0.82, saturation: -0.32, contrast: 0.22 },
	cold_overcast: { ocean: Color3.fromRGB(47, 85, 103), rock: Enum.Material.Slate, ground: Enum.Material.Ground, clock: 11.2, atmosphere: Color3.fromRGB(165, 190, 202), decay: Color3.fromRGB(92, 112, 127), cloudCover: 0.64, cloudDensity: 0.52, saturation: -0.18, contrast: 0.10 },
	iron_north: { ocean: Color3.fromRGB(38, 64, 76), rock: Enum.Material.Basalt, ground: Enum.Material.Slate, clock: 15.4, atmosphere: Color3.fromRGB(151, 157, 158), decay: Color3.fromRGB(81, 72, 70), cloudCover: 0.70, cloudDensity: 0.58, saturation: -0.28, contrast: 0.24 },
	home_renewed: { ocean: Color3.fromRGB(31, 121, 145), rock: Enum.Material.Rock, ground: Enum.Material.LeafyGrass, clock: 7.3, atmosphere: Color3.fromRGB(222, 210, 182), decay: Color3.fromRGB(111, 151, 169), cloudCover: 0.12, cloudDensity: 0.22, saturation: 0.18, contrast: 0.08 },
};

function part(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3, material: Enum.Material = Enum.Material.Concrete): Part {
	const item = new Instance("Part");
	item.Name = name;
	item.Size = size;
	item.Position = position;
	item.Color = color;
	item.Material = material;
	item.Anchored = true;
	item.CanCollide = false;
	item.CanTouch = false;
	item.CanQuery = false;
	item.Parent = parent;
	return item;
}

function transform(x: number, z: number, composition: Composition): Vector3 {
	const cosine = math.cos(composition.yaw);
	const sine = math.sin(composition.yaw);
	return new Vector3(x * cosine - z * sine + composition.dx, 0, x * sine + z * cosine + composition.dz);
}

function environment(biome: BiomeId): Palette {
	for (const name of ["SkybreakAtmosphere", "SkybreakColor", "MissionAtmosphere", "MissionGrade", "MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
	Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
	Workspace.Terrain.FindFirstChild("SkybreakClouds")?.Destroy();
	const palette = PALETTES[biome];
	Lighting.ClockTime = palette.clock;
	Lighting.Brightness = biome === "storm_sea" ? 1.65 : 2.25;
	Lighting.ExposureCompensation = biome === "iron_north" ? -0.12 : 0.04;
	Lighting.Ambient = Color3.fromRGB(99, 111, 122);
	Lighting.OutdoorAmbient = Color3.fromRGB(137, 146, 151);
	const sky = new Instance("Sky");
	sky.Name = "MissionSky";
	sky.StarCount = biome === "harbor_dusk" ? 700 : 0;
	sky.Parent = Lighting;
	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "MissionAtmosphere";
	atmosphere.Density = biome === "storm_sea" ? 0.39 : 0.23;
	atmosphere.Offset = 0.08;
	atmosphere.Color = palette.atmosphere;
	atmosphere.Decay = palette.decay;
	atmosphere.Haze = biome === "storm_sea" ? 3.1 : 1.15;
	atmosphere.Glare = biome === "home_renewed" ? 0.22 : 0.08;
	atmosphere.Parent = Lighting;
	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "MissionGrade";
	grade.Saturation = palette.saturation;
	grade.Contrast = palette.contrast;
	grade.Parent = Lighting;
	const clouds = new Instance("Clouds");
	clouds.Name = "MissionClouds";
	clouds.Cover = palette.cloudCover;
	clouds.Density = palette.cloudDensity;
	clouds.Color = biome === "storm_sea" ? Color3.fromRGB(112, 123, 128) : Color3.fromRGB(232, 237, 239);
	clouds.Parent = Workspace.Terrain;
	return palette;
}

function island(position: Vector3, radius: number, height: number, palette: Palette): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(position.X, height - radius - 36, position.Z), radius + 28, Enum.Material.Sand);
	terrain.FillBall(new Vector3(position.X, height - radius, position.Z), radius, palette.rock);
	terrain.FillBall(new Vector3(position.X, height - radius + 10, position.Z), radius - 8, palette.ground);
}

function apron(parent: Instance, position: Vector3, width: number, depth: number, yaw: number): void {
	Workspace.Terrain.FillBlock(new CFrame(position.X, 300, position.Z).mul(CFrame.Angles(0, yaw, 0)), new Vector3(width + 100, 512, depth + 100), Enum.Material.Air);
	Workspace.Terrain.FillBlock(new CFrame(position.X, 14, position.Z).mul(CFrame.Angles(0, yaw, 0)), new Vector3(width + 80, 60, depth + 80), Enum.Material.Rock);
	const pad = part(parent, "ObjectiveApron", new Vector3(width, 4, depth), new Vector3(position.X, 46, position.Z), Color3.fromRGB(91, 99, 104));
	pad.CFrame = new CFrame(pad.Position).mul(CFrame.Angles(0, yaw, 0));
}

function placeModel(model: Model, position: Vector3, surfaceY: number, yaw: number): Model {
	const [bounds, size] = model.GetBoundingBox();
	const bottom = bounds.Position.Y - size.Y / 2;
	model.PivotTo(new CFrame(position.X, surfaceY - bottom, position.Z).mul(CFrame.Angles(0, yaw, 0)));
	return model;
}

function landmark(parent: Instance, composition: Composition, missionId: number): void {
	const center = transform(0, 1150, composition);
	if (composition.landmark === "lighthouse") {
		part(parent, "LighthouseTower", new Vector3(22, 150, 22), new Vector3(center.X, 95, center.Z), Color3.fromRGB(224, 218, 199), Enum.Material.Concrete);
		part(parent, "LighthouseLamp", new Vector3(32, 16, 32), new Vector3(center.X, 178, center.Z), Color3.fromRGB(255, 194, 82), Enum.Material.Neon);
	} else if (composition.landmark === "foundry") {
		for (let index = 0; index < 4; index++) part(parent, "FoundryStack", new Vector3(28, 160 + index * 14, 28), new Vector3(center.X + (index - 1.5) * 70, 90 + index * 7, center.Z), Color3.fromRGB(83, 69, 63), Enum.Material.CorrodedMetal);
	} else if (composition.landmark === "windfarm") {
		for (let index = 0; index < 4; index++) {
			const x = center.X + (index - 1.5) * 170;
			part(parent, "WindMast", new Vector3(8, 145, 8), new Vector3(x, 90, center.Z), Color3.fromRGB(198, 205, 202), Enum.Material.Metal);
			part(parent, "WindBlade", new Vector3(10, 120, 5), new Vector3(x, 162, center.Z), Color3.fromRGB(230, 232, 225), Enum.Material.SmoothPlastic).CFrame = new CFrame(x, 162, center.Z).mul(CFrame.Angles(0, 0, missionId * 0.31 + index));
		}
	} else if (composition.landmark === "ice") {
		for (let index = 0; index < 7; index++) part(parent, "IceFloe", new Vector3(100 + index * 13, 8, 75 + (index % 3) * 22), new Vector3(center.X + (index - 3) * 150, -12, center.Z + math.sin(index * 2) * 170), Color3.fromRGB(190, 218, 225), Enum.Material.Glacier);
	} else if (composition.landmark === "convoy") {
		for (let index = 0; index < 3; index++) {
			const ship = MissionAssets.CreateLifeboat(`CONVOY ${index + 1}`);
			placeModel(ship, new Vector3(center.X + (index - 1) * 120, 0, center.Z + index * 85), -16, composition.yaw + math.pi / 2).Parent = parent;
		}
	} else if (composition.landmark === "wreck") {
		const wreck = part(parent, "WreckedHull", new Vector3(210, 28, 62), new Vector3(center.X, -4, center.Z), Color3.fromRGB(91, 62, 48), Enum.Material.CorrodedMetal);
		wreck.CFrame = new CFrame(wreck.Position).mul(CFrame.Angles(0.08, composition.yaw + 0.35, -0.12));
	} else {
		for (let index = 0; index < 7; index++) part(parent, "Home", new Vector3(34, 22 + (index % 2) * 8, 30), new Vector3(center.X + (index - 3) * 48, 58, center.Z + math.sin(index * 1.7) * 55), index % 2 === 0 ? Color3.fromRGB(216, 184, 138) : Color3.fromRGB(174, 206, 191), Enum.Material.WoodPlanks);
	}
}

function createTarget(spec: GroundTargetSpec, position: Vector3, yaw: number): Model {
	if (spec.kind === "radar") return placeModel(MissionAssets.CreateRadar(spec.name), position, 48, yaw);
	if (spec.kind === "warehouse") return placeModel(MissionAssets.CreateWarehouse(spec.name), position, 48, yaw);
	return placeModel(MissionAssets.CreateLifeboat(spec.name), position, -16, yaw);
}

export const MissionWorld = {
	Build(missionId: number, parent: Instance): { groundTargets: Model[]; protectedCraft: Model[]; compositionKey: string } {
		const mission = MissionCatalog.Require(missionId);
		const layout = MissionCatalog.Layout(mission.layoutId);
		const composition = COMPOSITIONS[missionId - 1];
		assert(composition !== undefined, "Mission composition is missing");
		Workspace.FindFirstChild("World")?.Destroy();
		Workspace.Terrain.Clear();
		const palette = environment(mission.biome);
		const scenery = new Instance("Folder");
		scenery.Name = string.format("M%02d_%s", missionId, mission.layoutId);
		scenery.SetAttribute("MissionId", missionId);
		scenery.SetAttribute("Biome", mission.biome);
		scenery.SetAttribute("Composition", `${mission.layoutId}:${missionId}:${composition.landmark}`);
		scenery.Parent = parent;
		for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
			const ocean = part(scenery, "Ocean", new Vector3(2000, 4, 2000), new Vector3(x * 2000, -18, z * 2000), palette.ocean, Enum.Material.SmoothPlastic);
			ocean.Reflectance = mission.biome === "storm_sea" ? 0.04 : 0.14;
		}
		for (const source of layout.islands) island(transform(source.x, source.z, composition), source.radius, source.height, palette);
		if (layout.apron) apron(scenery, transform(layout.apron.x, layout.apron.z, composition), layout.apron.width, layout.apron.depth, composition.yaw);
		landmark(scenery, composition, missionId);

		const groundTargets: Model[] = [];
		const protectedCraft: Model[] = [];
		const requiredGround = MissionCatalog.TotalRequiredGroundKills(missionId);
		const targets = mission.targets ?? layout.targets;
		for (const spec of targets) {
			const position = transform(spec.x, spec.z, composition);
			if (spec.kind !== "lifeboat") apron(scenery, position, spec.kind === "radar" ? 120 : 150, spec.kind === "radar" ? 120 : 175, composition.yaw + (spec.yaw ?? 0));
			const model = createTarget(spec, position, composition.yaw + (spec.yaw ?? 0));
			model.SetAttribute("ProtectedObjective", spec.kind === "lifeboat");
			model.Parent = parent;
			if (spec.kind === "lifeboat") protectedCraft.push(model);
			else if (groundTargets.size() < requiredGround) groundTargets.push(model);
			else model.SetAttribute("DecorativeObjective", true);
		}
		return { groundTargets, protectedCraft, compositionKey: `${mission.biome}:${mission.layoutId}:${missionId}:${composition.landmark}` };
	},
	RestoreMenu(): void {
		Workspace.Terrain.Clear();
		Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
		for (const name of ["MissionAtmosphere", "MissionGrade", "MissionSky"]) Lighting.FindFirstChild(name)?.Destroy();
		WorldBuilder.Build();
	},
};
