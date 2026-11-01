import { beginTerrainWrite } from "./TerrainState";
import { Workspace } from "@rbxts/services";
import type { Rgb } from "../shared/EnvironmentPresets";
import { MissionAssets } from "../shared/MissionAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { WorldPlanner, type PartSpec, type PropAsset, type PropSpec, type WorldPlan } from "../shared/WorldPlan";
import { Scenery } from "./Scenery";
import { material, TerrainWriter } from "./TerrainWriter";
import { WorldAssets } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";

// Executes the pure WorldPlan for missions 3-27 (shared/WorldPlan): Terrain
// voxel relief and water, the few primitive parts (runways, aprons, decks,
// roads), clones of the cached uploaded Blender models, and the ground
// targets. The plan is audited offline (WorldAudit); this file only turns
// its numbers into instances, in a fixed order:
//   1. environment and terrain colours, 2. the voxel ops as bounded jobs on a
//   per-frame time budget (TerrainWriter), 3. parts (Scenery.Part yields every
//   150), 4. props (template loads start before step 1 and are awaited here, bounded by
//   WorldAssets' preload timeout; placement itself never waits), 5. targets.
// Build timings land on the parent as attributes (WorldBuildSeconds,
// WorldTerrainLongest, ...) so an engine run can read the worst stall.
// A prop whose template fails to load takes WorldAssets' simple fallback, or
// a small primitive stand-in for trees, rocks, masts, dishes and cranes.

const rgb = (c: Rgb) => Color3.fromRGB(c[0], c[1], c[2]);
const yawFrame = (x: number, y: number, z: number, yaw: number) => new CFrame(x, y, z).mul(CFrame.Angles(0, yaw, 0));
/** Props per batch before yielding, so a 170-prop farm does not hold the heartbeat. */
const PROP_YIELD = 40;

function writeTerrain(plan: WorldPlan): ReturnType<typeof TerrainWriter.Write> {
	const terrain = Workspace.Terrain;
	for (const [name, color] of plan.materialColors) terrain.SetMaterialColor(material(name), rgb(color));
	return TerrainWriter.Write(plan.ops);
}

function buildPart(parent: Instance, p: PartSpec): void {
	if (p.mesh !== undefined) {
		const model = MissionAssets.CreateWorldKit(p.mesh);
		model.PivotTo(yawFrame(p.x, p.y, p.z, p.yaw));
		for (const item of model.GetDescendants()) if (item.IsA("BasePart")) item.CastShadow = false;
		model.Parent = parent;
		return;
	}
	const options = { flightSolid: p.solid, castShadow: false, transparency: p.transparency, reflectance: p.reflectance };
	const color = rgb(p.color), mat = material(p.material);
	if (p.shape === "cylinder") return void Scenery.Cylinder(parent, p.name, p.sx, p.sy, new Vector3(p.x, p.y, p.z), color, mat, options);
	if (p.shape === "ball") return void Scenery.Part(parent, p.name, new Vector3(p.sx, p.sx, p.sx), new Vector3(p.x, p.y, p.z), color, mat, { ...options, shape: Enum.PartType.Ball });
	return void Scenery.Part(parent, p.name, new Vector3(p.sx, p.sy, p.sz), yawFrame(p.x, p.y, p.z, p.yaw), color, mat, { ...options, className: p.shape === "wedge" ? "WedgePart" : "Part" });
}

const BARK = Color3.fromRGB(92, 70, 50);
const LEAVES = [Color3.fromRGB(58, 96, 52), Color3.fromRGB(70, 108, 58), Color3.fromRGB(50, 86, 60)];
const STONE = [Color3.fromRGB(112, 106, 98), Color3.fromRGB(96, 92, 86), Color3.fromRGB(128, 120, 108)];
const STEEL = Color3.fromRGB(200, 176, 70);
/** Primitive stand-ins for the dressing WorldAssets has no fallback for (used only when the upload fails). */
function standIn(parent: Instance, p: PropSpec): void {
	const s = p.scale, at = yawFrame(p.x, p.y, p.z, p.yaw);
	if (p.asset === "Pine" || p.asset === "Broadleaf") {
		const trunk = (p.asset === "Pine" ? 16 : 14) * s, crown = (p.asset === "Pine" ? 22 : 30) * s;
		Scenery.Part(parent, "Trunk", new Vector3(3 * s, trunk, 3 * s), at.mul(new CFrame(0, trunk / 2, 0)), BARK, Enum.Material.Wood);
		if (p.asset === "Pine") Scenery.Part(parent, "Canopy", new Vector3(crown, crown * 1.9, crown), at.mul(new CFrame(0, trunk + crown * 0.8, 0)), LEAVES[p.tint % 3], Enum.Material.Grass, { shape: Enum.PartType.Ball });
		else Scenery.Part(parent, "Canopy", new Vector3(crown, crown * 0.9, crown), at.mul(new CFrame(0, trunk + crown * 0.35, 0)), LEAVES[p.tint % 3], Enum.Material.Grass, { shape: Enum.PartType.Ball });
	} else if (p.asset === "RockA" || p.asset === "RockB" || p.asset === "RockC") {
		const size = WorldAssets.Spec(p.asset).size.mul(s);
		Scenery.Part(parent, "Boulder", size, at.mul(new CFrame(0, size.Y * 0.35, 0)), STONE[p.tint % 3], Enum.Material.Rock);
	} else if (p.asset === "RelayMast") {
		Scenery.Part(parent, "Mast", new Vector3(6, 150, 6), at.mul(new CFrame(0, 75, 0)), Color3.fromRGB(190, 60, 50), Enum.Material.Metal);
	} else if (p.asset === "RadarDish") {
		Scenery.Cylinder(parent, "Dish pedestal", 10, 24, at.mul(new CFrame(0, 12, 0)).Position, Color3.fromRGB(150, 154, 156), Enum.Material.Metal);
		Scenery.Part(parent, "Dish", new Vector3(44, 44, 8), at.mul(new CFrame(0, 36, 0)).mul(CFrame.Angles(-0.5, 0, 0)), Color3.fromRGB(226, 228, 226), Enum.Material.SmoothPlastic);
	} else if (p.asset === "GantryCrane") {
		Scenery.Crane(parent, p.x, p.z, p.y, p.yaw, 150, STEEL);
	}
}

function placeProp(parent: Instance, p: PropSpec): Model | undefined {
	const model = WorldAssets.Place(p.asset, parent, yawFrame(p.x, p.y, p.z, p.yaw), p.scale);
	if (model === undefined) standIn(parent, p);
	else if (p.tag !== undefined) {
		model.SetAttribute("WorldTag", p.tag);
		if (p.tag === "ProtectedHull") model.Name = "Command frigate";
	}
	return model;
}

export const RelayWorld = {
	Build(id: number, parent: Instance): { groundTargets: Model[] } {
		const started = os.clock();
		const bp = MissionCatalog.Get(id), plan = WorldPlanner.Build(id);
		// Start the uploaded-prop downloads now so they overlap terrain and part building.
		const unique = new Set<PropAsset>();
		for (const p of plan.props) unique.add(p.asset);
		const assets: PropAsset[] = [];
		for (const asset of unique) assets.push(asset);
		WorldAssets.Start(assets);
		Workspace.FindFirstChild("World")?.Destroy();
		beginTerrainWrite();
		WorldEnvironment.Apply(bp.environment);
		const scene = new Instance("Folder");
		scene.Name = plan.name;
		scene.Parent = parent;
		parent.SetAttribute("MissionId", id);
		parent.SetAttribute("Composition", plan.name);

		const terrain = writeTerrain(plan);
		for (const p of plan.parts) buildPart(scene, p);
		const kitModels = scene.GetChildren().filter((item) => item.IsA("Model") && item.GetAttribute("GeometryAsset") !== undefined);
		const kitFallbacks = kitModels.filter((item) => item.GetAttribute("GeometrySource") === "Fallback").size();
		parent.SetAttribute("WorldKitModels", kitModels.size());
		parent.SetAttribute("WorldKitFallbacks", kitFallbacks);
		if (kitFallbacks > 0) warn(`[RelayWorld] ${plan.name}: ${kitFallbacks} infrastructure modules used the visible fallback`);

		const late = WorldAssets.Preload(assets);
		const props = new Instance("Folder");
		props.Name = "Props";
		props.Parent = scene;
		let uploaded = 0, fallbacks = 0;
		for (let i = 0; i < plan.props.size(); i++) {
			const model = placeProp(props, plan.props[i]);
			if (model?.GetAttribute("GeometrySource") === "Uploaded") uploaded += 1;
			else fallbacks += 1;
			if (i % PROP_YIELD === PROP_YIELD - 1) task.wait();
		}

		const groundTargets: Model[] = [];
		for (const site of plan.targets) {
			const spec = bp.ground[site.index];
			const model = spec.asset === "radar" ? MissionAssets.CreateRadar(spec.name) : spec.asset === "warehouse" ? MissionAssets.CreateWarehouse(spec.name) : spec.asset === "comms_relay" ? MissionAssets.CreateCommsRelay(spec.name) : MissionAssets.CreateGrainSilo(spec.name);
			const [bounds, size] = model.GetBoundingBox();
			// Bounds-based grounding: the model's lowest point rests on the apron or deck top.
			model.PivotTo(new CFrame(spec.x, site.baseY + (model.GetPivot().Position.Y - (bounds.Position.Y - size.Y / 2)), spec.z).mul(CFrame.Angles(0, spec.yaw ?? 0, 0)));
			model.Parent = parent;
			groundTargets.push(model);
		}

		const counts = WorldPlanner.Counts(plan);
		parent.SetAttribute("WorldProps", plan.props.size());
		parent.SetAttribute("WorldUploaded", uploaded);
		parent.SetAttribute("WorldFallbacks", fallbacks);
		parent.SetAttribute("WorldTerrainOps", counts.terrainOps);
		parent.SetAttribute("WorldTerrainJobs", terrain.jobs);
		parent.SetAttribute("WorldTerrainYields", terrain.yields);
		parent.SetAttribute("WorldTerrainSeconds", terrain.total);
		parent.SetAttribute("WorldTerrainLongest", terrain.longest);
	parent.SetAttribute("WorldTerrainLongestBatch", terrain.longestBatch);
		parent.SetAttribute("WorldPreloadLate", late.size());
		parent.SetAttribute("WorldBuildSeconds", os.clock() - started);
		if (late.size() > 0) warn(`[RelayWorld] ${plan.name}: ${late.join(", ")} still loading after the preload deadline; placed fallbacks`);
		if (fallbacks > 0) warn(`[RelayWorld] ${plan.name}: ${fallbacks} of ${plan.props.size()} props used the primitive fallback`);
		Scenery.Report(parent, plan.name, Scenery.PART_BUDGET, true);
		return { groundTargets };
	},
};
