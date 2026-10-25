import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Lighting, Workspace } from "@rbxts/services";
import { MissionWorld } from "../server/MissionWorld";
import { MissionCatalog } from "../shared/MissionCatalog";
import { MissionAssets } from "../shared/MissionAssets";

// Engine-only integration. Compiles offline; runs only under the leased Studio
// Roblox Jest runner. GeometrySource must prove mesh generation, never fallback.
describe("27 authored mission worlds and new Blender targets", () => {
	let fixture: Folder | undefined;
	afterEach(() => { fixture?.Destroy(); fixture = undefined; MissionWorld.RestoreMenu(); });
	for (let id=1;id<=27;id++) {
		it(`builds and disposes the authored level ${id} with phase-owned ground targets`, () => {
			fixture = new Instance("Folder"); fixture.Name = `GlassWorldFixture${id}`; fixture.Parent = Workspace;
			const world = MissionWorld.Build(id,fixture);
			let required = 0;
			for (const model of world.groundTargets) {
				expect(model.Parent).toBe(fixture); expect(model.GetAttribute("GeometrySource")).toBe("Blender");
				assert(model.PrimaryPart);
				if (model.GetAttribute("RequiredTarget") === true) {
					required++;
					const index = model.GetAttribute("PhaseIndex") as number;
					expect(MissionCatalog.Get(id).phases[index].groundKind).toBe(model.GetAttribute("GroundArchetype"));
				}
				for (const part of model.GetDescendants()) if (part.IsA("BasePart")) {
					expect(part.Anchored).toBe(true); expect(part.CanCollide || part.CanTouch || part.CanQuery).toBe(false);
				}
			}
			expect(required).toBe(MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)));
			expect(fixture.GetDescendants().filter(v=>v.IsA("BasePart")).size()).toBeLessThan(250);
			fixture.Destroy(); fixture = undefined; MissionWorld.RestoreMenu();
			expect(Workspace.Terrain.FindFirstChild("MissionClouds")).toBeUndefined();
			expect(Lighting.FindFirstChild("MissionAtmosphere")).toBeUndefined();
			expect(Workspace.FindFirstChild("World")).toBeDefined();
		},30000);
	}
	for (const kind of ["Relay","SAM","Carrier"] as const) {
		it(`replicates a bounded Blender ${kind} target with native material groups`, () => {
			fixture = new Instance("Folder"); fixture.Parent = Workspace;
			const model = kind === "Relay" ? MissionAssets.CreateRelay(kind) : kind === "SAM" ? MissionAssets.CreateSAM(kind) : MissionAssets.CreateCarrier(kind);
			model.Parent = fixture;
			expect(model.GetAttribute("GeometrySource")).toBe("Blender");
			expect(model.GetAttribute("BlenderTriangleCount") as number).toBeLessThan(2200);
			expect(model.GetChildren().filter(v=>v.IsA("MeshPart")).size()).toBeLessThanOrEqual(7);
		},30000);
	}
});
