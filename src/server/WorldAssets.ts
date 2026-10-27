import type { AircraftAssetName } from "../shared/AssetSelection";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetName, UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";

/**
 * Placement hooks for the uploaded world set (docs/roblox-asset-pipeline.md).
 *
 * World builders call e.g. `WorldAssets.PlaceFrigate(scene, cframe)` where
 * `cframe` is the ground contact point (the waterline for the frigate, oil
 * platform and quay) with -Z as the asset's front. When the asset's ID is set
 * in RobloxAssetIds and loads, the uploaded model is cloned there. Otherwise a
 * simple part shape is built for the assets the campaign needs to exist
 * (frigate, platform, quay, buildings) and nothing for dressing (cranes, masts,
 * trees, rocks), returning undefined so the caller keeps its own primitives.
 *
 * Placement never loads or yields: world builders call `WorldAssets.Preload` with
 * every asset the world uses first (bounded by PRELOAD_TIMEOUT), and a model still
 * loading after that deadline takes its fallback for this build. A late load
 * fills the cache for the next world without changing the one already built.
 *
 * Branch on what a placement returns, not on a prior check: a model whose
 * `GeometrySource` is "Uploaded" means the uploaded mesh is in the world;
 * "Fallback" or undefined means the caller's own scenery is still needed. A
 * first load can fail (not owned, moderated, untextured, misshapen), and then
 * every later placement of that asset takes the fallback for this server.
 * `PlaceUploaded` places only the uploaded mesh and returns undefined otherwise.
 */
export type WorldAssetName = Exclude<UploadedAssetName, AircraftAssetName>;

/** Seconds a world build waits for its uploaded templates before placing fallbacks. */
export const PRELOAD_TIMEOUT = 30;
let preloadTimeout = PRELOAD_TIMEOUT;

interface FallbackPart {
	name: string;
	size: Vector3;
	/** Centre offset from the ground contact point, in the placement frame. */
	offset: Vector3;
	color: Color3;
	material: Enum.Material;
	/** A WedgePart (full height at its local +Z) instead of a block. */
	wedge?: boolean;
	/** Turn about Y, radians, after the offset. */
	yaw?: number;
	/** Not flight-solid (thin conductors). */
	decor?: boolean;
}

const grey = Color3.fromRGB(139, 147, 154);
const concrete = Color3.fromRGB(160, 158, 150);
const asphalt = Color3.fromRGB(54, 58, 62);
const yellow = Color3.fromRGB(201, 178, 60);
/** A flat box `size` whose centre sits `lift` above the ground contact. */
const slab = (name: string, size: Vector3, lift: number, color: Color3, material: Enum.Material): FallbackPart => ({ name, size, offset: new Vector3(0, lift, 0), color, material });
/** Runway pieces: concrete shoulders under a 100-wide asphalt strip, both sunk a stud like the uploaded slab. */
const runwayFallback = (size: Vector3): FallbackPart[] => [
	slab("Shoulder", new Vector3(130, 1.6, size.Z), -0.2, concrete, Enum.Material.Concrete),
	slab("Runway", new Vector3(100, 2, size.Z), 0, asphalt, Enum.Material.Asphalt),
];
/** A backdrop ridge as two wedges meeting at a crest along local X (the uploaded ridge's lowest crest height). */
const ridgeFallback = (size: Vector3, color: Color3): FallbackPart[] => {
	const height = 1270, depth = size.Z / 2;
	return [
		{ name: "Ridge", size: new Vector3(size.X, height, depth), offset: new Vector3(0, height / 2 - 30, -depth / 2), color, material: Enum.Material.Rock, wedge: true },
		{ name: "Ridge", size: new Vector3(size.X, height, depth), offset: new Vector3(0, height / 2 - 30, depth / 2), color: color.Lerp(Color3.fromRGB(40, 50, 60), 0.15), material: Enum.Material.Rock, wedge: true, yaw: math.pi },
	];
};
const block = (name: string, color: Color3, material: Enum.Material = Enum.Material.Concrete) => (spec: Vector3): FallbackPart[] => [
	{ name, size: spec, offset: new Vector3(0, spec.Y / 2, 0), color, material },
];

const FALLBACKS: Partial<Record<WorldAssetName, (size: Vector3) => FallbackPart[]>> = {
	Frigate: () => [
		{ name: "Hull", size: new Vector3(52, 42, 400), offset: new Vector3(0, 5, 0), color: grey, material: Enum.Material.Metal },
		{ name: "Superstructure", size: new Vector3(36, 26, 190), offset: new Vector3(0, 39, 30), color: grey, material: Enum.Material.Metal },
		{ name: "Mast", size: new Vector3(12, 50, 16), offset: new Vector3(0, 74, -29), color: grey, material: Enum.Material.Metal },
	],
	OilPlatform: () => {
		const legs: FallbackPart[] = [];
		for (const x of [-80, 80]) for (const z of [-64, 64]) {
			legs.push({ name: "Leg", size: new Vector3(7, 125, 7), offset: new Vector3(x, 2.5, z), color: Color3.fromRGB(201, 178, 60), material: Enum.Material.Metal });
		}
		return [
			...legs,
			{ name: "Deck", size: new Vector3(220, 34, 180), offset: new Vector3(0, 79, 0), color: Color3.fromRGB(93, 98, 102), material: Enum.Material.DiamondPlate },
			{ name: "Derrick", size: new Vector3(24, 120, 24), offset: new Vector3(45, 156, -20), color: Color3.fromRGB(181, 69, 46), material: Enum.Material.Metal },
		];
	},
	HarbourQuay: () => [
		{ name: "Quay", size: new Vector3(240, 52, 70), offset: new Vector3(0, -14, 0), color: concrete, material: Enum.Material.Concrete },
	],
	ContainerStack: block("Containers", Color3.fromRGB(140, 58, 43), Enum.Material.CorrodedMetal),
	Hangar: block("Hangar", concrete),
	ControlTower: block("Tower", concrete),
	OfficeMidrise: block("Office", Color3.fromRGB(185, 180, 168)),
	ApartmentBlock: block("Apartments", Color3.fromRGB(210, 199, 178)),
	CityTower: block("Tower", Color3.fromRGB(63, 79, 88), Enum.Material.Glass),
	Farmhouse: block("Farmhouse", Color3.fromRGB(227, 222, 210), Enum.Material.WoodPlanks),
	Barn: block("Barn", Color3.fromRGB(138, 59, 44), Enum.Material.WoodPlanks),
	GrainSilo: block("Silo", Color3.fromRGB(180, 182, 179), Enum.Material.Metal),
	// Bigger-worlds set: plain slabs and shapes in the asset's footprint until the upload is approved.
	RunwaySegment: (size) => runwayFallback(size),
	RunwayThreshold: (size) => runwayFallback(size),
	ApronSlab: (size) => [slab("Apron", new Vector3(64, 2, size.Z), 0, concrete, Enum.Material.Concrete)],
	RoadSegment: (size) => [slab("Road", new Vector3(22, 1, size.Z), 0.2, asphalt, Enum.Material.Asphalt)],
	DirtTrack: (size) => [slab("Track", new Vector3(20, 0.8, size.Z), 0.1, Color3.fromRGB(128, 104, 78), Enum.Material.Ground)],
	RoadBridge: () => {
		const parts = [slab("Deck", new Vector3(36, 2.7, 230), 2.85, concrete, Enum.Material.Concrete)];
		for (const z of [-132.5, 132.5]) parts.push({ ...slab("Ramp", new Vector3(36, 4, 35), 1.5, concrete, Enum.Material.Concrete), offset: new Vector3(0, 1.5, z) });
		for (const z of [-40, 40]) parts.push({ ...slab("Pier", new Vector3(30, 11, 5), -6.5, concrete, Enum.Material.Concrete), offset: new Vector3(0, -6.5, z) });
		for (const x of [-17.5, 17.5]) parts.push({ ...slab("Parapet", new Vector3(1, 3, 300), 5.5, concrete, Enum.Material.Concrete), offset: new Vector3(x, 5.5, 0) });
		return parts;
	},
	TargetPad: (size) => [slab("Hardstand", size, 0, Color3.fromRGB(90, 103, 108), Enum.Material.Concrete)],
	StoreDeck: () => {
		const parts = [slab("Store deck", new Vector3(150, 4, 150), 62, Color3.fromRGB(93, 98, 102), Enum.Material.DiamondPlate)];
		for (const x of [-60, 60]) for (const z of [-60, 60]) parts.push({ name: "Deck leg", size: new Vector3(7, 80, 7), offset: new Vector3(x, 20, z), color: yellow, material: Enum.Material.Metal });
		return parts;
	},
	Gangway: () => [
		slab("Walkway", new Vector3(10, 0.6, 60), -0.3, Color3.fromRGB(150, 150, 146), Enum.Material.Metal),
		{ name: "Rail", size: new Vector3(0.4, 0.4, 60), offset: new Vector3(-4.8, 4, 0), color: yellow, material: Enum.Material.Metal },
		{ name: "Rail", size: new Vector3(0.4, 0.4, 60), offset: new Vector3(4.8, 4, 0), color: yellow, material: Enum.Material.Metal },
	],
	EquipmentHut: block("Shelter", Color3.fromRGB(96, 104, 108), Enum.Material.Metal),
	CivicHall: () => [
		{ name: "Hall", size: new Vector3(230, 66, 100), offset: new Vector3(0, 33, 24), color: Color3.fromRGB(199, 191, 165), material: Enum.Material.Concrete },
		{ name: "Portico", size: new Vector3(210, 60, 32), offset: new Vector3(0, 30, -42), color: Color3.fromRGB(224, 216, 193), material: Enum.Material.Marble },
		{ name: "Steps", size: new Vector3(200, 3, 18), offset: new Vector3(0, 1.5, -67), color: Color3.fromRGB(214, 206, 182), material: Enum.Material.Concrete },
	],
	CliffSandstone: () => [{ name: "Rock face", size: new Vector3(240, 160, 53), offset: new Vector3(0, 78, 1.8), color: Color3.fromRGB(192, 132, 88), material: Enum.Material.Sandstone }],
	CliffGranite: () => [{ name: "Rock face", size: new Vector3(240, 160, 53), offset: new Vector3(0, 78, 1.8), color: Color3.fromRGB(116, 112, 104), material: Enum.Material.Rock }],
	RidgeAlpine: (size) => ridgeFallback(size, Color3.fromRGB(104, 110, 102)),
	RidgeDesert: (size) => ridgeFallback(size, Color3.fromRGB(176, 122, 84)),
	// Thin dressing keeps its fallback to a few parts: a world full of fence and power-line runs stays in budget.
	FenceSpan: () => [{ name: "Rail", size: new Vector3(0.5, 0.6, 60), offset: new Vector3(0.3, 3.2, 0), color: Color3.fromRGB(139, 122, 99), material: Enum.Material.Wood }],
	PowerLineSpan: (size) => {
		const pylon = -(size.Z / 2 - 7);
		return [
			{ name: "Pylon", size: new Vector3(4, 70, 4), offset: new Vector3(0, 34.5, pylon), color: Color3.fromRGB(143, 148, 150), material: Enum.Material.Metal },
			{ name: "Wires", size: new Vector3(0.4, 0.4, 300), offset: new Vector3(0, 52.5, pylon + 150), color: Color3.fromRGB(58, 60, 62), material: Enum.Material.Metal, decor: true },
		];
	},
};
/** Assets placed without flight collision: the backdrop ring stands wholly past the hard boundary. */
const DECOR_ASSETS = new Set<WorldAssetName>(["RidgeAlpine", "RidgeDesert"]);

/** Scenery parts are flight-solid: the collision query hits the rendered geometry. Decor parts are not queried at all. */
function solid(part: BasePart, flight = true): void {
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = flight;
	part.SetAttribute("FlightSolid", flight);
	part.CastShadow = false;
}

/**
 * The uploaded model placed at `cframe` (scaled about its ground contact by `scale`), or undefined
 * when it has no ID or failed to load or place. Every clone shares the cached template's mesh and
 * SurfaceAppearance content, so the engine draws repeated props (trees, rocks) as instanced batches.
 */
function placeUploaded(name: WorldAssetName, parent: Instance, cframe: CFrame, scale = 1): Model | undefined {
	const spec = UploadedAssetSpecs[name];
	const uploaded = UploadedAssets.Cached([name]);
	if (uploaded === undefined) return undefined;
	const model = uploaded.template.Clone();
	const [ok, result] = pcall(() => {
		model.Name = name;
		const decor = DECOR_ASSETS.has(name);
		for (const item of model.GetDescendants()) if (item.IsA("BasePart")) solid(item, !decor && !(spec.decorParts ?? []).includes(item.Name));
		// Template pivot is the model's bottom centre (scaling keeps it fixed); the ground contact sits groundOffset above it.
		if (scale !== 1) model.ScaleTo(model.GetScale() * scale);
		model.PivotTo(cframe.mul(new CFrame(0, -spec.groundOffset * scale, 0)));
		model.Parent = parent;
	});
	if (ok) return model;
	model.Destroy();
	warn(`Uploaded ${name} could not be placed; using the fallback: ${tostring(result)}`);
	return undefined;
}

function place(name: WorldAssetName, parent: Instance, cframe: CFrame, scale = 1): Model | undefined {
	const spec = UploadedAssetSpecs[name];
	const uploaded = placeUploaded(name, parent, cframe, scale);
	if (uploaded !== undefined) return uploaded;
	const fallback = FALLBACKS[name];
	if (fallback === undefined) return undefined;
	const model = new Instance("Model");
	model.Name = name;
	model.SetAttribute("GeometrySource", "Fallback");
	for (const shape of fallback(spec.size)) {
		const part = shape.wedge ? new Instance("WedgePart") : new Instance("Part");
		part.Name = shape.name;
		part.Size = shape.size.mul(scale);
		part.CFrame = cframe.mul(new CFrame(shape.offset.mul(scale))).mul(CFrame.Angles(0, shape.yaw ?? 0, 0));
		part.Color = shape.color;
		part.Material = shape.material;
		solid(part, shape.decor !== true && !DECOR_ASSETS.has(name));
		part.Parent = model;
	}
	model.WorldPivot = cframe;
	model.Parent = parent;
	return model;
}

export const WorldAssets = {
	/**
	 * True when the uploaded model for `name` is loaded and valid (never loads or yields; call
	 * Preload first). A hint for planning only: check what Place/PlaceUploaded return.
	 */
	Has(name: WorldAssetName): boolean {
		return UploadedAssets.Cached([name]) !== undefined;
	},
	/** Loads every template in parallel, waiting at most the preload timeout; returns the names still loading. */
	Preload(names: WorldAssetName[]): WorldAssetName[] {
		return UploadedAssets.Preload(names, preloadTimeout) as WorldAssetName[];
	},
	/** Test hook: shorten (or restore, with no argument) the preload deadline. */
	SetPreloadTimeout(seconds = PRELOAD_TIMEOUT): void {
		preloadTimeout = seconds;
	},
	/** Authored size in studs (bounding box) and ground/waterline offset above the lowest point. */
	Spec(name: WorldAssetName) {
		return UploadedAssetSpecs[name];
	},
	Place: place,
	PlaceUploaded: placeUploaded,
	PlaceFrigate: (parent: Instance, cframe: CFrame) => place("Frigate", parent, cframe),
	PlaceOilPlatform: (parent: Instance, cframe: CFrame) => place("OilPlatform", parent, cframe),
	PlaceQuay: (parent: Instance, cframe: CFrame) => place("HarbourQuay", parent, cframe),
	PlaceContainerStack: (parent: Instance, cframe: CFrame) => place("ContainerStack", parent, cframe),
	PlaceGantryCrane: (parent: Instance, cframe: CFrame) => place("GantryCrane", parent, cframe),
	PlaceHangar: (parent: Instance, cframe: CFrame) => place("Hangar", parent, cframe),
	PlaceControlTower: (parent: Instance, cframe: CFrame) => place("ControlTower", parent, cframe),
	PlaceOffice: (parent: Instance, cframe: CFrame) => place("OfficeMidrise", parent, cframe),
	PlaceApartmentBlock: (parent: Instance, cframe: CFrame) => place("ApartmentBlock", parent, cframe),
	PlaceCityTower: (parent: Instance, cframe: CFrame) => place("CityTower", parent, cframe),
	PlaceFarmhouse: (parent: Instance, cframe: CFrame) => place("Farmhouse", parent, cframe),
	PlaceBarn: (parent: Instance, cframe: CFrame) => place("Barn", parent, cframe),
	PlaceGrainSilo: (parent: Instance, cframe: CFrame) => place("GrainSilo", parent, cframe),
	PlaceRadarDish: (parent: Instance, cframe: CFrame) => place("RadarDish", parent, cframe),
	PlaceRelayMast: (parent: Instance, cframe: CFrame) => place("RelayMast", parent, cframe),
	PlaceTree: (parent: Instance, cframe: CFrame, broadleaf = false) => place(broadleaf ? "Broadleaf" : "Pine", parent, cframe),
	PlaceRock: (parent: Instance, cframe: CFrame, variant: 0 | 1 | 2 = 0) => place((["RockA", "RockB", "RockC"] as const)[variant], parent, cframe),
	// Bigger-worlds set. Modular pieces (runway, apron, road, track, fence, power line, gangway) take a uniform
	// scale so a whole number of them fills a run (WorldPlan.tilePieces); the fallback scales with them.
	PlacePiece: (name: WorldAssetName, parent: Instance, cframe: CFrame, scale = 1) => place(name, parent, cframe, scale),
	PlaceTargetPad: (parent: Instance, cframe: CFrame, scale = 1) => place("TargetPad", parent, cframe, scale),
	PlaceRoadBridge: (parent: Instance, cframe: CFrame) => place("RoadBridge", parent, cframe),
	PlaceCliffFace: (parent: Instance, cframe: CFrame, sandstone: boolean, scale = 1) => place(sandstone ? "CliffSandstone" : "CliffGranite", parent, cframe, scale),
	PlaceBackdropRidge: (parent: Instance, cframe: CFrame, desert: boolean, scale = 1) => place(desert ? "RidgeDesert" : "RidgeAlpine", parent, cframe, scale),
};
