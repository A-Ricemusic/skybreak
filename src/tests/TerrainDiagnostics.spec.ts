import { describe, expect, it } from "@rbxts/jest-globals";
import { createBudgetDiagnostics, runBudgeted, type TerrainJob, type BudgetProgress } from "../shared/TerrainSchedule";
import {
	measureTerrainWait,
	prepareTerrainDiagnostics,
	summarizeTerrainJobs,
	terrainJobMethod,
} from "../shared/TerrainDiagnostics";
import type { TerrainOp } from "../shared/WorldPlan";

const box: TerrainOp = { shape: "block", material: "Rock", x: 0, y: 0, z: 0, sx: 8, sy: 8, sz: 8, yaw: 0 };

describe("Aggregate terrain elapsed diagnostics", () => {
	it("separates preparation, completed work and the very first pause without double counting", () => {
		let now = 0;
		const prepared = prepareTerrainDiagnostics(
			() => {
				now += 5;
				return [{ op: box, cells: 8 }];
			},
			() => now,
		);
		const diagnostics = createBudgetDiagnostics();
		const run = runBudgeted(
			[2, 3, 4],
			(cost) => {
				now += cost;
			},
			{
				budget: 5,
				clock: () => now,
				pause: () => {
					now += 7;
				},
				diagnostics,
			},
		);
		expect(prepared.executionPreparationElapsedSeconds).toBe(5);
		expect(prepared.summaryPreparationElapsedSeconds).toBe(0);
		expect(diagnostics.completedWorkElapsedSeconds).toBe(9);
		expect(diagnostics.pauseCallbackElapsedSeconds).toBe(7);
		expect(diagnostics.maxPauseCallbackElapsedSeconds).toBe(7);
		expect(diagnostics.elapsedSeconds).toBe(16);
		expect(
			prepared.executionPreparationElapsedSeconds +
				prepared.summaryPreparationElapsedSeconds +
				diagnostics.elapsedSeconds,
		).toBe(now);
		expect(diagnostics.otherElapsedSeconds).toBe(0);
		expect(diagnostics.maxBatchElapsedSeconds).toBe(5);
		expect(run.yields).toBe(1);
	});
	it("includes an initial scheduling/check delay as other elapsed time and the final unyielded batch", () => {
		let now = 0,
			first = true;
		const diagnostics = createBudgetDiagnostics();
		runBudgeted(
			[2, 3],
			(cost) => {
				now += cost;
			},
			{
				budget: 100,
				clock: () => now,
				pause: () => error("unexpected pause"),
				cancelled: () => {
					if (first) {
						now += 6;
						first = false;
					}
					return false;
				},
				diagnostics,
			},
		);
		expect(diagnostics.elapsedSeconds).toBe(11);
		expect(diagnostics.completedWorkElapsedSeconds).toBe(5);
		expect(diagnostics.otherElapsedSeconds).toBe(6);
		expect(diagnostics.maxBatchElapsedSeconds).toBe(11);
		expect(diagnostics.maxJobElapsedSeconds).toBe(3);
	});
	it("records cancellation in the final yield without success or later writes", () => {
		let now = 0,
			cancelled = false;
		const diagnostics = createBudgetDiagnostics(),
			writes: number[] = [];
		const run = runBudgeted(
			[1, 2],
			(n) => {
				writes.push(n);
				now += 2;
			},
			{
				budget: 1,
				clock: () => now,
				pause: () => {
					now += 11;
					cancelled = true;
				},
				cancelled: () => cancelled,
				diagnostics,
			},
		);
		expect(run.complete).toBe(false);
		expect(writes).toEqual([1]);
		expect(diagnostics.status).toBe("cancelled");
		expect(diagnostics.elapsedSeconds).toBe(13);
		expect(diagnostics.pauseCallbackElapsedSeconds).toBe(11);
		expect(diagnostics.completed).toBe(1);
		const final = createBudgetDiagnostics();
		cancelled = false;
		expect(
			runBudgeted(
				[1],
				() => {
					now += 2;
				},
				{
					budget: 1,
					clock: () => now,
					pause: () => {
						cancelled = true;
						now += 3;
					},
					cancelled: () => cancelled,
					diagnostics: final,
				},
			).complete,
		).toBe(false);
		expect(final.status).toBe("cancelled");
		expect(final.pauseCallbackElapsedSeconds).toBe(3);
	});
	it("retains elapsed failure evidence and propagates a throwing job without counting it as completed", () => {
		let now = 0;
		const diagnostics = createBudgetDiagnostics();
		expect(() =>
			runBudgeted(
				[2, 3, 4],
				(cost) => {
					now += cost;
					if (cost === 3) error("native failure");
				},
				{ budget: 10, clock: () => now, pause: () => undefined, diagnostics },
			),
		).toThrow();
		expect(diagnostics.status).toBe("failed");
		expect(diagnostics.completed).toBe(1);
		expect(diagnostics.completedWorkElapsedSeconds).toBe(2);
		expect(diagnostics.failedWorkElapsedSeconds).toBe(3);
		expect(diagnostics.maxJobElapsedSeconds).toBe(3);
		expect(diagnostics.elapsedSeconds).toBe(5);
		expect(diagnostics.otherElapsedSeconds).toBe(0);
		expect(diagnostics.maxBatchElapsedSeconds).toBe(5);
	});
	it("counts an interrupted pause callback once and preserves its error", () => {
		let now = 0;
		const diagnostics = createBudgetDiagnostics();
		expect(() =>
			runBudgeted(
				[1, 2],
				() => {
					now += 2;
				},
				{
					budget: 1,
					clock: () => now,
					pause: () => {
						now += 7;
						error("pause failure");
					},
					diagnostics,
				},
			),
		).toThrow();
		expect(diagnostics.elapsedSeconds).toBe(9);
		expect(diagnostics.pauseCallbackElapsedSeconds).toBe(7);
		expect(diagnostics.maxPauseCallbackElapsedSeconds).toBe(7);
		expect(diagnostics.maxBatchElapsedSeconds).toBe(2);
		expect(diagnostics.yields).toBe(1);
		expect(diagnostics.status).toBe("failed");
	});
	it("resets a reused sink, including an empty cancelled invocation", () => {
		let now = 0;
		const diagnostics = createBudgetDiagnostics();
		runBudgeted(
			[1],
			() => {
				now += 2;
			},
			{
				budget: 1,
				clock: () => now,
				pause: () => {
					now += 3;
				},
				diagnostics,
			},
		);
		runBudgeted([], () => error("no work"), {
			budget: 1,
			clock: () => now,
			pause: () => undefined,
			cancelled: () => true,
			diagnostics,
		});
		expect(diagnostics.elapsedSeconds).toBe(0);
		expect(diagnostics.completedWorkElapsedSeconds).toBe(0);
		expect(diagnostics.pauseCallbackElapsedSeconds).toBe(0);
		expect(diagnostics.completed).toBe(0);
		expect(diagnostics.status).toBe("cancelled");
	});
	it("preserves the budget schedule with bounded extra clock calls", () => {
		const run = (instrumented: boolean) => {
			let now = 0,
				calls = 0;
			const order: number[] = [];
			const diagnostics = instrumented ? createBudgetDiagnostics() : undefined;
			const result = runBudgeted(
				[2, 3, 4],
				(cost) => {
					order.push(cost);
					now += cost;
				},
				{
					budget: 5,
					clock: () => {
						calls++;
						return now;
					},
					pause: () => {
						now += 7;
					},
					diagnostics,
				},
			);
			return { result, order, calls };
		};
		const original = run(false),
			measured = run(true);
		expect(measured.result).toEqual(original.result);
		expect(measured.order).toEqual(original.order);
		expect(measured.calls - original.calls).toBe(measured.result.yields + 1);
	});
	it("preserves pre-yield progress and prevents late writes after a hard coroutine stop", () => {
		const diagnostics = createBudgetDiagnostics();
		const progress: BudgetProgress = { completed: 0, jobs: 0, workSeconds: 0, yields: 0, stage: "prepare" };
		const writes: number[] = [];
		const worker = coroutine.create(() =>
			runBudgeted(
				[1, 2],
				(n) => {
					writes.push(n);
				},
				{
					budget: 0,
					clock: () => 0,
					pause: () => {
						coroutine.yield();
					},
					diagnostics,
					progress,
				},
			),
		);
		expect(coroutine.resume(worker)[0]).toBe(true);
		expect(progress.completed).toBe(1);
		expect(progress.stage).toBe("yield");
		coroutine.close(worker);
		expect(coroutine.status(worker)).toBe("dead");
		expect(writes).toEqual([1]);
		expect(diagnostics.status).toBe("prepare"); // incomplete, never a success/cursor
		runBudgeted(
			[1, 2],
			(n) => {
				writes.push(n);
			},
			{ budget: 0, clock: () => 0, pause: () => undefined, diagnostics },
		);
		expect(writes).toEqual([1, 1, 2]);
		expect(diagnostics.status).toBe("complete");
	});
	it("separates actual waits from pause reporting and measures throwing waits once", () => {
		let now = 0;
		const waits = { actualWaitElapsedSeconds: 0, maxActualWaitElapsedSeconds: 0 };
		const diagnostics = createBudgetDiagnostics();
		runBudgeted(
			[1],
			() => {
				now += 2;
			},
			{
				budget: 1,
				clock: () => now,
				pause: () => {
					now += 3; // pre-yield diagnostic persistence
					measureTerrainWait(
						() => {
							now += 5;
						},
						() => now,
						waits,
					);
					now += 2; // post-resumption reporting
				},
				diagnostics,
			},
		);
		expect(waits.actualWaitElapsedSeconds).toBe(5);
		expect(waits.maxActualWaitElapsedSeconds).toBe(5);
		expect(diagnostics.pauseCallbackElapsedSeconds).toBe(10);
		expect(diagnostics.elapsedSeconds).toBe(12);
		expect(() =>
			measureTerrainWait(
				() => {
					now += 7;
					error("wait error");
				},
				() => now,
				waits,
			),
		).toThrow();
		expect(waits.actualWaitElapsedSeconds).toBe(12);
		expect(waits.maxActualWaitElapsedSeconds).toBe(7);
	});
	it("measures job-summary preparation separately from execution preparation", () => {
		const ticks = [10, 13, 15];
		let i = 0;
		const result = prepareTerrainDiagnostics(
			() => [{ op: box, cells: 8 }],
			() => ticks[i++],
		);
		expect(result.executionPreparationElapsedSeconds).toBe(3);
		expect(result.summaryPreparationElapsedSeconds).toBe(2);
		expect(result.summary.groups[0].plannedEstimatedCells).toBe(8);
	});
	it("classifies material/native-method groups without mutating or reordering jobs", () => {
		const job = (op: TerrainOp): TerrainJob => ({ op, cells: 8 });
		const jobs = [
			job(box),
			job({ ...box, material: "Water" }),
			job({ ...box, yaw: 0.2 }),
			job({ ...box, x: 1 }),
			job({ ...box, shape: "wedge" }),
			job({ ...box, shape: "ball" }),
			job({ ...box, shape: "cylinder" }),
			{
				op: { ...box, shape: "bump" as const },
				cells: 12,
				region: { min: [0, 0, 0] as [number, number, number], max: [4, 4, 4] as [number, number, number] },
			},
			job(box),
		];
		const snapshot = jobs.map((j) => ({ ...j, op: { ...j.op } }));
		expect(jobs.map(terrainJobMethod)).toEqual([
			"FillRegion",
			"FillBlock",
			"FillBlock",
			"FillBlock",
			"FillWedge",
			"FillBall",
			"FillCylinder",
			"ReadVoxels+WriteVoxels",
			"FillRegion",
		]);
		const summary = summarizeTerrainJobs(jobs);
		expect(summary.groups.reduce((n, g) => n + g.plannedJobs, 0)).toBe(9);
		expect(summary.groups.reduce((n, g) => n + g.plannedEstimatedCells, 0)).toBe(76);
		expect(summary.groups[0].plannedJobs).toBe(2);
		expect(summary.byJob[0]).toBe(summary.byJob[8]);
		expect(summary.groups.every((g) => g.completedJobs === 0 && g.completedEstimatedCells === 0)).toBe(true);
		expect(jobs).toEqual(snapshot);
	});
});
