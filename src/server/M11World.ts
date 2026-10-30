import { buildM11Plan, M11_ENVIRONMENT, M11_WORLD_KEY } from "../shared/M11WorldPlan";
import { M11_BUILD_LIMITS } from "../shared/M11Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M11World = {
 Build: (parent: Instance, seed = 1111) => buildComposition(parent, M11_ENVIRONMENT, checkpoint => buildM11Plan(seed, checkpoint), M11_BUILD_LIMITS.descendants, 6500, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M11_WORLD_KEY, M11World.Clear);
