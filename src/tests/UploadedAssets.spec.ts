import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { WorldAssets } from "../server/WorldAssets";
import { AssetSelection } from "../shared/AssetSelection";
import { JetFactory } from "../shared/JetFactory";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";

const created: Instance[] = [];
function track<T extends Instance>(item: T): T {
	created.push(item);
	return item;
}

/** A stand-in for InsertService's container: parts at twice the authored size, far from the origin. */
function fakeUpload(size: Vector3, scale = 2): Model {
	const container = new Instance("Model");
	const inner = new Instance("Model");
	inner.Parent = container;
	const offset = new Vector3(500, 80, -300);
	const halves = [new Vector3(-size.X / 4, 0, 0), new Vector3(size.X / 4, 0, 0)];
	for (const [index, centre] of pairs(halves)) {
		const part = new Instance("Part");
		part.Name = `Piece${index}`;
		part.Size = new Vector3(size.X / 2, size.Y, size.Z).mul(scale);
		part.CFrame = new CFrame(offset.add(centre.mul(scale)));
		part.Anchored = false;
		part.CanCollide = true;
		part.Parent = inner;
	}
	const stray = new Instance("Script");
	stray.Parent = inner;
	return container;
}

function close(a: number, b: number, tolerance = 0.05): void {
	expect(math.abs(a - b) <= tolerance).toBe(true);
}

afterEach(() => {
	for (const item of created) item.Destroy();
	created.clear();
	UploadedAssets.Configure();
});

describe("Uploaded asset loader with procedural fallback", () => {
	it("ships with every asset ID unset, so the game stays procedural before upload", () => {
		for (const [, id] of pairs(RobloxAssetIds)) expect(id).toBeUndefined();
		let calls = 0;
		UploadedAssets.Configure({ loader: () => { calls += 1; return new Instance("Model"); } });
		const jet = track(JetFactory.Create("Unuploaded Kestrel", false));
		expect(jet.GetAttribute("GeometrySource") === "Blender" || jet.GetAttribute("GeometrySource") === "Fallback").toBe(true);
		expect(UploadedAssets.Template(["Kestrel"])).toBeUndefined();
		expect(calls).toBe(0);
	}, 60000);

	it("uses an uploaded aircraft when its ID is set: normalised, cached and welded to the root", () => {
		const spec = UploadedAssetSpecs.Kestrel;
		let calls = 0;
		UploadedAssets.Configure({ ids: { Kestrel: 1111 }, loader: (id) => { calls += 1; expect(id).toBe(1111); return fakeUpload(spec.size); } });
		const first = track(JetFactory.Create("Uploaded Kestrel", false));
		const second = track(JetFactory.Create("Uploaded Kestrel 2", false));
		expect(calls).toBe(1);
		expect(first.GetAttribute("GeometrySource")).toBe("Uploaded");
		expect(first.GetAttribute("UploadedAsset")).toBe("Kestrel");
		expect(first.FindFirstChildWhichIsA("Script", true)).toBeUndefined();
		const pieces = first.GetChildren().filter((item) => item.IsA("BasePart") && item.Name !== "Root") as BasePart[];
		expect(pieces.size()).toBe(2);
		for (const piece of pieces) {
			expect(piece.Anchored).toBe(false);
			expect(piece.CanCollide).toBe(false);
			expect(piece.FindFirstChild("RootWeld") !== undefined).toBe(true);
		}
		const leftTip = first.GetAttribute("leftWingtip") as Vector3;
		close(leftTip.X, spec.attachments!.leftWingtip.X, 1e-3);
		// Fit to the authored size around the root, independent of where the upload sat.
		const model = new Instance("Model");
		for (const piece of pieces) piece.Clone().Parent = model;
		const [box, size] = model.GetBoundingBox();
		model.Destroy();
		close(math.max(size.X, size.Y, size.Z), math.max(spec.size.X, spec.size.Y, spec.size.Z));
		close(box.Position.Magnitude, 0);
		expect(second.GetAttribute("GeometrySource")).toBe("Uploaded");
	}, 60000);

	it("falls back to the procedural aircraft when loading fails, and does not retry", () => {
		let calls = 0;
		UploadedAssets.Configure({ ids: { Vanta: 2222 }, loader: () => { calls += 1; error("asset not owned by the place owner"); } });
		const first = track(JetFactory.Create("Failed Vanta", true));
		const second = track(JetFactory.Create("Failed Vanta 2", true));
		expect(calls).toBe(1);
		expect(first.GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
		expect(second.GetAttribute("GeometrySource") !== "Uploaded").toBe(true);
		expect(UploadedAssets.Available("Vanta")).toBe(false);
	}, 60000);

	it("gives aces their livery model, then the plain uploaded Vanta, then a procedural tint", () => {
		const size = UploadedAssetSpecs.Vanta.size;
		UploadedAssets.Configure({ ids: { Vanta: 2, VantaRusk: 3 }, loader: () => fakeUpload(size, 1) });
		const rusk = track(JetFactory.Create("AIR MARSHAL RUSK", true, AssetSelection.LiveryForAce("AIR MARSHAL RUSK")));
		expect(rusk.GetAttribute("UploadedAsset")).toBe("VantaRusk");
		expect(rusk.GetAttribute("Livery")).toBe("Rusk");
		const vulture = track(JetFactory.Create("VULTURE LEAD", true, "Vulture"));
		expect(vulture.GetAttribute("UploadedAsset")).toBe("Vanta");
		UploadedAssets.Configure({ ids: {} });
		const procedural = track(JetFactory.Create("VULTURE TWO", true, "Vulture"));
		if (procedural.GetAttribute("GeometrySource") === "Blender") {
			const shell = procedural.GetChildren().find((item) => item.IsA("MeshPart") && item.GetAttribute("BlenderMaterial") === "White") as MeshPart;
			const tint = AssetSelection.ProceduralTint("Vulture").White;
			expect(shell.Color).toBe(Color3.fromRGB(tint[0], tint[1], tint[2]));
		}
	}, 60000);

	it("places world assets by their ground contact, or a simple shape, or nothing", () => {
		const parent = track(new Instance("Folder"));
		parent.Parent = Workspace;
		const at = new CFrame(100, 20, -50);
		UploadedAssets.Configure({ ids: {} });
		const frigate = WorldAssets.PlaceFrigate(parent, at);
		expect(frigate?.GetAttribute("GeometrySource")).toBe("Fallback");
		expect(frigate?.FindFirstChild("Hull")?.GetAttribute("FlightSolid")).toBe(true);
		expect(WorldAssets.PlaceGantryCrane(parent, at)).toBeUndefined();
		expect(WorldAssets.Has("Frigate")).toBe(false);

		const quay = UploadedAssetSpecs.HarbourQuay;
		UploadedAssets.Configure({ ids: { HarbourQuay: 4444 }, loader: () => fakeUpload(quay.size) });
		expect(WorldAssets.Has("HarbourQuay")).toBe(true);
		const placed = WorldAssets.PlaceQuay(parent, at)!;
		expect(placed.GetAttribute("GeometrySource")).toBe("Uploaded");
		const [box, size] = placed.GetBoundingBox();
		// The waterline (ground offset above the lowest point) lands on the requested CFrame.
		close(box.Position.Y - size.Y / 2 + quay.groundOffset, at.Position.Y);
		close(box.Position.X, at.Position.X);
		close(box.Position.Z, at.Position.Z);
		for (const item of placed.GetDescendants()) {
			if (item.IsA("BasePart")) {
				expect(item.Anchored).toBe(true);
				expect(item.GetAttribute("FlightSolid")).toBe(true);
			}
		}
	});
});
