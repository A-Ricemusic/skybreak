import { Lighting, Workspace } from "@rbxts/services";
import { buildM01Plan, M01, M01_CLOUD_BASE, M01_ENVIRONMENT, M01_WORLD_KEY } from "../shared/M01WorldPlan";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldAssets } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";

/** C2/cutover may call this explicitly by worldKey; no current mission calls it.
 * Caller owns Terrain clearing and mission-clock handoff. Returns only after all work.
 * No uploads: clones ONLY the existing approved library. Missing dressing is omitted.
 */
export const M01World = {
	Build(parent: Instance, seed = 101): { groundTargets: Model[] } {
		const start = os.clock(), plan = buildM01Plan(seed);
		const names = plan.props.map((p) => p.asset);
		WorldAssets.Start(names);
		WorldEnvironment.ApplySpec(M01_ENVIRONMENT, M01_WORLD_KEY);
		Workspace.Terrain.SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(36, 59, 62));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Rock, Color3.fromRGB(51, 70, 87));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(161, 169, 163));
		const scene = new Instance("Folder");
		scene.Name = M01_WORLD_KEY;
		scene.Parent = parent;
		const terrain = TerrainWriter.Write(plan.ops);
		parent.SetAttribute("WorldTerrainReadySeconds", os.clock() - start);
		parent.SetAttribute("WorldTerrainLongest", terrain.longest);
		parent.SetAttribute("WorldTerrainJobs", terrain.jobs);
		for (const p of plan.parts) Scenery.Part(scene, p.name, new Vector3(p.sx, p.sy, p.sz), new Vector3(p.x, p.y, p.z), Color3.fromRGB(...p.color), material(p.material), { flightSolid: p.solid, castShadow: false });
		// Native Clouds has no altitude property. Sparse non-solid wisps locate the broken
		// lower layer at the reference 6000 ft; native Clouds remains the high overcast deck.
		for (let i = 0; i < 8; i++) Scenery.Part(scene, "High cloud wisp", new Vector3(1800, 96, 1200), new Vector3((i % 2) * 2800 - 1400, M01_CLOUD_BASE + 48, -4800 + math.floor(i / 2) * 2600), Color3.fromRGB(185, 199, 216), Enum.Material.SmoothPlastic, { shape: Enum.PartType.Ball, transparency: 0.9, flightSolid: false, castShadow: false });
		const rays = new Instance("SunRaysEffect");
		rays.Name = "M01SunRays";
		rays.Intensity = 0.06;
		rays.Spread = 0.8;
		rays.Parent = Lighting;
		// Do not block another 30 s on cold uploads. Missing templates are reported; D1 owns carrier.
		let missing = 0;
		for (let i = 0; i < plan.props.size(); i++) {
			const p = plan.props[i];
			if (WorldAssets.PlaceUploaded(p.asset, scene, new CFrame(p.x, p.y, p.z), p.scale) === undefined) missing++;
			if (i % 40 === 39) task.wait();
		}
		const descendants = scene.GetDescendants().size();
		assert(descendants + 4 <= M01.budget.descendants, "M01 approved template descendants exceeded budget; do not select before re-audit");
		parent.SetAttribute("WorldPropsMissing", missing);
		parent.SetAttribute("WorldBuildSeconds", os.clock() - start);
		parent.SetAttribute("Composition", plan.key);
		return { groundTargets: [] };
	},
};
