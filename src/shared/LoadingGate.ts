// Pure state for the mission loading handshake. The server holds a freshly
// built mission in this gate until the client reports that the aircraft and
// world have replicated, and never treats a deadline as readiness. Play (clock, stepping,
// spawning) begins only when the gate is released.
import { isFiniteNumber } from "./Finite";
export interface LoadingGateState {
	startedAt: number;
	deadline: number;
	ready: boolean;
	released: boolean;
}
/** Maximum lifetime of an unacknowledged mission; expiry tears it down without play. */
const DEFAULT_TIMEOUT = 8;
export const LoadingGate = {
	Timeout: DEFAULT_TIMEOUT,
	New(now: number, timeout = DEFAULT_TIMEOUT): LoadingGateState {
		assert(
			isFiniteNumber(now) && isFiniteNumber(timeout) && timeout >= 0,
			"Loading gate requires a finite clock and timeout",
		);
		return { startedAt: now, deadline: now + timeout, ready: false, released: false };
	},
	/** Client confirmed its content; idempotent and harmless after release. */
	MarkReady(state: LoadingGateState): void {
		if (!state.released) state.ready = true;
	},
	ShouldRelease(state: LoadingGateState, now: number): boolean {
		return !state.released && state.ready && now < state.deadline;
	},
	Expired(state: LoadingGateState, now: number): boolean {
		return !state.released && now >= state.deadline;
	},
	/** Returns true exactly once, when the gate transitions to released. */
	Release(state: LoadingGateState, now: number): boolean {
		if (state.released || !(state.ready && now < state.deadline)) return false;
		state.released = true;
		return true;
	},
	/** Validate the session stamp before acknowledging; late and duplicate packets do nothing. */
	AcceptReady(
		state: LoadingGateState,
		now: number,
		currentLaunchId: number | undefined,
		receivedLaunchId: unknown,
	): boolean {
		if (
			!isFiniteNumber(currentLaunchId) ||
			currentLaunchId < 1 ||
			receivedLaunchId !== currentLaunchId ||
			state.released ||
			now >= state.deadline
		)
			return false;
		state.ready = true;
		return LoadingGate.Release(state, now);
	},
	/** 0..1 fraction of expected parts present locally; unknown totals read as complete. */
	Progress(localParts: number, expectedParts?: number): number {
		if (!isFiniteNumber(expectedParts) || expectedParts <= 0) return 1;
		if (!isFiniteNumber(localParts) || localParts <= 0) return 0;
		return math.clamp(localParts / expectedParts, 0, 1);
	},
};
