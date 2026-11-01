import { NAVAL_ASSETS } from "../shared/NavalKit";
import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { buildM17ScenePlan, M17, M17_ENVIRONMENT, M17_WORLD_KEY } from "../shared/M17WorldPlan";
import { M17_BUILD_LIMITS } from "../shared/M17Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { M17_TARGETS } from "../shared/missions/m17";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M17World={
 Build(parent:Instance,seed=1717) {
  WorldAssets.Preload([...MILITARY_GROUND_ASSETS, ...NAVAL_ASSETS]);
  const built=buildComposition(parent,M17_ENVIRONMENT,c=>buildM17ScenePlan(seed,c),M17_BUILD_LIMITS.descendants,M17.cloudFeet,0.25);
  const scene=parent.FindFirstChild(M17_WORLD_KEY)!;
  const targetVisuals=new Map<string,Model>();
  for(const t of M17_TARGETS) {
   const model=scene.FindFirstChild(t.id);
   assert(model!==undefined && model.IsA("Model"),`M17 target ${t.id} was not drawn`);
   targetVisuals.set(t.id,adoptGroundTarget(model,t.id,t.type));
  }
  parent.SetAttribute("WorldTargetVisuals",targetVisuals.size());
  return {...built,targetVisuals};
 },
 Clear:compositionClear,
};
registerWorldClear(M17_WORLD_KEY,M17World.Clear);
