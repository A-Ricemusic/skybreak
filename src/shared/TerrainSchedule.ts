import type { TerrainOp } from "./WorldPlan";

// Splits a world plan's ordered terrain ops into bounded jobs and runs them on a
// per-resumption time budget, so building a world never holds the server's
// heartbeat for the whole voxel batch. Pure: the clock and the pause are
// injected (the server passes os.clock and task.wait; specs pass fakes).
//
// Chunking keeps the plan's semantics exactly: every chunk of an op runs before
// the next op, and every cut lies on a 4-stud voxel plane, so no voxel is
// half-filled by two pieces: axis-aligned blocks tile in X, Z and Y; yawed blocks
// and upright cylinders slice in Y only (a yaw keeps horizontal planes
// horizontal); wedges and balls stay whole. A bump's ReadVoxels/WriteVoxels
// region splits into disjoint grid slices of the same region.

/** Most voxels one Fill call may cover (axis-aligned blocks are tiled to stay under it). */
export const FILL_CHUNK = 262144;
/** Most 4-stud cells one bump ReadVoxels/WriteVoxels slice may cover (the Luau loop visits each). */
export const BUMP_CHUNK = 32768;
/** Largest single Fill a plan may keep unsplit (a wedge or ball), under the engine's 4M-voxel region cap. */
export const UNSPLIT_MAX = 4194304;
/** Seconds of terrain work per resumption before yielding a frame. */
export const TERRAIN_BUDGET = 0.012;

export interface GridRegion {
	min: [number, number, number];
	max: [number, number, number];
}
export interface TerrainJob {
	op: TerrainOp;
	region?: GridRegion;
	cells: number;
}

const floor4 = (v: number) => math.floor(v / 4) * 4;
const ceil4 = (v: number) => math.ceil(v / 4) * 4;

/**
 * The grid-aligned ReadVoxels/WriteVoxels region of a bump: the rotated ellipse's
 * bounding box plus a voxel above and below, expanded to the 4-stud grid exactly
 * as Region3:ExpandToGrid(4) does. Shared by the executor and the plan's counts.
 */
export function bumpRegion(o: TerrainOp): GridRegion {
	const c = math.cos(o.yaw),
		s = math.sin(o.yaw);
	const hx = math.sqrt(c * o.sx * (c * o.sx) + s * o.sz * (s * o.sz));
	const hz = math.sqrt(s * o.sx * (s * o.sx) + c * o.sz * (c * o.sz));
	return {
		min: [floor4(o.x - hx), floor4(o.y - 4), floor4(o.z - hz)],
		max: [ceil4(o.x + hx), ceil4(o.y + o.sy + 4), ceil4(o.z + hz)],
	};
}
export function regionCells(r: GridRegion): number {
	return ((r.max[0] - r.min[0]) / 4) * ((r.max[1] - r.min[1]) / 4) * ((r.max[2] - r.min[2]) / 4);
}

/** Exact full-voxel box: only these may use FillRegion instead of the rotated shape rasterizer. */
export function alignedBlockRegion(o: TerrainOp): GridRegion | undefined {
	if (o.shape !== "block" || o.yaw !== 0) return undefined;
	const min: [number, number, number] = [o.x - o.sx / 2, o.y - o.sy / 2, o.z - o.sz / 2];
	const max: [number, number, number] = [o.x + o.sx / 2, o.y + o.sy / 2, o.z + o.sz / 2];
	for (let axis = 0; axis < 3; axis++) if (min[axis] % 4 !== 0 || max[axis] % 4 !== 0) return undefined;
	return { min, max };
}

/** Conservative Air box for an exclusively owned curved write, including partial cells. */
export function terrainBoundsOp(min: [number, number, number], max: [number, number, number]): TerrainOp {
	const lo = min.map(floor4),
		hi = max.map(ceil4);
	return {
		shape: "block",
		material: "Air",
		yaw: 0,
		x: (lo[0] + hi[0]) / 2,
		y: (lo[1] + hi[1]) / 2,
		z: (lo[2] + hi[2]) / 2,
		sx: hi[0] - lo[0],
		sy: hi[1] - lo[1],
		sz: hi[2] - lo[2],
	};
}

/** Sparse cleanup box for one write, including curved and partial boundary voxels.
 * Terrain has a single world owner, so the surrounding air is safe to erase. */
export function terrainCleanupOp(o: TerrainOp): TerrainOp {
	const exact = alignedBlockRegion(o);
	if (exact !== undefined) return { ...o, material: "Air" };
	if (o.shape === "bump") {
		const r = bumpRegion(o);
		return terrainBoundsOp(r.min, r.max);
	}
	const c = math.abs(math.cos(o.yaw)),
		s = math.abs(math.sin(o.yaw));
	const hx = o.shape === "ball" || o.shape === "cylinder" ? o.sx : (c * o.sx + s * o.sz) / 2;
	const hz = o.shape === "ball" || o.shape === "cylinder" ? o.sx : (s * o.sx + c * o.sz) / 2;
	const hy = o.shape === "ball" ? o.sx : o.sy / 2;
	return terrainBoundsOp([o.x - hx - 4, o.y - hy - 4, o.z - hz - 4], [o.x + hx + 4, o.y + hy + 4, o.z + hz + 4]);
}

/** Voxels a Fill op touches (the same estimate the plan's voxel-write count uses). */
export function fillVoxels(o: TerrainOp): number {
	if (o.shape === "block") return (o.sx * o.sy * o.sz) / 64;
	if (o.shape === "wedge") return (o.sx * o.sy * o.sz) / 128;
	if (o.shape === "ball") return ((4 / 3) * math.pi * o.sx * o.sx * o.sx) / 64;
	if (o.shape === "cylinder") return (math.pi * o.sx * o.sx * o.sy) / 64;
	return 0;
}

/** Cut points of [lo, hi] on multiples of `step` (a multiple of 4), ends included. */
function cuts(lo: number, hi: number, step: number): number[] {
	const out = [lo];
	for (let v = (math.floor(lo / step) + 1) * step; v < hi; v += step) out.push(v);
	out.push(hi);
	return out;
}

/** Horizontal slices on 4-stud planes: exact for any yaw-only block and an upright cylinder. */
function sliceY(o: TerrainOp, out: TerrainJob[], fillChunk: number): void {
	const voxels = fillVoxels(o);
	if (voxels <= fillChunk) {
		out.push({ op: o, cells: voxels });
		return;
	}
	const step = math.max(1, math.floor(fillChunk / ((voxels * 4) / o.sy))) * 4;
	const ys = cuts(o.y - o.sy / 2, o.y + o.sy / 2, step);
	for (let j = 1; j < ys.size(); j++) {
		const piece: TerrainOp = { ...o, y: (ys[j] + ys[j - 1]) / 2, sy: ys[j] - ys[j - 1] };
		out.push({ op: piece, cells: fillVoxels(piece) });
	}
}

function splitFill(o: TerrainOp, out: TerrainJob[], fillChunk: number): void {
	// A wedge's slope and a ball's curve have no seam-free split on the voxel grid; the plans keep them
	// small (UNSPLIT_MAX). Everything else is cut only along 4-stud voxel planes.
	if (fillVoxels(o) <= fillChunk || o.shape === "wedge" || o.shape === "ball") {
		out.push({ op: o, cells: fillVoxels(o) });
		return;
	}
	if (o.shape !== "block" || o.yaw !== 0) {
		sliceY(o, out, fillChunk);
		return;
	}
	// Axis-aligned slabs: square XZ tiles (256 to 1024 studs) on global multiples of the tile, then layers.
	let side = 64;
	while (side < 256 && side * 2 * (side * 2) * math.max(1, o.sy / 4) <= fillChunk) side *= 2;
	const step = side * 4;
	const xs = cuts(o.x - o.sx / 2, o.x + o.sx / 2, step),
		zs = cuts(o.z - o.sz / 2, o.z + o.sz / 2, step);
	for (let i = 1; i < xs.size(); i++)
		for (let k = 1; k < zs.size(); k++) {
			sliceY(
				{
					...o,
					x: (xs[i] + xs[i - 1]) / 2,
					z: (zs[k] + zs[k - 1]) / 2,
					sx: xs[i] - xs[i - 1],
					sz: zs[k] - zs[k - 1],
				},
				out,
				fillChunk,
			);
		}
}

function splitBump(o: TerrainOp, out: TerrainJob[]): void {
	const r = bumpRegion(o);
	const nx = (r.max[0] - r.min[0]) / 4,
		ny = (r.max[1] - r.min[1]) / 4,
		nz = (r.max[2] - r.min[2]) / 4;
	const wz = ny * nz <= BUMP_CHUNK ? nz : math.max(1, math.floor(BUMP_CHUNK / ny));
	const wx = math.max(1, math.floor(BUMP_CHUNK / (ny * wz)));
	for (let i = 0; i < nx; i += wx)
		for (let k = 0; k < nz; k += wz) {
			const region: GridRegion = {
				min: [r.min[0] + i * 4, r.min[1], r.min[2] + k * 4],
				max: [r.min[0] + math.min(nx, i + wx) * 4, r.max[1], r.min[2] + math.min(nz, k + wz) * 4],
			};
			out.push({ op: o, region, cells: regionCells(region) });
		}
}

/** The plan's ops as bounded jobs, in plan order. */
export function terrainJobs(ops: TerrainOp[], fillChunk = FILL_CHUNK): TerrainJob[] {
	const out: TerrainJob[] = [];
	for (const o of ops) {
		if (o.shape === "bump") splitBump(o, out);
		else splitFill(o, out, fillChunk);
	}
	return out;
}

/** Move a full-voxel write across disjoint writes only, with bounded lookback.
 * This exposes same-material unions hidden by interleaved caps and curtains.
 * Intersecting different materials, water, and shape jobs remain barriers.
 */
function commutingTerrainRuns(jobs: TerrainJob[]): TerrainJob[] {
	const groups: TerrainJob[][] = [];
	const eligible = new Set<TerrainJob>();
	for (const job of jobs)
		if (job.region === undefined && job.op.material !== "Water" && alignedBlockRegion(job.op) !== undefined)
			eligible.add(job);
	const overlaps = (a: TerrainOp, b: TerrainOp) =>
		math.abs(a.x - b.x) * 2 < a.sx + b.sx &&
		math.abs(a.y - b.y) * 2 < a.sy + b.sy &&
		math.abs(a.z - b.z) * 2 < a.sz + b.sz;
	for (const job of jobs) {
		const o = job.op;
		let placed = false,
			checked = 0;
		if (eligible.has(job)) {
			for (let i = groups.size() - 1; i >= 0 && checked < 64; i--) {
				const group = groups[i];
				if (group[0].op.material === o.material && eligible.has(group[0])) {
					group.push(job);
					placed = true;
					break;
				}
				let blocked = false;
				for (const prior of group) {
					checked++;
					if (checked >= 64) {
						blocked = true;
						break;
					}
					if (!eligible.has(prior) || overlaps(o, prior.op)) {
						blocked = true;
						break;
					}
				}
				if (blocked) break;
			}
		}
		if (!placed) groups.push([job]);
	}
	const out: TerrainJob[] = [];
	for (const group of groups) for (const job of group) out.push(job);
	return out;
}

/** Coalesce full-voxel boxes within a same-material run only. Such writes commute;
 * intersecting different materials and curved/partial voxels are ordering barriers. Operates
 * on execution jobs, never the retained plan or its fingerprint. */
export function coalesceTerrainJobs(jobs: TerrainJob[], limit = FILL_CHUNK): TerrainJob[] {
	const out: TerrainJob[] = [];
	let run: TerrainJob[] = [];
	const flush = () => {
		// A merge on Y can unlock X/Z unions; stop at the fixed point.
		let previousSize = -1;
		while (previousSize !== run.size()) {
			previousSize = run.size();
			for (const axis of ["x", "z", "y"] as const) {
				const size = axis === "x" ? "sx" : axis === "z" ? "sz" : "sy";
				const a = axis === "x" ? "y" : "x",
					b = axis === "z" ? "y" : "z";
				const sa = a === "x" ? "sx" : "sy",
					sb = b === "y" ? "sy" : "sz";
				run.sort((l, r) => {
					const x = l.op,
						y = r.op;
					if (x[a] !== y[a]) return x[a] < y[a];
					if (x[b] !== y[b]) return x[b] < y[b];
					if (x[sa] !== y[sa]) return x[sa] < y[sa];
					if (x[sb] !== y[sb]) return x[sb] < y[sb];
					return x[axis] < y[axis];
				});
				const merged: TerrainJob[] = [];
				for (const job of run) {
					const prev = merged[merged.size() - 1],
						o = job.op,
						p = prev?.op;
					if (
						p !== undefined &&
						p[a] === o[a] &&
						p[b] === o[b] &&
						p[sa] === o[sa] &&
						p[sb] === o[sb] &&
						p[axis] + p[size] / 2 === o[axis] - o[size] / 2 &&
						prev.cells + job.cells <= limit
					) {
						p[axis] = (p[axis] - p[size] / 2 + o[axis] + o[size] / 2) / 2;
						p[size] += o[size];
						prev.cells += job.cells;
					} else merged.push({ op: { ...o }, cells: job.cells });
				}
				run = merged;
			}
		}
		for (const job of run) out.push(job);
		run = [];
	};
	for (const job of commutingTerrainRuns(jobs)) {
		if (job.region !== undefined || job.op.material === "Water" || alignedBlockRegion(job.op) === undefined) {
			flush();
			out.push(job);
			continue;
		}
		if (run.size() > 0 && run[0].op.material !== job.op.material) flush();
		run.push(job);
	}
	flush();
	return out;
}

/** Optimize execution boxes before artificial chunk cuts, then enforce the same cap. */
export function terrainExecutionJobs(ops: TerrainOp[], fillChunk = FILL_CHUNK): TerrainJob[] {
	const boxes = coalesceTerrainJobs(
		ops.map((op) => ({ op, cells: fillVoxels(op) })),
		fillChunk,
	);
	return coalesceTerrainJobs(
		terrainJobs(
			boxes.map((job) => job.op),
			fillChunk,
		),
		fillChunk,
	);
}

export interface BudgetProgress {
	completed: number;
	jobs: number;
	workSeconds: number;
	yields: number;
	stage: "prepare" | "work" | "yield" | "cancelled" | "complete" | "failed";
}

export interface BudgetRun {
	completed: number;
	complete: boolean;
	yields: number;
	longest: number;
	longestBatch: number;
	total: number;
}
export interface BudgetOptions {
	budget: number;
	clock: () => number;
	pause: () => void;
	cancelled?: () => boolean;
	progress?: BudgetProgress;
}

/**
 * Runs `work` over `items` in order, pausing whenever one resumption has used `budget`
 * seconds. Cancellation returns complete=false, never evidence of successful cleanup.
 * The optional progress object is updated in place before work/yields; it survives
 * an externally stopped coroutine without requiring finally to execute.
 */
export function runBudgeted<T>(items: T[], work: (item: T) => void, options: BudgetOptions): BudgetRun {
	let yields = 0,
		longest = 0,
		longestBatch = 0,
		total = 0;
	const progress: BudgetProgress = options.progress ?? {
		completed: 0,
		jobs: items.size(),
		workSeconds: 0,
		yields: 0,
		stage: "work",
	};
	progress.completed = 0;
	progress.jobs = items.size();
	progress.workSeconds = 0;
	progress.yields = 0;
	progress.stage = "work";
	let slice = options.clock();
	for (const item of items) {
		if (options.cancelled?.()) {
			progress.stage = "cancelled";
			break;
		}
		progress.stage = "work";
		const start = options.clock();
		work(item);
		progress.completed++;
		const finish = options.clock();
		longest = math.max(longest, finish - start);
		total += finish - start;
		progress.workSeconds = total;
		longestBatch = math.max(longestBatch, finish - slice);
		if (finish - slice >= options.budget) {
			progress.stage = "yield";
			progress.yields++;
			options.pause();
			yields += 1;
			slice = options.clock();
		}
	}
	const complete = progress.completed === items.size() && !options.cancelled?.();
	progress.stage = complete ? "complete" : "cancelled";
	return { yields, longest, longestBatch, total, completed: progress.completed, complete };
}
