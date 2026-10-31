import { adoptGroundTarget } from "./GroundTargetFactory";
import { M07_SCENERY_ID, M07_TARGET_TYPES } from "../shared/missions/m07";
import { buildM07Plan, M07_ENVIRONMENT, M07_WORLD_KEY, m07TargetLayout } from "../shared/M07WorldPlan";
import { M07_BUILD_LIMITS } from "../shared/M07Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
/** One native clear, isolated by the world-lifecycle gate. */
export const M07World = {
 Build: (parent: Instance, seed = 707) => {
  const built = buildComposition(parent, M07_ENVIRONMENT, checkpoint => buildM07Plan(seed, checkpoint), M07_BUILD_LIMITS.descendants, 14000, 0.25);
  const scene = parent.FindFirstChild(M07_WORLD_KEY);
  assert(scene !== undefined, "M07 scene missing");
  const targetVisuals = new Map<string, Model>();
  for (const t of m07TargetLayout()) {
   if (t.id === M07_SCENERY_ID) continue;
   const model = scene.FindFirstChild(t.id);
   assert(model !== undefined && model.IsA("Model"), `M07 target ${t.id} missing`);
   targetVisuals.set(t.id, adoptGroundTarget(model, t.id, M07_TARGET_TYPES[t.type]));
  }
  parent.SetAttribute("WorldTargetVisuals", targetVisuals.size());
  return { groundTargets: built.groundTargets, targetVisuals };
 },
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M07_WORLD_KEY, M07World.Clear);
