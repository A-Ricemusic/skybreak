import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { AircraftCollision } from "../server/AircraftCollision";
import { Scenery } from "../server/Scenery";
import { JetFactory } from "../shared/JetFactory";

describe("authoritative aircraft surface sweeps", () => {
	let fixture: Folder;
	afterEach(() => { fixture?.Destroy(); Workspace.Terrain.Clear(); });
	function setup(): Folder {
		fixture = new Instance("Folder"); fixture.Parent = Workspace; return fixture;
	}
	it("includes newly spawned welded protected surfaces when the phase filter refreshes", () => {
		const root = setup();
		const before = AircraftCollision.Parameters(root);
		const actor = new Instance("Model"); actor.Parent = root;
		const aim = new Instance("Part"); aim.Anchored = true; aim.Transparency = 1; aim.CanQuery = false; aim.Parent = actor; actor.PrimaryPart = aim;
		const body = Scenery.Part(actor, "Protected vehicle", new Vector3(20, 20, 2), new Vector3(0, 600, 0), new Color3(1, 1, 1));
		JetFactory.WeldAssembly(actor);
		expect(body.CanQuery).toBe(true);
		const from = new Vector3(0, 600, 30), to = new Vector3(0, 600, -30);
		expect(AircraftCollision.Sweep(from, to, before)).toBeUndefined();
		expect(AircraftCollision.Sweep(from, to, AircraftCollision.Parameters(root))?.Instance).toBe(body);
	});
	it("sweeps through thin solid scenery without endpoint tunnelling", () => {
		const root = setup();
		const wall = Scenery.Part(root, "Wall", new Vector3(30, 30, 0.2), new Vector3(0, 600, 0), new Color3(1, 1, 1));
		expect(wall.CanCollide).toBe(false); expect(wall.CanQuery).toBe(true);
		const hit = AircraftCollision.Sweep(new Vector3(0, 600, 20), new Vector3(0, 600, -20), AircraftCollision.Parameters(root));
		expect(hit?.Instance).toBe(wall);
	});
	it("excludes overlays, invisible markers and untagged aircraft or projectiles", () => {
		const root = setup();
		Scenery.Part(root, "Shallows", new Vector3(40, 1, 40), new Vector3(0, 600, 0), new Color3(1, 1, 1), Enum.Material.SmoothPlastic, { transparency: 0.45 });
		for (const name of ["Marker light", "Safety line", "Centreline", "Center stripe"]) {
			const paint = Scenery.Part(root, name, new Vector3(40, 1, 40), new Vector3(0, 600, 0), new Color3(1, 1, 1));
			expect(paint.CanQuery).toBe(false);
		}
		const marker = new Instance("Part"); marker.Anchored = true; marker.Size = new Vector3(40, 1, 40); marker.Position = new Vector3(0, 600, 0); marker.Parent = root;
		expect(AircraftCollision.Sweep(new Vector3(0, 620, 0), new Vector3(0, 580, 0), AircraftCollision.Parameters(root))).toBeUndefined();
	});
	it("detects terrain and the rendered ocean with distinct reasons", () => {
		const root = setup();
		Workspace.Terrain.FillBlock(new CFrame(0, 600, 0), new Vector3(40, 8, 40), Enum.Material.Rock);
		// Terrain broadphase is asynchronous in Studio's RunScript mode.
		const params = AircraftCollision.Parameters(root);
		let hit: RaycastResult | undefined;
		const deadline = os.clock() + 3;
		do {
			task.wait(0.05);
			hit = AircraftCollision.Sweep(new Vector3(0, 630, 0), new Vector3(0, 570, 0), params);
		} while (!hit && os.clock() < deadline);
		assert(hit); expect(hit.Instance).toBe(Workspace.Terrain); expect(AircraftCollision.Reason(hit)).toBe("crash_terrain");
		const sea = Scenery.Part(root, "Sea", new Vector3(40, 4, 40), new Vector3(200, 600, 0), new Color3(1, 1, 1));
		const water = AircraftCollision.Sweep(new Vector3(200, 630, 0), new Vector3(200, 570, 0), AircraftCollision.Parameters(root));
		assert(water); expect(water.Instance).toBe(sea); expect(AircraftCollision.Reason(water)).toBe("crash_water");
	});
});
