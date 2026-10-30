import { buildM06Plan, M06_ENVIRONMENT, M06_WORLD_KEY } from "../shared/M06WorldPlan";
import { M06_BUILD_LIMITS } from "../shared/M06Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
/** One native clear, isolated by the world-lifecycle gate. */
export const M06World = {
 Build: (parent: Instance, seed = 606) => buildComposition(parent, M06_ENVIRONMENT, checkpoint => buildM06Plan(seed, checkpoint), M06_BUILD_LIMITS.descendants, 14000, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M06_WORLD_KEY, M06World.Clear);
