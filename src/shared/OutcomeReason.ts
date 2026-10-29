import type { BlueprintReason } from "./BlueprintRunner";
import { GameConfig } from "./GameConfig";

export type MissionReason = BlueprintReason | "crash_water" | "crash_terrain" | "internal_error" | "not_recorded";

/** Unknown or older-server reasons keep the generic debrief fallback. */
export function isMissionReason(value: unknown): value is MissionReason {
	return value === "complete" || value === "timeout" || value === "destroyed" || value === "protected_lost"
		|| value === "escaped" || value === "bombers_escaped" || value === "crash_water" || value === "crash_terrain"
		|| value === "internal_error" || value === "not_recorded";
}

/** Readable failure cause for the debrief. */
export function failureCause(reason?: string): string {
	if (reason === "crash_water") return "Your aircraft crashed into the water.";
	if (reason === "crash_terrain") return "Your aircraft crashed into terrain or scenery.";
	if (reason === "timeout") return `The ${math.floor(GameConfig.Campaign.MissionTimeLimit / 60)}-minute operation window closed.`;
	if (reason === "bombers_escaped") return "The bombers got through.";
	if (reason === "escaped") return "The courier got away.";
	if (reason === "internal_error") return "The sortie was stopped by a server error. Fly it again from the campaign menu.";
	if (reason === "protected_lost") return "The protected vehicle or site was lost.";
	if (reason === "destroyed") return "Your aircraft was shot down.";
	if (reason === "not_recorded") return "The server could not record this sortie. Fly it again from the campaign menu.";
	return "The sortie ended before the objective was complete.";
}
