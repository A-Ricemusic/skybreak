import { Workspace } from "@rbxts/services";
import { TerrainWriteState } from "../shared/TerrainWriteState";

// Composition plans own an exact sparse write footprint. Erase those boxes rather
// than asking native Clear to traverse the entire tall, hollow world's extent.
// Keep the footprint until every write finishes: a failed/cancelled build or clear
// must still be recoverable. Untracked legacy terrain retains native cleanup.
import { alignedBlockRegion, terrainBoundsOp } from "../shared/TerrainSchedule";
import type { TerrainOp } from "../shared/WorldPlan";
import { TerrainWriter } from "./TerrainWriter";
let footprint: TerrainOp[] | undefined;
let canTrack = false;
const state = new TerrainWriteState(() => {
 if (footprint === undefined) {
  // Jest isolates module state between suites, but Terrain and its empty bounds
  // survive. A completed clear is shared evidence; never repeat native Clear
  // over a tall empty extent just because this module was required again.
  if (Workspace.Terrain.GetAttribute("SKYBREAKTerrainClean") !== true) Workspace.Terrain.Clear();
 }
 else {
  const started = os.clock();
  const timing = TerrainWriter.Write(footprint, 0.25);
  print(`MISSION_TERRAIN_CLEANUP mode=sparse seconds=${os.clock()-started} jobs=${timing.jobs} work=${timing.total} yields=${timing.yields}`);
 }
 footprint = undefined; canTrack = false;
 Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", true);
});
/** Called before the first write, so partial builds have the same cleanup owner. */
export function trackTerrainFootprint(ops: TerrainOp[]): void {
 // Full voxel boxes erase exactly. Legacy curved/non-grid plans use native Clear.
 if (!canTrack) beginTerrainWrite();
 canTrack = false;
 if (ops.some(o => alignedBlockRegion(o) === undefined)) return;
 footprint = ops.map(o => ({...o, material: "Air"}));
}
/** Conservative grid box for a legacy curved write. Terrain is exclusively owned,
 * so erasing surrounding air is safe; never expand this to the campaign extent.
 * Register before writing so a partial Practice build remains recoverable. */
export function trackTerrainBounds(min: Vector3, max: Vector3): void {
 if (footprint === undefined) footprint = [];
 footprint.push(terrainBoundsOp([min.X, min.Y, min.Z], [max.X, max.Y, max.Z]));
}
/** Clear the owned sparse footprint, or native terrain when writes were untracked. */
export function clearTerrainIfDirty(): void {
 if (!state.Dirty() && Workspace.Terrain.GetAttribute("SKYBREAKTerrainClean") === false) state.BeginWrite();
 state.ClearIfDirty();
}
/** A world is about to write terrain: start from empty terrain, then mark it written. */
export function beginTerrainWrite(): void { state.BeginWrite(); Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", false); canTrack = true; }
/** A registered world clear removed everything that world wrote; no native clear is needed. */
export function markTerrainClean(): void { footprint = undefined; canTrack = false; state.MarkClean(); Workspace.Terrain.SetAttribute("SKYBREAKTerrainClean", true); }
export function terrainDirty(): boolean { return state.Dirty(); }
