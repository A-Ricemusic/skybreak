import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import type { TerrainOp, PartSpec, PropSpec } from "./WorldPlan";
import { WORLD_FILL_CHUNK, WORLD_TERRAIN_BUDGET } from "./SealedWorldSurface";
/** Studio Play calibration (docs/specs/worlds/m04-composition.md, "Load-time calibration").
 * Terrain work scales with the 128-stud terrain chunks each Fill touches, not with voxels:
 * a touch costs about 0.07 ms for solid fills and 0.2 ms for water (fresh-session bench: M04
 * 6.4 s, M02 5.3 s, M05 14.0 s). Every yield then costs a whole engine frame once a 32k-stud
 * world exists: about 0.2 s for land, rising to 0.42 s when half the work is water (M05).
 * So the yield count at WORLD_TERRAIN_BUDGET, not the job count, sets most of the wall time.
 */
export const TOUCH_SECONDS = 0.07e-3;
export const WATER_TOUCH_SECONDS = 0.2e-3;
export const YIELD_SECONDS = 0.2;
export const WATER_YIELD_SECONDS = 0.45;
/** Plan, environment, parts and props around the terrain phase (#149: 2.3 s after terrain). */
export const FIXED_SECONDS = 3;
const CHUNK = 128;
const span = (centre: number, size: number) => math.floor((centre + size / 2 - 0.01) / CHUNK) - math.floor((centre - size / 2) / CHUNK) + 1;
/** 128-stud terrain chunks one axis-aligned or yawed block job touches (bounding box). */
export function chunkTouches(o: TerrainOp): number {
 const c = math.abs(math.cos(o.yaw)), s = math.abs(math.sin(o.yaw));
 return span(o.x, c * o.sx + s * o.sz) * span(o.y, o.sy) * span(o.z, s * o.sx + c * o.sz);
}
/** Uploaded props reserve 24 descendants each, including single-mesh Pine:
 * this deliberately covers its two-Part fallback, wrapper/mesh/appearance instances
 * and future approved template changes. It is an allowance, not a measured count.
 * targetParts separately reserves four primitive Parts per air/naval pose; the
 * fixed 256 covers contact wrappers and uploaded-target/template overhead.
 * Runtime GetDescendants remains the authoritative hard guard.
 */
export function worldCounts(p: {ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]}, targetParts: number) {
 let voxels = 0, touches = 0, work = 0, water = 0;
 for (const op of p.ops) voxels += fillVoxels(op);
 const scheduled = terrainJobs(p.ops, WORLD_FILL_CHUNK);
 for (const job of scheduled) {
  const n = chunkTouches(job.op);
  touches += n;
  if (job.op.material === "Water") water += n * WATER_TOUCH_SECONDS; else work += n * TOUCH_SECONDS;
 }
 work += water;
 const jobs = scheduled.size(), parts = p.parts.size() + targetParts;
 const yields = math.ceil(work / WORLD_TERRAIN_BUDGET), frame = YIELD_SECONDS + WATER_YIELD_SECONDS * water / math.max(work, 1e-9);
 return { voxels, jobs, touches, parts, props: p.props.size(), descendants: parts + p.props.size() * 24 + 256,
  estimatedSeconds: work + yields * frame + FIXED_SECONDS };
}
