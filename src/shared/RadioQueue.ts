// Radio lines arrive from the server as fast as phase beats and chatter fire;
// two in the same step used to overwrite each other. The queue shows each line
// for at least RADIO_MIN_SECONDS before the next one may replace it, and keeps
// at most RADIO_MAX_QUEUED waiting (the oldest waiting line is dropped first).
// Time is injected so the rules are testable without a clock.

export const RADIO_MIN_SECONDS = 2.5;
export const RADIO_MAX_QUEUED = 3;
/** Hold used when the server does not say how long a line should stay up. */
export const RADIO_DEFAULT_SECONDS = 4.5;

export interface RadioLine {
	text: string;
	/** Seconds the server asked the line to stay up. */
	seconds: number;
	/** When the line became visible (undefined while waiting). */
	shownAt?: number;
}

export class RadioQueue {
	private current?: RadioLine;
	private readonly waiting: RadioLine[] = [];

	/** Adds a line; it shows at once if the current one has had its minimum time. */
	public Push(text: string, seconds: number | undefined, now: number): void {
		const hold = typeIs(seconds, "number") && seconds === seconds ? math.clamp(seconds, RADIO_MIN_SECONDS, 10) : RADIO_DEFAULT_SECONDS;
		this.waiting.push({ text, seconds: hold });
		while (this.waiting.size() > RADIO_MAX_QUEUED) this.waiting.shift();
		this.advance(now);
	}

	/** The line to show at `now`, or undefined when the radio is quiet. */
	public Current(now: number): RadioLine | undefined {
		this.advance(now);
		return this.current;
	}

	/** Lines still waiting behind the visible one. */
	public Waiting(): number {
		return this.waiting.size();
	}

	/** Earliest time the visible line changes (for scheduling a re-render), or undefined when idle. */
	public NextChange(now: number): number | undefined {
		this.advance(now);
		const line = this.current;
		if (!line || line.shownAt === undefined) return undefined;
		return line.shownAt + (this.waiting.size() > 0 ? RADIO_MIN_SECONDS : line.seconds);
	}

	public Clear(): void {
		this.current = undefined;
		this.waiting.clear();
	}

	private advance(now: number): void {
		for (let guard = 0; guard <= RADIO_MAX_QUEUED + 1; guard++) {
			const line = this.current;
			if (line && line.shownAt !== undefined) {
				const age = now - line.shownAt;
				// A waiting line takes over after the minimum; otherwise the line keeps its full hold.
				const expired = this.waiting.size() > 0 ? age >= RADIO_MIN_SECONDS : age >= line.seconds;
				if (!expired) return;
				const endsAt = line.shownAt + (this.waiting.size() > 0 ? RADIO_MIN_SECONDS : line.seconds);
				this.current = undefined;
				const upcoming = this.waiting.shift();
				if (!upcoming) return;
				// Back-to-back lines start when the previous one ended, not when the HUD looked.
				upcoming.shownAt = math.max(endsAt, now - upcoming.seconds);
				this.current = upcoming;
				continue;
			}
			const upcoming = this.waiting.shift();
			if (!upcoming) return;
			upcoming.shownAt = now;
			this.current = upcoming;
			return;
		}
	}
}
