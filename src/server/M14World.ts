// Mission 14 world: feeds M14WorldPlan through CompositionWorld, dropping airborne geometry for mobile
// targets so only live actors draw them. Owns no state; Build/Clear run under the world lifecycle.
import { buildM14Plan, M14_ENVIRONMENT, M14_WORLD_KEY } from "../shared/M14WorldPlan";
import { M14_BUILD_LIMITS } from "../shared/M14Limits";
import { buildComposition, compositionClear } from "./CompositionWorld";
import { registerWorldClear } from "./WorldLifecycleRuntime";
export const M14World = {
	Build: (parent: Instance, seed = 1414) =>
		buildComposition(
			parent,
			M14_ENVIRONMENT,
			(c) => {
				const plan = buildM14Plan(seed, c);
				// Keep authored inventory models for ID handoff; only live actors draw airborne geometry.
				const mobile = new Set(plan.targets.filter((t) => t.group !== "protected").map((t) => t.id));
				plan.parts = plan.parts.filter((p) => !mobile.has(p.name));
				return plan;
			},
			M14_BUILD_LIMITS.descendants,
			14000,
			0.25,
		),
	Clear: compositionClear,
};
registerWorldClear(M14_WORLD_KEY, M14World.Clear);
