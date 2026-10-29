// Instance assembly test: Studio Jest only, never adapted to the offline runner.
import { afterEach, beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { adoptGroundTarget, createGroundTarget } from "../server/GroundTargetFactory";
import { MissionCatalog } from "../shared/MissionCatalog";
import { UploadedAssets } from "../shared/UploadedAssets";

const targets = MissionCatalog.Get(2).phases[0].groundTargets!;
// The labelled stand-in: no asset loads inside the test runner.
beforeEach(() => UploadedAssets.Configure({ ids: {}, loader: () => error("fallback targets must not load an asset") }));
afterEach(() => UploadedAssets.Configure());

describe("typed ground target models", () => {
	it("rests a fallback parked bomber on its pad instead of sinking it, labelled and tagged", () => {
		const spec = targets.find((t) => t.type === "parked_bomber")!;
		const model = createGroundTarget(spec);
		const [box, size] = model.GetBoundingBox();
		expect(box.Position.Y - size.Y / 2).toBeCloseTo(spec.position.y, 3);
		expect(model.Name).toBe("BOMBER");
		expect(model.GetAttribute("TargetId")).toBe(spec.id);
		expect(model.PrimaryPart).toBeDefined();
		model.Destroy();
	});
	it("labels every mission 2 fallback with its HUD name and keeps a stationary aim centre", () => {
		const labels: { [k: string]: string } = { parked_bomber: "BOMBER", hangar: "HANGAR", aa_gun: "AA GUN", control_tower: "CTRL TOWER", substation: "SUBSTATION" };
		for (const spec of targets) {
			const model = createGroundTarget(spec);
			expect(model.Name).toBe(labels[spec.type]);
			expect(model.PrimaryPart).toBeDefined();
			model.Destroy();
		}
	});
	it("adopts a world-drawn visual with an invisible, non-queryable aim at its centre", () => {
		const model = new Instance("Model");
		const part = new Instance("Part"); part.Size = new Vector3(40, 20, 60); part.Position = new Vector3(100, 46, -200); part.Parent = model;
		adoptGroundTarget(model, "m02_hangar_12", "hangar");
		const aim = model.PrimaryPart!;
		expect(aim.Name).toBe("Aim");
		expect(aim.Transparency).toBe(1);
		expect(aim.CanQuery).toBe(false);
		expect(aim.Position.sub(part.Position).Magnitude).toBeLessThan(1e-3);
		expect(model.Name).toBe("HANGAR");
		expect(model.GetAttribute("TargetId")).toBe("m02_hangar_12");
		model.Destroy();
	});
});
