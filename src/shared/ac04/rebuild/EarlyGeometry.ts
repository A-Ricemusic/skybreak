import type { Rgb } from "../../EnvironmentPresets";
import type { PartSpec, TerrainMaterial, TerrainOp, WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";

/**
 * Pure native-geometry helpers for the early-campaign (M1-M5) rebuild. No
 * Instances, uploaded assets or runtime imports of the shared planners (that
 * would create back-edges into AC04WorldData/AC04MissionData).
 *
 * Coordinates: north is -Z, east is +X. Mitoro overview diagrams
 * (https://mitoro.sakura.ne.jp/ac04/data/ac04_mNNd1.gif, 560 px, Ace
 * difficulty) map to studs with the project-wide x = (px - 280) * 13,
 * z = (py - 280) * 13. Close-ups use per-mission scales documented at each
 * use. Everything is an adaptation, not a survey.
 */
export const EARLY_LAND = 64;
export const EARLY_SEA = 32;
/** Mirrors TerrainSchedule.UNSPLIT_MAX: largest single unsplit wedge/ball region in voxels. */
export const EARLY_UNSPLIT_MAX = 4194304;
/** Per-mission authored budgets for this module (base AC04World reports parts against 1600). */
export const EARLY_PART_BUDGET = 260;
export const EARLY_OP_BUDGET = 420;
/** Prefix of every air-clearance sample this module owns (removed and re-added so the hook is idempotent). */
export const EARLY_AIR_PREFIX = "AC04 early ";

export const EV = (x: number, y: number, z: number): FlightPoint => ({ x, y, z });

/** Yaw that turns local +X along (dx, dz) (matches WorldPlan.axisYaw). */
export function earlyAxisYaw(dx: number, dz: number): number { return math.atan2(-dz, dx); }
/** Local offset -> world offset for CFrame.Angles(0, yaw, 0) (matches WorldPlan.toWorld). */
export function earlyToWorld(lx: number, lz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * lx + s * lz, -s * lx + c * lz];
}
/**
 * Voxel cells of the axis-aligned region the engine fills for a (possibly
 * yawed) op, padded by two voxels like the AC04World wedge contract.
 */
export function earlyRegionCells(op: TerrainOp): number {
	const c = math.abs(math.cos(op.yaw)), s = math.abs(math.sin(op.yaw));
	const ex = c * op.sx + s * op.sz, ez = s * op.sx + c * op.sz;
	return math.ceil((ex + 8) / 4) * math.ceil((op.sy + 8) / 4) * math.ceil((ez + 8) / 4);
}

export function ePart(plan: WorldPlan, name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Rgb, material = "Concrete", solid = true, shape: PartSpec["shape"] = "block", yaw = 0): void {
	plan.parts.push({ name, shape, x, y, z, sx, sy, sz, yaw, color, material, solid, grounded: false });
}
export function eBlock(plan: WorldPlan, material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): void {
	plan.ops.push({ shape: "block", material, x, y, z, sx, sy, sz, yaw });
}
/** A block spanning [bottom, top] vertically. */
export function eSlab(plan: WorldPlan, material: TerrainMaterial, x: number, z: number, sx: number, sz: number, bottom: number, top: number, yaw = 0): void {
	eBlock(plan, material, x, (bottom + top) / 2, z, sx, top - bottom, sz, yaw);
}
export function eCylinder(plan: WorldPlan, material: TerrainMaterial, x: number, z: number, radius: number, bottom: number, top: number): void {
	plan.ops.push({ shape: "cylinder", material, x, y: (bottom + top) / 2, z, sx: radius, sy: top - bottom, sz: radius, yaw: 0 });
}
/**
 * Paired native wedges forming a ridge whose apex line runs along local X
 * (length 2*rx), falling to `base` at +-rz across. Split along local X until
 * every wedge's yawed bounding region is under 90% of the unsplit voxel cap.
 */
export function eRidge(plan: WorldPlan, x: number, z: number, rx: number, rz: number, height: number, material: TerrainMaterial, base = EARLY_LAND, yaw = 0): void {
	let count = 1;
	const fits = (n: number) => earlyRegionCells({ shape: "wedge", material, x: 0, y: 0, z: 0, sx: rx * 2 / n, sy: height, sz: rz, yaw }) < EARLY_UNSPLIT_MAX * 0.9;
	while (!fits(count) && count < 64) count++;
	const width = rx * 2 / count;
	for (let i = 0; i < count; i++) {
		const lx = -rx + (i + 0.5) * width;
		for (const side of [-1, 1]) {
			const [wx, wz] = earlyToWorld(lx, side * rz / 2, yaw);
			plan.ops.push({ shape: "wedge", material, x: x + wx, y: base + height / 2, z: z + wz, sx: width, sy: height, sz: rz, yaw: yaw + (side > 0 ? math.pi : 0) });
		}
	}
}
/**
 * A ridge whose crest steps down toward both ends: `tiers` same-slope prisms,
 * tier j (1..tiers) of height h*j/tiers and half-width rz*j/tiers, its crest
 * length shrinking from 2*rx (lowest) to 2*rx/tiers (highest). End faces are
 * then at most h/tiers tall instead of one full-height cliff.
 */
export function eTaperedRidge(plan: WorldPlan, x: number, z: number, rx: number, rz: number, height: number, material: TerrainMaterial, base = EARLY_LAND, yaw = 0, tiers = 3): void {
	for (let j = 1; j <= tiers; j++) eRidge(plan, x, z, rx * (tiers - j + 1) / tiers, rz * j / tiers, height * j / tiers, material, base, yaw);
}
/**
 * A summit massif: two crossed tapered ridges (local X and Z apex lines, both
 * reaching `top`) with a congruent `cap` skin on the highest tier above
 * `capFrom`. Arms run along `yaw` and `yaw + pi/2`.
 */
export function eMassif(plan: WorldPlan, x: number, z: number, rx: number, rz: number, top: number, flank: TerrainMaterial, cap: TerrainMaterial, capFrom: number, base = EARLY_LAND, yaw = 0): void {
	const h = top - base, tiers = 3;
	eTaperedRidge(plan, x, z, rx, rz, h, flank, base, yaw, tiers);
	eTaperedRidge(plan, x, z, rz, rx, h, flank, base, yaw + math.pi / 2, tiers);
	if (capFrom < top && capFrom > base) {
		// Same slopes, raised base: the cap surface coincides with the top tier above capFrom.
		const k = (top - capFrom) / h;
		eRidge(plan, x, z, rx / tiers, rz * k, top - capFrom, cap, capFrom, yaw);
		eRidge(plan, x, z, rz / tiers, rx * k, top - capFrom, cap, capFrom, yaw + math.pi / 2);
	}
}
/** A flat non-solid ribbon (road, taxiway, marking) along a segment, split under the 2048-stud part limit. */
export function eRibbon(plan: WorldPlan, name: string, ax: number, az: number, bx: number, bz: number, width: number, y: number, color: Rgb, material = "Asphalt"): void {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz), pieces = math.max(1, math.ceil(len / 1800));
	for (let i = 0; i < pieces; i++) {
		const t = (i + 0.5) / pieces;
		ePart(plan, name, ax + dx * t, y, az + dz * t, len / pieces, 0.6, width, color, material, false, "block", earlyAxisYaw(dx, dz));
	}
}
/** A part placed in a local frame (origin ox,oz, yaw) given local offsets. */
export function eLocalPart(plan: WorldPlan, ox: number, oz: number, yaw: number, name: string, lx: number, y: number, lz: number, sx: number, sy: number, sz: number, color: Rgb, material = "Concrete", solid = true, shape: PartSpec["shape"] = "block"): void {
	const [wx, wz] = earlyToWorld(lx, lz, yaw);
	ePart(plan, name, ox + wx, y, oz + wz, sx, sy, sz, color, material, solid, shape, yaw);
}
/**
 * Resets a mission's authored geometry to its full-map base layers (the
 * leading 8000-stud ocean/land ops) so the rebuild replaces the old coarse
 * terrain and greybox parts. Idempotent when applied twice.
 */
export function earlyResetToBase(plan: WorldPlan): void {
	const kept: TerrainOp[] = [];
	for (const op of plan.ops) {
		if (op.sx >= 7900 && op.sz >= 7900) kept.push(op); else break;
	}
	plan.ops = kept;
	plan.parts = [];
	plan.props = [];
	plan.air = plan.air.filter((s) => s.label.sub(1, EARLY_AIR_PREFIX.size()) !== EARLY_AIR_PREFIX);
}
