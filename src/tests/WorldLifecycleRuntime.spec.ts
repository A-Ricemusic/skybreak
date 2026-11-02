import { boundedWorldWork } from "./BoundedWorldWork";
import { destroyWorld } from "../server/WorldDisposal";
import { TerrainWriter } from "../server/TerrainWriter";
import { Workspace } from "@rbxts/services";
import { beginTerrainWrite, clearTerrainIfDirty, terrainDirty } from "../server/TerrainState";
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

// Cooperative cleanup remains covered alongside main's bounded gate fixtures.
describe("Cooperative world cleanup", () => {
 afterEach(() => boundedWorldWork("cleanup regression teardown", () => { destroyWorld(); clearTerrainIfDirty(); }, 5), 7000);
	it("retains an interrupted instance tree and drains it on retry", () => {
		const root = new Instance("Folder"); root.Parent = Workspace;
		for (let i = 0; i < 256; i++) { const part = new Instance("Part"); part.Anchored = true; part.Parent = root; }
		let visits = 0;
		destroyWorld(root, () => ++visits > 64);
		expect(root.Parent).toBe(Workspace);
		expect(root.GetChildren().size()).toBeGreaterThan(0);
		expect(root.GetChildren().size()).toBeLessThan(256);
		destroyWorld();
		expect(root.Parent).toBeUndefined();
		expect(root.GetChildren().size()).toBe(0);
	});
	it("resumes a cancelled terrain clear and leaves no tracked voxels behind", () => {
		const probe = (): number => {
			const [, occupancy] = Workspace.Terrain.ReadVoxels(new Region3(new Vector3(9000, 4000, 9000), new Vector3(9008, 4008, 9008)), 4);
			return occupancy[0][0][0];
		};
		beginTerrainWrite();
		TerrainWriter.Write([{shape:"block",material:"Rock",x:9004,y:4004,z:9004,sx:8,sy:8,sz:8,yaw:0}]);
		expect(terrainDirty()).toBe(true);
		clearTerrainIfDirty(()=>true);
		expect(terrainDirty()).toBe(true);
		expect(probe()).toBeGreaterThan(0);
		clearTerrainIfDirty();
		expect(terrainDirty()).toBe(false);
		expect(probe()).toBe(0);
	});
});
