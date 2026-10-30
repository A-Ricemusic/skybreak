import { buildM18Plan, M18_ENVIRONMENT, M18_WORLD_KEY } from "../shared/M18WorldPlan";
import { M18_BUILD_LIMITS } from "../shared/M18Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M18World={
 Build:(parent:Instance,seed=1818)=>buildComposition(parent,M18_ENVIRONMENT,c=>buildM18Plan(seed,c),M18_BUILD_LIMITS.descendants,9000,0.25),
 Clear:compositionClear,
};
registerWorldClear(M18_WORLD_KEY,M18World.Clear);
