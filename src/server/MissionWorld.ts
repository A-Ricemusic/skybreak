import { M14World } from "./M14World";
import { M14_WORLD_KEY } from "../shared/M14WorldPlan";
import { M15World } from "./M15World";
import { M15_WORLD_KEY } from "../shared/M15WorldPlan";
import { M16World } from "./M16World";
import { M16_WORLD_KEY } from "../shared/M16WorldPlan";
import { M17World } from "./M17World";
import { M17_WORLD_KEY } from "../shared/M17WorldPlan";
import { M18World } from "./M18World";
import { M18_WORLD_KEY } from "../shared/M18WorldPlan";
import { M12World } from "./M12World";
import { M13World } from "./M13World";
import { M12_WORLD_KEY } from "../shared/M12WorldPlan";
import { M13_WORLD_KEY } from "../shared/M13WorldPlan";
import { M10World } from "./M10World";
import { M10_WORLD_KEY } from "../shared/M10WorldPlan";
import { M11World } from "./M11World";
import { M11_WORLD_KEY } from "../shared/M11WorldPlan";
import { M08World } from "./M08World";
import { M09World } from "./M09World";
import { M08_WORLD_KEY } from "../shared/M08WorldPlan";
import { M09_WORLD_KEY } from "../shared/M09WorldPlan";
import { M06World } from "./M06World";
import { M07World } from "./M07World";
import { M06_WORLD_KEY } from "../shared/M06WorldPlan";
import { M07_WORLD_KEY } from "../shared/M07WorldPlan";
import { M04World } from "./M04World";
import { M04_WORLD_KEY } from "../shared/M04WorldPlan";
import { M05World } from "./M05World";
import { M05_WORLD_KEY } from "../shared/M05WorldPlan";
import { M02World } from "./M02World";
import { M02_WORLD_KEY } from "../shared/M02WorldPlan";
import { M03World } from "./M03World";
import { M03_WORLD_KEY } from "../shared/M03WorldPlan";
import { M01World } from "./M01World";
import { M01_WORLD_KEY } from "../shared/M01WorldPlan";
import { Workspace } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { Scenery } from "./Scenery";
import { beginTerrainWrite, clearTerrainIfDirty } from "./TerrainState";
import { WorldAssets, type WorldAssetName } from "./WorldAssets";
import { WorldBuilder } from "./WorldBuilder";
import { WorldEnvironment } from "./WorldEnvironment";

// A single-player place has one mission world. Terrain and lighting are owned
// by this lifecycle; combat owns the parent folder and destroys it on exit.
//
// Every campaign mission names its world through `worldKey`; WORLD_BUILDERS maps
// each key to the server builder (`MNNWorld.Build`) that executes the pure
// `MNNWorldPlan`. Only the practice flight (mission 0) is hand-composed here.
// Ground target positions are fixed by MissionCatalog and BlueprintRunner and
// must not move.

const GROUND = 44; // plateau top of every terrain island (apron slabs sit on it)
const APRON_TOP = 48;
/** Uploaded models the practice world places (preloaded with WorldAssets' deadline before building). */
const PRACTICE_UPLOADS: WorldAssetName[] = ["Hangar", "ControlTower", "Pine", "Broadleaf", "RockA", "RockB", "RockC"];

type WorldBuild = { groundTargets: Model[]; targetVisuals?: Map<string, Model> };
/** World key -> builder. A mission whose key is missing here fails loudly instead of getting a stand-in world. */
const WORLD_BUILDERS: ReadonlyMap<string, (parent: Instance) => WorldBuild> = new Map<string, (parent: Instance) => WorldBuild>([
	[M01_WORLD_KEY, (parent) => M01World.Build(parent)],
	[M02_WORLD_KEY, (parent) => M02World.Build(parent)],
	[M03_WORLD_KEY, (parent) => M03World.Build(parent)],
	[M04_WORLD_KEY, (parent) => M04World.Build(parent)],
	[M05_WORLD_KEY, (parent) => M05World.Build(parent)],
	[M06_WORLD_KEY, (parent) => M06World.Build(parent)],
	[M07_WORLD_KEY, (parent) => M07World.Build(parent)],
	[M08_WORLD_KEY, (parent) => M08World.Build(parent)],
	[M09_WORLD_KEY, (parent) => M09World.Build(parent)],
	[M10_WORLD_KEY, (parent) => M10World.Build(parent)],
	[M11_WORLD_KEY, (parent) => M11World.Build(parent)],
	[M12_WORLD_KEY, (parent) => M12World.Build(parent)],
	[M13_WORLD_KEY, (parent) => M13World.Build(parent)],
	[M14_WORLD_KEY, (parent) => M14World.Build(parent)],
	[M15_WORLD_KEY, (parent) => M15World.Build(parent)],
	[M16_WORLD_KEY, (parent) => M16World.Build(parent)],
	[M17_WORLD_KEY, (parent) => M17World.Build(parent)],
	[M18_WORLD_KEY, (parent) => M18World.Build(parent)],
]);

function apron(parent: Instance, x: number, z: number, width: number, depth: number, color: Color3): void {
	Scenery.Part(parent, "Apron", new Vector3(width, 4, depth), new Vector3(x, APRON_TOP - 2, z), color, Enum.Material.Concrete);
	for (const side of [-1, 1]) {
		Scenery.Part(parent, "Safety line", new Vector3(3, 0.3, depth - 10), new Vector3(x + side * (width / 2 - 7), APRON_TOP + 0.2, z), Color3.fromRGB(235, 185, 68), Enum.Material.SmoothPlastic, { flightSolid: false, castShadow: false });
	}
}

function grounded(model: Model, x: number, z: number, yaw = 0): Model {
	const [bounds, size] = model.GetBoundingBox();
	const bottom = bounds.Position.Y - size.Y / 2;
	model.PivotTo(new CFrame(x, APRON_TOP + 1 - bottom, z).mul(CFrame.Angles(0, yaw, 0)));
	return model;
}

const inside = (x: number, z: number, cx: number, cz: number, w: number, d: number): boolean => math.abs(x - cx) < w / 2 && math.abs(z - cz) < d / 2;
const near = (x: number, z: number, cx: number, cz: number, r: number): boolean => (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r;

/**
 * Mission 1: Varda Rim training airbase. One large island carries the runway,
 * taxiways, parking apron with parked jets, hangars, tower, fuel farm and the
 * radar pad (target at 0,-850). A rim of hills, boulders and trees frames the
 * field; a second islet group with a lighthouse sits to the south-east.
 */
function buildVardaRim(scenery: Folder, parent: Instance): Model[] {
	const P = Scenery.PALETTES.temperate;
	// Terrain water first: the islands overwrite it where land rises.
	Scenery.TerrainSea(scenery, Color3.fromRGB(35, 112, 142));

	// Landmasses (terrain). The main island is 1250 x 1850 with its top at GROUND.
	const islands: Array<[number, number, number, number, number]> = [[-300, -400, 1250, 1850, 0], [-1000, -1500, 700, 560, 0.3], [1250, -1400, 760, 620, -0.2], [-1500, 700, 520, 480, 0.5], [1000, 250, 420, 360, 0.4], [1350, 560, 240, 200, -0.3], [780, 640, 200, 180, 0.9]];
	// All voxel writes run back to back before any part is created (Scenery.Part may
	// yield), so the terrain replicates as one batch instead of being re-sent per op.
	for (const [x, z, w, d, yaw] of islands) Scenery.TerrainIsland(x, z, w, d, GROUND, yaw);
	for (const [x, z, r, peak] of [[-800, -1000, 170, 120], [-820, -250, 150, 115], [-680, 380, 120, 110], [-1000, -1500, 230, 125], [1250, -1400, 250, 125], [-1500, 700, 160, 118], [1000, 250, 120, 112]]) Scenery.TerrainHill(x, z, r, GROUND, peak);
	for (const [x, z, w, d, yaw] of islands) Scenery.Shoreline(scenery, x, z, w, d, P, yaw, false);

	// Airfield. Runway runs north-south at x=-520; the parking apron links to the
	// radar pad by a taxiway so the whole field reads as one installation.
	Scenery.Runway(scenery, new CFrame(-520, GROUND + 3, -600), 1000, 100, P);
	Scenery.Part(scenery, "Taxiway", new Vector3(110, 2, 36), new Vector3(-425, GROUND + 1.5, -430), P.asphalt, Enum.Material.Asphalt);
	Scenery.Part(scenery, "Taxiway", new Vector3(36, 2, 190), new Vector3(-60, GROUND + 1.5, -640), P.asphalt, Enum.Material.Asphalt);
	apron(scenery, -200, -430, 360, 240, P.concrete);
	Scenery.ParkedJets(scenery, [new Vector3(-330, 0, -500), new Vector3(-250, 0, -500), new Vector3(-170, 0, -500), new Vector3(-90, 0, -500)], APRON_TOP, 0);
	// The uploaded hangars (128 wide) and tower; the menu-world primitives only if the upload fails.
	// Place (not PlaceUploaded): a hangar whose clone fails still gets WorldAssets' simple block.
	if (WorldAssets.Has("Hangar")) for (const x of [-310, -170]) WorldAssets.Place("Hangar", scenery, new CFrame(x, GROUND, -238));
	else for (const x of [-330, -240, -150]) Scenery.Hangar(scenery, new CFrame(x, GROUND + 1, -275), P, Color3.fromRGB(240, 150, 60));
	if (WorldAssets.PlaceUploaded("ControlTower", scenery, new CFrame(40, GROUND, -330).mul(CFrame.Angles(0, math.pi / 2, 0))) === undefined) Scenery.ControlTower(scenery, new CFrame(40, GROUND, -330), P);
	Scenery.FuelFarm(scenery, 120, -520, GROUND, 3);
	Scenery.Road(scenery, [new Vector3(0, GROUND + 0.5, -250), new Vector3(240, GROUND + 0.5, -250)]);
	// Perimeter road around the whole island.
	const loop = [[-640, -1120], [40, -1120], [180, -980], [180, 320], [40, 380], [-640, 380], [-780, 240], [-780, -980], [-640, -1120]];
	Scenery.Road(scenery, loop.map(([x, z]) => new Vector3(x, GROUND + 0.5, z)));

	// Radar pad: the training target on its concrete apron plus a radome and huts.
	apron(scenery, 0, -850, 210, 240, P.concrete);
	for (const [x, z] of [[-95, -960], [95, -960], [-95, -740], [95, -740]]) Scenery.Light(scenery, new Vector3(x, APRON_TOP + 1, z), Color3.fromRGB(255, 120, 90));
	Scenery.Cylinder(scenery, "Radome plinth", 30, 10, new Vector3(165, GROUND + 5, -850), P.concrete, Enum.Material.Concrete);
	Scenery.Part(scenery, "Radome", new Vector3(30, 30, 30), new Vector3(165, GROUND + 24, -850), Color3.fromRGB(240, 242, 240), Enum.Material.SmoothPlastic, { shape: Enum.PartType.Ball });
	for (const z of [-790, -910]) Scenery.Part(scenery, "Equipment hut", new Vector3(20, 10, 14), new Vector3(150, GROUND + 5, z), Color3.fromRGB(96, 104, 108), Enum.Material.Metal);
	const radar = grounded(MissionAssets.CreateRadar("TRAINING RADAR"), 0, -850);
	radar.Parent = parent;

	// Rim dressing: boulders and trees stay off the airfield footprint.
	const airfield = (x: number, z: number): boolean => inside(x, z, -200, -650, 900, 1150) || inside(x, z, 0, -850, 400, 400);
	// Uploaded trees and rocks, grounded on the terrain by ray: woods on the rim hills and the outer islands.
	Scenery.Rocks(scenery, 11, P, -300, -400, 1200, 1800, GROUND, 24, airfield);
	Scenery.Trees(scenery, 12, -300, 320, 500, 200, GROUND, 18, airfield, 0.3);
	Scenery.Trees(scenery, 13, -250, -1270, 700, 80, GROUND, 10, airfield, 0.3);
	Scenery.Trees(scenery, 18, -800, -650, 260, 900, GROUND, 22, airfield, 0.5);
	Scenery.Trees(scenery, 14, 1000, 250, 300, 240, GROUND, 12, (x, z) => near(x, z, 1000, 250, 60), 0.4);
	Scenery.Trees(scenery, 19, -1000, -1500, 600, 480, GROUND, 18, () => false, 0.6);
	Scenery.Trees(scenery, 20, 1250, -1400, 640, 520, GROUND, 16, () => false, 0.6);
	Scenery.Trees(scenery, 21, -1500, 700, 440, 400, GROUND, 12, () => false, 0.4);
	Scenery.Rocks(scenery, 15, P, 1250, -1400, 600, 500, GROUND, 8, (x, z) => near(x, z, 1250, -1400, 240));
	Scenery.Lighthouse(scenery, 1350, 560, GROUND);

	// Horizon: sea stacks between the islands and a mountain ring at the boundary.
	const land = (x: number, z: number): boolean => islands.some(([ix, iz, w, d]) => inside(x, z, ix, iz, w + 300, d + 300));
	Scenery.SeaStacks(scenery, 16, P, 14, 1500, 2350, land);
	Scenery.Mountains(scenery, 17, Color3.fromRGB(104, 112, 122));
	return [radar];
}

export const MissionWorld = {
	/** `targetVisuals`: a world's own drawing of each typed target, keyed by target id; combat adopts them instead of building copies. */
	Build(missionId: number, parent: Instance): WorldBuild {
		assert(MissionCatalog.Available(missionId), "Mission world is in development");
		if (missionId !== 0) {
			const key = MissionCatalog.WorldKey(missionId);
			const build = WORLD_BUILDERS.get(key);
			assert(build !== undefined, `Mission ${missionId} has no world builder for key ${key}`);
			Workspace.FindFirstChild("World")?.Destroy(); beginTerrainWrite();
			return build(parent);
		}
		const late = WorldAssets.Preload(PRACTICE_UPLOADS);
		if (late.size() > 0) warn(`[MissionWorld] M${missionId}: ${late.join(", ")} still loading after the preload deadline; placing fallbacks`);
		parent.SetAttribute("WorldPreloadLate", late.size());
		Workspace.FindFirstChild("World")?.Destroy();
		beginTerrainWrite();
		WorldEnvironment.Apply(MissionCatalog.Get(missionId).environment);
		const scenery = new Instance("Folder");
		scenery.Name = "FirstFlightWorld";
		scenery.Parent = parent;
		const groundTargets = buildVardaRim(scenery, parent);
		Scenery.Report(parent, scenery.Name, Scenery.PART_BUDGET, true);
		return { groundTargets };
	},
	RestoreMenu(): void {
		clearTerrainIfDirty();
		WorldEnvironment.Clear();
		WorldBuilder.Build();
	},
};
