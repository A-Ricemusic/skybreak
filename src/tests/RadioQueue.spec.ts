import { describe, expect, it } from "@rbxts/jest-globals";
import { RADIO_DEFAULT_SECONDS, RADIO_MAX_QUEUED, RADIO_MIN_SECONDS, RadioQueue } from "../shared/RadioQueue";
import { VOICE_STALE_SECONDS, VOICE_TAIL } from "../shared/VoiceLines";

describe("radio line queue", () => {
	it("shows a line at once and holds it for its full time when nothing waits", () => {
		const queue = new RadioQueue();
		queue.Push("Bandits inbound", undefined, 10);
		expect(queue.Current(10)?.text).toBe("Bandits inbound");
		expect(queue.Current(10 + RADIO_DEFAULT_SECONDS - 0.01)?.text).toBe("Bandits inbound");
		expect(queue.Current(10 + RADIO_DEFAULT_SECONDS)).toBeUndefined();
	});
	it("never lets a second line in the same step overwrite the first before 2.5 s", () => {
		expect(RADIO_MIN_SECONDS).toBe(2.5);
		const queue = new RadioQueue();
		queue.Push("Phase beat", 6, 0);
		queue.Push("Reinforcement chatter", 4, 0);
		expect(queue.Current(0)?.text).toBe("Phase beat");
		expect(queue.Current(2.49)?.text).toBe("Phase beat");
		expect(queue.Waiting()).toBe(1);
		expect(queue.NextChange(1)).toBe(2.5);
		expect(queue.Current(2.5)?.text).toBe("Reinforcement chatter");
		// The follower keeps its own full hold from when it appeared.
		expect(queue.Current(6.49)?.text).toBe("Reinforcement chatter");
		expect(queue.Current(6.5)).toBeUndefined();
	});
	it("replaces a line that has had its minimum at once", () => {
		const queue = new RadioQueue();
		queue.Push("Old", 8, 0);
		queue.Push("New", 4, 3);
		expect(queue.Current(3)?.text).toBe("New");
	});
	it("keeps at most three waiting, dropping the oldest waiting line", () => {
		expect(RADIO_MAX_QUEUED).toBe(3);
		const queue = new RadioQueue();
		for (const text of ["A", "B", "C", "D", "E"]) queue.Push(text, 4, 0);
		expect(queue.Current(0)?.text).toBe("A");
		expect(queue.Waiting()).toBe(3);
		expect(queue.Current(2.5)?.text).toBe("C");
		expect(queue.Current(5)?.text).toBe("D");
		expect(queue.Current(7.5)?.text).toBe("E");
	});
	it("replays the timeline correctly when the HUD looks late", () => {
		const queue = new RadioQueue();
		queue.Push("A", 4, 0);
		queue.Push("B", 4, 0);
		queue.Push("C", 3, 0);
		// A ends at 2.5, B at 5.0, C shows 5.0–8.0.
		expect(queue.Current(5.5)?.text).toBe("C");
		expect(queue.Current(8.1)).toBeUndefined();
		queue.Clear();
		expect(queue.Current(9)).toBeUndefined();
		expect(queue.Waiting()).toBe(0);
	});
	it("clamps a very short server hold up to the minimum", () => {
		const queue = new RadioQueue();
		queue.Push("Short", 0.5, 0);
		expect(queue.Current(2.4)?.text).toBe("Short");
		expect(queue.Current(2.5)).toBeUndefined();
	});
	it("holds a voiced line until its voice and tail end, even with lines waiting, so voices never overlap", () => {
		const queue = new RadioQueue();
		queue.Push("SERA: A long voiced line.", 3, 0, 5.2);
		queue.Push("SERA: The next one.", 4, 2, 2);
		expect(queue.Current(0)?.voice).toBe(5.2);
		expect(queue.Current(2.5)?.text).toBe("SERA: A long voiced line.");
		expect(queue.Current(5.2 + VOICE_TAIL - 0.01)?.text).toBe("SERA: A long voiced line.");
		expect(queue.NextChange(2)).toBeCloseTo(5.2 + VOICE_TAIL, 5);
		const follower = queue.Current(5.2 + VOICE_TAIL);
		expect(follower?.text).toBe("SERA: The next one.");
		expect(follower?.voice).toBe(2);
		// The subtitle stays up at least as long as the voice plays.
		expect(follower?.seconds).toBe(4);
	});
	it("keeps a voiced subtitle up past a short server hold", () => {
		const queue = new RadioQueue();
		queue.Push("SERA: Voiced.", 2.5, 10, 4.6);
		expect(queue.Current(10 + 4.6 + VOICE_TAIL - 0.01)?.text).toBe("SERA: Voiced.");
		expect(queue.Current(10 + 4.6 + VOICE_TAIL)).toBeUndefined();
	});
	it("drops a voice that waited too long but still shows its subtitle with normal timing", () => {
		expect(VOICE_STALE_SECONDS).toBe(4);
		const queue = new RadioQueue();
		queue.Push("SERA: First.", 6, 0, 5);
		queue.Push("Silent line", 4, 0);
		queue.Push("SERA: Stale by the time it plays.", 4, 0, 3);
		expect(queue.Current(5.4)?.text).toBe("Silent line");
		const stale = queue.Current(5.4 + RADIO_MIN_SECONDS);
		expect(stale?.text).toBe("SERA: Stale by the time it plays.");
		expect(stale?.voice).toBeUndefined();
	});
	it("starts a voiced line when it really plays, not back-dated to when the HUD last looked", () => {
		const queue = new RadioQueue();
		queue.Push("A", 3, 0);
		queue.Push("SERA: Voiced.", 3, 1, 2);
		expect(queue.Current(2.6)?.shownAt).toBe(2.6);
	});
});
