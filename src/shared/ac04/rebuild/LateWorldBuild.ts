import type { AC04Mission } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { Rgb } from "../../EnvironmentPresets";
import type { TerrainMaterial, WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";
import {
	LATE_LAND, LATE_SEA, LateKeepOut, LateRidge, LateRidgeOf, LateV, lateBlock, lateBuildDistrict, lateCapRidges, lateChannel,
	lateEmitRidge, lateHash, lateKeepOps, latePart, latePartClear, lateRemoveParts, lateRoad, lateSegmentedWall, lateSetMaterialColor, lateToWorld,
} from "./LateGeometry";
import { lateBuildMegalith } from "./LateMegalith";
import { LateM13River, LateM13U2Path, LateM15Route7, LateM17, lateSurfaceUnits } from "./LatePlacement";

const V = LateV, LAND = LATE_LAND, SEA = LATE_SEA;
/** Set to true ONLY when the runtime opens the hatch on core destruction (LateRuntime.lateOpenMegalithHatch). */
export const LATE_MEGALITH_HATCH_WIRED = true;

/** Per-mission budget for refinement-authored parts (target models are separate). */
export const LatePartBudget: { [id: number]: number } = { 13: 120, 14: 160, 15: 520, 16: 420, 17: 560, 18: 220 };

export interface LateBuildReport { removedParts: number; removedOps: number; ridges: LateRidge[]; addedParts: number; addedOps: number }

/** Keep-outs around every ground/naval target. Naval berths and portals are hard. */
export function lateTargetKeepOuts(mission: AC04Mission, layout: AC04Layout): LateKeepOut[] {
	const out: LateKeepOut[] = [];
	for (const u of lateSurfaceUnits(mission, layout)) {
		const naval = u.group.domain === "naval";
		out.push({ x: u.at.x, z: u.at.z, radius: naval ? 150 : u.group.type === "C-17" ? 95 : 75, label: `${u.group.id}_${u.index + 1}`, hard: naval });
	}
	return out;
}
/** Samples a polyline every `step` studs: [x, z, y, normalX, normalZ]. */
function samplePolyline(pts: number[][], step: number): number[][] {
	const out: number[][] = [];
	for (let i = 1; i < pts.size(); i++) {
		const [ax, az, ay] = pts[i - 1], [bx, bz, by] = pts[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), n = math.max(1, math.ceil(len / step));
		for (let k = 0; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n, (ay ?? 0) + ((by ?? 0) - (ay ?? 0)) * k / n, -(bz - az) / len, (bx - ax) / len]);
	}
	return out;
}
const pathPoints = (path: FlightPoint[]): number[][] => path.map((q) => [q.x, q.z, q.y]);
/** Splits a polyline into short ridge segments with deterministic crest variation. */
function chain(points: number[][], halfWidth: number, height: number, material: TerrainMaterial, label: string, seed: number, segment = 460): LateRidge[] {
	const out: LateRidge[] = [];
	for (let i = 1; i < points.size(); i++) {
		const [ax, az] = points[i - 1], [bx, bz] = points[i];
		const len = math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), n = math.max(1, math.ceil(len / segment));
		for (let k = 0; k < n; k++) {
			const h = height * (0.78 + 0.4 * lateHash(seed, i, k));
			// Small overlap keeps the crest continuous between segments.
			const t0 = math.max(0, k / n - 0.04), t1 = math.min(1, (k + 1) / n + 0.04);
			out.push(LateRidgeOf(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, halfWidth, h, material, `${label} ${i}.${k}`));
		}
	}
	return out;
}
function capsAround(points: number[][], y: number, offsets: number[]): FlightPoint[] {
	const out: FlightPoint[] = [];
	for (const p of points) for (const o of offsets) out.push(V(p[0] + (p[3] ?? 0) * o, y, p[1] + (p[4] ?? 0) * o));
	return out;
}
function targetCaps(mission: AC04Mission, layout: AC04Layout, margin: number): FlightPoint[] {
	const out: FlightPoint[] = [];
	for (const u of lateSurfaceUnits(mission, layout)) if (u.group.type !== "JAMMER BALLOON") for (const [dx, dz] of [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]])
		out.push(V(u.at.x + dx, LAND, u.at.z + dz));
	return out;
}
function emitAll(plan: WorldPlan, ridges: LateRidge[]): void { for (const r of ridges) lateEmitRidge(plan, r); }

// --- M13 Safe Return ---------------------------------------------------------
export function lateSafeReturnRidges(mission: AC04Mission, layout: AC04Layout): LateRidge[] {
	const ridges: LateRidge[] = [
		...chain([[-3700, -1000], [-2200, -900], [-900, -1050], [300, -950], [1600, -1100], [3000, -900], [3700, -1000]], 380, 900, "Slate", "Gnome north wall", 131),
		...chain([[-3700, -1800], [-2000, -1650], [-500, -1850], [1000, -1700], [2400, -1900], [3700, -1750]], 440, 1100, "Rock", "Gnome high massif", 132),
		...chain([[-3600, -2700], [-1500, -2550], [400, -2750], [2200, -2600], [3600, -2800]], 360, 850, "Slate", "Gnome far massif", 133),
		...chain([[-3700, 2000], [-1500, 2150], [800, 1950], [3700, 2100]], 300, 600, "Rock", "Gnome south rim", 134),
	];
	// Ravine spurs between the jammer clusters; caps cut them under every jammer.
	for (const x of [-2700, -1700, -800, 150, 1100, 1900, 3100])
		for (const r of chain([[x, -700], [x + 200, 100], [x - 150, 900], [x + 100, 1600]], 260, 760, "Rock", `Gnome spur ${x}`, 140 + x / 100, 420)) ridges.push(r);
	const caps: FlightPoint[] = [];
	for (const u of lateSurfaceUnits(mission, layout)) if (u.group.id === "balloons") caps.push(V(u.at.x, u.at.y - 90, u.at.z));
	// U-2 corridor: terrain at least 160 below the route altitude, 180 either side.
	for (const q of samplePolyline(pathPoints(LateM13U2Path), 75)) for (const o of [-180, -90, 0, 90, 180]) caps.push(V(q[0] + q[3] * o, q[2] - 160, q[1] + q[4] * o));
	// River channel stays a valley floor (no ridge within 280 of its centre).
	for (const c of capsAround(samplePolyline(LateM13River, 150), 20, [-280, -140, 0, 140, 280])) caps.push(c);
	caps.push(V(layout.spawn.x, layout.spawn.y - 250, layout.spawn.z));
	lateCapRidges(ridges, caps);
	return ridges;
}
function buildSafeReturn(m: AC04Mission, l: AC04Layout, p: WorldPlan, r: LateBuildReport): void {
	p.theme = "canyon";
	// Replace the base parallel-lane ridges and straight river with the ravine net.
	r.removedOps += lateKeepOps(p, (op) => op.shape === "block" && op.material === "Grass");
	lateSetMaterialColor(p, "Grass", [56, 70, 55]);
	lateSetMaterialColor(p, "Rock", [88, 92, 90]);
	lateSetMaterialColor(p, "Slate", [70, 74, 78]);
	r.ridges = lateSafeReturnRidges(m, l);
	emitAll(p, r.ridges);
	lateChannel(p, LateM13River, 300, 160);
	p.waterY = SEA;
	// Indestructible junk-style boats (wiki); one sits behind and below the spawn.
	const boats: number[][] = [[2460, -2600], [2430, -600], [2470, 900], [1500, 2350], [-100, 2720], [-1900, 2930]];
	for (const [x, z] of boats) {
		latePart(p, "River junk hull", x, SEA + 5, z, 16, 8, 46, [92, 66, 44], "Wood", false);
		latePart(p, "River junk sail", x, SEA + 26, z - 4, 2, 34, 22, [176, 150, 112], "Fabric", false);
	}
	p.air.push({ x: l.spawn.x, z: l.spawn.z, limit: l.spawn.y - 200, rad: 150, label: "M13 spawn above south rim" });
	for (const q of [LateM13U2Path[1], LateM13U2Path[2], LateM13U2Path[3], LateM13U2Path[4]]) p.air.push({ x: q.x, z: q.z, limit: q.y - 150, rad: 120, label: "M13 U-2 ravine route" });
}

// --- M14 Breaking Arrows -----------------------------------------------------
/** Missile lanes (runtime and optional steer): terrain must stay under 180 here. */
export const LateM14LaneBand = { xMin: -1400, xMax: 2100, ceiling: 180 };
export function lateBreakingArrowsRidges(): LateRidge[] {
	const ridges: LateRidge[] = [
		...chain([[-3700, -3600], [-2900, -2600], [-2300, -1500], [-2700, -500]], 300, 300, "Rock", "Glacier nunataks", 141),
		...chain([[2600, -3600], [3000, -2200], [3300, -900], [3600, 400]], 320, 380, "Basalt", "Eastern basalt range", 142),
		...chain([[-3700, 600], [-2500, 1300], [-3000, 2400]], 260, 240, "Grass", "Western coastal hills", 143),
	];
	const caps: FlightPoint[] = [];
	for (let x = LateM14LaneBand.xMin; x <= LateM14LaneBand.xMax; x += 175) for (let z = -3800; z <= 3300; z += 250) caps.push(V(x, LateM14LaneBand.ceiling, z));
	lateCapRidges(ridges, caps);
	return ridges;
}
function buildBreakingArrows(m: AC04Mission, l: AC04Layout, p: WorldPlan, r: LateBuildReport): void {
	r.removedOps += lateKeepOps(p, (op) => op.shape === "block" && op.material === "Grass");
	r.removedParts += lateRemoveParts(p, ["Coast highway"]);
	p.theme = "plateau";
	lateSetMaterialColor(p, "Snow", [222, 230, 236]);
	lateSetMaterialColor(p, "Basalt", [38, 40, 44]);
	// Low glacier sheet (below every missile lane) with its black eastern margin.
	for (const [x0, x1] of [[-3200, -900], [-900, 1200]]) lateBlock(p, "Snow", (x0 + x1) / 2, LAND + 10, -2350, x1 - x0, 40, 2900);
	lateBlock(p, "Basalt", 1425, LAND + 6, -2350, 450, 30, 2900);
	lateBlock(p, "Snow", -600, LAND + 4, -600, 3200, 24, 700);
	r.ridges = lateBreakingArrowsRidges();
	emitAll(p, r.ridges);
	// Defended landing zone south of the return line: beach and sea.
	lateBlock(p, "Air", 0, 60, 3700, 8000, 120, 500);
	lateBlock(p, "Sand", 0, 0, 3700, 8000, 16, 520);
	lateBlock(p, "Water", 0, 20, 3700, 8000, 24, 500);
	lateBlock(p, "Sand", 0, LAND - 6, 3330, 8000, 12, 260);
	p.waterY = SEA;
	for (let k = 0; k < 4; k++) {
		const x = -1500 + k * 1000;
		latePart(p, "Allied landing ship", x, SEA + 12, 3640, 60, 24, 190, [92, 104, 108], "Metal", false);
		latePart(p, "Allied landing ship bridge", x, SEA + 40, 3700, 40, 32, 40, [110, 120, 124], "Metal", false);
		latePart(p, "Beachhead supply tent", x + 220, LAND + 9, 3330, 70, 18, 46, [98, 108, 78], "Fabric", false);
		latePart(p, "Beachhead supply tent", x - 220, LAND + 9, 3360, 70, 18, 46, [98, 108, 78], "Fabric", false);
	}
	lateRoad(p, [], "Coastal road", -3700, 3150, 3700, 3150, 40, LAND + 0.6, [58, 62, 64]);
	lateRoad(p, [], "Inland road", 300, 3150, 600, -800, 30, LAND + 0.6, [58, 62, 64]);
	for (let z = -3400; z <= 2900; z += 900) for (const x of [-1100, 0, 1400]) p.air.push({ x, z, limit: LateM14LaneBand.ceiling + 100, rad: 150, label: "M14 low missile lane" });
}

// --- M15 Emancipation --------------------------------------------------------
const NIGHT_PALETTE: Rgb[] = [[82, 88, 98], [96, 98, 104], [74, 80, 92], [104, 100, 96]];
const OLD_PALETTE: Rgb[] = [[118, 98, 82], [132, 116, 94], [104, 92, 84], [140, 124, 104]];
function nearPolyline(x: number, z: number, line: number[][], width: number): boolean {
	for (let i = 1; i < line.size(); i++) {
		const [ax, az] = line[i - 1], [bx, bz] = line[i], vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
		const t = math.clamp(((x - ax) * vx + (z - az) * vz) / len2, 0, 1), dx = x - (ax + vx * t), dz = z - (az + vz * t);
		if (dx * dx + dz * dz < width * width) return true;
	}
	return false;
}
function buildEmancipation(m: AC04Mission, l: AC04Layout, p: WorldPlan, r: LateBuildReport, keep: LateKeepOut[]): void {
	r.removedParts += lateRemoveParts(p, ["City block", "Window ribbon", "Government plaza", "Runway", "Runway center stripe", "Hangar shell", "Hangar door", "Airfield tower", "Tower cab"]);
	lateSetMaterialColor(p, "Grass", [44, 54, 46]);
	lateSetMaterialColor(p, "Concrete", [78, 80, 82]);
	// West coast (Shotgunnova: launchers by the west coast), carved in bands.
	for (let k = 0; k < 9; k++) {
		const z = -3600 + k * 900, edge = -2650 - 220 * math.sin(k * 1.3) - (k >= 5 && k <= 6 ? -180 : 0);
		const sx = edge + 4000;
		lateBlock(p, "Air", (edge - 4000) / 2, 60, z, sx, 120, 900);
		lateBlock(p, "Sand", (edge - 4000) / 2, 8, z, sx + 80, 16, 900);
		lateBlock(p, "Water", (edge - 4000) / 2, 24, z, sx, 16, 900);
	}
	p.waterY = SEA;
	const kaKeep: LateKeepOut[] = [];
	for (const g of m.roster) if (g.id === "ka50") for (let i = 0; i < g.count; i++) {
		const spots = [V(-1430, 240, 455), V(-1560, 260, 320), V(-1300, 230, 600), V(-1700, 250, 560), V(-1180, 270, 330), V(-1480, 280, 760)];
		kaKeep.push({ x: spots[math.min(i, 5)].x, z: spots[math.min(i, 5)].z, radius: 70, label: "Ka-50 hover slot" });
	}
	const keepAll = [...keep, ...kaKeep];
	const gov = l.sites["new-city"], old = l.sites["old-town"];
	// New City government complex: high-rise core falling off to mid-rise.
	r.addedParts += lateBuildDistrict(p, { label: "New City", cx: gov.x, cz: gov.z, yaw: 0.25, ground: LAND, cols: 9, rows: 8, lot: 92, street: 62,
		open: (c, w) => !(c === 4 && (w === 3 || w === 4)),
		height: (c, w, h) => { const d = math.sqrt((c - 4) * (c - 4) + (w - 3.5) * (w - 3.5)); return math.max(40, 330 - d * 52) * (0.7 + 0.45 * h); },
		footprint: 74, palette: NIGHT_PALETTE, material: "Glass", windows: [196, 214, 236], seed: 151, crownAbove: 170 }, keepAll, 150);
	latePartClear(p, keepAll, "Government complex hall", gov.x - 60, LAND + 30, gov.z - 330, 300, 60, 110, [150, 144, 132], "Concrete", true, "block", 0.25);
	latePartClear(p, keepAll, "Government complex dome", gov.x - 60, LAND + 70, gov.z - 330, 70, 70, 70, [170, 162, 140], "Concrete", true, "ball");
	// Old Towne: dense low blocks, Route 7 cut through, lit windows.
	r.addedParts += lateBuildDistrict(p, { label: "Old Towne", cx: old.x, cz: old.z, yaw: -0.35, ground: LAND, cols: 13, rows: 10, lot: 70, street: 42,
		open: (c, w) => {
			const pitch = 112, [ox, oz] = lateToWorld((c - 6) * pitch, (w - 4.5) * pitch, -0.35);
			return !nearPolyline(old.x + ox, old.z + oz, LateM15Route7, 95) && !(math.abs(old.x + ox - l.sites.monument.x) < 140 && math.abs(old.z + oz - l.sites.monument.z) < 140);
		},
		height: (_c, _w, h) => 26 + h * 46, footprint: 62, palette: OLD_PALETTE, material: "Brick", windows: [236, 190, 118], seed: 152 }, keepAll, 260);
	// Arch monument at a roundabout (Shotgunnova: Arc-de-Triomphe-like monument).
	const mon = l.sites.monument;
	for (const dx of [-38, 38]) latePartClear(p, keepAll, "Old Towne arch pier", mon.x + dx, LAND + 55, mon.z, 30, 110, 34, [196, 186, 160], "Limestone", true);
	latePartClear(p, keepAll, "Old Towne arch crown", mon.x, LAND + 124, mon.z, 120, 30, 36, [196, 186, 160], "Limestone", true);
	latePart(p, "Arch roundabout", mon.x, LAND + 0.7, mon.z, 240, 1, 240, [64, 66, 70], "Asphalt", false, "cylinder");
	// Lit highways: Route 7 and the central avenue linking the three districts.
	const roads: Array<[string, number[][]]> = [["Route 7", LateM15Route7], ["Central avenue", [[gov.x, gov.z + 10], [130, 420], [old.x - 300, old.z + 60]]], ["Airport boulevard", [[130, 420], [-150, -700], [-260, -1250]]], ["Coast road", [[-2350, 1500], [-2300, 300], [-2050, -900], [-900, -1500]]]];
	for (const [name, pts] of roads) for (let i = 1; i < pts.size(); i++) {
		r.addedParts += lateRoad(p, keepAll, name, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], name === "Route 7" ? 70 : 50, LAND + 0.6, [44, 46, 50]);
		r.addedParts += lateRoad(p, keepAll, `${name} lights`, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 4, LAND + 1.4, [240, 196, 120]);
	}
	// San Profetta Airport: E-W runway, apron, terminal, tower, hangars.
	const ap = l.sites.airport;
	latePart(p, "San Profetta runway", ap.x, LAND + 1, ap.z, 1400, 2, 150, [40, 44, 48], "Asphalt", true);
	for (let k = -6; k <= 6; k++) latePart(p, "Runway centre light", ap.x + k * 100, LAND + 2.2, ap.z, 30, 0.4, 4, [220, 224, 210], "Neon", false);
	latePart(p, "Airport apron", ap.x, LAND + 0.8, ap.z - 190, 1000, 1, 150, [70, 74, 78], "Concrete", false);
	latePartClear(p, keepAll, "San Profetta terminal", ap.x + 80, LAND + 25, ap.z - 380, 520, 50, 90, [118, 124, 130], "Glass", true);
	latePartClear(p, keepAll, "San Profetta control tower", ap.x + 420, LAND + 70, ap.z - 330, 34, 140, 34, [120, 124, 120], "Concrete", true);
	latePartClear(p, keepAll, "Control tower cab", ap.x + 420, LAND + 150, ap.z - 330, 56, 20, 56, [70, 120, 140], "Glass", true);
	for (const dx of [-620, -460]) latePartClear(p, keepAll, "Airport hangar", ap.x + dx, LAND + 30, ap.z - 380, 130, 60, 110, [96, 102, 108], "Metal", true);
	// Suburban fill between the districts (low, sparse).
	r.addedParts += lateBuildDistrict(p, { label: "San Salvacion suburb", cx: 150, cz: 900, yaw: 0, ground: LAND, cols: 12, rows: 4, lot: 60, street: 110,
		open: (c, w) => lateHash(153, c, w) > 0.45, height: (_c, _w, h) => 14 + h * 16, footprint: 50, palette: OLD_PALETTE, material: "Concrete", seed: 154 }, keepAll, 40);
}

// --- M16 Whiskey Corridor ----------------------------------------------------
export function lateWhiskeyRidges(mission: AC04Mission, layout: AC04Layout): LateRidge[] {
	const ridges: LateRidge[] = [
		...chain([[-3700, -200], [-2900, -1400], [-2100, -2600], [-1300, -3700]], 420, 860, "Sandstone", "Lambert Mountains (adapted)", 161),
		...chain([[800, -3700], [1900, -3000], [2900, -2300], [3700, -1500]], 420, 800, "Rock", "Amber Mountains (adapted)", 162),
		...chain([[-3700, 2600], [-3300, 1600], [-3600, 900]], 300, 520, "Sandstone", "South-west bluffs", 163),
	];
	// Low dunes in the open corridor between the sectors.
	for (const [x, z, yaw] of [[-900, 600, 0.4], [900, 900, -0.3], [-1200, -1300, 0.2], [1700, 600, 0.6], [-2600, -600, 0.1], [700, -2900, -0.2], [2800, 1200, 0.3], [-500, 1700, 0.5]]) {
		const dx = math.cos(yaw) * 260, dz = -math.sin(yaw) * 260;
		ridges.push(LateRidgeOf(x - dx, z - dz, x + dx, z + dz, 150, 55, "Sand", "Dune"));
	}
	// Crater rim (Mitoro: F-2 over a crater) as ten short ring segments.
	const crater = layout.sites.crater;
	for (let k = 0; k < 10; k++) {
		const a0 = k * math.pi / 5, a1 = (k + 1) * math.pi / 5, rr = 270;
		ridges.push(LateRidgeOf(crater.x + math.cos(a0) * rr, crater.z + math.sin(a0) * rr, crater.x + math.cos(a1) * rr, crater.z + math.sin(a1) * rr, 70, 55, "Ground", "Crater rim"));
	}
	const caps = targetCaps(mission, layout, 70);
	caps.push(V(layout.spawn.x, layout.spawn.y - 300, layout.spawn.z));
	lateCapRidges(ridges, caps);
	return ridges;
}
function berm(p: WorldPlan, keep: LateKeepOut[], name: string, x: number, z: number, length: number, yaw: number, height = 12): number {
	return latePartClear(p, keep, name, x, LAND + height / 2, z, length, height, 10, [150, 126, 92], "Sand", true, "block", yaw) ? 1 : 0;
}
function buildWhiskey(m: AC04Mission, l: AC04Layout, p: WorldPlan, r: LateBuildReport, keep: LateKeepOut[]): void {
	r.removedOps += lateKeepOps(p, (op) => op.shape === "block");
	r.removedParts += lateRemoveParts(p, ["Defensive earthwork"]);
	p.theme = "plateau";
	lateSetMaterialColor(p, "Sand", [190, 162, 118]);
	lateSetMaterialColor(p, "Sandstone", [168, 128, 92]);
	lateSetMaterialColor(p, "Pavement", [222, 214, 196]);
	lateSetMaterialColor(p, "Ground", [128, 104, 80]);
	// Northern salt flat around the field HQ (Shotgunnova: "a salt flat?").
	const hq = l.sites.headquarters;
	lateBlock(p, "Pavement", hq.x, LAND - 1, hq.z, 1700, 2, 1100);
	lateBlock(p, "Ground", l.sites.crater.x, LAND - 1, l.sites.crater.z, 420, 2, 420);
	r.ridges = lateWhiskeyRidges(m, l);
	emitAll(p, r.ridges);
	// Central line: two zig-zag trench berms across the corridor.
	for (const off of [-230, 210]) for (let k = 0; k < 12; k++) r.addedParts += berm(p, keep, "Central line trench berm", -770 + k * 140, -325 + off + (k % 2) * 30, 150, k % 2 === 0 ? 0.22 : -0.22);
	// Western defensive position: pillbox wall linking the westernmost link, tank traps.
	r.addedParts += lateSegmentedWall(p, keep, "Pillbox line wall", -2660, 430, -2460, 1220, 14, 16, LAND, [128, 126, 118], "Concrete", 110);
	for (let k = 0; k < 14; k++) r.addedParts += latePartClear(p, keep, "Tank trap", -2700 + (k % 2) * 40, LAND + 4, 420 + k * 60, 8, 8, 8, [96, 92, 86], "Concrete", false, "wedge") ? 1 : 0;
	// Artillery revetments (U berms) at the SE-of-HQ battery and Old Anchor guns.
	for (const u of lateSurfaceUnits(m, l)) if (u.group.id === "howitzers") {
		r.addedParts += berm(p, [], "Artillery revetment", u.at.x, u.at.z + 52, 70, 0, 10);
		r.addedParts += berm(p, [], "Artillery revetment", u.at.x - 52, u.at.z + 20, 60, math.pi / 2, 10);
		r.addedParts += berm(p, [], "Artillery revetment", u.at.x + 52, u.at.z + 20, 60, math.pi / 2, 10);
	}
	// Field HQ compound on the salt flat.
	for (const [dx, dz] of [[-300, 260], [420, 120], [-420, -260]]) latePartClear(p, keep, "Field HQ command bunker", hq.x + dx, LAND + 12, hq.z + dz, 120, 24, 80, [116, 110, 96], "Concrete", true);
	for (const [dx, dz] of [[230, -120], [-260, 160]]) {
		latePartClear(p, keep, "Field HQ antenna", hq.x + dx, LAND + 70, hq.z + dz, 6, 140, 6, [90, 94, 96], "Metal", true, "cylinder");
	}
	for (const [dx, dz, sx, sz] of [[0, -520, 1000, 4], [0, 520, 1000, 4], [-500, 0, 4, 1040], [500, 0, 4, 1040]]) latePart(p, "Field HQ perimeter fence", hq.x + dx, LAND + 4, hq.z + dz, sx, 8, sz, [110, 104, 92], "Metal", false);
	// Old Anchor Point: sparse low town with a water tower.
	const anchor = l.sites["old-anchor"];
	r.addedParts += lateBuildDistrict(p, { label: "Old Anchor Point", cx: anchor.x, cz: anchor.z, yaw: 0.12, ground: LAND, cols: 9, rows: 8, lot: 74, street: 70,
		open: (c, w) => lateHash(165, c, w) > 0.3, height: (_c, _w, h) => 18 + h * 30, footprint: 66, palette: OLD_PALETTE, material: "Sandstone", seed: 166 }, keep, 45);
	if (latePartClear(p, keep, "Old Anchor water tower", anchor.x - 360, LAND + 50, anchor.z + 380, 20, 100, 20, [120, 112, 100], "Metal", true, "cylinder"))
		latePart(p, "Old Anchor water tank", anchor.x - 360, LAND + 112, anchor.z + 380, 60, 30, 60, [140, 132, 118], "Metal", true, "cylinder");
	// Dirt supply roads following the Shotgunnova route: start SE -> Anchor -> centre -> west -> north.
	const dirt: Rgb = [140, 116, 86];
	const route: number[][] = [[l.spawn.x, 2100], [anchor.x, anchor.z + 300], [anchor.x, anchor.z], [0, -325], [-1880, 845], [-1880, 200], [-104, -2210], [1105, -1716]];
	for (let i = 1; i < route.size(); i++) r.addedParts += lateRoad(p, keep, "Corridor supply road", route[i - 1][0], route[i - 1][1], route[i][0], route[i][1], 36, LAND + 0.6, dirt);
}

// --- M17 Siege of Farbanti ---------------------------------------------------
const FARBANTI: Rgb[] = [[110, 106, 100], [96, 98, 104], [124, 118, 108], [86, 90, 96], [132, 126, 116]];
function buildFarbanti(m: AC04Mission, l: AC04Layout, p: WorldPlan, r: LateBuildReport, keep: LateKeepOut[]): void {
	// Keep the base ocean (first two ops); replace the base land slabs.
	r.removedOps += lateKeepOps(p, (op) => (op.material === "Sand" && op.y < 0) || (op.material === "Water" && op.sx >= 8000));
	r.removedParts += lateRemoveParts(p, ["City block", "Window ribbon", "Flooded building", "Silver Bridge", "Silver Bridge pier", "Headquarters landfill"]);
	p.theme = "coast";
	lateSetMaterialColor(p, "Concrete", [92, 94, 92]);
	lateSetMaterialColor(p, "Ground", [104, 96, 82]);
	const F = LateM17;
	const slab = (x0: number, x1: number, z0: number, z1: number, mat: TerrainMaterial) => {
		// Tile so no single block exceeds the 2048 limit used by the audits.
		const nx = math.ceil((x1 - x0) / 2000), nz = math.ceil((z1 - z0) / 2000);
		for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
			const ax = x0 + (x1 - x0) * i / nx, bx = x0 + (x1 - x0) * (i + 1) / nx, az = z0 + (z1 - z0) * k / nz, bz = z0 + (z1 - z0) * (k + 1) / nz;
			lateBlock(p, mat, (ax + bx) / 2, LAND - 24, (az + bz) / 2, bx - ax, 48, bz - az);
		}
	};
	slab(-1400, 3800, -3800, F.river.zMin, "Grass"); // north bank (armor approach)
	slab(F.westCoast, F.estuary.xMin, F.river.zMax, F.bay.zMin, "Concrete"); // city island
	slab(F.estuary.xMax, 3800, F.river.zMax, F.estuary.zMax, "Grass"); // SE friendly bank (Silver Bridge)
	slab(F.westCoast, -700, -900, 100, "Ground"); // GHQ landfill promontory, level at LAND
	slab(-1100, 900, F.bay.zMin, 640, "Concrete"); // flooded district shore (south edge)
	// Ruined flooded district in the bay south/west of the city.
	r.addedParts += lateBuildDistrict(p, { label: "Flooded district", cx: -560, cz: 980, yaw: 0.05, ground: LAND, cols: 7, rows: 4, lot: 120, street: 80,
		open: (c, w) => lateHash(171, c, w) > 0.22, height: (_c, _w, h) => 90 + h * 130, footprint: 92, palette: FARBANTI, material: "Concrete", flooded: 45, seed: 172 }, keep, 30);
	// Damaged capital core: dense towers, some broken (meteor-damaged city).
	const city = l.sites.city;
	r.addedParts += lateBuildDistrict(p, { label: "Farbanti", cx: city.x, cz: city.z, yaw: 0.12, ground: LAND, cols: 13, rows: 9, lot: 82, street: 50,
		open: (c, w) => !(c === 6 && w === 4) && !(c === 7 && w === 4),
		height: (c, w, h) => { const d = math.sqrt((c - 6) * (c - 6) + (w - 4) * (w - 4)); const base = math.max(45, 240 - d * 34); return h < 0.18 ? base * 0.35 : base * (0.7 + 0.4 * h); },
		footprint: 66, palette: FARBANTI, material: "Concrete", windows: [232, 196, 140], seed: 173, crownAbove: 150 }, keep, 300);
	// GHQ landfill: perimeter berm, bunker portals and a radar; SAMs stay exposed.
	const hq = l.sites.headquarters;
	for (const [ax, az, bx, bz] of [[-460, -480, 460, -480], [-460, 480, 460, 480], [460, -480, 460, 480]]) r.addedParts += lateSegmentedWall(p, keep, "GHQ landfill berm", hq.x + ax, hq.z + az, hq.x + bx, hq.z + bz, 20, 18, LAND, [112, 100, 84], "Ground", 115);
	for (const [dx, dz] of [[-380, 120], [-380, -170], [80, 300]]) latePartClear(p, keep, "GHQ bunker portal", hq.x + dx, LAND + 18, hq.z + dz, 60, 36, 50, [84, 88, 90], "Concrete", true);
	latePartClear(p, keep, "GHQ radar mast", hq.x - 380, LAND + 60, hq.z - 330, 10, 120, 10, [90, 94, 96], "Metal", true, "cylinder");
	latePart(p, "West coast sea wall", F.westCoast - 10, LAND - 6, -300, 20, 40, 1500, [120, 120, 116], "Concrete", true);
	// Silver Bridge (SE): cable-stayed deck over the estuary, clear of berths.
	const sz = F.silverZ, deckY = LAND + 28;
	const sx = (F.estuary.xMin + F.estuary.xMax) / 2;
	latePartClear(p, keep, "Silver Bridge deck", sx, deckY, sz, 900, 14, 100, [176, 182, 186], "Concrete", true);
	for (const dx of [-170, 170]) for (const dz of [-62, 62]) latePartClear(p, keep, "Silver Bridge pylon", sx + dx, deckY + 70, sz + dz, 20, 180, 20, [196, 200, 204], "Metal", true);
	for (let k = -4; k <= 4; k++) if (k !== 0) for (const dz of [-56, 56]) latePart(p, "Silver Bridge stay", sx + k * 80, deckY + 40 + (4 - math.abs(k)) * 6, sz + dz, 2, 70, 2, [214, 218, 222], "Metal", false);
	// Approaches to both bridges read as roads from altitude.
	const j = F.johnson;
	for (const [name, pts] of [["Johnson approach (north)", [[j.x, -1820], [j.x - 150, -2800]]], ["Johnson approach (city)", [[j.x, -880], [j.x, -620], [city.x, city.z]]], ["Silver approach", [[F.estuary.xMax + 30, sz], [3200, sz + 200]]], ["Silver boulevard", [[F.estuary.xMin - 30, sz], [city.x + 300, sz - 150], [hq.x + 450, hq.z + 200]]], ["Shore road", [[-1600, 560], [900, 560]]]] as Array<[string, number[][]]>)
		for (let i = 1; i < pts.size(); i++) r.addedParts += lateRoad(p, keep, name, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 50, LAND + 0.6, [52, 54, 58]);
	// Johnson bridge abutments (not part of the scored target model).
	for (const z of [-1840, -860]) latePartClear(p, keep, "Johnson abutment", j.x, LAND + 6, z, 150, 12, 60, [120, 122, 118], "Concrete", true);
	// River and estuary carved after the slabs; naval clearance later re-carves berths.
	lateBlock(p, "Air", 1050, 60, (F.river.zMin + F.river.zMax) / 2, 5500, 120, F.river.zMax - F.river.zMin);
	lateBlock(p, "Water", 1050, 16, (F.river.zMin + F.river.zMax) / 2, 5500, 32, F.river.zMax - F.river.zMin);
	lateBlock(p, "Air", (F.estuary.xMin + F.estuary.xMax) / 2, 60, (F.river.zMax + F.estuary.zMax) / 2, F.estuary.xMax - F.estuary.xMin, 120, F.estuary.zMax - F.river.zMax);
	lateBlock(p, "Water", (F.estuary.xMin + F.estuary.xMax) / 2, 16, (F.river.zMax + F.estuary.zMax) / 2, F.estuary.xMax - F.estuary.xMin, 32, F.estuary.zMax - F.river.zMax);
	p.waterY = SEA;
}

/** Applies the per-mission world refinement after base geometry, before target clearance. */
export function lateBuildWorld(m: AC04Mission, l: AC04Layout, p: WorldPlan): LateBuildReport {
	const report: LateBuildReport = { removedParts: 0, removedOps: 0, ridges: [], addedParts: 0, addedOps: 0 };
	const parts0 = p.parts.size(), ops0 = p.ops.size();
	const keep = lateTargetKeepOuts(m, l);
	if (m.id === 13) buildSafeReturn(m, l, p, report);
	else if (m.id === 14) buildBreakingArrows(m, l, p, report);
	else if (m.id === 15) buildEmancipation(m, l, p, report, keep);
	else if (m.id === 16) buildWhiskey(m, l, p, report, keep);
	else if (m.id === 17) buildFarbanti(m, l, p, report, keep);
	else if (m.id === 18) {
		report.removedParts += lateRemoveParts(p, ["Megalith armored quadrant", "East-west tunnel roof", "North-south tunnel roof", "AC04CoreGate", "Fortress seawall", "Fortress sea defenses"]);
		lateBuildMegalith(p, LATE_MEGALITH_HATCH_WIRED);
	}
	report.addedParts = p.parts.size() - parts0 + report.removedParts;
	report.addedOps = p.ops.size() - ops0 + report.removedOps;
	return report;
}
