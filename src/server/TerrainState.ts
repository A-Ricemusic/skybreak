import { worldTraceScope } from "./WorldBuildTrace";
import { Workspace } from "@rbxts/services";
import { bumpRegion, type TerrainJob } from "../shared/TerrainSchedule";

// Record before executing each job, including partial/failed builds. Clear only occupied
// 128-stud engine chunks, never the enormous bounding box between distant islands.
// Air-filled chunks may remain allocated by Roblox; do not follow with Terrain:Clear():
// that reintroduces synchronous native cleanup even after voxels are empty.
const regions = new Map<string, Vector3>();
let dirty = false;
export function trackTerrainJob(job: TerrainJob): void {
 const o = job.op;
 const c = math.abs(math.cos(o.yaw)), s = math.abs(math.sin(o.yaw));
 const rx = o.shape === "ball" || o.shape === "cylinder" ? o.sx : (c * o.sx + s * o.sz) / 2;
 const rz = o.shape === "ball" || o.shape === "cylinder" ? o.sx : (s * o.sx + c * o.sz) / 2;
 const ry = o.shape === "ball" ? o.sx : o.sy / 2;
 const r = job.region ?? (o.shape === "bump" ? bumpRegion(o) : {
  min: [o.x - rx - 4, o.y - ry - 4, o.z - rz - 4],
  max: [o.x + rx + 4, o.y + ry + 4, o.z + rz + 4],
 });
 dirty = true;
 for (let x = math.floor(r.min[0] / 128); x <= math.floor(r.max[0] / 128); x++)
 for (let y = math.floor(r.min[1] / 128); y <= math.floor(r.max[1] / 128); y++)
 for (let z = math.floor(r.min[2] / 128); z <= math.floor(r.max[2] / 128); z++) {
  const key = `${x},${y},${z}`;
  if (!regions.has(key)) regions.set(key, new Vector3(x * 128 + 64, y * 128 + 64, z * 128 + 64));
 }
}
/** Cancellation/errors retain every unfinished region for the next attempt. */
export function clearTerrainIfDirty(cancelled: () => boolean = () => false): void {
 const endTrace = worldTraceScope("previous-world-cleanup");
 try {
  let slice = os.clock();
  for (const [key, centre] of regions) {
   if (cancelled()) return;
   Workspace.Terrain.FillBlock(new CFrame(centre), new Vector3(128, 128, 128), Enum.Material.Air);
   regions.delete(key);
   if (os.clock() - slice >= 0.015) { task.wait(); slice = os.clock(); }
  }
  dirty = false;
 } finally { endTrace(); }
}
export function beginTerrainWrite(): void { clearTerrainIfDirty(); dirty = true; }
export function markTerrainClean(): void { assert(regions.isEmpty(), "Terrain cleanup is incomplete"); dirty = false; }
export function terrainDirty(): boolean { return dirty; }
