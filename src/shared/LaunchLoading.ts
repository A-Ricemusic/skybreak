/** Client launch lifetime. RPC acceptance is not readiness: keep inputs locked until Started. */
export type LaunchPhase = "idle" | "building" | "queued" | "preloading";
export class LaunchLoading {
	private phase: LaunchPhase = "idle";
	private screen: "briefing" | "loading" | "mission" = "briefing";
	public Screen(): "briefing" | "loading" | "mission" { return this.screen; }
	public Phase(): LaunchPhase { return this.phase; }
	public Pending(): boolean { return this.phase !== "idle"; }
	public Begin(): boolean {
		if (this.Pending()) return false;
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
	public Fail(): void { this.phase = "idle"; this.screen = "briefing"; }
}
