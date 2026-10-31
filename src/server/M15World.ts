import { buildM15ScenePlan, M15_ENVIRONMENT, M15_WORLD_KEY } from "../shared/M15WorldPlan";
import { M15_BUILD_LIMITS } from "../shared/M15Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
import { M15_TARGETS } from "../shared/missions/m15";
import { adoptGroundTarget } from "./GroundTargetFactory";
export const M15World={
 Build:(parent:Instance,seed=1515)=>{
  const built=buildComposition(parent,M15_ENVIRONMENT,c=>buildM15ScenePlan(seed,c),M15_BUILD_LIMITS.descendants,3000,0.25);
  const scene=parent.FindFirstChild(M15_WORLD_KEY)!;
  const targetVisuals=new Map<string,Model>();
  for(const t of M15_TARGETS) {
   const model=scene.FindFirstChild(t.id);
   assert(model!==undefined && model.IsA("Model"),`M15 target ${t.id} missing`);
   targetVisuals.set(t.id,adoptGroundTarget(model,t.id,t.type));
  }
  parent.SetAttribute("WorldTargetVisuals",targetVisuals.size());
  return {...built,targetVisuals};
 },
 Clear:compositionClear,
};
registerWorldClear(M15_WORLD_KEY,M15World.Clear);
