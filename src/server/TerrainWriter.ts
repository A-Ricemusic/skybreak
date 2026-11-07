import { worldTraceScope } from "./WorldBuildTrace";
import { measureTerrainWait, prepareTerrainDiagnostics, type TerrainJobGroup } from "../shared/TerrainDiagnostics";
import { HttpService, Workspace } from "@rbxts/services";
import {
	createBudgetDiagnostics,
	type BudgetDiagnostics,
	terrainExecutionJobs,
	alignedBlockRegion,
	runBudgeted,
	FILL_CHUNK,
	TERRAIN_BUDGET,
	type BudgetRun,
	type BudgetProgress,
	type TerrainJob,
} from "../shared/TerrainSchedule";
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
	const o = job.op,
		r = job.region!;
	const region = new Region3(new Vector3(r.min[0], r.min[1], r.min[2]), new Vector3(r.max[0], r.max[1], r.max[2]));
	const [materials, occupancy] = terrain.ReadVoxels(region, 4);
	const size = materials.Size;
	const c = math.cos(o.yaw),
		s = math.sin(o.yaw);
	for (let i = 0; i < size.X; i++) {
		const x = r.min[0] + i * 4 + 2;
		for (let k = 0; k < size.Z; k++) {
			const z = r.min[2] + k * 4 + 2;
			const dx = x - o.x,
				dz = z - o.z,
				lx = c * dx - s * dz,
				lz = s * dx + c * dz;
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
	const mat =
		o.material === "Air" ? Enum.Material.Air : o.material === "Water" ? Enum.Material.Water : material(o.material);
	if (job.region !== undefined) writeBump(terrain, job, mat);
	else if (o.material !== "Water" && alignedBlockRegion(o) !== undefined) {
		// FillRegion replaces solids with water; FillBlock water preserves them.
		const r = alignedBlockRegion(o)!;
		terrain.FillRegion(new Region3(new Vector3(...r.min), new Vector3(...r.max)), 4, mat);
	} else if (o.shape === "block")
		terrain.FillBlock(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
	else if (o.shape === "wedge") terrain.FillWedge(yawFrame(o.x, o.y, o.z, o.yaw), new Vector3(o.sx, o.sy, o.sz), mat);
	else if (o.shape === "ball") terrain.FillBall(new Vector3(o.x, o.y, o.z), o.sx, mat);
	else terrain.FillCylinder(new CFrame(o.x, o.y, o.z), o.sy, o.sx, mat);
}

export interface TerrainWriteDiagnostics {
	schema: 1;
	status: "prepare" | "complete" | "cancelled" | "failed";
	elapsedSeconds: number;
	executionPreparationElapsedSeconds: number;
	summaryPreparationElapsedSeconds: number;
	actualWaitElapsedSeconds: number;
	maxActualWaitElapsedSeconds: number;
	otherElapsedSeconds: number;
	scheduler: BudgetDiagnostics;
	groups: TerrainJobGroup[];
}

export const TerrainWriter = {
	/** One scheduled job (measurement harnesses time jobs individually). */
	WriteJob: run,
	/** Writes `ops` in order as bounded jobs, yielding between resumptions; returns the timing. */
	Write(
		ops: TerrainOp[],
		budget = TERRAIN_BUDGET,
		fillChunk = FILL_CHUNK,
		cancelled?: () => boolean,
		cleanupDiagnostics = false,
	): BudgetRun & { jobs: number; diagnostics: TerrainWriteDiagnostics } {
		const endTrace = worldTraceScope("terrain-batches");
		const started = os.clock();
		const diagnostics: TerrainWriteDiagnostics = {
			schema: 1,
			status: "prepare",
			elapsedSeconds: 0,
			executionPreparationElapsedSeconds: 0,
			summaryPreparationElapsedSeconds: 0,
			actualWaitElapsedSeconds: 0,
			maxActualWaitElapsedSeconds: 0,
			otherElapsedSeconds: 0,
			scheduler: createBudgetDiagnostics(),
			groups: [],
		};
		const snapshot = () => {
			// Diagnostic publication must not replace a native error or fail a completed write.
			pcall(() =>
				Workspace.Terrain.SetAttribute(
					"SKYBREAKTerrainWriteElapsedDiagnostics",
					HttpService.JSONEncode(diagnostics),
				),
			);
		};
		const progress: BudgetProgress = { completed: 0, jobs: 0, workSeconds: 0, yields: 0, stage: "prepare" };
		// Diagnostic-only snapshot, never a resume cursor. Every retry restarts the
		// retained footprint; replacement owners cannot inherit or skip old jobs.
		const report = () => {
			if (!cleanupDiagnostics) return;
			Workspace.Terrain.SetAttribute(
				"SKYBREAKTerrainCleanupProgress",
				`elapsed=${os.clock() - started} completed=${progress.completed}/${progress.jobs} work=${progress.workSeconds} yields=${progress.yields} stage=${progress.stage}`,
			);
		};
		try {
			snapshot(); // Incomplete attempt marker; a hard stop must not leave an older success.
			const terrain = Workspace.Terrain;
			terrain.SetAttribute("SKYBREAKTerrainClean", false);
			report();
			const { jobs, summary, executionPreparationElapsedSeconds, summaryPreparationElapsedSeconds } =
				prepareTerrainDiagnostics(() => terrainExecutionJobs(ops, fillChunk), os.clock);
			diagnostics.executionPreparationElapsedSeconds = executionPreparationElapsedSeconds;
			diagnostics.summaryPreparationElapsedSeconds = summaryPreparationElapsedSeconds;
			diagnostics.groups = summary.groups;
			let completedIndex = 0;
			progress.jobs = jobs.size();
			progress.stage = "work";
			report();
			const timing = runBudgeted(
				jobs,
				(job) => {
					run(terrain, job);
					const group = summary.byJob[completedIndex++];
					group.completedJobs++;
					group.completedEstimatedCells += job.cells;
				},
				{
					budget,
					clock: os.clock,
					pause: () => {
						report(); // Persist before yielding: task.cancel does not unwind finally.
						measureTerrainWait(() => task.wait(), os.clock, diagnostics);
						progress.stage = "work";
						report();
					},
					diagnostics: diagnostics.scheduler,
					progress,
					cancelled,
				},
			);
			report();
			diagnostics.status = timing.complete ? "complete" : "cancelled";
			return { ...timing, jobs: jobs.size(), diagnostics };
		} catch (err) {
			diagnostics.status = "failed";
			progress.stage = "failed";
			report();
			throw err;
		} finally {
			diagnostics.elapsedSeconds = os.clock() - started;
			diagnostics.otherElapsedSeconds =
				diagnostics.elapsedSeconds -
				diagnostics.executionPreparationElapsedSeconds -
				diagnostics.summaryPreparationElapsedSeconds -
				diagnostics.scheduler.elapsedSeconds;
			// One aggregate snapshot per write, including returned cancellation/errors. Hard
			// task cancellation may prevent finally; the existing pre-yield progress survives.
			snapshot();
			endTrace();
		}
	},
};
