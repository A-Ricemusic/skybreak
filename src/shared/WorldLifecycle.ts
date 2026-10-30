/**
 * One mission world at a time. When a sortie ends, its world is cleared and the menu rebuilt in threads of
 * their own; a new launch waits (queued, not refused) until that cleanup has fully completed, so no world
 * is ever built on top of one still being cleared, and no expensive clear runs inside a launch.
 *
 * - Cleanup(job) returns at once: settlement and player release never wait on it.
 * - AwaitIdle() yields the launching thread until every pending cleanup is done (or a bound passes).
 * - The clear and the restore each run isolated, so a script-timeout kill or an error in one cannot strand
 *   the gate. A clear that overruns its bound is cancelled (its `cancelled()` turns true; at a yield point it
 *   is stopped), and the gate opens only once the clear thread has actually stopped, so a late clear can
 *   never erase the next world.
 * - Cleanup is not tied to any player: a player leaving during construction or cleanup still completes it.
 * - Close() (server shutdown) cancels running cleanups and skips new ones, so final saves are not starved.
 *
 * Pure: the scheduler is injected (Roblox task library on the server, a coroutine fake in tests).
 */
export interface IsolatedWork {
	/** True once the work has ended: returned, thrown, been killed or been cancelled. */
	ended: () => boolean;
	/** Stops the work if it is suspended at a yield point. */
	cancel: () => void;
}
export interface LifecycleScheduler {
	/** Runs `work` in its own resumption. */
	isolate(work: () => void): IsolatedWork;
	/** Yields the calling thread for about one frame. */
	wait(): void;
	/** Monotonic seconds. */
	now(): number;
	warn(message: string): void;
}
/** Clears one world. It may yield; it should return promptly once `cancelled()` is true. */
export type WorldClear = (cancelled: () => boolean) => void;
/** One world's teardown: `clear` removes its terrain, `restore` rebuilds the menu world. */
export interface WorldCleanup {
	clear: WorldClear;
	restore: () => void;
	/** Seconds to wait before clearing, so a result already sent reaches the player before the clear. */
	delaySeconds?: number;
}
/** Default bound on each cleanup step before it is cancelled. */
export const WORLD_CLEANUP_LIMIT = 180;
export const WORLD_LAUNCH_WAIT_LIMIT = WORLD_CLEANUP_LIMIT * 2 + 30;
/** Seconds a cancelled step gets to stop on its own before it is stopped at its next yield. */
export const WORLD_CANCEL_GRACE = 5;

interface ActiveCleanup { token: { cancelled: boolean }; coordinator?: IsolatedWork; step?: IsolatedWork; released: boolean }

export class WorldLifecycle {
	private pending = 0;
	private closing = false;
	private readonly active: ActiveCleanup[] = [];
	public constructor(private readonly scheduler: LifecycleScheduler, private readonly limitSeconds = WORLD_CLEANUP_LIMIT) {}
	/** No cleanup is pending: a world may be built now. */
	public Idle(): boolean { return this.pending === 0; }
	public Pending(): number { return this.pending; }
	public Closing(): boolean { return this.closing; }
	/** Starts a world's cleanup in its own threads and returns at once. Skipped while the server is closing. */
	public Cleanup(job: WorldCleanup): void {
		this.reap();
		if (this.closing) return;
		const scheduler = this.scheduler, limit = this.limitSeconds;
		const entry: ActiveCleanup = { token: { cancelled: false }, released: false };
		const cancelled = () => entry.token.cancelled || this.closing;
		const waitFor = (ended: () => boolean, seconds: number): boolean => {
			const deadline = scheduler.now() + seconds;
			while (!ended() && scheduler.now() < deadline) scheduler.wait();
			return ended();
		};
		// Runs one isolated step; an overrun is cancelled, and this returns only once the step has stopped.
		const step = (name: string, work: () => void) => {
			const isolated = scheduler.isolate(work);
			entry.step = isolated;
			if (waitFor(() => isolated.ended(), limit)) return;
			scheduler.warn(`${name} still running after ${limit} s; cancelling`);
			entry.token.cancelled = true;
			if (waitFor(() => isolated.ended(), WORLD_CANCEL_GRACE)) return;
			isolated.cancel();
			if (waitFor(() => isolated.ended(), WORLD_CANCEL_GRACE)) return;
			scheduler.warn(`${name} has not stopped; the world gate stays closed until it does`);
			while (!isolated.ended()) scheduler.wait();
		};
		this.pending += 1;
		this.active.push(entry);
		entry.coordinator = scheduler.isolate(() => {
			const [ok, err] = pcall(() => {
				const start = scheduler.now();
				while (!cancelled() && scheduler.now() < start + (job.delaySeconds ?? 0)) scheduler.wait();
				if (this.closing) return;
				step("world clear", () => job.clear(cancelled));
				if (this.closing) return;
				step("menu restore", () => job.restore());
			});
			if (!ok) scheduler.warn(`world cleanup failed: ${tostring(err)}`);
			this.release(entry);
		});
	}
	/** Yields until every pending cleanup has completed. False if the bound passed first (refuse the launch). */
	public AwaitIdle(limitSeconds = this.limitSeconds * 2 + 30): boolean {
		const deadline = this.scheduler.now() + limitSeconds;
		while (!this.Idle() && this.scheduler.now() < deadline) {
			this.reap();
			if (this.Idle()) break;
			this.scheduler.wait();
		}
		return this.Idle();
	}
	/** Server shutdown: cancel running cleanups (their clears stop at the next check) and skip any new ones. */
	public Close(): void {
		this.closing = true;
		for (const entry of this.active) entry.token.cancelled = true;
	}
	private release(entry: ActiveCleanup): void {
		if (entry.released) return;
		entry.released = true;
		this.pending -= 1;
		const index = this.active.indexOf(entry);
		if (index >= 0) this.active.remove(index);
	}
	/** A coordinator killed without releasing frees the gate here, but only once its step has also stopped. */
	private reap(): void {
		for (const entry of [...this.active]) {
			if (entry.released || entry.coordinator === undefined || !entry.coordinator.ended()) continue;
			if (entry.step !== undefined && !entry.step.ended()) { entry.token.cancelled = true; entry.step.cancel(); continue; }
			this.release(entry);
		}
	}
}

/** What a launch does once it has waited for the world gate. */
export type LaunchSlot = { kind: "build" } | { kind: "refuse"; message: string; restoreMenu: boolean };
export interface LaunchSlotEnvironment {
	playerPresent: () => boolean;
	sessions: () => number;
	/** Tell the client its launch is queued (the request stays open). */
	queued: () => void;
}
/**
 * The launch queue policy: wait for the previous world's cleanup, then build, or refuse when the wait bound
 * passed or the player left meanwhile. A refused launch asks for the menu to be rebuilt, because the cleanup
 * it waited on skips the menu while a launch is pending.
 */
export function awaitLaunchSlot(gate: Pick<WorldLifecycle, "Idle" | "AwaitIdle">, env: LaunchSlotEnvironment, limitSeconds?: number): LaunchSlot {
	if (!gate.Idle()) { env.queued(); gate.AwaitIdle(limitSeconds); }
	if (!gate.Idle()) return { kind: "refuse", message: "The previous sortie is still being cleared. Please retry.", restoreMenu: true };
	if (!env.playerPresent()) return { kind: "refuse", message: "Player is unavailable", restoreMenu: env.sessions() === 0 };
	if (env.sessions() > 0) return { kind: "refuse", message: "This mission world is single-player", restoreMenu: false };
	return { kind: "build" };
}
