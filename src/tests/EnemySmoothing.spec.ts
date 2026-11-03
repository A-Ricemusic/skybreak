import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { moveRenderedTarget } from "../shared/RenderedTarget";
import type { EnemySmoothing as EnemySmoothingClass } from "../client/EnemySmoothing";
import { requireClientModule } from "./helpers/ClientModule";

const { EnemySmoothing } = requireClientModule<{ EnemySmoothing: typeof EnemySmoothingClass }>("EnemySmoothing");

describe("rendered enemy targeting geometry", () => {
	it("moves welded geometry in the same callback as its targeting frame", () => {
		const folder = new Instance("Folder");
		folder.Parent = Workspace;
		const model = new Instance("Model");
		const root = new Instance("Part");
		root.PivotOffset = new CFrame(2, 1, -3);
		root.Anchored = true;
		root.Transparency = 1;
		root.Parent = model;
		model.PrimaryPart = root;
		const body = new Instance("Part");
		body.Name = "Body";
		body.CFrame = new CFrame(0, 0, 5);
		body.Parent = model;
		const weld = new Instance("WeldConstraint");
		weld.Part0 = root;
		weld.Part1 = body;
		weld.Parent = body;
		model.SetAttribute("TargetKind", "air");
		model.Parent = folder;
		const visual = model.Clone();
		visual.Parent = Workspace;
		const visibleBody = visual.FindFirstChild("Body") as BasePart;
		for (const frame of [new CFrame(100, 30, -200), new CFrame(-80, 50, -400).mul(CFrame.Angles(0, 1, 0))]) {
			moveRenderedTarget(visual, frame);
			const expected = frame.PointToWorldSpace(new Vector3(0, 0, 5));
			expect(visibleBody.Position.sub(expected).Magnitude).toBeLessThan(0.001);
		}
		visual.Destroy();
		folder.Destroy();
	});
});

// Replicated enemy models can arrive before their TargetKind attribute and/or
// their PrimaryPart reference; smoothing must start once both have landed.
describe("enemy smoothing replication readiness", () => {
	let serial = 0;
	const jet = (air: boolean, primary: boolean) => {
		serial += 1;
		const model = new Instance("Model");
		model.Name = `SmoothingReadiness${serial}`;
		const root = new Instance("Part");
		root.Name = "Root";
		root.Anchored = true;
		root.Parent = model;
		if (primary) model.PrimaryPart = root;
		if (air) model.SetAttribute("TargetKind", "air");
		return { model, root };
	};
	const clones = (model: Model) =>
		Workspace.GetChildren()
			.filter((child) => child.Name === `${model.Name}_LocalVisual`)
			.size();
	const pendingCount = (smoothing: EnemySmoothingClass) => smoothing["pending"].size();
	const settle = () => task.wait();
	const setup = () => {
		const folder = new Instance("Folder");
		folder.Parent = Workspace;
		const smoothing = new EnemySmoothing();
		smoothing.Start(folder);
		return { folder, smoothing };
	};

	it("tracks a model whose attribute lands before its PrimaryPart", () => {
		const { folder, smoothing } = setup();
		const { model, root } = jet(false, false);
		model.Parent = folder;
		settle();
		expect(clones(model)).toBe(0);
		expect(pendingCount(smoothing)).toBe(1);
		model.SetAttribute("TargetKind", "air");
		settle();
		expect(clones(model)).toBe(0);
		expect(pendingCount(smoothing)).toBe(1);
		model.PrimaryPart = root;
		settle();
		expect(clones(model)).toBe(1);
		expect(pendingCount(smoothing)).toBe(0);
		model.SetAttribute("Health", 50);
		settle();
		expect(clones(model)).toBe(1);
		smoothing.Stop();
		expect(clones(model)).toBe(0);
		folder.Destroy();
	});

	it("tracks a model whose PrimaryPart lands before its attribute", () => {
		const { folder, smoothing } = setup();
		const { model } = jet(false, true);
		model.Parent = folder;
		settle();
		expect(clones(model)).toBe(0);
		expect(pendingCount(smoothing)).toBe(1);
		model.SetAttribute("TargetKind", "air");
		settle();
		expect(clones(model)).toBe(1);
		expect(pendingCount(smoothing)).toBe(0);
		smoothing.Stop();
		expect(clones(model)).toBe(0);
		folder.Destroy();
	});

	it("retries a model that is already air at ChildAdded but has no PrimaryPart yet", () => {
		const { folder, smoothing } = setup();
		const { model, root } = jet(true, false);
		model.Parent = folder;
		settle();
		expect(clones(model)).toBe(0);
		expect(pendingCount(smoothing)).toBe(1);
		model.PrimaryPart = root;
		settle();
		expect(clones(model)).toBe(1);
		expect(pendingCount(smoothing)).toBe(0);
		smoothing.Stop();
		folder.Destroy();
	});

	it("tracks a ready model immediately and only once", () => {
		const { folder, smoothing } = setup();
		const { model } = jet(true, true);
		model.Parent = folder;
		settle();
		expect(clones(model)).toBe(1);
		expect(pendingCount(smoothing)).toBe(0);
		smoothing.Stop();
		expect(clones(model)).toBe(0);
		folder.Destroy();
	});

	it("drops the wait when the model is removed while pending", () => {
		const { folder, smoothing } = setup();
		const { model, root } = jet(true, false);
		model.Parent = folder;
		settle();
		expect(pendingCount(smoothing)).toBe(1);
		model.Parent = undefined;
		settle();
		expect(pendingCount(smoothing)).toBe(0);
		model.PrimaryPart = root;
		model.SetAttribute("TargetKind", "air");
		settle();
		expect(clones(model)).toBe(0);
		smoothing.Stop();
		model.Destroy();
		folder.Destroy();
	});

	it("drops the wait on Stop while pending", () => {
		const { folder, smoothing } = setup();
		const { model, root } = jet(false, false);
		model.Parent = folder;
		settle();
		expect(pendingCount(smoothing)).toBe(1);
		smoothing.Stop();
		expect(pendingCount(smoothing)).toBe(0);
		model.SetAttribute("TargetKind", "air");
		model.PrimaryPart = root;
		settle();
		expect(clones(model)).toBe(0);
		folder.Destroy();
	});

	it("stops waiting once a non-air TargetKind arrives", () => {
		const { folder, smoothing } = setup();
		const { model, root } = jet(false, false);
		model.Parent = folder;
		settle();
		model.SetAttribute("TargetKind", "ground");
		settle();
		expect(pendingCount(smoothing)).toBe(0);
		model.PrimaryPart = root;
		settle();
		expect(clones(model)).toBe(0);
		smoothing.Stop();
		folder.Destroy();
	});
});
