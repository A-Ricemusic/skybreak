import { buildM10Plan, M10_ENVIRONMENT, M10_WORLD_KEY } from "../shared/M10WorldPlan";
import { M10_BUILD_LIMITS } from "../shared/M10Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M10World = {
 Build: (parent: Instance, seed = 1010) => buildComposition(parent, M10_ENVIRONMENT, checkpoint => buildM10Plan(seed, checkpoint), M10_BUILD_LIMITS.descendants, 14000, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M10_WORLD_KEY, M10World.Clear);
