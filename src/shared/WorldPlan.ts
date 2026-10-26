import { ENVIRONMENTS, lampsOn, type Rgb } from "./EnvironmentPresets";
import { FlightMath } from "./FlightMath";
import { MissionCatalog, type EnvironmentPreset, type FlightPoint, type MissionBlueprint, type MissionRegion } from "./MissionCatalog";
import { layoutFor, type LevelLayout } from "./MissionLayouts";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";

// Pure world plans for missions 3-27: every terrain voxel operation, primitive
// part, uploaded-model placement and ground-target site of a mission world, as
// plain numbers. The server (RelayWorld) executes a plan; the specs audit the
// same plan offline (no Studio): flight points clear of terrain, targets on
// ground, escort boats on water, nothing floating, and the mobile budget.
//
// Conventions: studs, Y up. Terrain ops are written in list order and overwrite
// what is there (as Roblox Fill* does), except `bump`, which only adds. Yaw is a
// rotation about +Y (CFrame.Angles(0, yaw, 0)). Props are placed by their ground
// contact point (the waterline for the frigate, oil platform and quay) with -Z
// as the asset's front, exactly like WorldAssets.

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

export const GROUND = 44;
export const BASE_BOTTOM = 36;
export const APRON_TOP = 48;
export const WATER_Y = 32;
export const SEABED = 16;
export const SEABED_BOTTOM = 12;
export const RIVER_WATER = 40;
/** Terrain half-extent; far tiles (parts) continue the ground or sea to FAR. */
export const EXTENT = 4000;
export const FAR = 6000;
const TILE = 2000;
/** Mobile budget per mission world (audited by WorldPlan.spec; counts in docs/world-realism.md). */
export const WORLD_BUDGET = { parts: 340, props: 280, uniqueMeshes: 20, voxelWrites: 100e6, bumpCells: 2.5e6, terrainOps: 700 };
const BEACH_LANDINGS = new Set<number>([25]);
const COAST_Z: { [id: number]: number } = { 19: -1260, 20: -1060, 21: -1640, 22: -1000, 25: -1560, 26: -1700, 27: -1700 };

class Rng {
	private state: number;
	constructor(seed: number) { this.state = (math.floor(math.abs(seed)) % 2147483646) + 1; }
	next(): number { this.state = (this.state * 16807) % 2147483647; return (this.state - 1) / 2147483646; }
	range(a: number, b: number): number { return a + (b - a) * this.next(); }
	int(a: number, b: number): number { return math.min(b, a + math.floor((b - a + 1) * this.next())); }
}

// --- geometry --------------------------------------------------------------
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
/** Highest solid top (terrain, parts, props) at (x, z) and on two rings around it. */
export function solidTopWithin(plan: WorldPlan, x: number, z: number, rad: number): number {
	let top = -math.huge;
	const probe = (px: number, pz: number) => { const s = surfaceAt(plan, px, pz); if (s.kind !== "water") top = math.max(top, s.y); };
	probe(x, z);
	for (const r of [rad / 2, rad]) for (let k = 0; k < 8; k++) probe(x + math.cos(k * math.pi / 4) * r, z + math.sin(k * math.pi / 4) * r);
	return top;
}

// --- flight clearance -------------------------------------------------------
function pushSegment(out: AirSample[], a: FlightPoint, b: FlightPoint, ceiling: number | undefined, label: string): void {
	const len = math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z));
	const n = math.max(1, math.ceil(len / 60));
	for (let k = 0; k <= n; k++) {
		const t = k / n, y = a.y + (b.y - a.y) * t;
		out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, limit: math.min(y - 40, ceiling !== undefined ? ceiling - 60 : math.huge), rad: 80, label });
	}
}
/** Where terrain and structures must stay low: authored flight points, route legs, ceilings, signal volumes and the spawn. */
export function airSamples(bp: MissionBlueprint): AirSample[] {
	const out: AirSample[] = [];
	const start = FlightMath.NewState();
	const spawn = { x: start.x, y: start.y, z: start.z };
	out.push({ x: spawn.x, z: spawn.z, limit: spawn.y - 60, rad: 200, label: "spawn" });
	const phases = MissionCatalog.ExpandedPhases(bp);
	for (let i = 0; i < phases.size(); i++) {
		const phase = phases[i];
		const air = (phase.points ?? []).filter((p) => p.y > 100);
		for (const p of air) {
			out.push({ x: p.x, z: p.z, limit: p.y - 60, rad: 120, label: `${phase.kind} point` });
			if (phase.ceiling !== undefined) out.push({ x: p.x, z: p.z, limit: phase.ceiling - 60, rad: phase.kind === "recon" ? phase.radius ?? 120 : 120, label: `${phase.kind} ceiling` });
			if (phase.kind === "signal") out.push({ x: p.x, z: p.z, limit: p.y - 120, rad: 300, label: "signal volume" });
		}
		if (phase.kind === "route") {
			for (let k = 1; k < air.size(); k++) pushSegment(out, air[k - 1], air[k], phase.ceiling, "route leg");
			if (i === 0 && air.size() > 0) pushSegment(out, spawn, air[0], phase.ceiling, "spawn leg");
		}
		if (phase.escape) out.push({ x: phase.escape.x, z: phase.escape.z, limit: phase.escape.y - 60, rad: 120, label: "chase escape" });
	}
	return out;
}
function limitAt(air: AirSample[], x: number, z: number, reach: number): number {
	let limit = math.huge;
	for (const s of air) {
		const dx = x - s.x, dz = z - s.z, r = s.rad + reach;
		if (dx * dx + dz * dz < r * r) limit = math.min(limit, s.limit);
	}
	return limit;
}

// --- plan context -----------------------------------------------------------
interface Zone { rect: Rect; r: number; tag: string }
interface Corridor { points: number[][]; half: number; tag: string }
interface Ctx {
	id: number; bp: MissionBlueprint; layout: LevelLayout; theme: Theme; rng: Rng; plan: WorldPlan;
	zones: Zone[]; corridors: Corridor[]; ridgeRects: Rect[]; moles: Rect[]; roads: number[][][];
}
const THEMES: Record<MissionRegion, Theme> = {
	canyon_airfield: "canyon", canyon_pass: "canyon", upland_farm: "farm", plateau_relay: "plateau",
	coastal_city: "coast", coastal_harbor: "coast", ocean_platform: "ocean",
};
const BASE_MATERIAL: Record<Theme, TerrainMaterial> = { farm: "Grass", canyon: "Ground", plateau: "Grass", coast: "Grass", ocean: "Sand" };
export const MATERIAL_COLORS: Record<Theme, Array<[TerrainMaterial, Rgb]>> = {
	farm: [["Grass", [96, 128, 70]], ["LeafyGrass", [84, 116, 58]], ["Ground", [124, 100, 72]], ["Mud", [98, 82, 62]], ["Rock", [116, 112, 104]], ["Sand", [200, 186, 146]], ["Concrete", [132, 132, 126]]],
	canyon: [["Ground", [166, 122, 84]], ["Sandstone", [192, 132, 88]], ["Rock", [132, 98, 76]], ["Sand", [216, 182, 132]], ["Grass", [128, 132, 78]], ["Slate", [112, 92, 82]]],
	plateau: [["Grass", [104, 118, 82]], ["Ground", [118, 104, 84]], ["Rock", [104, 102, 100]], ["Slate", [86, 88, 92]], ["Snow", [236, 240, 246]], ["Sand", [190, 176, 140]]],
	coast: [["Grass", [92, 120, 78]], ["LeafyGrass", [80, 110, 66]], ["Sand", [208, 192, 150]], ["Rock", [98, 96, 92]], ["Concrete", [130, 130, 126]], ["Pavement", [112, 114, 114]], ["Mud", [70, 66, 58]], ["Ground", [112, 100, 82]]],
	ocean: [["Rock", [90, 88, 86]], ["Sand", [202, 188, 152]], ["Grass", [90, 114, 76]], ["Mud", [60, 58, 54]], ["Concrete", [124, 124, 120]]],
};

function op(ctx: Ctx, shape: TerrainShape, material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): void {
	ctx.plan.ops.push({ shape, material, x, y, z, sx, sy, sz, yaw });
}
/** Box over [x0,x1] x [y0,y1] x [z0,z1], split into tiles no larger than TILE. */
function slab(ctx: Ctx, material: TerrainMaterial, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void {
	for (let x = x0; x < x1 - 0.5; x += TILE) for (let z = z0; z < z1 - 0.5; z += TILE) {
		const w = math.min(TILE, x1 - x), d = math.min(TILE, z1 - z);
		op(ctx, "block", material, x + w / 2, (y0 + y1) / 2, z + d / 2, w, y1 - y0, d);
	}
}
function part(ctx: Ctx, name: string, shape: PartShape, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, color: Rgb, material: string, solid = true, grounded = false, extra: { transparency?: number; reflectance?: number } = {}): PartSpec {
	const spec: PartSpec = { name, shape, x, y, z, sx, sy, sz, yaw, color, material, solid, grounded, ...extra };
	ctx.plan.parts.push(spec);
	return spec;
}
function prop(ctx: Ctx, asset: PropAsset, x: number, y: number, z: number, yaw: number, scale = 1, tint = 0, tag?: string): PropSpec {
	const spec: PropSpec = { asset, x, y, z, yaw, scale, tint, tag };
	ctx.plan.props.push(spec);
	return spec;
}
function zone(ctx: Ctx, tag: string, x: number, z: number, hx: number, hz: number, yaw = 0): void {
	ctx.zones.push({ rect: { x, z, hx, hz, yaw }, r: 0, tag });
}
function circle(ctx: Ctx, tag: string, x: number, z: number, r: number): void {
	ctx.zones.push({ rect: { x, z, hx: 0, hz: 0, yaw: 0 }, r, tag });
}
/** True when (x, z) is clear of every zone and corridor by `pad`, ignoring the given tags. */
function free(ctx: Ctx, x: number, z: number, pad: number, ignore: string[] = []): boolean {
	for (const zn of ctx.zones) {
		if (ignore.includes(zn.tag)) continue;
		if (rectPointDist(zn.rect, x, z) < zn.r + pad) return false;
	}
	for (const c of ctx.corridors) {
		if (ignore.includes(c.tag)) continue;
		if (polyDist(x, z, c.points) < c.half + pad) return false;
	}
	return true;
}
function rectFree(ctx: Ctx, r: Rect, pad: number, ignore: string[] = []): boolean {
	for (const zn of ctx.zones) {
		if (ignore.includes(zn.tag)) continue;
		if (zn.r > 0 ? rectPointDist(r, zn.rect.x, zn.rect.z) < zn.r + pad : rectsOverlap(r, zn.rect, pad)) return false;
	}
	for (const c of ctx.corridors) {
		if (ignore.includes(c.tag)) continue;
		if (rectPolyDist(r, c.points) < c.half + pad) return false;
	}
	return true;
}
function limit(ctx: Ctx, x: number, z: number, reach: number): number { return limitAt(ctx.plan.air, x, z, reach); }
function groundAt(ctx: Ctx, x: number, z: number): { solid: number; water?: number } { return terrainTop(ctx.plan.ops, x, z); }
/** Dry, flat terrain at (x, z): returns the lowest top among five samples, or undefined. */
function dryFlat(ctx: Ctx, x: number, z: number, spread: number, tolerance: number): number | undefined {
	let lo = math.huge, hi = -math.huge;
	for (const [dx, dz] of [[0, 0], [spread, 0], [-spread, 0], [0, spread], [0, -spread]]) {
		const t = groundAt(ctx, x + dx, z + dz);
		if (t.water !== undefined || t.solid === -math.huge) return undefined;
		lo = math.min(lo, t.solid);
		hi = math.max(hi, t.solid);
	}
	return hi - lo <= tolerance ? lo : undefined;
}
function onLand(ctx: Ctx, x: number, z: number): boolean {
	const t = groundAt(ctx, x, z);
	return t.water === undefined && t.solid >= GROUND - 1;
}
function inMap(x: number, z: number, edge = 2650): boolean { return math.abs(x) <= edge && math.abs(z) <= edge; }

// --- reservations -----------------------------------------------------------
function waterClear(path: WaterPath): number { return path.canal ? path.half + 10 : 14; }
function reserve(ctx: Ctx): void {
	const { bp, layout, plan } = ctx;
	for (const g of bp.ground) circle(ctx, "target", g.x, g.z, 125);
	const wet = ctx.theme === "coast" || ctx.theme === "ocean";
	const phases = MissionCatalog.ExpandedPhases(bp);
	for (const phase of phases) {
		const actor = phase.kind === "escort" || phase.kind === "defend";
		const pts = (phase.points ?? []).map((p) => [p.x, p.z]);
		if (actor && pts.size() > 0) {
			if (wet) addWaterPath(ctx, pts, phase.kind === "escort" && BEACH_LANDINGS.has(ctx.id));
			else if (phase.kind === "escort") { plan.groundPaths.push(pts); ctx.corridors.push({ points: pts, half: 34, tag: "convoy" }); }
			else circle(ctx, "actor", pts[0][0], pts[0][1], 70);
		}
		if (phase.parkedEscort) {
			const p = [[phase.parkedEscort.x, phase.parkedEscort.z]];
			if (wet) addWaterPath(ctx, p, false);
			else circle(ctx, "actor", p[0][0], p[0][1], 60);
		}
	}
	const start = FlightMath.NewState();
	circle(ctx, "spawn", start.x, start.z, 120);
	for (const road of layout.road.size() >= 2 ? [layout.road] : []) { ctx.roads.push(road); ctx.corridors.push({ points: road, half: 26, tag: "road" }); }
	for (const r of layout.ridges) ctx.ridgeRects.push({ x: r[0], z: r[1], hx: r[2] / 2, hz: r[3] / 2, yaw: 0 });
}
function addWaterPath(ctx: Ctx, points: number[][], beachEnd: boolean): void {
	// A coastal path that starts on land is joined to the sea by a canal, and every path is merged with an
	// existing one when it continues it (a parked launch at the end of its escort).
	const cz = ctx.plan.coastZ;
	let pts = points;
	let canal = false;
	if (cz !== undefined) {
		if (pts[0][1] > cz - 30) pts = [[pts[0][0], cz - 80], ...pts];
		canal = pts.some((p) => p[1] > cz - 30);
	}
	for (const existing of ctx.plan.waterPaths) {
		if (pts.size() === 1 && polyDist(pts[0][0], pts[0][1], existing.points) < 1) return;
	}
	const path: WaterPath = { points: pts, half: canal ? 50 : 30, canal, beachEnd };
	ctx.plan.waterPaths.push(path);
	ctx.corridors.push({ points: pts, half: path.half, tag: "water" });
}

// --- base terrain -----------------------------------------------------------
function inlandBase(ctx: Ctx): void {
	const { rng, theme } = ctx;
	slab(ctx, BASE_MATERIAL[theme], -EXTENT, EXTENT, -EXTENT, EXTENT, BASE_BOTTOM, GROUND);
	// Material patches in the top voxel layer: fields, dry washes, rock flats.
	if (theme === "farm") {
		const mats: TerrainMaterial[] = ["LeafyGrass", "Ground", "Grass", "LeafyGrass", "Mud", "Ground"];
		for (let gx = -2160; gx <= 2160; gx += 360) for (let gz = -2200; gz <= 2200; gz += 440) {
			if (rng.next() < 0.3) continue;
			op(ctx, "block", mats[rng.int(0, mats.size() - 1)], gx + rng.range(-20, 20), GROUND - 2, gz + rng.range(-20, 20), rng.range(230, 310), 4, rng.range(300, 380), rng.range(-0.05, 0.05));
		}
	} else {
		const mats: TerrainMaterial[] = theme === "canyon" ? ["Sand", "Sandstone", "Sand", "Rock", "Grass"] : ["Rock", "Ground", "Slate", "Ground", "Sand"];
		for (let i = 0; i < 26; i++) {
			const m = mats[i % mats.size()];
			const long = m === "Sand" ? rng.range(500, 900) : rng.range(180, 380);
			op(ctx, "block", m, rng.range(-2600, 2600), GROUND - 2, rng.range(-2600, 2600), m === "Sand" ? rng.range(70, 130) : rng.range(160, 340), 4, long, rng.range(0, math.pi));
		}
	}
}
function coastBase(ctx: Ctx, cz: number): void {
	const { rng } = ctx;
	slab(ctx, "Water", -EXTENT, EXTENT, -EXTENT, cz, SEABED, WATER_Y);
	slab(ctx, "Mud", -EXTENT, EXTENT, -EXTENT, cz, SEABED_BOTTOM, SEABED);
	slab(ctx, "Grass", -EXTENT, EXTENT, cz, EXTENT, BASE_BOTTOM, GROUND);
	// The land edge is a rock wall down to the seabed so no slab floats over the water.
	slab(ctx, "Rock", -EXTENT, EXTENT, cz, cz + 48, SEABED_BOTTOM, BASE_BOTTOM);
	for (let i = 0; i < 14; i++) {
		const x = rng.range(-2600, 2600), z = rng.range(cz + 200, 2600);
		op(ctx, "block", i % 3 === 0 ? "Ground" : "LeafyGrass", x, GROUND - 2, z, rng.range(160, 320), 4, rng.range(160, 320), rng.range(0, math.pi));
	}
}
function oceanBase(ctx: Ctx): void {
	slab(ctx, "Water", -EXTENT, EXTENT, -EXTENT, EXTENT, SEABED, WATER_Y);
	slab(ctx, "Mud", -EXTENT, EXTENT, -EXTENT, EXTENT, SEABED_BOTTOM, SEABED);
}

// --- canals, piers and beaches (coast) -------------------------------------
function canals(ctx: Ctx, cz: number): void {
	const walls: TerrainOp[] = [], carves: TerrainOp[] = [], waters: TerrainOp[] = [], beds: TerrainOp[] = [], beaches: TerrainOp[] = [];
	const push = (list: TerrainOp[], shape: TerrainShape, material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number) => list.push({ shape, material, x, y, z, sx, sy, sz, yaw });
	for (const path of ctx.plan.waterPaths) {
		if (!path.canal) continue;
		const h = path.half;
		const pts = path.points;
		for (let i = 1; i < pts.size(); i++) {
			let [ax, az] = pts[i - 1];
			let [bx, bz] = pts[i];
			const edge = cz - 20;
			if (az < edge && bz < edge) continue;
			if (az < edge) { const t = (edge - az) / (bz - az); ax += (bx - ax) * t; az = edge; }
			if (bz < edge) { const t = (edge - bz) / (az - bz); bx += (ax - bx) * t; bz = edge; }
			const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
			if (len < 1) continue;
			const mx = (ax + bx) / 2, mz = (az + bz) / 2, yaw = axisYaw(bx - ax, bz - az);
			push(walls, "block", "Concrete", mx, (SEABED_BOTTOM + GROUND) / 2, mz, len + 2 * (h + 8), GROUND - SEABED_BOTTOM, 2 * (h + 8), yaw);
			push(carves, "block", "Air", mx, (SEABED_BOTTOM + GROUND + 12) / 2, mz, len + 2 * h, GROUND + 12 - SEABED_BOTTOM, 2 * h, yaw);
			push(waters, "block", "Water", mx, (SEABED + WATER_Y) / 2, mz, len + 2 * h, WATER_Y - SEABED, 2 * h, yaw);
			push(beds, "block", "Mud", mx, (SEABED_BOTTOM + SEABED) / 2, mz, len + 2 * h, SEABED - SEABED_BOTTOM, 2 * h, yaw);
			if (path.beachEnd && i === pts.size() - 1) {
				// The landing beach: a sand ramp from the water up to the end point, then flat sand to the end wall.
				const ux = (bx - ax) / len, uz = (bz - az) / len, rampYaw = math.atan2(ux, uz);
				push(beaches, "wedge", "Sand", bx - ux * 45, (WATER_Y - 4 + GROUND) / 2, bz - uz * 45, 2 * h, GROUND - WATER_Y + 4, 90, rampYaw);
				push(beaches, "block", "Sand", bx + ux * h / 2, (SEABED_BOTTOM + GROUND) / 2, bz + uz * h / 2, 2 * h, GROUND - SEABED_BOTTOM, h + 2, rampYaw);
			}
		}
	}
	for (const list of [walls, carves, waters, beds, beaches]) for (const o of list) ctx.plan.ops.push(o);
}
/** Target aprons, shrunk until clear of the boat paths; coastal targets get a concrete mole to the shore. */
function targets(ctx: Ctx): void {
	const { bp, plan } = ctx;
	const cz = plan.coastZ;
	const hub = platformHub(ctx);
	for (let index = 0; index < bp.ground.size(); index++) {
		const g = bp.ground[index];
		if (ctx.theme === "ocean") {
			storeDeck(ctx, index, g.x, g.z, hub);
			continue;
		}
		let size = 150;
		const clearOf = (s: number) => plan.waterPaths.every((p) => rectPolyDist({ x: g.x, z: g.z, hx: s / 2 + 8, hz: s / 2 + 8, yaw: 0 }, p.points) >= waterClear(p));
		while (size > 90 && !clearOf(size)) size -= 6;
		const half = size / 2 + 8;
		if (cz !== undefined && g.z - half < cz + 40) {
			const north = math.max(g.z + half, cz + 40);
			const south = g.z - half;
			op(ctx, "block", "Concrete", g.x, (SEABED_BOTTOM + GROUND) / 2, (north + south) / 2, 2 * half, GROUND - SEABED_BOTTOM, north - south);
			ctx.moles.push({ x: g.x, z: (north + south) / 2, hx: half, hz: (north - south) / 2, yaw: 0 });
			zone(ctx, "mole", g.x, (north + south) / 2, half, (north - south) / 2);
		}
		part(ctx, "Target apron", "block", g.x, APRON_TOP - 2, g.z, size, 4, size, 0, [90, 103, 108], "Concrete", true, true);
		plan.targets.push({ index, x: g.x, z: g.z, baseY: APRON_TOP, apron: size, deck: false });
	}
}

// --- relief -----------------------------------------------------------------
function mesa(ctx: Ctx, x: number, z: number, w: number, d: number, h: number): void {
	const { rng, theme } = ctx;
	const top = math.min(h - 12, limit(ctx, x, z, math.max(w, d) / 2 + 40));
	if (top < GROUND + 50) return;
	const rise = top - GROUND, yaw = rng.range(-0.12, 0.12);
	const canyon = theme === "canyon";
	const body: TerrainMaterial = canyon ? "Sandstone" : "Rock", band: TerrainMaterial = canyon ? "Rock" : "Slate";
	const tiers = [[1, 0.55, 0], [0.84, 0.8, 0.045], [0.66, 1, 0.08]];
	let previous = GROUND;
	for (let t = 0; t < tiers.size(); t++) {
		const [scale, frac, wobble] = tiers[t];
		const tw = math.min(2000, w * scale), td = math.min(2000, d * scale), ttop = GROUND + rise * frac;
		const cx = x + w * wobble * rng.range(-1, 1), cz = z + d * wobble * rng.range(-1, 1), ty = yaw + rng.range(-0.05, 0.05);
		// Upper tiers start just under the tier below: the overlap is hidden rock and costs voxel writes.
		const floor = t === 0 ? BASE_BOTTOM : previous - 8;
		op(ctx, "block", body, cx, (floor + ttop) / 2, cz, tw, ttop - floor, td, ty);
		// A darker stratum just proud of the face, a third of the way down the tier.
		op(ctx, "block", band, cx, ttop - (ttop - previous) * 0.35, cz, tw + 2, 6, td + 2, ty);
		// Rounded buttresses break up the long walls (eroded columns, no overhangs).
		const long = tw >= td, len = long ? tw : td, short = long ? td : tw;
		const n = math.clamp(math.floor(len / 170), 1, 6);
		for (const side of [-1, 1]) for (let k = 0; k < n; k++) {
			const along = -len / 2 + (k + 0.5) * len / n + rng.range(-25, 25);
			const radius = math.clamp(short * rng.range(0.05, 0.09) + 16, 22, 70);
			const columnTop = ttop - (ttop - previous) * rng.range(0, 0.3);
			const [ox, oz] = toWorld(long ? along : side * tw / 2, long ? side * td / 2 : along, ty);
			op(ctx, "cylinder", t === 0 ? body : rng.next() < 0.5 ? body : band, cx + ox, (floor + columnTop) / 2, cz + oz, radius, columnTop - floor, 0);
		}
		if (t === 0) {
			// Talus aprons slope out from the base on all four sides (tall edge against the wall).
			const talus = math.min(60, (ttop - GROUND) * 0.35), depth = talus * 1.8;
			for (const [lx, lz, length, turn] of [[0, -(td / 2 + depth / 2), tw * 0.9, 0], [0, td / 2 + depth / 2, tw * 0.9, math.pi], [tw / 2 + depth / 2, 0, td * 0.9, -math.pi / 2], [-(tw / 2 + depth / 2), 0, td * 0.9, math.pi / 2]]) {
				const [ox, oz] = toWorld(lx, lz, ty);
				op(ctx, "wedge", canyon ? "Ground" : "Rock", cx + ox, GROUND - 2 + talus / 2, cz + oz, length, talus, depth, ty + turn);
			}
		}
		if (t === tiers.size() - 1 && !canyon) op(ctx, "block", "Grass", cx, ttop - 2, cz, tw - 24, 4, td - 24, ty);
		previous = ttop;
	}
}
function rollingRidge(ctx: Ctx, x: number, z: number, w: number, d: number, h: number, carve: boolean): void {
	const { rng } = ctx;
	const long = math.max(w, d), short = math.min(w, d);
	const yaw = (w >= d ? 0 : math.pi / 2) + rng.range(-0.15, 0.15);
	const radius = math.clamp(short * 0.55, 140, 360);
	const n = math.max(1, math.floor((long - short) / (radius * 0.9)) + 1);
	let lowest = math.huge;
	for (let k = 0; k < n; k++) {
		const t = n === 1 ? 0 : -(long - short) / 2 + k * (long - short) / (n - 1);
		const [ox, oz] = toWorld(t, rng.range(-0.1, 0.1) * short, yaw);
		const wx = x + ox, wz = z + oz;
		const ceiling = math.min(h - 12, limit(ctx, wx, wz, radius));
		const peak = GROUND + (ceiling - GROUND) * rng.range(0.8, 1);
		if (peak < GROUND + 30) continue;
		op(ctx, "ball", "Rock", wx, peak - 2 - radius, wz, radius, 0, 0);
		op(ctx, "ball", ctx.theme === "plateau" ? "Grass" : "Grass", wx, peak - radius * 0.82, wz, radius * 0.82, 0, 0);
		lowest = math.min(lowest, peak - 2 - radius * 2);
	}
	// Carve the buried half of the balls back to air (hidden voxels still mesh and replicate).
	if (carve && lowest < BASE_BOTTOM) op(ctx, "block", "Air", x, (lowest - 4 + BASE_BOTTOM) / 2, z, long + 2 * radius + 16, BASE_BOTTOM - lowest + 4, short * 0.2 + 2 * radius + 16, yaw);
}
function island(ctx: Ctx, x: number, z: number, w: number, d: number, h: number): void {
	const { rng } = ctx;
	const long = math.max(w, d), short = math.min(w, d), yaw = (w >= d ? 0 : math.pi / 2) + rng.range(-0.3, 0.3);
	const r = short / 2, span = long - short;
	const lobes: number[][] = span < 60 ? [[0, 0]] : [[-span / 2, 0], [span / 2, 0]];
	for (const [material, scale, top] of [["Sand", 1, WATER_Y + 3], ["Rock", 0.8, WATER_Y + 8]] as Array<[TerrainMaterial, number, number]>) {
		for (const [lx] of lobes) {
			const [ox, oz] = toWorld(lx, 0, yaw);
			op(ctx, "cylinder", material, x + ox, (SEABED_BOTTOM + top) / 2, z + oz, r * scale, top - SEABED_BOTTOM, 0);
		}
		if (span >= 60) op(ctx, "block", material, x, (SEABED_BOTTOM + top) / 2, z, span, top - SEABED_BOTTOM, 2 * r * scale, yaw);
	}
	const radius = math.clamp(short * 0.36, 60, 220);
	let lowest = math.huge;
	for (const [lx] of lobes) {
		const [ox, oz] = toWorld(lx * 0.8, 0, yaw);
		const wx = x + ox, wz = z + oz;
		const peak = math.min(h - 12, limit(ctx, wx, wz, radius)) * rng.range(0.85, 1);
		if (peak < WATER_Y + 30) continue;
		op(ctx, "ball", "Rock", wx, peak - 2 - radius, wz, radius, 0, 0);
		op(ctx, "ball", "Grass", wx, peak - radius * 0.8, wz, radius * 0.8, 0, 0);
		lowest = math.min(lowest, peak - 2 - radius * 2);
	}
	if (lowest < SEABED_BOTTOM) op(ctx, "block", "Air", x, (lowest - 4 + SEABED_BOTTOM) / 2, z, long + 2 * radius, SEABED_BOTTOM - lowest + 4, short + 2 * radius, yaw);
}
function ridges(ctx: Ctx): void {
	const cz = ctx.plan.coastZ;
	for (const [x, z, w, d, h] of ctx.layout.ridges) {
		if (ctx.theme === "ocean" || (cz !== undefined && z < cz)) island(ctx, x, z, w, d, h);
		else if (ctx.theme === "farm" || ctx.theme === "coast") rollingRidge(ctx, x, z, w, d, h, cz === undefined || z - d / 2 - 400 > cz);
		else mesa(ctx, x, z, w, d, h);
	}
}
/** Low canyon walls along the authored track: offset sideways, clipped by the flight limits. */
function corridorWalls(ctx: Ctx): void {
	if (ctx.theme !== "canyon") return;
	const { rng } = ctx;
	for (const road of ctx.roads) for (let i = 1; i < road.size(); i++) {
		const [ax, az] = road[i - 1], [bx, bz] = road[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
		const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = axisYaw(ux, uz);
		for (let t = 150; t < len - 100; t += 300) for (const side of [-1, 1]) {
			const offset = 330 + rng.range(0, 70), length = rng.range(220, 320), thick = rng.range(150, 210);
			const x = ax + ux * t - uz * side * offset, z = az + uz * t + ux * side * offset;
			const rect: Rect = { x, z, hx: length / 2, hz: thick / 2, yaw };
			if (!inMap(x, z, 2500) || !rectFree(ctx, rect, 30, ["spawn"])) continue;
			if (ctx.ridgeRects.some((r) => rectsOverlap(r, rect, 0))) continue;
			const top = math.min(GROUND + rng.range(90, 170), limit(ctx, x, z, length / 2 + 20));
			if (top < GROUND + 50) continue;
			const height = top - (GROUND - 2);
			for (const s of [-1, 1]) {
				const [ox, oz] = toWorld(0, s * thick / 4, yaw);
				op(ctx, "wedge", "Sandstone", x + ox, GROUND - 2 + height / 2, z + oz, length, height, thick / 2, s < 0 ? yaw : yaw + math.pi);
			}
			const radius = thick * 0.2;
			op(ctx, "cylinder", "Rock", x, (GROUND - 2 + top - radius * 0.5) / 2, z, radius, top - radius * 0.5 - (GROUND - 2), 0);
			ctx.ridgeRects.push(rect);
		}
	}
}
/** Smooth rolling hills (bumps) away from everything that needs flat ground. */
function hills(ctx: Ctx): void {
	const { rng, theme } = ctx;
	const cz = ctx.plan.coastZ;
	const count = theme === "farm" ? 10 : theme === "plateau" ? 8 : theme === "coast" ? 6 : theme === "canyon" ? 5 : 0;
	const material: TerrainMaterial = theme === "canyon" ? "Sand" : "Grass";
	let placed = 0, attempts = 0;
	while (placed < count && attempts < count * 12) {
		attempts += 1;
		const rx = theme === "canyon" ? rng.range(150, 260) : rng.range(200, 320), rz = rx * rng.range(0.7, 1.3), yaw = rng.range(0, math.pi);
		const height = theme === "canyon" ? rng.range(12, 26) : rng.range(24, 58);
		const x = rng.range(-2500, 2500), z = rng.range(-2500, 2500);
		const reach = math.max(rx, rz);
		if (cz !== undefined && z - reach < cz + 150) continue;
		if (!free(ctx, x, z, reach + 30, [])) continue;
		if (ctx.ridgeRects.some((r) => rectPointDist(r, x, z) < reach)) continue;
		if (GROUND + height > limit(ctx, x, z, reach)) continue;
		op(ctx, "bump", rng.next() < 0.3 && theme !== "canyon" ? "LeafyGrass" : material, x, GROUND, z, rx, height, rz, yaw);
		circle(ctx, "hill", x, z, reach);
		placed += 1;
	}
}
/** A ring of mountain ridges outside the flyable square (land sides only on the coast). */
function mountainRing(ctx: Ctx): void {
	const { rng, theme } = ctx;
	const cz = ctx.plan.coastZ;
	if (theme === "ocean") {
		for (let i = 0; i < 6; i++) {
			const a = (i + rng.range(0.2, 0.8)) / 6 * math.pi * 2, distance = rng.range(3050, 3400);
			const x = math.cos(a) * distance, z = math.sin(a) * distance;
			island(ctx, x, z, rng.range(260, 520), rng.range(220, 420), rng.range(90, 170));
		}
		return;
	}
	const [lo, hi] = theme === "canyon" ? [260, 460] : theme === "farm" ? [200, 380] : theme === "plateau" ? [320, 520] : [220, 420];
	const body: TerrainMaterial = theme === "canyon" ? "Sandstone" : theme === "farm" ? "Grass" : "Rock";
	for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (let k = 0; k < 5; k++) {
		const along = -3200 + (k + 0.5) * 1280 + rng.range(-120, 120), distance = rng.range(3150, 3350);
		const x = nx !== 0 ? nx * distance : along, z = nz !== 0 ? nz * distance : along;
		if (cz !== undefined && z < cz + 500) continue;
		const height = rng.range(lo, hi), depth = height * rng.range(1.25, 1.45), length = 1280 * rng.range(1.0, 1.1);
		const yaw = (nx !== 0 ? math.pi / 2 : 0) + rng.range(-0.15, 0.15);
		for (const s of [-1, 1]) {
			const [ox, oz] = toWorld(0, s * depth / 4, yaw);
			op(ctx, "wedge", body, x + ox, BASE_BOTTOM + height / 2, z + oz, length, height, depth / 2, s < 0 ? yaw : yaw + math.pi);
		}
		for (const t of [-0.22, 0.18]) {
			const radius = height * rng.range(0.28, 0.36);
			const [ox, oz] = toWorld(length * t, 0, yaw);
			const snow = theme === "plateau" && height > 430;
			op(ctx, "ball", snow ? "Snow" : theme === "canyon" ? "Sandstone" : "Rock", x + ox, BASE_BOTTOM + height - radius * 0.6, z + oz, radius, 0, 0);
		}
	}
}

// --- landmarks --------------------------------------------------------------
const WHITE: Rgb = [236, 234, 214], ASPHALT: Rgb = [44, 49, 54], CONCRETE: Rgb = [128, 134, 137];
function light(ctx: Ctx, x: number, y: number, z: number, color: Rgb): void {
	part(ctx, "Navigation light", "block", x, y, z, 3, 2, 3, 0, color, "Neon", false);
}
/** Runway, apron, hangars and tower: the Varda airfield block. Runway along local Z. */
function airfield(ctx: Ctx, cx: number, cz: number): void {
	const top = GROUND + 1;
	part(ctx, "Runway shoulder", "block", cx, top - 1.5, cz, 130, 1, 1040, 0, CONCRETE, "Concrete", true, true);
	part(ctx, "Runway", "block", cx, top - 0.5, cz, 100, 1, 1000, 0, ASPHALT, "Asphalt", true, true);
	for (let i = 0; i < 8; i++) part(ctx, "Centreline", "block", cx, top + 0.15, cz - 315 + i * 90, 3, 0.3, 45, 0, WHITE, "SmoothPlastic", false);
	for (const tip of [-1, 1]) {
		for (const s of [-3, -2, -1, 1, 2, 3]) part(ctx, "Threshold", "block", cx + s * 12.5, top + 0.15, cz + tip * 455, 10, 0.3, 50, 0, WHITE, "SmoothPlastic", false);
		part(ctx, "Approach bar", "block", cx, top + 1.5, cz + tip * 560, 80, 1.5, 3, 0, [255, 240, 200], "Neon", false);
	}
	for (let i = 0; i <= 8; i++) for (const side of [-1, 1]) light(ctx, cx + side * 56, top + 1, cz - 500 + i * 125, i === 0 || i === 8 ? [255, 120, 90] : [255, 244, 210]);
	zone(ctx, "airfield", cx, cz, 70, 560);
	// Hangars and tower on whichever side (and stretch of the runway) is clear, facing the runway.
	for (const shift of [0, -220, 220, -400, 400]) for (const side of [1, -1]) {
		const hz = cz + shift;
		const hangars: Rect[] = [-150, 0, 150].map((dz) => ({ x: cx + side * 210, z: hz + dz, hx: 70, hz: 66, yaw: 0 }));
		const tower: Rect = { x: cx + side * 200, z: hz + (shift > 0 ? -330 : 330), hx: 34, hz: 26, yaw: 0 };
		const all = [...hangars, tower];
		if (!all.every((r) => rectFree(ctx, r, 20, ["spawn"]) && math.abs(r.x) < 2600 && math.abs(r.z) < 2600 && !ctx.ridgeRects.some((m) => rectsOverlap(m, r, 30)))) continue;
		if (!all.every((r) => dryFlat(ctx, r.x, r.z, 60, 0.5) === GROUND)) continue;
		if (GROUND + 127 > limit(ctx, tower.x, tower.z, 40) || hangars.some((r) => GROUND + 40 > limit(ctx, r.x, r.z, 70))) continue;
		part(ctx, "Apron", "block", cx + side * 112, top - 1, hz, 64, 2, 480, 0, CONCRETE, "Concrete", true, true);
		for (const r of hangars) prop(ctx, "Hangar", r.x, GROUND, r.z, side > 0 ? math.pi / 2 : -math.pi / 2, 1, 0);
		prop(ctx, "ControlTower", tower.x, GROUND, tower.z, side > 0 ? math.pi / 2 : -math.pi / 2, 1, 0);
		zone(ctx, "airfield", cx + side * 190, (math.min(hz - 216, tower.z - 26) + math.max(hz + 216, tower.z + 26)) / 2, 90, (math.max(hz + 216, tower.z + 26) - math.min(hz - 216, tower.z - 26)) / 2);
		return;
	}
}
function chooseAirfield(ctx: Ctx): void {
	const candidates = [[0, 700], [-700, 700], [700, 700], [-1400, 500], [1400, 500], [0, 1500], [-1400, 1500], [1400, 1500]];
	for (const [x, z] of candidates) {
		const rect: Rect = { x, z, hx: 300, hz: 580, yaw: 0 };
		if (!rectFree(ctx, rect, 20, ["spawn"]) || ctx.ridgeRects.some((r) => rectsOverlap(r, rect, 40))) continue;
		airfield(ctx, x, z);
		return;
	}
}
function chooseRiverX(ctx: Ctx, fx: number): number | undefined {
	for (let step = 0; step <= 60; step++) {
		const rx = fx + 300 + (step % 2 === 0 ? 1 : -1) * math.floor((step + 1) / 2) * 20;
		if (math.abs(rx) > 2300) continue;
		const corridor: Rect = { x: rx, z: 0, hx: 95, hz: EXTENT, yaw: 0 };
		if (!rectFree(ctx, corridor, 40, ["spawn", "road", "convoy"])) continue;
		return rx;
	}
	return undefined;
}
function river(ctx: Ctx, fx: number, fz: number): void {
	const rx = chooseRiverX(ctx, fx);
	if (rx === undefined) return;
	for (let z = -EXTENT; z < EXTENT; z += TILE) {
		const mz = z + TILE / 2;
		op(ctx, "block", "Ground", rx, (28 + BASE_BOTTOM) / 2, mz, 176, BASE_BOTTOM - 28, TILE);
		op(ctx, "block", "Air", rx, (32 + GROUND + 8) / 2, mz, 160, GROUND + 8 - 32, TILE);
		op(ctx, "block", "Water", rx, (32 + RIVER_WATER) / 2, mz, 160, RIVER_WATER - 32, TILE);
		for (const side of [-1, 1]) op(ctx, "block", "Sand", rx + side * 94, GROUND - 2, mz, 28, 4, TILE);
	}
	zone(ctx, "river", rx, 0, 110, EXTENT);
	// The bridge carries the track across; abutments on the banks, piers in the river bed.
	const deckY = 70;
	part(ctx, "Bridge deck", "block", rx, deckY, fz, 450, 9, 45, 0, [111, 115, 108], "Concrete", true, false);
	for (const side of [-1, 1]) part(ctx, "Bridge rail", "block", rx, deckY + 6.5, fz + side * 21.5, 450, 4, 2, 0, [70, 74, 78], "Metal", true, false);
	for (const x of [-150, -50, 50, 150]) part(ctx, "Bridge pier", "block", rx + x, (28 + deckY - 4.5) / 2, fz, 14, deckY - 4.5 - 28, 40, 0, [98, 108, 112], "Concrete", true, math.abs(x) > 80);
	for (const x of [-205, 205]) part(ctx, "Bridge abutment", "block", rx + x, (GROUND + deckY - 4.5) / 2, fz, 40, deckY - 4.5 - GROUND, 60, 0, [120, 112, 100], "Concrete", true, true);
	zone(ctx, "bridge", rx, fz, 240, 50);
	// Other roads cross on low road bridges.
	for (const road of ctx.roads) for (let i = 1; i < road.size(); i++) {
		const [ax, az] = road[i - 1], [bx, bz] = road[i];
		if ((ax - rx) * (bx - rx) >= 0) continue;
		const t = (rx - ax) / (bx - ax), z = az + (bz - az) * t;
		if (math.abs(z - fz) < 80) continue;
		part(ctx, "Road bridge", "block", rx, GROUND + 2, z, 200, 3, 30, axisYaw(bx - ax, bz - az), [104, 106, 104], "Concrete", true, false);
		for (const s of [-1, 1]) part(ctx, "Bridge pier", "block", rx + s * 45, (32 + GROUND) / 2, z, 10, GROUND - 32, 24, 0, [98, 108, 112], "Concrete", true, false);
	}
}
function orchard(ctx: Ctx, fx: number, fz: number): void {
	const { rng } = ctx;
	for (let gx = -3; gx <= 3; gx++) for (let gz = 0; gz < 5; gz++) {
		const cx = fx + gx * 180, cz = fz + 440 - gz * 220;
		if (!inMap(cx, cz) || !free(ctx, cx, cz, 70, ["spawn", "hill"])) continue;
		op(ctx, "block", (gx + gz) % 2 === 0 ? "LeafyGrass" : "Ground", cx, GROUND - 2, cz, 96, 4, 150, 0);
		for (const dz of [-45, 0, 45]) prop(ctx, "Broadleaf", cx + rng.range(-3, 3), GROUND - 1, cz + dz, rng.range(0, math.pi * 2), rng.range(0.55, 0.68), rng.int(0, 2));
		zone(ctx, "orchard", cx, cz, 50, 76);
	}
}
/** Nearest clear spot to (x, z) on dry flat land (spiral search). */
function findSpot(ctx: Ctx, x: number, z: number, r: number, height: number): number[] | undefined {
	for (let ring = 0; ring <= 6; ring++) for (let k = 0; k < math.max(1, ring * 6); k++) {
		const a = k / math.max(1, ring * 6) * math.pi * 2, px = x + math.cos(a) * ring * 60, pz = z + math.sin(a) * ring * 60;
		if (!inMap(px, pz) || !free(ctx, px, pz, r, ["spawn"])) continue;
		const y = dryFlat(ctx, px, pz, r * 0.7, 3);
		if (y === undefined || y + height > limit(ctx, px, pz, r)) continue;
		return [px, y, pz];
	}
	return undefined;
}
function relayArray(ctx: Ctx, fx: number, fz: number): number {
	let placed = 0;
	for (const [dx, dz, asset, r, height] of [[-420, 220, "RelayMast", 30, 153], [420, 220, "RelayMast", 30, 153], [-150, 360, "RadarDish", 36, 55], [150, 360, "RadarDish", 36, 55]] as Array<[number, number, PropAsset, number, number]>) {
		const spot = findSpot(ctx, fx + dx, fz + dz, r, height);
		if (!spot) continue;
		prop(ctx, asset, spot[0], spot[1], spot[2], faceYaw(fx - spot[0], fz - spot[2]), 1, 0);
		circle(ctx, "landmark", spot[0], spot[2], r + 10);
		if (asset === "RelayMast") light(ctx, spot[0], spot[1] + height + 3, spot[2], [255, 70, 60]);
		else part(ctx, "Equipment hut", "block", spot[0] + 46, spot[1] + 5, spot[2], 20, 10, 14, 0, [96, 104, 108], "Metal", true, true);
		placed += 1;
	}
	return placed;
}
function cityCentre(ctx: Ctx, fx: number, fz: number): void {
	op(ctx, "block", "Pavement", fx, GROUND - 2, fz, 520, 4, 300, 0);
	const stone: Rgb = [199, 191, 165];
	part(ctx, "Parliament", "block", fx, GROUND + 33, fz - 210, 230, 66, 100, 0, stone, "Concrete", true, true);
	part(ctx, "Parliament steps", "block", fx, GROUND + 3, fz - 150, 200, 6, 20, 0, [214, 206, 182], "Concrete", true, true);
	for (let i = -4; i <= 4; i++) part(ctx, "Parliament column", "cylinder", fx + i * 24, GROUND + 35, fz - 152, 9, 70, 9, 0, [224, 216, 193], "Marble", true, true);
	part(ctx, "Parliament roof", "wedge", fx, GROUND + 72, fz - 180, 240, 12, 70, 0, [120, 116, 106], "Slate", true, false);
	zone(ctx, "plaza", fx, fz - 60, 270, 210);
}

// --- coast: quays, cranes, containers, frigates ----------------------------
function clearOfWater(ctx: Ctx, r: Rect, extra: number): boolean {
	return ctx.plan.waterPaths.every((p) => rectPolyDist(r, p.points) >= waterClear(p) + extra);
}
/** Top of the uploaded quay when its waterline sits on the sea surface. */
export function quayDeck(): number {
	const q = UploadedAssetSpecs.HarbourQuay;
	return WATER_Y - q.groundOffset + q.size.Y;
}
/** Masthead height of the uploaded frigate floating at the waterline. */
function frigateTop(): number {
	const f = UploadedAssetSpecs.Frigate;
	return WATER_Y - f.groundOffset + f.size.Y;
}
function harbour(ctx: Ctx, fx: number, cz: number, frigates: number): void {
	const { rng } = ctx;
	const quays: number[] = [];
	for (let k = -3; k <= 3; k++) {
		const qx = math.round((fx + k * 240) / 4) * 4;
		const quay: Rect = { x: qx, z: cz - 36, hx: 122, hz: 37, yaw: 0 };
		if (math.abs(qx) > 2400 || !clearOfWater(ctx, quay, 6) || ctx.moles.some((m) => rectsOverlap(m, quay, 10))) continue;
		prop(ctx, "HarbourQuay", qx, WATER_Y, cz - 36, 0, 1, 0);
		zone(ctx, "quay", qx, cz - 36, 122, 37);
		quays.push(qx);
		// Every other quay carries a gantry crane on its deck, boom out over the berth (its front, -Z, faces the sea).
		if (quays.size() % 2 === 0) continue;
		const deck = quayDeck();
		for (const ox of [0, -60, 60]) {
			const crane: Rect = { x: qx + ox, z: cz - 36, hx: 30, hz: 100, yaw: 0 };
			if (!clearOfWater(ctx, crane, 6) || deck + 160 > limit(ctx, qx + ox, cz - 36, 100)) continue;
			prop(ctx, "GantryCrane", qx + ox, deck, cz - 36, 0, 1, 0);
			break;
		}
	}
	for (const qx of quays) for (const [dx, dz] of [[-62, 80], [62, 80], [0, 190]]) {
		const x = qx + dx + rng.range(-6, 6), z = cz + dz + rng.range(-6, 6), yaw = math.pi / 2 + rng.range(-0.04, 0.04);
		const rect: Rect = { x, z, hx: 19, hz: 45, yaw }; // the 88-stud stack runs along its local Z
		if (!rectFree(ctx, rect, 8, ["spawn"]) || !onLand(ctx, x - 44, z) || !onLand(ctx, x + 44, z)) continue;
		prop(ctx, "ContainerStack", x, GROUND, z, yaw, 1, rng.int(0, 2));
		zone(ctx, "building", x, z, 19, 45, yaw);
	}
	let placed = 0;
	for (const off of [0, -480, 480, -900, 900, -1300, 1300]) {
		if (placed >= frigates) break;
		const x = fx + off, z = cz - 165;
		const hull: Rect = { x, z, hx: 216, hz: 30, yaw: 0 };
		// Authored road lines that run out over the sea are never built there, so they do not keep ships away.
		if (math.abs(x) > 2300 || !clearOfWater(ctx, hull, 30) || !rectFree(ctx, hull, 20, ["spawn", "road"])) continue;
		if (frigateTop() > limit(ctx, x, z, 216)) continue;
		if (![-200, -100, 0, 100, 200].every((dx) => groundAt(ctx, x + dx, z).water !== undefined)) continue;
		prop(ctx, "Frigate", x, WATER_Y, z, math.pi / 2, 1, 0);
		zone(ctx, "ship", x, z, 216, 30);
		placed += 1;
	}
}
/** Sand beaches along the open shore, skipping quays, moles and canal mouths. */
function beaches(ctx: Ctx, cz: number): void {
	for (let x = -EXTENT + 200; x < EXTENT - 200; x += 400) {
		const rect: Rect = { x, z: cz - 35, hx: 200, hz: 36, yaw: 0 };
		if (!rectFree(ctx, rect, 10, ["spawn", "road", "target", "hill", "settlement", "building", "convoy", "actor", "orchard", "landmark"])) continue;
		op(ctx, "wedge", "Sand", x, (WATER_Y - 4 + GROUND) / 2, cz - 35, 400, GROUND - WATER_Y + 4, 70, 0);
	}
}

// --- ocean: platform hub, store decks, frigate ring ------------------------
function platformHub(ctx: Ctx): number[] | undefined {
	if (ctx.theme !== "ocean") return undefined;
	const g = ctx.bp.ground;
	if (g.size() === 0) return [ctx.layout.focus[0], ctx.layout.focus[1]];
	let sx = 0, sz = 0;
	for (const t of g) { sx += t.x; sz += t.z; }
	return [sx / g.size(), sz / g.size() + 120];
}
const DECK_TOP = WATER_Y + 64;
const STEEL: Rgb = [201, 178, 60], DECK: Rgb = [93, 98, 102];
function storeDeck(ctx: Ctx, index: number, x: number, z: number, hub: number[] | undefined): void {
	part(ctx, "Store deck", "block", x, DECK_TOP - 3, z, 150, 6, 150, 0, DECK, "DiamondPlate", true, false);
	for (const [lx, lz] of [[-60, -60], [60, -60], [60, 60], [-60, 60]]) {
		part(ctx, "Deck leg", "cylinder", x + lx, (SEABED_BOTTOM + DECK_TOP - 6) / 2, z + lz, 7, DECK_TOP - 6 - SEABED_BOTTOM, 7, 0, STEEL, "Metal", true, true);
	}
	for (const side of [-1, 1]) part(ctx, "Deck brace", "block", x, WATER_Y + 16, z + side * 60, 124, 3, 3, 0, STEEL, "Metal", true, false);
	if (hub) {
		const dx = hub[0] - x, dz = hub[1] - z, len = math.sqrt(dx * dx + dz * dz);
		const gap = len - 75 - 140;
		if (gap > 10) {
			const mid = 75 + gap / 2;
			part(ctx, "Walkway", "block", x + dx / len * mid, DECK_TOP - 2, z + dz / len * mid, gap, 3, 10, axisYaw(dx, dz), [150, 150, 146], "Metal", true, false);
		}
	}
	zone(ctx, "deck", x, z, 80, 80);
	ctx.plan.targets.push({ index, x, z, baseY: DECK_TOP, apron: 150, deck: true });
}
function ocean(ctx: Ctx): void {
	const hub = platformHub(ctx)!;
	prop(ctx, "OilPlatform", hub[0], WATER_Y, hub[1], 0, 1, 0);
	zone(ctx, "platform", hub[0], hub[1], 165, 115);
	// Mission 23's frigate ring: three frigates on one circle round the platform, bows along the ring. The command
	// frigate holds the defended station: its hull lies just outboard of the authored point so the protected launch
	// (CombatService's actor) floats alongside it, and green bow and stern beacons pick it out from the other two.
	const defend = MissionCatalog.ExpandedPhases(ctx.bp).find((p) => p.kind === "defend")?.points?.[0];
	if (ctx.layout.landmark !== "platform" || defend === undefined) return;
	const dx = defend.x - hub[0], dz = defend.z - hub[1], radius = math.sqrt(dx * dx + dz * dz), base = math.atan2(dz, dx);
	const tryHull = (x: number, z: number, yaws: number[], protectedHull: boolean): boolean => {
		for (const yaw of yaws) {
			// Long axis (local Z) along world direction (cos yaw, sin yaw).
			const shipYaw = math.atan2(math.cos(yaw), math.sin(yaw));
			const hull: Rect = { x, z, hx: 30, hz: 216, yaw: shipYaw };
			if (!clearOfWater(ctx, hull, 12) || !rectFree(ctx, hull, 20, ["water"]) || !inMap(x, z, 2400) || frigateTop() > limit(ctx, x, z, 216)) continue;
			prop(ctx, "Frigate", x, WATER_Y, z, shipYaw, 1, 0, protectedHull ? "ProtectedHull" : undefined);
			if (protectedHull) for (const tip of [-1, 1]) {
				const [ox, oz] = toWorld(0, tip * 180, shipYaw);
				part(ctx, "Protected beacon", "ball", x + ox, WATER_Y + 32, z + oz, 6, 6, 6, 0, [70, 255, 140], "Neon", false);
			}
			zone(ctx, "ship", x, z, 30, 216, shipYaw);
			return true;
		}
		return false;
	};
	// The command frigate: 60 studs off the defended point in whichever direction keeps its hull out of the launch lanes.
	let placedCommand = false;
	for (let i = 0; i < 8 && !placedCommand; i++) {
		const off = base + i * math.pi / 4;
		const yaws: number[] = [];
		for (let j = 0; j < 8; j++) yaws.push(base + math.pi / 2 + j * math.pi / 8);
		placedCommand = tryHull(defend.x + math.cos(off) * 60, defend.z + math.sin(off) * 60, yaws, true);
	}
	for (let k = 1; k < 3; k++) {
		for (const jitter of [0, 0.12, -0.12, 0.24, -0.24]) {
			const a = base + k * math.pi * 2 / 3 + jitter;
			if (tryHull(hub[0] + math.cos(a) * radius, hub[1] + math.sin(a) * radius, [a + math.pi / 2, a + math.pi / 4, a - math.pi / 4, a], false)) break;
		}
	}
}

// --- settlements, roads, scatter ------------------------------------------
const TREE_IGNORE = ["settlement", "spawn", "hill"];
function settlements(ctx: Ctx): void {
	const { rng, theme, plan } = ctx;
	const coast = theme === "coast", city = ctx.layout.landmark === "city";
	const spX = coast ? 230 : theme === "farm" ? 170 : 150, spZ = coast ? 190 : theme === "farm" ? 170 : 140;
	const lit = plan.lamps && coast;
	for (const [sx, sz, cols, rows] of ctx.layout.settlements) {
		for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
			const x = sx + c * spX + rng.range(-8, 8), z = sz + r * spZ + rng.range(-8, 8);
			const choices: PropAsset[] = coast
				? ((c + r * 2) % (city ? 3 : 5) === 0 ? ["CityTower", "OfficeMidrise", "ApartmentBlock"] : (c + r) % 2 === 0 ? ["ApartmentBlock", "OfficeMidrise"] : ["OfficeMidrise", "ApartmentBlock"])
				: theme === "farm" ? [(["Farmhouse", "Barn", "GrainSilo", "Farmhouse"] as PropAsset[])[(c + 2 * r) % 4]] : [(["Farmhouse", "Barn", "Farmhouse"] as PropAsset[])[(c + r) % 3]];
			const yaw = coast ? (r % 2 === 0 ? 0 : math.pi) + rng.range(-0.03, 0.03) : rng.int(0, 3) * math.pi / 2 + rng.range(-0.15, 0.15);
			for (const asset of choices) {
				const size = UploadedAssetSpecs[asset].size;
				const cap = (limit(ctx, x, z, math.max(size.X, size.Z) / 2) - GROUND) / size.Y;
				const scale = asset === "CityTower" ? math.min(rng.range(0.62, 0.85), cap) : math.min(rng.range(0.94, 1.06), cap);
				if (scale < (asset === "CityTower" ? 0.5 : 0.9)) continue;
				const rect: Rect = { x, z, hx: size.X * scale / 2, hz: size.Z * scale / 2, yaw };
				if (!inMap(x, z, 2600) || !rectFree(ctx, rect, 12, ["settlement", "spawn"])) continue;
				let ok = true;
				for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
					const [ox, oz] = toWorld(cx * rect.hx, cz * rect.hz, yaw);
					if (!onLand(ctx, x + ox, z + oz) || groundAt(ctx, x + ox, z + oz).solid > GROUND + 1) ok = false;
				}
				if (!ok) continue;
				prop(ctx, asset, x, GROUND, z, yaw, scale, rng.int(0, 2));
				zone(ctx, "building", x, z, rect.hx, rect.hz, yaw);
				if (lit) {
					const [ox, oz] = toWorld(0, -(rect.hz + 0.4), yaw);
					part(ctx, "Lit windows", "block", x + ox, GROUND + size.Y * scale * rng.range(0.3, 0.7), z + oz, rect.hx * 1.3, 2.5, 0.5, yaw, [232, 204, 132], "Neon", false);
				}
				break;
			}
		}
		if (coast) {
			// Street grid between the blocks.
			const x0 = sx - spX / 2, x1 = sx + (cols - 0.5) * spX, z0 = sz - spZ / 2, z1 = sz + (rows - 0.5) * spZ;
			for (let r = 0; r <= rows; r++) roadLine(ctx, [[x0, z0 + r * spZ], [x1, z0 + r * spZ]], 22, [58, 62, 66], "Street");
			for (let c = 0; c <= cols; c++) roadLine(ctx, [[x0 + c * spX, z0], [x0 + c * spX, z1]], 22, [58, 62, 66], "Street");
		}
	}
}
/** A flat road polyline at ground level, cut where it would leave dry flat land or cross a boat path. */
function roadLine(ctx: Ctx, points: number[][], width: number, color: Rgb, name = "Road"): void {
	for (let i = 1; i < points.size(); i++) {
		const [ax, az] = points[i - 1], [bx, bz] = points[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
		const n = math.max(1, math.ceil(len / 20));
		let runStart: number | undefined;
		const flush = (endK: number) => {
			if (runStart === undefined) return;
			const t0 = runStart / n, t1 = endK / n;
			const sx0 = ax + (bx - ax) * t0, sz0 = az + (bz - az) * t0, sx1 = ax + (bx - ax) * t1, sz1 = az + (bz - az) * t1;
			const l = math.sqrt((sx1 - sx0) * (sx1 - sx0) + (sz1 - sz0) * (sz1 - sz0));
			if (l > 10) for (let piece = 0; piece < math.ceil(l / 1800); piece++) {
				const pieces = math.ceil(l / 1800), u0 = piece / pieces, u1 = (piece + 1) / pieces;
				const px = sx0 + (sx1 - sx0) * (u0 + u1) / 2, pz = sz0 + (sz1 - sz0) * (u0 + u1) / 2;
				part(ctx, name, "block", px, GROUND + 0.5, pz, l / pieces + width * 0.5, 1, width, axisYaw(bx - ax, bz - az), color, "Asphalt", true, true);
			}
			runStart = undefined;
		};
		// A sample is good when the whole cross-section around it (both edges, and the end overhang) is on flat dry ground.
		const ux = (bx - ax) / len, uz = (bz - az) / len, reach = width * 0.25 + 2;
		const flatAt = (x: number, z: number) => {
			const t = groundAt(ctx, x, z);
			return t.water === undefined && math.abs(t.solid - GROUND) < 0.5;
		};
		for (let k = 0; k <= n; k++) {
			const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
			let ok = ctx.plan.waterPaths.every((p) => polyDist(x, z, p.points) > (p.canal ? p.half + 12 : p.half));
			for (const along of [-reach, 0, reach]) for (const side of [-1, 0, 1]) {
				if (ok && !flatAt(x + ux * along - uz * side * width / 2, z + uz * along + ux * side * width / 2)) ok = false;
			}
			if (ok && runStart === undefined) runStart = k;
			if (!ok) flush(k - 1);
		}
		flush(n);
	}
}
function roads(ctx: Ctx): void {
	const dirt: Rgb = [128, 104, 78];
	for (const road of ctx.roads) roadLine(ctx, road, 25, ctx.theme === "canyon" ? dirt : [54, 58, 62]);
	for (const path of ctx.plan.groundPaths) roadLine(ctx, path, 20, dirt, "Track");
}
function scatterTrees(ctx: Ctx, total: number, pineShare: number): void {
	const { rng } = ctx;
	const spots: number[][] = [];
	for (const p of ctx.plan.props) if (p.asset === "Pine" || p.asset === "Broadleaf") spots.push([p.x, p.z]);
	let count = 0;
	const tryTree = (x: number, z: number): boolean => {
		if (count >= total || !inMap(x, z, 2700) || !free(ctx, x, z, 16, TREE_IGNORE)) return false;
		for (const s of spots) if ((s[0] - x) * (s[0] - x) + (s[1] - z) * (s[1] - z) < 22 * 22) return false;
		const y = dryFlat(ctx, x, z, 9, 6);
		if (y === undefined) return false;
		const pine = rng.next() < pineShare, scale = rng.range(0.75, 1.3);
		const height = (pine ? 63.3 : 47.7) * scale;
		if (y + height > limit(ctx, x, z, 20)) return false;
		prop(ctx, pine ? "Pine" : "Broadleaf", x, y - 1, z, rng.range(0, math.pi * 2), scale, rng.int(0, 2));
		spots.push([x, z]);
		count += 1;
		return true;
	};
	// Woods: clusters of 6-14 trees.
	for (let attempt = 0; attempt < 300 && count < total * 0.75; attempt++) {
		const cx = rng.range(-2500, 2500), cz = rng.range(-2500, 2500);
		if (!free(ctx, cx, cz, 50, TREE_IGNORE)) continue;
		const n = rng.int(6, 14), radius = rng.range(50, 130);
		for (let j = 0; j < n * 3; j++) {
			const a = rng.range(0, math.pi * 2), d = radius * math.sqrt(rng.next());
			tryTree(cx + math.cos(a) * d, cz + math.sin(a) * d);
		}
	}
	// Roadside rows, then singles.
	for (const road of ctx.roads) for (let i = 1; i < road.size(); i++) {
		const [ax, az] = road[i - 1], [bx, bz] = road[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
		for (let t = 60; t < len; t += 110) for (const side of [-1, 1]) tryTree(ax + (bx - ax) * t / len - (bz - az) / len * side * 44, az + (bz - az) * t / len + (bx - ax) / len * side * 44);
	}
	for (let attempt = 0; attempt < 400 && count < total; attempt++) tryTree(rng.range(-2600, 2600), rng.range(-2600, 2600));
}
function scatterRocks(ctx: Ctx, total: number): void {
	const { rng } = ctx;
	const variants: PropAsset[] = ["RockA", "RockB", "RockC"];
	let count = 0;
	const tryRock = (x: number, z: number, big: number) => {
		if (count >= total || !inMap(x, z, 2700) || !free(ctx, x, z, 12, ["spawn", "hill", "settlement"])) return;
		const t = groundAt(ctx, x, z);
		if (t.water !== undefined || t.solid < GROUND - 1) return;
		const asset = variants[rng.int(0, 2)], scale = rng.range(0.9, big);
		const spec = UploadedAssetSpecs[asset];
		let lowest = t.solid;
		for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) lowest = math.min(lowest, groundAt(ctx, x + dx * spec.size.X * scale / 2, z + dz * spec.size.Z * scale / 2).solid);
		if (lowest + spec.size.Y * scale > limit(ctx, x, z, 30)) return;
		prop(ctx, asset, x, lowest - 0.5, z, rng.range(0, math.pi * 2), scale, rng.int(0, 2));
		zone(ctx, "rock", x, z, spec.size.X * scale / 2, spec.size.Z * scale / 2);
		count += 1;
	};
	// Talus belts around the relief, then singles.
	for (let attempt = 0; attempt < total * 6 && count < total * 0.65 && ctx.ridgeRects.size() > 0; attempt++) {
		const r = ctx.ridgeRects[rng.int(0, ctx.ridgeRects.size() - 1)];
		const edge = rng.int(0, 3), along = rng.range(-1, 1), out = rng.range(30, 150);
		const lx = edge < 2 ? along * r.hx : (edge === 2 ? 1 : -1) * (r.hx + out), lz = edge < 2 ? (edge === 0 ? 1 : -1) * (r.hz + out) : along * r.hz;
		const [ox, oz] = toWorld(lx, lz, r.yaw);
		tryRock(r.x + ox, r.z + oz, ctx.theme === "canyon" ? 3.5 : 3);
	}
	for (let attempt = 0; attempt < total * 8 && count < total; attempt++) tryRock(rng.range(-2600, 2600), rng.range(-2600, 2600), 2.4);
}
/** Ground or sea tiles from the terrain edge to FAR (parts: cheap, never meshed as voxels). */
function farTiles(ctx: Ctx, waterColor: Rgb): void {
	const groundColor: Rgb = ctx.theme === "canyon" ? [166, 122, 84] : ctx.theme === "plateau" ? [104, 118, 82] : [96, 128, 70];
	const cz = ctx.plan.coastZ;
	const sea: Rgb = [math.floor(waterColor[0] * 0.85), math.floor(waterColor[1] * 0.85), math.floor(waterColor[2] * 0.85)];
	for (let tx = -FAR; tx < FAR; tx += TILE) for (let tz = -FAR; tz < FAR; tz += TILE) {
		if (tx >= -EXTENT && tx + TILE <= EXTENT && tz >= -EXTENT && tz + TILE <= EXTENT) continue;
		const cuts: number[][] = cz !== undefined && tz < cz && tz + TILE > cz ? [[tz, cz], [cz, tz + TILE]] : [[tz, tz + TILE]];
		for (const [z0, z1] of cuts) {
			const wet = ctx.theme === "ocean" || (cz !== undefined && z1 <= cz);
			const midX = tx + TILE / 2, midZ = (z0 + z1) / 2;
			if (wet) part(ctx, "Sea", "block", midX, WATER_Y - 2, midZ, TILE, 4, z1 - z0, 0, sea, "SmoothPlastic", true, false, { reflectance: 0.12 });
			else part(ctx, "Far ground", "block", midX, GROUND - 4, midZ, TILE, 8, z1 - z0, 0, groundColor, ctx.theme === "canyon" ? "Sand" : "Grass", true, false);
		}
	}
}

// --- entry point ------------------------------------------------------------
const cache = new Map<number, WorldPlan>();
function build(id: number): WorldPlan {
	const bp = MissionCatalog.Get(id), layout = layoutFor(id), theme = THEMES[bp.region];
	const env = ENVIRONMENTS[bp.environment];
	const plan: WorldPlan = {
		id, name: layout.name, theme, environment: bp.environment, lamps: lampsOn(bp.environment),
		ground: GROUND, waterY: theme === "coast" || theme === "ocean" ? WATER_Y : undefined, coastZ: theme === "coast" ? COAST_Z[id] ?? -1200 : undefined,
		ops: [], parts: [], props: [], targets: [], waterPaths: [], groundPaths: [], air: airSamples(bp),
		materialColors: MATERIAL_COLORS[theme],
	};
	const ctx: Ctx = { id, bp, layout, theme, rng: new Rng(id * 7919 + 17), plan, zones: [], corridors: [], ridgeRects: [], moles: [], roads: [] };
	reserve(ctx);
	const [fx, fz] = layout.focus;
	for (const s of layout.settlements) {
		const spX = theme === "coast" ? 230 : theme === "farm" ? 170 : 150, spZ = theme === "coast" ? 190 : theme === "farm" ? 170 : 140;
		zone(ctx, "settlement", s[0] + (s[2] - 1) * spX / 2, s[1] + (s[3] - 1) * spZ / 2, s[2] * spX / 2 + 20, s[3] * spZ / 2 + 20);
	}
	if (theme === "coast") coastBase(ctx, plan.coastZ!);
	else if (theme === "ocean") oceanBase(ctx);
	else inlandBase(ctx);
	if (theme === "coast") canals(ctx, plan.coastZ!);
	ridges(ctx);
	if (layout.landmark === "bridge") river(ctx, fx, fz);
	targets(ctx);
	if (layout.landmark === "runway") airfield(ctx, fx, fz);
	else if (bp.region === "canyon_airfield") chooseAirfield(ctx);
	if (layout.landmark === "orchard") orchard(ctx, fx, fz);
	else if (layout.landmark === "array") relayArray(ctx, fx, fz);
	else if (layout.landmark === "city") cityCentre(ctx, fx, fz);
	// Relay missions always show their masts and dishes, even when the landmark is an airstrip.
	if (bp.region === "plateau_relay" && layout.landmark !== "array") {
		for (const [x, z] of [[-fx, fz], [0, -600], [-900, -900], [900, -900], [0, 0]]) if (relayArray(ctx, x, z) >= 2) break;
	}
	if (theme === "coast") harbour(ctx, fx, plan.coastZ!, layout.landmark === "harbor" ? (id === 20 || id === 25 ? 2 : 1) : 0);
	if (theme === "ocean") ocean(ctx);
	corridorWalls(ctx);
	hills(ctx);
	mountainRing(ctx);
	settlements(ctx);
	if (theme === "coast") beaches(ctx, plan.coastZ!);
	roads(ctx);
	const treeTotal = theme === "farm" ? 140 : theme === "coast" ? 90 : theme === "plateau" ? 80 : theme === "canyon" ? 36 : 0;
	const orchardTrees = plan.props.filter((p) => p.asset === "Broadleaf").size();
	scatterTrees(ctx, math.max(treeTotal - orchardTrees, theme === "farm" ? 40 : 0), theme === "farm" ? 0.3 : theme === "coast" ? 0.4 : theme === "plateau" ? 0.85 : 0.6);
	scatterRocks(ctx, theme === "canyon" ? 44 : theme === "plateau" ? 36 : theme === "farm" ? 22 : theme === "coast" ? 14 : 0);
	farTiles(ctx, env.water.color);
	return plan;
}

export interface WorldCounts {
	terrainOps: number; voxelWrites: number; bumpCells: number; parts: number; props: number; uniqueMeshes: number;
	trees: number; rocks: number; buildings: number; ships: number; instances: number;
}
const BUILDINGS = new Set<PropAsset>(["Hangar", "ControlTower", "OfficeMidrise", "ApartmentBlock", "CityTower", "Farmhouse", "Barn", "GrainSilo", "ContainerStack", "HarbourQuay", "GantryCrane", "RadarDish", "RelayMast", "OilPlatform"]);
export function countPlan(plan: WorldPlan): WorldCounts {
	let voxels = 0, cells = 0;
	for (const o of plan.ops) {
		if (o.shape === "block") voxels += o.sx * o.sy * o.sz / 64;
		else if (o.shape === "wedge") voxels += o.sx * o.sy * o.sz / 128;
		else if (o.shape === "ball") voxels += 4 / 3 * math.pi * o.sx * o.sx * o.sx / 64;
		else if (o.shape === "cylinder") voxels += math.pi * o.sx * o.sx * o.sy / 64;
		else cells += (math.ceil(o.sx / 2) + 1) * (math.ceil(o.sz / 2) + 1) * (math.ceil(o.sy / 4) + 2);
	}
	const unique = new Set<string>();
	let trees = 0, rocks = 0, buildings = 0, ships = 0;
	for (const p of plan.props) {
		unique.add(p.asset);
		if (p.asset === "Pine" || p.asset === "Broadleaf") trees += 1;
		else if (p.asset === "RockA" || p.asset === "RockB" || p.asset === "RockC") rocks += 1;
		else if (p.asset === "Frigate") ships += 1;
		else if (BUILDINGS.has(p.asset)) buildings += 1;
	}
	return {
		terrainOps: plan.ops.size(), voxelWrites: math.floor(voxels + cells), bumpCells: cells, parts: plan.parts.size(), props: plan.props.size(), uniqueMeshes: unique.size(),
		// Each placed mesh is a MeshPart plus its SurfaceAppearance.
		trees, rocks, buildings, ships, instances: plan.parts.size() + plan.props.size() * 2,
	};
}

export const WorldPlanner = {
	/** The deterministic plan for missions 3-27 (cached). */
	Build(id: number): WorldPlan {
		assert(id >= 3 && id <= 27, `No world plan for mission ${id}`);
		let plan = cache.get(id);
		if (plan === undefined) { plan = build(id); cache.set(id, plan); }
		return plan;
	},
	Counts: countPlan,
};
