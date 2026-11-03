import { CampaignCoordinator } from "./CampaignRepository";

/** Closing profiles outlive active players, including a timed-out PlayerRemoving flush. */
export class CampaignShutdown {
	private readonly closing = new Map<CampaignCoordinator, () => boolean>();

	public constructor(
		private readonly clock: () => number = os.clock,
		private readonly wait: () => void = () => {
			task.wait(0.05);
		},
	) {}

	public track(coordinator: CampaignCoordinator, loaded: () => boolean): void {
		this.closing.set(coordinator, loaded);
	}

	/** A false flush is retained for BindToClose, never treated as a completed close. */
	public flushPlayer(coordinator: CampaignCoordinator, seconds = 5): boolean {
		const loaded = this.closing.get(coordinator);
		if (!loaded) return true;
		if (!loaded() || !coordinator.flush(seconds)) return false;
		this.closing.delete(coordinator);
		return true;
	}

	public pending(): number {
		return this.closing.size();
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
}
