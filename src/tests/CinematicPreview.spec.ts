import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { ReplicatedStorage, ServerStorage } from "@rbxts/services";
import { CinematicPreviewService } from "../server/CinematicPreviewService";
import {
	CINEMATIC_PREVIEW_ASSETS,
	CINEMATIC_PREVIEW_FOLDER,
	CINEMATIC_PREVIEW_VERSION,
	cloneCinematicPreview,
	findCinematicPreview,
	type CinematicPreviewAsset,
} from "../shared/CinematicPreview";

const expectedGeometry: Record<CinematicPreviewAsset, string> = {
	Kestrel: "Kestrel",
	Vanta: "Vanta",
	Relay: "Relay",
	Carrier: "Carrier",
};

describe("Glass Horizon authored cinematic preview cache", () => {
	let fixture: Instance | undefined;
	afterEach(() => {
		fixture?.Destroy();
		fixture = undefined;
		ReplicatedStorage.FindFirstChild(CINEMATIC_PREVIEW_FOLDER)?.Destroy();
	});

	it("publishes one idempotent server cache with four static authored actors", () => {
		const first = CinematicPreviewService.Build();
		expect(CinematicPreviewService.Build()).toBe(first);
		expect(first.Parent).toBe(ReplicatedStorage);
		expect(first.GetAttribute("Ready")).toBe(true);
		for (const asset of CINEMATIC_PREVIEW_ASSETS) {
			const preview = findCinematicPreview(ReplicatedStorage, asset);
			expect(preview).toBeDefined();
			expect(preview!.GetAttribute("PreviewAsset")).toBe(asset);
			expect(preview!.GetAttribute("GeometryAsset")).toBe(expectedGeometry[asset]);
			if (ServerStorage.FindFirstChild(`${expectedGeometry[asset]}Geometry`)) {
				expect(preview!.GetAttribute("GeometrySource")).toBe("Blender");
			}
			expect(preview!.GetDescendants().filter((item) => item.IsA("BasePart") && item.Transparency < 1).size()).toBeGreaterThan(0);
			for (const item of preview!.GetDescendants()) {
				if (item.IsA("BasePart")) {
					expect(item.Anchored).toBe(true);
					expect(item.CanCollide || item.CanTouch || item.CanQuery).toBe(false);
				} else if (item.IsA("Trail")) {
					expect(item.Enabled).toBe(false);
				}
			}
		}
	}, 60000);

	it("clones scaled previews into a WorldModel and disposes them with that stage", () => {
		const cache = CinematicPreviewService.Build();
		const viewport = new Instance("ViewportFrame");
		fixture = viewport;
		const world = new Instance("WorldModel");
		world.Parent = viewport;
		const actors = CINEMATIC_PREVIEW_ASSETS.map((asset, index) => {
			const pivot = new CFrame(index * 40, 60, -index * 30).mul(CFrame.Angles(0, index * 0.2, 0));
			const scale = 0.7 + index * 0.2;
			const actor = cloneCinematicPreview(ReplicatedStorage, asset, world, pivot, scale);
			expect(actor).toBeDefined();
			expect(actor!.Parent).toBe(world);
			expect(actor!.GetPivot().Position.sub(pivot.Position).Magnitude).toBeCloseTo(0, 3);
			expect(actor!.GetScale()).toBeCloseTo(scale, 3);
			return actor!;
		});
		viewport.Destroy();
		fixture = undefined;
		for (const actor of actors) expect(actor.Parent).toBeUndefined();
		expect(cache.Parent).toBe(ReplicatedStorage);
		expect(findCinematicPreview(ReplicatedStorage, "Kestrel")).toBeDefined();
	});

	it("accepts a visible metadata-marked native fallback without generating client geometry", () => {
		const folder = new Instance("Folder");
		folder.Name = CINEMATIC_PREVIEW_FOLDER;
		folder.SetAttribute("PreviewVersion", CINEMATIC_PREVIEW_VERSION);
		folder.SetAttribute("Ready", true);
		folder.Parent = ReplicatedStorage;
		const model = new Instance("Model");
		model.Name = "Relay";
		model.SetAttribute("PreviewAsset", "Relay");
		model.SetAttribute("GeometryAsset", "Relay");
		model.SetAttribute("GeometrySource", "Fallback");
		const root = new Instance("Part");
		root.Name = "Root";
		root.Transparency = 1;
		root.Parent = model;
		model.PrimaryPart = root;
		const silhouette = new Instance("Part");
		silhouette.Name = "NativeFallback";
		silhouette.Parent = model;
		model.Parent = folder;
		const world = new Instance("WorldModel");
		fixture = world;
		expect(findCinematicPreview(ReplicatedStorage, "Relay")).toBe(model);
		expect(cloneCinematicPreview(ReplicatedStorage, "Relay", world, new CFrame(), 1.6)).toBeDefined();
	});

	it("rejects incomplete, unready, or metadata-mismatched cache content", () => {
		const folder = new Instance("Folder");
		folder.Name = CINEMATIC_PREVIEW_FOLDER;
		folder.SetAttribute("PreviewVersion", CINEMATIC_PREVIEW_VERSION);
		folder.SetAttribute("Ready", true);
		folder.Parent = ReplicatedStorage;
		const model = new Instance("Model");
		model.Name = "Carrier";
		model.SetAttribute("PreviewAsset", "Carrier");
		model.SetAttribute("GeometryAsset", "Relay");
		model.SetAttribute("GeometrySource", "Blender");
		const root = new Instance("Part");
		root.Parent = model;
		model.PrimaryPart = root;
		model.Parent = folder;
		expect(findCinematicPreview(ReplicatedStorage, "Carrier")).toBeUndefined();
		model.SetAttribute("GeometryAsset", "Carrier");
		root.Transparency = 1;
		expect(findCinematicPreview(ReplicatedStorage, "Carrier")).toBeUndefined();
		folder.SetAttribute("Ready", false);
		expect(cloneCinematicPreview(ReplicatedStorage, "Carrier", new Instance("WorldModel"), new CFrame())).toBeUndefined();
	});
});
