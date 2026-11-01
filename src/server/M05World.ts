import { WORLD_FILL_CHUNK } from "../shared/SealedWorldSurface";
import { registerWorldClear } from "./WorldLifecycleRuntime";
import { buildM05Plan, M05_TERRAIN_BUDGET, M05_ENVIRONMENT, M05_WORLD_KEY, m05TargetLayout } from "../shared/M05WorldPlan";
import { M05_BUILD_LIMITS } from "../shared/M05Limits";
import { M05_TARGET_TYPES } from "../shared/missions/m05";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { adoptGroundTarget } from "./GroundTargetFactory";

/**
 * Mission 5's night refinery. Every rig, refinery and tanker contact is drawn once by the composition, as a Model
 * named by target id, and handed to combat in `targetVisuals` (D-100). The three helicopter poses are route starts
 * for flying helicopters, so their scenery copies are removed. Lights are built by combat from the mission's anchors.
 */
export const M05World = {
	Build(parent: Instance, seed = 505): { groundTargets: Model[]; targetVisuals: Map<string, Model> } {
		const built = buildComposition(parent, M05_ENVIRONMENT, checkpoint => buildM05Plan(seed, checkpoint), M05_BUILD_LIMITS.descendants, 14000, M05_TERRAIN_BUDGET, WORLD_FILL_CHUNK);
		const scene = parent.FindFirstChild(M05_WORLD_KEY);
		assert(scene !== undefined, "M05 scene folder is missing");
		const visuals = new Map<string, Model>();
		for (const t of m05TargetLayout()) {
			const model = scene.FindFirstChild(t.id);
			assert(model !== undefined && model.IsA("Model"), `M05 target ${t.id} was not drawn`);
			if (t.type === "helicopter") { model.Destroy(); continue; }
			visuals.set(t.id, adoptGroundTarget(model, t.id, M05_TARGET_TYPES[t.type as Exclude<typeof t.type, "helicopter">]));
		}
		parent.SetAttribute("WorldTargetVisuals", visuals.size());
		return { groundTargets: built.groundTargets, targetVisuals: visuals };
	},
	/** One clear for normal exit and partial construction, owned by the shared world gate (see compositionClear). */
	Clear: compositionClear,
};

registerWorldClear(M05_WORLD_KEY, M05World.Clear);
