import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { HttpService, ServerStorage, Workspace } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";

interface MeshExport {
	asset: string;
	vertices: number[][];
	faces: unknown[];
	materials: { name: string }[];
	bounds: { dimensions: number[] };
}

describe("Last Tide Blender mission assets", () => {
	let fixture: Folder | undefined;
	afterEach(() => { fixture?.Destroy(); fixture = undefined; });

	function parent(): Folder {
		fixture = new Instance("Folder");
		fixture.Name = "LastTideMissionAssetFixture";
		fixture.Parent = Workspace;
		return fixture;
	}

	function exportFor(kind: "Corvette" | "Sam"): MeshExport {
		const source = ServerStorage.FindFirstChild(`${kind}Geometry`);
		expect(source?.IsA("StringValue")).toBe(true);
		assert(source?.IsA("StringValue"), `Missing packaged ${kind} geometry`);
		return HttpService.JSONDecode(source.Value) as MeshExport;
	}

	it("packages the authored corvette and SAM within the mobile mesh budget", () => {
		const corvette = exportFor("Corvette");
		expect(corvette.asset).toBe("Last Tide Blockade Corvette");
		expect(corvette.vertices).toHaveLength(722);
		expect(corvette.faces).toHaveLength(1378);
		expect(corvette.materials).toHaveLength(7);
		expect(corvette.bounds.dimensions[2]).toBeCloseTo(78, 3);
		const sam = exportFor("Sam");
		expect(sam.asset).toBe("Last Tide Island SAM Battery");
		expect(sam.vertices).toHaveLength(592);
		expect(sam.faces).toHaveLength(1112);
		expect(sam.materials).toHaveLength(6);
		expect(sam.bounds.dimensions[0]).toBeCloseTo(34, 3);
	});

	it("creates reusable Roblox-native colored static geometry", () => {
		const root = parent();
		for (const [kind, model] of [["Corvette", MissionAssets.CreateCorvette("QA CORVETTE")], ["Sam", MissionAssets.CreateSam("QA SAM")]] as const) {
			model.Parent = root;
			expect(model.GetAttribute("GeometryAsset")).toBe(kind);
			expect(model.GetAttribute("GeometrySource")).toBe("Blender");
			expect(model.PrimaryPart?.Name).toBe("Root");
			let triangles = 0;
			let renderParts = 0;
			for (const item of model.GetChildren()) {
				if (!item.IsA("MeshPart")) continue;
				renderParts++;
				triangles += item.GetAttribute("BlenderTriangleCount") as number;
				expect(item.Material === Enum.Material.Concrete || item.Material === Enum.Material.Metal || item.Material === Enum.Material.Glass || item.Material === Enum.Material.Neon || item.Material === Enum.Material.SmoothPlastic).toBe(true);
				expect(item.CanCollide).toBe(false);
				expect(item.CanTouch).toBe(false);
				expect(item.CanQuery).toBe(false);
			}
			expect(renderParts).toBe(kind === "Corvette" ? 7 : 6);
			expect(triangles).toBe(kind === "Corvette" ? 1378 : 1112);
		}
	}, 60000);
});
