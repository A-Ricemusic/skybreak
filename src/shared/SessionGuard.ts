// Pure helpers for the server's per-session simulation loop: error isolation with a
// re-entrancy guard, and the pause budget. No instances, no clock reads.

export interface StepGuardState {
	/** A step is executing (possibly suspended in a yield); a second entry is refused. */
	running: boolean;
	/** The session has thrown once; it never steps again. */
	failed: boolean;
	message?: string;
}
export const StepGuard = {
	New(): StepGuardState { return { running: false, failed: false }; },
	/**
	 * Runs `step` protected. Returns false without running when the session already failed or a
	 * previous step is still in flight (a yield inside the step must not let Heartbeat re-enter it).
	 * The first error calls `onFailure` exactly once (itself protected), and every later call is refused.
	 */
	Run(state: StepGuardState, step: () => void, onFailure: (message: string) => void): boolean {
		if (state.failed || state.running) return false;
		state.running = true;
		const [ok, err] = pcall(step);
		state.running = false;
		if (ok) return true;
		if (state.failed) return false;
		state.failed = true;
		state.message = tostring(err);
		pcall(onFailure, state.message);
		return false;
	},
};

export interface PauseState {
	/** Clock time the current pause began, if paused. */
	pausedAt?: number;
	/** Seconds of pause already spent this sortie. */
	used: number;
}
/** A sortie may be paused for this long in total; past it the clock runs again. */
const PAUSE_BUDGET = 300;
function finite(value: number): boolean { return value === value && math.abs(value) !== math.huge; }
export const PauseRules = {
	Budget: PAUSE_BUDGET,
	New(): PauseState { return { used: 0 }; },
	Paused(state: PauseState): boolean { return state.pausedAt !== undefined; },
	/** Start a pause; refused when already paused or the budget is spent. */
	Pause(state: PauseState, now: number): boolean {
		if (!finite(now) || state.pausedAt !== undefined || state.used >= PAUSE_BUDGET) return false;
		state.pausedAt = now;
		return true;
	},
	/**
	 * End the pause. Returns how far to shift the mission's start time: the paused span,
	 * capped at what is left of the budget (time beyond the cap counts against the clock).
	 */
	Resume(state: PauseState, now: number): number {
		if (state.pausedAt === undefined || !finite(now)) return 0;
		const span = math.clamp(now - state.pausedAt, 0, PAUSE_BUDGET - state.used);
		state.used += span;
		state.pausedAt = undefined;
		return span;
	},
	/** The current pause has used up the whole budget and should end on its own. */
	Expired(state: PauseState, now: number): boolean {
		return state.pausedAt !== undefined && now - state.pausedAt >= PAUSE_BUDGET - state.used;
	},
};
