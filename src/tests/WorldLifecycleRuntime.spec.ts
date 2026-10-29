import { describe, expect, it } from "@rbxts/jest-globals";
import { registerWorldClear, robloxScheduler, worldClear } from "../server/WorldLifecycleRuntime";
import { WorldLifecycle } from "../shared/WorldLifecycle";

// Studio only: the real task-library scheduler behind the server's world gate.
describe("World lifecycle runtime (Studio)", () => {
	it("isolates work in deferred threads that report ending, including errors", () => {
		let steps = 0;
		const yielding = robloxScheduler.isolate(() => { for (let i = 0; i < 3; i++) { task.wait(); steps++; } });
		const failing = robloxScheduler.isolate(() => error("expected test failure"));
		expect(yielding()).toBe(false);
		for (let i = 0; i < 10 && !yielding(); i++) task.wait();
		expect(yielding()).toBe(true); expect(steps).toBe(3); expect(failing()).toBe(true);
	});
	it("holds a launch until a yielding clear and the restore finish", () => {
		const gate = new WorldLifecycle(robloxScheduler, 20), log: string[] = [];
		gate.Cleanup({ clear: () => { for (let i = 0; i < 5; i++) task.wait(); log.push("clear"); }, restore: () => log.push("restore"), delaySeconds: 0.1 });
		expect(gate.Idle()).toBe(false);
		expect(gate.AwaitIdle(10)).toBe(true);
		log.push("launch");
		expect(log).toEqual(["clear", "restore", "launch"]);
	});
	it("uses a registered per-world clear and falls back to Terrain:Clear", () => {
		let used = false;
		registerWorldClear("lifecycle_test_world", () => { used = true; });
		worldClear("lifecycle_test_world")();
		expect(used).toBe(true);
		expect(worldClear("no_such_world")).never.toBe(worldClear("lifecycle_test_world"));
		expect(typeIs(worldClear(undefined), "function")).toBe(true);
	});
});
