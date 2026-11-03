// Pure client sortie lifecycle around the mission-end presentation hold. A sortie is "flying" from Start until
// Completed/Failed, then "ending": controls, input packets and weapons are dead, but the camera, the local jet,
// explosion handling and CameraShake keep running so the last kill or the player's own blast plays out. GameUI owns
// the hold's length (UIState MISSION_END_HOLD) and calls Stop when it expires; Loading, unmount, return-to-menu and
// a new Start stop at once and cancel a pending ending. Roblox-free.
export type SortiePhase = "stopped" | "flying" | "ending";
export type SortieEvent = "start" | "finish" | "stop";
export const MissionEnding = {
	/** The phase implied by the controller's two flags (active: presentation alive; ending: hold in progress). */
	PhaseOf(active: boolean, ending: boolean): SortiePhase {
		return !active ? "stopped" : ending ? "ending" : "flying";
	},
	/** Start always (re)begins flight; finish only ends a flying sortie (a stopped one stays stopped); stop always wins. */
	Next(phase: SortiePhase, event: SortieEvent): SortiePhase {
		if (event === "start") return "flying";
		if (event === "stop") return "stopped";
		return phase === "stopped" ? "stopped" : "ending";
	},
	/** Gameplay controls (stick, throttle, weapons, pause, skip) and FlightInput packets. */
	AcceptsControls(phase: SortiePhase): boolean {
		return phase === "flying";
	},
	/** Camera, local visual, explosion handling and CameraShake. */
	HoldsPresentation(phase: SortiePhase): boolean {
		return phase !== "stopped";
	},
};
