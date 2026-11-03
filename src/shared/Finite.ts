// Finite-number guards shared by the rules modules, the client and the server.
// Pure (no Roblox globals) so it runs in the offline Luau VM. Replaces the per-module `finite`
// copies: a value is finite when it is a number that is neither NaN nor ±infinity.

/** Type guard for a real, finite number; anything off the wire or from a save should go through this. */
export function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
}

/** `value` when it is a finite number, otherwise `fallback`. */
export function finiteOr(value: unknown, fallback: number): number {
	return isFiniteNumber(value) ? value : fallback;
}
