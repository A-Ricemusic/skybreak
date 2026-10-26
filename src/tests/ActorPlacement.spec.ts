import { describe, expect, it } from "@rbxts/jest-globals";
import { ActorPlacement } from "../shared/ActorPlacement";

// Pure placement contracts; also run in the offline Luau VM. The raycast half is covered in Combat.spec.
describe("Protected actor placement", () => {
	it("rests a model's bounds on the surface under it", () => {
		// A truck whose pivot is 16.5 studs above its wheels, on a road at y = 44.
		expect(ActorPlacement.PivotY(44, 16.5, false)).toBe(60.5);
		// The old hard-coded heights: a defended tower at y 92 over a 41.5 quay floated 32 studs; now it stands on it.
		expect(ActorPlacement.PivotY(41.5, 18.5, false) - 18.5).toBe(41.5);
	});
	it("floats a boat at the waterline with its draught under water", () => {
		expect(ActorPlacement.PivotY(-18, 18.5, true)).toBe(-18 + 18.5 - ActorPlacement.Draught);
	});
	it("recognises terrain water and the authored sea, river and shallows sheets as water", () => {
		expect(ActorPlacement.IsWater("Water", "Terrain")).toBe(true);
		expect(ActorPlacement.IsWater("SmoothPlastic", "Sea")).toBe(true);
		expect(ActorPlacement.IsWater("SmoothPlastic", "River")).toBe(true);
		expect(ActorPlacement.IsWater("SmoothPlastic", "Shallows")).toBe(true);
		expect(ActorPlacement.IsWater("Grass", "Coastal ground")).toBe(false);
		expect(ActorPlacement.IsWater("Concrete", "Quay")).toBe(false);
	});
});
