import { buildM17Plan, M17_ENVIRONMENT, M17_WORLD_KEY } from "../shared/M17WorldPlan";
import { M17_BUILD_LIMITS } from "../shared/M17Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M17World={
 Build:(parent:Instance,seed=1717)=>buildComposition(parent,M17_ENVIRONMENT,c=>buildM17Plan(seed,c),M17_BUILD_LIMITS.descendants,3000,0.25),
 Clear:compositionClear,
};
registerWorldClear(M17_WORLD_KEY,M17World.Clear);
