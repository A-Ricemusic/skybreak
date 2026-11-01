import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { buildM10Plan, M10_ENVIRONMENT, M10_WORLD_KEY } from "../shared/M10WorldPlan";
import { M10_WORLD_TARGETS } from "../shared/missions/m10";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { M10_BUILD_LIMITS } from "../shared/M10Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M10World = {
 Build: (parent: Instance, seed = 1010) => {
  WorldAssets.Preload(MILITARY_GROUND_ASSETS);
  const built=buildComposition(parent,M10_ENVIRONMENT,checkpoint=>buildM10Plan(seed,checkpoint),M10_BUILD_LIMITS.descendants,14000,0.25);
  const scene=parent.FindFirstChild(M10_WORLD_KEY);
  assert(scene!==undefined,"M10 scene missing");
  const targetVisuals=new Map<string,Model>();
  for(const t of M10_WORLD_TARGETS) {
   const model=scene.FindFirstChild(t.id);
   assert(model!==undefined && model.IsA("Model"),`M10 target ${t.id} missing`);
   targetVisuals.set(t.id,adoptGroundTarget(model,t.id,t.type));
  }
  parent.SetAttribute("WorldTargetVisuals",targetVisuals.size());
  return {groundTargets:built.groundTargets,targetVisuals};
 },
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M10_WORLD_KEY, M10World.Clear);
