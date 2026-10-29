import { buildM05Plan, M05_ENVIRONMENT } from "../shared/M05WorldPlan";
import { M05_BUILD_LIMITS } from "../shared/M05Limits";
import { buildComposition } from "./CompositionWorld";
/** Dormant scenery; light anchor data is exported by M05WorldPlan for engine C. */
export const M05World = { Build: (parent: Instance, seed = 505) => buildComposition(parent, M05_ENVIRONMENT, checkpoint => buildM05Plan(seed, checkpoint), M05_BUILD_LIMITS.descendants, 14000) };
