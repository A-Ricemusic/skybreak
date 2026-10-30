import { registerWorldClear } from "./WorldLifecycleRuntime";
import { buildM04Plan, M04_ENVIRONMENT, M04_WORLD_KEY } from "../shared/M04WorldPlan";
import { M04_BUILD_LIMITS } from "../shared/M04Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
/** Combat owns all moving contacts; no static aircraft copies are built. */
export const M04World = {
 Build: (parent: Instance, seed = 404) => buildComposition(parent, M04_ENVIRONMENT, checkpoint => ({ ...buildM04Plan(seed, checkpoint), targets: [] }), M04_BUILD_LIMITS.descendants, 5500),
 /** One clear for normal exit and partial construction, owned by the shared world gate (see compositionClear). */
 Clear: compositionClear,
};

registerWorldClear(M04_WORLD_KEY, M04World.Clear);
