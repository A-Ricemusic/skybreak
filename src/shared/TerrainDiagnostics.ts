import { alignedBlockRegion, type TerrainJob } from "./TerrainSchedule";

export type TerrainNativeMethod =
	"FillRegion" | "FillBlock" | "FillWedge" | "FillBall" | "FillCylinder" | "ReadVoxels+WriteVoxels";
/** Classification only: never changes native dispatch, arguments, order or chunking. */
export function terrainJobMethod(job: TerrainJob): TerrainNativeMethod {
	const o = job.op;
	if (job.region !== undefined) return "ReadVoxels+WriteVoxels";
	if (o.material !== "Water" && alignedBlockRegion(o) !== undefined) return "FillRegion";
	if (o.shape === "block") return "FillBlock";
	if (o.shape === "wedge") return "FillWedge";
	if (o.shape === "ball") return "FillBall";
	return "FillCylinder";
}
export interface TerrainJobGroup {
	material: string;
	method: TerrainNativeMethod;
	plannedJobs: number;
	plannedEstimatedCells: number;
	completedJobs: number;
	completedEstimatedCells: number;
}
/** One linear pass, no clocks or per-voxel state. Cells are repeated-write estimates,
 * not unique occupied volume. A throwing job is not counted as completed; it may
 * already have made a partial native call (especially ReadVoxels+WriteVoxels).
 */
export function summarizeTerrainJobs(jobs: TerrainJob[]) {
	const groups: TerrainJobGroup[] = [];
	const byJob: TerrainJobGroup[] = [];
	const index = new Map<string, TerrainJobGroup>();
	for (const job of jobs) {
		const method = terrainJobMethod(job),
			key = `${job.op.material}:${method}`;
		let group = index.get(key);
		if (group === undefined) {
			group = {
				material: job.op.material,
				method,
				plannedJobs: 0,
				plannedEstimatedCells: 0,
				completedJobs: 0,
				completedEstimatedCells: 0,
			};
			index.set(key, group);
			groups.push(group);
		}
		group.plannedJobs++;
		group.plannedEstimatedCells += job.cells;
		byJob.push(group);
	}
	return { groups, byJob };
}

/** Nonoverlapping preparation spans. Scheduler timing starts only after this returns. */
export function prepareTerrainDiagnostics(prepare: () => TerrainJob[], clock: () => number) {
	const start = clock();
	const jobs = prepare();
	const prepared = clock();
	const summary = summarizeTerrainJobs(jobs);
	const summarized = clock();
	return {
		jobs,
		summary,
		executionPreparationElapsedSeconds: prepared - start,
		summaryPreparationElapsedSeconds: summarized - prepared,
	};
}

/** The actual injected wait only; reporting before/after belongs to its enclosing
 * pause callback. A throwing wait is measured and rethrown, never swallowed.
 */
export function measureTerrainWait(
	wait: () => void,
	clock: () => number,
	diagnostics: { actualWaitElapsedSeconds: number; maxActualWaitElapsedSeconds: number },
) {
	const started = clock();
	const [ok, result] = pcall(wait);
	const elapsed = clock() - started;
	diagnostics.actualWaitElapsedSeconds += elapsed;
	diagnostics.maxActualWaitElapsedSeconds = math.max(diagnostics.maxActualWaitElapsedSeconds, elapsed);
	if (!ok) error(result, 0);
}
