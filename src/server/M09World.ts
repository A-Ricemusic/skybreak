import { buildM09Plan, M09_ENVIRONMENT, M09_WORLD_KEY, m09TargetLayout } from "../shared/M09WorldPlan";
import { M09_BUILD_LIMITS } from "../shared/M09Limits";
import { M09_TARGET_TYPES } from "../shared/missions/m09";
import { buildComposition } from "./CompositionWorld";
import { adoptGroundTarget } from "./GroundTargetFactory";
import { clearTerrainIfDirty } from "./TerrainState";
import { registerWorldClear } from "./WorldLifecycleRuntime";
/** D-340: adopt the 55 world-drawn beach contacts by stable id, with no duplicate combat geometry. */
export const M09World = {
	Build(parent: Instance, seed = 909): { groundTargets: Model[]; targetVisuals: Map<string, Model> } {
		const built = buildComposition(parent, M09_ENVIRONMENT, checkpoint => buildM09Plan(seed, checkpoint), M09_BUILD_LIMITS.descendants, 14000, 0.25);
		const scene = parent.FindFirstChild(M09_WORLD_KEY);
		assert(scene !== undefined, "M09 scene folder is missing");
		const visuals = new Map<string, Model>();
		for (const t of m09TargetLayout()) {
			const model = scene.FindFirstChild(t.id);
			assert(model !== undefined && model.IsA("Model"), `M09 target ${t.id} was not drawn`);
			visuals.set(t.id, adoptGroundTarget(model, t.id, M09_TARGET_TYPES[t.type]));
		}
		parent.SetAttribute("WorldTargetVisuals", visuals.size());
		return { groundTargets: built.groundTargets, targetVisuals: visuals };
	},
	Clear: (cancelled: () => boolean) => { if (!cancelled()) clearTerrainIfDirty(); },
};
registerWorldClear(M09_WORLD_KEY, M09World.Clear);
