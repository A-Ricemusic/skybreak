import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { moveRenderedTarget } from "../shared/RenderedTarget";

describe("rendered enemy targeting geometry", () => {
	it("moves welded geometry in the same callback as its targeting frame", () => {
		const folder = new Instance("Folder"); folder.Parent = Workspace;
		const model = new Instance("Model");
		const root = new Instance("Part"); root.PivotOffset = new CFrame(2, 1, -3); root.Anchored = true; root.Transparency = 1; root.Parent = model;
		model.PrimaryPart = root;
		const body = new Instance("Part"); body.Name = "Body"; body.CFrame = new CFrame(0, 0, 5); body.Parent = model;
		const weld = new Instance("WeldConstraint"); weld.Part0 = root; weld.Part1 = body; weld.Parent = body;
		model.SetAttribute("TargetKind", "air"); model.Parent = folder;
		const visual = model.Clone(); visual.Parent = Workspace;
		const visibleBody = visual.FindFirstChild("Body") as BasePart;
		for (const frame of [new CFrame(100, 30, -200), new CFrame(-80, 50, -400).mul(CFrame.Angles(0, 1, 0))]) {
			moveRenderedTarget(visual, frame);
			const expected = frame.PointToWorldSpace(new Vector3(0, 0, 5));
			expect(visibleBody.Position.sub(expected).Magnitude).toBeLessThan(0.001);
		}
		visual.Destroy(); folder.Destroy();
	});
});
