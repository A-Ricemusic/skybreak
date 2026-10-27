import { ENVIRONMENTS, lampsOn, type Rgb } from "./EnvironmentPresets";
import { FlightMath } from "./FlightMath";
import { MissionCatalog, type EnvironmentPreset, type FlightPoint, type MissionBlueprint, type MissionRegion } from "./MissionCatalog";
import { layoutFor, type LevelLayout } from "./MissionLayouts";
import { bumpRegion, fillVoxels, regionCells } from "./TerrainSchedule";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";

// Pure world plans for missions 3-27: every terrain voxel operation, primitive
// part, uploaded-model placement and ground-target site of a mission world, as
// plain numbers. The server (RelayWorld) executes a plan; the specs audit the
// same plan offline (no Studio): flight points clear of terrain, targets on
// ground, escort boats on water, nothing floating, and the mobile budget.
//
// Detail falls off with distance: the authored mission (every flight point,
// target and boat path, inside ±2400) sits in a full-detail CORE; from there to
// the flyable edge (FlightMath.HardBoundary) is explorable terrain with larger,
// cheaper features and sparser props; a ring of uploaded mountain ridges stands
// just past the edge, and stretched skirt parts carry the ground or sea to FAR.
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
	/** Rendered size = (sx, sy, sz) x stretch (a Brick SpecialMesh): far skirts wider than the 2048-stud part limit. */
	stretch?: [number, number, number];
}

export type PropAsset = "Frigate" | "OilPlatform" | "HarbourQuay" | "ContainerStack" | "GantryCrane" | "Hangar" | "ControlTower" | "OfficeMidrise" | "ApartmentBlock" | "CityTower" | "Farmhouse" | "Barn" | "GrainSilo" | "RadarDish" | "RelayMast" | "Pine" | "Broadleaf" | "RockA" | "RockB" | "RockC"
	| "RunwaySegment" | "RunwayThreshold" | "ApronSlab" | "RoadSegment" | "DirtTrack" | "RoadBridge" | "TargetPad" | "StoreDeck" | "Gangway" | "EquipmentHut" | "CivicHall"
	| "CliffSandstone" | "CliffGranite" | "RidgeAlpine" | "RidgeDesert" | "FenceSpan" | "PowerLineSpan";
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
/** Full-detail core (two voxel layers, dense props); the authored mission lies inside ±2400. */
export const CORE = 3000;
/** Voxel terrain half-extent: one 4-stud layer from CORE out, 800 studs past the flyable edge. */
export const EXTENT = 6800;
/** Far skirts (stretched parts) carry the ground or sea from EXTENT out to FAR. */
export const FAR = 24000;
/** Centre line of the backdrop ridge ring: the ridges' inner foot stays 400+ studs past the hard boundary. */
export const BACKDROP = 7600;
/** The explorable ring's single voxel layer, and its shallower sea (two water layers on a mud layer). */
const OUTER_BOTTOM = 40, OUTER_SEABED = 24, OUTER_SEA_BOTTOM = 20;
/** Highest terrain top allowed in the explorable ring (audited): the airspace over it stays open. */
export const OUTER_CEILING = 560;
const TILE = 2000;
/**
 * Mobile budget per mission world (audited by WorldPlan.spec; counts in docs/world-realism.md). Props cover
 * the explorable ring and the modular runway, road, fence and power-line pieces that replaced primitive parts;
 * every prop is a clone of one cached template, so repeated pieces draw as instanced meshes.
 */
export const WORLD_BUDGET = { parts: 200, props: 520, uniqueMeshes: 26, voxelWrites: 100e6, bumpCells: 2.5e6, terrainOps: 900, instances: 1200 };
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
	/** Roads from the authored road's ends out to the map edge, through the explorable ring. */
	highways: number[][][];
	/** The canal carve, water, bed and beach ops, written again once every land op is down. */
	canalOps: TerrainOp[];
	/** Cliff panels placed so far (capped per world) and road calls (each lifts its pieces a little, so crossings never z-fight). */
	cliffs: number; roadCalls: number;
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
function part(ctx: Ctx, name: string, shape: PartShape, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, color: Rgb, material: string, solid = true, grounded = false, extra: { transparency?: number; reflectance?: number; stretch?: [number, number, number] } = {}): PartSpec {
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
/** Chebyshev radius: the map is square, so the detail tiers are too. */
export function ring(x: number, z: number): number { return math.max(math.abs(x), math.abs(z)); }
/** A random point in the square ring between `inner` and `outer`. */
function ringPoint(rng: Rng, inner: number, outer: number): [number, number] {
	for (let i = 0; i < 40; i++) {
		const x = rng.range(-outer, outer), z = rng.range(-outer, outer);
		if (ring(x, z) >= inner) return [x, z];
	}
	return [outer, rng.range(-outer, outer)];
}

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
/** The square ring [-outer, outer]^2 minus [-inner, inner]^2 as four slabs, clipped to z in [z0, z1]. */
function ringSlab(ctx: Ctx, material: TerrainMaterial, y0: number, y1: number, inner: number, outer: number, z0 = -outer, z1 = outer): void {
	for (const [ax, bx, az, bz] of [[-outer, outer, -outer, -inner], [-outer, outer, inner, outer], [-outer, -inner, -inner, inner], [inner, outer, -inner, inner]]) {
		const lo = math.max(az, z0), hi = math.min(bz, z1);
		if (hi - lo > 0.5) slab(ctx, material, ax, bx, lo, hi, y0, y1);
	}
}
/** Ground: two voxel layers in the core, one in the explorable ring (detail falls off with distance). */
function ground(ctx: Ctx, material: TerrainMaterial, z0 = -EXTENT): void {
	slab(ctx, material, -CORE, CORE, math.max(-CORE, z0), CORE, BASE_BOTTOM, GROUND);
	ringSlab(ctx, material, OUTER_BOTTOM, GROUND, CORE, EXTENT, z0, EXTENT);
}
/** Sea: deep water in the core (boats, berths), two water layers further out. */
function sea(ctx: Ctx, z1 = EXTENT): void {
	slab(ctx, "Water", -CORE, CORE, -CORE, math.min(CORE, z1), SEABED, WATER_Y);
	slab(ctx, "Mud", -CORE, CORE, -CORE, math.min(CORE, z1), SEABED_BOTTOM, SEABED);
	ringSlab(ctx, "Water", OUTER_SEABED, WATER_Y, CORE, EXTENT, -EXTENT, z1);
	ringSlab(ctx, "Mud", OUTER_SEA_BOTTOM, OUTER_SEABED, CORE, EXTENT, -EXTENT, z1);
}
/** Large material patches across the explorable ring: fields, washes and rock flats at a coarser grain. */
function outerPatches(ctx: Ctx, mats: TerrainMaterial[], count: number, z0 = -EXTENT): void {
	const { rng } = ctx;
	for (let i = 0; i < count; i++) {
		const [x, z] = ringPoint(rng, CORE + 150, EXTENT - 350);
		if (z < z0 + 400) continue;
		op(ctx, "block", mats[i % mats.size()], x, GROUND - 2, z, rng.range(520, 940), 4, rng.range(480, 980), rng.range(0, math.pi));
	}
}
function inlandBase(ctx: Ctx): void {
	const { rng, theme } = ctx;
	ground(ctx, BASE_MATERIAL[theme]);
	// Material patches in the top voxel layer: fields, dry washes, rock flats.
	if (theme === "farm") {
		const mats: TerrainMaterial[] = ["LeafyGrass", "Ground", "Grass", "LeafyGrass", "Mud", "Ground"];
		for (let gx = -2160; gx <= 2160; gx += 360) for (let gz = -2200; gz <= 2200; gz += 440) {
			if (rng.next() < 0.3) continue;
			op(ctx, "block", mats[rng.int(0, mats.size() - 1)], gx + rng.range(-20, 20), GROUND - 2, gz + rng.range(-20, 20), rng.range(230, 310), 4, rng.range(300, 380), rng.range(-0.05, 0.05));
		}
		outerPatches(ctx, mats, 26);
	} else {
		const mats: TerrainMaterial[] = theme === "canyon" ? ["Sand", "Sandstone", "Sand", "Rock", "Grass"] : ["Rock", "Ground", "Slate", "Ground", "Sand"];
		for (let i = 0; i < 26; i++) {
			const m = mats[i % mats.size()];
			const long = m === "Sand" ? rng.range(500, 900) : rng.range(180, 380);
			op(ctx, "block", m, rng.range(-2600, 2600), GROUND - 2, rng.range(-2600, 2600), m === "Sand" ? rng.range(70, 130) : rng.range(160, 340), 4, long, rng.range(0, math.pi));
		}
		outerPatches(ctx, mats, 20);
	}
}
function coastBase(ctx: Ctx, cz: number): void {
	const { rng } = ctx;
	sea(ctx, cz);
	ground(ctx, "Grass", cz);
	// The land edge is a rock wall down to the seabed so no slab floats over the water.
	slab(ctx, "Rock", -EXTENT, EXTENT, cz, cz + 48, SEABED_BOTTOM, OUTER_BOTTOM);
	for (let i = 0; i < 14; i++) {
		const x = rng.range(-2600, 2600), z = rng.range(cz + 200, 2600);
		op(ctx, "block", i % 3 === 0 ? "Ground" : "LeafyGrass", x, GROUND - 2, z, rng.range(160, 320), 4, rng.range(160, 320), rng.range(0, math.pi));
	}
	outerPatches(ctx, ["LeafyGrass", "Ground", "LeafyGrass", "Grass"], 16, cz + 200);
}
function oceanBase(ctx: Ctx): void {
	sea(ctx);
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
			const seaA = az < edge, seaB = bz < edge;
			if (seaA) { const t = (edge - az) / (bz - az); ax += (bx - ax) * t; az = edge; }
			if (seaB) { const t = (edge - bz) / (az - bz); bx += (ax - bx) * t; bz = edge; }
			const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
			if (len < 1) continue;
			const mx = (ax + bx) / 2, mz = (az + bz) / 2, yaw = axisYaw(bx - ax, bz - az);
			// The banks cap a dead end 8 studs past the carve, but stop with the carve at a sea mouth
			// (a cap there would stand across the channel in open water).
			const capA = seaA ? 0 : 8, capB = seaB ? 0 : 8;
			const ux0 = (bx - ax) / len, uz0 = (bz - az) / len, shift = (capB - capA) / 2;
			push(walls, "block", "Concrete", mx + ux0 * shift, (SEABED_BOTTOM + GROUND) / 2, mz + uz0 * shift, len + 2 * h + capA + capB, GROUND - SEABED_BOTTOM, 2 * (h + 8), yaw);
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
	for (const list of [carves, waters, beds, beaches]) for (const o of list) ctx.canalOps.push(o);
}
/**
 * Writes the canal channels again after every land op (civic pavement, moles, hills), so nothing
 * built later roofs or fills a boat's channel. The concrete banks stay as first written.
 */
function reopenCanals(ctx: Ctx): void {
	for (const o of ctx.canalOps) ctx.plan.ops.push(o);
}
/**
 * The uploaded concrete hardstand, `size` studs square (uniformly scaled from its 150-stud model), its top at
 * APRON_TOP whatever the scale: the slab is 8 thick and sinks into the ground, so any scale from 0.6 rests on it.
 */
export function hardstandY(size: number): number {
	const pad = UploadedAssetSpecs.TargetPad, s = size / pad.size.X;
	return APRON_TOP - (pad.size.Y - pad.groundOffset) * s;
}
function hardstand(ctx: Ctx, x: number, z: number, size: number): void {
	prop(ctx, "TargetPad", x, hardstandY(size), z, 0, size / UploadedAssetSpecs.TargetPad.size.X);
}
/** Target hardstands, shrunk until clear of the boat paths; coastal targets get a concrete mole to the shore. */
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
		hardstand(ctx, g.x, g.z, size);
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
			cliffFaces(ctx, cx, cz, tw, td, ty, ttop, 8);
		}
		if (t === tiers.size() - 1 && !canyon) op(ctx, "block", "Grass", cx, ttop - 2, cz, tw - 24, 4, td - 24, ty);
		previous = ttop;
	}
}
/** Studs a cliff panel's back sinks into the wall it is set against (at scale 1). */
const CLIFF_EMBED = 15;
/** Most cliff panels in one world (they are the largest repeated rock meshes). */
const CLIFF_CAP = 44;
/**
 * Uploaded rock-face panels set into the four walls of a mesa tier (centre, size, yaw, top): sandstone in
 * canyons, granite elsewhere. Each panel's back sinks CLIFF_EMBED into the wall, its top stays under the
 * tier top (so under every flight limit the tier already respects) and its foot rests on the ground.
 */
function cliffFaces(ctx: Ctx, cx: number, cz: number, tw: number, td: number, yaw: number, top: number, perMesa: number): void {
	const asset: PropAsset = ctx.theme === "canyon" ? "CliffSandstone" : "CliffGranite";
	const spec = UploadedAssetSpecs[asset];
	const s = math.min(1.5, (top - GROUND) / (spec.size.Y - spec.groundOffset));
	if (s < 0.5) return;
	const panel = spec.size.X * s, half = spec.size.Z * s / 2;
	let placed = 0;
	for (const [nx, nz, length, dist] of [[0, -1, tw, td / 2], [0, 1, tw, td / 2], [-1, 0, td, tw / 2], [1, 0, td, tw / 2]]) {
		const n = math.min(math.floor(length * 0.85 / (panel * 1.3)), 3);
		for (let k = 0; k < n && placed < perMesa && ctx.cliffs < CLIFF_CAP; k++) {
			const along = (-0.5 + (k + 0.5) / n) * length * 0.85 + ctx.rng.range(-0.1, 0.1) * panel;
			const out = dist + half - CLIFF_EMBED * s;
			const [ox, oz] = toWorld(nx === 0 ? along : nx * out, nx === 0 ? nz * out : along, yaw);
			const [wnx, wnz] = toWorld(nx, nz, yaw);
			const x = cx + ox, z = cz + oz, faceYawValue = faceYaw(wnx, wnz);
			if (!onLand(ctx, x + wnx * half, z + wnz * half)) continue;
			prop(ctx, asset, x, GROUND, z, faceYawValue, s);
			zone(ctx, "rock", x, z, panel / 2, half, faceYawValue);
			placed += 1;
			ctx.cliffs += 1;
		}
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
	let placed = 0, attempts = 0, cells = 0;
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
		// The hills' Luau voxel loop is the slowest terrain work: keep the whole world's cells inside the budget.
		const hill: TerrainOp = { shape: "bump", material: "Grass", x, y: GROUND, z, sx: rx, sy: height, sz: rz, yaw };
		if (cells + regionCells(bumpRegion(hill)) > WORLD_BUDGET.bumpCells * 0.95) continue;
		cells += regionCells(bumpRegion(hill));
		op(ctx, "bump", rng.next() < 0.3 && theme !== "canyon" ? "LeafyGrass" : material, x, GROUND, z, rx, height, rz, yaw);
		circle(ctx, "hill", x, z, reach);
		placed += 1;
	}
}
/** A long soft ridge (a wedge pair on the single outer layer): cheap relief for the explorable ring. */
function softRidge(ctx: Ctx, x: number, z: number, length: number, height: number, yaw: number, body: TerrainMaterial): void {
	const depth = math.max(height * 3.2, 320);
	for (const s of [-1, 1]) {
		const [ox, oz] = toWorld(0, s * depth / 4, yaw);
		op(ctx, "wedge", body, x + ox, OUTER_BOTTOM + (height + GROUND - OUTER_BOTTOM) / 2, z + oz, length, height + GROUND - OUTER_BOTTOM, depth / 2, s < 0 ? yaw : yaw + math.pi);
	}
}
/** A single-tier mesa with a strata band, talus and cliff panels: the explorable ring's larger, coarser relief. */
function outerMesa(ctx: Ctx, x: number, z: number, w: number, d: number, top: number, yaw: number): void {
	const canyon = ctx.theme === "canyon";
	const body: TerrainMaterial = canyon ? "Sandstone" : "Rock", band: TerrainMaterial = canyon ? "Rock" : "Slate";
	op(ctx, "block", body, x, (OUTER_BOTTOM + top) / 2, z, w, top - OUTER_BOTTOM, d, yaw);
	op(ctx, "block", band, x, top - (top - GROUND) * 0.35, z, w + 2, 6, d + 2, yaw);
	const talus = math.min(50, (top - GROUND) * 0.3), depth = talus * 1.8;
	for (const [lx, lz, length, turn] of [[0, -(d / 2 + depth / 2), w * 0.9, 0], [0, d / 2 + depth / 2, w * 0.9, math.pi], [w / 2 + depth / 2, 0, d * 0.9, -math.pi / 2], [-(w / 2 + depth / 2), 0, d * 0.9, math.pi / 2]]) {
		const [ox, oz] = toWorld(lx, lz, yaw);
		op(ctx, "wedge", canyon ? "Ground" : "Rock", x + ox, GROUND - 2 + talus / 2, z + oz, length, talus, depth, yaw + turn);
	}
	if (!canyon) op(ctx, "block", "Grass", x, top - 2, z, w - 24, 4, d - 24, yaw);
	cliffFaces(ctx, x, z, w, d, yaw, top, 4);
}
/**
 * The explorable ring between the core and the flyable edge: one feature per jittered 1500-stud cell at most
 * (mesas and soft ridges on land, islets at sea), lower and coarser than the core's relief, clear of the
 * highways, rivers and anything reserved.
 */
function outerRelief(ctx: Ctx): void {
	const { rng, theme } = ctx;
	const cz = ctx.plan.coastZ;
	const body: TerrainMaterial = theme === "canyon" ? "Sandstone" : theme === "plateau" ? "Rock" : "Grass";
	for (let gx = -5250; gx <= 5250; gx += 1500) for (let gz = -5250; gz <= 5250; gz += 1500) {
		if (ring(gx, gz) < 3500) continue;
		if (rng.next() < (theme === "ocean" ? 0.7 : 0.45)) continue;
		const x = gx + rng.range(-300, 300), z = gz + rng.range(-300, 300);
		const w = rng.range(520, 980), d = rng.range(420, 760), yaw = rng.range(-0.35, 0.35);
		if (theme === "ocean" || (cz !== undefined && z + d / 2 < cz - 300)) {
			const rect: Rect = { x, z, hx: w * 0.3 + 60, hz: d * 0.3 + 60, yaw: 0 };
			if (rectFree(ctx, rect, 60, [])) island(ctx, x, z, w * 0.45, d * 0.45, WATER_Y + rng.range(80, 170));
			continue;
		}
		const rect: Rect = { x, z, hx: w / 2 + 80, hz: d / 2 + 80, yaw };
		if (!rectFree(ctx, rect, 40, []) || ring(x, z) + math.max(w, d) / 2 > EXTENT - 300) continue;
		if (cz !== undefined && z - math.max(w, d) / 2 - 350 < cz) continue;
		const mesa = (theme === "canyon" || theme === "plateau") && rng.next() < 0.6;
		const top = GROUND + (mesa ? rng.range(150, 330) : rng.range(110, 230));
		if (mesa) outerMesa(ctx, x, z, w, d, top, yaw);
		else softRidge(ctx, x, z, math.max(w, d), top - GROUND, yaw + (w >= d ? 0 : math.pi / 2), body);
		ctx.ridgeRects.push({ x, z, hx: w / 2, hz: d / 2, yaw });
		zone(ctx, "relief", x, z, w / 2 + 30, d / 2 + 30, yaw);
	}
}
/**
 * The horizon: uploaded mountain ridges on every land side, centred BACKDROP out with their fronts to the
 * play area and overlapping end to end. Every crest clears the altitude ceiling, so from anywhere a player
 * can fly nothing past the voxel edge shows (WorldAudit checks the rays). Sea sides get distant islands
 * instead and the sea skirt runs on into the haze.
 */
function backdrop(ctx: Ctx): void {
	const { rng, theme } = ctx;
	const cz = ctx.plan.coastZ;
	const asset: PropAsset = theme === "canyon" ? "RidgeDesert" : "RidgeAlpine";
	const half = UploadedAssetSpecs[asset].size.X / 2;
	if (theme !== "ocean") {
		for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
			// On the coast the sea side has no ridges and the side rings start at the shore (their sea end 350 inland).
			if (cz !== undefined && nz < 0) continue;
			const alongs: number[] = [];
			if (cz !== undefined && nx !== 0) for (let a = cz + 350 + half; a < BACKDROP + half; a += 1700) alongs.push(a);
			else for (let k = -4; k <= 4; k++) alongs.push(k * 1700);
			for (const a of alongs) {
				const along = a + rng.range(-80, 80), s = rng.range(1.0, 1.1), dist = BACKDROP + rng.range(0, 160);
				const x = nx !== 0 ? nx * dist : along, z = nz !== 0 ? nz * dist : along;
				prop(ctx, asset, x, GROUND, z, faceYaw(-nx, -nz) + rng.range(-0.04, 0.04), s, 0, "backdrop");
			}
		}
	}
	const islands = theme === "ocean" ? 7 : cz !== undefined ? 4 : 0;
	for (let i = 0; i < islands; i++) {
		let x: number, z: number;
		if (theme === "ocean") {
			const a = (i + rng.range(0.2, 0.8)) / islands * math.pi * 2, d = rng.range(8600, 12500);
			const square = math.max(math.abs(math.cos(a)), math.abs(math.sin(a)));
			x = math.cos(a) * d / square; z = math.sin(a) * d / square;
		} else {
			x = rng.range(-7000, 7000); z = rng.range(-13000, -8800);
		}
		prop(ctx, "RidgeAlpine", x, WATER_Y, z, rng.range(0, math.pi * 2), rng.range(0.28, 0.5), 0, "island");
	}
}

// --- landmarks --------------------------------------------------------------
function light(ctx: Ctx, x: number, y: number, z: number, color: Rgb): void {
	part(ctx, "Navigation light", "block", x, y, z, 3, 2, 3, 0, color, "Neon", false);
}
/** One uploaded piece of a modular run (runway, apron, road, fence, power line): centre, yaw and uniform scale. */
export interface Piece { asset: PropAsset; x: number; z: number; yaw: number; scale: number }
/**
 * A runway of two threshold ends and `middles` 270-stud segments laid end to end along local Z of `yaw`,
 * centred on (cx, cz): 1000 studs with the default two. Each end piece's front (its threshold) faces outward.
 */
export function runwayPieces(cx: number, cz: number, yaw = 0, middles = 2): Piece[] {
	const tip = UploadedAssetSpecs.RunwayThreshold.size.Z, mid = UploadedAssetSpecs.RunwaySegment.size.Z;
	const [ux, uz] = toWorld(0, 1, yaw);
	const out: Piece[] = [];
	let t = -(2 * tip + middles * mid) / 2;
	const at = (asset: PropAsset, length: number, turn: number) => {
		out.push({ asset, x: cx + ux * (t + length / 2), z: cz + uz * (t + length / 2), yaw: yaw + turn, scale: 1 });
		t += length;
	};
	at("RunwayThreshold", tip, 0);
	for (let k = 0; k < middles; k++) at("RunwaySegment", mid, 0);
	at("RunwayThreshold", tip, math.pi);
	return out;
}
/** Runway, apron, hangars and tower: the Varda airfield block. Runway along local Z. */
function airfield(ctx: Ctx, cx: number, cz: number): void {
	const top = GROUND + 1;
	for (const p of runwayPieces(cx, cz)) prop(ctx, p.asset, p.x, GROUND, p.z, p.yaw, p.scale);
	for (const tip of [-1, 1]) part(ctx, "Approach bar", "block", cx, top + 1.5, cz + tip * 560, 80, 1.5, 3, 0, [255, 240, 200], "Neon", false);
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
		for (const dz of [-120, 120]) prop(ctx, "ApronSlab", cx + side * 112, GROUND, hz + dz, 0, 1);
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
		if (!rectFree(ctx, corridor, 40, ["spawn", "road", "convoy", "highway"])) continue;
		return rx;
	}
	return undefined;
}
/** The uploaded river bridge's yaw: its length runs across the north-south river, along X. */
const BRIDGE_YAW = faceYaw(1, 0);
function river(ctx: Ctx, fx: number, fz: number): void {
	const rx = chooseRiverX(ctx, fx);
	if (rx === undefined) return;
	for (let z = -EXTENT; z < EXTENT - 0.5; z += TILE) {
		const length = math.min(TILE, EXTENT - z), mz = z + length / 2;
		// The bed block reaches the outer ring's single ground layer too, so the channel has walls all the way.
		op(ctx, "block", "Ground", rx, (28 + OUTER_BOTTOM) / 2, mz, 176, OUTER_BOTTOM - 28, length);
		op(ctx, "block", "Air", rx, (32 + GROUND + 8) / 2, mz, 160, GROUND + 8 - 32, length);
		op(ctx, "block", "Water", rx, (32 + RIVER_WATER) / 2, mz, 160, RIVER_WATER - 32, length);
		for (const side of [-1, 1]) op(ctx, "block", "Sand", rx + side * 94, GROUND - 2, mz, 28, 4, length);
	}
	zone(ctx, "river", rx, 0, 110, EXTENT);
	// The uploaded bridge carries the track across: ramps and abutments on the banks, piers in the river bed.
	prop(ctx, "RoadBridge", rx, GROUND, fz, BRIDGE_YAW, 1);
	zone(ctx, "bridge", rx, fz, 160, 30);
	// Other roads (and the highways) cross on the same bridge, square to the river.
	for (const road of [...ctx.roads, ...ctx.highways]) for (let i = 1; i < road.size(); i++) {
		const [ax, az] = road[i - 1], [bx, bz] = road[i];
		if ((ax - rx) * (bx - rx) >= 0) continue;
		const t = (rx - ax) / (bx - ax), z = az + (bz - az) * t;
		if (math.abs(z - fz) < 80 || math.abs(z) > EXTENT - 250) continue;
		prop(ctx, "RoadBridge", rx, GROUND, z, BRIDGE_YAW, 1);
		zone(ctx, "bridge", rx, z, 160, 30);
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
		else {
			const hut = dryFlat(ctx, spot[0] + 46, spot[2], 10, 1);
			if (hut !== undefined) prop(ctx, "EquipmentHut", spot[0] + 46, hut, spot[2], 0, 1);
		}
		placed += 1;
	}
	return placed;
}
function cityCentre(ctx: Ctx, fx: number, fz: number): void {
	op(ctx, "block", "Pavement", fx, GROUND - 2, fz, 520, 4, 300, 0);
	// The uploaded civic hall: its back on the plaza's far edge (fz - 260), its portico and steps facing the plaza.
	const hall = UploadedAssetSpecs.CivicHall;
	prop(ctx, "CivicHall", fx, GROUND, fz - 260 + hall.size.Z / 2, math.pi, 1);
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
/** Studs of water kept between a moored frigate's keel and the seabed (two voxel layers). */
export const KEEL_CLEARANCE = 8;
/**
 * A dredged berth under a frigate floating at `waterY`: water from its keel's clearance floor up to
 * the surface across the hull footprint plus a margin, on a 4-stud mud bed. The shallow sea floor
 * (SEABED) would otherwise meet the keel. Pure, so the legacy M2 harbour uses it too.
 */
export function frigateBerth(x: number, z: number, yaw: number, waterY: number, margin = 12): TerrainOp[] {
	const f = UploadedAssetSpecs.Frigate;
	const floor = waterY - f.groundOffset - KEEL_CLEARANCE;
	const sx = f.size.X + 2 * margin, sz = f.size.Z + 2 * margin;
	return [
		{ shape: "block", material: "Mud", x, y: floor - 2, z, sx, sy: 4, sz, yaw },
		{ shape: "block", material: "Water", x, y: (floor + waterY) / 2, z, sx, sy: waterY - floor, sz, yaw },
	];
}
function berth(ctx: Ctx, p: PropSpec): void {
	for (const o of frigateBerth(p.x, p.z, p.yaw, WATER_Y)) ctx.plan.ops.push(o);
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
		berth(ctx, prop(ctx, "Frigate", x, WATER_Y, z, math.pi / 2, 1, 0));
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
/** The uploaded store deck (legs on the seabed, deck top at DECK_TOP) and its gangways to the platform hub. */
function storeDeck(ctx: Ctx, index: number, x: number, z: number, hub: number[] | undefined): void {
	prop(ctx, "StoreDeck", x, WATER_Y, z, 0, 1);
	if (hub) {
		const dx = hub[0] - x, dz = hub[1] - z, len = math.sqrt(dx * dx + dz * dz);
		const gap = len - 75 - 140;
		if (gap > 10) {
			const ux = dx / len, uz = dz / len;
			for (const p of tilePieces("Gangway", x + ux * 75, z + uz * 75, x + ux * (75 + gap), z + uz * (75 + gap), 1)) prop(ctx, p.asset, p.x, DECK_TOP, p.z, p.yaw, p.scale);
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
			berth(ctx, prop(ctx, "Frigate", x, WATER_Y, z, shipYaw, 1, 0, protectedHull ? "ProtectedHull" : undefined));
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
			for (let r = 0; r <= rows; r++) roadLine(ctx, [[x0, z0 + r * spZ], [x1, z0 + r * spZ]], "street", false, 0);
			for (let c = 0; c <= cols; c++) roadLine(ctx, [[x0 + c * spX, z0], [x0 + c * spX, z1]], "street", false, 0.3);
		}
	}
}
/**
 * Uploaded pieces laid end to end from A to B: `asset` is a tileable piece whose length runs along its local Z,
 * scaled uniformly so a whole number of pieces fills the run exactly (no overlap, so no z-fighting), at a
 * scale within 25% of `target`. Runs too short for one piece at 75% of the target scale stay empty.
 */
export function tilePieces(asset: PropAsset, ax: number, az: number, bx: number, bz: number, target: number): Piece[] {
	const length = UploadedAssetSpecs[asset].size.Z;
	const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
	if (len < length * target * 0.75) return [];
	const n = math.max(1, math.floor(len / (length * target) + 0.5)), s = len / (n * length);
	const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = faceYaw(ux, uz);
	const out: Piece[] = [];
	for (let k = 0; k < n; k++) out.push({ asset, x: ax + ux * len * (k + 0.5) / n, z: az + uz * len * (k + 0.5) / n, yaw, scale: s });
	return out;
}
type RoadKind = "road" | "street" | "track";
const ROAD_ASSET: Record<RoadKind, PropAsset> = { road: "RoadSegment", street: "RoadSegment", track: "DirtTrack" };
const ROAD_SCALE: Record<RoadKind, number> = { road: 1, street: 0.88, track: 1 };
/**
 * A road polyline of uploaded segments at ground level, cut where it would leave dry flat land or cross a
 * boat path (and, for `avoid`, a reserved zone). Each call lifts its pieces a little above the last, so
 * crossing roads lie one over the other instead of sharing a plane.
 */
function roadLine(ctx: Ctx, points: number[][], kind: RoadKind, avoid = false, fixedLift?: number): void {
	const asset = ROAD_ASSET[kind], spec = UploadedAssetSpecs[asset];
	const width = spec.size.X * ROAD_SCALE[kind] * 1.25;
	// City streets: rows at 0, columns at 0.3; every other road a further 0.2 up per call (at most 1.1).
	const lift = fixedLift ?? 0.5 + (ctx.roadCalls % 4) * 0.2;
	ctx.roadCalls += 1;
	for (let i = 1; i < points.size(); i++) {
		const [ax, az] = points[i - 1], [bx, bz] = points[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
		const n = math.max(1, math.ceil(len / 20));
		let runStart: number | undefined;
		const flush = (endK: number) => {
			if (runStart === undefined) return;
			const t0 = runStart / n, t1 = endK / n;
			for (const p of tilePieces(asset, ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, ROAD_SCALE[kind])) {
				prop(ctx, p.asset, p.x, GROUND + lift, p.z, p.yaw, p.scale);
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
			if (ok && avoid && !free(ctx, x, z, width / 2 + 4, ["highway", "road", "spawn", "hill", "river", "bridge"])) ok = false;
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
	for (const road of ctx.roads) roadLine(ctx, road, ctx.theme === "canyon" ? "track" : "road");
	for (const path of ctx.plan.groundPaths) roadLine(ctx, path, "track");
	for (const road of ctx.highways) roadLine(ctx, road, ctx.theme === "canyon" ? "track" : "road", true);
}
/**
 * Roads from the authored road's two ends out towards the map edge through the explorable ring, turned
 * up to 30 degrees off the radial line until clear of targets, actors, boat paths, settlements and the
 * layout's relief. Reserved before anything else is built, so later placements keep off them.
 */
function highways(ctx: Ctx): void {
	const road = ctx.layout.road, cz = ctx.plan.coastZ;
	if (ctx.theme === "ocean" || road.size() < 2) return;
	for (const head of [road[0], road[road.size() - 1]]) {
		const r = math.sqrt(head[0] * head[0] + head[1] * head[1]);
		const base = r > 1 ? math.atan2(head[1], head[0]) : math.pi / 2;
		for (const turn of [0, 0.26, -0.26, 0.52, -0.52]) {
			const a = base + turn, dx = math.cos(a), dz = math.sin(a);
			const reach = (EXTENT - 150 - ring(head[0], head[1])) / math.max(math.abs(dx), math.abs(dz));
			if (reach < 1500) continue;
			const far = [head[0] + dx * reach, head[1] + dz * reach];
			let ok = true;
			for (let d = 160; d <= reach && ok; d += 60) {
				const x = head[0] + dx * d, z = head[1] + dz * d;
				if (cz !== undefined && z < cz + 160) ok = false;
				else if (!free(ctx, x, z, 40, ["road", "highway"])) ok = false;
				else if (ctx.ridgeRects.some((rr) => rectPointDist(rr, x, z) < 70)) ok = false;
			}
			if (!ok) continue;
			const pts = [head, far];
			ctx.highways.push(pts);
			ctx.corridors.push({ points: pts, half: 34, tag: "highway" });
			break;
		}
	}
}
/** Uploaded fence spans along a line, cut where the ground is not flat and dry or something is in the way. */
function fenceLine(ctx: Ctx, ax: number, az: number, bx: number, bz: number, ignore: string[]): number {
	const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
	const n = math.max(1, math.ceil(len / 15));
	let placed = 0, runStart: number | undefined;
	const flush = (endK: number) => {
		if (runStart === undefined) return;
		for (const p of tilePieces("FenceSpan", ax + (bx - ax) * runStart / n, az + (bz - az) * runStart / n, ax + (bx - ax) * endK / n, az + (bz - az) * endK / n, 1)) {
			prop(ctx, p.asset, p.x, GROUND, p.z, p.yaw, p.scale);
			placed += 1;
		}
		runStart = undefined;
	};
	for (let k = 0; k <= n; k++) {
		const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
		const t = groundAt(ctx, x, z);
		const ok = t.water === undefined && math.abs(t.solid - GROUND) < 0.5 && free(ctx, x, z, 6, ignore) && inMap(x, z, EXTENT - 300);
		if (ok && runStart === undefined) runStart = k;
		if (!ok) flush(k - 1);
	}
	flush(n);
	return placed;
}
/** Fences along the front and back of each farm settlement (farm and plateau maps). */
function fences(ctx: Ctx, blocks: number[][]): void {
	let total = 0;
	for (const [x0, z0, x1, z1] of blocks) {
		if (total > 48) break;
		for (const z of [z0, z1]) total += fenceLine(ctx, x0, z, x1, z, ["settlement", "spawn", "hill", "orchard"]);
	}
}
/** Lattice power lines beside the highways: spans of the uploaded pylon and its conductors, built outer end inward. */
function powerLines(ctx: Ctx): void {
	if (ctx.theme === "canyon" || ctx.theme === "ocean") return;
	const spec = UploadedAssetSpecs.PowerLineSpan, span = 300;
	for (const [start, finish] of ctx.highways) {
		const len = math.sqrt((finish[0] - start[0]) * (finish[0] - start[0]) + (finish[1] - start[1]) * (finish[1] - start[1]));
		const ux = (start[0] - finish[0]) / len, uz = (start[1] - finish[1]) / len;
		const ox = -uz * 48, oz = ux * 48;
		// From the edge inward: pylon k stands span*k in from the outer end; its conductors run back to pylon k-1.
		for (let k = 1; k * span < len - 400; k++) {
			const px = finish[0] + ox + ux * span * k, pz = finish[1] + oz + uz * span * k;
			if (ring(px, pz) < CORE - 200) break;
			const y = dryFlat(ctx, px, pz, 7, 1.5);
			if (y === undefined || y + spec.size.Y > limit(ctx, px, pz, span / 2) || !free(ctx, px, pz, 12, ["highway", "road"])) break;
			const back = spec.size.Z / 2 - span;
			prop(ctx, "PowerLineSpan", px + ux * back, y, pz + uz * back, faceYaw(ux, uz), 1);
		}
	}
}
/** Small farmsteads (or a hamlet on the coast) beside the highways in the explorable ring, fenced on farm maps. */
function outerSettlements(ctx: Ctx): void {
	const { rng, theme } = ctx;
	const coast = theme === "coast";
	const choices: PropAsset[][] = coast ? [["ApartmentBlock"], ["OfficeMidrise"], ["ApartmentBlock"], ["Farmhouse"]] : theme === "farm" ? [["Farmhouse"], ["Barn"], ["GrainSilo"], ["Farmhouse"]] : [["Farmhouse"], ["Barn"]];
	const fenceBlocks: number[][] = [];
	for (const [start, finish] of ctx.highways) {
		const len = math.sqrt((finish[0] - start[0]) * (finish[0] - start[0]) + (finish[1] - start[1]) * (finish[1] - start[1]));
		const ux = (finish[0] - start[0]) / len, uz = (finish[1] - start[1]) / len;
		for (const along of [0.55, 0.8]) {
			const side = rng.next() < 0.5 ? -1 : 1;
			const cx = start[0] + ux * len * along - uz * side * 170, cz = start[1] + uz * len * along + ux * side * 170;
			if (ring(cx, cz) < CORE + 200 || ring(cx, cz) > FlightMath.SoftBoundary - 200) continue;
			let placed = 0;
			for (let k = 0; k < choices.size(); k++) {
				const asset = choices[k][0], size = UploadedAssetSpecs[asset].size;
				const x = cx + ux * (k % 2) * 90 - uz * side * math.floor(k / 2) * 90, z = cz + uz * (k % 2) * 90 + ux * side * math.floor(k / 2) * 90;
				const yaw = faceYaw(uz * side, -ux * side) + rng.range(-0.05, 0.05);
				const rect: Rect = { x, z, hx: size.X / 2, hz: size.Z / 2, yaw };
				if (!rectFree(ctx, rect, 14, [])) continue;
				let ok = true;
				for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
					const [ox, oz] = toWorld(sx * rect.hx, sz * rect.hz, yaw);
					const t = groundAt(ctx, x + ox, z + oz);
					if (t.water !== undefined || math.abs(t.solid - GROUND) > 0.5) ok = false;
				}
				if (!ok || GROUND + size.Y > limit(ctx, x, z, math.max(size.X, size.Z) / 2)) continue;
				prop(ctx, asset, x, GROUND, z, yaw, 1, rng.int(0, 2));
				zone(ctx, "building", x, z, rect.hx, rect.hz, yaw);
				placed += 1;
			}
			if (placed > 0 && theme === "farm") {
				const x0 = math.min(cx, cx + ux * 90 - uz * side * 90) - 70, x1 = math.max(cx, cx + ux * 90 - uz * side * 90) + 70;
				const z0 = math.min(cz, cz + uz * 90 + ux * side * 90) - 70, z1 = math.max(cz, cz + uz * 90 + ux * side * 90) + 70;
				fenceBlocks.push([x0, z0, x1, z1]);
			}
		}
	}
	if (fenceBlocks.size() > 0) fences(ctx, fenceBlocks);
}
/** Where a tier scatters: the core square, or the explorable ring out to just inside the soft boundary. */
type Tier = "core" | "outer";
function inTier(tier: Tier, x: number, z: number): boolean {
	return tier === "core" ? inMap(x, z, 2700) : ring(x, z) >= CORE - 300 && ring(x, z) <= FlightMath.SoftBoundary - 150;
}
function tierPoint(ctx: Ctx, tier: Tier): [number, number] {
	return tier === "core" ? [ctx.rng.range(-2600, 2600), ctx.rng.range(-2600, 2600)] : ringPoint(ctx.rng, CORE, FlightMath.SoftBoundary - 250);
}
function scatterTrees(ctx: Ctx, total: number, pineShare: number, tier: Tier = "core"): void {
	const { rng } = ctx;
	const spots: number[][] = [];
	for (const p of ctx.plan.props) if (p.asset === "Pine" || p.asset === "Broadleaf") spots.push([p.x, p.z]);
	let count = 0;
	const tryTree = (x: number, z: number): boolean => {
		if (count >= total || !inTier(tier, x, z) || !free(ctx, x, z, 16, TREE_IGNORE)) return false;
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
	// Woods: clusters of 6-14 trees (larger, sparser woods in the explorable ring).
	for (let attempt = 0; attempt < 300 && count < total * 0.75; attempt++) {
		const [cx, cz] = tierPoint(ctx, tier);
		if (!free(ctx, cx, cz, 50, TREE_IGNORE)) continue;
		const n = rng.int(6, 14), radius = tier === "core" ? rng.range(50, 130) : rng.range(110, 220);
		for (let j = 0; j < n * 3; j++) {
			const a = rng.range(0, math.pi * 2), d = radius * math.sqrt(rng.next());
			tryTree(cx + math.cos(a) * d, cz + math.sin(a) * d);
		}
	}
	// Roadside rows, then singles.
	for (const road of tier === "core" ? ctx.roads : ctx.highways) for (let i = 1; i < road.size(); i++) {
		const [ax, az] = road[i - 1], [bx, bz] = road[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
		for (let t = 60; t < len; t += 110) for (const side of [-1, 1]) tryTree(ax + (bx - ax) * t / len - (bz - az) / len * side * 44, az + (bz - az) * t / len + (bx - ax) / len * side * 44);
	}
	for (let attempt = 0; attempt < 400 && count < total; attempt++) {
		const [x, z] = tierPoint(ctx, tier);
		tryTree(x, z);
	}
}
function scatterRocks(ctx: Ctx, total: number, tier: Tier = "core"): void {
	const { rng } = ctx;
	const variants: PropAsset[] = ["RockA", "RockB", "RockC"];
	let count = 0;
	const tryRock = (x: number, z: number, big: number) => {
		if (count >= total || !inTier(tier, x, z) || !free(ctx, x, z, 12, ["spawn", "hill", "settlement"])) return;
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
	for (let attempt = 0; attempt < total * 8 && count < total; attempt++) {
		const [x, z] = tierPoint(ctx, tier);
		tryRock(x, z, tier === "core" ? 2.4 : 3.2);
	}
}
/** Physical edge of a skirt part (the engine's part-size limit is 2048); the rest of its size is mesh stretch. */
const SKIRT_PART = 2000;
/**
 * Far skirts: four stretched parts (split at the coast line) carry the ground or sea from the voxel edge out to
 * FAR, where the haze has long since swallowed them. Decoration only: nothing flies past the hard boundary.
 */
function skirts(ctx: Ctx, waterColor: Rgb): void {
	const groundColor: Rgb = ctx.theme === "canyon" ? [166, 122, 84] : ctx.theme === "plateau" ? [104, 118, 82] : [96, 128, 70];
	const cz = ctx.plan.coastZ;
	const seaColor: Rgb = [math.floor(waterColor[0] * 0.85), math.floor(waterColor[1] * 0.85), math.floor(waterColor[2] * 0.85)];
	for (const [x0, x1, z0, z1] of [[-FAR, FAR, -FAR, -EXTENT], [-FAR, FAR, EXTENT, FAR], [-FAR, -EXTENT, -EXTENT, EXTENT], [EXTENT, FAR, -EXTENT, EXTENT]]) {
		const cuts: number[][] = cz !== undefined && z0 < cz && z1 > cz ? [[z0, cz], [cz, z1]] : [[z0, z1]];
		for (const [a, b] of cuts) {
			const wet = ctx.theme === "ocean" || (cz !== undefined && b <= cz);
			const w = x1 - x0, d = b - a, px = math.min(w, SKIRT_PART), pz = math.min(d, SKIRT_PART);
			const stretch: [number, number, number] = [w / px, 1, d / pz];
			if (wet) part(ctx, "Sea", "block", (x0 + x1) / 2, WATER_Y - 2, (a + b) / 2, px, 4, pz, 0, seaColor, "SmoothPlastic", false, false, { reflectance: 0.12, stretch });
			else part(ctx, "Far ground", "block", (x0 + x1) / 2, GROUND - 4, (a + b) / 2, px, 8, pz, 0, groundColor, ctx.theme === "canyon" ? "Sand" : "Grass", false, false, { stretch });
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
	const ctx: Ctx = { id, bp, layout, theme, rng: new Rng(id * 7919 + 17), plan, zones: [], corridors: [], ridgeRects: [], moles: [], roads: [], highways: [], canalOps: [], cliffs: 0, roadCalls: 0 };
	reserve(ctx);
	const [fx, fz] = layout.focus;
	const farmBlocks: number[][] = [];
	for (const s of layout.settlements) {
		const spX = theme === "coast" ? 230 : theme === "farm" ? 170 : 150, spZ = theme === "coast" ? 190 : theme === "farm" ? 170 : 140;
		zone(ctx, "settlement", s[0] + (s[2] - 1) * spX / 2, s[1] + (s[3] - 1) * spZ / 2, s[2] * spX / 2 + 20, s[3] * spZ / 2 + 20);
		farmBlocks.push([s[0] - spX / 2 - 30, s[1] - spZ / 2 - 30, s[0] + (s[2] - 0.5) * spX + 30, s[1] + (s[3] - 0.5) * spZ + 30]);
	}
	highways(ctx);
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
	outerRelief(ctx);
	backdrop(ctx);
	settlements(ctx);
	outerSettlements(ctx);
	if (theme === "coast") beaches(ctx, plan.coastZ!);
	if (theme === "coast") reopenCanals(ctx);
	roads(ctx);
	powerLines(ctx);
	if (theme === "farm" || theme === "plateau") fences(ctx, farmBlocks);
	const treeTotal = theme === "farm" ? 140 : theme === "coast" ? 90 : theme === "plateau" ? 80 : theme === "canyon" ? 36 : 0;
	const orchardTrees = plan.props.filter((p) => p.asset === "Broadleaf").size();
	const pineShare = theme === "farm" ? 0.3 : theme === "coast" ? 0.4 : theme === "plateau" ? 0.85 : 0.6;
	scatterTrees(ctx, math.max(treeTotal - orchardTrees, theme === "farm" ? 40 : 0), pineShare);
	scatterRocks(ctx, theme === "canyon" ? 44 : theme === "plateau" ? 36 : theme === "farm" ? 22 : theme === "coast" ? 14 : 0);
	// The explorable ring: about a third of the core's trees and rocks over five times the area.
	scatterTrees(ctx, theme === "farm" ? 60 : theme === "coast" ? 40 : theme === "plateau" ? 40 : theme === "canyon" ? 16 : 0, pineShare, "outer");
	scatterRocks(ctx, theme === "canyon" ? 24 : theme === "plateau" ? 18 : theme === "farm" ? 8 : theme === "coast" ? 6 : 0, "outer");
	skirts(ctx, env.water.color);
	return plan;
}

export interface WorldCounts {
	terrainOps: number; voxelWrites: number; bumpCells: number; parts: number; props: number; uniqueMeshes: number;
	trees: number; rocks: number; buildings: number; ships: number; instances: number;
	/** Props in the core, in the explorable ring (backdrop excluded) and in the backdrop ring and islands. */
	coreProps: number; outerProps: number; backdrop: number;
	/** Modular runway, apron, road, track, bridge, hardstand, deck, gangway, fence and power-line pieces. */
	infrastructure: number;
	/**
	 * Rough server build time in seconds, from assumed engine rates (calibrate against WorldBuildSeconds):
	 * Fill* at 25M voxels/s, the hills' Luau voxel loop at 2M cells/s, 0.05 ms a part, 0.2 ms a prop clone.
	 * Excludes the template preload, which runs in parallel and is cached after the first sortie.
	 */
	estimatedSeconds: number;
}
const BUILDINGS = new Set<PropAsset>(["Hangar", "ControlTower", "OfficeMidrise", "ApartmentBlock", "CityTower", "Farmhouse", "Barn", "GrainSilo", "ContainerStack", "HarbourQuay", "GantryCrane", "RadarDish", "RelayMast", "OilPlatform", "EquipmentHut", "CivicHall"]);
export const INFRASTRUCTURE = new Set<PropAsset>(["RunwaySegment", "RunwayThreshold", "ApronSlab", "RoadSegment", "DirtTrack", "RoadBridge", "TargetPad", "StoreDeck", "Gangway", "FenceSpan", "PowerLineSpan"]);
export const BACKDROP_ASSETS = new Set<PropAsset>(["RidgeAlpine", "RidgeDesert"]);
export function countPlan(plan: WorldPlan): WorldCounts {
	let voxels = 0, cells = 0;
	for (const o of plan.ops) {
		// Bumps count every cell of the grid region the executor reads and writes (TerrainSchedule.bumpRegion).
		if (o.shape === "bump") cells += regionCells(bumpRegion(o));
		else voxels += fillVoxels(o);
	}
	const unique = new Set<string>();
	let trees = 0, rocks = 0, buildings = 0, ships = 0, coreProps = 0, outerProps = 0, backdropProps = 0, infrastructure = 0;
	for (const p of plan.props) {
		unique.add(p.asset);
		if (p.asset === "Pine" || p.asset === "Broadleaf") trees += 1;
		else if (p.asset === "RockA" || p.asset === "RockB" || p.asset === "RockC") rocks += 1;
		else if (p.asset === "Frigate") ships += 1;
		else if (BUILDINGS.has(p.asset)) buildings += 1;
		if (INFRASTRUCTURE.has(p.asset)) infrastructure += 1;
		if (BACKDROP_ASSETS.has(p.asset)) backdropProps += 1;
		else if (ring(p.x, p.z) <= CORE) coreProps += 1;
		else outerProps += 1;
	}
	const estimatedSeconds = voxels / 25e6 + cells / 2e6 + plan.parts.size() * 0.00005 + plan.props.size() * 0.0002;
	return {
		terrainOps: plan.ops.size(), voxelWrites: math.floor(voxels + cells), bumpCells: cells, parts: plan.parts.size(), props: plan.props.size(), uniqueMeshes: unique.size(),
		// Each placed mesh is a MeshPart plus its SurfaceAppearance (the power line is two MeshParts).
		trees, rocks, buildings, ships, instances: plan.parts.size() + plan.props.size() * 2 + plan.props.filter((p) => p.asset === "PowerLineSpan").size() * 2,
		coreProps, outerProps, backdrop: backdropProps, infrastructure, estimatedSeconds,
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
