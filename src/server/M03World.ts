import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { Lighting, Workspace } from "@rbxts/services";
import { buildM03Plan, M03, M03_ENVIRONMENT, M03_FILL_CHUNK, M03_WORLD_KEY, type M03Target } from "../shared/M03WorldPlan";
import { M03_TARGET_TYPES } from "../shared/missions/m03";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldEnvironment } from "./WorldEnvironment";

/** Primitive stand-ins only; combat adopts each model by id as its typed target. */
export function placeM03Target(parent: Instance, t: M03Target): Model {
	const m = new Instance("Model");
	m.Name = t.id;
	m.SetAttribute("TargetType", t.type);
	m.SetAttribute("TargetGroup", t.group);
	m.SetAttribute("StandIn", true);
	const frame = new CFrame(t.x, t.y, t.z).mul(CFrame.Angles(0, t.yaw, 0));
	const part = (name: string, size: Vector3, offset: Vector3, color: Color3, ball = false) => {
		const p = Scenery.Part(m, name, size, new Vector3(0, 0, 0), color, Enum.Material.SmoothPlastic, { shape: ball ? Enum.PartType.Ball : Enum.PartType.Block, flightSolid: true, castShadow: false });
		p.CFrame = frame.mul(new CFrame(offset));
		if (m.PrimaryPart === undefined) m.PrimaryPart = p;
	};
	const grey = Color3.fromRGB(92, 103, 112);
	if (t.type === "radar") {
		part("Plinth", new Vector3(28, 6, 28), new Vector3(0, 3, 0), grey);
		part("Snow radome", new Vector3(24, 24, 24), new Vector3(0, 18, 0), Color3.fromRGB(234, 240, 243), true);
	} else if (t.type === "aaGun") {
		part("Base", new Vector3(14, 4, 14), new Vector3(0, 2, 0), grey);
		part("Turret", new Vector3(8, 6, 8), new Vector3(0, 7, 0), grey);
		part("Twin barrel stand-in", new Vector3(6, 2, 18), new Vector3(0, 10, -8), grey);
	} else {
		part("Fuselage", new Vector3(12, 12, 34), new Vector3(0, 10, 0), grey, true);
		for (const side of [-1, 1]) part("Landing gear", new Vector3(3, 4, 26), new Vector3(side * 7, 2, 0), grey);
		for (const z of [-13, 13]) {
			part("Rotor mast", new Vector3(2, 7, 2), new Vector3(0, 19, z), grey);
			part("Parked rotor", new Vector3(40, 1, 3), new Vector3(0, 23, z), grey);
		}
	}
	m.WorldPivot = frame;
	m.Parent = parent;
	return m;
}


/** Mission 3's world. No uploads or asset downloads. Every m03TargetLayout site is drawn exactly once, as its
 * own model keyed by target id in `targetVisuals`; combat adopts those models instead of building copies.
 */
export const M03World = {
	Build(parent: Instance, seed = 303): { groundTargets: Model[]; targetVisuals: Map<string, Model> } {
  WorldAssets.Preload(MILITARY_GROUND_ASSETS);
		const start = os.clock();
		let slice = start, longest = 0;
		parent.SetAttribute("WorldBuildPhase", "plan");
		const plan = buildM03Plan(seed, () => {
			const dt = os.clock() - slice;
			longest = math.max(longest, dt);
			if (dt >= 0.004) { task.wait(); slice = os.clock(); }
		});
		parent.SetAttribute("WorldPlanSeconds", os.clock() - start);
		parent.SetAttribute("WorldPlanLongestSlice", longest);
		WorldEnvironment.ApplySpec(M03_ENVIRONMENT, M03_WORLD_KEY);
		Workspace.Terrain.SetMaterialColor(Enum.Material.Snow, Color3.fromRGB(227, 236, 242));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Rock, Color3.fromRGB(62, 70, 78));
		Workspace.Terrain.SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(65, 75, 62));
		const rays = new Instance("SunRaysEffect");
		rays.Name = "M03SunRays"; rays.Intensity = 0.12; rays.Spread = 0.85; rays.Parent = Lighting;
		const scene = new Instance("Folder"); scene.Name = M03_WORLD_KEY; scene.Parent = parent;
		parent.SetAttribute("WorldBuildPhase", "terrain");
		const timing = TerrainWriter.Write(plan.ops, 0.008, M03_FILL_CHUNK);
		parent.SetAttribute("WorldTerrainReadySeconds", os.clock() - start);
		parent.SetAttribute("WorldTerrainLongest", timing.longest);
		parent.SetAttribute("WorldTerrainJobs", timing.jobs);
		parent.SetAttribute("WorldBuildPhase", "dressing");
		for (let i = 0; i < plan.parts.size(); i++) {
			const p = plan.parts[i];
			Scenery.Part(scene, p.name, new Vector3(p.sx, p.sy, p.sz), new Vector3(p.x, p.y, p.z), Color3.fromRGB(...p.color), material(p.material), { shape: p.shape === "ball" ? Enum.PartType.Ball : Enum.PartType.Block, flightSolid: p.solid, castShadow: false });
			if (i % 32 === 31) task.wait();
		}
		// Each target model is drawn once here and adopted by id: HUD label, TargetId and an aim root.
		const targetVisuals = new Map<string, Model>();
		for (const t of plan.targets) targetVisuals.set(t.id, adoptGroundTarget(placeM03Target(scene, t), t.id, M03_TARGET_TYPES[t.type]));
		assert(scene.GetDescendants().size() <= M03.budget.descendants, "M03 descendants exceeded budget");
		parent.SetAttribute("WorldBuildPhase", "done");
		parent.SetAttribute("WorldBuildSeconds", os.clock() - start);
		parent.SetAttribute("Composition", plan.key);
		parent.SetAttribute("WorldTargetVisuals", targetVisuals.size());
		return { groundTargets: [], targetVisuals };
	},
};
