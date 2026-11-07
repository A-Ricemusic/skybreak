import { describe, expect, it } from "@rbxts/jest-globals";
import { runBudgeted, type BudgetProgress } from "../shared/TerrainSchedule";
import { TerrainWriteState } from "../shared/TerrainWriteState";

// Test the dirty-state contract without destructive native Terrain:Clear() calls.
describe("Terrain write state", () => {
	it("clears only dirty terrain without invoking a native clear on the Jest thread", () => {
		let clears = 0;
		const terrain = new TerrainWriteState(() => {
			clears++;
		});
		terrain.BeginWrite();
		expect(clears).toBe(1);
		expect(terrain.Dirty()).toBe(true);
		terrain.MarkClean();
		terrain.ClearIfDirty();
		expect(clears).toBe(1);
		terrain.BeginWrite();
		expect(terrain.Dirty()).toBe(true);
		expect(clears).toBe(1);
		terrain.ClearIfDirty();
		terrain.ClearIfDirty();
		expect(terrain.Dirty()).toBe(false);
		expect(clears).toBe(2);
	});
	it("keeps terrain dirty if its clear fails so recovery retries", () => {
		let fail = true,
			clears = 0;
		const terrain = new TerrainWriteState(() => {
			clears++;
			if (fail) error("expected clear failure");
		});
		const [ok] = pcall(() => terrain.ClearIfDirty());
		expect(ok).toBe(false);
		expect(terrain.Dirty()).toBe(true);
		fail = false;
		terrain.ClearIfDirty();
		expect(terrain.Dirty()).toBe(false);
		expect(clears).toBe(2);
	});
});

describe("Terrain cleanup cancellation recovery", () => {
	it("retains the footprint after a known job is cancelled, then retries to completion", () => {
		let now = 0,
			cancelled = false;
		let footprint: number[] | undefined = [1, 2, 3];
		const writes: number[] = [];
		const state = new TerrainWriteState((token) => {
			const result = runBudgeted(
				footprint!,
				(job) => {
					writes.push(job);
					now++;
				},
				{
					budget: 1,
					clock: () => now,
					pause: () => {
						cancelled = true;
					},
					cancelled: token,
				},
			);
			if (!result.complete) return false;
			footprint = undefined;
			return true;
		});
		const [ok] = pcall(() => state.ClearIfDirty(() => cancelled));
		expect(ok).toBe(false);
		expect(writes).toEqual([1]);
		expect(footprint).toEqual([1, 2, 3]);
		expect(state.Dirty()).toBe(true);
		state.ClearIfDirty();
		expect(writes).toEqual([1, 1, 2, 3]);
		expect(footprint).toBeUndefined();
		expect(state.Dirty()).toBe(false);
	});
	it("does not discard the footprint when an engine job throws", () => {
		let footprint: number[] | undefined = [1, 2];
		const state = new TerrainWriteState(() => {
			runBudgeted(footprint!, () => error("injected engine failure"), {
				budget: 1,
				clock: () => 0,
				pause: () => undefined,
			});
			footprint = undefined;
		});
		expect(pcall(() => state.ClearIfDirty())[0]).toBe(false);
		expect(footprint).toEqual([1, 2]);
		expect(state.Dirty()).toBe(true);
	});
});

describe("Hard terrain worker interruption", () => {
	it("retains progress and dirty recovery evidence when stopped at a yield", () => {
		const progress: BudgetProgress = { completed: 0, jobs: 0, workSeconds: 0, yields: 0, stage: "work" };
		let footprint: number[] | undefined = [1, 2, 3];
		let writes = 0;
		const state = new TerrainWriteState(() => {
			const result = runBudgeted(
				footprint!,
				() => {
					writes++;
				},
				{
					budget: 0,
					clock: () => 0,
					pause: () => {
						coroutine.yield();
					},
					progress,
				},
			);
			if (!result.complete) return false;
			footprint = undefined;
			return true;
		});
		const worker = coroutine.create(() => state.ClearIfDirty());
		coroutine.resume(worker);
		expect(progress.completed).toBe(1);
		expect(progress.jobs).toBe(3);
		expect(progress.stage).toBe("yield");
		coroutine.close(worker);
		expect(state.Dirty()).toBe(true);
		expect(footprint).toEqual([1, 2, 3]);
		expect(writes).toBe(1);
		expect(coroutine.status(worker)).toBe("dead");
	});
});

describe("Terrain cleanup final-operation boundary", () => {
	for (const failure of ["cancel", "throw"]) {
		it(`retains recovery state on ${failure} after the final write and before success`, () => {
			let footprint: number[] | undefined = [1];
			let cancelled = false,
				writes = 0;
			const state = new TerrainWriteState((token) => {
				const result = runBudgeted(
					footprint!,
					() => {
						writes++;
					},
					{
						budget: 0,
						clock: () => 0,
						cancelled: token,
						pause: () => {
							if (failure === "throw") error("injected final yield failure");
							cancelled = true;
						},
					},
				);
				if (!result.complete) return false;
				footprint = undefined;
				return true;
			});
			expect(pcall(() => state.ClearIfDirty(() => cancelled))[0]).toBe(false);
			expect(writes).toBe(1);
			expect(footprint).toEqual([1]);
			expect(state.Dirty()).toBe(true);
		});
	}
});
