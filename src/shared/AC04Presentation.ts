/** Player-facing explanations; unknown server tokens never leak into the debrief. */
export function ac04FailureText(reason?: string): string {
	if (reason === "crash_terrain") return "Aircraft lost in a terrain collision. Gain altitude before turning or diving, and watch your clearance on the next sortie.";
	if (reason === "crash_water") return "Aircraft lost on impact with the water. Keep altitude above the sea during low approaches.";
	if (reason === "destroyed") return "Aircraft destroyed by enemy fire. Break away from threats, evade incoming missiles and use the return line to rearm when available.";
	if (reason === "timeout") return "Mission time expired. Prioritize the marked objective and watch the phase clock; during withdrawal, cross the southern return line.";
	if (reason === "score_requirement") return "The required score was not reached before time expired. Engage more targets during the attack phase.";
	if (reason === "protected_lost") return "The aircraft under your protection was lost. Intercept its attackers before they can fire.";
	if (reason === "missile_escaped") return "An enemy missile reached the defended area. Prioritize missile tracks before they cross the line.";
	if (reason === "core_not_destroyed") return "The core was still operational when you left. Destroy the required core before escaping.";
	if (reason === "internal_error" || reason === "invalid_campaign_result") return "The sortie could not be finalized. Return to the briefing and retry. Check your flight record before continuing.";
	return "The operation was not completed. Review the mission objectives in the briefing, then retry the sortie.";
}
