/**
 * Player-facing text for campaign request failures. Known server messages are rephrased for the
 * interface; anything else (including raw Lua errors and launch internals) becomes a generic line,
 * so exception text, storage backends and internal identifiers never reach the screen.
 */
const KNOWN: { [message: string]: string } = {
	"Campaign session is closing.": "The session is closing.",
	"Please wait for the current campaign operation.": "Please wait for the current command to finish.",
	"AC04 records could not be loaded. Existing saves are protected; retry shortly.": "Flight records could not be loaded. Saved records are protected; retry shortly.",
	"AC04 records could not be saved. Existing saves are protected; retry shortly.": "Flight records could not be saved. Saved records are protected; retry shortly.",
	"Please wait for the sortie result.": "Please wait for the sortie result.",
	"Choose a flight record from 1 to 4.": "Choose a flight record.",
	"That chapter is not yet unlocked.": "That chapter is not yet available.",
	"Finish the active sortie first.": "A sortie is still active. Return from it first.",
	"Complete the preceding mission before launching this sortie.": "Complete the preceding mission first.",
	"That mission is in preparation for a future release.": "That mission is in preparation for a future release.",
	"Choose a valid aircraft.": "Choose an available aircraft.",
	"That aircraft is not yet available in this flight record.": "That aircraft is not yet available in this flight record.",
};

export const AC04_GENERIC_FAILURE = "The command could not be completed. Please retry.";
export const AC04_CONNECTION_FAILURE = "Flight records are not responding. Please retry.";

export function ac04RequestErrorText(serverMessage: unknown): string {
	return typeIs(serverMessage, "string") ? KNOWN[serverMessage] ?? AC04_GENERIC_FAILURE : AC04_GENERIC_FAILURE;
}
