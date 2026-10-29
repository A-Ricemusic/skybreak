import { describe, expect, it } from "@rbxts/jest-globals";
import { registerWorldClear, robloxScheduler, worldClear } from "../server/WorldLifecycleRuntime";
import { WorldLifecycle } from "../shared/WorldLifecycle";
import { clearM03World } from "../server/M03World";

// Studio only: the real task-library scheduler behind the server's world gate.
describe("World lifecycle runtime (Studio)", () => {
	it("isolates work in deferred threads that report ending, including errors and cancellation", () => {
		let steps = 0, cancelledSteps = 0;
		const yielding = robloxScheduler.isolate(() => { for (let i = 0; i < 3; i++) { task.wait(); steps++; } });
		const failing = robloxScheduler.isolate(() => error("expected test failure"));
		const endless = robloxScheduler.isolate(() => { for (;;) { task.wait(); cancelledSteps++; } });
		expect(yielding.ended()).toBe(false);
		for (let i = 0; i < 10 && !yielding.ended(); i++) task.wait();
		expect(yielding.ended()).toBe(true); expect(steps).toBe(3); expect(failing.ended()).toBe(true);
		endless.cancel();
		const frozen = cancelledSteps;
		for (let i = 0; i < 3; i++) task.wait();
		expect(endless.ended()).toBe(true); expect(cancelledSteps).toBe(frozen);
	});
	it("holds a launch until a yielding clear and the restore finish", () => {
		const gate = new WorldLifecycle(robloxScheduler, 20), log: string[] = [];
		gate.Cleanup({ clear: () => { for (let i = 0; i < 5; i++) task.wait(); log.push("clear"); }, restore: () => log.push("restore"), delaySeconds: 0.1 });
		expect(gate.Idle()).toBe(false);
		expect(gate.AwaitIdle(10)).toBe(true);
		log.push("launch");
		expect(log).toEqual(["clear", "restore", "launch"]);
	});
	it("uses a registered per-world clear, including mission 3's, and falls back to Terrain:Clear", () => {
		let used = false;
		registerWorldClear("lifecycle_test_world", () => { used = true; });
		worldClear("lifecycle_test_world")(() => false);
		expect(used).toBe(true);
		expect(worldClear("m03_snow_radar")).toBe(clearM03World);
		expect(worldClear("no_such_world")).never.toBe(clearM03World);
		expect(typeIs(worldClear(undefined), "function")).toBe(true);
	});
});
