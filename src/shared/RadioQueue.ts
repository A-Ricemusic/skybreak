// Radio lines arrive from the server as fast as phase beats and chatter fire;
// two in the same step used to overwrite each other. The queue shows each line
// for at least RADIO_MIN_SECONDS before the next one may replace it, and keeps
// at most RADIO_MAX_QUEUED waiting (the oldest waiting line is dropped first).
// Time is injected so the rules are testable without a clock.
//
// A voiced line holds until its voice has finished (plus a short tail), even
// when others wait, so two voices never overlap and the subtitle never leaves
// before the speaker does. A voice that waited longer than VOICE_STALE_SECONDS
// is dropped and its line shows silently with the normal timing.
import { VOICE_STALE_SECONDS, VOICE_TAIL } from "./VoiceLines";

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
	/** Seconds of voice still to play with this line; undefined when silent or dropped as stale. */
	voice?: number;
	/** When the line was pushed. */
	queuedAt: number;
}

export class RadioQueue {
	private current?: RadioLine;
	private readonly waiting: RadioLine[] = [];

	/** Adds a line (with its voice length when it is voiced); it shows at once if the current one has had its minimum time. */
	public Push(text: string, seconds: number | undefined, now: number, voice?: number): void {
		const hold = typeIs(seconds, "number") && seconds === seconds ? math.clamp(seconds, RADIO_MIN_SECONDS, 10) : RADIO_DEFAULT_SECONDS;
		const voiced = typeIs(voice, "number") && voice > 0 && voice < 60 ? voice : undefined;
		this.waiting.push({ text, seconds: hold, voice: voiced, queuedAt: now });
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
		return line.shownAt + (this.waiting.size() > 0 ? minimum(line) : line.seconds);
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
				const expired = this.waiting.size() > 0 ? age >= minimum(line) : age >= line.seconds;
				if (!expired) return;
				const endsAt = line.shownAt + (this.waiting.size() > 0 ? minimum(line) : line.seconds);
				this.current = undefined;
				const upcoming = this.waiting.shift();
				if (!upcoming) return;
				// Back-to-back lines start when the previous one ended, not when the HUD looked.
				show(upcoming, math.max(endsAt, now - upcoming.seconds), now);
				this.current = upcoming;
				continue;
			}
			const upcoming = this.waiting.shift();
			if (!upcoming) return;
			show(upcoming, now, now);
			this.current = upcoming;
			return;
		}
	}
}

/** Shortest time a line stays up while others wait: a voiced line keeps its voice and tail. */
function minimum(line: RadioLine): number {
	return line.voice !== undefined ? math.max(RADIO_MIN_SECONDS, line.voice + VOICE_TAIL) : RADIO_MIN_SECONDS;
}

/** Makes a line visible. A voice starts when it really plays (now), or is dropped once stale. */
function show(line: RadioLine, at: number, now: number): void {
	if (line.voice !== undefined && now - line.queuedAt > VOICE_STALE_SECONDS) line.voice = undefined;
	if (line.voice === undefined) {
		line.shownAt = at;
		return;
	}
	line.shownAt = now;
	line.seconds = math.max(line.seconds, line.voice + VOICE_TAIL);
}
