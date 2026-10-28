import type { Rgb } from "../../EnvironmentPresets";
import type { PartSpec, TerrainMaterial, TerrainOp, WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";

/**
 * Pure geography and native-geometry helpers for the middle-campaign (M6-M12)
 * rebuild. No Instances, uploaded assets or runtime imports of the shared
 * planners (that would create back-edges into AC04WorldData/AC04MissionData).
 *
 * Reference rasters are derived from Mitoro's Ace-difficulty map diagrams
 * (https://mitoro.sakura.ne.jp/ac04/data/ac04_m06d1.gif and ac04_m07d1.gif).
 * They are used only for topology (coastline, ravine routing), never for
 * Normal unit counts. Pixel -> stud mapping is the project-wide adaptation
 * x = (px - 280) * 13, z = (py - 280) * 13 (north is -Z). Not a survey.
 */
export const MIDDLE_LAND = 64;
export const MIDDLE_SEA = 32;
/** Mirrors the runtime barrage rule: Stonehenge salvos damage aircraft above y=400. */
export const MIDDLE_BARRAGE_CEILING = 400;
/** Mirrors TerrainSchedule.UNSPLIT_MAX: largest single unsplit wedge/ball region in voxels. */
export const MIDDLE_UNSPLIT_MAX = 4194304;
/** Middle-campaign authored-part budget per mission (base AC04World reports against 1600). */
export const MIDDLE_PART_BUDGET = 260;
export const MIDDLE_OP_BUDGET = 700;

export const MV = (x: number, y: number, z: number): FlightPoint => ({ x, y, z });

/** Yaw that turns local +X along (dx, dz) (matches WorldPlan.axisYaw). */
export function middleAxisYaw(dx: number, dz: number): number { return math.atan2(-dz, dx); }
/** Local offset -> world offset for CFrame.Angles(0, yaw, 0) (matches WorldPlan.toWorld). */
export function middleToWorld(lx: number, lz: number, yaw: number): [number, number] {
	const c = math.cos(yaw), s = math.sin(yaw);
	return [c * lx + s * lz, -s * lx + c * lz];
}

// --- M06 Comberth coastline -------------------------------------------------
/** Cell size (studs) of the M06 land raster: 14 Mitoro pixels * 13 studs. */
export const M06_CELL = 182;
export const M06_ORIGIN = -3640;
/**
 * 40x40 land mask ('#') sampled from Mitoro's M06 diagram (>=50% land per cell).
 * Row 0 is the far north (z=-3640). Peninsula = Comberth; southern mainland
 * holds the fleet anchorage, which the world module opens as a channel
 * (the Ace diagram plots the fleet column over land-coloured pixels).
 */
export const M06_LAND: string[] = [
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"........................................",
	"......................#.................",
	"......................#.................",
	".....................##.................",
	".....................##.................",
	"....................###.................",
	"....................###.................",
	"...................#####................",
	"..................######................",
	"..................######................",
	".................#########..............",
	"...............###########.#............",
	"...............#########................",
	".............##########.................",
	"............###########.................",
	"...........############.................",
	"...........############.................",
	"............###########.................",
	"............##########..................",
	".............#########..................",
	"..............####.##...................",
	".............###########................",
	".#######################................",
	"#########################...............",
	"#########################...............",
	"##########################..............",
	"##########################..............",
	"##########################..............",
	"#########################...............",
	"#########################...............",
	"########################................",
];
export function m06MaskLand(x: number, z: number): boolean {
	const c = math.floor((x - M06_ORIGIN) / M06_CELL), r = math.floor((z - M06_ORIGIN) / M06_CELL);
	if (c < 0 || r < 0 || r >= M06_LAND.size() || c >= 40) return false;
	return M06_LAND[r].sub(c + 1, c + 1) === "#";
}

// --- M07 Faith Park ravines -------------------------------------------------
/** Plateau top. Above the barrage ceiling by 160 studs so only ravines are safe. */
export const M07_PLATEAU_TOP = 560;
/** One Mitoro ravine is ~14-16px wide; a 280-stud cell keeps it one cell and flyable. */
export const M07_CELL = 280;
export const M07_ORIGIN = -3640;
export const M07_N = 26;
/**
 * 26x26 ravine mask ('#', >=30% dark-ravine pixels per 21.5px cell) from
 * Mitoro's M07 diagram. Every ravine cell connects to the southern row
 * (checked when authored: 237/237 reachable). The plant sits on the plateau
 * at columns 10-13, rows 4-8; the doubled ravine at columns 11-12 from row 9
 * is the main southbound canyon.
 */
export const M07_RAVINE: string[] = [
	"#....###......###.#.###...",
	"#....#........#...#.##....",
	"#....#........#...#.#.....",
	"#....###......#...###.....",
	"#......#......#.....#.....",
	"#......#......###...###...",
	"#......#......#.#.....#...",
	"####...###....#.#.....#...",
	"..##...#.#....#.#.....####",
	"#..###.#.#.####.#........#",
	"#....#.#.#.##.#.###......#",
	"#....#.#.#.##.#.#.#......#",
	"#....###.#.##.#.#.#...####",
	"##.....#.#.##.#.#.#.###...",
	"####...#.#.##.###.#.##....",
	"..##...#.#.##.#.#.#.#.....",
	"...###.###.##.#.#.#.#.....",
	".....#...#.##.#.###.#.....",
	".....###.####.#.#.###.....",
	".......#.#.##.#.#..##.....",
	".......#.#.##.#.#...#.....",
	".......#.#.##.###.###.....",
	".......###.##.#...#.#.....",
	".......###.##.#...###.....",
	".......#.#.##.#...#.......",
	".......#.#.##.#...#.......",
];
export function m07Ravine(c: number, r: number): boolean {
	if (c < 0 || r < 0 || c >= M07_N || r >= M07_N) return false;
	return M07_RAVINE[r].sub(c + 1, c + 1) === "#";
}
export function m07CellCenter(c: number, r: number): [number, number] {
	return [M07_ORIGIN + (c + 0.5) * M07_CELL, M07_ORIGIN + (r + 0.5) * M07_CELL];
}
export function m07CellAt(x: number, z: number): [number, number] {
	return [math.floor((x - M07_ORIGIN) / M07_CELL), math.floor((z - M07_ORIGIN) / M07_CELL)];
}

// --- M09 Bunker Shot coastline ------------------------------------------------
/** Waterline z for a given x (sea to the south). Halle sits further south, per Mitoro M09. */
export const M09_COAST: number[][] = [[-3900, 1450], [-3000, 1420], [-2450, 1350], [-1800, 1150], [-1000, 700], [-300, 450], [250, 420], [900, 460], [1700, 420], [2400, 360], [2850, 330], [3900, 260]];
export function m09CoastZ(x: number): number {
	const pts = M09_COAST;
	if (x <= pts[0][0]) return pts[0][1];
	for (let i = 1; i < pts.size(); i++) if (x <= pts[i][0]) {
		const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
		return az + (bz - az) * (x - ax) / (bx - ax);
	}
	return pts[pts.size() - 1][1];
}
/** Beach centres in Mitoro order: left Halle, centre Crowne, right Caranda. */
export const M09_BEACH_X = { west: -2450, center: 250, east: 2850 };

// --- M12 Stonehenge ring --------------------------------------------------------
export const M12_CENTER_Z = -300;
export const M12_RADIUS = 650;
/** Barrel tip radius: AC04World places a 310-stud barrel centred 145 studs outward. */
export const M12_BARREL_TIP = 650 + 145 + 155;
/** Mitoro's close-up shows operational guns at N/NE/E/S/SW/W/NW; the SE position is the ruined eighth. */
export const M12_RUINED_ANGLE = math.pi / 4;
export const M12_GUN_ANGLES: number[] = [0, math.pi / 2, 3 * math.pi / 4, math.pi, 5 * math.pi / 4, 3 * math.pi / 2, 7 * math.pi / 4];

// --- authoring helpers --------------------------------------------------------
export function mPart(plan: WorldPlan, name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Rgb, material = "Concrete", solid = true, shape: PartSpec["shape"] = "block", yaw = 0): void {
	plan.parts.push({ name, shape, x, y, z, sx, sy, sz, yaw, color, material, solid, grounded: false });
}
export function mBlock(plan: WorldPlan, material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): void {
	plan.ops.push({ shape: "block", material, x, y, z, sx, sy, sz, yaw });
}
export function mCylinder(plan: WorldPlan, material: TerrainMaterial, x: number, y: number, z: number, radius: number, height: number): void {
	plan.ops.push({ shape: "cylinder", material, x, y, z, sx: radius, sy: height, sz: radius, yaw: 0 });
}
/**
 * Paired native wedges forming a ridge with an apex line along local X. Split
 * along local X so every wedge stays under the unsplit voxel cap.
 */
export function mRidge(plan: WorldPlan, x: number, z: number, rx: number, rz: number, height: number, material: TerrainMaterial, base = MIDDLE_LAND, yaw = 0): void {
	// Same safety factor as AC04WorldData.hill: roughly half the unsplit voxel cap.
	const maxWidth = math.max(8, math.min(320, math.floor(MIDDLE_UNSPLIT_MAX * 30 / math.max(1, (height + 8) * (rz + 8))) - 8));
	const count = math.ceil(rx * 2 / maxWidth), width = rx * 2 / count;
	for (let i = 0; i < count; i++) {
		const lx = -rx + (i + 0.5) * width;
		for (const side of [-1, 1]) {
			const [wx, wz] = middleToWorld(lx, side * rz / 2, yaw);
			plan.ops.push({ shape: "wedge", material, x: x + wx, y: base + height / 2, z: z + wz, sx: width, sy: height, sz: rz, yaw: yaw + (side > 0 ? math.pi : 0) });
		}
	}
}
/** Cuts a navigable water channel (Air above, water to sea level) along a segment. */
export function mChannel(plan: WorldPlan, ax: number, az: number, bx: number, bz: number, width: number): void {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz), yaw = middleAxisYaw(dx, dz);
	mBlock(plan, "Air", (ax + bx) / 2, 200, (az + bz) / 2, len + width, 400, width, yaw);
	mBlock(plan, "Water", (ax + bx) / 2, MIDDLE_SEA / 2, (az + bz) / 2, len + width, MIDDLE_SEA, width, yaw);
}
/** An inland river cut into a 16-stud base land slab (no ocean underneath). */
export function mRiver(plan: WorldPlan, ax: number, az: number, bx: number, bz: number, width: number): void {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz), yaw = middleAxisYaw(dx, dz);
	mBlock(plan, "Air", (ax + bx) / 2, MIDDLE_LAND + 8, (az + bz) / 2, len + width, 32, width, yaw);
	mBlock(plan, "Sand", (ax + bx) / 2, MIDDLE_LAND - 22, (az + bz) / 2, len + width + 16, 12, width + 16, yaw);
	mBlock(plan, "Water", (ax + bx) / 2, MIDDLE_LAND - 11, (az + bz) / 2, len + width, 10, width, yaw);
}
/** A flat non-solid ribbon (road, taxiway, wake) laid along a segment, split to stay under the 2048-stud part limit. */
export function mRibbon(plan: WorldPlan, name: string, ax: number, az: number, bx: number, bz: number, width: number, y: number, color: Rgb, material = "Asphalt"): void {
	const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz), pieces = math.max(1, math.ceil(len / 1800));
	for (let i = 0; i < pieces; i++) {
		const t = (i + 0.5) / pieces;
		mPart(plan, name, ax + dx * t, y, az + dz * t, len / pieces, 0.6, width, color, material, false, "block", middleAxisYaw(dx, dz));
	}
}
/**
 * Resets a mission's authored geometry to its full-map base layers (the
 * leading 8000-stud ocean/land ops) so the rebuild deliberately replaces the
 * old coarse terrain and greybox props. Idempotent when applied twice.
 */
export function middleResetToBase(plan: WorldPlan): void {
	const kept: TerrainOp[] = [];
	for (const op of plan.ops) {
		if (op.sx >= 7900 && op.sz >= 7900) kept.push(op); else break;
	}
	plan.ops = kept;
	plan.parts = [];
	plan.props = [];
}
