import { InsertService, RunService } from "@rbxts/services";
import { AssetSelection, ImportedPart } from "./AssetSelection";
import { RobloxAssetIds } from "./RobloxAssetIds";
import { UploadedAssetName, UploadedAssetSpecs } from "./UploadedAssetSpecs";

/** Loads one uploaded asset; returns InsertService's container (or any Instance holding the parts). */
export type AssetLoader = (assetId: number) => Instance;
/** True when a SurfaceAppearance carries a colour map. */
export type AppearanceProbe = (appearance: SurfaceAppearance) => boolean;

interface CacheEntry {
	template?: Model;
	loading: boolean;
}

const defaultLoader: AssetLoader = (assetId) => InsertService.LoadAsset(assetId);
// The *Map setters are plugin-only, but game scripts can read the Content values.
const defaultProbe: AppearanceProbe = (appearance) => appearance.ColorMapContent.SourceType !== Enum.ContentSourceType.None;
let loader: AssetLoader = defaultLoader;
let probe: AppearanceProbe = defaultProbe;
let ids: Partial<Record<UploadedAssetName, number | undefined>> = RobloxAssetIds;
const cache = new Map<number, CacheEntry>();
const failed = new Set<number>();

function hasColorMap(appearance: SurfaceAppearance): boolean {
	const [ok, result] = pcall(probe, appearance);
	return ok && result === true;
}

function describe(part: BasePart): ImportedPart {
	const appearance = part.FindFirstChildWhichIsA("SurfaceAppearance");
	return {
		name: part.Name,
		meshPart: part.IsA("MeshPart"),
		appearance: appearance !== undefined,
		colorMap: appearance !== undefined && hasColorMap(appearance),
	};
}

function components(size: Vector3): number[] {
	return [size.X, size.Y, size.Z];
}

/**
 * Turn whatever LoadAsset returned into one cached Model: every part must be a
 * textured MeshPart (the Model import puts the FBX's embedded maps on a
 * SurfaceAppearance under each one; aircraft must keep Body and every control
 * surface), anchored, non-colliding, scaled with Model:ScaleTo to the in-game
 * size and moved so the pivot is the authored origin (bounds centre for
 * aircraft, bottom centre for world props). Throws on anything else so the
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
			// Keep SurfaceAppearance and other children; drop scripts and joints from the asset.
			for (const child of part.GetDescendants()) {
				if (child.IsA("LuaSourceContainer") || child.IsA("JointInstance") || child.IsA("Constraint")) child.Destroy();
			}
			part.Anchored = true;
			part.CanCollide = false;
			part.CanTouch = false;
			part.CanQuery = false;
			part.Parent = model;
			seen.push(describe(part));
		}
		const required = spec.kind === "aircraft" ? ["Body", ...AssetSelection.ControlSurfaceNames(spec.controlSurfaces)] : [];
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
	 * True when an uploaded model would still be tried for this name (ID present and
	 * not failed). It does not load: a first load can still fail, so callers choose
	 * their fallback from what Template or a placement actually returns.
	 */
	Available(name: UploadedAssetName): boolean {
		return AssetSelection.Resolve(ids, [name], failed) !== undefined;
	},
	/**
	 * Test hook: swap the ID table, loader and colour-map probe (tests cannot author
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
