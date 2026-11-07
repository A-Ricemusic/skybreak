import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import {
	captureTerrainProbes,
	criticalGeometryReady,
	markCriticalGeometry,
	terrainProbesReady,
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
	it("requires matching local terrain at the server's critical sampled column", () => {
		const center = new Vector3(100000, 200, 100000);
		const frame = new CFrame(center);
		const size = new Vector3(32, 32, 32);
		Workspace.Terrain.FillBlock(frame, size, Enum.Material.Rock);
		const [ok, err] = pcall(() => {
			const probes = captureTerrainProbes([center.add(new Vector3(0, 100, 0))]);
			expect(probes.size()).toBe(1);
			expect(terrainProbesReady(probes)).toBe(true);
			Workspace.Terrain.FillBlock(frame, size, Enum.Material.Air);
			expect(terrainProbesReady(probes)).toBe(false);
			expect(terrainProbesReady(undefined)).toBe(false);
		});
		Workspace.Terrain.FillBlock(frame, size, Enum.Material.Air);
		assert(ok, tostring(err));
	});
});
