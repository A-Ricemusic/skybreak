import { buildM09Plan, M09_ENVIRONMENT, M09_WORLD_KEY } from "../shared/M09WorldPlan";
import { M09_BUILD_LIMITS } from "../shared/M09Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M09World = {
 Build: (parent: Instance, seed = 909) => buildComposition(parent, M09_ENVIRONMENT, checkpoint => buildM09Plan(seed, checkpoint), M09_BUILD_LIMITS.descendants, 14000, 0.25),
 Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M09_WORLD_KEY, M09World.Clear);
