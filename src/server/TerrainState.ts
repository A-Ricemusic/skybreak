import { Workspace } from "@rbxts/services";
import { TerrainWriteState } from "../shared/TerrainWriteState";

// Composition plans own an exact sparse write footprint. Erase those boxes rather
// than asking native Clear to traverse the entire tall, hollow world's extent.
// Keep the footprint until every write finishes: a failed/cancelled build or clear
// must still be recoverable. Untracked legacy terrain retains native cleanup.
import { alignedBlockRegion } from "../shared/TerrainSchedule";
import type { TerrainOp } from "../shared/WorldPlan";
import { TerrainWriter } from "./TerrainWriter";
let footprint: TerrainOp[] | undefined;
let canTrack = false;
const state = new TerrainWriteState(() => {
 if (footprint === undefined) Workspace.Terrain.Clear();
 else {
  const started = os.clock();
  const timing = TerrainWriter.Write(footprint, 0.25);
  print(`MISSION_TERRAIN_CLEANUP mode=sparse seconds=${os.clock()-started} jobs=${timing.jobs} work=${timing.total} yields=${timing.yields}`);
 }
 footprint = undefined; canTrack = false;
});
/** Called before the first write, so partial builds have the same cleanup owner. */
export function trackTerrainFootprint(ops: TerrainOp[]): void {
 // Full voxel boxes erase exactly. Legacy curved/non-grid plans use native Clear.
 if (!canTrack) return;
 canTrack = false;
 if (ops.some(o => alignedBlockRegion(o) === undefined)) return;
 footprint = ops.map(o => ({...o, material: "Air"}));
}
/** Clear the owned sparse footprint, or native terrain when writes were untracked. */
export function clearTerrainIfDirty(): void { state.ClearIfDirty(); }
/** A world is about to write terrain: start from empty terrain, then mark it written. */
export function beginTerrainWrite(): void { state.BeginWrite(); canTrack = true; }
/** A registered world clear removed everything that world wrote; no native clear is needed. */
export function markTerrainClean(): void { footprint = undefined; canTrack = false; state.MarkClean(); }
export function terrainDirty(): boolean { return state.Dirty(); }
