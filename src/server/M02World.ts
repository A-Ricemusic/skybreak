import { Workspace } from "@rbxts/services";
import { buildM02Plan, M02, M02_ENVIRONMENT, M02_FILL_CHUNK, M02_WORLD_KEY, m02TargetLayout } from "../shared/M02WorldPlan";
import { UploadedAssets } from "../shared/UploadedAssets";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldAssets } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";

/** Dormant visual composition. Target contact poses are exported separately for combat integration.
 * Caller owns terrain clearing. No uploads, catalog mutation or combat registration.
 */
export const M02World = {
	Build(parent: Instance, seed = 202): { groundTargets: Model[] } {
		const start = os.clock();
		let slice = start, longest = 0;
		parent.SetAttribute("WorldBuildPhase", "plan");
		const plan = buildM02Plan(seed, () => {
			const elapsed = os.clock() - slice;
			longest = math.max(longest, elapsed);
			if (elapsed >= 0.004) { task.wait(); slice = os.clock(); }
		});
		parent.SetAttribute("WorldPlanSeconds", os.clock() - start);
		parent.SetAttribute("WorldPlanLongestSlice", longest);
		const names = plan.props.map((p) => p.asset);
		WorldAssets.Start(names);
		task.spawn(() => UploadedAssets.Preload(["HeavyBomber"], 0));
		WorldEnvironment.ApplySpec(M02_ENVIRONMENT, M02_WORLD_KEY);
		for (const [mat, color] of [[Enum.Material.Grass, Color3.fromRGB(69, 83, 48)], [Enum.Material.LeafyGrass, Color3.fromRGB(43, 61, 40)], [Enum.Material.Ground, Color3.fromRGB(99, 91, 61)], [Enum.Material.Mud, Color3.fromRGB(78, 83, 62)]] as const) Workspace.Terrain.SetMaterialColor(mat, color);
		const scene = new Instance("Folder"); scene.Name = M02_WORLD_KEY; scene.Parent = parent;
		parent.SetAttribute("WorldBuildPhase", "terrain");
		const timing = TerrainWriter.Write(plan.ops, 0.008, M02_FILL_CHUNK);
		parent.SetAttribute("WorldTerrainReadySeconds", os.clock() - start);
		parent.SetAttribute("WorldTerrainLongest", timing.longest);
		parent.SetAttribute("WorldTerrainJobs", timing.jobs);
		parent.SetAttribute("WorldBuildPhase", "dressing");
		for (let i = 0; i < plan.parts.size(); i++) {
			const p = plan.parts[i], at = new Vector3(p.x, p.y, p.z), color = Color3.fromRGB(...p.color);
			if (p.shape === "cylinder") Scenery.Cylinder(scene, p.name, p.sx, p.sy, at, color, material(p.material), { flightSolid: p.solid, castShadow: false });
			else Scenery.Part(scene, p.name, new Vector3(p.sx, p.sy, p.sz), new CFrame(at).mul(CFrame.Angles(0, p.yaw, 0)), color, material(p.material), { flightSolid: p.solid, castShadow: false });
			if (i % 32 === 31) task.wait();
		}
		for (let i = 0; i < plan.beams.size(); i++) {
			const b = plan.beams[i], a = new Vector3(...b.a), finish = new Vector3(...b.b);
			Scenery.Part(scene, b.name, new Vector3(b.name === "Power cable" ? 0.5 : 2, 2, finish.sub(a).Magnitude), CFrame.lookAt(a.add(finish).div(2), finish), Color3.fromRGB(...b.color), Enum.Material.Metal, { flightSolid: false, castShadow: false });
			if (i % 32 === 31) task.wait();
		}
		// Native Clouds has no controllable base height: 8,000 ft is metadata, not a false altitude claim.
		parent.SetAttribute("CloudBaseReferenceFeet", 8000);
		for (let i = 0; i < 8; i++) Scenery.Part(scene, "Early low mist", new Vector3(1400, 60, 700), new Vector3(i % 2 === 0 ? -450 : 450, 530, 12000 - i * 1100), Color3.fromRGB(166, 181, 178), Enum.Material.SmoothPlastic, { shape: Enum.PartType.Ball, transparency: 0.94, flightSolid: false, castShadow: false });
		let missing = 0;
		for (let i = 0; i < plan.props.size(); i++) {
			const p = plan.props[i];
			if (WorldAssets.PlaceUploaded(p.asset, scene, new CFrame(p.x, p.y, p.z).mul(CFrame.Angles(0, p.yaw, 0)), p.scale) === undefined) missing++;
			if (i % 8 === 7) task.wait();
		}
		const bomber = UploadedAssets.Cached(["HeavyBomber"]);
		for (const t of m02TargetLayout()) if (t.type === "bomber") {
			if (bomber === undefined) { missing++; continue; }
			const model = bomber.template.Clone();
			const [bounds, size] = model.GetBoundingBox();
			model.PivotTo(new CFrame(t.x, t.y + size.Y / 2 - bounds.Position.Y, t.z).mul(CFrame.Angles(0, t.yaw, 0)));
			model.Name = t.id; model.SetAttribute("LayoutGroup", t.group); model.Parent = scene;
		}
		assert(scene.GetDescendants().size() + 4 <= M02.budget.descendants, "M02 actual descendants exceed audited budget");
		parent.SetAttribute("WorldPropsMissing", missing);
		parent.SetAttribute("WorldBuildSeconds", os.clock() - start);
		parent.SetAttribute("Composition", plan.key);
		parent.SetAttribute("WorldBuildPhase", "done");
		return { groundTargets: [] };
	},
};
