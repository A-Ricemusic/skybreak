import { registerWorldClear } from "./WorldLifecycleRuntime";
import { markTerrainClean } from "./TerrainState";
import { buildM04Plan, M04_ENVIRONMENT, M04_WORLD_KEY } from "../shared/M04WorldPlan";
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
 /** One cancellable clear for normal exit and partial construction, owned by the shared world gate. */
 Clear: (cancelled: () => boolean) => {
  // The sealed-shell plan contains only block fills. Replaying them as Air removes their exact volume;
  // bump operations use occupancy blending and cannot be undone this way.
  assert(terrainOps.every(op=>op.shape==="block"), "M04 clear requires block-only terrain operations");
  const timing=TerrainWriter.Write(terrainOps.map(op=>({...op,material:"Air" as const})),0.008,WORLD_FILL_CHUNK,cancelled);
  if (!cancelled()) { terrainOps=[]; markTerrainClean(); }
  return timing;
 },
};

registerWorldClear(M04_WORLD_KEY, cancelled => { M04World.Clear(cancelled); });
