import { describe, expect, it } from "@rbxts/jest-globals";
import { RADIO_DEFAULT_SECONDS, RADIO_MAX_QUEUED, RADIO_MIN_SECONDS, RadioQueue } from "../shared/RadioQueue";

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
});
