import { terrainJobs } from "./TerrainSchedule";
import type { TerrainOp, PartSpec, PropSpec } from "./WorldPlan";
import { WORLD_FILL_CHUNK } from "./CompactWorldSurface";
import { worldCounts } from "./WorldCompositionCounts";
// Minimal local copy of PR #158's Studio-calibrated chunk/yield model (D-120/D-121).
// Unify with WorldCompositionCounts when #158 lands; no dependency on its unmerged code.
// Shared by M06–M09; accepts any compact composition, including Carrier props.
// Valid only at the compact-world runtime terrain slice of 0.25 s. Estimates are not measurements.
const span = (centre: number, size: number) => math.floor((centre + size / 2 - 0.01) / 128) - math.floor((centre - size / 2) / 128) + 1;
export function chunkTouches(o: TerrainOp): number {
 const c = math.abs(math.cos(o.yaw)), s = math.abs(math.sin(o.yaw));
 return span(o.x, c * o.sx + s * o.sz) * span(o.y, o.sy) * span(o.z, s * o.sx + c * o.sz);
}
export function compactWorldCounts(p: {ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]}, targetParts: number) {
 const legacy = worldCounts(p, targetParts);
 let solidTouches = 0, waterTouches = 0;
 for (const job of terrainJobs(p.ops, WORLD_FILL_CHUNK)) {
  if (job.op.material === "Water") waterTouches += chunkTouches(job.op);
  else solidTouches += chunkTouches(job.op);
 }
 const waterWork = waterTouches * 0.2e-3, work = solidTouches * 0.07e-3 + waterWork;
 const yields = math.ceil(work / 0.25), frame = 0.2 + 0.45 * waterWork / math.max(work, 1e-9);
 return { ...legacy, solidTouches, waterTouches, yields, legacyEstimatedSeconds: legacy.estimatedSeconds * 1.5,
  estimatedSeconds: work + yields * frame + 3 };
}
