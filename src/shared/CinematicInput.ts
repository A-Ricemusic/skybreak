export type CinematicControl = "skip" | "pause" | "motion" | "text" | "next";
export type CinematicAction = CinematicControl | "cancel";
export type CinematicInput =
	| {kind: "activated"; control: CinematicControl}
	| {kind: "shortcut"; key: string; processed: boolean; guiSelected: boolean};

/** A belongs exclusively to Roblox GUI activation. Shortcut handling must not
 * also skip when A activates an accessibility control, or redispatch consumed
 * input. Space likewise belongs to the selected GUI while a control has focus. */
export function routeCinematicInput(input: CinematicInput): CinematicAction | undefined {
	if (input.kind === "activated") return input.control;
	if (input.processed) return undefined;
	if (input.key === "Space" && !input.guiSelected) return "skip";
	if (input.key === "P" || input.key === "ButtonX") return "pause";
	if (input.key === "ButtonB") return "cancel";
	// Next line: tapping the scene activates "next"; keyboard Right and gamepad R1 mirror it.
	if (input.key === "Right" || input.key === "ButtonR1") return "next";
	return undefined;
}
