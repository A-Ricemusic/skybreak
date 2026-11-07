import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import {
	captureTerrainProbes,
	criticalGeometryReady,
	markCriticalGeometry,
	terrainProbesReady,
	snapshotTerrainColumn,
	terrainColumnHit,
	MAX_TERRAIN_RAY,
	type LoadingTerrainProbe,
} from "../shared/MissionReadiness";

describe("scoped critical geometry readiness", () => {
	it("cannot substitute equal-count cosmetics or another mission for missing critical geometry", () => {
		const folder = new Instance("Folder");
		folder.Parent = Workspace;
		const root = new Instance("Part");
		root.Parent = folder;
		const surface = new Instance("Part");
		surface.SetAttribute("FlightSolid", true);
		surface.Parent = folder;
		const total = markCriticalGeometry(folder, [root]);
		expect(total).toBe(2);
		expect(criticalGeometryReady(folder, total)).toBe(true);
		const other = new Instance("Folder");
		other.Parent = Workspace;
		surface.Parent = other;
		new Instance("Part").Parent = folder;
		expect(criticalGeometryReady(folder, total)).toBe(false);
		surface.Parent = folder;
		expect(criticalGeometryReady(folder, total)).toBe(true);
		root.Clone().Parent = folder;
		expect(criticalGeometryReady(folder, total)).toBe(false);
		folder.Destroy();
		other.Destroy();
	});

	it("retains required columns across temporary misses, bounds failure and honours cancellation", () => {
		const position = new Vector3(100000, 300, 100000);
		const required: LoadingTerrainProbe = {
			origin: position,
			distance: 100,
			expected: { minY: 200, maxY: 204, material: Enum.Material.Rock },
		};
		let calls = 0;
		const probes = captureTerrainProbes([position], {
			bounds: { minY: 0, maxY: 300 },
			timeout: 1,
			snapshot: () => ({ ...required }),
			raycast: () => {
				calls++;
				return calls < 3
					? undefined
					: { Position: new Vector3(100000, 202, 100000), Material: Enum.Material.Rock };
			},
		});
		expect(calls).toBe(3);
		expect(probes?.size()).toBe(1);
		expect(probes?.[0].expected?.material).toBe(Enum.Material.Rock);
		expect(
			captureTerrainProbes([position], {
				bounds: { minY: 0, maxY: 300 },
				timeout: 0.05,
				snapshot: () => required,
				raycast: () => undefined,
			}),
		).toBeUndefined();
		calls = 0;
		expect(
			captureTerrainProbes([position], {
				bounds: { minY: 0, maxY: 300 },
				alive: () => calls < 1,
				snapshot: () => required,
				raycast: () => {
					calls++;
					return undefined;
				},
			}),
		).toBeUndefined();
		expect(terrainProbesReady([])).toBe(false);
		expect(terrainProbesReady(undefined)).toBe(false);
	});
	it("represents genuinely empty columns explicitly and waits out stale occupied collision", () => {
		const position = new Vector3(100000, 300, 100000);
		let calls = 0;
		const probes = captureTerrainProbes([position], {
			bounds: { minY: 0, maxY: 300 },
			timeout: 1,
			snapshot: () => ({ origin: position, distance: 100 }),
			raycast: () => {
				calls++;
				return calls < 3
					? { Position: new Vector3(100000, 202, 100000), Material: Enum.Material.Rock }
					: undefined;
			},
		});
		expect(calls).toBe(3);
		expect(probes?.size()).toBe(1);
		expect(probes?.[0].expected).toBeUndefined();
		expect(captureTerrainProbes([], { bounds: { minY: 0, maxY: 300 } })).toBeUndefined();
		expect(() => terrainColumnHit(position, MAX_TERRAIN_RAY + 1)).toThrow();
		expect(() => snapshotTerrainColumn(position, { minY: -10000, maxY: 10000 })).toThrow();
	});
	it("requires matching observed native terrain after both fill and removal refresh", () => {
		const center = new Vector3(100000, 200, 100000);
		const frame = new CFrame(center);
		const size = new Vector3(32, 32, 32);
		const positions = [center.add(new Vector3(0, 100, 0))];
		const bounds = { minY: 100, maxY: 320 };
		Workspace.Terrain.FillBlock(frame, size, Enum.Material.Rock);
		try {
			// Voxel authority must retain the prerequisite even before collision refresh.
			expect(snapshotTerrainColumn(positions[0], bounds).expected?.material).toBe(Enum.Material.Rock);
			const probes = captureTerrainProbes(positions, { bounds, timeout: 3 });
			assert(probes !== undefined, "Rock voxel column never gained matching native collision within 3s");
			expect(probes.size()).toBe(1);
			expect(terrainProbesReady(probes)).toBe(true);
			Workspace.Terrain.FillBlock(frame, size, Enum.Material.Air);
			expect(snapshotTerrainColumn(positions[0], bounds).expected).toBeUndefined();
			const empty = captureTerrainProbes(positions, { bounds, timeout: 3 });
			assert(empty !== undefined, "Air voxel column retained stale native collision beyond 3s");
			expect(empty.size()).toBe(1);
			expect(empty[0].expected).toBeUndefined();
			expect(terrainProbesReady(empty)).toBe(true);
			expect(terrainProbesReady(probes)).toBe(false);
		} finally {
			Workspace.Terrain.FillBlock(frame, size, Enum.Material.Air);
		}
	});
});
