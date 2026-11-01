import { worldTraceScope } from "./WorldBuildTrace";
import { Workspace } from "@rbxts/services";
import { runBudgeted, terrainJobs, FILL_CHUNK, TERRAIN_BUDGET, type BudgetRun, type TerrainJob } from "../shared/TerrainSchedule";
import { bumpProfile, type TerrainOp } from "../shared/WorldPlan";

// Executes planned terrain ops (shared/WorldPlan) as bounded jobs
// (shared/TerrainSchedule): every Fill call and every bump ReadVoxels/WriteVoxels
// slice is capped, and the batch yields a frame whenever one resumption has
// spent TERRAIN_BUDGET, so a 300-op world never holds the server's heartbeat.
// Terrain therefore replicates in several batches while the world builds; the
// client's loading screen covers that (the build finishes before Loading is sent).

// Indexing Enum.Material with an unknown name throws, so plan names resolve through a table.
const MATERIALS = new Map<string, Enum.Material>();
for (const item of Enum.Material.GetEnumItems()) MATERIALS.set(item.Name, item);
export function material(name: string): Enum.Material {
	return MATERIALS.get(name) ?? Enum.Material.Concrete;
}

const yawFrame = (x: number, y: number, z: number, yaw: number) => new CFrame(x, y, z).mul(CFrame.Angles(0, yaw, 0));

/** One grid slice of an additive cosine hill: only air voxels inside the hill's profile are filled. */
function writeBump(terrain: Terrain, job: TerrainJob, mat: Enum.Material): void {
	const o = job.op, r = job.region!;
	const region = new Region3(new Vector3(r.min[0], r.min[1], r.min[2]), new Vector3(r.max[0], r.max[1], r.max[2]));
	const [materials, occupancy] = terrain.ReadVoxels(region, 4);
	const size = materials.Size;
	const c = math.cos(o.yaw), s = math.sin(o.yaw);
	for (let i = 0; i < size.X; i++) {
		const x = r.min[0] + i * 4 + 2;
		for (let k = 0; k < size.Z; k++) {
			const z = r.min[2] + k * 4 + 2;
			const dx = x - o.x, dz = z - o.z, lx = c * dx - s * dz, lz = s * dx + c * dz;
			const top = o.y + o.sy * bumpProfile(math.sqrt((lx / o.sx) * (lx / o.sx) + (lz / o.sz) * (lz / o.sz)));
			if (top <= o.y) continue;
			for (let j = 0; j < size.Y; j++) {
				const bottom = r.min[1] + j * 4;
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

function run(terrain: Terrain, job: TerrainJob): void {
	const o = job.op;
	const mat = o.material === "Air" ? Enum.Material.Air : o.material === "Water" ? Enum.Material.Water : material(o.material);
	if (job.region !== undefined) writeBump(terrain, job, mat);
	else if (o.shape === "block") terrain.FillBlock(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
	else if (o.shape === "wedge") terrain.FillWedge(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
	else if (o.shape === "ball") terrain.FillBall(new Vector3(o.x, o.y, o.z), o.sx, mat);
	else terrain.FillCylinder(new CFrame(o.x, o.y, o.z), o.sy, o.sx, mat);
}

export const TerrainWriter = {
	/** One scheduled job (measurement harnesses time jobs individually). */
	WriteJob: run,
	/** Writes `ops` in order as bounded jobs, yielding between resumptions; returns the timing. */
	Write(ops: TerrainOp[], budget = TERRAIN_BUDGET, fillChunk = FILL_CHUNK, cancelled?: () => boolean): BudgetRun & { jobs: number } {
		const endTrace = worldTraceScope("terrain-batches");
		try {
			const terrain = Workspace.Terrain, jobs = terrainJobs(ops, fillChunk);
			const timing = runBudgeted(jobs, (job) => run(terrain, job), { budget, clock: os.clock, pause: () => task.wait(), cancelled });
			return { ...timing, jobs: jobs.size() };
		} finally { endTrace(); }
	},
};
