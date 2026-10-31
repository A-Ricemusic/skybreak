import { buildM16Plan, M16_ENVIRONMENT, M16_WORLD_KEY } from "../shared/M16WorldPlan";
import { M16_BUILD_LIMITS } from "../shared/M16Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M16World={
 Build:(parent:Instance,seed=1616)=>buildComposition(parent,M16_ENVIRONMENT,c=>buildM16Plan(seed,c),M16_BUILD_LIMITS.descendants,3000,0.25),
 Clear:compositionClear,
};
registerWorldClear(M16_WORLD_KEY,M16World.Clear);
