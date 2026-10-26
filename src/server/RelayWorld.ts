import { Workspace } from "@rbxts/services";
import type { Rgb } from "../shared/EnvironmentPresets";
import { MissionAssets } from "../shared/MissionAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { UploadedAssets } from "../shared/UploadedAssets";
import { bumpProfile, WorldPlanner, type PartSpec, type PropAsset, type PropSpec, type TerrainOp, type WorldPlan } from "../shared/WorldPlan";
import { Scenery } from "./Scenery";
import { WorldAssets } from "./WorldAssets";
import { WorldEnvironment } from "./WorldEnvironment";

// Executes the pure WorldPlan for missions 3-27 (shared/WorldPlan): Terrain
// voxel relief and water, the few primitive parts (runways, aprons, decks,
// roads), clones of the cached uploaded Blender models, and the ground
// targets. The plan is audited offline (WorldAudit); this file only turns
// its numbers into instances, in a fixed order:
//   1. environment and terrain colours, 2. every voxel op back to back (one
//   replication batch), 3. parts (Scenery.Part yields every 150), 4. props
//   (template loads run in parallel first), 5. targets.
// A prop whose template fails to load takes WorldAssets' simple fallback, or
// a small primitive stand-in for trees, rocks, masts, dishes and cranes.

const rgb = (c: Rgb) => Color3.fromRGB(c[0], c[1], c[2]);
const yawFrame = (x: number, y: number, z: number, yaw: number) => new CFrame(x, y, z).mul(CFrame.Angles(0, yaw, 0));
/** Props per batch before yielding, so a 170-prop farm does not hold the heartbeat. */
const PROP_YIELD = 40;

// Indexing Enum.Material with an unknown name throws, so plan names resolve through a table.
const MATERIALS = new Map<string, Enum.Material>();
for (const item of Enum.Material.GetEnumItems()) MATERIALS.set(item.Name, item);
function material(name: string): Enum.Material {
	return MATERIALS.get(name) ?? Enum.Material.Concrete;
}

/** An additive cosine hill: only air voxels inside the hill's profile are filled. */
function writeBump(terrain: Terrain, o: TerrainOp, mat: Enum.Material): void {
	const reach = math.max(o.sx, o.sz);
	const region = new Region3(new Vector3(o.x - reach, o.y - 4, o.z - reach), new Vector3(o.x + reach, o.y + o.sy + 4, o.z + reach)).ExpandToGrid(4);
	const [materials, occupancy] = terrain.ReadVoxels(region, 4);
	const size = materials.Size;
	const corner = region.CFrame.Position.sub(region.Size.div(2));
	const c = math.cos(o.yaw), s = math.sin(o.yaw);
	for (let i = 0; i < size.X; i++) {
		const x = corner.X + i * 4 + 2;
		for (let k = 0; k < size.Z; k++) {
			const z = corner.Z + k * 4 + 2;
			const dx = x - o.x, dz = z - o.z, lx = c * dx - s * dz, lz = s * dx + c * dz;
			const top = o.y + o.sy * bumpProfile(math.sqrt((lx / o.sx) * (lx / o.sx) + (lz / o.sz) * (lz / o.sz)));
			if (top <= o.y) continue;
			for (let j = 0; j < size.Y; j++) {
				const bottom = corner.Y + j * 4;
				if (bottom + 4 <= o.y || bottom >= top) continue;
				const fill = math.clamp((top - bottom) / 4, 0, 1);
				const column = occupancy[i][j];
				if (materials[i][j][k] === Enum.Material.Air || column[k] < fill) {
					if (materials[i][j][k] === Enum.Material.Air) materials[i][j][k] = mat;
					column[k] = math.max(column[k], fill);
				}
			}
		}
	}
	terrain.WriteVoxels(region, 4, materials, occupancy);
}

function writeTerrain(plan: WorldPlan): void {
	const terrain = Workspace.Terrain;
	for (const [name, color] of plan.materialColors) terrain.SetMaterialColor(material(name), rgb(color));
	// Every voxel write runs back to back before any part is created (Scenery.Part yields), so the
	// terrain replicates as one batch instead of being re-sent per op.
	for (const o of plan.ops) {
		const mat = o.material === "Air" ? Enum.Material.Air : o.material === "Water" ? Enum.Material.Water : material(o.material);
		if (o.shape === "block") terrain.FillBlock(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
		else if (o.shape === "wedge") terrain.FillWedge(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
		else if (o.shape === "ball") terrain.FillBall(new Vector3(o.x, o.y, o.z), o.sx, mat);
		else if (o.shape === "cylinder") terrain.FillCylinder(new CFrame(o.x, o.y, o.z), o.sy, o.sx, mat);
		else writeBump(terrain, o, mat);
	}
}

function buildPart(parent: Instance, p: PartSpec): BasePart {
	const options = { flightSolid: p.solid, castShadow: false, transparency: p.transparency, reflectance: p.reflectance };
	const color = rgb(p.color), mat = material(p.material);
	if (p.shape === "cylinder") return Scenery.Cylinder(parent, p.name, p.sx, p.sy, new Vector3(p.x, p.y, p.z), color, mat, options);
	if (p.shape === "ball") return Scenery.Part(parent, p.name, new Vector3(p.sx, p.sx, p.sx), new Vector3(p.x, p.y, p.z), color, mat, { ...options, shape: Enum.PartType.Ball });
	return Scenery.Part(parent, p.name, new Vector3(p.sx, p.sy, p.sz), yawFrame(p.x, p.y, p.z, p.yaw), color, mat, { ...options, className: p.shape === "wedge" ? "WedgePart" : "Part" });
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

/** Load every template the plan uses at once (InsertService round trips overlap), then return. */
function preload(assets: PropAsset[]): void {
	let pending = assets.size();
	for (const asset of assets) task.spawn(() => {
		pcall(() => UploadedAssets.Template([asset]));
		pending -= 1;
	});
	const deadline = os.clock() + 30;
	while (pending > 0 && os.clock() < deadline) task.wait();
}


export const RelayWorld = {
	Build(id: number, parent: Instance): { groundTargets: Model[] } {
		const bp = MissionCatalog.Get(id), plan = WorldPlanner.Build(id);
		Workspace.FindFirstChild("World")?.Destroy();
		Workspace.Terrain.Clear();
		WorldEnvironment.Apply(bp.environment);
		const scene = new Instance("Folder");
		scene.Name = plan.name;
		scene.Parent = parent;
		parent.SetAttribute("MissionId", id);
		parent.SetAttribute("Composition", plan.name);

		writeTerrain(plan);
		for (const p of plan.parts) buildPart(scene, p);

		const unique = new Set<PropAsset>();
		for (const p of plan.props) unique.add(p.asset);
		const assets: PropAsset[] = [];
		for (const asset of unique) assets.push(asset);
		preload(assets);
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
		if (fallbacks > 0) warn(`[RelayWorld] ${plan.name}: ${fallbacks} of ${plan.props.size()} props used the primitive fallback`);
		Scenery.Report(parent, plan.name, Scenery.PART_BUDGET, true);
		return { groundTargets };
	},
};
