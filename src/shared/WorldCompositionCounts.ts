import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import type { TerrainOp, PartSpec, PropSpec } from "./WorldPlan";
import { WORLD_FILL_CHUNK } from "./SealedWorldSurface";
/** M01 measured calibration, with the same 2x reserve as M02/M03.
 * Uploaded props reserve 24 descendants each, including single-mesh Pine:
 * this deliberately covers its two-Part fallback, wrapper/mesh/appearance instances
 * and future approved template changes. It is an allowance, not a measured count.
 * targetParts separately reserves four primitive Parts per air/naval pose; the
 * fixed 256 covers contact wrappers and uploaded-target/template overhead.
 * Runtime GetDescendants remains the authoritative hard guard.
 */
export function worldCounts(p: {ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]}, targetParts: number) {
 let voxels = 0;
 for (const op of p.ops) voxels += fillVoxels(op);
 const jobs = terrainJobs(p.ops, WORLD_FILL_CHUNK).size(), parts = p.parts.size() + targetParts;
 return { voxels, jobs, parts, props: p.props.size(), descendants: parts + p.props.size() * 24 + 256,
  estimatedSeconds: 2 * (jobs / 27494 * 7.915 + 1) };
}
