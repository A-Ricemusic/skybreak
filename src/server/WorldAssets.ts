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
}

const grey = Color3.fromRGB(139, 147, 154);
const concrete = Color3.fromRGB(160, 158, 150);
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
};

/** Scenery parts are flight-solid: the collision query hits the rendered geometry. */
function solid(part: BasePart): void {
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = true;
	part.SetAttribute("FlightSolid", true);
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
		for (const item of model.GetDescendants()) if (item.IsA("BasePart")) solid(item);
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
		const part = new Instance("Part");
		part.Name = shape.name;
		part.Size = shape.size.mul(scale);
		part.CFrame = cframe.mul(new CFrame(shape.offset.mul(scale)));
		part.Color = shape.color;
		part.Material = shape.material;
		solid(part);
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
};
