import { Lighting, Workspace } from "@rbxts/services";
import { AuroraLineManifest, MissionEnvironment, MissionTheme } from "../shared/AuroraLineManifest";
import { MissionAssets } from "../shared/MissionAssets";
import { WorldBuilder } from "./WorldBuilder";

// A single-player place has one mission world. Terrain and lighting are owned
// by this lifecycle; combat owns the parent folder and destroys it on exit.
//
// Aurora Line generalization: each mission has a MissionEnvironment that drives
// lighting, atmosphere, clouds, color grade, ocean color, and a theme that
// selects a distinct scenery composition. Mission 01 and Mission 02 preserve
// their exact training coast and iron coast layouts.

function part(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3, material: Enum.Material = Enum.Material.Concrete): Part {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.Position = position;
	p.Color = color;
	p.Material = material;
	p.Anchored = true;
	p.CanCollide = false;
	p.CanTouch = false;
	p.CanQuery = false;
	p.Parent = parent;
	return p;
}
function partCF(parent: Instance, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material = Enum.Material.Concrete, options: { shape?: Enum.PartType; transparency?: number; reflectance?: number } = {}): Part {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.CFrame = cframe;
	p.Color = color;
	p.Material = material;
	p.Anchored = true;
	p.CanCollide = false;
	p.CanTouch = false;
	p.CanQuery = false;
	if (options.shape !== undefined) p.Shape = options.shape;
	if (options.transparency !== undefined) p.Transparency = options.transparency;
	if (options.reflectance !== undefined) p.Reflectance = options.reflectance;
	p.Parent = parent;
	return p;
}

function clearEnvironmentArtifacts(): void {
	for (const name of ["SkybreakAtmosphere", "SkybreakColor", "SkybreakBloom", "MissionAtmosphere", "MissionGrade", "MissionSky", "MissionAurora"]) {
		Lighting.FindFirstChild(name)?.Destroy();
	}
	for (const name of ["MissionClouds", "SkybreakClouds"]) Workspace.Terrain.FindFirstChild(name)?.Destroy();
}

function toColor3(rgb: readonly [number, number, number] | readonly number[]): Color3 {
	return new Color3(rgb[0], rgb[1], rgb[2]);
}

function applyEnvironment(env: MissionEnvironment): void {
	clearEnvironmentArtifacts();
	Lighting.ClockTime = env.clockTime;
	Lighting.Brightness = env.theme === "aurora_night" || env.theme === "ceasefire_truth" ? 1.6 : 2.3;
	Lighting.ExposureCompensation = env.theme === "volcanic_refuge" ? 0.1 : 0.05;
	Lighting.Ambient = toColor3(env.ambient);
	Lighting.OutdoorAmbient = toColor3(env.outdoorAmbient);
	Lighting.GlobalShadows = true;

	const sky = new Instance("Sky");
	sky.Name = "MissionSky";
	sky.StarCount = env.theme === "aurora_night" || env.theme === "ceasefire_truth" ? 2600 : 0;
	sky.Parent = Lighting;

	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "MissionAtmosphere";
	atmosphere.Density = env.fogDensity;
	atmosphere.Offset = 0.1;
	atmosphere.Color = toColor3(env.fogColor);
	atmosphere.Decay = toColor3(env.fogDecay);
	atmosphere.Haze = env.theme === "snow_coast" || env.theme === "glacier" ? 1.6 : 1.2;
	atmosphere.Glare = env.theme === "aurora_night" ? 0.3 : 0.14;
	atmosphere.Parent = Lighting;

	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "MissionGrade";
	grade.Saturation = env.theme === "glacier" ? 0.02 : env.theme === "volcanic_refuge" ? 0.14 : 0.08;
	grade.Contrast = 0.08;
	grade.Brightness = 0.02;
	grade.TintColor = env.theme === "aurora_night"
		? new Color3(0.78, 0.9, 1)
		: env.theme === "volcanic_refuge"
			? new Color3(1, 0.86, 0.74)
			: new Color3(1, 1, 1);
	grade.Parent = Lighting;

	const clouds = new Instance("Clouds");
	clouds.Name = "MissionClouds";
	clouds.Cover = env.cloudCover;
	clouds.Density = env.theme === "snow_coast" || env.theme === "evacuation_run" ? 0.5 : 0.35;
	clouds.Color = toColor3(env.cloudColor);
	clouds.Parent = Workspace.Terrain;

	if (env.auroraBand !== undefined) {
		// Approximate an aurora band with a colored, additive color-correction tint
		// and a soft bloom. The band is a readable minimum-cost signal.
		const aurora = new Instance("BloomEffect");
		aurora.Name = "MissionAurora";
		aurora.Intensity = 0.35;
		aurora.Threshold = 0.6;
		aurora.Size = 48;
		aurora.Parent = Lighting;
	}
}

function island(x: number, z: number, radius: number, height: number, groundMaterial: Enum.Material = Enum.Material.Grass): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, height - radius - 36, z), radius + 28, Enum.Material.Sand);
	terrain.FillBall(new Vector3(x, height - radius, z), radius, Enum.Material.Rock);
	terrain.FillBall(new Vector3(x, height - radius + 10, z), radius - 8, groundMaterial);
}

function iceSheet(x: number, z: number, radius: number): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, -6, z), radius, Enum.Material.Glacier);
}

function volcanicPeak(x: number, z: number, radius: number, height: number): void {
	const terrain = Workspace.Terrain;
	terrain.FillBall(new Vector3(x, height - radius, z), radius, Enum.Material.Basalt);
	terrain.FillBall(new Vector3(x, height - radius + 24, z), radius - 32, Enum.Material.Rock);
}

function apron(parent: Instance, x: number, z: number, width: number, depth: number): void {
	Workspace.Terrain.FillBlock(new CFrame(x, 300, z), new Vector3(width + 100, 512, depth + 100), Enum.Material.Air);
	Workspace.Terrain.FillBlock(new CFrame(x, 14, z), new Vector3(width + 80, 60, depth + 80), Enum.Material.Rock);
	part(parent, "Apron", new Vector3(width, 4, depth), new Vector3(x, 46, z), Color3.fromRGB(103, 111, 117));
	for (const side of [-1, 1]) {
		part(parent, "SafetyLine", new Vector3(3, 0.3, depth - 10), new Vector3(x + side * (width / 2 - 7), 48.2, z), Color3.fromRGB(235, 185, 68), Enum.Material.SmoothPlastic);
	}
}

function grounded(model: Model, x: number, z: number, yaw = 0): Model {
	const [bounds, size] = model.GetBoundingBox();
	const bottom = bounds.Position.Y - size.Y / 2;
	model.PivotTo(new CFrame(x, 49 - bottom, z).mul(CFrame.Angles(0, yaw, 0)));
	return model;
}

interface Decor {
	readonly oceanTileColor: Color3;
	readonly oceanReflectance: number;
}

function themeDecor(env: MissionEnvironment): Decor {
	return {
		oceanTileColor: toColor3(env.oceanColor),
		oceanReflectance: env.oceanReflectance,
	};
}

function fillOcean(scenery: Instance, decor: Decor): void {
	for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
		const ocean = part(scenery, "Ocean", new Vector3(2000, 4, 2000), new Vector3(x * 2000, -18, z * 2000), decor.oceanTileColor, Enum.Material.SmoothPlastic);
		ocean.Reflectance = decor.oceanReflectance;
	}
}

// Positions for ground target compounds, parameterized so each theme can space
// them differently while sharing one safe-to-fly envelope.
function compoundPositions(count: number): Vector3[] {
	const positions = new Array<Vector3>();
	if (count === 1) return [new Vector3(0, 0, -850)];
	if (count === 2) return [new Vector3(-500, 0, -950), new Vector3(500, 0, -950)];
	if (count === 3) return [new Vector3(-600, 0, -950), new Vector3(0, 0, -1150), new Vector3(600, 0, -950)];
	if (count === 4) return [
		new Vector3(-700, 0, -950), new Vector3(-250, 0, -1250), new Vector3(250, 0, -1250), new Vector3(700, 0, -950),
	];
	if (count === 5) return [
		new Vector3(-550, 0, -900), new Vector3(0, 0, -1100), new Vector3(550, 0, -900),
		new Vector3(-350, 0, -1550), new Vector3(350, 0, -1550),
	];
	// Fallback: ring layout.
	for (let i = 0; i < count; i++) {
		const angle = (i / count) * math.pi * 2;
		positions.push(new Vector3(math.cos(angle) * 700, 0, -950 + math.sin(angle) * 350));
	}
	return positions;
}

function buildPreservedMission1(scenery: Folder, parent: Instance): Model[] {
	island(0, -850, 440, 70);
	island(-1000, -1450, 460, 125);
	island(1200, -1350, 510, 135);
	island(-1450, 650, 350, 95);
	island(1600, 350, 400, 110);
	apron(scenery, 0, -850, 210, 240);
	const radar = grounded(MissionAssets.CreateRadar("TRAINING RADAR"), 0, -850);
	radar.Parent = parent;
	island(-650, 450, 510, 48);
	Workspace.Terrain.FillBlock(new CFrame(-650, 308, 450), new Vector3(140, 512, 760), Enum.Material.Air);
	part(scenery, "TrainingRunway", new Vector3(100, 4, 720), new Vector3(-650, 50, 450), Color3.fromRGB(39, 48, 57), Enum.Material.Asphalt);
	for (let i = -3; i <= 3; i++) part(scenery, "RunwayStripe", new Vector3(4, 0.2, 48), new Vector3(-650, 52.2, 450 + i * 90), Color3.fromRGB(236, 235, 211), Enum.Material.SmoothPlastic);
	return [radar];
}

function buildPreservedMission2(scenery: Folder, parent: Instance): Model[] {
	const positions = compoundPositions(5);
	const warehouses: Model[] = [];
	for (const p of positions) island(p.X, p.Z, 390, 62);
	for (let i = 0; i < positions.size(); i++) {
		const p = positions[i];
		apron(scenery, p.X, p.Z, 190, 210);
		const warehouse = grounded(MissionAssets.CreateWarehouse(`WAREHOUSE ${i + 1}`), p.X, p.Z, (i % 2) * math.pi / 2);
		warehouse.Parent = parent;
		warehouses.push(warehouse);
		part(scenery, "AccessRoad", new Vector3(24, 2, 220), new Vector3(p.X, 44, p.Z + 180), Color3.fromRGB(57, 64, 70), Enum.Material.Asphalt);
		for (let j = 0; j < 3; j++) part(scenery, "ShippingContainer", new Vector3(14, 12, 35), new Vector3(p.X + 115, 50, p.Z - 50 + j * 43), j % 2 === 0 ? Color3.fromRGB(145, 83, 52) : Color3.fromRGB(50, 91, 112), Enum.Material.CorrodedMetal);
	}
	island(-1500, -1500, 570, 180);
	island(1450, -1600, 600, 185);
	island(1600, 500, 450, 125);
	island(-1450, 500, 490, 135);
	part(scenery, "Breakwater", new Vector3(1500, 30, 45), new Vector3(0, 8, -2050), Color3.fromRGB(80, 86, 89), Enum.Material.Rock);
	for (const x of [-750, 750]) {
		part(scenery, "CraneTower", new Vector3(9, 110, 9), new Vector3(x, 64, -1850), Color3.fromRGB(211, 157, 63), Enum.Material.Metal);
		part(scenery, "CraneBoom", new Vector3(150, 9, 9), new Vector3(x + 45, 115, -1850), Color3.fromRGB(211, 157, 63), Enum.Material.Metal);
	}
	return warehouses;
}

function createGroundAsset(asset: "Radar" | "Warehouse" | "AuroraBeacon" | "SupplyConvoy", name: string): Model {
	if (asset === "Radar") return MissionAssets.CreateRadar(name);
	if (asset === "Warehouse") return MissionAssets.CreateWarehouse(name);
	if (asset === "AuroraBeacon") return MissionAssets.CreateAuroraBeacon(name);
	return MissionAssets.CreateSupplyConvoy(name);
}

interface ThemeStyle {
	readonly groundMaterial: Enum.Material;
	readonly islandPeakHeight: number;
	readonly addsIce: boolean;
	readonly addsVolcanic: boolean;
}

function themeStyle(theme: MissionTheme): ThemeStyle {
	if (theme === "snow_coast" || theme === "evacuation_run") return { groundMaterial: Enum.Material.Snow, islandPeakHeight: 75, addsIce: true, addsVolcanic: false };
	if (theme === "aurora_night") return { groundMaterial: Enum.Material.Snow, islandPeakHeight: 60, addsIce: true, addsVolcanic: false };
	if (theme === "volcanic_refuge") return { groundMaterial: Enum.Material.Basalt, islandPeakHeight: 160, addsIce: false, addsVolcanic: true };
	if (theme === "glacier") return { groundMaterial: Enum.Material.Glacier, islandPeakHeight: 100, addsIce: true, addsVolcanic: false };
	if (theme === "port") return { groundMaterial: Enum.Material.Concrete, islandPeakHeight: 55, addsIce: false, addsVolcanic: false };
	if (theme === "polar_sea") return { groundMaterial: Enum.Material.Snow, islandPeakHeight: 50, addsIce: true, addsVolcanic: false };
	if (theme === "ceasefire_truth") return { groundMaterial: Enum.Material.Slate, islandPeakHeight: 90, addsIce: false, addsVolcanic: false };
	// Preserved themes keep grass.
	return { groundMaterial: Enum.Material.Grass, islandPeakHeight: 80, addsIce: false, addsVolcanic: false };
}

function buildGeneralMission(scenery: Folder, parent: Instance, missionId: number): { groundTargets: Model[]; protectedAsset?: Model; protectedRoute?: readonly [Vector3, Vector3] } {
	const planData = AuroraLineManifest.GetPlan(missionId);
	const style = themeStyle(planData.environment.theme);
	// Shared decorator islands around the fight bowl.
	island(-1300, -1450, 520, style.islandPeakHeight + 24, style.groundMaterial);
	island(1300, -1600, 540, style.islandPeakHeight + 36, style.groundMaterial);
	island(-1500, 650, 430, style.islandPeakHeight + 8, style.groundMaterial);
	island(1550, 500, 430, style.islandPeakHeight, style.groundMaterial);
	if (style.addsIce) {
		iceSheet(-2200, -500, 320);
		iceSheet(2100, -1200, 400);
	}
	if (style.addsVolcanic) {
		volcanicPeak(-1700, -2000, 300, 230);
		volcanicPeak(1600, -2100, 260, 210);
	}
	// Ground target compounds.
	const hasStrike = planData.steps.some((step) => step.kind === "strike");
	const hasEscort = planData.steps.some((step) => step.kind === "escort");
	const hasProtect = planData.steps.some((step) => step.kind === "protect");
	const positions = compoundPositions(hasStrike ? planData.groundTargets.count : 0);
	const groundTargets: Model[] = [];
	for (let i = 0; i < positions.size(); i++) {
		const p = positions[i];
		island(p.X, p.Z, 360, 60, style.groundMaterial);
		apron(scenery, p.X, p.Z, 180, 200);
		const label = `${planData.groundTargets.asset === "Warehouse" ? "WAREHOUSE"
			: planData.groundTargets.asset === "Radar" ? "RADAR"
			: planData.groundTargets.asset === "AuroraBeacon" ? "BEACON"
			: "CONVOY"} ${string.format("%02d", i + 1)}`;
		const model = grounded(createGroundAsset(planData.groundTargets.asset, label), p.X, p.Z, (i * math.pi) / 3);
		model.Parent = parent;
		groundTargets.push(model);
		// Decorative access paths; purely cosmetic.
		part(scenery, "AccessRoad", new Vector3(20, 2, 180), new Vector3(p.X, 44, p.Z + 160), Color3.fromRGB(60, 60, 65), Enum.Material.Asphalt);
	}
	// Theme flourishes that act as visual anchors.
	if (planData.environment.auroraBand !== undefined) {
		for (let i = 0; i < 8; i++) {
			const sx = -1900 + i * 500;
			const beacon = partCF(scenery, "AuroraPillar", new Vector3(10, 6, 10), new CFrame(sx, 900, -1800), toColor3(planData.environment.auroraBand), Enum.Material.Neon, { transparency: 0.25 });
			beacon.CastShadow = false;
		}
	}
	if (planData.environment.volcanicGlow !== undefined) {
		for (const x of [-1700, 1600]) {
			const glow = partCF(scenery, "LavaGlow", new Vector3(80, 2, 80), new CFrame(x, 110, -2050), toColor3(planData.environment.volcanicGlow), Enum.Material.Neon, { transparency: 0.35 });
			glow.CastShadow = false;
		}
	}
	if (planData.environment.theme === "port") {
		part(scenery, "Pier", new Vector3(1200, 6, 60), new Vector3(0, 23, -1900), Color3.fromRGB(94, 83, 72), Enum.Material.WoodPlanks);
		for (const x of [-500, 0, 500]) {
			part(scenery, "DockCrane", new Vector3(10, 90, 10), new Vector3(x, 68, -1920), Color3.fromRGB(220, 160, 60), Enum.Material.Metal);
			part(scenery, "DockBoom", new Vector3(120, 8, 8), new Vector3(x + 40, 110, -1920), Color3.fromRGB(220, 160, 60), Enum.Material.Metal);
		}
	}
	if (planData.environment.theme === "glacier") {
		for (let i = 0; i < 4; i++) part(scenery, "GlacierShelf", new Vector3(260, 32, 260), new Vector3(-500 + i * 350, 32, 2200), Color3.fromRGB(220, 232, 240), Enum.Material.Glacier);
	}
	let protectedAsset: Model | undefined;
	let protectedRoute: readonly [Vector3, Vector3] | undefined;
	if (hasEscort || hasProtect) {
		const asset = hasEscort ? "SupplyConvoy" : "AuroraBeacon";
		protectedAsset = grounded(createGroundAsset(asset, hasEscort ? "AURORA RELIEF CONVOY" : "CIVILIAN REFUGE"), -850, 850, math.pi / 2);
		protectedAsset.SetAttribute("FriendlyObjective", true);
		protectedAsset.SetAttribute("Health", 100);
		protectedAsset.Parent = parent;
		protectedRoute = [new Vector3(-850, protectedAsset.PrimaryPart!.Position.Y, 850), new Vector3(850, protectedAsset.PrimaryPart!.Position.Y, -350)];
		// An authored road makes convoy movement legible without adding collision.
		partCF(scenery, "ReliefRoute", new Vector3(28, 2, 2200), CFrame.lookAt(new Vector3(0, 43, 250), new Vector3(850, 43, -350)), Color3.fromRGB(75, 82, 86), Enum.Material.Asphalt);
	}
	return { groundTargets, protectedAsset, protectedRoute };
}

export const MissionWorld = {
	Build(missionId: number, parent: Instance): { groundTargets: Model[]; protectedAsset?: Model; protectedRoute?: readonly [Vector3, Vector3] } {
		const planData = AuroraLineManifest.GetPlan(missionId);
		Workspace.FindFirstChild("World")?.Destroy();
		Workspace.Terrain.Clear();
		applyEnvironment(planData.environment);
		const scenery = new Instance("Folder");
		scenery.Name = `MissionWorld_${string.format("%02d", missionId)}_${planData.environment.theme}`;
		scenery.Parent = parent;
		fillOcean(scenery, themeDecor(planData.environment));
		let groundTargets: Model[];
		let protectedAsset: Model | undefined;
		let protectedRoute: readonly [Vector3, Vector3] | undefined;
		if (missionId === 1) {
			groundTargets = buildPreservedMission1(scenery, parent);
		} else if (missionId === 2) {
			groundTargets = buildPreservedMission2(scenery, parent);
		} else {
			const general = buildGeneralMission(scenery, parent, missionId);
			groundTargets = general.groundTargets;
			protectedAsset = general.protectedAsset;
			protectedRoute = general.protectedRoute;
		}
		return { groundTargets, protectedAsset, protectedRoute };
	},
	RestoreMenu(): void {
		Workspace.Terrain.Clear();
		clearEnvironmentArtifacts();
		WorldBuilder.Build();
	},
};
