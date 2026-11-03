import { terrainJobs } from "./TerrainSchedule";
import type { TerrainOp, PartSpec, PropSpec } from "./WorldPlan";
import { WORLD_FILL_CHUNK } from "./CompactWorldSurface";
import { chunkTouches, worldCounts } from "./WorldCompositionCounts";
export { chunkTouches };
// Compact-world variant of WorldCompositionCounts' Studio-calibrated chunk/yield model (D-120/D-121).
// Shared by M06–M09; accepts any compact composition, including Carrier props.
// Valid only at the compact-world runtime terrain slice of 0.25 s. Estimates are not measurements.
export function compactWorldCounts(p: { ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[] }, targetParts: number) {
	const legacy = worldCounts(p, targetParts, WORLD_FILL_CHUNK);
	let solidTouches = 0,
		waterTouches = 0;
	for (const job of terrainJobs(p.ops, WORLD_FILL_CHUNK)) {
		if (job.op.material === "Water") waterTouches += chunkTouches(job.op);
		else solidTouches += chunkTouches(job.op);
	}
	const waterWork = waterTouches * 0.2e-3,
		work = solidTouches * 0.07e-3 + waterWork;
	const yields = math.ceil(work / 0.25),
		frame = 0.2 + (0.45 * waterWork) / math.max(work, 1e-9);
	return {
		...legacy,
		solidTouches,
		waterTouches,
		yields,
		legacyEstimatedSeconds: legacy.estimatedSeconds * 1.5,
		estimatedSeconds: work + yields * frame + 3,
	};
}
