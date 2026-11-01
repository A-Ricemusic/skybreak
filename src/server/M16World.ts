import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { buildM16ScenePlan, M16_ENVIRONMENT, M16_WORLD_KEY } from "../shared/M16WorldPlan";
import { M16_BUILD_LIMITS } from "../shared/M16Limits";
import { M16_TARGETS } from "../shared/missions/m16";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M16World = {
 Build(parent: Instance, seed = 1616) {
  WorldAssets.Preload(MILITARY_GROUND_ASSETS);
  const built = buildComposition(parent, M16_ENVIRONMENT, c => buildM16ScenePlan(seed,c), M16_BUILD_LIMITS.descendants, 3000, 0.25);
  const scene = parent.FindFirstChild(M16_WORLD_KEY);
  assert(scene !== undefined, "M16 scene missing");
  const targetVisuals = new Map<string, Model>();
  for (const t of M16_TARGETS) {
   const model = scene.FindFirstChild(t.id);
   assert(model !== undefined && model.IsA("Model"), `M16 target ${t.id} missing`);
   targetVisuals.set(t.id, adoptGroundTarget(model, t.id, t.type));
  }
  parent.SetAttribute("WorldTargetVisuals", targetVisuals.size());
  return { groundTargets: built.groundTargets, targetVisuals };
 },
 Clear: compositionClear,
};
registerWorldClear(M16_WORLD_KEY, M16World.Clear);
