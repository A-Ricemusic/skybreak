import { destroyWorld } from "./WorldDisposal";
import { JetFactory } from "../shared/JetFactory";
import { Lighting, Workspace } from "@rbxts/services";
import { GameConfig } from "../shared/GameConfig";
import { CONTROL_TOWER_BASE, CONTROL_TOWER_PARTS, HANGAR_PARTS, HANGAR_PLACEMENTS, MENU_JET_POSITION, MENU_JET_SCALE, MENU_JET_YAW, MenuPartSpec } from "../shared/MenuWorldGeometry";

interface PartOptions {
	className?: "Part" | "WedgePart";
	canCollide?: boolean;
	canTouch?: boolean;
	canQuery?: boolean;
	castShadow?: boolean;
	transparency?: number;
	reflectance?: number;
	shape?: Enum.PartType;
}

const COLORS = {
	ocean: Color3.fromRGB(22, 80, 116),
	deepRock: Color3.fromRGB(40, 57, 64),
	rock: Color3.fromRGB(70, 82, 78),
	grass: Color3.fromRGB(83, 116, 79),
	sand: Color3.fromRGB(190, 172, 119),
	runway: Color3.fromRGB(42, 47, 52),
	concrete: Color3.fromRGB(116, 125, 130),
	white: Color3.fromRGB(232, 239, 235),
	cyan: Color3.fromRGB(47, 220, 231),
	navy: Color3.fromRGB(22, 38, 61),
	orange: Color3.fromRGB(255, 154, 67),
};

function makePart(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material = Enum.Material.SmoothPlastic,
	options: PartOptions = {},
): BasePart {
	const object = (options.className === "WedgePart" ? new Instance("WedgePart") : new Instance("Part")) as BasePart;
	object.Name = name;
	object.Size = size;
	object.CFrame = cframe;
	object.Color = color;
	object.Material = material;
	object.Anchored = true;
	object.CanCollide = options.canCollide !== false;
	object.CanTouch = options.canTouch === true;
	object.CanQuery = options.canQuery !== false;
	object.CastShadow = options.castShadow !== false;
	if (options.transparency !== undefined) object.Transparency = options.transparency;
	if (options.reflectance !== undefined) object.Reflectance = options.reflectance;
	if (options.shape !== undefined && object.IsA("Part")) object.Shape = options.shape;
	object.Parent = parent;
	return object;
}

function addLight(parent: Instance, color: Color3, brightness: number, range: number): PointLight {
	const light = new Instance("PointLight");
	light.Color = color;
	light.Brightness = brightness;
	light.Range = range;
	light.Shadows = false;
	light.Parent = parent;
	return light;
}

function buildLighting(): void {
	Lighting.ClockTime = 16.35;
	Lighting.Brightness = 2.25;
	Lighting.ExposureCompensation = 0.08;
	Lighting.Ambient = Color3.fromRGB(78, 91, 108);
	Lighting.OutdoorAmbient = Color3.fromRGB(122, 135, 148);
	Lighting.EnvironmentDiffuseScale = 0.45;
	Lighting.EnvironmentSpecularScale = 0.65;
	Lighting.GlobalShadows = true;

	Lighting.FindFirstChild("SkybreakAtmosphere")?.Destroy();
	const atmosphere = new Instance("Atmosphere");
	atmosphere.Name = "SkybreakAtmosphere";
	atmosphere.Color = Color3.fromRGB(188, 222, 232);
	atmosphere.Decay = Color3.fromRGB(91, 125, 147);
	atmosphere.Density = 0.23;
	atmosphere.Glare = 0.14;
	atmosphere.Haze = 1.35;
	atmosphere.Offset = 0.08;
	atmosphere.Parent = Lighting;

	Lighting.FindFirstChild("SkybreakColor")?.Destroy();
	const color = new Instance("ColorCorrectionEffect");
	color.Name = "SkybreakColor";
	color.Brightness = 0.01;
	color.Contrast = 0.08;
	color.Saturation = -0.03;
	color.TintColor = Color3.fromRGB(238, 247, 255);
	color.Parent = Lighting;

	Lighting.FindFirstChild("SkybreakBloom")?.Destroy();
	const bloom = new Instance("BloomEffect");
	bloom.Name = "SkybreakBloom";
	bloom.Intensity = 0.18;
	bloom.Size = 22;
	bloom.Threshold = 1.4;
	bloom.Parent = Lighting;

	Workspace.Terrain.FindFirstChild("SkybreakClouds")?.Destroy();
	const clouds = new Instance("Clouds");
	clouds.Name = "SkybreakClouds";
	clouds.Color = Color3.fromRGB(232, 239, 244);
	clouds.Cover = 0.28;
	clouds.Density = 0.3;
	clouds.Parent = Workspace.Terrain;
}

function buildIsland(parent: Instance, name: string, center: Vector3, scale: Vector3, mountainHeight: number): Model {
	const model = new Instance("Model");
	model.Name = name;
	model.Parent = parent;
	makePart(model, "CliffBase", new Vector3(scale.X, 32, scale.Z), new CFrame(center.X, -8, center.Z), COLORS.deepRock, Enum.Material.Slate);
	makePart(model, "SandShelf", new Vector3(scale.X + 32, 8, scale.Z + 32), new CFrame(center.X, 6, center.Z), COLORS.sand, Enum.Material.Sand);
	makePart(model, "GreenShelf", new Vector3(scale.X - 18, 12, scale.Z - 18), new CFrame(center.X, 15, center.Z), COLORS.grass, Enum.Material.Grass);

	const peakY = 21 + mountainHeight / 2;
	makePart(model, "MountainA", new Vector3(scale.X * 0.45, mountainHeight, scale.Z * 0.42), new CFrame(center.X - scale.X * 0.12, peakY, center.Z).mul(CFrame.Angles(0, math.rad(18), 0)), COLORS.rock, Enum.Material.Rock, { className: "WedgePart" });
	makePart(model, "MountainB", new Vector3(scale.X * 0.35, mountainHeight * 0.7, scale.Z * 0.32), new CFrame(center.X + scale.X * 0.18, 21 + mountainHeight * 0.35, center.Z - scale.Z * 0.12).mul(CFrame.Angles(0, math.rad(205), 0)), COLORS.deepRock, Enum.Material.Slate, { className: "WedgePart" });
	makePart(model, "SunFace", new Vector3(scale.X * 0.23, mountainHeight * 0.55, scale.Z * 0.24), new CFrame(center.X, 21 + mountainHeight * 0.275, center.Z + scale.Z * 0.2).mul(CFrame.Angles(0, math.rad(-25), 0)), COLORS.grass, Enum.Material.Grass, { className: "WedgePart" });
	return model;
}

interface HangarPartStyle {
	color: Color3;
	material: Enum.Material;
}

const HANGAR_STYLES: Record<string, HangarPartStyle> = {
	Floor: { color: COLORS.concrete, material: Enum.Material.Concrete },
	LeftWall: { color: COLORS.concrete, material: Enum.Material.Metal },
	RightWall: { color: COLORS.concrete, material: Enum.Material.Metal },
	Back: { color: COLORS.navy, material: Enum.Material.Metal },
	DoorHeader: { color: COLORS.orange, material: Enum.Material.Metal },
	Roof: { color: COLORS.deepRock, material: Enum.Material.Metal },
};

function placeMenuBuilding(
	parent: Instance,
	modelName: string,
	pivot: CFrame,
	specs: ReadonlyArray<MenuPartSpec>,
	style: (name: string) => HangarPartStyle,
): Model {
	const model = new Instance("Model");
	model.Name = modelName;
	model.Parent = parent;
	for (const spec of specs) {
		const { color, material } = style(spec.name);
		makePart(model, spec.name, spec.size, pivot.mul(new CFrame(spec.offset)), color, material);
	}
	return model;
}

function buildHangar(parent: Instance, center: Vector3, facing: number): Model {
	const pivot = new CFrame(center).mul(CFrame.Angles(0, facing, 0));
	return placeMenuBuilding(parent, "Hangar", pivot, HANGAR_PARTS, (name) => HANGAR_STYLES[name]);
}

function buildDisplayJet(parent: Instance): Model {
	const model = JetFactory.Create("DisplayJet", false);
	for (const item of model.GetDescendants()) {
		if (JetFactory.IsCosmetic(item)) item.Enabled = false;
	}
	model.ScaleTo(MENU_JET_SCALE);
	// Shared with the client menu camera; the geometry test keeps this clear of every building.
	model.PivotTo(new CFrame(MENU_JET_POSITION).mul(CFrame.Angles(0, MENU_JET_YAW, 0)));
	model.Parent = parent;
	return model;
}

function buildAirbase(parent: Instance): Model {
	const airbase = new Instance("Model");
	airbase.Name = "GlassHorizonAirbase";
	airbase.Parent = parent;
	makePart(airbase, "IslandRock", new Vector3(570, 26, 990), new CFrame(0, -5, 0), COLORS.deepRock, Enum.Material.Slate);
	makePart(airbase, "IslandSand", new Vector3(600, 7, 1020), new CFrame(0, 9, 0), COLORS.sand, Enum.Material.Sand);
	makePart(airbase, "IslandPlateau", new Vector3(545, 8, 965), new CFrame(0, 15, 0), COLORS.grass, Enum.Material.Grass);
	makePart(airbase, "RunwayShoulder", new Vector3(112, 3, 900), new CFrame(0, 20.5, 0), COLORS.concrete, Enum.Material.Concrete);
	makePart(airbase, "Runway", new Vector3(88, 2, 872), new CFrame(0, 23, 0), COLORS.runway, Enum.Material.Asphalt);
	for (let z = -350; z <= 350; z += 50) makePart(airbase, "CenterMark", new Vector3(2.5, 0.25, 22), new CFrame(0, 24.15, z), COLORS.white, Enum.Material.SmoothPlastic, { canCollide: false });
	for (const endZ of [-405, 405]) for (let stripe = -3; stripe <= 3; stripe++) makePart(airbase, "ThresholdMark", new Vector3(7, 0.25, 30), new CFrame(stripe * 10, 24.15, endZ), COLORS.white, Enum.Material.SmoothPlastic, { canCollide: false });
	// Taxiways run from the runway shoulder (x ±56) to the apron edge (x ±100) and
	// stop there: a taxiway slab continuing under an apron puts two same-facing
	// top faces in one plane, which z-fights under the menu camera sway.
	makePart(airbase, "WestTaxiway", new Vector3(44, 2, 28), new CFrame(-78, 22.5, 115), COLORS.runway, Enum.Material.Asphalt);
	makePart(airbase, "EastTaxiway", new Vector3(44, 2, 28), new CFrame(78, 22.5, -105), COLORS.runway, Enum.Material.Asphalt);
	makePart(airbase, "WestApron", new Vector3(170, 2, 190), new CFrame(-185, 22.5, 115), COLORS.concrete, Enum.Material.Concrete);
	makePart(airbase, "EastApron", new Vector3(170, 2, 190), new CFrame(185, 22.5, -105), COLORS.concrete, Enum.Material.Concrete);
	for (const placement of HANGAR_PLACEMENTS) buildHangar(airbase, placement.center, placement.facing);

	const tower = new Instance("Model");
	tower.Name = "ControlTower";
	tower.Parent = airbase;
	const towerBase = new CFrame(CONTROL_TOWER_BASE);
	const towerStyle: Record<string, { color: Color3; material: Enum.Material; options: PartOptions }> = {
		Base: { color: COLORS.concrete, material: Enum.Material.Concrete, options: {} },
		Cab: { color: Color3.fromRGB(55, 104, 122), material: Enum.Material.Glass, options: { transparency: 0.18 } },
		Roof: { color: COLORS.navy, material: Enum.Material.Metal, options: {} },
		Antenna: { color: COLORS.white, material: Enum.Material.Metal, options: { canCollide: false } },
		Beacon: {
			color: COLORS.orange,
			material: Enum.Material.Neon,
			options: { shape: Enum.PartType.Ball, canCollide: false },
		},
	};
	let beacon: BasePart | undefined;
	for (const spec of CONTROL_TOWER_PARTS) {
		const style = towerStyle[spec.name];
		const part = makePart(
			tower,
			spec.name,
			spec.size,
			towerBase.mul(new CFrame(spec.offset)),
			style.color,
			style.material,
			style.options,
		);
		if (spec.name === "Beacon") beacon = part;
	}
	assert(beacon !== undefined, "Control tower spec must include a Beacon part");
	addLight(beacon, COLORS.orange, 2, 35);
	for (const z of [-470, -440, 440, 470]) for (const x of [-34, 34]) {
		const approach = makePart(airbase, "ApproachLight", new Vector3(2, 2, 2), new CFrame(x, 23, z), COLORS.cyan, Enum.Material.Neon, { shape: Enum.PartType.Ball, canCollide: false });
		addLight(approach, COLORS.cyan, 0.8, 14);
	}
	for (let index = 1; index <= 3; index++) makePart(airbase, "FuelTank", new Vector3(24, 24, 24), new CFrame(-255 + index * 34, 36, -245), COLORS.white, Enum.Material.Metal, { shape: Enum.PartType.Ball });
	buildDisplayJet(airbase);
	return airbase;
}

export const WorldBuilder = {
	Build(): { World: Folder; MenuCamera: CFrame } {
		destroyWorld(Workspace.FindFirstChild("World"));
		buildLighting();
		const world = new Instance("Folder");
		world.Name = "World";
		world.Parent = Workspace;
		const ocean = new Instance("Folder");
		ocean.Name = "Ocean";
		ocean.Parent = world;
		for (let tileX = -1; tileX <= 1; tileX++) for (let tileZ = -1; tileZ <= 1; tileZ++) {
			makePart(ocean, `Tile_${tileX}_${tileZ}`, new Vector3(2000, 4, 2000), new CFrame(tileX * 2000, GameConfig.World.OceanY - 2, tileZ * 2000), COLORS.ocean, Enum.Material.SmoothPlastic, { canCollide: false, canTouch: false, reflectance: 0.12 });
		}
		buildAirbase(world);
		buildIsland(world, "NorthwestIsland", new Vector3(-1050, 0, -950), new Vector3(480, 1, 390), 70);
		buildIsland(world, "NortheastIsland", new Vector3(1220, 0, -1200), new Vector3(580, 1, 430), 76);
		buildIsland(world, "SouthwestIsland", new Vector3(-1380, 0, 1120), new Vector3(420, 1, 520), 64);
		buildIsland(world, "EasternIsland", new Vector3(1550, 0, 620), new Vector3(330, 1, 410), 58);
		const lighthouseBase = makePart(world, "Lighthouse", new Vector3(18, 62, 18), new CFrame(1450, 58, 620), COLORS.white, Enum.Material.Concrete);
		const lighthouseLamp = makePart(world, "LighthouseLamp", new Vector3(24, 9, 24), new CFrame(1450, 94, 620), COLORS.cyan, Enum.Material.Glass, { transparency: 0.18 });
		addLight(lighthouseLamp, COLORS.cyan, 3, 60);
		lighthouseBase.Color = COLORS.white;
		return { World: world, MenuCamera: GameConfig.World.MenuCamera };
	},
};
