import type { Rgb } from "../../EnvironmentPresets";
import type { PartSpec, TerrainMaterial, TerrainOp, WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";

/**
 * Bounded native-geometry helpers for the late-campaign (M13-M18) rebuild.
 * Pure data authoring only: no Instances, no uploaded assets, no runtime
 * imports of the shared planners (avoids back-edges into AC04WorldData).
 */
export const LATE_LAND = 64;
export const LATE_SEA = 32;
/** Engine cap for one unsplit Fill region (mirrors TerrainSchedule.UNSPLIT_MAX). */
export const LATE_UNSPLIT_MAX = 4194304;

export const LateV = (x: number, y: number, z: number): FlightPoint => ({ x, y, z });

/** Local offset -> world offset for CFrame.Angles(0, yaw, 0) (matches WorldPlan.toWorld). */
export function lateToWorld(lx: number, lz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * lx + s * lz, -s * lx + c * lz];
}
/** World offset -> local (inverse of the above, matches WorldPlan.toLocal). */
export function lateToLocal(dx: number, dz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * dx - s * dz, s * dx + c * dz];
}
/** Yaw that turns local +X along (dx, dz). */
export function lateAxisYaw(dx: number, dz: number): number { return math.atan2(-dz, dx); }

/** Deterministic hash in [0, 1). No math.random: geometry must be reproducible. */
export function lateHash(a: number, b = 0, c = 0): number {
	const v = math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
	return v - math.floor(v);
}

export function latePart(plan: WorldPlan, name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
	color: Rgb, material: string, solid: boolean, shape: PartSpec["shape"] = "block", yaw = 0, grounded = false): PartSpec {
	const spec: PartSpec = { name, shape, x, y, z, sx, sy, sz, yaw, color, material, solid, grounded };
	plan.parts.push(spec);
	return spec;
}
export function lateBlock(plan: WorldPlan, material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): void {
	plan.ops.push({ shape: "block", material, x, y, z, sx, sy, sz, yaw });
}

/**
 * A ridge is a triangular prism: crest along A->B at `base + height`, falling
 * linearly to `base` at `halfWidth` either side. Authored as native wedge pairs.
 */
export interface LateRidge { ax: number; az: number; bx: number; bz: number; halfWidth: number; height: number; material: TerrainMaterial; base: number; label: string }

/** Analytic height of one ridge at (x, z), or base-level -huge when outside. */
export function lateRidgeHeight(r: LateRidge, x: number, z: number): number {
	const dx = r.bx - r.ax, dz = r.bz - r.az, len = math.sqrt(dx * dx + dz * dz);
	if (len <= 0 || r.height <= 0) return -math.huge;
	const yaw = lateAxisYaw(dx, dz);
	const [lx, lz] = lateToLocal(x - (r.ax + r.bx) / 2, z - (r.az + r.bz) / 2, yaw);
	if (math.abs(lx) > len / 2 || math.abs(lz) > r.halfWidth) return -math.huge;
	return r.base + r.height * (1 - math.abs(lz) / r.halfWidth);
}
export function lateTerrainHeight(ridges: LateRidge[], x: number, z: number, floor: number): number {
	let top = floor;
	for (const r of ridges) top = math.max(top, lateRidgeHeight(r, x, z));
	return top;
}

/**
 * Lowers ridge crests so no ridge reaches above any cap point (cap.y is the
 * highest terrain allowed at that location). Used to keep authored jammers,
 * flight corridors and river channels exposed while retaining source altitudes.
 */
export function lateCapRidges(ridges: LateRidge[], caps: FlightPoint[]): void {
	for (const r of ridges) {
		for (const cap of caps) {
			const dx = r.bx - r.ax, dz = r.bz - r.az, len = math.sqrt(dx * dx + dz * dz);
			if (len <= 0) continue;
			const yaw = lateAxisYaw(dx, dz);
			const [lx, lz] = lateToLocal(cap.x - (r.ax + r.bx) / 2, cap.z - (r.az + r.bz) / 2, yaw);
			if (math.abs(lx) > len / 2 || math.abs(lz) >= r.halfWidth) continue;
			const fraction = 1 - math.abs(lz) / r.halfWidth;
			const allowed = (cap.y - r.base) / fraction;
			if (allowed < r.height) r.height = math.max(0, allowed);
		}
	}
}

/** Emits a ridge as wedge pairs, chunked along the crest under the unsplit cap. */
export function lateEmitRidge(plan: WorldPlan, r: LateRidge): number {
	const dx = r.bx - r.ax, dz = r.bz - r.az, len = math.sqrt(dx * dx + dz * dz);
	if (len <= 0 || r.height < 8) return 0;
	const h = math.floor(r.height), w = r.halfWidth;
	const cellsAcross = ((h + 8) / 4) * ((w + 8) / 4);
	const maxChunk = math.max(16, math.min(640, math.floor((LATE_UNSPLIT_MAX - 1) / cellsAcross) * 4 - 16));
	const count = math.ceil(len / maxChunk), chunk = len / count, yaw = lateAxisYaw(dx, dz);
	for (let i = 0; i < count; i++) {
		const t = (i + 0.5) / count, cx = r.ax + dx * t, cz = r.az + dz * t;
		const [ox, oz] = lateToWorld(0, -w / 2, yaw);
		plan.ops.push({ shape: "wedge", material: r.material, x: cx + ox, y: r.base + h / 2, z: cz + oz, sx: chunk, sy: h, sz: w, yaw });
		plan.ops.push({ shape: "wedge", material: r.material, x: cx - ox, y: r.base + h / 2, z: cz - oz, sx: chunk, sy: h, sz: w, yaw: yaw + math.pi });
	}
	return count * 2;
}
export const LateRidgeOf = (ax: number, az: number, bx: number, bz: number, halfWidth: number, height: number, material: TerrainMaterial, label: string, base = LATE_LAND): LateRidge =>
	({ ax, az, bx, bz, halfWidth, height, material, base, label });

/** Water channel along a polyline: air carve, sand bed and water to sea level. */
export function lateChannel(plan: WorldPlan, points: number[][], width: number, carveTop = 900): void {
	for (let i = 1; i < points.size(); i++) {
		const [ax, az] = points[i - 1], [bx, bz] = points[i];
		const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz), yaw = lateAxisYaw(dx, dz);
		const cx = (ax + bx) / 2, cz = (az + bz) / 2, along = len + width * 0.6;
		plan.ops.push({ shape: "block", material: "Air", x: cx, y: carveTop / 2, z: cz, sx: along, sy: carveTop, sz: width, yaw });
		plan.ops.push({ shape: "block", material: "Sand", x: cx, y: 0, z: cz, sx: along, sy: 16, sz: width + 40, yaw });
		plan.ops.push({ shape: "block", material: "Water", x: cx, y: 20, z: cz, sx: along, sy: 24, sz: width, yaw });
	}
}

/** Removes base-plan parts by exact name; returns how many were removed. */
export function lateRemoveParts(plan: WorldPlan, names: string[]): number {
	const before = plan.parts.size();
	plan.parts = plan.parts.filter((p) => !names.includes(p.name));
	return before - plan.parts.size();
}
export function lateKeepOps(plan: WorldPlan, keep: (op: TerrainOp, index: number) => boolean): number {
	const before = plan.ops.size();
	const kept: TerrainOp[] = [];
	for (let i = 0; i < plan.ops.size(); i++) if (keep(plan.ops[i], i)) kept.push(plan.ops[i]);
	plan.ops = kept;
	return before - kept.size();
}
export function lateSetMaterialColor(plan: WorldPlan, material: TerrainMaterial, color: Rgb): void {
	plan.materialColors = plan.materialColors.filter(([m]) => m !== material);
	plan.materialColors.push([material, color]);
}

/** Horizontal clearance from a rotated part footprint to a point (0 inside). */
export function latePartPointDistance(p: PartSpec, x: number, z: number): number {
	const hx = p.sx / 2, hz = (p.shape === "cylinder" || p.shape === "ball" ? p.sx : p.sz) / 2;
	const [lx, lz] = lateToLocal(x - p.x, z - p.z, p.yaw);
	const ex = math.max(math.abs(lx) - hx, 0), ez = math.max(math.abs(lz) - hz, 0);
	return math.sqrt(ex * ex + ez * ez);
}

/** Keep-out disc: authored scenery may not come within `radius` of (x, z). */
export interface LateKeepOut { x: number; z: number; radius: number; label: string; /** Also vetoes flat decoration (roads, causeways): berths and portals. */ hard?: boolean }
export function lateClear(p: PartSpec, keepOut: LateKeepOut[]): boolean {
	for (const k of keepOut) if (latePartPointDistance(p, k.x, k.z) < k.radius) return false;
	return true;
}
/** Adds a part only when it respects every keep-out; returns whether it was placed. */
export function latePartClear(plan: WorldPlan, keepOut: LateKeepOut[], name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
	color: Rgb, material: string, solid: boolean, shape: PartSpec["shape"] = "block", yaw = 0): boolean {
	const spec: PartSpec = { name, shape, x, y, z, sx, sy, sz, yaw, color, material, solid, grounded: false };
	if (!lateClear(spec, keepOut)) return false;
	plan.parts.push(spec);
	return true;
}

/**
 * A city district: building lots on a rotated street grid. Height comes from a
 * caller profile (skyline shape), so districts read differently at altitude.
 */
export interface LateDistrict {
	label: string; cx: number; cz: number; yaw: number; ground: number;
	cols: number; rows: number; lot: number; street: number;
	/** Lots whose (col,row) return false are streets/plazas/parks. */
	open?: (col: number, row: number) => boolean;
	height: (col: number, row: number, h: number) => number;
	footprint: number; palette: Rgb[]; material: string;
	windows?: Rgb; flooded?: number; seed: number;
	/** Parapet/roof cap on taller buildings for a stepped silhouette. */
	crownAbove?: number;
}
export function lateBuildDistrict(plan: WorldPlan, d: LateDistrict, keepOut: LateKeepOut[], maxParts: number): number {
	let added = 0;
	const pitch = d.lot + d.street;
	for (let col = 0; col < d.cols; col++) for (let row = 0; row < d.rows; row++) {
		if (added >= maxParts) return added;
		if (d.open !== undefined && !d.open(col, row)) continue;
		const h = lateHash(d.seed, col, row);
		const height = d.height(col, row, h);
		if (height < 8) continue;
		const lx = (col - (d.cols - 1) / 2) * pitch, lz = (row - (d.rows - 1) / 2) * pitch;
		const [ox, oz] = lateToWorld(lx, lz, d.yaw);
		const size = d.footprint * (0.72 + 0.28 * lateHash(d.seed + 7, col, row));
		const depth = d.footprint * (0.72 + 0.28 * lateHash(d.seed + 11, row, col));
		const sink = d.flooded ?? 0;
		const color = d.palette[math.floor(h * d.palette.size()) % d.palette.size()];
		const placed = latePartClear(plan, keepOut, `${d.label} building`, d.cx + ox, d.ground - sink + height / 2, d.cz + oz, size, height, depth, color, d.material, true, "block", d.yaw);
		if (!placed) continue;
		added++;
		if (d.crownAbove !== undefined && height > d.crownAbove && added < maxParts) {
			latePart(plan, `${d.label} crown`, d.cx + ox, d.ground - sink + height + 9, d.cz + oz, size * 0.62, 18, depth * 0.62, color, d.material, true, "block", d.yaw);
			added++;
		}
		if (d.windows !== undefined && sink === 0 && height > 40 && added < maxParts) {
			const [fx, fz] = lateToWorld(0, depth / 2 + 0.6, d.yaw);
			latePart(plan, `${d.label} lit windows`, d.cx + ox + fx, d.ground + height * 0.55, d.cz + oz + fz, size * 0.8, height * 0.5, 1, d.windows, "Neon", false, "block", d.yaw);
			added++;
		}
	}
	return added;
}

/** Straight road or causeway ribbon, decoration only (never flight-solid). */
export function lateRoad(plan: WorldPlan, keepOut: LateKeepOut[], name: string, ax: number, az: number, bx: number, bz: number, width: number, y: number, color: Rgb): number {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz);
	if (len <= 0) return 0;
	const yaw = lateAxisYaw(dx, dz);
	// Long ribbons are split to stay under the 2048-stud part limit.
	const count = math.ceil(len / 1800);
	let added = 0;
	for (let i = 0; i < count; i++) {
		const t = (i + 0.5) / count;
		const spec: PartSpec = { name, shape: "block", x: ax + dx * t, y, z: az + dz * t, sx: len / count, sy: 1, sz: width, yaw, color, material: "Asphalt", solid: false, grounded: false };
		// Roads are flat decoration; only hard keep-outs (naval berths, portals)
		// veto them, so streets may run beside and under ground-target pads.
		if (!lateClear(spec, keepOut.filter((k) => k.hard === true))) continue;
		plan.parts.push(spec);
		added++;
	}
	return added;
}

/** A straight wall/berm split into short pieces; only pieces violating a keep-out are dropped. */
export function lateSegmentedWall(plan: WorldPlan, keepOut: LateKeepOut[], name: string, ax: number, az: number, bx: number, bz: number,
	thickness: number, height: number, baseY: number, color: Rgb, material: string, pieceLength = 120): number {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz);
	if (len <= 0) return 0;
	const n = math.max(1, math.ceil(len / pieceLength)), yaw = lateAxisYaw(dx, dz);
	let added = 0;
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n;
		if (latePartClear(plan, keepOut, name, ax + dx * t, baseY + height / 2, az + dz * t, len / n, height, thickness, color, material, true, "block", yaw)) added++;
	}
	return added;
}
