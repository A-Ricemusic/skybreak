import { InsertService, RunService } from "@rbxts/services";
import { AssetSelection, ImportedPart, SURFACE_MAPS, SurfaceMap } from "./AssetSelection";
import { RobloxAssetIds } from "./RobloxAssetIds";
import { UploadedAssetName, UploadedAssetSpecs } from "./UploadedAssetSpecs";

/** Loads one uploaded asset; returns InsertService's container (or any Instance holding the parts). */
export type AssetLoader = (assetId: number) => Instance;
/** True when a SurfaceAppearance carries the given map. */
export type AppearanceProbe = (appearance: SurfaceAppearance, map: SurfaceMap) => boolean;

interface CacheEntry {
	template?: Model;
	loading: boolean;
}

const defaultLoader: AssetLoader = (assetId) => InsertService.LoadAsset(assetId);
// The *Map setters are plugin-only, but game scripts can read the Content values.
const MAP_CONTENT: Record<SurfaceMap, (appearance: SurfaceAppearance) => Content> = {
	ColorMap: (appearance) => appearance.ColorMapContent,
	NormalMap: (appearance) => appearance.NormalMapContent,
	RoughnessMap: (appearance) => appearance.RoughnessMapContent,
	MetalnessMap: (appearance) => appearance.MetalnessMapContent,
};
const defaultProbe: AppearanceProbe = (appearance, map) => MAP_CONTENT[map](appearance).SourceType !== Enum.ContentSourceType.None;
let loader: AssetLoader = defaultLoader;
let probe: AppearanceProbe = defaultProbe;
let ids: Partial<Record<UploadedAssetName, number | undefined>> = RobloxAssetIds;
const cache = new Map<number, CacheEntry>();
const failed = new Set<number>();

function hasMap(appearance: SurfaceAppearance, map: SurfaceMap): boolean {
	const [ok, result] = pcall(probe, appearance, map);
	return ok && result === true;
}

function describe(part: BasePart): ImportedPart {
	const appearance = part.FindFirstChildWhichIsA("SurfaceAppearance");
	const maps: Partial<Record<SurfaceMap, boolean>> = {};
	if (appearance !== undefined) for (const map of SURFACE_MAPS) maps[map] = hasMap(appearance, map);
	return { name: part.Name, meshPart: part.IsA("MeshPart"), appearance: appearance !== undefined, maps };
}

function components(size: Vector3): number[] {
	return [size.X, size.Y, size.Z];
}

/**
 * Turn whatever LoadAsset returned into one cached Model: every part must be a
 * MeshPart whose SurfaceAppearance kept all four of the FBX's embedded maps
 * (aircraft must keep Body, every control surface and every glass part by exact
 * name), anchored, non-colliding, glass parts (the v2 canopy) see-through,
 * scaled with Model:ScaleTo to the in-game size and moved so the pivot is the
 * authored origin (bounds centre for aircraft, bottom centre for world props). Throws on anything else so the
 * caller falls back to the procedural asset.
 */
function normalise(container: Instance, name: UploadedAssetName, assetId: number): Model {
	const spec = UploadedAssetSpecs[name];
	const model = new Instance("Model");
	model.Name = `Uploaded${name}`;
	const [ok, result] = pcall(() => {
		const seen: ImportedPart[] = [];
		for (const item of container.GetDescendants()) {
			if (!item.IsA("BasePart")) continue;
			const part = item.Clone();
			// Nested parts are cloned separately by the outer loop; retain only one
			// normalised copy. Keep appearances, but drop scripts and joints too.
			for (const child of part.GetDescendants()) {
				if (child.IsA("BasePart") || child.IsA("LuaSourceContainer") || child.IsA("JointInstance") || child.IsA("Constraint")) child.Destroy();
			}
			part.Anchored = true;
			part.CanCollide = false;
			part.CanTouch = false;
			part.CanQuery = false;
			const transparency = AssetSelection.PartTransparency(part.Name, spec.glassParts);
			if (transparency !== undefined) part.Transparency = transparency;
			part.Parent = model;
			seen.push(describe(part));
		}
		const required = spec.kind === "aircraft" ? AssetSelection.RequiredAircraftParts(spec.controlSurfaces, spec.glassParts) : [];
		const problem = AssetSelection.AppearanceProblem(seen, required);
		assert(problem === undefined, problem);
		const [, size] = model.GetBoundingBox();
		const scale = AssetSelection.FitScale(components(size), components(spec.size));
		assert(scale !== undefined, `implausible size ${tostring(size)} for in-game ${tostring(spec.size)}`);
		if (scale !== 1) model.ScaleTo(model.GetScale() * scale);
		const [box, scaled] = model.GetBoundingBox();
		const origin = spec.kind === "aircraft" ? box.Position : box.Position.sub(new Vector3(0, scaled.Y / 2, 0));
		for (const part of model.GetChildren()) {
			if (part.IsA("BasePart")) part.CFrame = part.CFrame.sub(origin);
		}
		model.WorldPivot = new CFrame();
		model.SetAttribute("GeometrySource", "Uploaded");
		model.SetAttribute("AssetId", assetId);
		model.SetAttribute("UploadedAsset", name);
		model.SetAttribute("ImportScale", scale);
	});
	container.Destroy();
	if (!ok) {
		model.Destroy();
		error(`${name} asset ${assetId}: ${tostring(result)}`, 0);
	}
	return model;
}

export const UploadedAssets = {
	/**
	 * The cached, normalised template for the first usable candidate, or undefined
	 * when no candidate has an ID (or every candidate failed to load). Yields
	 * while loading; concurrent callers share one load per asset ID.
	 */
	Template(candidates: UploadedAssetName[]): { name: UploadedAssetName; template: Model } | undefined {
		for (;;) {
			const choice = AssetSelection.Resolve(ids, candidates, failed);
			if (choice === undefined) return undefined;
			let entry = cache.get(choice.assetId);
			if (entry === undefined) {
				entry = { loading: false };
				cache.set(choice.assetId, entry);
			}
			while (entry.loading) task.wait();
			if (entry.template !== undefined) return { name: choice.name, template: entry.template };
			if (failed.has(choice.assetId)) continue;
			assert(RunService.IsServer() || (RunService.IsStudio() && !RunService.IsRunning()), "Uploaded assets load on the server");
			entry.loading = true;
			const [ok, result] = pcall(() => normalise(loader(choice.assetId), choice.name, choice.assetId));
			entry.loading = false;
			if (ok) {
				entry.template = result;
				return { name: choice.name, template: result };
			}
			failed.add(choice.assetId);
			warn(`Uploaded ${choice.name} (asset ${choice.assetId}) failed to load; using the fallback: ${tostring(result)}`);
		}
	},
	/**
	 * The cached template for the first usable candidate, without loading or yielding: undefined
	 * while that candidate's load is pending, never started or failed. World placement uses this
	 * after Preload, so a load still running past the deadline takes the fallback for that build.
	 */
	Cached(candidates: UploadedAssetName[]): { name: UploadedAssetName; template: Model } | undefined {
		const choice = AssetSelection.Resolve(ids, candidates, failed);
		const template = choice === undefined ? undefined : cache.get(choice.assetId)?.template;
		return choice !== undefined && template !== undefined ? { name: choice.name, template } : undefined;
	},
	/**
	 * Starts every named load at once (shared with Template, so nothing loads twice) and waits up
	 * to `timeout` seconds for them. Returns the names still loading at the deadline; those loads
	 * keep running and fill the cache for a later build, but never hold this one.
	 */
	Preload(names: UploadedAssetName[], timeout: number): UploadedAssetName[] {
		const deadline = os.clock() + timeout;
		const loading = (name: UploadedAssetName) => {
			const choice = AssetSelection.Resolve(ids, [name], failed);
			return choice !== undefined && cache.get(choice.assetId)?.loading === true;
		};
		for (const name of names) {
			// A load still running from an earlier build is not started again.
			if (loading(name) || UploadedAssets.Cached([name]) !== undefined) continue;
			task.spawn(() => pcall(() => UploadedAssets.Template([name])));
		}
		while (names.some(loading) && os.clock() < deadline) task.wait();
		return names.filter(loading);
	},
	/**
	 * True when an uploaded model would still be tried for this name (ID present and
	 * not failed). It does not load: a first load can still fail, so callers choose
	 * their fallback from what Template or a placement actually returns.
	 */
	Available(name: UploadedAssetName): boolean {
		return AssetSelection.Resolve(ids, [name], failed) !== undefined;
	},
	/**
	 * Test hook: swap the ID table, loader and map probe (tests cannot author
	 * SurfaceAppearance maps), and clear every cache and failure.
	 */
	Configure(options: { ids?: Partial<Record<UploadedAssetName, number | undefined>>; loader?: AssetLoader; probe?: AppearanceProbe } = {}): void {
		ids = options.ids ?? RobloxAssetIds;
		loader = options.loader ?? defaultLoader;
		probe = options.probe ?? defaultProbe;
		for (const [, entry] of cache) entry.template?.Destroy();
		cache.clear();
		failed.clear();
	},
};
