import type { EnvironmentPreset } from "./WorldTypes";
import type { Rgb } from "./EnvironmentPresets";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";

/** Generic terrain and scenery description used by the AC04 world authoring system. */
export type TerrainMaterial = "Grass" | "LeafyGrass" | "Ground" | "Mud" | "Sand" | "Sandstone" | "Rock" | "Slate" | "Basalt" | "Snow" | "Concrete" | "Pavement" | "Water" | "Air";
/**
 * block: box centred on (x, y, z) of size (sx, sy, sz). wedge: WedgePart-shaped
 * box, full height at local +Z, zero at local -Z. ball: centre (x, y, z), radius
 * sx. cylinder: upright, radius sx, height sy, centred on y. bump: a smooth hill
 * rising from y with ellipse radii (sx, sz) and height sy (cosine profile),
 * written with WriteVoxels so only the hill itself is touched.
 */
export type TerrainShape = "block" | "wedge" | "ball" | "cylinder" | "bump";
export interface TerrainOp { shape: TerrainShape; material: TerrainMaterial; x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }

export type PartShape = "block" | "wedge" | "cylinder" | "ball";
/** A primitive part. Cylinders are upright with diameter sx and height sy. */
export interface PartSpec {
	name: string; shape: PartShape; x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number;
	color: Rgb; material: string;
	/** Flight-solid (queried by aircraft sweeps). Decoration is not. */
	solid: boolean;
	/** Must rest on terrain (audited); elevated decks and bridges are not. */
	grounded: boolean;
	transparency?: number; reflectance?: number;
}

export type PropAsset = "Frigate" | "OilPlatform" | "HarbourQuay" | "ContainerStack" | "GantryCrane" | "Hangar" | "ControlTower" | "OfficeMidrise" | "ApartmentBlock" | "CityTower" | "Farmhouse" | "Barn" | "GrainSilo" | "RadarDish" | "RelayMast" | "Pine" | "Broadleaf" | "RockA" | "RockB" | "RockC";
export interface PropSpec { asset: PropAsset; x: number; y: number; z: number; yaw: number; scale: number; tint: number; tag?: string }
/** Ground-target site: the model is grounded with its bounds' bottom at baseY. */
export interface TargetSite { index: number; x: number; z: number; baseY: number; apron: number; deck: boolean }
/** A protected boat's path (escort/defend/parked points on coast or ocean missions). */
export interface WaterPath { points: number[][]; half: number; canal: boolean; beachEnd: boolean }
/** Terrain and structures must stay below `limit` within `rad` of (x, z). */
export interface AirSample { x: number; z: number; limit: number; rad: number; label: string }
export type Theme = "farm" | "canyon" | "plateau" | "coast" | "ocean";

export interface WorldPlan {
	id: number; name: string; theme: Theme; environment: EnvironmentPreset; lamps: boolean;
	ground: number; waterY?: number; coastZ?: number;
	ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]; targets: TargetSite[];
	waterPaths: WaterPath[]; groundPaths: number[][][]; air: AirSample[];
	materialColors: Array<[TerrainMaterial, Rgb]>;
}

/** World offset -> local (inverse of CFrame.Angles(0, yaw, 0)). */
function toLocal(dx: number, dz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * dx - s * dz, s * dx + c * dz];
}
/** Local offset -> world offset. */
function toWorld(lx: number, lz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * lx + s * lz, -s * lx + c * lz];
}
/** Yaw that turns local +X along (dx, dz). */
function axisYaw(dx: number, dz: number): number { return math.atan2(-dz, dx); }
/** Yaw that points an asset's front (-Z) along (dx, dz). */
export function faceYaw(dx: number, dz: number): number { return math.atan2(-dx, -dz); }
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
	const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
	const t = len2 > 0 ? math.clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1) : 0;
	const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
	return math.sqrt(dx * dx + dz * dz);
}
export function polyDist(px: number, pz: number, points: number[][]): number {
	if (points.size() === 1) return math.sqrt((px - points[0][0]) * (px - points[0][0]) + (pz - points[0][1]) * (pz - points[0][1]));
	let best = math.huge;
	for (let i = 1; i < points.size(); i++) best = math.min(best, segDist(px, pz, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
	return best;
}
interface Rect { x: number; z: number; hx: number; hz: number; yaw: number }
function rectPointDist(r: Rect, px: number, pz: number): number {
	const [lx, lz] = toLocal(px - r.x, pz - r.z, r.yaw);
	const ex = math.max(math.abs(lx) - r.hx, 0), ez = math.max(math.abs(lz) - r.hz, 0);
	return math.sqrt(ex * ex + ez * ez);
}
/** Distance between a rectangle and a polyline (sampled every 6 studs). */
export function rectPolyDist(r: Rect, points: number[][]): number {
	let best = math.huge;
	if (points.size() === 1) return rectPointDist(r, points[0][0], points[0][1]);
	for (let i = 1; i < points.size(); i++) {
		const [ax, az] = points[i - 1], [bx, bz] = points[i];
		const n = math.max(1, math.ceil(math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)) / 6));
		for (let k = 0; k <= n; k++) best = math.min(best, rectPointDist(r, ax + (bx - ax) * k / n, az + (bz - az) * k / n));
	}
	return best;
}
function rectsOverlap(a: Rect, b: Rect, pad: number): boolean {
	// Conservative: circumscribed-circle test, then corner containment both ways.
	const ra = math.sqrt(a.hx * a.hx + a.hz * a.hz), rb = math.sqrt(b.hx * b.hx + b.hz * b.hz);
	const dx = a.x - b.x, dz = a.z - b.z;
	if (dx * dx + dz * dz > (ra + rb + pad) * (ra + rb + pad)) return false;
	const corners = (r: Rect) => {
		const out: number[][] = [];
		for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
			const [wx, wz] = toWorld(sx * r.hx, sz * r.hz, r.yaw);
			out.push([r.x + wx, r.z + wz]);
		}
		return out;
	};
	for (const [x, z] of corners(a)) if (rectPointDist(b, x, z) <= pad) return true;
	for (const [x, z] of corners(b)) if (rectPointDist(a, x, z) <= pad) return true;
	// Edge crossings without contained corners (a cross shape).
	for (const [x, z] of corners(a)) if (rectPolyDist(b, [[a.x, a.z], [x, z]]) <= pad) return true;
	return false;
}

// --- terrain columns --------------------------------------------------------
export function bumpProfile(d: number): number { return d >= 1 ? 0 : 0.5 + 0.5 * math.cos(math.pi * d); }
function opReach(op: TerrainOp): number {
	if (op.shape === "ball" || op.shape === "cylinder") return op.sx;
	if (op.shape === "bump") return math.max(op.sx, op.sz);
	return math.sqrt(op.sx * op.sx + op.sz * op.sz) / 2;
}
/** Vertical interval an op covers at (x, z), if any. */
export function opSpan(op: TerrainOp, x: number, z: number): [number, number] | undefined {
	const dx = x - op.x, dz = z - op.z, reach = opReach(op);
	if (math.abs(dx) > reach || math.abs(dz) > reach) return undefined;
	if (op.shape === "ball") {
		const d2 = dx * dx + dz * dz;
		if (d2 >= op.sx * op.sx) return undefined;
		const h = math.sqrt(op.sx * op.sx - d2);
		return [op.y - h, op.y + h];
	}
	if (op.shape === "cylinder") return dx * dx + dz * dz < op.sx * op.sx ? [op.y - op.sy / 2, op.y + op.sy / 2] : undefined;
	const [lx, lz] = toLocal(dx, dz, op.yaw);
	if (op.shape === "bump") {
		const q = math.sqrt((lx / op.sx) * (lx / op.sx) + (lz / op.sz) * (lz / op.sz));
		const h = op.sy * bumpProfile(q);
		return h > 0 ? [op.y, op.y + h] : undefined;
	}
	if (math.abs(lx) > op.sx / 2 || math.abs(lz) > op.sz / 2) return undefined;
	const bottom = op.y - op.sy / 2;
	if (op.shape === "wedge") return [bottom, bottom + op.sy * (lz + op.sz / 2) / op.sz];
	return [bottom, op.y + op.sy / 2];
}
export interface Segment { lo: number; hi: number; material: TerrainMaterial }
/** The terrain column at (x, z): ops painted in order, overwrite semantics (bumps only add). */
export function terrainColumn(ops: TerrainOp[], x: number, z: number): Segment[] {
	let segments: Segment[] = [];
	for (const op of ops) {
		const span = opSpan(op, x, z);
		if (span === undefined) continue;
		const [lo, hi] = span;
		if (hi <= lo) continue;
		if (op.shape === "bump") {
			// Additive: fill only the air gaps inside [lo, hi].
			let gaps: Array<[number, number]> = [[lo, hi]];
			for (const s of segments) {
				const kept: Array<[number, number]> = [];
				for (const [a, b] of gaps) {
					if (s.hi <= a || s.lo >= b) { kept.push([a, b]); continue; }
					if (s.lo > a) kept.push([a, s.lo]);
					if (s.hi < b) kept.push([s.hi, b]);
				}
				gaps = kept;
			}
			for (const [a, b] of gaps) segments.push({ lo: a, hi: b, material: op.material });
			continue;
		}
		const out: Segment[] = [];
		for (const s of segments) {
			if (s.hi <= lo || s.lo >= hi) { out.push(s); continue; }
			if (s.lo < lo) out.push({ lo: s.lo, hi: lo, material: s.material });
			if (s.hi > hi) out.push({ lo: hi, hi: s.hi, material: s.material });
		}
		if (op.material !== "Air") out.push({ lo, hi, material: op.material });
		segments = out;
	}
	return segments;
}
/** Highest solid terrain top at (x, z) and the water surface above it, if any. */
export function terrainTop(ops: TerrainOp[], x: number, z: number): { solid: number; water?: number } {
	let solid = -math.huge, water: number | undefined;
	const column = terrainColumn(ops, x, z);
	for (const s of column) if (s.material !== "Water") solid = math.max(solid, s.hi);
	for (const s of column) if (s.material === "Water" && s.hi > solid) water = math.max(water ?? -math.huge, s.hi);
	return { solid, water };
}

function partRect(p: PartSpec): Rect {
	return { x: p.x, z: p.z, hx: p.sx / 2, hz: (p.shape === "cylinder" || p.shape === "ball" ? p.sx : p.sz) / 2, yaw: p.yaw };
}
export function propBox(p: PropSpec): { rect: Rect; bottom: number; top: number } {
	const spec = UploadedAssetSpecs[p.asset];
	const bottom = p.y - spec.groundOffset * p.scale;
	return { rect: { x: p.x, z: p.z, hx: spec.size.X * p.scale / 2, hz: spec.size.Z * p.scale / 2, yaw: p.yaw }, bottom, top: bottom + spec.size.Y * p.scale };
}
export interface Surface { y: number; kind: "terrain" | "water" | "part" | "prop" | "void"; name: string }
/** What a ray dropped at (x, z) hits first: terrain, water, a solid part or a prop's bounding box. */
export function surfaceAt(plan: WorldPlan, x: number, z: number): Surface {
	const t = terrainTop(plan.ops, x, z);
	let best: Surface = t.water !== undefined ? { y: t.water, kind: "water", name: "Water" } : t.solid > -math.huge ? { y: t.solid, kind: "terrain", name: "Terrain" } : { y: -math.huge, kind: "void", name: "" };
	for (const p of plan.parts) {
		if (!p.solid) continue;
		const top = p.y + p.sy / 2;
		if (top > best.y && rectPointDist(partRect(p), x, z) <= 0) best = { y: top, kind: "part", name: p.name };
	}
	for (const p of plan.props) {
		const box = propBox(p);
		if (box.top > best.y && rectPointDist(box.rect, x, z) <= 0) best = { y: box.top, kind: "prop", name: p.asset };
	}
	return best;
}
/** Terrain samples plus conservative, rotated collider bounds for every solid
 * part and uploaded prop intersecting the clearance disc. Thin masts and rails
 * must not disappear between the terrain probes. Mesh bounds overestimate the
 * rendered collider; engine terrain voxelization still needs a live check. */
export function solidTopWithin(plan: WorldPlan, x: number, z: number, rad: number): number {
	let top = -math.huge;
	const probe = (px: number, pz: number) => { const s = terrainTop(plan.ops, px, pz); top = math.max(top, s.solid, s.water ?? -math.huge); };
	probe(x, z);
	for (const r of [rad / 2, rad]) for (let k = 0; k < 8; k++) probe(x + math.cos(k * math.pi / 4) * r, z + math.sin(k * math.pi / 4) * r);
	for (const p of plan.parts) if (p.solid && rectPointDist(partRect(p), x, z) <= rad) top = math.max(top, p.y + p.sy / 2);
	for (const p of plan.props) {
		const box = propBox(p);
		if (rectPointDist(box.rect, x, z) <= rad) top = math.max(top, box.top);
	}
	return top;
}
