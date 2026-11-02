import { worldTraceScope } from "./WorldBuildTrace";
import { Workspace } from "@rbxts/services";
import { bumpRegion, type TerrainJob } from "../shared/TerrainSchedule";

// Record before executing each job, including partial/failed builds. Clear only occupied
// 128-stud engine chunks, never the enormous bounding box between distant islands.
// Air-filled chunks may remain allocated by Roblox; do not follow with Terrain:Clear():
// that reintroduces synchronous native cleanup even after voxels are empty.
const regions = new Map<string, Vector3>();
const regionKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
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
 for (let x = math.floor(r.min[0] / 128); x <= math.ceil(r.max[0] / 128) - 1; x++)
 for (let y = math.floor(r.min[1] / 128); y <= math.ceil(r.max[1] / 128) - 1; y++)
 for (let z = math.floor(r.min[2] / 128); z <= math.ceil(r.max[2] / 128) - 1; z++) {
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
   const x = (centre.X - 64) / 128, y = (centre.Y - 64) / 128, z = (centre.Z - 64) / 128;
   let first = z;
   while (z - first < 15 && regions.has(regionKey(x, y, first - 1))) first--;
   let length = z - first + 1;
   while (length < 16 && regions.has(regionKey(x, y, first + length))) length++;
   Workspace.Terrain.FillBlock(new CFrame(centre.add(new Vector3(0, 0, (first - z) * 128 + (length - 1) * 64))), new Vector3(128, 128, length * 128), Enum.Material.Air);
   regions.delete(key);
   for (let i = 0; i < length; i++) regions.delete(regionKey(x, y, first + i));
   if (os.clock() - slice >= 0.015) { task.wait(); slice = os.clock(); }
  }
  dirty = false;
 } finally { endTrace(); }
}
export function beginTerrainWrite(): void { clearTerrainIfDirty(); dirty = true; }
export function markTerrainClean(): void { assert(regions.isEmpty(), "Terrain cleanup is incomplete"); dirty = false; }
export function terrainDirty(): boolean { return dirty; }
