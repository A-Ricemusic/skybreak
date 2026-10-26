import { InsertService, RunService } from "@rbxts/services";
import { AssetSelection } from "./AssetSelection";
import { RobloxAssetIds } from "./RobloxAssetIds";
import { UploadedAssetName, UploadedAssetSpecs } from "./UploadedAssetSpecs";

/** Loads one uploaded asset; returns InsertService's container (or any Instance holding the parts). */
export type AssetLoader = (assetId: number) => Instance;

interface CacheEntry {
	template?: Model;
	loading: boolean;
}

const defaultLoader: AssetLoader = (assetId) => InsertService.LoadAsset(assetId);
let loader: AssetLoader = defaultLoader;
let ids: Partial<Record<UploadedAssetName, number | undefined>> = RobloxAssetIds;
const cache = new Map<number, CacheEntry>();
const failed = new Set<number>();

function longest(size: Vector3): number {
	return math.max(size.X, size.Y, size.Z);
}

/**
 * Turn whatever LoadAsset returned into one cached Model: every BasePart
 * anchored, non-colliding and moved so the model pivot is the authored origin
 * (bounds centre for aircraft, bottom centre for world props), scaled to the
 * authored stud size.
 */
function normalise(container: Instance, name: UploadedAssetName, assetId: number): Model {
	const spec = UploadedAssetSpecs[name];
	const model = new Instance("Model");
	model.Name = `Uploaded${name}`;
	for (const item of container.GetDescendants()) {
		if (!item.IsA("BasePart")) continue;
		const part = item.Clone();
		// Keep SurfaceAppearance and other children; drop scripts and joints from the asset.
		for (const child of part.GetDescendants()) {
			if (child.IsA("LuaSourceContainer") || child.IsA("JointInstance") || child.IsA("Constraint")) child.Destroy();
		}
		part.Anchored = true;
		part.CanCollide = false;
		part.CanTouch = false;
		part.CanQuery = false;
		part.Parent = model;
	}
	container.Destroy();
	assert(model.GetChildren().size() > 0, `${name} asset ${assetId} contains no parts`);
	const [, size] = model.GetBoundingBox();
	const scale = AssetSelection.FitScale(longest(size), longest(spec.size));
	assert(scale !== undefined, `${name} asset ${assetId} has an implausible size ${tostring(size)}`);
	if (scale !== 1) model.ScaleTo(scale);
	const [box, scaled] = model.GetBoundingBox();
	const origin = spec.kind === "aircraft" ? box.Position : box.Position.sub(new Vector3(0, scaled.Y / 2, 0));
	for (const part of model.GetChildren()) {
		if (part.IsA("BasePart")) part.CFrame = part.CFrame.sub(origin);
	}
	model.WorldPivot = new CFrame();
	model.SetAttribute("GeometrySource", "Uploaded");
	model.SetAttribute("AssetId", assetId);
	model.SetAttribute("UploadedAsset", name);
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
	/** True when an uploaded model would be tried for this name (ID present and not failed). */
	Available(name: UploadedAssetName): boolean {
		return AssetSelection.Resolve(ids, [name], failed) !== undefined;
	},
	/** Test hook: swap the ID table and loader, and clear every cache and failure. */
	Configure(options: { ids?: Partial<Record<UploadedAssetName, number | undefined>>; loader?: AssetLoader } = {}): void {
		ids = options.ids ?? RobloxAssetIds;
		loader = options.loader ?? defaultLoader;
		for (const [, entry] of cache) entry.template?.Destroy();
		cache.clear();
		failed.clear();
	},
};
