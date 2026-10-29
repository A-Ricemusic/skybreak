import { buildM04Plan, M04_ENVIRONMENT } from "../shared/M04WorldPlan";
import { M04_BUILD_LIMITS } from "../shared/M04Limits";
import { buildComposition } from "./CompositionWorld";
/** Dormant scenery. Mission integration owns moving air contacts and their timing. */
export const M04World = { Build: (parent: Instance, seed = 404) => buildComposition(parent, M04_ENVIRONMENT, checkpoint => buildM04Plan(seed, checkpoint), M04_BUILD_LIMITS.descendants, 5500) };
