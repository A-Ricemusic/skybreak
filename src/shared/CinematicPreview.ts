export const CINEMATIC_PREVIEW_FOLDER = "AuroraLineCinematicAssets";
export const CINEMATIC_PREVIEW_VERSION = 1;

export type CinematicPreviewAsset = "SupplyConvoy" | "AuroraBeacon" | "CourierWing";

export const CINEMATIC_PREVIEW_ASSETS: readonly CinematicPreviewAsset[] = [
	"SupplyConvoy",
	"AuroraBeacon",
	"CourierWing",
];

function hasVisibleGeometry(model: Model): boolean {
	for (const item of model.GetDescendants()) {
		if (item.IsA("BasePart") && item.Transparency < 1) return true;
	}
	return false;
}

/**
 * Resolves a server-generated static preview. This never invokes EditableMesh
 * APIs, so it is safe for the client cutscene renderer to call.
 */
export function findCinematicPreview(root: Instance, asset: CinematicPreviewAsset): Model | undefined {
	const folder = root.FindFirstChild(CINEMATIC_PREVIEW_FOLDER);
	if (
		!folder?.IsA("Folder") ||
		folder.GetAttribute("PreviewVersion") !== CINEMATIC_PREVIEW_VERSION ||
		folder.GetAttribute("Ready") !== true
	) return undefined;
	const candidate = folder.FindFirstChild(asset);
	if (!candidate?.IsA("Model") || candidate.PrimaryPart === undefined) return undefined;
	if (candidate.GetAttribute("PreviewAsset") !== asset || !hasVisibleGeometry(candidate)) return undefined;
	return candidate;
}

/** Clone-only half of the preview pipeline; authored content is generated on the server. */
export function cloneCinematicPreview(
	root: Instance,
	asset: CinematicPreviewAsset,
	parent: Instance,
	pivot: CFrame,
	scale = 1,
): Model | undefined {
	const source = findCinematicPreview(root, asset);
	if (!source) return undefined;
	const clone = source.Clone();
	clone.Name = `Cinematic${asset}`;
	clone.ScaleTo(scale);
	clone.PivotTo(pivot);
	for (const item of clone.GetDescendants()) {
		if (item.IsA("BasePart")) {
			item.Anchored = true;
			item.CanCollide = false;
			item.CanTouch = false;
			item.CanQuery = false;
		} else if (item.IsA("Trail")) {
			item.Enabled = false;
		}
	}
	clone.Parent = parent;
	return clone;
}
