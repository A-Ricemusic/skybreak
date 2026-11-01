import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { buildM12Plan, M12_ENVIRONMENT, M12_WORLD_KEY } from "../shared/M12WorldPlan";
import { M12_BUILD_LIMITS } from "../shared/M12Limits";
import { buildComposition } from "./CompositionWorld";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { M12_TARGETS } from "../shared/missions/m12";
export const M12World={
 Build:(parent:Instance,seed=1212)=>{
  WorldAssets.Preload(MILITARY_GROUND_ASSETS);
  const built=buildComposition(parent,M12_ENVIRONMENT,checkpoint=>buildM12Plan(seed,checkpoint),M12_BUILD_LIMITS.descendants,12000,0.25);
  const scene=parent.FindFirstChild(M12_WORLD_KEY);
  assert(scene!==undefined,"M12 scene missing");
  const targetVisuals=new Map<string,Model>();
  for(const t of M12_TARGETS) {
   const model=scene.FindFirstChild(t.id);
   assert(model!==undefined && model.IsA("Model"),`M12 target ${t.id} missing`);
   if(t.type === "railgun_emplacement") model.SetAttribute("LeaveWreck",true);
   targetVisuals.set(t.id,adoptGroundTarget(model,t.id,t.type));
  }
  parent.SetAttribute("WorldTargetVisuals",targetVisuals.size());
  return {groundTargets:built.groundTargets,targetVisuals};
 },
 Clear:(cancelled:()=>boolean)=>{if(!cancelled())clearTerrainIfDirty();},
};
registerWorldClear(M12_WORLD_KEY,M12World.Clear);
