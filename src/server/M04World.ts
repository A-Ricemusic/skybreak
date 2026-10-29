import { buildM04Plan, M04_ENVIRONMENT } from "../shared/M04WorldPlan";
import { M04_BUILD_LIMITS } from "../shared/M04Limits";
import type { TerrainOp } from "../shared/WorldPlan";
import { WORLD_FILL_CHUNK } from "../shared/SealedWorldSurface";
import { TerrainWriter } from "./TerrainWriter";
import { buildComposition } from "./CompositionWorld";
let terrainOps: TerrainOp[] = [];
/** Combat owns all moving contacts; no static aircraft copies are built. */
export const M04World = {
 Build: (parent: Instance, seed = 404) => buildComposition(parent, M04_ENVIRONMENT, checkpoint => {
  const plan=buildM04Plan(seed,checkpoint);terrainOps=plan.ops;
  return {...plan,targets:[]};
 }, M04_BUILD_LIMITS.descendants, 5500),
 /** Clear the exact written shell in bounded, yielding jobs before the global menu clear.
  * A monolithic Terrain.Clear on this large shell exceeded Studio's watchdog.
  */
 Clear: () => {
  const timing=TerrainWriter.Write(terrainOps.map(op=>({...op,material:"Air" as const})),0.008,WORLD_FILL_CHUNK);
  terrainOps=[];
  return timing;
 },
};
