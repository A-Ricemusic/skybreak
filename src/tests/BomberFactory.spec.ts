// Instance assembly tests: Studio Jest only, never adapted to the offline runner.
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { BomberFactory, attachBomberGeometry } from "../shared/BomberFactory";
import { AssetSelection } from "../shared/AssetSelection";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
let model: Model | undefined;
afterEach(() => { model?.Destroy(); model = undefined; UploadedAssets.Configure(); });
describe("BomberFactory unwired visual", () => {
	it("uses the labelled stand-in while no uploaded bomber spec exists", () => {
		expect(AssetSelection.BomberCandidates(UploadedAssetSpecs).size()).toBe(0);
		UploadedAssets.Configure({ ids: {}, loader: () => error("stand-in must not load an asset") });
		model = BomberFactory.Create("TestBomber");
		expect(model.GetAttribute("GeometrySource")).toBe("BomberStandIn");
		expect(model.GetAttribute("StandIn")).toBe(true);
		expect(model.Name).toBe("TestBomber");
	});
	it("has four engines, fighter-exceeding but bounded dimensions and a welded safe assembly", () => {
		UploadedAssets.Configure({ ids: {} });
		model = BomberFactory.Create();
		const [, size] = model.GetBoundingBox();
		expect(size.X).toBe(72);
		expect(size.Z).toBe(60);
		expect(size.Y).toBeLessThan(30);
		expect(size.X).toBeGreaterThan(UploadedAssetSpecs.Kestrel.size.X * 2);
		expect(size.Z).toBeGreaterThan(UploadedAssetSpecs.Vanta.size.Z * 2);
		expect(size.X).toBeLessThan(100);
		const root = model.PrimaryPart!;
		expect(root.Anchored).toBe(true);
		let engines = 0;
		for (const p of model.GetChildren()) {
			if (!p.IsA("BasePart")) continue;
			expect(p.CanCollide).toBe(false); expect(p.CanTouch).toBe(false); expect(p.CanQuery).toBe(false);
			if (p.Name === "StandInEngine") engines++;
			if (p === root) continue;
			expect(p.Anchored).toBe(false); expect(p.Massless).toBe(true);
			expect(p.FindFirstChild("RootWeld")?.IsA("WeldConstraint")).toBe(true);
		}
		expect(engines).toBe(4);
	});
});

// Synthetic source pivot isolates alignment from asset availability; exact uploaded export still needs Studio inspection.
describe("Bomber uploaded geometry alignment", () => {
	it("preserves template-local part poses at a different aircraft root", () => {
		model = new Instance("Model");
		const root = new Instance("Part"); root.CFrame = new CFrame(-400, 700, 900); root.Parent = model; model.PrimaryPart = root;
		const template = new Instance("Model");
		const body = new Instance("Part"); body.Name = "Body"; body.CFrame = new CFrame(100, 200, 300).mul(CFrame.Angles(0, .7, 0)); body.Parent = template; template.PrimaryPart = body;
		const wing = new Instance("Part"); wing.Name = "Wing"; wing.CFrame = body.CFrame.mul(new CFrame(20, 2, 4)); wing.Parent = template;
		attachBomberGeometry(model, template);
		const clone = model.FindFirstChild("Wing") as BasePart;
		expect(root.CFrame.ToObjectSpace(clone.CFrame).Position.sub(new Vector3(20, 2, 4)).Magnitude).toBeLessThan(.001);
		expect((model.FindFirstChild("Body") as BasePart).CFrame.LookVector.sub(root.CFrame.LookVector).Magnitude).toBeLessThan(.001);
		template.Destroy();
	});
});
