import { buildM07Plan, M07_ENVIRONMENT, M07_WORLD_KEY } from "../shared/M07WorldPlan";
import { M07_BUILD_LIMITS } from "../shared/M07Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
/** One native clear, isolated by the world-lifecycle gate. */
export const M07World = {
 Build: (parent: Instance, seed = 707) => buildComposition(parent, M07_ENVIRONMENT, checkpoint => buildM07Plan(seed, checkpoint), M07_BUILD_LIMITS.descendants, 14000, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M07_WORLD_KEY, M07World.Clear);
