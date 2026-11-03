import { CampaignCoordinator } from "./CampaignRepository";

/** First background retry after a failed PlayerRemoving flush. */
export const SHUTDOWN_RETRY_INITIAL = 15;
/** Exponential backoff ceiling between background retries. */
export const SHUTDOWN_RETRY_CAP = 120;
/** Stop background retries this long after the first failure; BindToClose still owns the profile. */
export const SHUTDOWN_RETRY_GIVE_UP = 1800;

interface ClosingProfile {
	readonly loaded: () => boolean;
	interval: number;
	firstFailure?: number;
	retryAt?: number;
	abandoned: boolean;
}

/** Closing profiles outlive active players, including a timed-out PlayerRemoving flush. */
export class CampaignShutdown {
	private readonly closing = new Map<CampaignCoordinator, ClosingProfile>();

	public constructor(
		private readonly clock: () => number = os.clock,
		private readonly wait: () => void = () => {
			task.wait(0.05);
		},
		private readonly logWarning: (message: string) => void = warn,
	) {}

	public track(coordinator: CampaignCoordinator, loaded: () => boolean): void {
		this.closing.set(coordinator, { loaded, interval: SHUTDOWN_RETRY_INITIAL, abandoned: false });
	}

	/** A false flush is retained for BindToClose, never treated as a completed close. */
	public flushPlayer(coordinator: CampaignCoordinator, seconds = 5): boolean {
		return this.attempt(coordinator, seconds);
	}

	public pending(): number {
		return this.closing.size();
	}

	/** Background pass: retry every tracked profile whose backoff has elapsed. Returns the number of attempts. */
	public retry(now = this.clock()): number {
		let attempted = 0;
		for (const [coordinator, entry] of this.closing) {
			if (entry.abandoned || entry.retryAt === undefined || now < entry.retryAt) continue;
			attempted++;
			entry.retryAt = undefined;
			this.attempt(coordinator, 0);
		}
		return attempted;
	}

	/** Poll all writers together; one slow/failed profile cannot consume another's write window. */
	public awaitDeadline(deadline: number): boolean {
		while (this.closing.size() > 0) {
			for (const [coordinator] of this.closing) this.flushPlayer(coordinator, 0);
			if (this.closing.size() === 0) return true;
			if (this.clock() >= deadline) return false;
			this.wait();
		}
		return true;
	}

	private attempt(coordinator: CampaignCoordinator, seconds: number): boolean {
		const entry = this.closing.get(coordinator);
		if (!entry) return true;
		if (entry.loaded() && coordinator.flush(seconds)) {
			this.closing.delete(coordinator);
			return true;
		}
		// Only the first failure and the retry pass itself arm the backoff; BindToClose polling leaves it alone.
		// Measured from when the flush gave up, not when it started.
		if (entry.retryAt === undefined) this.arm(entry, this.clock());
		return false;
	}

	private arm(entry: ClosingProfile, now: number): void {
		if (entry.abandoned) return;
		entry.firstFailure ??= now;
		if (now - entry.firstFailure >= SHUTDOWN_RETRY_GIVE_UP) {
			entry.abandoned = true;
			this.logWarning(
				"SKYBREAK gave up background retries for a departed player's campaign save; retained for server shutdown",
			);
			return;
		}
		entry.retryAt = now + entry.interval;
		entry.interval = math.min(entry.interval * 2, SHUTDOWN_RETRY_CAP);
	}
}
