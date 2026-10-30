import { WORLD_LAUNCH_WAIT_LIMIT } from "./WorldLifecycle";

/** Full cleanup queue bound plus two minutes for world construction (M03 measured up to 88 s). */
export const LAUNCH_REQUEST_TIMEOUT = WORLD_LAUNCH_WAIT_LIMIT + 120;

/** Client launch lifetime. RPC acceptance is not readiness: keep inputs locked until Started. */
export type LaunchPhase = "idle" | "building" | "queued" | "preloading";
export class LaunchLoading {
	private generation = 0;
	private deadline = 0;
	public Generation(): number { return this.generation; }
	public Current(generation: unknown): boolean { return generation === this.generation; }
	/** Called by the client timer; it must not expire the separate preload/Ready stage. */
	public Watchdog(generation: number, now: number): boolean {
		if (!this.Current(generation) || (this.phase !== "building" && this.phase !== "queued") || now < this.deadline) return false;
		this.Fail();
		return true;
	}
	private phase: LaunchPhase = "idle";
	private screen: "briefing" | "loading" | "mission" = "briefing";
	public Screen(): "briefing" | "loading" | "mission" { return this.screen; }
	public Phase(): LaunchPhase { return this.phase; }
	public Pending(): boolean { return this.phase !== "idle"; }
	public Begin(now = 0): boolean {
		if (this.Pending()) return false;
		this.generation++;
		this.deadline = now + LAUNCH_REQUEST_TIMEOUT;
		this.phase = "building";
		this.screen = "loading";
		return true;
	}
	public Queued(): void { if (this.phase === "building") this.phase = "queued"; }
	public Building(): void { if (this.phase === "queued") this.phase = "building"; }
	public Preload(): boolean {
		if (this.phase !== "building" && this.phase !== "queued") return false;
		this.phase = "preloading";
		return true;
	}
	public Started(): boolean {
		if (this.phase !== "preloading") return false;
		this.phase = "idle";
		this.screen = "mission";
		return true;
	}
	public Fail(): void { this.generation++; this.phase = "idle"; this.screen = "briefing"; }
}

/** Cancellation tombstone survives a missing/stalled RPC and cannot cancel a newer generation. */
export class LaunchCancellation {
	private through = 0;
	public Cancel(generation: number): void { this.through = math.max(this.through, generation); }
	public Cancelled(generation: number | undefined): boolean { return generation !== undefined && generation <= this.through; }
}
