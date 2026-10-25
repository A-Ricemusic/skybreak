import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { ReplicatedStorage, ServerStorage, Workspace } from "@rbxts/services";
import { CinematicPreviewService } from "../server/CinematicPreviewService";
import {
	CINEMATIC_PREVIEW_ASSETS,
	CINEMATIC_PREVIEW_FOLDER,
	CINEMATIC_PREVIEW_VERSION,
	cloneCinematicPreview,
	findCinematicPreview,
} from "../shared/CinematicPreview";

describe("authored cinematic preview cache", () => {
	let stage: Folder | undefined;
	afterEach(() => {
		stage?.Destroy();
		stage = undefined;
		ReplicatedStorage.FindFirstChild(CINEMATIC_PREVIEW_FOLDER)?.Destroy();
	});

	it("publishes one idempotent server cache with authored static geometry", () => {
		const first = CinematicPreviewService.Build();
		expect(CinematicPreviewService.Build()).toBe(first);
		expect(first.Parent).toBe(ReplicatedStorage);
		expect(first.GetAttribute("Ready")).toBe(true);
		for (const asset of CINEMATIC_PREVIEW_ASSETS) {
			const preview = findCinematicPreview(ReplicatedStorage, asset);
			expect(preview).toBeDefined();
			expect(preview!.GetAttribute("PreviewAsset")).toBe(asset);
			expect(preview!.GetAttribute("GeometryAsset")).toBe(asset === "CourierWing" ? "Kestrel" : asset);
			if (ServerStorage.FindFirstChild(`${asset === "CourierWing" ? "Kestrel" : asset}Geometry`)) {
				expect(preview!.GetAttribute("GeometrySource")).toBe("Blender");
			}
			for (const item of preview!.GetDescendants()) {
				if (item.IsA("BasePart")) {
					expect(item.Anchored).toBe(true);
					expect(item.CanCollide).toBe(false);
					expect(item.CanTouch).toBe(false);
					expect(item.CanQuery).toBe(false);
				}
			}
		}
	}, 60000);

	it("clones previews into and disposes them with the client-local stage", () => {
		const cache = CinematicPreviewService.Build();
		stage = new Instance("Folder");
		stage.Name = "PreviewLifecycleFixture";
		stage.Parent = Workspace;
		const pivot = new CFrame(40, 5000, -70).mul(CFrame.Angles(0, 0.4, -0.1));
		const actor = cloneCinematicPreview(ReplicatedStorage, "CourierWing", stage, pivot, 2.6);
		expect(actor).toBeDefined();
		expect(actor!.Parent).toBe(stage);
		expect(actor!.GetPivot().Position.sub(pivot.Position).Magnitude).toBeCloseTo(0, 3);
		expect(actor!.GetScale()).toBeCloseTo(2.6, 3);
		stage.Destroy();
		stage = undefined;
		expect(actor!.Parent).toBeUndefined();
		expect(cache.Parent).toBe(ReplicatedStorage);
		expect(findCinematicPreview(ReplicatedStorage, "CourierWing")).toBeDefined();
	});

	it("rejects incomplete or root-only fallback caches so the renderer can use safe primitives", () => {
		const folder = new Instance("Folder");
		folder.Name = CINEMATIC_PREVIEW_FOLDER;
		folder.SetAttribute("PreviewVersion", CINEMATIC_PREVIEW_VERSION);
		folder.SetAttribute("Ready", true);
		folder.Parent = ReplicatedStorage;
		const model = new Instance("Model");
		model.Name = "SupplyConvoy";
		model.SetAttribute("PreviewAsset", "SupplyConvoy");
		const root = new Instance("Part");
		root.Name = "Root";
		root.Transparency = 1;
		root.Parent = model;
		model.PrimaryPart = root;
		model.Parent = folder;
		expect(findCinematicPreview(ReplicatedStorage, "SupplyConvoy")).toBeUndefined();
		expect(cloneCinematicPreview(ReplicatedStorage, "SupplyConvoy", Workspace, new CFrame())).toBeUndefined();
	});
});
