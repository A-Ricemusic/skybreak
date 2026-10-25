// Pure state for the mission loading handshake. The server holds a freshly
// built mission in this gate until the client reports that the aircraft and
// world have replicated, or until the timeout elapses. Play (clock, stepping,
// spawning) begins only when the gate is released.
export interface LoadingGateState {
	startedAt: number;
	deadline: number;
	ready: boolean;
	released: boolean;
}
function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}
/** Seconds the server waits for a client "Ready" before starting anyway. */
const DEFAULT_TIMEOUT = 8;
export const LoadingGate = {
	Timeout: DEFAULT_TIMEOUT,
	New(now: number, timeout = DEFAULT_TIMEOUT): LoadingGateState {
		assert(finite(now) && finite(timeout) && timeout >= 0, "Loading gate requires a finite clock and timeout");
		return { startedAt: now, deadline: now + timeout, ready: false, released: false };
	},
	/** Client confirmed its content; idempotent and harmless after release. */
	MarkReady(state: LoadingGateState): void {
		state.ready = true;
	},
	ShouldRelease(state: LoadingGateState, now: number): boolean {
		return !state.released && (state.ready || now >= state.deadline);
	},
	/** Returns true exactly once, when the gate transitions to released. */
	Release(state: LoadingGateState, now: number): boolean {
		if (state.released || !(state.ready || now >= state.deadline)) return false;
		state.released = true;
		return true;
	},
	/** 0..1 fraction of expected parts present locally; unknown totals read as complete. */
	Progress(localParts: number, expectedParts?: number): number {
		if (!finite(expectedParts) || expectedParts <= 0) return 1;
		if (!finite(localParts) || localParts <= 0) return 0;
		return math.clamp(localParts / expectedParts, 0, 1);
	},
};
