import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { TerrainWriter } from "../server/TerrainWriter";
import type { TerrainOp } from "../shared/WorldPlan";

// Engine acceptance of the full-voxel fast path. Tiny isolated patches, no world
// construction/native Clear; restore the original patch without extending the
// terrain bounds (a distant test patch can inflate later native-clear cost).
describe("Aligned terrain region fills (Studio)", () => {
	it("matches shape rasterization for aligned solid, water and air boxes", () => {
		const center = new Vector3(0, 64, 0),
			size = new Vector3(8, 8, 8);
		const region = new Region3(center.sub(size.div(2)), center.add(size.div(2)));
		const terrain = Workspace.Terrain;
		const [originalMaterials, originalOccupancy] = terrain.ReadVoxels(region, 4);
		try {
			for (const mat of [Enum.Material.Rock, Enum.Material.Grass, Enum.Material.Water, Enum.Material.Air]) {
				terrain.FillRegion(region, 4, Enum.Material.Rock);
				terrain.FillBlock(new CFrame(center), size, mat);
				const [expectedMaterial, expectedOccupancy] = terrain.ReadVoxels(region, 4);
				terrain.FillRegion(region, 4, Enum.Material.Rock);
				const op: TerrainOp = {
					shape: "block",
					material: mat.Name as TerrainOp["material"],
					x: 0,
					y: 64,
					z: 0,
					sx: 8,
					sy: 8,
					sz: 8,
					yaw: 0,
				};
				TerrainWriter.WriteJob(terrain, { op, cells: 8 });
				const [actualMaterial, actualOccupancy] = terrain.ReadVoxels(region, 4);
				for (let x = 0; x < 2; x++)
					for (let y = 0; y < 2; y++)
						for (let z = 0; z < 2; z++) {
							expect(actualMaterial[x][y][z]).toBe(expectedMaterial[x][y][z]);
							expect(actualOccupancy[x][y][z]).toBe(expectedOccupancy[x][y][z]);
						}
			}
		} finally {
			terrain.WriteVoxels(region, 4, originalMaterials, originalOccupancy);
		}
	});
});
