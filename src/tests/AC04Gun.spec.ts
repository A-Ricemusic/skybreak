import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { ac04GunHitDistance } from "../server/AC04Gun";

describe("AC04 gun surface and obstruction hits", () => {
	let fixture: Folder | undefined;
	const origin = new Vector3(0, 5000, 0), forward = new Vector3(0, 0, -1);
	const target = (center: Vector3, size: Vector3) => {
		fixture = new Instance("Folder"); fixture.Parent = Workspace;
		const model = new Instance("Model"); model.Parent = fixture;
		const part = new Instance("Part"); part.Anchored = true; part.Size = size; part.Position = center; part.Parent = model; model.PrimaryPart = part;
		return model;
	};
	const cast = () => {
		const params = new RaycastParams(); params.FilterType = Enum.RaycastFilterType.Include; params.FilterDescendantsInstances = [fixture!];
		return Workspace.Raycast(origin, forward.mul(1200), params);
	};
	afterEach(() => { fixture?.Destroy(); fixture = undefined; });
	it("accepts a ship's front surface even when its center is hundreds of studs farther away", () => {
		const center = new Vector3(0, 5000, -700), model = target(center, new Vector3(160, 100, 600));
		const hit = cast(); expect(hit?.Instance.IsDescendantOf(model)).toBe(true);
		expect(ac04GunHitDistance(model, center, origin, forward, 1200, hit)).toBeCloseTo(400);
	});
	it("accepts a direct hit on a wide off-center target without a center-radius shortcut", () => {
		const center = new Vector3(400, 5000, -700), model = target(center, new Vector3(900, 100, 100));
		const hit = cast(); expect(hit?.Instance.IsDescendantOf(model)).toBe(true);
		expect(ac04GunHitDistance(model, center, origin, forward, 1200, hit)).toBeCloseTo(650);
	});
	it("rejects a target behind an unrelated wall, including within the former 25-stud grace", () => {
		const center = new Vector3(0, 5000, -310), model = target(center, new Vector3(10, 10, 10));
		const wall = new Instance("Part"); wall.Anchored = true; wall.Size = new Vector3(100, 100, 10); wall.Position = new Vector3(0, 5000, -300); wall.Parent = fixture;
		const hit = cast(); expect(hit?.Instance).toBe(wall);
		expect(ac04GunHitDistance(model, center, origin, forward, 1200, hit)).toBeUndefined();
	});
	it("retains the aim radius for non-query aircraft before the obstruction", () => {
		const center = new Vector3(8, 5000, -250), model = target(center, new Vector3(20, 8, 30)); model.PrimaryPart!.CanCollide = false; model.PrimaryPart!.CanQuery = false;
		const wall = new Instance("Part"); wall.Anchored = true; wall.Size = new Vector3(100, 100, 10); wall.Position = new Vector3(0, 5000, -300); wall.Parent = fixture;
		expect(ac04GunHitDistance(model, center, origin, forward, 1200, cast())).toBeCloseTo(250);
	});
});
