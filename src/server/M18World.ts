import { buildM18Plan, m18TargetLayout, M18_ENVIRONMENT, M18_WORLD_KEY } from "../shared/M18WorldPlan";
import { M18_BUILD_LIMITS } from "../shared/M18Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
import { M18_TARGETS } from "../shared/missions/m18";
import { adoptGroundTarget } from "./GroundTargetFactory";
export const M18World={
 Build:(parent:Instance,seed=1818)=>{
  const built=buildComposition(parent,M18_ENVIRONMENT,c=>buildM18Plan(seed,c),M18_BUILD_LIMITS.descendants,9000,0.25);
  const scene=parent.FindFirstChild(M18_WORLD_KEY)!;
  // Dormant world air slots are placement proxies, never stationary duplicate hostiles.
  for(const t of m18TargetLayout()) if(t.group==="optional_air" || t.group==="optional_missile") scene.FindFirstChild(t.id)?.Destroy();
  const targetVisuals=new Map<string,Model>();
  for(const t of M18_TARGETS) {
   const model=scene.FindFirstChild(t.id);
   assert(model?.IsA("Model"),`M18 target ${t.id} missing`);
   targetVisuals.set(t.id,adoptGroundTarget(model,t.id,t.type));
  }
  return {...built,targetVisuals};
 },
 Clear:compositionClear,
};
registerWorldClear(M18_WORLD_KEY,M18World.Clear);
