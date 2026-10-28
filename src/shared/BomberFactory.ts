import { AssetSelection } from "./AssetSelection";
import { UploadedAssets } from "./UploadedAssets";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";
import { JetFactory } from "./JetFactory";

/** Unwired bomber visual. No upload/generation of Blender content happens here. */
export const BomberFactory = {
	Create(name = "HeavyBomber"): Model {
		const model = new Instance("Model");
		model.Name = name;
		const root = new Instance("Part");
		root.Name = "Root";
		root.Size = new Vector3(6, 6, 48);
		root.Transparency = 1;
		root.Anchored = true;
		root.CanCollide = false;
		root.CanTouch = false;
		root.CanQuery = false;
		root.Parent = model;
		model.PrimaryPart = root;
		const uploaded = UploadedAssets.Template(AssetSelection.BomberCandidates(UploadedAssetSpecs));
		if (uploaded !== undefined) {
			for (const item of uploaded.template.GetChildren()) {
				if (item.IsA("BasePart")) item.Clone().Parent = model;
			}
			model.SetAttribute("GeometrySource", "Uploaded");
			model.SetAttribute("UploadedAsset", uploaded.name);
		} else {
			model.SetAttribute("GeometrySource", "BomberStandIn");
			model.SetAttribute("StandIn", true);
			// Deliberately simple neutral silhouette: 72 span × 17.5 high × 60 long.
			const part = (label: string, size: Vector3, position: Vector3) => {
				const p = new Instance("Part");
				p.Name = label;
				p.Size = size;
				p.Position = position;
				p.Color = Color3.fromRGB(140, 144, 148);
				p.Material = Enum.Material.SmoothPlastic;
				p.Parent = model;
			};
			part("StandInFuselage", new Vector3(7, 7, 60), Vector3.zero);
			part("StandInWing", new Vector3(72, 2, 12), new Vector3(0, 0, -2));
			part("StandInTailplane", new Vector3(28, 2, 7), new Vector3(0, 2, 24));
			part("StandInFin", new Vector3(2, 14, 8), new Vector3(0, 3.5, 23));
			for (const x of [-25, -12, 12, 25]) {
				part("StandInEngine", new Vector3(5, 5, 14), new Vector3(x, -2, -6));
				part("StandInPropeller", new Vector3(1, 10, 1), new Vector3(x, -2, -13.5));
			}
		}
		JetFactory.WeldAssembly(model);
		return model;
	},
};
