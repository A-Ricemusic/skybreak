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

/**
 * Settling a finished sortie: say the outcome, schedule the save, then tear the world down and let
 * the player fly again. Each hook is protected on its own. Whatever throws, and wherever, the
 * world is torn down and the player released exactly once, so StartMission is never left refusing
 * ("still being saved") for the rest of the server's life.
 */
export interface SettlementState {
	/** Settlement began: the player may not start another sortie until it is released. */
	entered: boolean;
	/** A completion task is scheduled; that task (not an error path) saves, tears down and releases. */
	scheduled: boolean;
	/** Torn down and released, by the completion task or a fallback. */
	settled: boolean;
}
export interface SettlementHooks {
	/** Cosmetic: the final explosion and the outcome on the HUD. A throw is warned and ignored. */
	announce: () => void;
	/** Builds the result and schedules `complete` (task.defer); a throw means nothing was scheduled. */
	schedule: (complete: () => void) => void;
	/** In the completion task: save the result and report it to the player. */
	save: () => void;
	/** The result was not saved: tell the player so the result screen does not wait. */
	unsaved: () => void;
	/** Destroys the session's world. */
	teardown: () => void;
	/** Lets the player start another sortie (and forgets the session). */
	release: () => void;
	warn: (message: string) => void;
}
function settle(state: SettlementState, hooks: SettlementHooks): void {
	state.settled = true;
	const [tornDown, err] = pcall(() => hooks.teardown());
	if (!tornDown) pcall(() => hooks.warn(`teardown failed: ${tostring(err)}`));
	// Released even when teardown threw: a stuck release blocks every later sortie.
	if (state.entered) {
		const [released, releaseError] = pcall(() => hooks.release());
		if (!released) pcall(() => hooks.warn(`release failed: ${tostring(releaseError)}`));
	}
}
export const Settlement = {
	New(): SettlementState { return { entered: false, scheduled: false, settled: false }; },
	/** The sortie is over: announce, then schedule the save; if scheduling fails, settle now. */
	Begin(state: SettlementState, hooks: SettlementHooks): void {
		if (state.entered) return;
		state.entered = true;
		const [announced, announceError] = pcall(() => hooks.announce());
		if (!announced) pcall(() => hooks.warn(`result announcement failed: ${tostring(announceError)}`));
		const [scheduled, err] = pcall(() => hooks.schedule(() => Settlement.Complete(state, hooks)));
		if (scheduled) { state.scheduled = true; return; }
		pcall(() => hooks.warn(`could not schedule the save: ${tostring(err)}`));
		Settlement.Abandon(state, hooks);
	},
	/** The completion task: save (or report it unsaved), then tear down and release. Runs at most once. */
	Complete(state: SettlementState, hooks: SettlementHooks): void {
		if (state.settled) return;
		const [saved, err] = pcall(() => hooks.save());
		if (!saved) {
			pcall(() => hooks.warn(`mission completion callback: ${tostring(err)}`));
			pcall(() => hooks.unsaved());
		}
		settle(state, hooks);
	},
	/**
	 * An error path: unless a completion task is still coming, report the result unsaved, tear down
	 * and release now. Returns whether it settled the session.
	 */
	Abandon(state: SettlementState, hooks: SettlementHooks): boolean {
		if (state.settled || state.scheduled) return false;
		pcall(() => hooks.unsaved());
		settle(state, hooks);
		return true;
	},
};
