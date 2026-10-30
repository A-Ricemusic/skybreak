import { buildM13Plan, M13_ENVIRONMENT, M13_WORLD_KEY } from "../shared/M13WorldPlan";
import { M13_BUILD_LIMITS } from "../shared/M13Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M13World={
 Build:(parent:Instance,seed=1313)=>buildComposition(parent,M13_ENVIRONMENT,checkpoint=>buildM13Plan(seed,checkpoint),M13_BUILD_LIMITS.descendants,3000,0.25),
 Clear:(cancelled:()=>boolean)=>{if(!cancelled())clearTerrainIfDirty();},
};
registerWorldClear(M13_WORLD_KEY,M13World.Clear);
