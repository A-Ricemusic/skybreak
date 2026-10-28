/** Server-side narrative scheduler. Caller advances only active simulation time.
 * Every scope change cancels the old phase's pending lines and hold time.
 * Tick returns a newly dispatched subtitle only, never a repeated current line.
 */
export class AC04RadioQueue {
	private scope?: string;
	private pending: string[] = [];
	private remaining = 0;
	public SetScope(scope: string, lines: string[] = []): void {
		this.Clear();
		this.scope = scope;
		this.Add(lines);
	}
	/** A safety/event interruption supersedes stale ambient conversation. */
	public Add(lines: string[], priority = false): void {
		if (this.scope === undefined) return;
		if (priority) { this.pending.clear(); this.remaining = 0; }
		for (const line of lines) if (line.size() > 0) this.pending.push(line);
		// Defensive cap; authored phases contain only a handful of lines.
		while (this.pending.size() > 16) this.pending.shift();
	}
	public Tick(dt: number): string | undefined {
		if (this.scope === undefined) return undefined;
		if (dt === dt && dt > 0) this.remaining -= dt;
		if (this.remaining > 0) return undefined;
		const line = this.pending.shift();
		if (line === undefined) return undefined;
		// Never skip queued text to catch up after a delayed server heartbeat.
		this.remaining = math.clamp(line.size() / 17 + 1, 4, 14);
		return line;
	}
	public Clear(): void { this.scope = undefined; this.pending.clear(); this.remaining = 0; }
	public Waiting(): number { return this.pending.size(); }
}
