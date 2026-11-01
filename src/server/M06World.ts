import { NAVAL_ASSETS } from "../shared/NavalKit";
import { WorldAssets } from "./WorldAssets";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import { buildM06Plan, M06_ENVIRONMENT, M06_WORLD_KEY, m06TargetLayout } from "../shared/M06WorldPlan";
import { M06_BUILD_LIMITS } from "../shared/M06Limits";
import { M06_TARGET_TYPES } from "../shared/missions/m06";
import { buildComposition } from "./CompositionWorld";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
/**
 * Mission 6's military quays. Every hull, yard contact and defence mount is drawn once by the composition, as a
 * Model named by target id, and handed to combat in `targetVisuals` (D-260). One native clear, isolated by the
 * world-lifecycle gate.
 */
export const M06World = {
	Build(parent: Instance, seed = 606): { groundTargets: Model[]; targetVisuals: Map<string, Model> } {
  WorldAssets.Preload([...MILITARY_GROUND_ASSETS, ...NAVAL_ASSETS]);
		const built = buildComposition(parent, M06_ENVIRONMENT, checkpoint => buildM06Plan(seed, checkpoint), M06_BUILD_LIMITS.descendants, 14000, 0.25);
		const scene = parent.FindFirstChild(M06_WORLD_KEY);
		assert(scene !== undefined, "M06 scene folder is missing");
		const visuals = new Map<string, Model>();
		for (const t of m06TargetLayout()) {
			const model = scene.FindFirstChild(t.id);
			assert(model !== undefined && model.IsA("Model"), `M06 target ${t.id} was not drawn`);
			visuals.set(t.id, adoptGroundTarget(model, t.id, M06_TARGET_TYPES[t.type]));
		}
		parent.SetAttribute("WorldTargetVisuals", visuals.size());
		return { groundTargets: built.groundTargets, targetVisuals: visuals };
	},
	Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M06_WORLD_KEY, M06World.Clear);
