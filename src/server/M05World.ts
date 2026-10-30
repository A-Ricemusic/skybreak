import { registerWorldClear } from "./WorldLifecycleRuntime";
import { buildM05Plan, M05_ENVIRONMENT, M05_WORLD_KEY } from "../shared/M05WorldPlan";
import { M05_BUILD_LIMITS } from "../shared/M05Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
/** Dormant scenery; light anchor data is exported by M05WorldPlan for engine C. */
export const M05World = {
 Build: (parent: Instance, seed = 505) => buildComposition(parent, M05_ENVIRONMENT, checkpoint => buildM05Plan(seed, checkpoint), M05_BUILD_LIMITS.descendants, 14000),
 /** One clear for normal exit and partial construction, owned by the shared world gate (see compositionClear). */
 Clear: compositionClear,
};

registerWorldClear(M05_WORLD_KEY, M05World.Clear);
