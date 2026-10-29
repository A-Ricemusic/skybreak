import { describe, expect, it } from "@rbxts/jest-globals";
import { LifecycleScheduler, WorldLifecycle } from "../shared/WorldLifecycle";

/** Frame-stepped stand-in for the Roblox task library: isolate = task.defer, wait = one frame. */
class FakeScheduler implements LifecycleScheduler {
	public clock = 0;
	public threads: thread[] = [];
	public warnings: string[] = [];
	public isolate(work: () => void): () => boolean {
		let ended = false;
		const co = coroutine.create(() => {
			const [ok, err] = pcall(work);
			if (!ok) this.warnings.push(tostring(err));
			ended = true;
		});
		this.threads.push(co);
		return () => ended || coroutine.status(co) === "dead";
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
}
function longClear(fake: FakeScheduler, log: string[], frames: number) {
	return () => { log.push("clear"); for (let i = 0; i < frames; i++) fake.wait(); log.push("cleared"); };
}

describe("World lifecycle gate (one world at a time)", () => {
	it("queues an immediate relaunch until the old world is cleared and the menu restored", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: longClear(fake, log, 300), restore: () => log.push("restore"), delaySeconds: 1 });
		expect(gate.Idle()).toBe(false);
		let waited: boolean | undefined;
		fake.isolate(() => { waited = gate.AwaitIdle(); log.push("launch"); });
		fake.run(200);
		expect(log.includes("launch")).toBe(false);
		fake.run(400);
		expect(waited).toBe(true);
		expect(log).toEqual(["clear", "cleared", "restore", "launch"]);
		expect(gate.Idle()).toBe(true);
	});
	it("never fires a stale restoration after the next world is built", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: longClear(fake, log, 60), restore: () => log.push("restore"), delaySeconds: 1 });
		fake.isolate(() => { gate.AwaitIdle(); log.push("build"); });
		fake.run(600);
		const built = log.indexOf("build");
		expect(built).toBe(log.size() - 1);
		expect(log.filter((e) => e === "clear").size()).toBe(1);
		expect(log.filter((e) => e === "restore").size()).toBe(1);
		expect(gate.Pending()).toBe(0);
	});
	it("completes a cleanup and frees the gate when the player leaves during it", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		let playerPresent = true;
		gate.Cleanup({ clear: () => { log.push("clear"); for (let i = 0; i < 90; i++) { if (i === 10) playerPresent = false; fake.wait(); } log.push("cleared"); },
			restore: () => log.push("restore"), delaySeconds: 1 });
		fake.run(200);
		expect(playerPresent).toBe(false);
		expect(log).toEqual(["clear", "cleared", "restore"]);
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
		fake.isolate(() => { gate.AwaitIdle(); log.push("build 2"); });
		fake.run(400);
		expect(log).toEqual(["build 1", "left", "clear", "cleared", "restore", "build 2"]);
	});
	it("never sticks when a clear throws, outlasts its bound, or its coordinator is killed", () => {
		const thrown = new FakeScheduler(), a = new WorldLifecycle(thrown), log: string[] = [];
		a.Cleanup({ clear: () => error("boom"), restore: () => log.push("restore") });
		thrown.run(10);
		expect(a.Idle()).toBe(true); expect(log).toEqual(["restore"]);
		expect(thrown.warnings.some((w) => w.find("boom")[0] !== undefined)).toBe(true);

		const stuck = new FakeScheduler(), b = new WorldLifecycle(stuck, 5);
		b.Cleanup({ clear: () => { for (;;) stuck.wait(); }, restore: () => undefined });
		stuck.run(100);
		expect(b.Idle()).toBe(false);
		stuck.run(100);
		expect(b.Idle()).toBe(true);
		expect(stuck.warnings.some((w) => w.find("still running")[0] !== undefined)).toBe(true);

		// A script-timeout kill ends the coordinator without releasing; the next launch reaps it.
		const killed = new FakeScheduler(), c = new WorldLifecycle(killed);
		c.Cleanup({ clear: () => { for (;;) killed.wait(); }, restore: () => undefined });
		killed.run(3);
		for (const co of killed.threads) coroutine.close(co);
		killed.threads = [];
		let ok: boolean | undefined;
		killed.isolate(() => { ok = c.AwaitIdle(); });
		killed.run(3);
		expect(ok).toBe(true); expect(c.Idle()).toBe(true);
	});
	it("refuses a launch only when the wait bound passes", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake, 1000);
		gate.Cleanup({ clear: () => { for (;;) fake.wait(); }, restore: () => undefined });
		let ok: boolean | undefined;
		fake.isolate(() => { ok = gate.AwaitIdle(2); });
		fake.run(90);
		expect(ok).toBe(false);
	});
	it("adds only the result delay for an instant clear (missions 1 and 2)", () => {
		const fake = new FakeScheduler(), gate = new WorldLifecycle(fake), log: string[] = [];
		gate.Cleanup({ clear: () => log.push("clear"), restore: () => log.push("restore"), delaySeconds: 1 });
		fake.run(30);
		expect(gate.Idle()).toBe(false);
		fake.run(5);
		expect(gate.Idle()).toBe(true);
		expect(log).toEqual(["clear", "restore"]);
	});
});
