import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { AircraftCollision } from "../server/AircraftCollision";
import { sphereSweep } from "../shared/SphereSweep";
import { terrainProbeLength, terrainSeconds } from "../shared/FlightWarnings";

describe("segmented engine sphere sweeps", () => {
	let fixture: Folder;
	afterEach(() => fixture?.Destroy());
	function setup() {
		fixture = new Instance("Folder"); fixture.Parent = Workspace;
		const params = new RaycastParams(); params.FilterType = Enum.RaycastFilterType.Include; params.FilterDescendantsInstances = [fixture];
		return params;
	}
	function wall(distance: number) {
		const part = new Instance("Part"); part.Anchored = true; part.Size = new Vector3(1, 100, 100);
		part.Position = new Vector3(distance, 10000, 0); part.Parent = fixture; return part;
	}
	const origin = new Vector3(0, 10000, 0);
	it("preserves the full 600 studs/s two-second warning horizon and total distance", () => {
		const params = setup(), far = wall(1150);
		const result = sphereSweep(origin, 6, new Vector3(terrainProbeLength(600), 0, 0), params);
		expect(result?.hit.Instance).toBe(far); expect(result?.distance).toBeCloseTo(1143.5, 1);
		expect(terrainSeconds(result?.distance, 600)).toBeCloseTo(1143.5 / 600, 2);
		const near = wall(400);
		expect(sphereSweep(origin, 6, new Vector3(1200, 0, 0), params)?.hit.Instance).toBe(near);
	});
	it("casts just below, at and above the API limit, including diagonals and long correction steps", () => {
		const params = setup();
		for (const length of [1023.99, 1024, 1024.01, 1200, 3600]) {
			const target = wall(length - 10);
			expect(sphereSweep(origin, 4, new Vector3(length, 0, 0), params)?.hit.Instance).toBe(target);
			target.Destroy();
			expect(sphereSweep(origin, 6, new Vector3(1, 1, 1).Unit.mul(length), params)).toBeUndefined();
		}
	});
	it("routes long authoritative collision sweeps through the same engine implementation and excludes aircraft", () => {
		setup();
		const target = wall(2500); target.SetAttribute("FlightSolid", true);
		const aircraft = wall(20); // Queryable aircraft-like geometry, deliberately untagged.
		const result = AircraftCollision.Sweep(origin, origin.add(new Vector3(3600, 0, 0)), AircraftCollision.Parameters(fixture));
		expect(result?.Instance).toBe(target);
		expect(result?.Instance).never.toBe(aircraft);
		expect(AircraftCollision.Sweep(origin, origin, AircraftCollision.Parameters(fixture))).toBeUndefined();
	});
	it("rejects invalid geometry and handles zero and reverse travel without an engine error", () => {
		const params = setup();
		for (const value of [0, -1, 257, math.huge, 0 / 0]) expect(sphereSweep(origin, value, new Vector3(1200, 0, 0), params)).toBeUndefined();
		for (const delta of [Vector3.zero, new Vector3(math.huge, 0, 0), new Vector3(0 / 0, 0, 0), new Vector3(1000001, 0, 0)]) expect(sphereSweep(origin, 4, delta, params)).toBeUndefined();
		expect(sphereSweep(new Vector3(math.huge, 0, 0), 4, Vector3.one, params)).toBeUndefined();
		const behind = wall(-1150);
		expect(sphereSweep(origin, 4, new Vector3(-1200, 0, 0), params)?.hit.Instance).toBe(behind);
	});
});
