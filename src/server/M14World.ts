import { buildM14Plan, M14_ENVIRONMENT, M14_WORLD_KEY } from "../shared/M14WorldPlan";
import { M14_BUILD_LIMITS } from "../shared/M14Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M14World={
 Build:(parent:Instance,seed=1414)=>buildComposition(parent,M14_ENVIRONMENT,c=>buildM14Plan(seed,c),M14_BUILD_LIMITS.descendants,14000,0.25),
 Clear:compositionClear,
};
registerWorldClear(M14_WORLD_KEY,M14World.Clear);
