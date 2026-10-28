import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04RadioQueue } from "../shared/ac04/AC04Radio";
describe("AC04 phase radio scheduling", () => {
	it("cancels old dialogue when the phase changes or the sortie ends", () => {
		const queue = new AC04RadioQueue();
		queue.SetScope("primary", ["first", "stale"]); expect(queue.Tick(0)).toBe("first");
		queue.SetScope("update", ["new phase"]); expect(queue.Tick(0)).toBe("new phase");
		queue.Clear(); queue.Add(["late callback"]); expect(queue.Tick(100)).toBeUndefined();
	});
	it("priority events interrupt the hold and supersede ambient lines", () => {
		const queue = new AC04RadioQueue();
		queue.SetScope("primary", ["ambient", "obsolete"]); queue.Tick(0);
		queue.Add(["urgent", "follow up"], true); expect(queue.Tick(0)).toBe("urgent");
		expect(queue.Tick(100)).toBe("follow up"); expect(queue.Tick(100)).toBeUndefined();
	});
	it("zero simulation time preserves the hold while paused", () => {
		const queue = new AC04RadioQueue(); queue.SetScope("primary", ["first", "second"]);
		expect(queue.Tick(0)).toBe("first"); expect(queue.Tick(0)).toBeUndefined();
		expect(queue.Tick(3)).toBeUndefined(); expect(queue.Tick(0)).toBeUndefined();
		expect(queue.Tick(1)).toBe("second");
	});
	it("large elapsed intervals dispatch one line without skipping pending speech", () => {
		const queue = new AC04RadioQueue(); queue.SetScope("primary", ["one", "two", "three"]);
		expect(queue.Tick(100)).toBe("one"); expect(queue.Waiting()).toBe(2);
		expect(queue.Tick(100)).toBe("two"); expect(queue.Tick(0)).toBeUndefined();
		expect(queue.Tick(100)).toBe("three");
	});
});
