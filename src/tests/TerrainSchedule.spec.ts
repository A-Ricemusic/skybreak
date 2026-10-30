import { MissionCatalog } from "./LegacyCatalog";
import { describe, expect, it } from "@rbxts/jest-globals";
import { BUMP_CHUNK, FILL_CHUNK, TERRAIN_BUDGET, UNSPLIT_MAX, bumpRegion, regionCells, runBudgeted, terrainJobs, type TerrainJob } from "../shared/TerrainSchedule";
import { WorldPlanner, terrainTop, type TerrainOp } from "../shared/WorldPlan";

// The terrain-write scheduler (pure; also run in the offline Luau VM). The server
// passes os.clock and task.wait; here a fake clock charges each job a cost.
const ids: number[] = [];
for (let id = 3; id <= 27; id++) ids.push(id);

/** The fill ops the jobs execute, with each bump once (its slices share the op). */
function executedOps(jobs: TerrainJob[]): TerrainOp[] {
	const out: TerrainOp[] = [];
	for (const job of jobs) if (job.region === undefined || out[out.size() - 1] !== job.op) out.push(job.op);
	return out;
}

describe("Terrain write scheduler", () => {
 it("stops a chunked clear at cancellation after a yield without writing later jobs", () => {
  let now=0, cancelled=false;
  const writes:number[]=[];
  runBudgeted([1,2,3], n=>{writes.push(n);now+=0.01;}, {
   budget:0.008,clock:()=>now,pause:()=>{cancelled=true;},cancelled:()=>cancelled,
  });
  expect(writes).toEqual([1]);
  runBudgeted([4], n=>writes.push(n), {budget:0.008,clock:()=>now,pause:()=>undefined,cancelled:()=>true});
  expect(writes).toEqual([1]);
 });
	it("yields whenever a resumption has used its budget, in order, and reports the longest job", () => {
		let now = 0, pauses = 0;
		const order: number[] = [], slices: number[][] = [[]];
		const run = runBudgeted([1, 2, 3, 4, 5, 6, 7], (n) => { order.push(n); slices[slices.size() - 1].push(n); now += n === 4 ? 0.02 : 0.005; }, {
			budget: 0.012, clock: () => now, pause: () => { pauses += 1; slices.push([]); now += 0.016; },
		});
		expect(order.join(",")).toBe("1,2,3,4,5,6,7");
		// 5+5+5 ms, then the 20 ms job alone, then 5+5+5 ms (the last slice ends the run).
		expect(slices.map((s) => s.join("+")).join(" | ")).toBe("1+2+3 | 4 | 5+6+7 | ");
		expect(pauses).toBe(3);
		expect(run.yields).toBe(3);
		expect(run.longest).toBeCloseTo(0.02, 6);
		expect(run.total).toBeCloseTo(0.05, 6);
	});
	it("never runs more than one budget plus one job between yields on the heaviest worlds", () => {
		// Cost model: 40 ns per filled voxel, 250 ns per bump cell (the Luau loop) - only the ratio matters here.
		for (const id of [11, 16, 18]) {
			const jobs = terrainJobs(WorldPlanner.Build(id, MissionCatalog.Get(id)).ops);
			let now = 0, sliceStart = 0, worstSlice = 0, longest = 0;
			const run = runBudgeted(jobs, (job) => { const cost = job.cells * (job.region !== undefined ? 250e-9 : 40e-9); longest = math.max(longest, cost); now += cost; }, {
				budget: TERRAIN_BUDGET, clock: () => now, pause: () => { worstSlice = math.max(worstSlice, now - sliceStart); now += 1 / 60; sliceStart = now; },
			});
			worstSlice = math.max(worstSlice, now - sliceStart);
			expect(run.yields).toBeGreaterThan(10);
			expect(worstSlice).toBeLessThanOrEqual(TERRAIN_BUDGET + longest + 1e-9);
		}
	});
	it("bounds every job: fills by FILL_CHUNK, bump slices by BUMP_CHUNK, whole wedges and balls by UNSPLIT_MAX", () => {
		for (const id of ids) {
			for (const job of terrainJobs(WorldPlanner.Build(id, MissionCatalog.Get(id)).ops)) {
				const o = job.op;
				const cap = job.region !== undefined ? BUMP_CHUNK : o.shape === "wedge" || o.shape === "ball" ? UNSPLIT_MAX : FILL_CHUNK;
				if (job.cells > cap) expect(`M${id} ${o.shape} ${o.material} at (${math.floor(o.x)}, ${math.floor(o.z)}): ${math.floor(job.cells)} cells > ${cap}`).toBe("");
			}
		}
	});
	it("splits only on voxel planes and writes the same terrain as the unsplit plan", () => {
		for (const id of ids) {
			const plan = WorldPlanner.Build(id, MissionCatalog.Get(id)), ops = executedOps(terrainJobs(plan.ops));
			for (const o of plan.ops) {
				if (o.shape === "bump") continue;
				const pieces = terrainJobs([o]);
				if (pieces.size() === 1) continue;
				// Every face of a piece is the original op's face or lies on the 4-stud voxel grid.
				const onGrid = (v: number, a: number, b: number) => math.abs(v - a) < 1e-6 || math.abs(v - b) < 1e-6 || math.abs(v / 4 - math.round(v / 4)) < 1e-6;
				for (const { op: q } of pieces) {
					expect(q.shape === "block" || q.shape === "cylinder").toBe(true);
					expect(onGrid(q.y - q.sy / 2, o.y - o.sy / 2, o.y + o.sy / 2) && onGrid(q.y + q.sy / 2, o.y - o.sy / 2, o.y + o.sy / 2)).toBe(true);
					if (q.x !== o.x || q.sx !== o.sx) expect(o.yaw === 0 && onGrid(q.x - q.sx / 2, o.x - o.sx / 2, o.x + o.sx / 2) && onGrid(q.x + q.sx / 2, o.x - o.sx / 2, o.x + o.sx / 2)).toBe(true);
					if (q.z !== o.z || q.sz !== o.sz) expect(o.yaw === 0 && onGrid(q.z - q.sz / 2, o.z - o.sz / 2, o.z + o.sz / 2) && onGrid(q.z + q.sz / 2, o.z - o.sz / 2, o.z + o.sz / 2)).toBe(true);
				}
			}
			for (let x = -2600; x <= 2600; x += 650) for (let z = -2600; z <= 2600; z += 650) {
				const a = terrainTop(plan.ops, x, z), b = terrainTop(ops, x, z);
				const same = (p?: number, q?: number) => p === q || (p !== undefined && q !== undefined && math.abs(p - q) < 1e-6);
				if (!same(a.solid, b.solid) || !same(a.water, b.water)) expect(`M${id} (${x}, ${z}): ${b.solid}/${b.water}`).toBe(`M${id} (${x}, ${z}): ${a.solid}/${a.water}`);
			}
		}
	});
	it("slices each bump's grid region into disjoint pieces that cover it exactly", () => {
		for (const id of [5, 13, 16]) {
			const plan = WorldPlanner.Build(id, MissionCatalog.Get(id)), jobs = terrainJobs(plan.ops);
			let bumps = 0;
			for (const o of plan.ops) {
				if (o.shape !== "bump") continue;
				bumps += 1;
				const region = bumpRegion(o), slices = jobs.filter((j) => j.op === o);
				let cells = 0;
				for (const s of slices) {
					cells += s.cells;
					for (const axis of [0, 1, 2]) {
						expect(s.region!.min[axis] % 4).toBe(0);
						expect(s.region!.min[axis] >= region.min[axis] && s.region!.max[axis] <= region.max[axis]).toBe(true);
					}
				}
				expect(cells).toBe(regionCells(region));
			}
			expect(bumps).toBeGreaterThan(0);
			// The plan's bump-cell count is exactly what the executor reads and writes.
			expect(WorldPlanner.Counts(plan).bumpCells).toBe(jobs.filter((j) => j.region !== undefined).reduce((sum, j) => sum + j.cells, 0));
		}
	});
});
