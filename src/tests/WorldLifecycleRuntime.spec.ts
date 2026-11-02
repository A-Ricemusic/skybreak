import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { registerWorldClear, robloxScheduler, worldClear } from "../server/WorldLifecycleRuntime";
import { IsolatedWork, LifecycleScheduler, WorldLifecycle } from "../shared/WorldLifecycle";

const LIMIT_SECONDS = 5;
const work: IsolatedWork[] = [];
const registrations: (() => void)[] = [];
const gates: WorldLifecycle[] = [];
// Track nested clear/coordinator threads too, so failed assertions cannot leave work behind.
const scheduler: LifecycleScheduler = {
	...robloxScheduler,
	isolate(callback) {
		const handle = robloxScheduler.isolate(callback);
		work.push(handle);
		return handle;
	},
};
afterEach(() => {
	for (const gate of gates) gate.Close();
	for (const handle of work) handle.cancel();
	for (let i = registrations.size() - 1; i >= 0; i--) registrations[i]();
	gates.clear(); work.clear(); registrations.clear();
});
// Every polling wait has a wall-clock bound; finite frame loops below have fixed iteration counts.
function waitUntil(label: string, check: () => boolean): void {
	const deadline = os.clock() + LIMIT_SECONDS;
	while (!check() && os.clock() < deadline) task.wait();
	assert(check(), `WorldLifecycleRuntime timed out: ${label}`);
}

// Studio only: the real task-library scheduler behind the server's world gate.
describe("World lifecycle runtime (Studio)", () => {
	it("isolates work in deferred threads that report ending, including errors and cancellation", () => {
		let steps = 0, cancelledSteps = 0;
		const yielding = scheduler.isolate(() => { for (let i = 0; i < 3; i++) { task.wait(); steps++; } });
		const failing = scheduler.isolate(() => error("expected test failure"));
		const endless = scheduler.isolate(() => { for (const deadline = os.clock() + LIMIT_SECONDS; os.clock() < deadline;) { task.wait(); cancelledSteps++; } });
		expect(yielding.ended()).toBe(false);
		waitUntil("yielding and failing steps", () => yielding.ended() && failing.ended());
		expect(yielding.ended()).toBe(true); expect(steps).toBe(3); expect(failing.ended()).toBe(true);
		endless.cancel();
		expect(endless.ended()).toBe(true);
		const frozen = cancelledSteps;
		for (let i = 0; i < 3; i++) task.wait();
		expect(endless.ended()).toBe(true); expect(cancelledSteps).toBe(frozen);
	});
	it("holds a launch until a yielding clear and the restore finish", () => {
		const gate = new WorldLifecycle(scheduler, LIMIT_SECONDS), log: string[] = [];
		gates.push(gate);
		gate.Cleanup({ clear: () => { for (let i = 0; i < 5; i++) task.wait(); log.push("clear"); }, restore: () => log.push("restore"), delaySeconds: 0.1 });
		expect(gate.Idle()).toBe(false);
		expect(gate.AwaitIdle(LIMIT_SECONDS)).toBe(true);
		log.push("launch");
		expect(log).toEqual(["clear", "restore", "launch"]);
	});
	it("uses a registered per-world clear and falls back to the native clear", () => {
		let used = false;
		registrations.push(registerWorldClear("lifecycle_test_world", () => { used = true; }));
		worldClear("lifecycle_test_world")(() => false);
		expect(used).toBe(true);
		expect(worldClear("no_such_world")).never.toBe(worldClear("lifecycle_test_world"));
		expect(typeIs(worldClear(undefined), "function")).toBe(true);
		const original = worldClear("lifecycle_test_world");
		const unregister = registerWorldClear("lifecycle_test_world", () => undefined);
		registrations.push(unregister);
		expect(worldClear("lifecycle_test_world")).never.toBe(original);
		unregister();
		expect(worldClear("lifecycle_test_world")).toBe(original);
	});
});
