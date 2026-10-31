import { buildM15Plan, M15_ENVIRONMENT, M15_WORLD_KEY } from "../shared/M15WorldPlan";
import { M15_BUILD_LIMITS } from "../shared/M15Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M15World={
 Build:(parent:Instance,seed=1515)=>buildComposition(parent,M15_ENVIRONMENT,c=>buildM15Plan(seed,c),M15_BUILD_LIMITS.descendants,3000,0.25),
 Clear:compositionClear,
};
registerWorldClear(M15_WORLD_KEY,M15World.Clear);
