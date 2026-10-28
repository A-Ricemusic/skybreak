import type { Rgb } from "../../EnvironmentPresets";
import type { WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";
import { LateV, lateBlock, latePart } from "./LateGeometry";

/**
 * M18 Megalith fortress, adapted from the inspected Mitoro structure/route
 * diagrams and the archived Shotgunnova Normal diagram:
 *   - a low east-west exhaust duct across the north ("bar"), open at both ends,
 *     with two roof "windows" to climb out of the low level;
 *   - two long high north-south arms (west/east) crossing OVER the duct, open
 *     at both ends, each carrying three zero-point launch ports on its roof;
 *   - a shorter high central tube between the arms, entered from a south
 *     forecourt and sealed by the runtime-owned AC04CoreGate until the update;
 *   - the core at the tube's north end beneath a vertical exit shaft;
 *   - four secondary missiles standing in deck silos over the duct.
 * Generators: west arm south of the duct, duct centre beneath the tube, east
 * arm north of the duct (source: west arm / bar centre / east arm-bar).
 * Proportions are widened for Roblox flight (cruise 160 studs/s, pull-up
 * radius ~128): every tunnel is 360 wide and 260-290 tall. Not a survey trace.
 */
export const LateMegalithSpec = {
	floor: 90, barRoof: 350, highFloor: 390, highRoof: 680, deck: 720,
	xMin: -1750, xMax: 1750, north: -1500, south: 1650,
	bar: { zMin: -1180, zMax: -820 },
	arms: [{ label: "west", xMin: -900, xMax: -540 }, { label: "east", xMin: 540, xMax: 900 }],
	tube: { xMin: -180, xMax: 180, zMin: -1450, zMax: 450 },
	shaft: { xMin: -180, xMax: 180, zMin: -1450, zMax: -850 },
	wells: [{ xMin: -1650, xMax: -1350 }, { xMin: 1350, xMax: 1650 }],
	gate: { x: 0, y: 535, z: 250, sx: 356, sy: 286, sz: 26 },
	hatchName: "AC04LateSiloHatch",
};

/** Mission sites derived from the fortress spec (consumed by the layout refinement). */
export function lateMegalithSites(): { [name: string]: FlightPoint } {
	const s = LateMegalithSpec, armY = (s.highFloor + s.highRoof) / 2, ductY = (s.floor + s.barRoof) / 2;
	return {
		fortress: LateV(0, 64, 0),
		"generator-west": LateV(-720, s.highFloor + 50, -640),
		"generator-east": LateV(720, s.highFloor + 50, -1300),
		"generator-north": LateV(0, s.floor + 50, -1000),
		core: LateV(0, s.highFloor + 130, -1300),
		silos: LateV(0, s.deck + 80, -1000),
		"tunnel-west": LateV(-720, armY, s.south),
		"tunnel-east": LateV(720, armY, s.south),
		"tunnel-north": LateV(s.xMax, ductY, -1000),
		"tunnel-center": LateV(0, armY, s.tube.zMax),
		"duct-west-mouth": LateV(s.xMin, ductY, -1000),
		"arm-west-north-mouth": LateV(-720, armY, s.north),
		"arm-east-north-mouth": LateV(720, armY, s.north),
		escape: LateV(0, s.deck + 40, -1150),
	};
}
/** Square escape detector half-size used by the runtime (|dx|,|dz| < radius). Covers the whole shaft mouth. */
export const LATE_MEGALITH_ESCAPE_RADIUS = 300;

export function lateMegalithPortPosition(index: number): FlightPoint {
	const west = index % 2 === 0, slot = math.floor(index / 2);
	return LateV(west ? -720 : 720, LateMegalithSpec.deck, 250 + slot * 550);
}
export function lateMegalithSecondaryPosition(index: number): FlightPoint {
	const xs = [-1150, -360, 360, 1150];
	return LateV(xs[math.min(index, 3)], LateMegalithSpec.deck + 80, -1000);
}

const HULL: Rgb = [86, 94, 99], DECK: Rgb = [104, 110, 112], DARK: Rgb = [45, 50, 56], LIGHT: Rgb = [110, 222, 235], WARN: Rgb = [220, 140, 52];

function mass(plan: WorldPlan, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color = HULL): void {
	latePart(plan, name, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, "Concrete", true);
}

/**
 * Replaces the base cross-corridor fortress. `hatch` adds a closed silo hatch
 * over the exit shaft; it must ONLY be enabled once the runtime opens it on
 * core destruction (see LateRuntime), otherwise the escape is impossible.
 */
export function lateBuildMegalith(plan: WorldPlan, hatch: boolean): number {
	const s = LateMegalithSpec, before = plan.parts.size();
	// Wider rock island under the whole fortress footprint, top at the floor.
	lateBlock(plan, "Rock", 0, s.floor - 30, 0, 4300, 60, 4100);
	// LOW level (floor..highFloor): solid except the duct void and the wells.
	for (const [x0, x1] of [[s.xMin, 0], [0, s.xMax]]) {
		mass(plan, "Megalith foundation", x0, x1, s.floor, s.highFloor, s.bar.zMax, 415);
		mass(plan, "Megalith foundation", x0, x1, s.floor, s.highFloor, 415, s.south);
		mass(plan, "Megalith foundation", x0, x1, s.floor, s.highFloor, s.north, s.bar.zMin);
	}
	for (const [x0, x1] of [[s.xMin, s.wells[0].xMin], [s.wells[0].xMax, 0], [0, s.wells[1].xMin], [s.wells[1].xMax, s.xMax]])
		mass(plan, "Exhaust duct roof", x0, x1, s.barRoof, s.highFloor, s.bar.zMin, s.bar.zMax, DARK);
	// HIGH level (highFloor..deck): outer blocks (with the wells cut out), the
	// two walls between arms and tube, the tube's north cap and the roofs.
	for (const side of [-1, 1]) {
		const outerA = side < 0 ? s.xMin : s.arms[1].xMax, outerB = side < 0 ? s.arms[0].xMin : s.xMax;
		const well = side < 0 ? s.wells[0] : s.wells[1];
		mass(plan, "Megalith outer block", outerA, outerB, s.highFloor, s.deck, s.north, s.bar.zMin);
		mass(plan, "Megalith outer block", outerA, well.xMin, s.highFloor, s.deck, s.bar.zMin, s.bar.zMax);
		mass(plan, "Megalith outer block", well.xMax, outerB, s.highFloor, s.deck, s.bar.zMin, s.bar.zMax);
		mass(plan, "Megalith outer block", outerA, outerB, s.highFloor, s.deck, s.bar.zMax, 415);
		mass(plan, "Megalith outer block", outerA, outerB, s.highFloor, s.deck, 415, s.south);
		const innerA = side < 0 ? s.arms[0].xMax : s.tube.xMax, innerB = side < 0 ? s.tube.xMin : s.arms[1].xMin;
		mass(plan, "Megalith inner wall", innerA, innerB, s.highFloor, s.deck, s.north, 75);
		mass(plan, "Megalith inner wall", innerA, innerB, s.highFloor, s.deck, 75, s.south);
		const arm = side < 0 ? s.arms[0] : s.arms[1];
		mass(plan, "Megalith arm roof", arm.xMin, arm.xMax, s.highRoof, s.deck, s.north, 75, DECK);
		mass(plan, "Megalith arm roof", arm.xMin, arm.xMax, s.highRoof, s.deck, 75, s.south, DECK);
	}
	mass(plan, "Central tube north cap", s.tube.xMin, s.tube.xMax, s.highFloor, s.deck, s.north, s.tube.zMin);
	mass(plan, "Central tube roof", s.tube.xMin, s.tube.xMax, s.highRoof, s.deck, s.shaft.zMax, s.tube.zMax, DECK);
	// The runtime opens the first descendant named AC04CoreGate at the update.
	const g = s.gate;
	latePart(plan, "AC04CoreGate", g.x, g.y, g.z, g.sx, g.sy, g.sz, [111, 122, 133], "Metal", true);
	latePart(plan, "Core gate warning band", g.x, g.y, g.z + 14, g.sx - 20, 10, 1, WARN, "Neon", false);
	if (hatch) latePart(plan, s.hatchName, 0, s.deck - 20, (s.shaft.zMin + s.shaft.zMax) / 2, s.shaft.xMax - s.shaft.xMin, 40, s.shaft.zMax - s.shaft.zMin, DARK, "Metal", true);
	// Silo rims around the four deck missiles (low, outside each 30-stud body).
	for (let i = 0; i < 4; i++) {
		const m = lateMegalithSecondaryPosition(i);
		for (const [dx, dz, sx, sz] of [[-52, 0, 14, 118], [52, 0, 14, 118], [0, -52, 90, 14], [0, 52, 90, 14]])
			latePart(plan, "Secondary silo rim", m.x + dx, s.deck + 12, m.z + dz, sx, 24, sz, DARK, "Metal", true);
	}
	// Shaft crown: a low parapet ringing the exit (outside the shaft opening).
	for (const x of [s.shaft.xMin - 30, s.shaft.xMax + 30])
		latePart(plan, "Exit shaft crown", x, s.deck + 25, (s.shaft.zMin + s.shaft.zMax) / 2 + 20, 60, 50, s.shaft.zMax - s.shaft.zMin + 60, DARK, "Metal", true);
	latePart(plan, "Exit shaft beacon", 0, s.deck + 52, s.shaft.zMin - 30, 120, 4, 6, LIGHT, "Neon", false);
	// Portal frames and interior guide lights (non-solid, readable at speed).
	const armY = (s.highFloor + s.highRoof) / 2;
	for (const arm of s.arms) {
		const x = (arm.xMin + arm.xMax) / 2;
		for (const z of [s.south + 2, s.north - 2]) {
			latePart(plan, "Tunnel portal light", x, s.highRoof - 6, z, arm.xMax - arm.xMin, 6, 2, LIGHT, "Neon", false);
			latePart(plan, "Tunnel portal light", x, s.highFloor + 4, z, arm.xMax - arm.xMin, 4, 2, WARN, "Neon", false);
		}
		for (let k = 0; k < 6; k++) {
			const z = s.south - 250 - k * 520;
			for (const wx of [arm.xMin + 1, arm.xMax - 1]) latePart(plan, "Tunnel guide light", wx, armY + 60, z, 1, 6, 160, LIGHT, "Neon", false);
		}
	}
	for (const x of [s.xMin - 2, s.xMax + 2]) {
		latePart(plan, "Duct portal light", x, s.barRoof - 6, -1000, 2, 6, s.bar.zMax - s.bar.zMin, LIGHT, "Neon", false);
		latePart(plan, "Duct portal light", x, s.floor + 4, -1000, 2, 4, s.bar.zMax - s.bar.zMin, WARN, "Neon", false);
	}
	for (let k = 0; k < 6; k++) {
		const x = s.xMin + 300 + k * 580;
		for (const wz of [s.bar.zMin + 1, s.bar.zMax - 1]) latePart(plan, "Duct guide light", x, s.floor + 170, wz, 160, 6, 1, LIGHT, "Neon", false);
	}
	latePart(plan, "Central tube portal light", 0, s.highRoof - 6, s.tube.zMax + 2, 360, 6, 2, WARN, "Neon", false);
	for (const wx of [s.tube.xMin + 1, s.tube.xMax - 1]) latePart(plan, "Central tube guide light", wx, armY + 60, -300, 1, 6, 1100, WARN, "Neon", false);
	// Deck superstructure: launch rails along the arms and laser emitters (decoration).
	for (const arm of s.arms) {
		const x = (arm.xMin + arm.xMax) / 2;
		latePart(plan, "Arm launch rail", x - 150, s.deck + 6, 750, 10, 12, 1700, DARK, "Metal", false);
		latePart(plan, "Arm launch rail", x + 150, s.deck + 6, 750, 10, 12, 1700, DARK, "Metal", false);
	}
	for (const [x, z] of [[-1500, 600], [1500, 600], [-1300, -1350], [1300, -1350]]) {
		latePart(plan, "Laser emitter mast", x, s.deck + 60, z, 26, 120, 26, DARK, "Metal", true, "cylinder");
		latePart(plan, "Laser emitter lens", x, s.deck + 126, z, 30, 12, 30, [220, 70, 60], "Neon", false, "cylinder");
	}
	// Island sea walls: north face only, plus east/west walls broken at the
	// duct mouths, all below the duct floor clearance used by the approach tests.
	for (let k = 0; k < 3; k++) latePart(plan, "Megalith sea wall", -1400 + k * 1400, 120, -2020, 1400, 60, 60, [120, 124, 120], "Concrete", true);
	for (const x of [-2120, 2120]) for (const [z0, z1] of [[-1950, -1500], [-500, 725], [725, 1950]])
		latePart(plan, "Megalith sea wall", x, 120, (z0 + z1) / 2, 60, 60, z1 - z0, [120, 124, 120], "Concrete", true);
	return plan.parts.size() - before;
}

/** Session-owned continuous shaft traversal. Leaving the shaft discards the
 * approach: a remembered visit cannot turn a lateral flyback into an escape.
 * Bounds are the actual rectangular shaft, not the larger navigation marker.
 */
export interface LateEscapeTracker { previous?: FlightPoint; ascending?: boolean }
export function lateMegalithEscapeUpdate(tracker: LateEscapeTracker, escape: FlightPoint, _radius: number, x: number, y: number, z: number, _now: number): boolean {
	const s = LateMegalithSpec;
	const inside = (p: FlightPoint) => p.x > s.shaft.xMin && p.x < s.shaft.xMax && p.z > s.shaft.zMin && p.z < s.shaft.zMax && p.y >= s.highFloor;
	const current = { x, y, z }, previous = tracker.previous;
	tracker.previous = current;
	if (!inside(current)) { tracker.ascending = false; return false; }
	if (y < s.deck) tracker.ascending = true;
	const crossed = tracker.ascending === true && previous !== undefined && inside(previous) && previous.y < escape.y && y >= escape.y && y > previous.y;
	if (crossed) tracker.ascending = false;
	return crossed;
}
