import { frigateBerth, type TerrainOp } from "./WorldPlan";

// The numbers of the hand-composed mission 1 and 2 seas (server/MissionWorld,
// server/Scenery) as plain data, so the offline specs can check hulls against
// the same seabed the server writes. Missions 3-27 use WorldPlan's sea instead.

const OCEAN_Y = -18;
/** Sea surface of the M1/M2 worlds. */
export const LEGACY_WATERLINE = OCEAN_Y + 2;
/** Top of the M1/M2 mud seabed (the opaque sea hides everything below it). */
export const LEGACY_FLOOR = OCEAN_Y - 6;
/** Height of the ground every M1/M2 island and mainland block reaches. */
export const LEGACY_GROUND = 44;
/** Scenery.Boat's hull: its height and its centre's lift above the waterline. */
export const BOAT_HULL = { height: 7, lift: 1.5 };

/** Terrain water from the floor to the waterline over the square, on a 4-stud mud bed. */
export function legacySeaOps(extent = 4000): TerrainOp[] {
	return [
		{ shape: "block", material: "Water", x: 0, y: (LEGACY_FLOOR + LEGACY_WATERLINE) / 2, z: 0, sx: 2 * extent, sy: LEGACY_WATERLINE - LEGACY_FLOOR, sz: 2 * extent, yaw: 0 },
		{ shape: "block", material: "Mud", x: 0, y: LEGACY_FLOOR - 2, z: 0, sx: 2 * extent, sy: 4, sz: 2 * extent, yaw: 0 },
	];
}

/** M2 Iron Coast mainland rock blocks [x, z, width, depth]: a 500-wide basin opens between x=-250 and 250. */
export const IRON_COAST_MAINLAND: Array<[number, number, number, number]> = [[-1000, -1500, 1500, 1600], [1000, -1500, 1500, 1600], [0, -1650, 520, 1300]];
/** The mainland as ops: rock from the sea floor to the ground, under a grass top inset by 30 studs. */
export function ironCoastMainlandOps(): TerrainOp[] {
	const ops: TerrainOp[] = [];
	const depth = LEGACY_GROUND - LEGACY_FLOOR;
	for (const [x, z, w, d] of IRON_COAST_MAINLAND) {
		ops.push({ shape: "block", material: "Rock", x, y: LEGACY_GROUND - depth / 2, z, sx: w, sy: depth, sz: d, yaw: 0 });
		ops.push({ shape: "block", material: "Grass", x, y: LEGACY_GROUND - 5, z, sx: w - 60, sy: 10, sz: d - 60, yaw: 0 });
	}
	return ops;
}
/** The M2 frigate alongside the east quay: waterline placement, bow west. */
export const IRON_COAST_FRIGATE = { x: 950, z: -652, yaw: math.pi / 2 };
/** Its dredged berth: the 4-stud legacy seabed would otherwise cut through the hull. */
export function ironCoastBerthOps(): TerrainOp[] {
	return frigateBerth(IRON_COAST_FRIGATE.x, IRON_COAST_FRIGATE.z, IRON_COAST_FRIGATE.yaw, LEGACY_WATERLINE);
}
/** Moored boats [x, z, yaw, length] in the basin, along the quays and one at anchor outside. */
export const IRON_COAST_BOATS: Array<[number, number, number, number]> = [[-150, -800, 0.1, 60], [120, -880, -0.2, 48], [-700, -640, math.pi / 2, 90], [-1300, -640, math.pi / 2, 70], [600, -150, 0.6, 80]];
/** The primitive hull that stands in for the frigate when its upload is missing. */
export const IRON_COAST_FALLBACK_HULL: [number, number, number, number] = [900, -650, math.pi / 2 + 0.1, 110];
