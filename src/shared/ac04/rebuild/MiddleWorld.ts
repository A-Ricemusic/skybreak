import type { AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { Rgb } from "../../EnvironmentPresets";
import type { WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";
import { middleDeckHull } from "./MiddleCampaign";
import {
	M06_CELL, M06_LAND, M06_ORIGIN, M07_CELL, M07_N, M07_ORIGIN, M07_PLATEAU_TOP, M09_BEACH_X, M12_CENTER_Z, M12_GUN_ANGLES, M12_RADIUS, M12_RUINED_ANGLE,
	MIDDLE_LAND, MIDDLE_SEA, MV, mBlock, mChannel, mCylinder, middleAxisYaw, middleResetToBase, middleToWorld, m07CellCenter, m07Ravine, m09CoastZ, mPart, mRibbon, mRidge, mRiver,
} from "./MiddleGeography";

/**
 * Middle-campaign (M6-M12) layout, world and unit-placement refinements.
 * Type-only imports from the shared planners; the root wires these hooks into
 * AC04WorldData (see docs/reviews/ac04-middle-rebuild.json for exact call sites).
 * Every coordinate is an adaptation of Mitoro (Ace) topology at the project's
 * 13-studs-per-pixel convention, not a survey of the original maps.
 */
const LAND = MIDDLE_LAND, SEA = MIDDLE_SEA, TOP = M07_PLATEAU_TOP;
const CONCRETE: Rgb = [132, 142, 145], ASPHALT: Rgb = [46, 50, 54], STEEL: Rgb = [88, 101, 113], MARK: Rgb = [214, 216, 204], PALE: Rgb = [196, 198, 192], OLIVE: Rgb = [86, 98, 74], RUST: Rgb = [104, 84, 68];

// --- layouts ------------------------------------------------------------------
interface LayoutPatch { sites: { [name: string]: FlightPoint }; spawn?: FlightPoint; returnZ?: number }
const LAYOUTS: { [id: number]: LayoutPatch } = {
	6: { spawn: MV(-700, 950, 3300), returnZ: 3350, sites: {
		harbor: MV(-1650, SEA, 980), "new-harbor": MV(380, SEA, -1350), shipyard: MV(1350, SEA, -100), fleet: MV(100, SEA, 2550), "east-shore": MV(440, LAND, 700),
		"fleet-air": MV(300, 1000, 2200), "fleet-reinforce": MV(950, 1050, 2700), "harbor-air": MV(-1900, 1000, 900), "shipyard-air": MV(1300, 1000, -500),
		"shipyard-reinforce": MV(1200, 1000, 350), "new-harbor-air": MV(350, 1050, -1500), "geofon-deck": MV(200, 180, 2680), bridge: MV(-950, LAND, 1730),
	} },
	7: { returnZ: 3250, sites: { plant: MV(-500, TOP, -1500), "solar-field": MV(40, TOP, -1950), ravine: MV(-280, 640, 700), north: MV(0, 950, -2700), intercept: MV(0, 950, -600) } },
	8: { spawn: MV(440, 1200, 30), returnZ: 1050, sites: {
		launch: MV(100, LAND, -150), island: MV(0, LAND, -300), "second-island": MV(1900, LAND, -410), west: MV(-3300, 1300, -300),
		headon: MV(260, 1100, -1050), "island-west": MV(-480, 1050, 80), "awacs-escort": MV(-300, 1350, -700), awacs: MV(-300, 1500, -700), "island-air": MV(60, 1050, -250),
		"wave-west": MV(-1900, 1100, -300), "wave-north": MV(0, 1150, -2100), "wave-southwest": MV(-1400, 1000, 800), "yellow-island": MV(-60, 1700, -520), "sr71-start": MV(440, 3400, 30),
	} },
	9: { spawn: MV(0, 1100, 2700), returnZ: 3150, sites: {
		"beach-west": MV(M09_BEACH_X.west, LAND, 1200), "beach-center": MV(M09_BEACH_X.center, LAND, 270), "beach-east": MV(M09_BEACH_X.east, LAND, 180), beaches: MV(M09_BEACH_X.center, LAND, 270),
		"caranda-air": MV(2700, 1000, -400), "crowne-air": MV(250, 1050, -700), "halle-air": MV(-2800, 1000, 200), "beach-helos": MV(250, 420, 100), "a10-entry": MV(-550, 800, -1900),
	} },
	10: { spawn: MV(0, 1100, 3350), returnZ: 3100, sites: {
		airbase: MV(650, LAND, 1950), vtol: MV(1750, 300, -400), "sub-base": MV(-800, SEA, -1850), resupply: MV(-2050, LAND, 450), fortress: MV(0, LAND, 0),
		"sub-air": MV(-800, 1000, -2250), "airbase-air": MV(650, 900, 1700), "center-air": MV(200, 900, -300), "vtol-air": MV(1750, 700, -400),
	} },
	11: { returnZ: 3380, sites: { "airliner-low": MV(-2450, 1200, -1180), "airliner-high": MV(-2330, 2600, -1290) } },
	12: { sites: { "runway-ne": MV(1150, LAND, -1500), "nw-patrol": MV(-1300, 1000, -2100), "se-patrol": MV(1600, 1000, 1100), "yellow-north": MV(-300, 1800, -3300) } },
};
/** Applied once when layouts are constructed. Pure; idempotent; out-of-range ids unchanged. */
export function refineMiddleLayout(id: number, layout: AC04Layout): AC04Layout {
	const patch = LAYOUTS[id];
	if (patch === undefined) return layout;
	return { ...layout, sites: { ...layout.sites, ...patch.sites }, spawn: patch.spawn ?? layout.spawn, returnZ: patch.returnZ ?? layout.returnZ };
}

// --- unit placement ---------------------------------------------------------------
const M06_HULLS: { [id: string]: FlightPoint[] } = {
	"missile-boats": [MV(40, SEA, 2050), MV(30, SEA, 2620)], raven: [MV(180, SEA, 2330)], geofon: [MV(200, SEA, 2680)], tanager: [MV(100, SEA, 2980)],
	"cruiser-beluga": [MV(-1650, SEA, 420)], "cruiser-fenris": [MV(-1830, SEA, 700)], "cruiser-kolga": [MV(-1830, SEA, 1040)], "cruiser-lazuli": [MV(-1650, SEA, 1330)],
	"beowulf-nu": [MV(-1560, SEA, 1580)], "beowulf-pi": [MV(-2050, SEA, 860)],
	"container-ships": [MV(60, SEA, -1620), MV(720, SEA, -1500)], supply: [MV(720, SEA, -1150)],
	"destroyer-herne": [MV(950, SEA, -360)], "destroyer-taisch": [MV(1180, SEA, -360)], "destroyer-thiassi": [MV(1410, SEA, -360)],
	"landing-ships": [MV(1640, SEA, -360), MV(1800, SEA, 430)], "submarines-shipyard": [MV(1100, SEA, 430), MV(1330, SEA, 430), MV(1560, SEA, 430)],
	"submarines-east": [MV(760, SEA, 600), MV(760, SEA, 950)],
};
/** Deck weapons: hull list per deck site and fore/aft offsets (hulls are placed yaw 0, length along Z). */
const M06_DECKS: { [hull: string]: string[] } = { raven: ["raven", "raven"], tanager: ["tanager", "tanager", "tanager"], cruisers: ["cruiser-beluga", "cruiser-fenris", "cruiser-kolga", "cruiser-lazuli"], "herne-taisch": ["destroyer-herne", "destroyer-taisch"] };
/** Exact component-to-host identity, shared by placement and authoritative AI.
 * Host destruction does not award or destroy its separately scored components.
 */
export function middleDeckHost(group: AC04UnitGroup, index: number): string | undefined {
	const hull = middleDeckHull(group);
	return hull !== undefined ? M06_DECKS[hull]?.[index] : undefined;
}
export function middleHullHasComponents(mission: AC04Mission, hullId: string): boolean {
	return mission.id === 6 && mission.roster.some((g) => {
		for (let i = 0; i < g.count; i++) if (middleDeckHost(g, i) === hullId) return true;
		return false;
	});
}
const M06_DECK_DZ: { [group: string]: number[] } = { "raven-sam": [-55, 60], "tanager-gun": [-70, -32, 65], "cruiser-sam": [-55, -55, -55, -55], "cruiser-aa": [60, 60, 60, 60], "destroyer-aa": [-55, -55] };
/** Deck top of AC04World's native hull (centre SEA+12, hull 24, deck slab to +32). */
export const MIDDLE_DECK_Y = SEA + 32;
const xz = (pts: number[][], y = LAND): FlightPoint[] => pts.map((p) => MV(p[0], y, p[1]));
const M06_GROUND: { [id: string]: FlightPoint[] } = {
	"comberth-containers": xz([[-1220, 600], [-1090, 600], [-1220, 730], [-1090, 730], [-1220, 860], [-1090, 860]]),
	"comberth-cranes": xz([[-1380, 730], [-1500, 900], [-1380, 1060]]), "comberth-storage": xz([[-1220, 1000], [-1090, 1000]]),
	"comberth-aa": xz([[-1350, 1200], [-1180, 1330]]), "comberth-sam": xz([[-1050, 1200]]),
	"newcomberth-containers": xz([[300, -1380], [450, -1380]]), "newcomberth-storage": xz([[300, -1240], [450, -1240], [300, -1000]]),
	"newcomberth-fuel": xz([[455, -1700], [455, -1570], [150, -1000]]), "newcomberth-aa": xz([[450, -1000]]), "newcomberth-sam": xz([[300, -860]]),
	"shipyard-cranes": xz([[1100, 0], [1300, 0], [1500, 0], [1700, 0]]), "shipyard-storage": xz([[1200, 150]]), "shipyard-aa": xz([[1400, 150]]), "shipyard-sam": xz([[1600, 150]]),
	"east-gas": xz([[440, 420], [440, 560], [440, 700]]), "east-fuel": xz([[440, 840], [440, 980]]), "east-cranes": xz([[300, 490]]),
	"east-aa": xz([[300, 630], [300, 770]]), "east-sam": xz([[300, 910]]),
};
const M07_PLANT: { [id: string]: FlightPoint[] } = {
	"solar-tower": xz([[-500, -1600]], TOP), control: xz([[-380, -1450]], TOP), radar: xz([[-620, -1450]], TOP),
	pillbox: xz([[-700, -1650], [-300, -1650]], TOP), flak: xz([[-720, -1300], [-280, -1300]], TOP), sam: xz([[-500, -1250], [-500, -1800]], TOP), aa: xz([[-760, -1480], [-240, -1480]], TOP),
};
const M08_AIR: { [id: string]: number[][] } = {
	"mig-headon": [[260, -1100], [330, -1040], [220, -910], [380, -1150], [150, -1000]],
	"f15-island-west": [[-540, -30], [-440, 170], [-380, 230]],
	"f14-awacs-escort": [[-170, -760], [-440, -640], [-120, -640], [80, -590]],
	"f18-island": [[-60, -430], [260, -410], [190, -330]], "mig-island": [[60, -110], [-120, 30], [-60, 130]],
	e767: [[-460, -690]], kc10: [[-140, -710]],
	yellow: [[-60, -570], [-180, -510], [80, -450], [-120, -650], [20, -640]],
};
type BeachKey = "west" | "center" | "east";
const M09_SLOTS: { [kind: string]: number[][] } = {
	pillbox: [[-300, 110], [0, 110], [300, 110]], batteries: [[-300, 330], [0, 330], [300, 330]], aa: [[-520, 480], [-180, 480], [180, 480], [520, 480]],
	sam: [[-350, 640], [350, 640]], radar: [[0, 800]], tanks: [[-450, 200], [-150, 200], [150, 200], [450, 200], [-600, 320], [600, 320]], launchers: [[0, 970]],
};
/** Halle's inland column (Mitoro: vehicles advancing from inland, north-west of the beach). */
function m09HalleColumn(k: number): FlightPoint { return MV(-3150 + k * 140 * 0.53, LAND, -60 + k * 140 * 0.848); }
export function m09BeachPoint(beach: BeachKey, along: number, inland: number): FlightPoint {
	const x = M09_BEACH_X[beach] + along;
	return MV(x, LAND, m09CoastZ(x) - inland);
}
function m10Ground(id: string, index: number): FlightPoint | undefined {
	if (id === "hangars") return MV(index < 6 ? 380 : 250, LAND, 1450 + (index % 6) * 200);
	if (id === "bunkers") return MV(-2400 + (index % 6) * 120, LAND, 150 + math.floor(index / 6) * 120);
	if (id === "fuel") return MV(-2400 + (index % 6) * 120, LAND, 560 + math.floor(index / 6) * 120);
	if (id === "sub-stores") return MV(-1300 + (index % 7) * 150, LAND, -2650 - math.floor(index / 7) * 150);
	if (id === "subs") return [MV(-1200, SEA, -2100), MV(-950, SEA, -2100), MV(-700, SEA, -2100), MV(-450, SEA, -2100), MV(-1200, SEA, -1650)][index];
	if (id === "surfacing-sub") return MV(-700, SEA, -1600);
	if (id === "aa") {
		const v = 300, pts = [[850, LAND, 1500], [850, LAND, 1800], [850, LAND, 2100], [850, LAND, 2400], [500, LAND, 2650], [1450, v, -750], [2050, v, -750], [1450, v, -50], [2050, v, -50], [1750, v, -850],
			[-1500, LAND, -2000], [-1500, LAND, -1600], [-100, LAND, -2000], [-100, LAND, -1600], [-1500, LAND, 150], [-1500, LAND, 700], [-2650, LAND, 150], [-2650, LAND, 700]];
		const p = pts[index]; return p !== undefined ? MV(p[0], p[1], p[2]) : undefined;
	}
	if (id === "sam") {
		const v = 300, pts = [[950, LAND, 1650], [950, LAND, 2250], [250, LAND, 2700], [1750, v, -600], [1750, v, -250], [1750, v, -425],
			[-1500, LAND, -1250], [-100, LAND, -1250], [-800, LAND, -1050], [-1650, LAND, 900], [-2100, LAND, 900], [-2550, LAND, 900]];
		const p = pts[index]; return p !== undefined ? MV(p[0], p[1], p[2]) : undefined;
	}
	return undefined;
}
/** M11 attacker offsets from Mitoro's per-wave diagrams (Ace), relative to the targeted airliner. */
const M11_WAVES: { [id: string]: { t: number; site: string; altitude: number; offsets: number[][] } } = {
	"wave-1": { t: 0, site: "airliner-high", altitude: 6000 / 7000, offsets: [[-313, -287]] },
	"wave-2": { t: 100, site: "airliner-low", altitude: 1400 / 1800, offsets: [[1190, -70], [1190, 70]] },
	"wave-3": { t: 200, site: "airliner-high", altitude: 6400 / 7000, offsets: [[480, -320], [430, -250], [540, -250]] },
	"wave-4": { t: 300, site: "airliner-low", altitude: 1000 / 1800, offsets: [[-400, 0], [-287, 348]] },
	"wave-4-mig": { t: 300, site: "airliner-low", altitude: 1400 / 1800, offsets: [[-52, 435], [87, 435]] },
};
/** Escort phase length and the runtime's fixed airliner arrival x (CombatService stepAC04Unit). */
const M11_SECONDS = 330, M11_ARRIVAL_X = 1600;
export function middleAirlinerAt(layout: AC04Layout, site: string, seconds: number): FlightPoint {
	const s = layout.sites[site], f = math.clamp(seconds / M11_SECONDS, 0, 1);
	return MV(s.x + (M11_ARRIVAL_X - s.x) * f, s.y, s.z + (layout.returnZ - s.z) * f);
}
/**
 * Live-spawn helper for the runtime: offset of attacker `index` from its
 * airliner's current position, plus absolute altitude. Undefined outside M11.
 */
export function middleEscortSpawn(missionId: number, group: AC04UnitGroup, index: number, airlinerAltitude: number): { dx: number; dz: number; y: number } | undefined {
	const wave = missionId === 11 ? M11_WAVES[group.id] : undefined;
	if (wave === undefined) return undefined;
	const o = wave.offsets[math.min(index, wave.offsets.size() - 1)];
	return { dx: o[0], dz: o[1], y: airlinerAltitude * wave.altitude };
}
function m12Defense(id: string, index: number): FlightPoint | undefined {
	if (id === "jammer") return MV(0, LAND, M12_CENTER_Z);
	if (id === "sam") { const a = M12_GUN_ANGLES[index] + 0.26; return MV(math.cos(a) * 790, LAND, M12_CENTER_Z + math.sin(a) * 790); }
	if (id === "aa") { const p = M12_OUTER[index]; return p !== undefined ? MV(p[0], LAND, M12_CENTER_Z + p[1]) : undefined; }
	if (id === "stonehenge") { const a = M12_GUN_ANGLES[index]; return MV(math.cos(a) * M12_RADIUS, LAND, M12_CENTER_Z + math.sin(a) * M12_RADIUS); }
	return undefined;
}
/** Mitoro M12 close-up outer defences (5.1 studs/px about the ring), nudged >=0.22 rad off barrel azimuths; two extras adapted to reach 9 AA. */
const M12_OUTER: number[][] = (() => {
	const raw = [[-770, -770], [775, -765], [-1061, 398], [1071, 780], [-1163, 1122], [-464, 1056], [765, 1148], [0, -1150], [1150, 0]];
	return raw.map((p) => {
		const r = math.sqrt(p[0] * p[0] + p[1] * p[1]);
		let a = math.atan2(p[1], p[0]);
		for (const g of M12_GUN_ANGLES) {
			let d = a - g;
			while (d > math.pi) d -= 2 * math.pi;
			while (d < -math.pi) d += 2 * math.pi;
			if (math.abs(d) < 0.22) a = g + (d >= 0 ? 0.22 : -0.22);
		}
		return [math.cos(a) * r, math.sin(a) * r];
	});
})();
/** Generic disjoint slot spread around the group's site (mirrors the base algorithm with refined sites). */
function spread(mission: AC04Mission, layout: AC04Layout, g: AC04UnitGroup, index: number): FlightPoint {
	const s = layout.sites[g.site] ?? layout.sites.center;
	let offset = 0, total = 0, seen = false;
	for (const o of mission.roster) if (o.site === g.site && o.domain === g.domain && o.phase === g.phase) {
		if (o.id === g.id) seen = true;
		if (!seen) offset += o.count;
		total += o.count;
	}
	const slot = offset + index, columns = g.domain === "air" ? 4 : 5, spacing = g.domain === "air" ? 220 : g.domain === "naval" ? 300 : 110;
	const col = slot % columns, row = math.floor(slot / columns);
	const dx = (col - (math.min(total, columns) - 1) / 2) * spacing, dz = (row - (math.ceil(total / columns) - 1) / 2) * spacing;
	const y = g.domain === "air" ? s.y + (slot % 3) * 90 : g.domain === "naval" ? SEA : s.y;
	return MV(math.clamp(s.x + dx, -3600, 3600), y, math.clamp(s.z + dz, -3600, 3600));
}
function placeMiddle(mission: AC04Mission, layout: AC04Layout, g: AC04UnitGroup, index: number): FlightPoint | undefined {
	const id = mission.id;
	if (id === 6) {
		const hull = middleDeckHull(g);
		if (hull !== undefined) {
			const ship = middleDeckHost(g, index), dz = M06_DECK_DZ[g.id]?.[index];
			const at = ship !== undefined ? M06_HULLS[ship]?.[0] : undefined;
			return at !== undefined && dz !== undefined ? MV(at.x, MIDDLE_DECK_Y, at.z + dz) : undefined;
		}
		return M06_HULLS[g.id]?.[index] ?? M06_GROUND[g.id]?.[index];
	}
	if (id === 7) {
		if (g.id === "panels") return MV(40 + (index % 5 - 2) * 95, TOP, -2340 + math.floor(index / 5) * 95);
		if (g.id === "hind") return MV(-280 + (index % 2 === 0 ? -110 : 110), 640, -600 + index * 280);
		return M07_PLANT[g.id]?.[index];
	}
	if (id === 8) {
		const p = M08_AIR[g.id]?.[index];
		if (p !== undefined) return MV(p[0], (layout.sites[g.site] ?? layout.sites.island).y + (index % 2) * 60, p[1]);
		if (g.id === "sr71") return MV(layout.spawn.x, 3400, layout.spawn.z);
		if (g.id === "b2") return MV(-3300, 1300, -300 + (index - 2.5) * 180);
		return undefined;
	}
	if (id === 9 && g.domain === "ground") {
		const beach = g.site === "beach-west" ? "west" : g.site === "beach-center" ? "center" : g.site === "beach-east" ? "east" : undefined;
		if (beach === undefined) return undefined;
		const kind = g.id.sub(beach.size() + 2);
		if (beach === "west" && kind === "tanks") return m09HalleColumn([0, 1, 3, 4, 6, 7][index]);
		if (beach === "west" && kind === "launchers") return m09HalleColumn([2, 5][index]);
		const slot = M09_SLOTS[kind]?.[index];
		return slot !== undefined ? m09BeachPoint(beach, slot[0], slot[1]) : undefined;
	}
	if (id === 9 && g.id === "hind") {
		const beach: BeachKey = index === 0 ? "west" : index === 1 ? "center" : "east";
		const p = m09BeachPoint(beach, 0, 300);
		return MV(p.x, 420, p.z);
	}
	if (id === 10) {
		if (g.domain === "ground" || g.domain === "naval") return m10Ground(g.id, index);
		return undefined;
	}
	if (id === 11) {
		if (g.protected) return { ...layout.sites[g.site] };
		const wave = M11_WAVES[g.id];
		if (wave === undefined) return undefined;
		const at = middleAirlinerAt(layout, wave.site, wave.t), o = wave.offsets[math.min(index, wave.offsets.size() - 1)];
		return MV(math.clamp(at.x + o[0], -3600, 3600), at.y * wave.altitude, math.clamp(at.z + o[1], -3600, 3700));
	}
	if (id === 12) {
		const p = m12Defense(g.id, index);
		if (p !== undefined) return p;
		if (g.id === "rafale") {
			// Climbing out along the NE airstrip axis (Mitoro: three fighters taking off).
			const r = layout.sites["runway-ne"], along = -400 + index * 350, len = math.sqrt(30 * 30 + 70 * 70);
			return MV(r.x + along * 30 / len, 260 + index * 40, r.z + along * 70 / len);
		}
		return undefined;
	}
	return undefined;
}
/**
 * Optional placement hook. Integration: wrap AC04WorldData.unitPosition so its
 * result passes through this function last. Out-of-range missions return
 * `current` unchanged; in-range missions are fully determined here (idempotent).
 */
export function refineMiddleUnitPosition(mission: AC04Mission, layout: AC04Layout, group: AC04UnitGroup, index: number, current: FlightPoint): FlightPoint {
	if (mission.id < 6 || mission.id > 12) return current;
	return placeMiddle(mission, layout, group, index) ?? spread(mission, layout, group, index);
}

// --- worlds -------------------------------------------------------------------------
function m06World(plan: WorldPlan, layout: AC04Layout): void {
	plan.theme = "coast";
	// Comberth coastline from the Mitoro raster, full-depth (0..64) so coasts do not overhang the water.
	for (let r = 0; r < M06_LAND.size(); r++) {
		let start = -1;
		for (let c = 0; c <= 40; c++) {
			const land = c < 40 && M06_LAND[r].sub(c + 1, c + 1) === "#";
			if (land && start < 0) start = c;
			if (!land && start >= 0) {
				mBlock(plan, "Grass", M06_ORIGIN + (start + c) / 2 * M06_CELL, LAND / 2, M06_ORIGIN + (r + 0.5) * M06_CELL, (c - start) * M06_CELL, LAND, M06_CELL);
				start = -1;
			}
		}
	}
	// Shipyard spur (Mitoro's eastern promontory) carrying slipway cranes.
	mBlock(plan, "Concrete", 1400, LAND / 2, 70, 800, LAND, 300);
	// Harbour-mouth channel under the bridge, and the southern fleet anchorage opening north-east.
	mChannel(plan, -1400, 1730, -100, 1730, 230);
	mBlock(plan, "Air", 100, 200, 2700, 520, 400, 2200);
	mBlock(plan, "Water", 100, SEA / 2, 2700, 520, SEA, 2200);
	mRidge(plan, -350, 1000, 250, 220, 150, "Grass");
	mRidge(plan, -100, -250, 220, 180, 120, "Grass");
	mRidge(plan, -2600, 2900, 600, 380, 280, "Rock");
	mRidge(plan, -1750, 3250, 380, 300, 200, "Grass");
	mRidge(plan, 750, 3150, 220, 220, 150, "Grass");
	// Quay walls along the berthing coasts (named so the base berth filter can still yield to hulls).
	const comberthEdge = [-1274, -1456, -1638, -1638, -1456, -1456, -1274];
	for (let k = 0; k < comberthEdge.size(); k++) mPart(plan, "Harbor quay", comberthEdge[k] + 7, 49, M06_ORIGIN + (22 + k + 0.5) * M06_CELL, 14, 34, M06_CELL, CONCRETE);
	for (let r = 10; r <= 15; r++) {
		mPart(plan, "Harbor quay", (r <= 11 ? 364 : r <= 13 ? 182 : 0) + 7, 49, M06_ORIGIN + (r + 0.5) * M06_CELL, 14, 34, M06_CELL, CONCRETE);
		mPart(plan, "Harbor quay", 546 - 7, 49, M06_ORIGIN + (r + 0.5) * M06_CELL, 14, 34, M06_CELL, CONCRETE);
	}
	mPart(plan, "Harbor quay", 1400, 49, -73, 800, 34, 14, CONCRETE);
	mPart(plan, "Harbor quay", 1400, 49, 213, 800, 34, 14, CONCRETE);
	// Harbour-mouth bridge (Mitoro shows vehicles crossing here). Scenery, not a scored target.
	const bridge = layout.sites.bridge;
	mPart(plan, "Harbor-mouth bridge deck", bridge.x, LAND + 16, bridge.z, 44, 8, 440, CONCRETE);
	for (const dz of [-150, 0, 150]) mPart(plan, "Harbor-mouth bridge pier", bridge.x, 36, bridge.z + dz, 22, 72, 22, CONCRETE);
	for (const dz of [-120, -20, 90]) mPart(plan, "Bridge convoy vehicle", bridge.x + (dz > 0 ? 9 : -9), LAND + 25, bridge.z + dz, 12, 10, 26, OLIVE, "Metal", false);
	// New Comberth lighthouse at the peninsula tip.
	mPart(plan, "New Comberth lighthouse", 455, LAND + 55, -1790, 24, 110, 24, PALE, "Concrete", true, "cylinder");
	mPart(plan, "Lighthouse lamp", 455, LAND + 116, -1790, 20, 20, 20, [255, 226, 150], "Neon", false, "ball");
	// Comberth city behind the container port.
	let k = 0;
	for (const x of [-880, -740]) for (const z of [560, 720, 880, 1040]) {
		const h = 50 + ((k * 37) % 5) * 20; k++;
		mPart(plan, "Comberth city block", x, LAND + h / 2, z, 90, h, 110, [112 + (k % 3) * 10, 116, 120]);
		mPart(plan, "Window ribbon", x, LAND + h * 0.6, z - 56, 70, 4, 1, [205, 190, 130], "Neon", false);
	}
	// Shipyard slipway rails and fleet anti-submarine boom (non-solid dressing).
	for (const x of [1180, 1420, 1660]) mRibbon(plan, "Shipyard slipway", x, -60, x, 210, 26, LAND + 0.5, RUST, "Metal");
	mRibbon(plan, "Anchorage boom", -150, 1640, 350, 1640, 6, SEA + 1, [210, 180, 60], "Plastic");
}
function m07World(plan: WorldPlan): void {
	plan.theme = "canyon";
	for (const op of plan.ops) if (op.material === "Grass") op.material = "Sand";
	const wallH = TOP - LAND + 8, wallY = (LAND - 8 + TOP) / 2;
	// Hollow plateau: 40-stud cap plus 24-stud walls on every ravine-facing edge. Interior is
	// enclosed and unreachable, which keeps voxel volume ~10x below a solid fill.
	for (let r = 0; r < M07_N; r++) {
		let start = -1;
		for (let c = 0; c <= M07_N; c++) {
			const plateau = c < M07_N && !m07Ravine(c, r);
			if (plateau && start < 0) start = c;
			if (!plateau && start >= 0) {
				mBlock(plan, "Sandstone", M07_ORIGIN + (start + c) / 2 * M07_CELL, TOP - 20, M07_ORIGIN + (r + 0.5) * M07_CELL, (c - start) * M07_CELL, 40, M07_CELL);
				start = -1;
			}
		}
	}
	const plateauAt = (c: number, r: number) => c >= 0 && r >= 0 && c < M07_N && r < M07_N && !m07Ravine(c, r);
	// Walls facing west/east (edges at x = ORIGIN + c*CELL), merged along z.
	for (let c = 0; c <= M07_N; c++) {
		let run = -1, runSide = 0;
		for (let r = 0; r <= M07_N; r++) {
			const left = r < M07_N && plateauAt(c - 1, r), right = r < M07_N && plateauAt(c, r);
			const side = left === right ? 0 : left ? -1 : 1;
			if (side !== runSide) {
				if (runSide !== 0) mBlock(plan, "Sandstone", M07_ORIGIN + c * M07_CELL + runSide * 12, wallY, M07_ORIGIN + (run + r) / 2 * M07_CELL, 24, wallH, (r - run) * M07_CELL);
				run = r; runSide = side;
			}
		}
	}
	for (let r = 0; r <= M07_N; r++) {
		let run = -1, runSide = 0;
		for (let c = 0; c <= M07_N; c++) {
			const up = c < M07_N && plateauAt(c, r - 1), down = c < M07_N && plateauAt(c, r);
			const side = up === down ? 0 : up ? -1 : 1;
			if (side !== runSide) {
				if (runSide !== 0) mBlock(plan, "Sandstone", M07_ORIGIN + (run + c) / 2 * M07_CELL, wallY, M07_ORIGIN + r * M07_CELL + runSide * 12, (c - run) * M07_CELL, wallH, 24);
				run = c; runSide = side;
			}
		}
	}
	// Plant dressing on the plateau (targets themselves come from the roster).
	mRibbon(plan, "Solar plant service road", -500, -1500, 40, -1950, 40, TOP + 0.5, ASPHALT);
	mRibbon(plan, "Plant access road", -500, -1500, -500, -1160, 40, TOP + 0.5, ASPHALT);
	for (const z of [-2480, -1480]) mPart(plan, "Power line pylon", 240, TOP + 45, z, 8, 90, 8, STEEL, "Metal", false);
	mRibbon(plan, "Power line", 240, -2480, 240, -1480, 2, TOP + 88, ASPHALT, "Metal");
	// Main southbound canyon kept clear below the barrage ceiling (audited samples).
	for (const z of [-700, 300, 1300, 2300, 3100]) plan.air.push({ x: -280, z, limit: 380, rad: 120, label: "M07 ravine corridor" });
}
function m08World(plan: WorldPlan): void {
	plan.theme = "ocean";
	// Main Comona island (rocket base), sand rim under grass core.
	mBlock(plan, "Sand", 0, 24, -300, 1700, 48, 1200);
	mBlock(plan, "Grass", 0, LAND / 2, -300, 1500, LAND, 1000);
	mBlock(plan, "Grass", 0, LAND / 2, -300, 1100, LAND, 1400);
	mRidge(plan, -250, -700, 380, 200, 170, "Grass");
	mRidge(plan, 450, -650, 240, 180, 110, "Rock");
	// Second Comona island to the east (wiki: named ace appears above it).
	mBlock(plan, "Sand", 1900, 24, -410, 900, 48, 700);
	mBlock(plan, "Grass", 1900, LAND / 2, -410, 700, LAND, 520);
	mRidge(plan, 1950, -450, 260, 200, 190, "Rock");
	mBlock(plan, "Sand", -1350, 24, 750, 300, 48, 240);
	mBlock(plan, "Grass", -1350, LAND / 2, 750, 200, LAND, 160);
	mBlock(plan, "Sand", 1150, 24, 600, 260, 48, 200);
	// Launch complex: pad, flame trench, three-body launcher, service tower, VAB, control, tracking domes.
	mPart(plan, "Comona launch pad", 100, LAND + 3, -150, 260, 6, 260, CONCRETE);
	mPart(plan, "Flame trench", 100, LAND + 0.5, -20, 60, 1, 140, ASPHALT, "Concrete", false);
	mPart(plan, "Launch vehicle core", 100, LAND + 6 + 190, -150, 46, 380, 46, PALE, "Metal", true, "cylinder");
	for (const dx of [-36, 36]) mPart(plan, "Launch vehicle booster", 100 + dx, LAND + 6 + 115, -150, 22, 230, 22, MARK, "Metal", true, "cylinder");
	mPart(plan, "Launch vehicle payload fairing", 100, LAND + 6 + 385, -150, 46, 46, 46, PALE, "Metal", true, "ball");
	mPart(plan, "Launch service tower", 100, LAND + 210, -222, 40, 420, 40, RUST, "CorrodedMetal");
	for (const h of [120, 240, 360]) mPart(plan, "Service tower arm", 100, LAND + h, -195, 16, 6, 30, RUST, "CorrodedMetal");
	mPart(plan, "Vehicle assembly building", 520, LAND + 110, -100, 200, 220, 160, [214, 214, 206]);
	mPart(plan, "Assembly building door", 420, LAND + 90, -100, 2, 170, 70, STEEL, "Metal", false);
	mRibbon(plan, "Crawlerway", 420, -100, 100, -150, 40, LAND + 0.5, [150, 140, 120], "Concrete");
	mPart(plan, "Launch control center", -150, LAND + 25, 0, 160, 50, 90, CONCRETE);
	mPart(plan, "Control center windows", -150, LAND + 35, -46, 140, 6, 1, [150, 200, 220], "Neon", false);
	mPart(plan, "Tracking radome", -250, LAND + 205, -700, 70, 70, 70, PALE, "SmoothPlastic", true, "ball");
	mPart(plan, "Tracking radome", 450, LAND + 140, -650, 60, 60, 60, PALE, "SmoothPlastic", true, "ball");
	mPart(plan, "Comona airstrip", -450, LAND + 1, -350, 110, 2, 900, ASPHALT, "Asphalt");
	for (let i = -3; i <= 3; i++) mPart(plan, "Airstrip stripe", -450, LAND + 2.2, -350 + i * 120, 5, 0.3, 40, MARK, "SmoothPlastic", false);
	mPart(plan, "Comona jetty", 0, 40, 260, 60, 16, 200, CONCRETE);
	mPart(plan, "East island radar station", 1950, LAND + 210, -450, 60, 40, 60, CONCRETE);
}
function m09World(plan: WorldPlan): void {
	plan.theme = "coast";
	// Coast strips: grass inland, a flat sand beach, then a short slope into the sea.
	for (let x0 = -3900; x0 < 3900; x0 += 100) {
		const zc = math.min(m09CoastZ(x0), m09CoastZ(x0 + 100)), xm = x0 + 50, inland = zc - 260;
		mBlock(plan, "Grass", xm, LAND / 2, (-3900 + inland) / 2, 100, LAND, inland + 3900);
		mBlock(plan, "Sand", xm, LAND / 2, zc - 165, 100, LAND, 190);
		plan.ops.push({ shape: "wedge", material: "Sand", x: xm, y: LAND / 2, z: zc - 35, sx: 100, sy: LAND, sz: 70, yaw: math.pi });
	}
	mRidge(plan, 300, -1550, 900, 380, 420, "Rock");
	mRidge(plan, -2100, -1600, 650, 400, 300, "Grass");
	mRidge(plan, 2650, -1800, 550, 400, 340, "Rock");
	mRidge(plan, -900, -700, 300, 250, 160, "Grass");
	const beaches: BeachKey[] = ["west", "center", "east"];
	for (const beach of beaches) {
		const bx = M09_BEACH_X[beach];
		// Seawall in three chords so it follows the coast curve.
		for (let k = 0; k < 3; k++) {
			const a = m09BeachPoint(beach, -650 + k * 433, 60), b = m09BeachPoint(beach, -650 + (k + 1) * 433, 60);
			const dx = b.x - a.x, dz = b.z - a.z;
			mPart(plan, "Beach seawall", (a.x + b.x) / 2, LAND - 4, (a.z + b.z) / 2, math.sqrt(dx * dx + dz * dz), 16, 10, CONCRETE, "Concrete", true, "block", middleAxisYaw(dx, dz));
		}
		// Two allied landing-craft waves heading for the beach (Mitoro's distributed landings).
		for (let w = 0; w < 2; w++) for (const a of [-330, -110, 110, 330]) {
			const z = m09CoastZ(bx + a) + 300 + w * 350;
			mPart(plan, "Allied landing craft", bx + a, SEA + 4, z, 36, 12, 80, [82, 104, 88], "Metal", false);
			mPart(plan, "Landing craft wake", bx + a, SEA + 0.6, z + 100, 16, 0.4, 110, [236, 240, 240], "SmoothPlastic", false);
		}
	}
	for (const x of [-1600, 600, 2300]) {
		mPart(plan, "Allied transport hull", x, SEA + 10, 2500, 70, 26, 280, [96, 104, 110], "Metal", false);
		mPart(plan, "Allied transport bridge", x, SEA + 38, 2580, 40, 30, 50, [120, 126, 130], "Metal", false);
	}
	// Inland road the Halle vehicle column advances along, and the coastal supply road.
	mRibbon(plan, "Halle inland road", -3500, -620, -2580, 860, 34, LAND + 0.4, ASPHALT);
	let prev = MV(-3800, LAND, m09CoastZ(-3800) - 1150);
	for (const x of [-2000, 0, 1800, 3800]) {
		const following = MV(x, LAND, m09CoastZ(x) - 1150);
		mRibbon(plan, "Coastal supply road", prev.x, prev.z, following.x, following.z, 30, LAND + 0.4, ASPHALT);
		prev = following;
	}
}
function m10World(plan: WorldPlan): void {
	plan.theme = "canyon";
	// VTOL base on a mountain shelf below the barrage ceiling (y=300 < 400).
	mBlock(plan, "Rock", 1800, (48 + 300) / 2, -400, 1000, 252, 1100);
	mBlock(plan, "Ground", 1800, 292, -400, 1000, 16, 1100);
	// Submarine dock lake and the river system that carries the central gunboat channels.
	mBlock(plan, "Air", -800, 200, -1850, 1200, 400, 1300);
	mBlock(plan, "Water", -800, SEA / 2, -1850, 1200, SEA, 1300);
	const river = [[-500, -1180], [200, -700], [250, -100], [100, 600], [-700, 1000], [-1500, 1150], [-3900, 1250]];
	for (let i = 1; i < river.size(); i++) mChannel(plan, river[i - 1][0], river[i - 1][1], river[i][0], river[i][1], 200);
	// Four massifs between the bases: summits above the ceiling, valleys below it.
	mRidge(plan, 1550, 1500, 450, 420, 780, "Rock");
	mRidge(plan, 1414, -1414, 450, 420, 850, "Rock");
	mRidge(plan, -2100, -900, 450, 450, 760, "Rock");
	mRidge(plan, -1000, 1900, 450, 450, 720, "Rock");
	// Outer rim (open to the south approach).
	const rim = [[0, -3450, 700, 350, 600], [2650, -2650, 500, 400, 650], [3450, -300, 350, 500, 600], [2650, 2650, 500, 400, 620], [-3450, -300, 350, 450, 600], [-2650, -2650, 500, 400, 650], [-2700, 2600, 450, 400, 560]];
	for (const m of rim) mRidge(plan, m[0], m[1], m[2], m[3], m[4], "Slate");
	// Scion airfield (south).
	mPart(plan, "Scion runway", 650, LAND + 1, 1950, 150, 2, 1300, ASPHALT, "Asphalt");
	for (let i = -3; i <= 3; i++) mPart(plan, "Runway center stripe", 650, LAND + 2.2, 1950 + i * 170, 6, 0.3, 50, MARK, "SmoothPlastic", false);
	mRibbon(plan, "Scion taxiway", 470, 1400, 470, 2550, 50, LAND + 0.5, ASPHALT);
	mPart(plan, "Scion control tower", 1000, LAND + 60, 2700, 40, 120, 40, CONCRETE);
	mPart(plan, "Scion tower cab", 1000, LAND + 132, 2700, 64, 24, 64, [56, 101, 121], "Glass");
	// VTOL pads on the shelf.
	for (const p of [[1550, -600], [1950, -600], [1550, -250], [1950, -250]]) mPart(plan, "VTOL pad", p[0], 301, p[1], 120, 2, 120, [70, 74, 72], "Concrete", false, "cylinder");
	// Submarine dock: pen building on the north shore and finger piers into the lake.
	mPart(plan, "Submarine pen", -800, LAND + 30, -2545, 900, 60, 60, CONCRETE);
	for (const x of [-1075, -825, -575, -325]) mPart(plan, "Dock finger", x, SEA + 8, -2400, 30, 16, 200, CONCRETE);
	// Resupply depot (west riverside).
	mRibbon(plan, "Resupply depot road", -2700, 450, -1300, 450, 40, LAND + 0.5, ASPHALT);
	mRibbon(plan, "Resupply river landing", -1900, 1000, -1900, 700, 40, LAND + 0.5, ASPHALT);
	// Low corridors from the central basin to each base (audited).
	for (const p of [[0, 0], [400, 1100], [1000, -400], [-400, -1000], [-1000, 400]]) plan.air.push({ x: p[0], z: p[1], limit: 380, rad: 150, label: "M10 low corridor" });
}
function m11World(plan: WorldPlan, layout: AC04Layout): void {
	plan.theme = "farm";
	const a = layout.sites["airliner-low"], arrival = MV(M11_ARRIVAL_X, LAND, layout.returnZ);
	const dx = arrival.x - a.x, dz = arrival.z - a.z, len = math.sqrt(dx * dx + dz * dz), ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
	const track = (t: number, off: number) => MV(a.x + dx * t + nx * off, LAND, a.z + dz * t + nz * off);
	// River 600 studs south-west of the ground track and a highway 450 north-east: route references.
	let prev = track(0, 600);
	for (const [t, wiggle] of [[0.25, 180], [0.5, -160], [0.75, 140], [0.95, 0]]) {
		const following = track(t, 600 + wiggle);
		mRiver(plan, prev.x, prev.z, following.x, following.z, 120);
		prev = following;
	}
	mRibbon(plan, "Route highway", track(0, -450).x, track(0, -450).z, track(1, -450).x, track(1, -450).z, 36, LAND + 0.4, ASPHALT);
	// Rolling farmland ridges kept >=900 studs off the route and well below the low flight.
	for (const h of [[-700, -1150, 500, 300, 320], [1500, 250, 450, 350, 300], [3000, 1400, 400, 350, 280], [-2080, 1346, 450, 300, 300], [-864, 2713, 450, 320, 280], [-1500, -2600, 600, 300, 350]])
		mRidge(plan, h[0], h[1], h[2], h[3], h[4], "Grass");
	// Allied destination airfield just beyond the return line.
	mPart(plan, "Allied destination runway", 1750, LAND + 1, 3560, 1300, 2, 130, ASPHALT, "Asphalt");
	for (let i = -4; i <= 4; i++) mPart(plan, "Runway center stripe", 1750 + i * 140, LAND + 2.2, 3560, 50, 0.3, 6, MARK, "SmoothPlastic", false);
	mPart(plan, "Allied tower", 2500, LAND + 50, 3440, 36, 100, 36, CONCRETE);
	mPart(plan, "Allied tower cab", 2500, LAND + 110, 3440, 56, 20, 56, [56, 101, 121], "Glass");
	for (const x of [1300, 1550]) mPart(plan, "Allied hangar", x, LAND + 25, 3700, 160, 50, 90, [120, 128, 120]);
	// Farm village by the highway at mid-route.
	const v = track(0.5, -900);
	for (let i = 0; i < 6; i++) mPart(plan, "Farmhouse", v.x + (i % 3) * 90, LAND + 16, v.z + math.floor(i / 3) * 110, 50, 32, 70, [150 + i * 6, 130, 110]);
}
function m12World(plan: WorldPlan, layout: AC04Layout): void {
	plan.theme = "plateau";
	for (const op of plan.ops) if (op.material === "Grass") op.material = "Sand";
	const cz = M12_CENTER_Z;
	// Paved apron, ring road between the gun foundations, inner apron and hub.
	mCylinder(plan, "Concrete", 0, LAND - 6, cz, 980, 12);
	mCylinder(plan, "Pavement", 0, LAND - 6, cz, 720, 12);
	mCylinder(plan, "Concrete", 0, LAND - 6, cz, 590, 12);
	mCylinder(plan, "Pavement", 0, LAND - 6, cz, 160, 12);
	for (let k = 0; k < 8; k++) {
		const a = k * math.pi / 4, x = math.cos(a) * M12_RADIUS, z = cz + math.sin(a) * M12_RADIUS, ruined = math.abs(a - M12_RUINED_ANGLE) < 0.01;
		mPart(plan, ruined ? "Destroyed eighth railgun foundation" : "Railgun foundation", x, LAND + 10, z, 170, 20, 170, CONCRETE, "Concrete", true, "cylinder");
		mRibbon(plan, "Railgun service road", math.cos(a) * 160, cz + math.sin(a) * 160, math.cos(a) * 560, cz + math.sin(a) * 560, 30, LAND + 0.5, ASPHALT);
		if (ruined) {
			const out = 150, yaw = middleAxisYaw(math.cos(a), math.sin(a)) + 0.35;
			mPart(plan, "Ruined eighth barrel", x + math.cos(a) * out, LAND + 18, z + math.sin(a) * out, 300, 30, 36, [59, 61, 60], "CorrodedMetal", true, "block", yaw);
			mPart(plan, "Ruined railgun housing", x, LAND + 40, z, 80, 40, 80, [96, 92, 86], "CorrodedMetal", true, "block", 0.6);
			for (const [rx, rz] of [[60, -50], [-55, 40], [20, 70]]) mPart(plan, "Railgun rubble", x + rx, LAND + 6, z + rz, 30, 12, 26, [110, 106, 98], "Slate", false, "block", rx * 0.01);
		}
	}
	// NE runway with the three fighters Mitoro shows taking off.
	const r = layout.sites["runway-ne"], ryaw = middleAxisYaw(30, 70);
	mPart(plan, "Stonehenge airstrip", r.x, LAND + 1, r.z, 1300, 2, 110, ASPHALT, "Asphalt", true, "block", ryaw);
	for (let i = -4; i <= 4; i++) {
		const [ox, oz] = middleToWorld(i * 140, 0, ryaw);
		mPart(plan, "Runway center stripe", r.x + ox, LAND + 2.2, r.z + oz, 50, 0.3, 6, MARK, "SmoothPlastic", false, "block", ryaw);
	}
	for (const side of [-1, 1]) {
		const [ox, oz] = middleToWorld(side * 260, 160, ryaw);
		mPart(plan, "Airstrip hangar", r.x + ox, LAND + 22, r.z + oz, 90, 44, 70, [128, 124, 112], "Concrete", true, "block", ryaw);
	}
	mRibbon(plan, "Stonehenge south approach road", 0, cz + 980, 0, 3300, 40, LAND + 0.5, ASPHALT);
	// Ridge ring with an open southern approach (player arrives from the south per Mitoro's route).
	for (const deg of [0, 35, 145, 180, 215, 250, 290, 325]) {
		const t = math.rad(deg), x = math.cos(t) * 2900, z = cz + math.sin(t) * 2900;
		mRidge(plan, x, z, 420, 300, 520 + (deg % 3) * 60, "Sandstone", LAND, middleAxisYaw(-math.sin(t), math.cos(t)));
	}
}

/** Audited clearance samples this module owns (removed and re-added so the hook is idempotent). */
export const MIDDLE_AIR_LABELS = ["M07 ravine corridor", "M10 low corridor"];
/** Runs after base geometry and before AC04WorldData's final target clearance. Out-of-range missions untouched. */
export function refineMiddleWorld(mission: AC04Mission, layout: AC04Layout, plan: WorldPlan): void {
	if (mission.id < 6 || mission.id > 12) return;
	middleResetToBase(plan);
	plan.air = plan.air.filter((s) => !MIDDLE_AIR_LABELS.includes(s.label));
	if (mission.id === 6) m06World(plan, layout);
	else if (mission.id === 7) m07World(plan);
	else if (mission.id === 8) m08World(plan);
	else if (mission.id === 9) m09World(plan);
	else if (mission.id === 10) m10World(plan);
	else if (mission.id === 11) m11World(plan, layout);
	else m12World(plan, layout);
}

/** M7 helper for tests/audits: centre of a ravine or plateau cell. */
export function middleM07Cell(c: number, r: number): FlightPoint {
	const [x, z] = m07CellCenter(c, r);
	return MV(x, m07Ravine(c, r) ? LAND : TOP, z);
}
