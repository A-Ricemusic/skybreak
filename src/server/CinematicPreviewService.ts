import { ReplicatedStorage } from "@rbxts/services";
import {
	CINEMATIC_PREVIEW_ASSETS,
	CINEMATIC_PREVIEW_FOLDER,
	CINEMATIC_PREVIEW_VERSION,
	type CinematicPreviewAsset,
} from "../shared/CinematicPreview";
import { JetFactory } from "../shared/JetFactory";
import { MissionAssets } from "../shared/MissionAssets";

type PreviewFactory = (name: string) => Model;

const factories: Record<CinematicPreviewAsset, PreviewFactory> = {
	Kestrel: (name) => JetFactory.Create(name, false),
	Vanta: (name) => JetFactory.Create(name, true),
	Relay: (name) => MissionAssets.CreateRelay(name),
	Carrier: (name) => MissionAssets.CreateCarrier(name),
};

function prepare(asset: CinematicPreviewAsset, model: Model): void {
	model.Name = asset;
	model.SetAttribute("PreviewAsset", asset);
	for (const item of model.GetDescendants()) {
		if (item.IsA("BasePart")) {
			item.Anchored = true;
			item.CanCollide = false;
			item.CanTouch = false;
			item.CanQuery = false;
		} else if (item.IsA("Trail") || item.IsA("ParticleEmitter") || item.IsA("Beam")) {
			item.Enabled = false;
		}
	}
}

function isReady(folder: Instance | undefined): folder is Folder {
	if (
		!folder?.IsA("Folder") ||
		folder.GetAttribute("PreviewVersion") !== CINEMATIC_PREVIEW_VERSION ||
		folder.GetAttribute("Ready") !== true
	) return false;
	return CINEMATIC_PREVIEW_ASSETS.every((asset) => {
		const item = folder.FindFirstChild(asset);
		return item?.IsA("Model") === true && item.GetAttribute("PreviewAsset") === asset;
	});
}

export const CinematicPreviewService = {
	/**
	 * Generates authored geometry on the server, then atomically publishes only
	 * static models. Clients never observe a partial cache or invoke mesh APIs.
	 */
	Build(): Folder {
		const existing = ReplicatedStorage.FindFirstChild(CINEMATIC_PREVIEW_FOLDER);
		if (isReady(existing)) return existing;
		existing?.Destroy();

		const folder = new Instance("Folder");
		folder.Name = CINEMATIC_PREVIEW_FOLDER;
		folder.SetAttribute("PreviewVersion", CINEMATIC_PREVIEW_VERSION);
		const [built, buildError] = pcall(() => {
			for (const asset of CINEMATIC_PREVIEW_ASSETS) {
				const model = factories[asset](asset);
				prepare(asset, model);
				model.Parent = folder;
			}
		});
		if (!built) {
			folder.Destroy();
			error(buildError);
		}
		folder.SetAttribute("Ready", true);
		folder.Parent = ReplicatedStorage;
		return folder;
	},
};
