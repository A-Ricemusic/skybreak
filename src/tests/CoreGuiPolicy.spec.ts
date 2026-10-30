import { describe, expect, it } from "@rbxts/jest-globals";
import { CoreGuiPolicy, CoreGuiTarget } from "../shared/CoreGuiPolicy";

interface Fake extends CoreGuiTarget { guis: Map<Enum.CoreGuiType, boolean>; cores: Map<string, unknown>; failUntilCall: number; calls: number }
function fake(failUntilCall = 0): Fake {
	const target: Fake = {
		guis: new Map(), cores: new Map(), failUntilCall, calls: 0,
		SetCoreGuiEnabled(kind, enabled) {
			target.calls++;
			if (target.calls <= target.failUntilCall) error("CoreGui not ready");
			target.guis.set(kind, enabled);
		},
		SetCore(parameter, value) {
			target.calls++;
			if (target.calls <= target.failUntilCall) error(`SetCore: ${parameter} has not been registered by the CoreScripts`);
			target.cores.set(parameter, value);
		},
	};
	return target;
}

describe("CoreGuiPolicy", () => {
	it("hides the health bar and damage flash, the backpack and the reset button on the first attempt", () => {
		const target = fake();
		const waits: number[] = [];
		const result = CoreGuiPolicy.Apply(target, (seconds) => waits.push(seconds));
		expect(result.complete).toBe(true);
		expect(result.attempts).toBe(1);
		expect(result.resetButton).toBe(true);
		expect(CoreGuiPolicy.Hidden).toContain(Enum.CoreGuiType.Health);
		expect(CoreGuiPolicy.Hidden).toContain(Enum.CoreGuiType.Backpack);
		for (const kind of CoreGuiPolicy.Hidden) {
			expect(result.hidden.has(kind)).toBe(true);
			expect(target.guis.get(kind)).toBe(false);
		}
		expect(target.cores.get("ResetButtonCallback")).toBe(false);
		expect(waits.size()).toBe(0);
	});
	it("retries each call until the CoreScripts are ready, waiting between attempts", () => {
		const target = fake(4); // first attempt fails all three; the second attempt's first call fails too
		const waits: number[] = [];
		const result = CoreGuiPolicy.Apply(target, (seconds) => waits.push(seconds));
		expect(result.complete).toBe(true);
		expect(result.attempts).toBe(3);
		expect(waits).toEqual([CoreGuiPolicy.RetrySeconds, CoreGuiPolicy.RetrySeconds]);
		expect(target.guis.get(Enum.CoreGuiType.Health)).toBe(false);
		expect(target.guis.get(Enum.CoreGuiType.Backpack)).toBe(false);
	});
	it("gives up after the attempt budget and reports what is still showing", () => {
		const target = fake(math.huge);
		let waited = 0;
		const result = CoreGuiPolicy.Apply(target, () => waited++);
		expect(result.complete).toBe(false);
		expect(result.attempts).toBe(CoreGuiPolicy.Attempts);
		expect(waited).toBe(CoreGuiPolicy.Attempts - 1);
		expect(result.hidden.size()).toBe(0);
		expect(result.resetButton).toBe(false);
	});
});
