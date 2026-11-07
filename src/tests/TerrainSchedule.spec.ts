import { MissionCatalog } from "./LegacyCatalog";
import { describe, expect, it } from "@rbxts/jest-globals";
import {
	terrainCleanupOp,
	terrainBoundsOp,
	alignedBlockRegion,
	coalesceTerrainJobs,
	terrainExecutionJobs,
	BUMP_CHUNK,
	FILL_CHUNK,
	TERRAIN_BUDGET,
	UNSPLIT_MAX,
	bumpRegion,
	regionCells,
	runBudgeted,
	terrainJobs,
	type TerrainJob,
} from "../shared/TerrainSchedule";
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
		let now = 0,
			cancelled = false;
		const writes: number[] = [];
		const result = runBudgeted(
			[1, 2, 3],
			(n) => {
				writes.push(n);
				now += 0.01;
			},
			{
				budget: 0.008,
				clock: () => now,
				pause: () => {
					cancelled = true;
				},
				cancelled: () => cancelled,
			},
		);
		expect(result.complete).toBe(false);
		expect(result.completed).toBe(1);
		expect(writes).toEqual([1]);
		runBudgeted([4], (n) => writes.push(n), {
			budget: 0.008,
			clock: () => now,
			pause: () => undefined,
			cancelled: () => true,
		});
		expect(writes).toEqual([1]);
	});
	it("does not report success when cancelled in the final yield", () => {
		let cancelled = false;
		const result = runBudgeted([1], () => undefined, {
			budget: 0,
			clock: () => 0,
			pause: () => {
				cancelled = true;
			},
			cancelled: () => cancelled,
		});
		expect(result.completed).toBe(1);
		expect(result.complete).toBe(false);
	});
	it("yields whenever a resumption has used its budget, in order, and reports the longest job", () => {
		let now = 0,
			pauses = 0;
		const order: number[] = [],
			slices: number[][] = [[]];
		const run = runBudgeted(
			[1, 2, 3, 4, 5, 6, 7],
			(n) => {
				order.push(n);
				slices[slices.size() - 1].push(n);
				now += n === 4 ? 0.02 : 0.005;
			},
			{
				budget: 0.012,
				clock: () => now,
				pause: () => {
					pauses += 1;
					slices.push([]);
					now += 0.016;
				},
			},
		);
		expect(run.complete).toBe(true);
		expect(run.completed).toBe(7);
		expect(order.join(",")).toBe("1,2,3,4,5,6,7");
		// 5+5+5 ms, then the 20 ms job alone, then 5+5+5 ms (the last slice ends the run).
		expect(slices.map((s) => s.join("+")).join(" | ")).toBe("1+2+3 | 4 | 5+6+7 | ");
		expect(pauses).toBe(3);
		expect(run.yields).toBe(3);
		expect(run.longest).toBeCloseTo(0.02, 6);
		expect(run.total).toBeCloseTo(0.05, 6);
		expect(run.longestBatch).toBeCloseTo(0.02, 6);
	});
	it("never runs more than one budget plus one job between yields on the heaviest worlds", () => {
		// Cost model: 40 ns per filled voxel, 250 ns per bump cell (the Luau loop) - only the ratio matters here.
		for (const id of [11, 16, 18]) {
			const jobs = terrainJobs(WorldPlanner.Build(id, MissionCatalog.Get(id)).ops);
			let now = 0,
				sliceStart = 0,
				worstSlice = 0,
				longest = 0;
			const run = runBudgeted(
				jobs,
				(job) => {
					const cost = job.cells * (job.region !== undefined ? 250e-9 : 40e-9);
					longest = math.max(longest, cost);
					now += cost;
				},
				{
					budget: TERRAIN_BUDGET,
					clock: () => now,
					pause: () => {
						worstSlice = math.max(worstSlice, now - sliceStart);
						now += 1 / 60;
						sliceStart = now;
					},
				},
			);
			worstSlice = math.max(worstSlice, now - sliceStart);
			expect(run.yields).toBeGreaterThan(10);
			expect(worstSlice).toBeLessThanOrEqual(TERRAIN_BUDGET + longest + 1e-9);
		}
	});
	it("bounds every job: fills by FILL_CHUNK, bump slices by BUMP_CHUNK, whole wedges and balls by UNSPLIT_MAX", () => {
		for (const id of ids) {
			for (const job of terrainJobs(WorldPlanner.Build(id, MissionCatalog.Get(id)).ops)) {
				const o = job.op;
				const cap =
					job.region !== undefined
						? BUMP_CHUNK
						: o.shape === "wedge" || o.shape === "ball"
							? UNSPLIT_MAX
							: FILL_CHUNK;
				if (job.cells > cap)
					expect(
						`M${id} ${o.shape} ${o.material} at (${math.floor(o.x)}, ${math.floor(o.z)}): ${math.floor(job.cells)} cells > ${cap}`,
					).toBe("");
			}
		}
	});
	it("splits only on voxel planes and writes the same terrain as the unsplit plan", () => {
		for (const id of ids) {
			const plan = WorldPlanner.Build(id, MissionCatalog.Get(id)),
				ops = executedOps(terrainJobs(plan.ops));
			for (const o of plan.ops) {
				if (o.shape === "bump") continue;
				const pieces = terrainJobs([o]);
				if (pieces.size() === 1) continue;
				// Every face of a piece is the original op's face or lies on the 4-stud voxel grid.
				const onGrid = (v: number, a: number, b: number) =>
					math.abs(v - a) < 1e-6 || math.abs(v - b) < 1e-6 || math.abs(v / 4 - math.round(v / 4)) < 1e-6;
				for (const { op: q } of pieces) {
					expect(q.shape === "block" || q.shape === "cylinder").toBe(true);
					expect(
						onGrid(q.y - q.sy / 2, o.y - o.sy / 2, o.y + o.sy / 2) &&
							onGrid(q.y + q.sy / 2, o.y - o.sy / 2, o.y + o.sy / 2),
					).toBe(true);
					if (q.x !== o.x || q.sx !== o.sx)
						expect(
							o.yaw === 0 &&
								onGrid(q.x - q.sx / 2, o.x - o.sx / 2, o.x + o.sx / 2) &&
								onGrid(q.x + q.sx / 2, o.x - o.sx / 2, o.x + o.sx / 2),
						).toBe(true);
					if (q.z !== o.z || q.sz !== o.sz)
						expect(
							o.yaw === 0 &&
								onGrid(q.z - q.sz / 2, o.z - o.sz / 2, o.z + o.sz / 2) &&
								onGrid(q.z + q.sz / 2, o.z - o.sz / 2, o.z + o.sz / 2),
						).toBe(true);
				}
			}
			for (let x = -2600; x <= 2600; x += 650)
				for (let z = -2600; z <= 2600; z += 650) {
					const a = terrainTop(plan.ops, x, z),
						b = terrainTop(ops, x, z);
					const same = (p?: number, q?: number) =>
						p === q || (p !== undefined && q !== undefined && math.abs(p - q) < 1e-6);
					if (!same(a.solid, b.solid) || !same(a.water, b.water))
						expect(`M${id} (${x}, ${z}): ${b.solid}/${b.water}`).toBe(
							`M${id} (${x}, ${z}): ${a.solid}/${a.water}`,
						);
				}
		}
	});
	it("slices each bump's grid region into disjoint pieces that cover it exactly", () => {
		for (const id of [5, 13, 16]) {
			const plan = WorldPlanner.Build(id, MissionCatalog.Get(id)),
				jobs = terrainJobs(plan.ops);
			let bumps = 0;
			for (const o of plan.ops) {
				if (o.shape !== "bump") continue;
				bumps += 1;
				const region = bumpRegion(o),
					slices = jobs.filter((j) => j.op === o);
				let cells = 0;
				for (const s of slices) {
					cells += s.cells;
					for (const axis of [0, 1, 2]) {
						expect(s.region!.min[axis] % 4).toBe(0);
						expect(s.region!.min[axis] >= region.min[axis] && s.region!.max[axis] <= region.max[axis]).toBe(
							true,
						);
					}
				}
				expect(cells).toBe(regionCells(region));
			}
			expect(bumps).toBeGreaterThan(0);
			// The plan's bump-cell count is exactly what the executor reads and writes.
			expect(WorldPlanner.Counts(plan).bumpCells).toBe(
				jobs.filter((j) => j.region !== undefined).reduce((sum, j) => sum + j.cells, 0),
			);
		}
	});
});

// Small exhaustive voxel oracle: prove overwrite order and geometry, not just job counts.
describe("Full-voxel terrain execution", () => {
	const box = (
		x: number,
		y: number,
		z: number,
		sx: number,
		sy: number,
		sz: number,
		material = "Rock",
	): TerrainOp => ({ shape: "block", x, y, z, sx, sy, sz, yaw: 0, material: material as TerrainOp["material"] });
	it("uses region fills only when every face is on the voxel lattice", () => {
		expect(alignedBlockRegion(box(4, 4, 4, 8, 8, 8))).toEqual({ min: [0, 0, 0], max: [8, 8, 8] });
		expect(alignedBlockRegion(box(5, 4, 4, 8, 8, 8))).toBeUndefined();
		expect(alignedBlockRegion({ ...box(4, 4, 4, 8, 8, 8), yaw: 0.1 })).toBeUndefined();
	});
	it("joins boxes across disjoint materials but preserves every intersecting overwrite", () => {
		const ops = [
			box(2, 2, 2, 4, 4, 4),
			box(2, 10, 2, 4, 4, 4, "Grass"),
			box(6, 2, 2, 4, 4, 4),
			box(6, 2, 2, 4, 4, 4, "Grass"),
			box(6, 2, 2, 4, 4, 4),
			box(2, 2, 2, 4, 4, 4, "Water"),
		];
		const jobs = terrainExecutionJobs(ops, 8);
		expect(jobs.size()).toBeLessThan(ops.size());
		// Full material/occupancy overwrite oracle, including FillBlock water preserving solids.
		const sample = (items: TerrainOp[], x: number, y: number, z: number) => {
			let mat = "Air";
			for (const o of items)
				if (
					x >= o.x - o.sx / 2 &&
					x < o.x + o.sx / 2 &&
					y >= o.y - o.sy / 2 &&
					y < o.y + o.sy / 2 &&
					z >= o.z - o.sz / 2 &&
					z < o.z + o.sz / 2
				)
					if (o.material !== "Water" || mat === "Air" || mat === "Water") mat = o.material;
			return mat;
		};
		for (let x = -4; x <= 12; x += 4)
			for (let y = -4; y <= 16; y += 4)
				for (let z = -4; z <= 12; z += 4)
					expect(
						sample(
							jobs.map((j) => j.op),
							x,
							y,
							z,
						),
					).toBe(sample(ops, x, y, z));
		for (const j of jobs) expect(j.cells).toBeLessThanOrEqual(8);
	});
	it("preserves an exhaustive mixed-material voxel field through both optimization passes", () => {
		let seed = 731;
		const randomCell = () => {
			seed = (seed * 16807) % 2147483647;
			return seed;
		};
		const ops: TerrainOp[] = [];
		for (let i = 0; i < 80; i++)
			ops.push(
				box(
					(randomCell() % 8) * 4,
					(randomCell() % 4) * 4,
					(randomCell() % 8) * 4,
					((randomCell() % 3) + 1) * 8,
					((randomCell() % 2) + 1) * 8,
					((randomCell() % 3) + 1) * 8,
					["Rock", "Grass", "Air", "Water"][randomCell() % 4],
				),
			);
		const saved = ops.map((o) => ({ ...o })),
			jobs = terrainExecutionJobs(ops, 32);
		const sample = (items: TerrainOp[], x: number, y: number, z: number) => {
			let mat = "Air";
			for (const o of items)
				if (
					x >= o.x - o.sx / 2 &&
					x < o.x + o.sx / 2 &&
					y >= o.y - o.sy / 2 &&
					y < o.y + o.sy / 2 &&
					z >= o.z - o.sz / 2 &&
					z < o.z + o.sz / 2
				)
					if (o.material !== "Water" || mat === "Air" || mat === "Water") mat = o.material;
			return mat;
		};
		const executed = jobs.map((j) => j.op);
		for (let x = -12; x <= 40; x += 4)
			for (let y = -8; y <= 24; y += 4)
				for (let z = -12; z <= 40; z += 4) expect(sample(executed, x, y, z)).toBe(sample(ops, x, y, z));
		expect(ops).toEqual(saved);
		for (const j of jobs) expect(j.cells).toBeLessThanOrEqual(32);
	});
	it("keeps Water as a native semantic barrier even for adjacent full-voxel boxes", () => {
		const ops = [box(0, 0, 0, 8, 8, 8, "Water"), box(8, 0, 0, 8, 8, 8, "Water")];
		expect(terrainExecutionJobs(ops, 32).map((j) => j.op)).toEqual(ops);
	});
	it("coalesces all three axes without crossing material barriers or mutating plans", () => {
		const ops: TerrainOp[] = [];
		for (const x of [2, 6]) for (const y of [2, 6]) for (const z of [2, 6]) ops.push(box(x, y, z, 4, 4, 4));
		ops.push(box(2, 2, 2, 4, 4, 4, "Grass"), box(2, 2, 2, 4, 4, 4));
		const snapshot = ops.map((o) => ({ ...o }));
		const jobs = coalesceTerrainJobs(terrainJobs(ops), 8);
		expect(jobs.size()).toBe(3);
		expect(ops).toEqual(snapshot);
		for (let x = 0; x < 8; x += 4)
			for (let y = 0; y < 8; y += 4)
				for (let z = 0; z < 8; z += 4) {
					const sample = (items: TerrainOp[]) => {
						let mat = "Air";
						for (const o of items)
							if (
								x >= o.x - o.sx / 2 &&
								x < o.x + o.sx / 2 &&
								y >= o.y - o.sy / 2 &&
								y < o.y + o.sy / 2 &&
								z >= o.z - o.sz / 2 &&
								z < o.z + o.sz / 2
							)
								mat = o.material;
						return mat;
					};
					expect(sample(jobs.map((j) => j.op))).toBe(sample(ops));
				}
		expect(coalesceTerrainJobs(terrainJobs(snapshot), 1).size()).toBe(10);
	});
});

describe("Legacy curved terrain cleanup bounds", () => {
	it("covers negative and partial boundary cells with an aligned, bounded Air footprint", () => {
		const op = terrainBoundsOp([-17.1, -379, -4], [15.5, 127, 18.1]);
		expect(alignedBlockRegion(op)).toEqual({ min: [-20, -380, -4], max: [16, 128, 20] });
		expect(op.material).toBe("Air");
		const jobs = terrainExecutionJobs([op], 128);
		expect(jobs.reduce((n, j) => n + j.cells, 0)).toBe(9 * 127 * 6);
		for (const job of jobs) {
			expect(job.cells).toBeLessThanOrEqual(128);
			expect(alignedBlockRegion(job.op)).toBeDefined();
		}
	});
});

describe("Planned curved terrain cleanup", () => {
	it("covers each curved write separately without joining distant worlds", () => {
		const ops: TerrainOp[] = [
			{ shape: "block", material: "Rock", x: -30000, y: 17, z: 6000, sx: 31, sy: 19, sz: 53, yaw: 0.7 },
			{ shape: "ball", material: "Grass", x: 30000, y: 100, z: 0, sx: 29, sy: 0, sz: 0, yaw: 0 },
			{ shape: "cylinder", material: "Rock", x: 100, y: 200, z: 300, sx: 31, sy: 59, sz: 0, yaw: 0 },
			{ shape: "bump", material: "Grass", x: -100, y: 20, z: 200, sx: 30, sy: 43, sz: 50, yaw: 0.4 },
		];
		for (const op of ops) {
			const erase = terrainCleanupOp(op),
				r = alignedBlockRegion(erase)!;
			expect(erase.material).toBe("Air");
			expect(r).toBeDefined();
			expect(erase.sx).toBeLessThan(200);
			expect(erase.sz).toBeLessThan(200);
			if (op.shape === "bump") expect(r).toEqual(bumpRegion(op));
			else
				for (const dx of [-1, 1])
					for (const dz of [-1, 1]) {
						const hx = op.shape === "block" ? op.sx / 2 : op.sx;
						const hz = op.shape === "block" ? op.sz / 2 : op.sx;
						const x =
							op.shape === "block"
								? op.x + math.cos(op.yaw) * dx * hx + math.sin(op.yaw) * dz * hz
								: op.x + dx * hx;
						const z =
							op.shape === "block"
								? op.z - math.sin(op.yaw) * dx * hx + math.cos(op.yaw) * dz * hz
								: op.z + dz * hz;
						expect(x >= r.min[0] && x <= r.max[0] && z >= r.min[2] && z <= r.max[2]).toBe(true);
					}
		}
	});
});
