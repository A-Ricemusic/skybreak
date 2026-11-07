/** Inspect the match index, not the LuaTuple container returned by string.find. */
export function containsLogText(message: string, text: string): boolean {
	return string.find(message, text, 1, true)[0] !== undefined;
}

/** Informational report rows must never feed back into their own diagnostics. */
export function classifyCampaignLog(message: string, kind: Enum.MessageType): "error" | "warning" | undefined {
	if (kind === Enum.MessageType.MessageError) return "error";
	if (kind !== Enum.MessageType.MessageWarning) return undefined;
	if (containsLogText(message, "still loading after the preload deadline; placing fallbacks")) return "warning";
	if (
		containsLogText(message, "SKYBREAK world lifecycle") ||
		containsLogText(message, "settlement:") ||
		containsLogText(message, "SKYBREAK mission construction failed")
	)
		return "error";
	return undefined;
}

/** Only actual warning/error diagnostics may establish the expected pre-registration capture failure. */
export function isTerrainCaptureFailureLog(message: string, kind: Enum.MessageType): boolean {
	return (
		(kind === Enum.MessageType.MessageWarning || kind === Enum.MessageType.MessageError) &&
		containsLogText(message, "Owned terrain column exceeds supported ray range")
	);
}
