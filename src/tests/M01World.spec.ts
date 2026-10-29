// Instance assembly test: Studio Jest only, never adapted to the offline runner.
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { M01_CARRIER_MODEL, M01_CARRIER_PLACEMENT } from "../shared/M01CarrierPlan";
import { placeM01CarrierStandIn } from "../server/M01World";

let model: Model | undefined;
afterEach(() => { model?.Destroy(); model = undefined; });

describe("M01 carrier stand-in", () => {
	it("is clearly labelled, correctly sized, non-queryable and starboard-islanded", () => {
		const parent = new Instance("Folder");
		model = placeM01CarrierStandIn(parent);
		expect(model.Name).toBe("CarrierStandIn");
		expect(model.GetAttribute("StandIn")).toBe(true);
		const [box, size] = model.GetBoundingBox();
		expect(size.X).toBeCloseTo(M01_CARRIER_MODEL.size.x, 3);
		expect(size.Y).toBeCloseTo(M01_CARRIER_MODEL.size.y, 3);
		expect(size.Z).toBeCloseTo(M01_CARRIER_MODEL.size.z, 3);
		expect(box.Position.Y - size.Y / 2 + M01_CARRIER_MODEL.waterlineAboveKeel).toBeCloseTo(M01_CARRIER_PLACEMENT.y, 3);
		const island = model.FindFirstChild("StandInIslandStarboard") as BasePart;
		expect(model.GetPivot().PointToObjectSpace(island.Position).X).toBeGreaterThan(0);
		for (const item of model.GetDescendants()) if (item.IsA("BasePart")) {
			expect(item.CanCollide).toBe(false);
			expect(item.CanTouch).toBe(false);
			expect(item.CanQuery).toBe(false);
		}
		parent.Destroy();
	});
});
