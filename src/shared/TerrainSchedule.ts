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

export interface GridRegion { min: [number, number, number]; max: [number, number, number] }
export interface TerrainJob { op: TerrainOp; region?: GridRegion; cells: number }

const floor4 = (v: number) => math.floor(v / 4) * 4;
const ceil4 = (v: number) => math.ceil(v / 4) * 4;

/**
 * The grid-aligned ReadVoxels/WriteVoxels region of a bump: the rotated ellipse's
 * bounding box plus a voxel above and below, expanded to the 4-stud grid exactly
 * as Region3:ExpandToGrid(4) does. Shared by the executor and the plan's counts.
 */
export function bumpRegion(o: TerrainOp): GridRegion {
	const c = math.cos(o.yaw), s = math.sin(o.yaw);
	const hx = math.sqrt((c * o.sx) * (c * o.sx) + (s * o.sz) * (s * o.sz));
	const hz = math.sqrt((s * o.sx) * (s * o.sx) + (c * o.sz) * (c * o.sz));
	return {
		min: [floor4(o.x - hx), floor4(o.y - 4), floor4(o.z - hz)],
		max: [ceil4(o.x + hx), ceil4(o.y + o.sy + 4), ceil4(o.z + hz)],
	};
}
export function regionCells(r: GridRegion): number {
	return ((r.max[0] - r.min[0]) / 4) * ((r.max[1] - r.min[1]) / 4) * ((r.max[2] - r.min[2]) / 4);
}

/** Voxels a Fill op touches (the same estimate the plan's voxel-write count uses). */
export function fillVoxels(o: TerrainOp): number {
	if (o.shape === "block") return o.sx * o.sy * o.sz / 64;
	if (o.shape === "wedge") return o.sx * o.sy * o.sz / 128;
	if (o.shape === "ball") return 4 / 3 * math.pi * o.sx * o.sx * o.sx / 64;
	if (o.shape === "cylinder") return math.pi * o.sx * o.sx * o.sy / 64;
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
function sliceY(o: TerrainOp, out: TerrainJob[]): void {
	const voxels = fillVoxels(o);
	if (voxels <= FILL_CHUNK) { out.push({ op: o, cells: voxels }); return; }
	const step = math.max(1, math.floor(FILL_CHUNK / (voxels * 4 / o.sy))) * 4;
	const ys = cuts(o.y - o.sy / 2, o.y + o.sy / 2, step);
	for (let j = 1; j < ys.size(); j++) {
		const piece: TerrainOp = { ...o, y: (ys[j] + ys[j - 1]) / 2, sy: ys[j] - ys[j - 1] };
		out.push({ op: piece, cells: fillVoxels(piece) });
	}
}

function splitFill(o: TerrainOp, out: TerrainJob[]): void {
	// A wedge's slope and a ball's curve have no seam-free split on the voxel grid; the plans keep them
	// small (UNSPLIT_MAX). Everything else is cut only along 4-stud voxel planes.
	if (fillVoxels(o) <= FILL_CHUNK || o.shape === "wedge" || o.shape === "ball") { out.push({ op: o, cells: fillVoxels(o) }); return; }
	if (o.shape !== "block" || o.yaw !== 0) { sliceY(o, out); return; }
	// Axis-aligned slabs: square XZ tiles (256 to 1024 studs) on global multiples of the tile, then layers.
	let side = 64;
	while (side < 256 && (side * 2) * (side * 2) * math.max(1, o.sy / 4) <= FILL_CHUNK) side *= 2;
	const step = side * 4;
	const xs = cuts(o.x - o.sx / 2, o.x + o.sx / 2, step), zs = cuts(o.z - o.sz / 2, o.z + o.sz / 2, step);
	for (let i = 1; i < xs.size(); i++) for (let k = 1; k < zs.size(); k++) {
		sliceY({ ...o, x: (xs[i] + xs[i - 1]) / 2, z: (zs[k] + zs[k - 1]) / 2, sx: xs[i] - xs[i - 1], sz: zs[k] - zs[k - 1] }, out);
	}
}

function splitBump(o: TerrainOp, out: TerrainJob[]): void {
	const r = bumpRegion(o);
	const nx = (r.max[0] - r.min[0]) / 4, ny = (r.max[1] - r.min[1]) / 4, nz = (r.max[2] - r.min[2]) / 4;
	const wz = ny * nz <= BUMP_CHUNK ? nz : math.max(1, math.floor(BUMP_CHUNK / ny));
	const wx = math.max(1, math.floor(BUMP_CHUNK / (ny * wz)));
	for (let i = 0; i < nx; i += wx) for (let k = 0; k < nz; k += wz) {
		const region: GridRegion = {
			min: [r.min[0] + i * 4, r.min[1], r.min[2] + k * 4],
			max: [r.min[0] + math.min(nx, i + wx) * 4, r.max[1], r.min[2] + math.min(nz, k + wz) * 4],
		};
		out.push({ op: o, region, cells: regionCells(region) });
	}
}

/** The plan's ops as bounded jobs, in plan order. */
export function terrainJobs(ops: TerrainOp[]): TerrainJob[] {
	const out: TerrainJob[] = [];
	for (const o of ops) {
		if (o.shape === "bump") splitBump(o, out);
		else splitFill(o, out);
	}
	return out;
}

export interface BudgetRun { yields: number; longest: number; total: number }
export interface BudgetOptions { budget: number; clock: () => number; pause: () => void }

/**
 * Runs `work` over `items` in order, pausing whenever one resumption has used `budget`
 * seconds. Reports the yields, the longest single item and the total work time.
 */
export function runBudgeted<T>(items: T[], work: (item: T) => void, options: BudgetOptions): BudgetRun {
	let yields = 0, longest = 0, total = 0;
	let slice = options.clock();
	for (const item of items) {
		const start = options.clock();
		work(item);
		const finish = options.clock();
		longest = math.max(longest, finish - start);
		total += finish - start;
		if (finish - slice >= options.budget) {
			options.pause();
			yields += 1;
			slice = options.clock();
		}
	}
	return { yields, longest, total };
}
