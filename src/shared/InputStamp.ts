/**
 * Client input stamp staleness. Pure so it runs in the offline Luau VM.
 *
 * Unreliable FlightInput packets can arrive out of order or bunched together, so the newest
 * client stamp wins and an older stamp is dropped. A repeated stamp is legitimate: stamps are
 * fixed-step boundaries, so the first send after a resume reuses the frozen one. The accepted
 * stamp becomes the floor for later packets, which is why it must stay plausible: a stamp more
 * than RESET_WINDOW seconds away from the floor (either direction) is a clock reset, not
 * reordering, so it is accepted and re-bases the floor instead of freezing the session's own
 * controls until the sortie ends (security audit F4).
 */
export const INPUT_STAMP_RESET_WINDOW = 120;

export type InputStampDecision =
	/** No usable stamp: the caller keeps its wall-clock rate floor. */
	| { readonly kind: "unstamped" }
	/** Older than the floor by a plausible amount: a reordered packet, drop it. */
	| { readonly kind: "stale" }
	/** Accept the packet; `floor` is the new accepted stamp and `reset` marks an implausible jump. */
	| { readonly kind: "accept"; readonly floor: number; readonly reset: boolean };

function isFinite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
}

export const InputStamp = {
	/** `previous` is the current floor (0 when no stamp has been accepted this sortie). */
	Decide(previous: number, incoming: unknown, window = INPUT_STAMP_RESET_WINDOW): InputStampDecision {
		if (!isFinite(incoming) || incoming <= 0) return { kind: "unstamped" };
		if (!isFinite(previous) || previous <= 0) return { kind: "accept", floor: incoming, reset: false };
		if (math.abs(incoming - previous) > window) return { kind: "accept", floor: incoming, reset: true };
		if (incoming < previous) return { kind: "stale" };
		return { kind: "accept", floor: incoming, reset: false };
	},
};
