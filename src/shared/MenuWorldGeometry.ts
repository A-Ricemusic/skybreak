// Pure geometry definitions for menu-world buildings that stay visible under
// the menu camera. The menu camera applies a continuous sine-wave sway (see
// `GameUI.setMenuCamera`). Overlaps that leave coplanar, same-facing surfaces
// can flicker as the depth test alternates between them. These specs are the single source
// of truth for the hangar and control tower, and the Jest `MenuWorldGeometry`
// test verifies that no pair of parts in a model co-penetrates.

export interface MenuPartSpec {
	readonly name: string;
	readonly size: Vector3;
	/** Local-space translation from the model pivot (no rotation). */
	readonly offset: Vector3;
}

/**
 * Returns true when two axis-aligned parts share an interior volume. Faces
 * that merely touch (butt-joint) are not reported, because touching opposite-
 * facing surfaces back-face-cull cleanly instead of z-fighting.
 */
export function partsPenetrate(a: MenuPartSpec, b: MenuPartSpec, epsilon = 1e-3): boolean {
	const overlaps = (ac: number, as: number, bc: number, bs: number): boolean =>
		math.abs(ac - bc) + epsilon < (as + bs) / 2;
	return (
		overlaps(a.offset.X, a.size.X, b.offset.X, b.size.X) &&
		overlaps(a.offset.Y, a.size.Y, b.offset.Y, b.size.Y) &&
		overlaps(a.offset.Z, a.size.Z, b.offset.Z, b.size.Z)
	);
}

/** Enumerates every unordered pair of parts that co-penetrates. */
export function findPenetratingPairs(parts: ReadonlyArray<MenuPartSpec>): Array<[string, string]> {
	const conflicts: Array<[string, string]> = [];
	for (let i = 0; i < parts.size(); i++) {
		for (let j = i + 1; j < parts.size(); j++) {
			if (partsPenetrate(parts[i], parts[j])) conflicts.push([parts[i].name, parts[j].name]);
		}
	}
	return conflicts;
}

// --- Hangar ---------------------------------------------------------------
// A simple apron hangar: concrete floor, three solid walls, an orange door
// header, and a dark metal roof with a small eave. The side walls run the
// full depth; the back wall and door header fit cleanly between them so no
// part reaches into another. The roof sits exactly on the wall tops (opposite
// -facing coplanar surfaces, which back-face-cull cleanly).

const HANGAR_WIDTH = 72;
const HANGAR_DEPTH = 52;
const HANGAR_FLOOR_THICKNESS = 2;
const HANGAR_WALL_THICKNESS = 3;
const HANGAR_WALL_HEIGHT = 26;
const HANGAR_ROOF_THICKNESS = 3;
const HANGAR_DOOR_HEADER_HEIGHT = 5;
const HANGAR_ROOF_OVERHANG = 1.5;

const HANGAR_INNER_WIDTH = HANGAR_WIDTH - 2 * HANGAR_WALL_THICKNESS;
const HANGAR_WALL_CENTER_Y = HANGAR_FLOOR_THICKNESS / 2 + HANGAR_WALL_HEIGHT / 2;
const HANGAR_ROOF_CENTER_Y = HANGAR_FLOOR_THICKNESS / 2 + HANGAR_WALL_HEIGHT + HANGAR_ROOF_THICKNESS / 2;
const HANGAR_SIDE_WALL_X = (HANGAR_WIDTH - HANGAR_WALL_THICKNESS) / 2;
const HANGAR_BACK_WALL_Z = (HANGAR_DEPTH - HANGAR_WALL_THICKNESS) / 2;
const HANGAR_DOOR_HEADER_CENTER_Y =
	HANGAR_FLOOR_THICKNESS / 2 + HANGAR_WALL_HEIGHT - HANGAR_DOOR_HEADER_HEIGHT / 2;

export const HANGAR_PARTS: ReadonlyArray<MenuPartSpec> = [
	{
		name: "Floor",
		size: new Vector3(HANGAR_WIDTH, HANGAR_FLOOR_THICKNESS, HANGAR_DEPTH),
		offset: Vector3.zero,
	},
	{
		name: "LeftWall",
		size: new Vector3(HANGAR_WALL_THICKNESS, HANGAR_WALL_HEIGHT, HANGAR_DEPTH),
		offset: new Vector3(-HANGAR_SIDE_WALL_X, HANGAR_WALL_CENTER_Y, 0),
	},
	{
		name: "RightWall",
		size: new Vector3(HANGAR_WALL_THICKNESS, HANGAR_WALL_HEIGHT, HANGAR_DEPTH),
		offset: new Vector3(HANGAR_SIDE_WALL_X, HANGAR_WALL_CENTER_Y, 0),
	},
	{
		name: "Back",
		size: new Vector3(HANGAR_INNER_WIDTH, HANGAR_WALL_HEIGHT, HANGAR_WALL_THICKNESS),
		offset: new Vector3(0, HANGAR_WALL_CENTER_Y, HANGAR_BACK_WALL_Z),
	},
	{
		name: "DoorHeader",
		size: new Vector3(HANGAR_INNER_WIDTH, HANGAR_DOOR_HEADER_HEIGHT, HANGAR_WALL_THICKNESS),
		offset: new Vector3(0, HANGAR_DOOR_HEADER_CENTER_Y, -HANGAR_BACK_WALL_Z),
	},
	{
		name: "Roof",
		size: new Vector3(
			HANGAR_WIDTH + HANGAR_ROOF_OVERHANG * 2,
			HANGAR_ROOF_THICKNESS,
			HANGAR_DEPTH + HANGAR_ROOF_OVERHANG * 2,
		),
		offset: new Vector3(0, HANGAR_ROOF_CENTER_Y, 0),
	},
];

// --- Control tower --------------------------------------------------------
// A square concrete base, a glazed cab with a short overhang, a flat metal
// roof, a slim antenna, and a neon beacon ball. Every section sits on top of
// the one below it with clean butt-joint surfaces.

const TOWER_BASE_SIZE = new Vector3(30, 42, 30);
const TOWER_CAB_SIZE = new Vector3(45, 10, 45);
const TOWER_ROOF_SIZE = new Vector3(50, 3, 50);
const TOWER_ANTENNA_SIZE = new Vector3(2, 20, 2);
const TOWER_BEACON_SIZE = new Vector3(4, 4, 4);

const TOWER_BASE_CENTER_Y = TOWER_BASE_SIZE.Y / 2;
const TOWER_CAB_CENTER_Y = TOWER_BASE_SIZE.Y + TOWER_CAB_SIZE.Y / 2;
const TOWER_ROOF_CENTER_Y = TOWER_BASE_SIZE.Y + TOWER_CAB_SIZE.Y + TOWER_ROOF_SIZE.Y / 2;
const TOWER_ANTENNA_CENTER_Y =
	TOWER_BASE_SIZE.Y + TOWER_CAB_SIZE.Y + TOWER_ROOF_SIZE.Y + TOWER_ANTENNA_SIZE.Y / 2;
const TOWER_BEACON_CENTER_Y =
	TOWER_BASE_SIZE.Y + TOWER_CAB_SIZE.Y + TOWER_ROOF_SIZE.Y + TOWER_ANTENNA_SIZE.Y + TOWER_BEACON_SIZE.Y / 2;

export const CONTROL_TOWER_PARTS: ReadonlyArray<MenuPartSpec> = [
	{ name: "Base", size: TOWER_BASE_SIZE, offset: new Vector3(0, TOWER_BASE_CENTER_Y, 0) },
	{ name: "Cab", size: TOWER_CAB_SIZE, offset: new Vector3(0, TOWER_CAB_CENTER_Y, 0) },
	{ name: "Roof", size: TOWER_ROOF_SIZE, offset: new Vector3(0, TOWER_ROOF_CENTER_Y, 0) },
	{ name: "Antenna", size: TOWER_ANTENNA_SIZE, offset: new Vector3(0, TOWER_ANTENNA_CENTER_Y, 0) },
	{ name: "Beacon", size: TOWER_BEACON_SIZE, offset: new Vector3(0, TOWER_BEACON_CENTER_Y, 0) },
];
