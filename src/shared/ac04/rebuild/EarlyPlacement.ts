import type { AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { FlightPoint } from "../../WorldTypes";
import { EARLY_LAND, EV } from "./EarlyGeometry";

/**
 * Source-derived early-campaign (M1-M5) coordinates and authored ground-unit
 * placement. Only M2 and M3 ground units are re-placed (plus a terrain-clearance
 * lift for M3 air spawns on Mt. Shezna); M1, M4 and M5 placement is untouched,
 * and M5 in particular keeps the exact production placement its validated
 * timing depends on.
 */
const LAND = EARLY_LAND;

// --- M02 Rigley Air Base -----------------------------------------------------------
/**
 * Mitoro M02 overview (ac04_m02d1.gif): airfield cluster centred near px (248,190)
 * and the substation (red dot) at px (283,377) on the southern approach, at the
 * project 13 studs/px. The close-up (ac04_m02d2.gif) shows eleven TU-95 rings in
 * four dispersal clusters; cluster centres are scaled at 4.5 studs/px about the
 * airfield centre and members at 7.5 studs/px so 2.1x-scale bomber models keep
 * a >=135-stud spacing. The close-up is assumed centred on the airfield.
 */
export const M02_AIRFIELD = EV(-416, LAND, -1170);
export const M02_SUBSTATION = EV(39, LAND, 1261);
const M02_CLUSTER_SCALE = 4.5, M02_MEMBER_SCALE = 7.5;
/** Close-up pixel positions of the TU-95 rings, grouped by cluster (NW, centre-left, right row, north). */
export const M02_BOMBER_PX: number[][][] = [
	[[85, 220], [85, 238], [103, 229]],
	[[215, 333], [228, 349], [246, 349]],
	[[333, 349], [351, 349], [369, 349]],
	[[330, 160], [348, 160]],
];
function m02Closeup(px: number, py: number, cx: number, cy: number): FlightPoint {
	return EV(M02_AIRFIELD.x + (cx - 280) * M02_CLUSTER_SCALE + (px - cx) * M02_MEMBER_SCALE, LAND, M02_AIRFIELD.z + (cy - 280) * M02_CLUSTER_SCALE + (py - cy) * M02_MEMBER_SCALE);
}
export const M02_BOMBERS: FlightPoint[] = (() => {
	const out: FlightPoint[] = [];
	for (const cluster of M02_BOMBER_PX) {
		let cx = 0, cy = 0;
		for (const p of cluster) { cx += p[0] / cluster.size(); cy += p[1] / cluster.size(); }
		for (const p of cluster) out.push(m02Closeup(p[0], p[1], cx, cy));
	}
	return out;
})();
/** Cluster centres (for revetments and aprons). */
export const M02_CLUSTERS: FlightPoint[] = M02_BOMBER_PX.map((cluster) => {
	let cx = 0, cy = 0;
	for (const p of cluster) { cx += p[0] / cluster.size(); cy += p[1] / cluster.size(); }
	return m02Closeup(cx, cy, cx, cy);
});
/**
 * North-south runway threaded between the centre-left and right-row clusters,
 * where the close-up shows two fighters before take-off (interpretation; the
 * diagram does not draw the runway).
 */
export const M02_RUNWAY = { x: -380, z: -1300, width: 120, length: 1200 };
/** Three hangars at close-up facility dots (px 156,187 / 55,298 / 512,108); four in a row west of the runway (interpolation). */
export const M02_HANGARS: FlightPoint[] = [
	m02Closeup(156, 187, 156, 187), m02Closeup(55, 298, 55, 298), m02Closeup(512, 108, 512, 108),
	EV(-760, LAND, -1110), EV(-760, LAND, -1260), EV(-760, LAND, -1410), EV(-760, LAND, -1560),
];
/** Control tower at the southern facility dot (px 346,476): Mitoro's route destroys the near AA and tower first. */
export const M02_TOWER = m02Closeup(346, 476, 346, 476);
/** Four AA south/east of the clusters, adapted from the close-up's yellow rows (eight Ace dots, four Normal guns). */
export const M02_AA: FlightPoint[] = [EV(-600, LAND, -720), EV(-56, LAND, -735), EV(60, LAND, -1710), EV(264, LAND, -792)];

// --- M03 Mt. Shezna --------------------------------------------------------------------
/**
 * Mitoro M03 (ac04_m03d1.gif / d2): each radar base is a short NW->SE chain of
 * radars and AA on a summit (east chain px (383,100)->(413,128), west chain
 * px (35,60)->(52,87)). Chains keep the existing site centres and altitudes;
 * spacing is widened to >=130 studs so pads and models stay disjoint.
 */
export interface M03Chain { center: FlightPoint; ux: number; uz: number }
const unit = (x: number, z: number): [number, number] => { const l = math.sqrt(x * x + z * z); return [x / l, z / l]; };
const [EUX, EUZ] = unit(30, 28), [WUX, WUZ] = unit(17, 27);
export const M03_EAST: M03Chain = { center: EV(1700, 650, -1700), ux: EUX, uz: EUZ };
export const M03_WEST: M03Chain = { center: EV(-2300, 850, -2100), ux: WUX, uz: WUZ };
export function m03ChainPoint(chain: M03Chain, along: number, across: number): FlightPoint {
	// across is measured along the chain's left-hand perpendicular (-uz, ux).
	return EV(chain.center.x + chain.ux * along - chain.uz * across, chain.center.y, chain.center.z + chain.uz * along + chain.ux * across);
}
export const M03_EAST_RADARS: number[][] = [[-280, 0], [-140, 0], [0, 0], [140, 0], [280, 0]];
export const M03_EAST_AA: number[][] = [[-210, -110], [-70, 110], [70, -110], [210, 110], [420, 0]];
export const M03_WEST_RADARS: number[][] = [[-210, 0], [-70, 0], [70, 0], [210, 0]];
/** Air spawns within this horizontal radius of a summit are lifted to summit + M03_AIR_CLEAR. */
export const M03_AIR_RADIUS = 1150, M03_AIR_CLEAR = 200;

function m02Ground(g: AC04UnitGroup, index: number): FlightPoint | undefined {
	if (g.id === "parked-bombers") return M02_BOMBERS[index];
	if (g.id === "hangars") return M02_HANGARS[index];
	if (g.id === "aa") return M02_AA[index];
	if (g.id === "tower") return M02_TOWER;
	if (g.id === "substation") return M02_SUBSTATION;
	return undefined;
}
function m03Ground(g: AC04UnitGroup, index: number): FlightPoint | undefined {
	const at = (chain: M03Chain, slots: number[][]) => { const s = slots[index]; return s !== undefined ? m03ChainPoint(chain, s[0], s[1]) : undefined; };
	if (g.id === "radar-east") return at(M03_EAST, M03_EAST_RADARS);
	if (g.id === "aa" && g.site === "radar-east") return at(M03_EAST, M03_EAST_AA);
	if (g.id === "radar-west") return at(M03_WEST, M03_WEST_RADARS);
	return undefined;
}
function m03AirLift(current: FlightPoint): FlightPoint {
	let y = current.y;
	for (const chain of [M03_EAST, M03_WEST]) {
		const dx = current.x - chain.center.x, dz = current.z - chain.center.z;
		if (dx * dx + dz * dz < M03_AIR_RADIUS * M03_AIR_RADIUS) y = math.max(y, chain.center.y + M03_AIR_CLEAR);
	}
	return y === current.y ? current : EV(current.x, y, current.z);
}

/** Authored position or undefined (caller keeps `current`). */
export function earlyAuthoredPosition(mission: AC04Mission, _layout: AC04Layout, g: AC04UnitGroup, index: number, current: FlightPoint): FlightPoint | undefined {
	if (mission.id === 2 && g.domain === "ground") return m02Ground(g, index);
	if (mission.id === 3 && g.domain === "ground") return m03Ground(g, index);
	if (mission.id === 3 && g.domain === "air") return m03AirLift(current);
	return undefined;
}
