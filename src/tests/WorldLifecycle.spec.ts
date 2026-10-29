import { describe, expect, it } from "@rbxts/jest-globals";
import { awaitLaunchSlot, IsolatedWork, LaunchSlot, LifecycleScheduler, WORLD_CANCEL_GRACE, WorldLifecycle } from "../shared/WorldLifecycle";

/** Frame-stepped stand-in for the Roblox task library: isolate = task.defer, wait = one frame, cancel = task.cancel. */
class FakeScheduler implements LifecycleScheduler {
	public clock = 0;
	public threads: thread[] = [];
	public warnings: string[] = [];
	public isolate(work: () => void): IsolatedWork {
		let ended = false;
		const co = coroutine.create(() => {
			const [ok, err] = pcall(work);
			if (!ok) this.warnings.push(tostring(err));
			ended = true;
		});
		this.threads.push(co);
		return {
			ended: () => ended || coroutine.status(co) === "dead",
			cancel: () => { if (!ended && coroutine.status(co) === "suspended") { coroutine.close(co); ended = true; } },
		};
	}
	public wait(): void { coroutine.yield(); }
	public now(): number { return this.clock; }
	public warn(message: string): void { this.warnings.push(message); }
	/** One frame: advance the clock and resume every live thread once. */
	public tick(dt = 1 / 30): void {
		this.clock += dt;
		const live = this.threads;
		this.threads = [];
		for (const co of live) if (coroutine.status(co) === "suspended") {
			coroutine.resume(co);
			if (coroutine.status(co) === "suspended") this.threads.push(co);
		}
	}
	public run(frames: number): void { for (let i = 0; i < frames; i++) this.tick(); }
	public warned(text: string): boolean { return this.warnings.some((w) => w.find(text, 1, true)[0] !== undefined); }
}
/** A clear that yields for `frames` frames, checking its cancellation token at each yield. */
function longClear(fake: FakeScheduler, log: string[], frames: number) {
	return (cancelled: () => boolean) => {
		log.push("clear");
		for (let i = 0; i < frames; i++) { if (cancelled()) { log.push("clear cancelled"); return; } fake.wait(); }
		log.push("cleared");
	};
}
/** A launch through the real queue policy, as CombatService runs it. */
function launch(fake: FakeScheduler, gate: WorldLifecycle, log: string[], player: { present: boolean }, sessions = () => 0) {
	let result: LaunchSlot | undefined;
	fake.isolate(() => {
		result = awaitLaunchSlot(gate, { playerPresent: () => player.present, sessions, queued: () => log.push("queued") });
		log.push(result.kind === "build" ? "build" : `refused: ${result.message}`);
	});
	return () => result;
}

describe("World lifecycle gate (one world at a time)", () => {
	it("queues an immediate relaunch until the old world is cleared and the menu restored", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: longClear(fake, log, 300), restore: () => log.push("restore"), delaySeconds: 1 });
		const result = launch(fake, gate, log, { present: true });
		fake.run(200);
		expect(log).toEqual(["queued", "clear"]);
		fake.run(400);
		expect(result()).toEqual({ kind: "build" });
		expect(log).toEqual(["queued", "clear", "cleared", "restore", "build"]);
		expect(gate.Idle()).toBe(true);
	});
	it("never fires a stale clear or restore after the next world is built", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: longClear(fake, log, 60), restore: () => log.push("restore"), delaySeconds: 1 });
		launch(fake, gate, log, { present: true });
		fake.run(900);
		expect(log.indexOf("build")).toBe(log.size() - 1);
		expect(log.filter((e) => e === "clear").size()).toBe(1);
		expect(log.filter((e) => e === "restore").size()).toBe(1);
		expect(gate.Pending()).toBe(0);
	});
	it("refuses a queued launch whose player left during cleanup, finishes the cleanup and asks for the menu", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [], player = { present: true };
		gate.Cleanup({ clear: longClear(fake, log, 120), restore: () => log.push("restore"), delaySeconds: 1 });
		const result = launch(fake, gate, log, player);
		fake.run(60);
		player.present = false;
		fake.run(300);
		expect(log).toEqual(["queued", "clear", "cleared", "restore", "refused: Player is unavailable"]);
		expect(result()).toEqual({ kind: "refuse", message: "Player is unavailable", restoreMenu: true });
		expect(gate.Idle()).toBe(true);
	});
	it("clears a world abandoned during construction before the next launch builds", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		fake.isolate(() => {
			gate.AwaitIdle(); log.push("build 1");
			for (let i = 0; i < 20; i++) fake.wait();
			// The player left mid-construction: the half-built world goes through the same gate.
			log.push("left");
			gate.Cleanup({ clear: longClear(fake, log, 120), restore: () => log.push("restore"), delaySeconds: 1 });
		});
		fake.run(25);
		launch(fake, gate, log, { present: true });
		fake.run(400);
		expect(log).toEqual(["build 1", "left", "queued", "clear", "cleared", "restore", "build"]);
	});
	it("cancels an overrunning clear and opens the gate only after it has stopped", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake, 5), log: string[] = [];
		// A registered chunked clear that would run for 60 s; it honours its token at each yield.
		gate.Cleanup({ clear: longClear(fake, log, 1800), restore: () => log.push("restore") });
		fake.run(140);
		expect(gate.Idle()).toBe(false);
		fake.run(20);
		expect(log).toEqual(["clear", "clear cancelled", "restore"]);
		expect(gate.Idle()).toBe(true);
		expect(fake.warned("cancelling")).toBe(true);
	});
	it("stops a clear that ignores its token at its next yield before opening the gate", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake, 5), log: string[] = [];
		let writes = 0;
		gate.Cleanup({ clear: () => { for (;;) { writes++; fake.wait(); } }, restore: () => log.push("restore") });
		fake.run(150 + WORLD_CANCEL_GRACE * 30 - 5);
		expect(gate.Idle()).toBe(false);
		fake.run(15);
		const stoppedAt = writes;
		fake.run(60);
		expect(writes).toBe(stoppedAt);
		expect(log).toEqual(["restore"]);
		expect(gate.Idle()).toBe(true);
	});
	it("never sticks when a clear throws or its coordinator is killed", () => {
		const thrown = new FakeScheduler(), a = new WorldLifecycle(thrown), log: string[] = [];
		a.Cleanup({ clear: () => error("boom"), restore: () => log.push("restore") });
		thrown.run(10);
		expect(a.Idle()).toBe(true); expect(log).toEqual(["restore"]); expect(thrown.warned("boom")).toBe(true);
		// A script-timeout kill ends coordinator and clear without releasing; the next launch reaps them.
		const killed = new FakeScheduler(), c = new WorldLifecycle(killed);
		c.Cleanup({ clear: () => { for (;;) killed.wait(); }, restore: () => undefined });
		killed.run(3);
		for (const co of killed.threads) coroutine.close(co);
		killed.threads = [];
		const result = launch(killed, c, [], { present: true });
		killed.run(3);
		expect(result()).toEqual({ kind: "build" }); expect(c.Idle()).toBe(true);
	});
	it("refuses a launch (and asks for the menu) only when the wait bound passes", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake, 1000);
		gate.Cleanup({ clear: () => { for (;;) fake.wait(); }, restore: () => undefined });
		let result: LaunchSlot | undefined;
		fake.isolate(() => { result = awaitLaunchSlot(gate, { playerPresent: () => true, sessions: () => 0, queued: () => undefined }, 2); });
		fake.run(90);
		expect(result).toEqual({ kind: "refuse", message: "The previous sortie is still being cleared. Please retry.", restoreMenu: true });
	});
	it("skips and cancels world clears once the server is closing", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: longClear(fake, log, 600), restore: () => log.push("restore"), delaySeconds: 0 });
		fake.run(10);
		gate.Close();
		gate.Cleanup({ clear: () => log.push("late clear"), restore: () => log.push("late restore") });
		fake.run(10);
		expect(log).toEqual(["clear", "clear cancelled"]);
		expect(gate.Idle()).toBe(true); expect(gate.Closing()).toBe(true);
	});
	it("builds at once when idle and adds only the result delay for an instant clear (missions 1 and 2)", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		const first = launch(fake, gate, log, { present: true });
		fake.run(1);
		expect(first()).toEqual({ kind: "build" }); expect(log).toEqual(["build"]);
		gate.Cleanup({ clear: () => log.push("clear"), restore: () => log.push("restore"), delaySeconds: 1 });
		fake.run(30);
		expect(gate.Idle()).toBe(false);
		fake.run(5);
		expect(gate.Idle()).toBe(true);
		expect(log).toEqual(["build", "clear", "restore"]);
	});
	it("refuses a second world while one is live", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake);
		const result = launch(fake, gate, [], { present: true }, () => 1);
		fake.run(1);
		expect(result()).toEqual({ kind: "refuse", message: "This mission world is single-player", restoreMenu: false });
	});
});
