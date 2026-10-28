import type { AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { FlightPoint } from "../../WorldTypes";
import { LATE_LAND, LATE_SEA, LateV, lateToWorld } from "./LateGeometry";
import { lateM13AltitudeToY, lateM13DetailToWorld, lateSafeReturnJammers, LateM13ShipPixel } from "./LateSources";
import { lateMegalithPortPosition, lateMegalithSecondaryPosition, lateMegalithSites, LATE_MEGALITH_ESCAPE_RADIUS } from "./LateMegalith";

const V = LateV, LAND = LATE_LAND, SEA = LATE_SEA;
export const LATE_FIRST = 13, LATE_LAST = 18;
export const lateInRange = (id: number): boolean => id >= LATE_FIRST && id <= LATE_LAST && id === math.floor(id);

/** Site, spawn and return-line authoring per mission. Absolute values: idempotent. */
export interface LateLayoutPatch { sites: { [name: string]: FlightPoint }; spawn?: FlightPoint; returnZ?: number; escape?: FlightPoint; escapeRadius?: number; use: string }

/** M13: U-2 recon route from the north through the jammer belt to the south line. */
export const LateM13U2Path: FlightPoint[] = [V(-600, 430, -3300), V(-650, 410, -2000), V(-450, 390, -900), V(-200, 370, 200), V(150, 370, 1200), V(0, 390, 2300), V(0, 430, 3500)];
/** M13 river (wiki: north-south through the east of the net; a boat lies behind the spawn). */
export const LateM13River: number[][] = [[2600, -3700], [2450, -1500], [2440, -200], [2450, 1200], [1900, 2100], [700, 2650], [-900, 2850], [-3700, 3050]];
/** M14 XB-70: fixed northern line west->east (Mitoro); orbits the north-east end afterwards. */
export const LateM14XB70Path: FlightPoint[] = [V(-3400, 1400, -3550), V(-1000, 1400, -3600), V(1500, 1400, -3550), V(2200, 1450, -3700)];
/** M15 Tu-160 flight plan: west border middle, then New City, airport, Old Towne (Shotgunnova). */
export const LateM15BomberPath: FlightPoint[] = [V(-3400, 1150, -1100), V(-1430, 1150, 455), V(-260, 1150, -1365), V(1690, 1150, 390), V(3300, 1150, 0)];
/** M15 Route 7 through Old Towne (wiki: tank battalion near Route 7). Adapted alignment. */
export const LateM15Route7: number[][] = [[1050, 950], [1600, 470], [2350, -200]];
/** M17 Farbanti geography (adapted): river z-span, estuary x-span, flooded bay. */
export const LateM17 = {
	river: { zMin: -1550, zMax: -1150 }, estuary: { xMin: 1100, xMax: 1500, zMax: 1300 },
	bay: { xMin: -1700, xMax: 1100, zMin: 520 }, westCoast: -1700,
	johnson: V(150, LAND, -1350), silverZ: 250,
};

export function lateLayoutPatch(id: number): LateLayoutPatch | undefined {
	if (id === 13) return { sites: { ravine: V(0, LAND, 600), river: V(lateM13DetailToWorld(LateM13ShipPixel[0], LateM13ShipPixel[1])[0], SEA, lateM13DetailToWorld(LateM13ShipPixel[0], LateM13ShipPixel[1])[1]),
		"u2-route": LateM13U2Path[0], "recon-escort": V(1500, 950, -1500), "recon-exit": LateM13U2Path[LateM13U2Path.size() - 1] },
		use: "LATE-REBUILD M13: jammer positions/altitudes transcribed from the Mitoro Ace detail map and decimated to the provisional Normal 100; ridges are capped under every jammer; river and hidden ship located from the same map; U-2 enters from the north (Shotgunnova). Relief is inferred, not surveyed." };
	if (id === 14) return { sites: { "missile-north": V(0, 330, -3600), "wave-1": V(-900, 300, -2900), "glacier-east-edge": V(1400, 330, -1000), "xb70-line": LateM14XB70Path[0], "landing-zone": V(0, LAND, 3450), north: V(0, 760, -3350) },
		spawn: V(-900, 800, -1700),
		use: "LATE-REBUILD M14: Mitoro Ace overview (13 studs/px) puts wave 1 near the start, later waves and the XB-70 on the north edge and the return line at the south; Shotgunnova mentions a glacier whose black eastern edge the final missile follows. Glacier/coast relief is adapted." };
	if (id === 15) return { sites: { "new-city": V(-1430, LAND, 455), "old-town": V(1690, LAND, 390), airport: V(-260, LAND, -1365), city: V(130, LAND, 420),
		outskirts: V(1270, LAND, -755), "launchers-west": V(-2010, LAND, 880), "yellow-northeast": V(1690, 1000, -1400), west: LateM15BomberPath[0],
		"gov-air": V(-1430, 950, 455), "airport-air": V(-260, 1000, -1365), "old-air": V(1690, 950, 390), monument: V(1640, LAND, 120), olmstead: V(416, 900, 0) },
		spawn: V(-870, 950, 1600), returnZ: 2000,
		use: "LATE-REBUILD M15: Mitoro labelled map (13 studs/px about the triangle) places New City govt complex SW, San Profetta Airport N, Old Towne E, start S, return line and the Tu-160 west entry; Shotgunnova notes a compact map, west-coast launchers and an arch monument. City fabric is adapted." };
	if (id === 16) return { sites: { "west-line": V(-1880, LAND, 845), "west-line-a": V(-2210, LAND, 845), "west-line-b": V(-1560, LAND, 845), "defense-lines": V(0, LAND, -325),
		"old-anchor": V(2210, LAND, -520), headquarters: V(-104, LAND, -2210), artillery: V(1105, LAND, -1716), crater: V(300, LAND, -1000),
		"crater-air": V(300, 900, -1050), "sr71-corner": V(-3400, 2400, 1900), north: V(-100, 900, -2500), intercept: V(400, 950, -600) },
		spawn: V(1700, 1000, 1900), returnZ: 2250,
		use: "LATE-REBUILD M16: Mitoro Ace overview (13 studs/px) gives the defensive position (W), central line, Old Anchor Point city (E), northern line/HQ and an artillery group SE of HQ, return line south; Shotgunnova Normal gives the SE start and per-sector composition. Mountain/salt-flat/crater relief is adapted." };
	if (id === 17) return { sites: { city: V(200, LAND, -400), headquarters: V(-1150, LAND, -450), harbor: V(900, SEA, 1250), flooded: V(-600, SEA, 900),
		bridges: V(150, LAND, -2000), johnson: LateM17.johnson, silver: V(1300, LAND, LateM17.silverZ), river: V(750, SEA, -1350), "south-ocean": V(0, 700, 1500),
		north: V(0, 1000, -2000), intercept: V(0, 950, -300) },
		spawn: V(0, 1100, 1650), returnZ: 1950,
		use: "LATE-REBUILD M17: wiki briefing geography (coastal GHQ landfill, Silver Bridge SE, flooded city S, armor from the north over Johnson Memorial Bridge) arranged on the Mitoro Ace compact combat box; Shotgunnova places the submerged district on the western coast. Coastline and street fabric are adapted." };
	if (id === 18) {
		const sites = lateMegalithSites();
		return { sites, escape: sites.escape, escapeRadius: LATE_MEGALITH_ESCAPE_RADIUS,
			use: "LATE-REBUILD M18: fortress topology from Mitoro Ace structure/route diagrams and the archived Shotgunnova Normal diagram (low E-W duct beneath two long arms, locked shorter central tube, vertical exit). Widths/heights adapted for flight." };
	}
	return undefined;
}

// --- per-mission authored placement ----------------------------------------
const jammerCache = new Map<number, FlightPoint[]>();
export function lateM13Jammers(count: number): FlightPoint[] {
	const cached = jammerCache.get(count);
	if (cached) return cached;
	const out: FlightPoint[] = [];
	for (const j of lateSafeReturnJammers(count)) {
		const [x, z] = lateM13DetailToWorld(j[0], j[1]);
		out.push(V(x, lateM13AltitudeToY(j[2]), z));
	}
	jammerCache.set(count, out);
	return out;
}

/** Index range allocation: [site point, count] slots consumed in order by a group. */
type Slot = [FlightPoint, number, number?];
function cluster(slots: Slot[], index: number, spacing: number, salt: number): FlightPoint {
	let i = index;
	for (const [c, n, yaw] of slots) {
		if (i < n) {
			// Small staggered clumps (2-3 per row) instead of a uniform grid.
			const cols = n <= 4 ? 2 : 3, col = i % cols, row = math.floor(i / cols);
			const lx = (col - (cols - 1) / 2) * spacing + ((row % 2) * spacing) / 3, lz = (row - (math.ceil(n / cols) - 1) / 2) * spacing;
			const [ox, oz] = lateToWorld(lx, lz, yaw ?? salt);
			return V(c.x + ox, c.y, c.z + oz);
		}
		i -= n;
	}
	const last = slots[slots.size() - 1][0];
	return V(last.x, last.y, last.z);
}
function line(a: FlightPoint, b: FlightPoint, index: number, count: number): FlightPoint {
	const t = count <= 1 ? 0.5 : index / (count - 1);
	return V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

function m13(g: AC04UnitGroup, i: number): FlightPoint | undefined {
	if (g.id === "balloons") return lateM13Jammers(g.count)[i];
	if (g.id === "frigate") { const [x, z] = lateM13DetailToWorld(LateM13ShipPixel[0], LateM13ShipPixel[1]); return V(x, SEA, z); }
	if (g.id === "u2") return LateM13U2Path[0];
	if (g.id === "f15e") return V(1350 + i * 160, 950, -1500 - i * 60);
	if (g.id === "ef2000") return V(1750 + i * 160, 1050, -1650 - i * 60);
	return undefined;
}
function m14(g: AC04UnitGroup, i: number): FlightPoint | undefined {
	if (g.id === "missile-1") return V(-900 + (i - 2) * 140, 290 + (i % 3) * 35, -2900 - (i % 2) * 90);
	if (g.id === "missile-2") { const lane = i < 5 ? -1 : 1, k = i % 5; return V(lane * (260 + (k % 2) * 90), 300 + (k % 3) * 30, -3600 + k * 110); }
	if (g.id === "missile-final") return V(0, 340, -3700);
	if (g.id === "f22") return V(i === 0 ? -160 : 160, 720, -3350);
	if (g.id === "xb70") return LateM14XB70Path[0];
	return undefined;
}
function m15(g: AC04UnitGroup, i: number): FlightPoint | undefined {
	const gov = V(-1430, LAND, 455), old = V(1690, LAND, 390);
	if (g.id === "c17") return V(-260 + (i - 3) * 150, LAND, -1555);
	if (g.id === "sam") return cluster([[V(-260, LAND, -1215), 1], [V(-1430, LAND, 470), 3, 0.25], [V(2050, LAND, 700), 2, -0.35]], i, 150, 0);
	if (g.id === "aa") {
		if (i < 5) { const a = i * math.pi * 2 / 5 + 0.3; return V(gov.x + math.cos(a) * 470, LAND, gov.z + math.sin(a) * 430); }
		if (i < 7) return V(i === 5 ? -840 : 330, LAND, -1180);
		const a = (i - 7) * math.pi * 2 / 5 + 0.1; return V(old.x + math.cos(a) * 520, LAND, old.z + math.sin(a) * 440);
	}
	if (g.id === "infantry") return cluster([[V(-1600, LAND, 260), 6, 0.25], [V(-1230, LAND, 700), 6, 0.25]], i, 110, 0.25);
	if (g.id === "tanks") {
		// Pairs along Route 7 through Old Towne.
		const pair = math.floor(i / 2), side = i % 2 === 0 ? -1 : 1, t = (pair + 0.5) / 9;
		const r = LateM15Route7, seg = t < 0.45 ? 0 : 1, segmentT = seg === 0 ? t / 0.45 : (t - 0.45) / 0.55;
		const ax = r[seg][0], az = r[seg][1], bx = r[seg + 1][0], bz = r[seg + 1][1];
		const dx = bx - ax, dz = bz - az, len = math.sqrt(dx * dx + dz * dz);
		return V(ax + dx * segmentT + (-dz / len) * 55 * side, LAND, az + dz * segmentT + (dx / len) * 55 * side);
	}
	if (g.id === "launchers") return [V(-2010, LAND, 880), V(-2130, LAND, 1060), V(730, LAND, -1030), V(1270, LAND, -755)][math.min(i, 3)];
	if (g.id === "ka50") { const spots = [V(-1430, 240, 455), V(-1560, 260, 320), V(-1300, 230, 600), V(-1700, 250, 560), V(-1180, 270, 330), V(-1480, 280, 760)]; return spots[math.min(i, 5)]; }
	if (g.id === "tu160") { const pair = math.floor(i / 2); return V(-3400 - (i % 2) * 160, 1150 + (i % 2) * 40, -1100 + (pair - 1) * 350); }
	if (g.id === "yellow") return V(1690 + (i - 2) * 110, 1000 + (i % 2) * 60, -1400 + math.abs(i - 2) * 80);
	return undefined;
}
/** M16 per-sector allocation (provisional; Shotgunnova sector point budgets). */
const M16 = {
	westA: V(-2210, LAND, 845), westB: V(-1560, LAND, 845), center: V(0, LAND, -325), anchor: V(2210, LAND, -520),
	north: V(-104, LAND, -2210), artillery: V(1105, LAND, -1716),
};
function m16(g: AC04UnitGroup, i: number): FlightPoint | undefined {
	const s = M16;
	if (g.id === "tanks-west") return cluster([[V(-2000, LAND, 560), 4, 0.4], [V(-1700, LAND, 560), 4, -0.3]], i, 95, 0);
	if (g.id === "tanks-west-r") return cluster([[V(-1880, LAND, 1180), 4, 0.1]], i, 95, 0);
	if (g.id === "tanks-center") return cluster([[V(-420, LAND, -260), 6, 0.5], [V(60, LAND, -150), 5, -0.2], [V(430, LAND, -420), 5, 0.3]], i, 90, 0);
	if (g.id === "tanks-center-r") return cluster([[V(-150, LAND, -620), 4, 0.2], [V(260, LAND, -40), 4, -0.4]], i, 90, 0);
	if (g.id === "tanks-anchor") return cluster([[V(1980, LAND, -380), 4, 0.6], [V(2380, LAND, -260), 4, -0.6], [V(2300, LAND, -760), 4, 0.1]], i, 120, 0);
	if (g.id === "tanks-anchor-r") return cluster([[V(2620, LAND, -560), 6, 0.3]], i, 110, 0);
	if (g.id === "tanks-north") return cluster([[V(-420, LAND, -2050), 7, 0.1], [V(230, LAND, -2080), 7, -0.1], [V(-110, LAND, -2520), 6, 0]], i, 95, 0);
	if (g.id === "howitzers") return cluster([[V(2550, LAND, -900), 4, 0.2], [s.westA, 3, 0], [s.westB, 3, 0], [s.artillery, 4, 0.4]], i, 120, 0);
	if (g.id === "sam-heavy") return cluster([[V(2050, LAND, -820), 1], [V(-480, LAND, -700), 4, 0], [V(-1880, LAND, 900), 3, 0], [V(-104, LAND, -1900), 3, 0]], i, 160, 0);
	if (g.id === "aa-heavy") return cluster([[V(2700, LAND, -250), 3, 0.5], [V(-140, LAND, 150), 4, 0.2], [V(-2150, LAND, 300), 3, 0]], i, 140, 0);
	if (g.id === "tents") return cluster([[V(-1440, LAND, 1080), 4, 0], [V(-560, LAND, -2400), 8, 0]], i, 95, 0);
	if (g.id === "pillboxes") return line(V(-2550, LAND, 470), V(-2350, LAND, 1180), i, g.count);
	if (g.id === "launchers") return cluster([[V(300, LAND, -2350), 4, 0]], i, 100, 0);
	if (g.id === "hq") return V(-104, LAND, -2210);
	if (g.id === "flak") return V(i === 0 ? -360 : 180, LAND, -1800);
	if (g.id === "sam") return cluster([[V(1380, LAND, -1480), 4, 0.4]], i, 150, 0);
	if (g.id === "aa") return V(120, LAND, -2600);
	if (g.id === "sr71") return V(-3400, 2400, 1900);
	return undefined;
}
function m17(g: AC04UnitGroup, i: number): FlightPoint | undefined {
	if (g.id === "armor") {
		if (i < 8) return line(V(150, LAND, -1700), V(-150, LAND, -2700), i, 8);
		if (i < 18) return cluster([[V(-150, LAND, -700), 5, 0.12], [V(520, LAND, -150), 5, 0.12]], i - 8, 95, 0.12);
		return cluster([[V(-900, LAND, -150), 5, 0]], i - 18, 100, 0);
	}
	if (g.id === "armor-reinforce") return cluster([[V(200, LAND, -420), 6, 0.12]], i, 95, 0.12);
	if (g.id === "aa") return cluster([[V(250, LAND, -800), 3, 0.12], [V(650, LAND, -500), 3, 0.12], [V(-1150, LAND, -800), 5, 0], [V(-150, LAND, 380), 4, 0]], i, 130, 0);
	if (g.id === "sam") return cluster([[V(-1280, LAND, -450), 6, 0], [V(500, LAND, -950), 4, 0.12]], i, 150, 0);
	if (g.id === "battleship") return V(900, SEA, 1250);
	if (g.id === "destroyer") return V(750, SEA, -1350);
	if (g.id === "subs") return i === 0 ? V(-850, SEA, 820) : V(-300, SEA, 1050);
	if (g.id === "bridge") return LateM17.johnson;
	if (g.id === "apache") return V(-650 + (i % 2) * 300, 320, 850 + math.floor(i / 2) * 220);
	return undefined;
}
function m18(g: AC04UnitGroup, i: number, l: AC04Layout): FlightPoint | undefined {
	if (g.id === "generator-west" || g.id === "generator-east" || g.id === "generator-north" || g.id === "core") { const s = l.sites[g.id]; return s ? V(s.x, s.y, s.z) : undefined; }
	if (g.id === "ports") return lateMegalithPortPosition(i);
	if (g.id === "secondary-missiles") return lateMegalithSecondaryPosition(i);
	if (g.id === "yellow") {
		// Three five-ship formations meeting the sortie head-on (Mitoro start diagram).
		const f = math.floor(i / 5), k = i % 5, cx = [0, -950, 950][f], y = [1250, 1150, 1350][f], z = [500, 850, 850][f];
		return V(cx + (k - 2) * 120, y, z - math.abs(k - 2) * 60);
	}
	return undefined;
}

/** Authored position for a late-mission unit, or undefined to keep the base placement. */
export function lateAuthoredPosition(mission: AC04Mission, layout: AC04Layout, group: AC04UnitGroup, index: number): FlightPoint | undefined {
	const id = mission.id;
	if (id === 13) return m13(group, index);
	if (id === 14) return m14(group, index);
	if (id === 15) return m15(group, index);
	if (id === 16) return m16(group, index);
	if (id === 17) return m17(group, index);
	if (id === 18) return m18(group, index, layout);
	return undefined;
}

/** Every ground/naval unit position in a late mission (keep-outs and tests). */
export function lateSurfaceUnits(mission: AC04Mission, layout: AC04Layout): Array<{ group: AC04UnitGroup; index: number; at: FlightPoint; authored: boolean }> {
	const out: Array<{ group: AC04UnitGroup; index: number; at: FlightPoint; authored: boolean }> = [];
	for (const group of mission.roster) if (group.domain === "ground" || group.domain === "naval") for (let index = 0; index < group.count; index++) {
		const at = lateAuthoredPosition(mission, layout, group, index);
		out.push({ group, index, at: at ?? (layout.sites[group.site] ?? V(0, LAND, 0)), authored: at !== undefined });
	}
	return out;
}
