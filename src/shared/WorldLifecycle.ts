/**
 * One mission world at a time. When a sortie ends, its world is cleared and the menu rebuilt in threads of
 * their own; a new launch waits (queued, not refused) until that cleanup has fully completed, so no world
 * is ever built on top of one still being cleared, and no expensive clear runs inside a launch.
 *
 * - Cleanup(job) returns at once: settlement and player release never wait on it.
 * - AwaitIdle() yields the launching thread until every pending cleanup is done (or a bound passes).
 * - The clear and the restore each run isolated, so a script-timeout kill or an error in one cannot strand
 *   the gate; every wait is bounded.
 * - Cleanup is not tied to any player: a player leaving during construction or cleanup still completes it.
 *
 * Pure: the scheduler is injected (Roblox task library on the server, a coroutine fake in tests).
 */
export interface LifecycleScheduler {
	/** Runs `work` in its own resumption; the probe reports true once it has ended (returned, thrown or been killed). */
	isolate(work: () => void): () => boolean;
	/** Yields the calling thread for about one frame. */
	wait(): void;
	/** Monotonic seconds. */
	now(): number;
	warn(message: string): void;
}
/** One world's teardown. `clear` may yield (chunked clears); `restore` rebuilds the menu world. */
export interface WorldCleanup {
	clear: () => void;
	restore: () => void;
	/** Seconds to wait before clearing, so a result already sent reaches the player before the clear stalls the server. */
	delaySeconds?: number;
}
/** Default bound on each cleanup step and on a launch's wait. */
export const WORLD_CLEANUP_LIMIT = 180;

export class WorldLifecycle {
	private pending = 0;
	private readonly coordinators: { ended: () => boolean; release: () => void }[] = [];
	public constructor(private readonly scheduler: LifecycleScheduler, private readonly limitSeconds = WORLD_CLEANUP_LIMIT) {}
	/** No cleanup is pending: a world may be built now. */
	public Idle(): boolean { return this.pending === 0; }
	public Pending(): number { return this.pending; }
	/** Starts a world's cleanup in its own threads and returns at once. */
	public Cleanup(job: WorldCleanup): void {
		this.reap();
		this.pending += 1;
		const scheduler = this.scheduler, limit = this.limitSeconds;
		const waitFor = (ended: () => boolean, seconds: number): boolean => {
			const deadline = scheduler.now() + seconds;
			while (!ended() && scheduler.now() < deadline) scheduler.wait();
			return ended();
		};
		let released = false;
		const release = () => { if (!released) { released = true; this.pending -= 1; } };
		const coordinator = scheduler.isolate(() => {
			const [ok, err] = pcall(() => {
				const start = scheduler.now();
				while (scheduler.now() < start + (job.delaySeconds ?? 0)) scheduler.wait();
				if (!waitFor(scheduler.isolate(job.clear), limit)) scheduler.warn(`world clear still running after ${limit} s; continuing`);
				if (!waitFor(scheduler.isolate(job.restore), limit)) scheduler.warn(`menu restore still running after ${limit} s; continuing`);
			});
			if (!ok) scheduler.warn(`world cleanup failed: ${tostring(err)}`);
			release();
		});
		// If the coordinator itself is ever killed, a launch's AwaitIdle still frees the gate (see below).
		this.coordinators.push({ ended: coordinator, release });
	}
	/** Yields until every pending cleanup has completed. False if the bound passed first (the launch should be refused). */
	public AwaitIdle(limitSeconds = this.limitSeconds * 2 + 10): boolean {
		const deadline = this.scheduler.now() + limitSeconds;
		while (!this.Idle() && this.scheduler.now() < deadline) {
			this.reap();
			if (this.Idle()) break;
			this.scheduler.wait();
		}
		return this.Idle();
	}
	/** A coordinator that ended without releasing (killed) releases here, so the gate can never stick. */
	private reap(): void {
		for (let i = this.coordinators.size() - 1; i >= 0; i--) {
			const c = this.coordinators[i];
			if (c.ended()) { c.release(); this.coordinators.remove(i); }
		}
	}
}
