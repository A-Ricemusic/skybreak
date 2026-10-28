import type { AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { Rgb } from "../../EnvironmentPresets";
import type { TerrainMaterial, WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";
import {
	EARLY_AIR_PREFIX, EARLY_LAND, EARLY_SEA, EV, eBlock, eCylinder, eLocalPart, eMassif, ePart, eRibbon, eRidge, eSlab, eTaperedRidge, earlyAxisYaw, earlyResetToBase, earlyToWorld,
} from "./EarlyGeometry";
import {
	M02_AA, M02_BOMBERS, M02_CLUSTERS, M02_HANGARS, M02_RUNWAY, M02_SUBSTATION, M02_TOWER, M03_EAST, M03_EAST_AA, M03_EAST_RADARS, M03_WEST, M03_WEST_RADARS, earlyAuthoredPosition, m03ChainPoint, type M03Chain,
} from "./EarlyPlacement";

/**
 * Early-campaign (M1-M5) layout, world and unit-placement refinements.
 * NOT ACTIVE until the root wires them into AC04WorldData (see
 * docs/reviews/ac04-early-rebuild.json, integration). Type-only imports from
 * the shared planners. Every coordinate is an adaptation of the inspected
 * references at Roblox scale, not a survey.
 */
const LAND = EARLY_LAND, SEA = EARLY_SEA;
const CONCRETE: Rgb = [132, 142, 145], ASPHALT: Rgb = [46, 50, 54], STEEL: Rgb = [88, 101, 113], MARK: Rgb = [214, 216, 204], PALE: Rgb = [196, 198, 192];
const RUST: Rgb = [112, 86, 66], EARTH: Rgb = [104, 92, 70], GLASS: Rgb = [56, 101, 121], LAMP: Rgb = [255, 226, 150], FLAME: Rgb = [255, 150, 60];

export function earlyInRange(id: number): boolean { return id >= 1 && id <= 5; }

// --- M01 Newfield Island frame -------------------------------------------------------
/**
 * Newfield Island (Sitting Duck): a mountainous island elongated SW->NE, with
 * Allenfort Air Base on the northern tip, Belta Port beside it, and the flooded
 * Anderson Crater on the south-east face opening to the sea (wiki/lparchive text
 * plus the Namco concept art reproduced on lparchive Update 01). Local frame:
 * s along the SW->NE axis, n toward the south-east coast.
 */
export const M01_CENTER = { x: -300, z: 1100 };
const R2 = math.sqrt(0.5);
export const M01_U = { x: R2, z: -R2 }, M01_N = { x: R2, z: R2 };
export function m01World(s: number, n: number, y = LAND): FlightPoint {
	return EV(M01_CENTER.x + s * M01_U.x + n * M01_N.x, y, M01_CENTER.z + s * M01_U.z + n * M01_N.z);
}
export function m01Local(x: number, z: number): [number, number] {
	const dx = x - M01_CENTER.x, dz = z - M01_CENTER.z;
	return [dx * M01_U.x + dz * M01_U.z, dx * M01_N.x + dz * M01_N.z];
}
/** Coast half-widths (s, north-west, south-east). SE coast recedes south-west of the crater so it opens to the sea. */
export const M01_PROFILE: number[][] = [
	[-2500, 0, 0], [-2300, 160, 120], [-2000, 300, 250], [-1600, 420, 350], [-1200, 550, 400], [-800, 650, 450], [-600, 700, 470], [-300, 760, 650],
	[0, 800, 1050], [400, 850, 950], [800, 800, 650], [1200, 750, 450], [1600, 450, 350], [2000, 250, 300], [2300, 150, 200], [2500, 0, 0],
];
export function m01HalfWidths(s: number): [number, number] {
	const p = M01_PROFILE;
	if (s <= p[0][0] || s >= p[p.size() - 1][0]) return [0, 0];
	for (let i = 1; i < p.size(); i++) if (s <= p[i][0]) {
		const t = (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
		return [p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, p[i - 1][2] + (p[i][2] - p[i - 1][2]) * t];
	}
	return [0, 0];
}
export const M01_CRATER = { s: 0, n: 560, radius: 400, rim: 470 };
export const M01_RUNWAY = { s: 1850, n: 0, length: 1000, width: 110 };
const M01_YAW = earlyAxisYaw(M01_U.x, M01_U.z);

// --- M05 production placement mirrors (read-only; never moved) ------------------------
/** Deck top of the offshore field, equal to the production rigs site altitude. */
export const M05_DECK_TOP = 110;
/** Main deck covering the production 5x9 rig grid (x 1900..2300, z -1700..-900) plus model overhang. */
export const M05_DECK = { x: 2120, z: -1300, sx: 560, sz: 900 };

// --- layouts ---------------------------------------------------------------------
interface LayoutPatch { sites: { [name: string]: FlightPoint }; use: string }
const LAYOUTS: { [id: number]: LayoutPatch } = {
	1: { sites: { airbase: m01World(M01_RUNWAY.s, M01_RUNWAY.n), settlement: m01World(950, 400) },
		use: "Newfield Island adapted from wiki/lparchive geography and Namco concept art: SW-NE mountainous island, Allenfort on the north tip, Belta Port, Anderson Crater. Bomber/fighter placement unchanged (Mitoro Ace column)." },
	2: { sites: { substation: { ...M02_SUBSTATION }, tower: { ...M02_TOWER } },
		use: "Rigley Air Base: Mitoro M02 overview (substation on the southern approach) and close-up (four TU-95 dispersal clusters). Runway orientation interpreted; air sites unchanged." },
	3: { sites: {},
		use: "Mt. Shezna: two summit radar chains (Mitoro M03 overview/route), snow massifs and a southern return descent. Site centres and summit altitudes unchanged." },
	4: { sites: {},
		use: "Erusean coast near Comberth with ground windmills (wiki). Mitoro M04 supplies only the air topology (three transports, two jamming circles); terrain is interpolation." },
	5: { sites: {},
		use: "Coastal refinery west, offshore field east (wiki, Mitoro M05). Production M5 target placement and sites unchanged; refinery/rig silhouettes refined around them." },
};
/** Applied once when layouts are constructed. Pure; idempotent; out-of-range ids unchanged. */
export function refineEarlyLayout(id: number, layout: AC04Layout): AC04Layout {
	const patch = LAYOUTS[id];
	if (patch === undefined) return layout;
	const sites: { [name: string]: FlightPoint } = {};
	for (const [name, p] of pairs(layout.sites)) sites[name as string] = { x: p.x, y: p.y, z: p.z };
	for (const [name, p] of pairs(patch.sites)) sites[name as string] = { x: p.x, y: p.y, z: p.z };
	return { ...layout, sites, spawn: { ...layout.spawn }, evidence: { ...layout.evidence, use: patch.use } };
}

/**
 * Optional placement hook. Integration: wrap AC04WorldData.unitPosition so the
 * base result passes through this function (before the Middle/Late hooks, whose
 * ranges are disjoint). Only M2/M3 ground units are re-placed and M3 air spawns
 * lifted clear of Mt. Shezna; every other unit, and all of M1/M4/M5, returns
 * `current` unchanged.
 */
export function refineEarlyUnitPosition(mission: AC04Mission, layout: AC04Layout, group: AC04UnitGroup, index: number, current: FlightPoint): FlightPoint {
	if (!earlyInRange(mission.id)) return current;
	const authored = earlyAuthoredPosition(mission, layout, group, index, current);
	return authored !== undefined ? { x: authored.x, y: authored.y, z: authored.z } : current;
}

// --- shared world bits -----------------------------------------------------------------
function setColor(plan: WorldPlan, material: TerrainMaterial, color: Rgb): void {
	for (const entry of plan.materialColors) if (entry[0] === material) { entry[1] = color; return; }
	plan.materialColors.push([material, color]);
}
function air(plan: WorldPlan, label: string, x: number, z: number, limit: number, rad: number): void {
	plan.air.push({ x, z, limit, rad, label: EARLY_AIR_PREFIX + label });
}
/** Land along z-slices west of xc(z): sand shelf to xc+beach, then grass/ground to xc. */
function coastWest(plan: WorldPlan, xc: (z: number) => number, beach: number, top: TerrainMaterial, step = 200): void {
	for (let z0 = -4000; z0 < 4000; z0 += step) {
		const x = math.min(xc(z0), xc(z0 + step)), zm = z0 + step / 2;
		eSlab(plan, "Sand", (-4000 + x + beach) / 2, zm, x + beach + 4000, step, 0, SEA + 12);
		eSlab(plan, top, (-4000 + x) / 2, zm, x + 4000, step, 0, LAND);
	}
}
/** A wind turbine: tapered tower, nacelle, hub and four flat blade arms (yaw-only parts cannot tilt three blades). */
function windTurbine(plan: WorldPlan, x: number, z: number, faceYaw: number, hub = 150): void {
	ePart(plan, "Wind turbine tower base", x, LAND + hub * 0.3, z, 10, hub * 0.6, 10, PALE, "Metal", true, "cylinder");
	ePart(plan, "Wind turbine tower", x, LAND + hub * 0.8, z, 7, hub * 0.4, 7, PALE, "Metal", true, "cylinder");
	const [fx, fz] = earlyToWorld(0, -8, faceYaw);
	ePart(plan, "Wind turbine nacelle", x, LAND + hub + 3, z, 8, 8, 22, PALE, "Metal", true, "block", faceYaw);
	ePart(plan, "Wind turbine hub", x + fx * 1.6, LAND + hub + 3, z + fz * 1.6, 7, 7, 7, MARK, "SmoothPlastic", false, "ball");
	ePart(plan, "Wind turbine blade pair", x + fx * 1.8, LAND + hub + 3, z + fz * 1.8, 4, 118, 1.5, MARK, "SmoothPlastic", false, "block", faceYaw);
	ePart(plan, "Wind turbine blade pair", x + fx * 1.8, LAND + hub + 3, z + fz * 1.8, 118, 4, 1.5, MARK, "SmoothPlastic", false, "block", faceYaw);
}

// --- M01 Sitting Duck: Newfield Island --------------------------------------------------
function m01Build(plan: WorldPlan): void {
	plan.theme = "coast";
	// Island raster: 100-stud slices along the SW-NE axis, sand shelf then grass.
	const STEP = 100;
	for (let s0 = -2500; s0 < 2500; s0 += STEP) {
		const sm = s0 + STEP / 2, [a0, b0] = m01HalfWidths(s0), [a1, b1] = m01HalfWidths(s0 + STEP), [am, bm] = m01HalfWidths(sm);
		const nw = math.max(a0, a1, am), se = math.max(b0, b1, bm);
		if (nw + se < 40) continue;
		const sand = m01World(sm, (se - nw) / 2), grass = m01World(sm, (math.min(b0, b1) - math.min(a0, a1)) / 2);
		eSlab(plan, "Sand", sand.x, sand.z, STEP + 16, nw + se + 120, 0, SEA + 12, M01_YAW);
		eSlab(plan, "Grass", grass.x, grass.z, STEP + 16, math.min(a0, a1) + math.min(b0, b1), 0, LAND, M01_YAW);
	}
	// North-west fjord on the northern lobe (concept art inlet).
	const fj = m01World(1350, -560);
	eSlab(plan, "Air", fj.x, fj.z, 170, 420, SEA, 400, M01_YAW + math.pi / 2);
	eSlab(plan, "Water", fj.x, fj.z, 170, 420, 0, SEA, M01_YAW + math.pi / 2);
	// Mountain spine north-west of centre: grass flanks, rock crest.
	const spine = [[-1850, -40, 450, 330, 250], [-1050, -150, 520, 430, 400], [-250, -300, 470, 420, 480], [550, -250, 500, 420, 440], [1050, -120, 330, 330, 290]];
	for (const r of spine) {
		const c = m01World(r[0], r[1]);
		eTaperedRidge(plan, c.x, c.z, r[2], r[3], r[4], "Grass", LAND, M01_YAW);
		eRidge(plan, c.x, c.z, r[2] / 3, r[3] * 0.45, r[4] * 0.45, "Rock", LAND + r[4] * 0.55, M01_YAW);
	}
	// Spurs falling toward Belta Port and the crater rim.
	for (const r of [[250, 250, 260, 200, 200], [-700, 160, 280, 220, 220]]) { const c = m01World(r[0], r[1]); eTaperedRidge(plan, c.x, c.z, r[2], r[3], r[4], "Grass", LAND, M01_YAW + math.pi / 2, 2); }
	// Anderson Crater: rock rim ring, then a flooded bowl breached toward the SSW.
	const cr = M01_CRATER, cc = m01World(cr.s, cr.n);
	for (let k = 0; k < 10; k++) {
		const a = k * math.pi / 5, rs = cr.s + math.cos(a) * cr.rim, rn = cr.n + math.sin(a) * cr.rim, p = m01World(rs, rn);
		const [tx, tz] = [-math.sin(a) * M01_U.x + math.cos(a) * M01_N.x, -math.sin(a) * M01_U.z + math.cos(a) * M01_N.z];
		eRidge(plan, p.x, p.z, 165, 110, 150, "Rock", LAND, earlyAxisYaw(tx, tz));
	}
	eCylinder(plan, "Air", cc.x, cc.z, cr.radius, SEA, 640);
	eCylinder(plan, "Water", cc.x, cc.z, cr.radius, 0, SEA);
	const mouth = m01World(cr.s - 360, cr.n + 120), mouthYaw = earlyAxisYaw(-0.95 * M01_U.x + 0.3 * M01_N.x, -0.95 * M01_U.z + 0.3 * M01_N.z);
	eSlab(plan, "Air", mouth.x, mouth.z, 520, 300, SEA, 640, mouthYaw);
	eSlab(plan, "Water", mouth.x, mouth.z, 520, 300, 0, SEA, mouthYaw);
	const islet = m01World(cr.s - 470, cr.n + 170);
	plan.ops.push({ shape: "ball", material: "Rock", x: islet.x, y: SEA - 10, z: islet.z, sx: 46, sy: 46, sz: 46, yaw: 0 });
	// Allenfort Air Base on the north tip: cleared corridor, runway along the island axis.
	const rw = m01World(M01_RUNWAY.s, M01_RUNWAY.n);
	eSlab(plan, "Air", rw.x, rw.z, M01_RUNWAY.length + 200, 420, LAND, 700, M01_YAW);
	const L = (name: string, s: number, n: number, y: number, sx: number, sy: number, sz: number, color: Rgb, material = "Concrete", solid = true, shape: "block" | "cylinder" | "ball" = "block") =>
		eLocalPart(plan, rw.x, rw.z, M01_YAW, name, s - M01_RUNWAY.s, y, n - M01_RUNWAY.n, sx, sy, sz, color, material, solid, shape);
	L("Allenfort runway", M01_RUNWAY.s, 0, LAND + 2, M01_RUNWAY.length, 4, M01_RUNWAY.width, ASPHALT, "Asphalt");
	for (let i = -4; i <= 4; i++) L("Runway center stripe", M01_RUNWAY.s + i * 105, 0, LAND + 4.2, 40, 0.3, 5, MARK, "SmoothPlastic", false);
	for (const e of [-1, 1]) L("Runway threshold bar", M01_RUNWAY.s + e * (M01_RUNWAY.length / 2 - 20), 0, LAND + 4.2, 8, 0.3, 90, MARK, "SmoothPlastic", false);
	L("Allenfort taxiway", M01_RUNWAY.s, 115, LAND + 0.5, 900, 0.6, 30, ASPHALT, "Asphalt", false);
	L("Allenfort apron", 1700, 200, LAND + 0.5, 360, 0.6, 120, [92, 96, 98], "Concrete", false);
	for (let k = 0; k < 3; k++) L("Allenfort hangar", 1580 + k * 130, 240, LAND + 22, 100, 44, 70, [120, 128, 120]);
	L("Allenfort tower", 2060, 190, LAND + 45, 22, 90, 22, CONCRETE);
	L("Allenfort tower cab", 2060, 190, LAND + 98, 38, 16, 38, GLASS, "Glass");
	L("Allenfort radome", 2200, 160, LAND + 22, 40, 40, 40, PALE, "SmoothPlastic", true, "ball");
	// Belta Port: city on the south-east slope of the northern lobe, levelled first.
	const bc = m01World(950, 420);
	eSlab(plan, "Air", bc.x, bc.z, 760, 360, LAND, 500, M01_YAW);
	eSlab(plan, "Grass", bc.x, bc.z, 760, 360, 0, LAND, M01_YAW);
	let k = 0;
	for (const s of [660, 800, 940, 1080, 1220]) for (const n of [300, 420, 540]) {
		const [nw, se] = m01HalfWidths(s);
		if (n > se - 70 || n < 260 || nw < 0) continue;
		const h = 30 + ((k * 37) % 5) * 16; k++;
		L("Belta Port block", s, n, LAND + h / 2, 90, h, 80, [112 + (k % 3) * 10, 116, 122]);
		L("Window ribbon", s, n - 41, LAND + h * 0.6, 70, 3, 1, [205, 190, 130], "Neon", false);
	}
	const [, seHarbor] = m01HalfWidths(900);
	L("Belta Port breakwater", 900, seHarbor + 150, SEA + 6, 26, 12, 300, CONCRETE);
	L("Belta Port breakwater", 1060, seHarbor + 290, SEA + 6, 300, 12, 26, CONCRETE);
	L("Belta Port pier", 1000, seHarbor + 60, SEA + 6, 40, 12, 140, CONCRETE);
	L("Belta Port light", 1210, seHarbor + 290, SEA + 30, 12, 36, 12, PALE, "Concrete", true, "cylinder");
	L("Belta Port lamp", 1210, seHarbor + 290, SEA + 52, 10, 10, 10, LAMP, "Neon", false, "ball");
	// Impact ruins on the crater's south-west shoulder (lore: the eastern-face city was devastated).
	for (let i = 0; i < 8; i++) {
		const s = -650 + (i % 4) * 70, n = 220 + math.floor(i / 4) * 110, h = 8 + (i * 7) % 18;
		L("Anderson Crater ruin", s, n, LAND + h / 2, 50, h, 40, [104, 102, 98], "Slate", false);
	}
	// Fort Grays (lparchive: Mobius takes off from this carrier) holding south of the island; decoration only.
	ePart(plan, "Fort Grays carrier hull", 700, SEA + 10, 3350, 60, 20, 260, [96, 104, 110], "Metal", false);
	ePart(plan, "Fort Grays flight deck", 700, SEA + 21, 3350, 70, 2, 270, [66, 70, 74], "Metal", false);
	ePart(plan, "Fort Grays island", 728, SEA + 40, 3380, 14, 36, 50, [110, 116, 120], "Metal", false);
	ePart(plan, "Fort Grays wake", 700, SEA + 0.6, 3550, 30, 0.4, 160, [236, 240, 240], "SmoothPlastic", false);
	// Bomber routes overfly the island: terrain stays well under the lowest bomber layer.
	for (const x of [-900, 0, 900]) for (let z = -1100; z <= 3200; z += 700) air(plan, "M01 bomber route", x, z, 900, 200);
}

// --- M02 Imminent Threat: Rigley Air Base -----------------------------------------------
function m02Build(plan: WorldPlan): void {
	plan.theme = "farm";
	// Patchwork farmland (Operation Harvest); thin top-layer repaints, airfield area left plain.
	const crops: TerrainMaterial[] = ["LeafyGrass", "Ground", "Grass", "Mud", "LeafyGrass", "Ground"];
	let f = 0;
	for (let x = -3400; x <= 3400; x += 680) for (let z = -3300; z <= 3300; z += 600) {
		if (x > -1900 && x < 1100 && z > -2400 && z < 200) continue;
		eSlab(plan, crops[f % crops.size()], x, z, 600, 520, LAND - 2, LAND);
		f += x < 0 ? 1 : 2;
	}
	// Low hills north of the field, beyond Ciffreo's A-10 station; a southern rise along the front.
	eTaperedRidge(plan, -1300, -3100, 1300, 420, 230, "Grass");
	eTaperedRidge(plan, 1700, -2900, 1100, 380, 200, "Grass");
	eTaperedRidge(plan, -2800, 600, 500, 700, 160, "Grass", LAND, math.pi / 2);
	eTaperedRidge(plan, 2600, 1700, 800, 340, 140, "Grass");
	const rw = M02_RUNWAY;
	ePart(plan, "Rigley runway", rw.x, LAND + 2, rw.z, rw.width, 4, rw.length, ASPHALT, "Asphalt");
	for (let i = -5; i <= 5; i++) ePart(plan, "Runway center stripe", rw.x, LAND + 4.2, rw.z + i * 100, 5, 0.3, 40, MARK, "SmoothPlastic", false);
	for (const e of [-1, 1]) ePart(plan, "Runway threshold bar", rw.x, LAND + 4.2, rw.z + e * (rw.length / 2 - 20), 90, 0.3, 8, MARK, "SmoothPlastic", false);
	// Dispersal aprons and taxiways linking the four Mitoro bomber clusters to the runway.
	const [ca, cb, cc, cd] = M02_CLUSTERS;
	ePart(plan, "Dispersal apron", ca.x, LAND + 0.4, ca.z, 330, 0.6, 330, [96, 98, 96], "Concrete", false);
	ePart(plan, "Dispersal apron", (cb.x + cc.x) / 2, LAND + 0.4, cb.z + 10, cc.x - cb.x + 380, 0.6, 300, [96, 98, 96], "Concrete", false);
	ePart(plan, "Dispersal apron", cd.x, LAND + 0.4, cd.z, 330, 0.6, 200, [96, 98, 96], "Concrete", false);
	eRibbon(plan, "Taxiway", ca.x + 160, ca.z, rw.x - rw.width / 2, ca.z, 34, LAND + 0.5, ASPHALT);
	eRibbon(plan, "Taxiway", rw.x + rw.width / 2, cd.z, cd.x - 150, cd.z, 34, LAND + 0.5, ASPHALT);
	eRibbon(plan, "Hangar row taxiway", -690, -1650, -690, -1030, 34, LAND + 0.5, ASPHALT);
	// Earth revetments outside the bomber pads (>=90 studs from any bomber centre).
	ePart(plan, "Bomber revetment", ca.x - 150, LAND + 6, ca.z, 14, 12, 300, EARTH, "Ground");
	ePart(plan, "Bomber revetment", ca.x, LAND + 6, ca.z - 160, 300, 12, 14, EARTH, "Ground");
	ePart(plan, "Bomber revetment", cd.x, LAND + 6, cd.z - 100, 280, 12, 14, EARTH, "Ground");
	// Perimeter road around the base and the farm road south to the substation.
	const per = [[-1650, -2050], [900, -2050], [900, -450], [-1650, -450], [-1650, -2050]];
	for (let i = 1; i < per.size(); i++) eRibbon(plan, "Perimeter road", per[i - 1][0], per[i - 1][1], per[i][0], per[i][1], 24, LAND + 0.4, [70, 72, 70]);
	eRibbon(plan, "Substation road", M02_SUBSTATION.x - 70, M02_SUBSTATION.z, -180, -450, 26, LAND + 0.4, [70, 72, 70]);
	// Substation yard (target from the roster) and the power line feeding the base: decoration only.
	const ss = M02_SUBSTATION;
	ePart(plan, "Substation yard", ss.x, LAND + 0.4, ss.z, 260, 0.6, 200, [120, 118, 110], "Concrete", false);
	for (const [dx, dz] of [[-95, -60], [-95, 60], [95, -60], [95, 60]]) ePart(plan, "Transformer bay", ss.x + dx, LAND + 7, ss.z + dz, 18, 14, 22, [90, 96, 92], "Metal", false);
	for (const dx of [-120, 120]) ePart(plan, "Substation fence", ss.x + dx, LAND + 4, ss.z, 2, 8, 200, STEEL, "Metal", false);
	let prev = EV(ss.x, LAND, ss.z - 110);
	for (let k = 1; k <= 5; k++) {
		const t = k / 5, x = ss.x + (-250 - ss.x) * t, z = ss.z - 110 + (-560 - (ss.z - 110)) * t;
		ePart(plan, "Power line pylon", x, LAND + 35, z, 6, 70, 6, STEEL, "Metal", false);
		ePart(plan, "Pylon crossarm", x, LAND + 66, z, 30, 3, 3, STEEL, "Metal", false, "block", earlyAxisYaw(z - prev.z, -(x - prev.x)));
		eRibbon(plan, "Power line", prev.x, prev.z, x, z, 2, LAND + 64, [40, 40, 40], "Metal");
		prev = EV(x, LAND, z);
	}
	// Frontline farm village on the southern approach (interpolation; the wiki places Rigley near the front).
	for (let i = 0; i < 6; i++) ePart(plan, "Farmhouse", 900 + (i % 3) * 90, LAND + 14, 900 + math.floor(i / 3) * 110, 50, 28, 66, [150 + i * 6, 132, 112]);
	for (let i = 0; i < 3; i++) ePart(plan, "Barn", 1250, LAND + 18, 860 + i * 120, 70, 36, 50, [128, 64, 52], "WoodPlanks");
	air(plan, "M02 southern approach", 0, 2200, 600, 250);
	air(plan, "M02 southern approach", 0, 600, 600, 250);
	air(plan, "M02 Ciffreo station", -450, -2130, 520, 250);
}

// --- M03 The Northern Eye: Mt. Shezna ---------------------------------------------------
function m03Plateau(plan: WorldPlan, chain: M03Chain, from: number, to: number, half: number, depth: number): void {
	const mid = (from + to) / 2, c = m03ChainPoint(chain, mid, 0), yaw = earlyAxisYaw(chain.ux, chain.uz), top = chain.center.y;
	// Summit ridge along the chain, then a levelled snow bench carrying the radars.
	eTaperedRidge(plan, c.x, c.z, (to - from) / 2 + 160, 430, depth, "Rock", top - depth, yaw, 2);
	eSlab(plan, "Snow", c.x, c.z, to - from, half * 2, top - 140, top, yaw);
}
function m03Build(plan: WorldPlan): void {
	plan.theme = "plateau";
	setColor(plan, "Snow", [226, 232, 236]);
	setColor(plan, "Rock", [96, 100, 106]);
	// Northern backdrop range and the saddle ridge between the two summits.
	eTaperedRidge(plan, 0, -3380, 3600, 420, 520, "Rock");
	eRidge(plan, 0, -3380, 1200, 180, 220, "Snow", LAND + 300);
	eTaperedRidge(plan, -300, -2350, 1300, 650, 360, "Rock");
	eRidge(plan, -300, -2350, 430, 120, 66, "Snow", LAND + 294);
	// Shezna summits: crossed tapered massifs with snow caps under each radar chain.
	eMassif(plan, M03_EAST.center.x, M03_EAST.center.z, 950, 950, 600, "Rock", "Snow", 420);
	eMassif(plan, M03_WEST.center.x, M03_WEST.center.z, 1050, 1050, 790, "Rock", "Snow", 520);
	m03Plateau(plan, M03_EAST, -480, 500, 185, 300);
	m03Plateau(plan, M03_WEST, -400, 400, 150, 320);
	// Grass foothills falling to the southern return descent (kept north of z = -250).
	eTaperedRidge(plan, 1900, -650, 600, 380, 200, "Grass");
	eTaperedRidge(plan, -2000, -900, 700, 420, 240, "Grass");
	eTaperedRidge(plan, -650, -1350, 500, 350, 180, "Grass");
	// Radar station dressing: barracks at the bench ends, CH-47 helipad on the west summit.
	for (const [chain, along, across] of [[M03_EAST, -420, 90], [M03_EAST, -420, -90], [M03_WEST, 330, 0]] as Array<[M03Chain, number, number]>) {
		const p = m03ChainPoint(chain, along, across);
		ePart(plan, "Radar station barracks", p.x, chain.center.y + 14, p.z, 60, 28, 34, [150, 146, 136], "Concrete", true, "block", earlyAxisYaw(chain.ux, chain.uz));
	}
	const pad = m03ChainPoint(M03_WEST, -330, 0);
	ePart(plan, "Shezna helipad", pad.x, M03_WEST.center.y + 0.4, pad.z, 70, 0.6, 70, [70, 74, 72], "Concrete", false, "cylinder");
	ePart(plan, "Helipad marking", pad.x, M03_WEST.center.y + 0.8, pad.z, 30, 0.3, 6, MARK, "SmoothPlastic", false);
	for (const chain of [M03_EAST, M03_WEST]) {
		const m = m03ChainPoint(chain, 0, chain === M03_EAST ? -170 : 120);
		ePart(plan, "Shezna relay mast", m.x, chain.center.y + 45, m.z, 4, 90, 4, STEEL, "Metal", false);
	}
	// St. Ark evacuation lies south: the return descent stays open below the old ceiling.
	for (const x of [-2400, -800, 800, 2400]) for (const z of [0, 1600, 3000]) air(plan, "M03 southern return", x, z, 380, 250);
	air(plan, "M03 inter-summit pass", -300, -1450, 520, 250);
}

// --- M04 Blockade: Erusean coast and wind farms --------------------------------------
/** Coastline running SSW->NNE (sea to the east, Comberth beyond the north-east, interpolation). */
export function m04CoastX(z: number): number { return -600 + 0.55 * z + 220 * math.sin(z / 650); }
function m04Build(plan: WorldPlan): void {
	plan.theme = "coast";
	coastWest(plan, m04CoastX, 90, "Grass");
	// Straight-line coast direction (the sine wiggle is ignored for inland offsets).
	const len = math.sqrt(1 + 0.55 * 0.55), dirx = 0.55 / len, dirz = 1 / len, yaw = earlyAxisYaw(dirx, dirz);
	const inland = (z: number, off: number) => EV(-600 + 0.55 * z - dirz * off, LAND, z + dirx * off);
	// Rolling inland downs parallel to the coast.
	for (const r of [[-2900, -1500, 900, 420, 240], [-2500, 900, 900, 420, 220], [-3200, 2700, 600, 380, 200], [-3100, -3000, 700, 360, 180]]) eTaperedRidge(plan, r[0], r[1], r[2], r[3], r[4], "Grass", LAND, yaw);
	// Two wind farms on the coastal plain, rotors facing the sea breeze.
	// Rotor plane faces the sea: blade-thin local Z points inland, hub on the seaward side.
	const face = math.atan2(-dirz, dirx);
	for (let z = -2400; z <= 2600; z += 420) { const p = inland(z, 650); windTurbine(plan, p.x, p.z, face); }
	for (let z = -1200; z <= 1800; z += 500) { const p = inland(z, 1000); windTurbine(plan, p.x, p.z, face, 130); }
	// Coastal highway, headland lighthouse and scattered farms.
	let prev = inland(-3800, 300);
	for (let z = -3000; z <= 3800; z += 800) { const following = inland(z, 300); eRibbon(plan, "Coastal highway", prev.x, prev.z, following.x, following.z, 30, LAND + 0.4, ASPHALT); prev = following; }
	const lz = 650 * math.pi / 2, lx = m04CoastX(lz) - 70;
	ePart(plan, "Headland lighthouse", lx, LAND + 45, lz, 20, 90, 20, PALE, "Concrete", true, "cylinder");
	ePart(plan, "Lighthouse lamp", lx, LAND + 96, lz, 16, 16, 16, LAMP, "Neon", false, "ball");
	for (const [z, off] of [[-1800, 1350], [-400, 1500], [700, 1350], [2100, 1500]]) {
		const p = inland(z, off);
		for (let i = 0; i < 3; i++) ePart(plan, "Farmhouse", p.x + i * 70, LAND + 14, p.z + (i % 2) * 60, 46, 28, 60, [150 + i * 8, 132, 112]);
	}
	// Transports and jammers stay far above the downs.
	for (const x of [-2700, -1450, 0, 1450, 2700]) for (const z of [-250, 1250, 2750]) air(plan, "M04 transport corridor", x, z, 900, 250);
}

// --- M05 Lifeline: coastal refinery and offshore field --------------------------------
/** Refinery coast (sea to the east). Clear of the production tank grid (x <= -1840 incl. pads). */
export function m05CoastX(z: number): number { return -1250 + 160 * math.sin(z / 520) + (z > -700 && z < 100 ? 90 : 0); }
function m05Build(plan: WorldPlan): void {
	plan.theme = "coast";
	coastWest(plan, m05CoastX, 80, "Ground");
	// Low coastal hills well west of the industrial plain.
	eTaperedRidge(plan, -3350, -1300, 420, 1500, 220, "Grass", LAND, math.pi / 2);
	eTaperedRidge(plan, -3000, 1400, 500, 900, 180, "Grass", LAND, math.pi / 2);
	// Tank-farm apron and bund walls around the production grid (x -2300..-1900, z -1650..-950).
	ePart(plan, "Refinery apron", -2100, LAND + 0.3, -1300, 600, 0.6, 860, [104, 106, 104], "Concrete", false);
	for (const [x, z, sx, sz] of [[-2370, -1300, 6, 860], [-1830, -1300, 6, 860], [-2100, -1730, 546, 6], [-2100, -870, 546, 6]]) ePart(plan, "Tank farm bund wall", x, LAND + 5, z, sx, 10, sz, CONCRETE);
	// Process unit west of the tank farm: distillation columns with access rings, heaters, pipe rack.
	const columns = [[-2620, -1460, 150], [-2560, -1420, 120], [-2620, -1340, 170], [-2560, -1280, 110], [-2620, -1180, 140]];
	for (const [x, z, h] of columns) {
		ePart(plan, "Distillation column", x, LAND + h / 2, z, 16, h, 16, [176, 180, 182], "Metal", true, "cylinder");
		for (const r of [0.4, 0.75]) ePart(plan, "Column access ring", x, LAND + h * r, z, 26, 2, 26, STEEL, "Metal", false, "cylinder");
	}
	for (const z of [-1500, -1120]) ePart(plan, "Process heater", -2500, LAND + 16, z, 50, 32, 40, RUST, "CorrodedMetal");
	ePart(plan, "Process pipe rack", -2460, LAND + 14, -1300, 10, 4, 520, STEEL, "Metal", false);
	const jx = m05CoastX(-300), rack = [[-1830, -900], [-1600, -900], [jx - 20, -300]];
	for (let i = 1; i < rack.size(); i++) {
		const [ax, az] = rack[i - 1], [bx, bz] = rack[i], dx = bx - ax, dz = bz - az;
		ePart(plan, "Export pipe rack", (ax + bx) / 2, LAND + 12, (az + bz) / 2, math.sqrt(dx * dx + dz * dz), 4, 10, STEEL, "Metal", false, "block", earlyAxisYaw(dx, dz));
	}
	eRibbon(plan, "Refinery road", -2420, -1760, -1700, -1760, 26, LAND + 0.4, ASPHALT);
	eRibbon(plan, "Refinery road", -1700, -1760, -1700, -300, 26, LAND + 0.4, ASPHALT);
	// Flare stack on the shore (decor; distinct from SMOKESTACK targets).
	const fx = m05CoastX(-2000) - 120;
	ePart(plan, "Flare stack", fx, LAND + 80, -2000, 10, 160, 10, [150, 150, 146], "Metal", true, "cylinder");
	ePart(plan, "Flare flame", fx, LAND + 168, -2000, 16, 16, 16, FLAME, "Neon", false, "ball");
	// Export jetty and loading head (no hull: tankers in the roster are the only ships).
	ePart(plan, "Export jetty trestle", jx + 260, SEA + 10, -300, 520, 6, 26, CONCRETE);
	for (let k = 0; k < 5; k++) ePart(plan, "Jetty pile", jx + 60 + k * 100, SEA / 2 + 5, -300, 8, SEA + 6, 8, CONCRETE, "Concrete", true, "cylinder");
	ePart(plan, "Jetty loading head", jx + 540, SEA + 12, -300, 70, 10, 110, CONCRETE);
	for (const dz of [-30, 30]) ePart(plan, "Loading arm", jx + 560, SEA + 30, -300 + dz, 4, 30, 4, [200, 170, 60], "Metal", false);
	for (const dz of [-90, 90]) ePart(plan, "Mooring dolphin", jx + 560, SEA + 4, -300 + dz, 18, 12, 18, CONCRETE, "Concrete", true, "cylinder");
	// Offshore field: one jacketed main deck exactly under the production rig grid (top = rigs site y).
	const d = M05_DECK, top = M05_DECK_TOP;
	ePart(plan, "Rig main deck", d.x, top - 10, d.z, d.sx, 20, d.sz, STEEL, "Metal");
	ePart(plan, "Rig cellar deck", d.x, top - 42, d.z, d.sx - 40, 8, d.sz - 40, [70, 78, 86], "Metal");
	for (const dx of [-240, -80, 80, 240]) for (const dz of [-400, -200, 0, 200, 400]) ePart(plan, "Rig jacket leg", d.x + dx, (top - 46) / 2, d.z + dz, 22, top - 46, 22, [150, 120, 70], "Metal", true, "cylinder");
	for (const dz of [-450, 450]) ePart(plan, "Rig deck railing", d.x, top + 3, d.z + dz, d.sx, 6, 2, [210, 180, 60], "Metal", false);
	for (const dx of [-280, 280]) ePart(plan, "Rig deck railing", d.x + dx, top + 3, d.z, 2, 6, d.sz, [210, 180, 60], "Metal", false);
	ePart(plan, "Rig helideck", d.x + d.sx / 2 + 50, top + 10, d.z - 380, 80, 4, 80, [60, 70, 64], "Metal", true, "cylinder");
	ePart(plan, "Helideck marking", d.x + d.sx / 2 + 50, top + 12.3, d.z - 380, 34, 0.3, 6, MARK, "SmoothPlastic", false);
	ePart(plan, "Helideck support", d.x + d.sx / 2 + 30, top - 10, d.z - 380, 40, 6, 30, STEEL, "Metal");
	ePart(plan, "Rig flare boom", d.x + d.sx / 2 + 90, top + 30, d.z + 300, 180, 5, 5, STEEL, "Metal", false);
	ePart(plan, "Rig flare flame", d.x + d.sx / 2 + 184, top + 30, d.z + 300, 14, 14, 14, FLAME, "Neon", false, "ball");
	// Satellite wellhead platforms around the main deck (Mitoro shows outlying clusters, incl. north-east), bridge-linked.
	const sats = [[1700, -2250], [2520, -2380], [1620, -450], [2560, -560]];
	for (const [x, z] of sats) {
		ePart(plan, "Wellhead platform deck", x, top - 14, z, 170, 12, 170, STEEL, "Metal");
		for (const dx of [-60, 60]) for (const dz of [-60, 60]) ePart(plan, "Wellhead jacket leg", x + dx, (top - 20) / 2, z + dz, 16, top - 20, 16, [150, 120, 70], "Metal", true, "cylinder");
		ePart(plan, "Wellhead module", x, top + 6, z, 60, 28, 50, [180, 176, 160], "Metal");
		ePart(plan, "Wellhead navigation light", x + 75, top + 4, z + 75, 6, 6, 6, [255, 80, 60], "Neon", false, "ball");
		const ex = math.clamp(x, d.x - d.sx / 2, d.x + d.sx / 2), ez = math.clamp(z, d.z - d.sz / 2, d.z + d.sz / 2);
		const dx = ex - x, dz = ez - z, len = math.sqrt(dx * dx + dz * dz);
		if (len > 100) ePart(plan, "Platform bridge", (x + ex) / 2, top - 8, (z + ez) / 2, len - 90, 4, 12, [140, 146, 150], "Metal", true, "block", earlyAxisYaw(dx, dz));
	}
	for (const z of [-1800, -400, 900]) air(plan, "M05 patrol altitude", 0, z, 900, 300);
	air(plan, "M05 rig relocation", 2100, -1300, 560, 120);
}

/**
 * Runs after base geometry and BEFORE AC04WorldData's per-target pad/air/berth
 * clearance. Resets the mission to its full-map base layers, then authors the
 * refined world. Out-of-range missions untouched; idempotent on the same plan.
 */
export function refineEarlyWorld(mission: AC04Mission, _layout: AC04Layout, plan: WorldPlan): void {
	if (!earlyInRange(mission.id)) return;
	earlyResetToBase(plan);
	if (mission.id === 1) m01Build(plan);
	else if (mission.id === 2) m02Build(plan);
	else if (mission.id === 3) m03Build(plan);
	else if (mission.id === 4) m04Build(plan);
	else m05Build(plan);
}
