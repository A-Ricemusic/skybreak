import { buildM12Plan, M12_ENVIRONMENT, M12_WORLD_KEY } from "../shared/M12WorldPlan";
import { M12_BUILD_LIMITS } from "../shared/M12Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M12World={
 Build:(parent:Instance,seed=1212)=>buildComposition(parent,M12_ENVIRONMENT,checkpoint=>buildM12Plan(seed,checkpoint),M12_BUILD_LIMITS.descendants,12000,0.25),
 Clear:(cancelled:()=>boolean)=>{if(!cancelled())clearTerrainIfDirty();},
};
registerWorldClear(M12_WORLD_KEY,M12World.Clear);
