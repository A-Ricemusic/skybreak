import { buildM08Plan, M08_ENVIRONMENT, M08_WORLD_KEY } from "../shared/M08WorldPlan";
import { M08_BUILD_LIMITS } from "../shared/M08Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M08World = {
 Build: (parent: Instance, seed = 808) => buildComposition(parent, M08_ENVIRONMENT, checkpoint => buildM08Plan(seed, checkpoint), M08_BUILD_LIMITS.descendants, 14000, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M08_WORLD_KEY, M08World.Clear);
