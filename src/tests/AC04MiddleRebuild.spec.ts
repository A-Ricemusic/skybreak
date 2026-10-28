import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04MissionData, type AC04Mission, type AC04UnitGroup } from "../shared/AC04MissionData";
import { AC04WorldPlanner, type AC04Layout } from "../shared/AC04WorldData";
import { solidTopWithin, terrainTop, type PartSpec, type WorldPlan } from "../shared/WorldPlan";
import type { FlightPoint } from "../shared/WorldTypes";
import { middleDeckMounted, refineMiddleMission } from "../shared/ac04/rebuild/MiddleCampaign";
import { M07_N, M07_PLATEAU_TOP, M12_BARREL_TIP, M12_CENTER_Z, M12_GUN_ANGLES, M12_RADIUS, MIDDLE_BARRAGE_CEILING, MIDDLE_LAND, MIDDLE_OP_BUDGET, MIDDLE_PART_BUDGET, MIDDLE_SEA, MIDDLE_UNSPLIT_MAX, m07Ravine } from "../shared/ac04/rebuild/MiddleGeography";
import { MIDDLE_DECK_Y, middleAirlinerAt, middleM07Cell, refineMiddleLayout, refineMiddleUnitPosition, refineMiddleWorld } from "../shared/ac04/rebuild/MiddleWorld";

/**
 * Direct contracts for the middle-campaign (M6-M12) rebuild hooks on fresh
 * fixture plans. These do NOT prove the hooks are wired into AC04WorldData or
 * that any mission plays correctly; native engine and Player review remain pending.
 */
const LAND = MIDDLE_LAND, SEA = MIDDLE_SEA;
interface Built { mission: AC04Mission; layout: AC04Layout; plan: WorldPlan; units: Array<{ g: AC04UnitGroup; i: number; p: FlightPoint }> }
function fresh(id: number): WorldPlan {
	const plan: WorldPlan = { id, name: `fixture ${id}`, theme: "coast", environment: "ocean_clear", lamps: false, ground: LAND, ops: [], parts: [], props: [], targets: [], waterPaths: [], groundPaths: [], air: [], materialColors: [] };
	if (id === 6 || id === 8 || id === 9 || id === 10) {
		plan.ops.push({ shape: "block", material: "Sand", x: 0, y: -32, z: 0, sx: 8000, sy: 64, sz: 8000, yaw: 0 });
		plan.ops.push({ shape: "block", material: "Water", x: 0, y: 16, z: 0, sx: 8000, sy: 32, sz: 8000, yaw: 0 });
		plan.waterY = SEA;
	}
	if (id === 7 || id === 10 || id === 11 || id === 12) plan.ops.push({ shape: "block", material: id === 12 ? "Sand" : "Grass", x: 0, y: LAND - 8, z: 0, sx: 8000, sy: 16, sz: 8000, yaw: 0 });
	return plan;
}
function build(id: number): Built {
	const mission = refineMiddleMission(AC04MissionData.Get(id)), layout = refineMiddleLayout(id, AC04WorldPlanner.Layout(id)), plan = fresh(id);
	refineMiddleWorld(mission, layout, plan);
	const units: Built["units"] = [];
	for (const g of mission.roster) for (let i = 0; i < g.count; i++) units.push({ g, i, p: refineMiddleUnitPosition(mission, layout, g, i, AC04WorldPlanner.UnitPosition(id, g, i)) });
	return { mission, layout, plan, units };
}
/** Emulates AC04WorldData's final clearance (pads/air columns/berths) with the deck-mount exemption from the integration patch. */
function finalize(b: Built): WorldPlan {
	const plan: WorldPlan = { ...b.plan, ops: [...b.plan.ops], parts: [...b.plan.parts] };
	for (const u of b.units) {
		if (u.g.domain === "ground" && !middleDeckMounted(u.g)) {
			plan.ops.push({ shape: "block", material: "Concrete", x: u.p.x, y: u.p.y - 8, z: u.p.z, sx: 90, sy: 16, sz: 90, yaw: 0 });
			plan.ops.push({ shape: "block", material: "Air", x: u.p.x, y: u.p.y + 500, z: u.p.z, sx: 90, sy: 1000, sz: 90, yaw: 0 });
		}
		if (u.g.domain === "naval") {
			plan.ops.push({ shape: "block", material: "Air", x: u.p.x, y: 120, z: u.p.z, sx: 180, sy: 320, sz: 340, yaw: 0 });
			plan.ops.push({ shape: "block", material: "Water", x: u.p.x, y: 16, z: u.p.z, sx: 180, sy: 32, sz: 340, yaw: 0 });
		}
	}
	return plan;
}
const fixed = (b: Built) => b.units.filter((u) => u.g.domain === "ground" || u.g.domain === "naval");
const sum = (gs: AC04UnitGroup[]) => gs.reduce((n, g) => n + g.count * g.points, 0);
const delayed = (g: AC04UnitGroup) => g.triggerAt !== undefined || g.afterGroup !== undefined || g.afterKills !== undefined;
const initialEligible = (m: AC04Mission) => sum(m.roster.filter((g) => g.phase === 0 && !g.protected && !g.invulnerable && !delayed(g)));
const typeTotal = (m: AC04Mission, unitType: string) => m.roster.filter((g) => g.type === unitType).reduce((n, g) => n + g.count, 0);
const dist2 = (a: FlightPoint, x: number, z: number) => math.sqrt((a.x - x) * (a.x - x) + (a.z - z) * (a.z - z));
function partCovers(p: PartSpec, x: number, z: number, pad = 0): boolean {
	const c = math.cos(p.yaw), s = math.sin(p.yaw), dx = x - p.x, dz = z - p.z, lx = c * dx - s * dz, lz = s * dx + c * dz;
	const hz = p.shape === "cylinder" || p.shape === "ball" ? p.sx / 2 : p.sz / 2;
	return math.abs(lx) <= p.sx / 2 + pad && math.abs(lz) <= hz + pad;
}
function roster(m: AC04Mission): string {
	return m.roster.map((g) => `${g.id}:${g.type}:${g.count}:${g.points}:${g.site}:${g.phase}:${g.required}`).join("|");
}
const IDS = [6, 7, 8, 9, 10, 11, 12];

describe("AC04 middle rebuild hook boundaries", () => {
	it("passes out-of-range missions, layouts and worlds through untouched", () => {
		for (const id of [5, 13]) {
			const base = AC04MissionData.Get(id), layout = AC04WorldPlanner.Layout(id), plan = fresh(id);
			expect(refineMiddleMission(base)).toBe(base);
			expect(refineMiddleLayout(id, layout)).toBe(layout);
			const ops = plan.ops.size();
			refineMiddleWorld(base, layout, plan);
			expect(plan.ops.size()).toBe(ops);
			const g = base.roster[0], p = { x: 1, y: 2, z: 3 };
			expect(refineMiddleUnitPosition(base, layout, g, 0, p)).toBe(p);
		}
	});
	it("is idempotent and never mutates the base manifest", () => {
		for (const id of IDS) {
			const base = AC04MissionData.Get(id), before = roster(base);
			const once = refineMiddleMission(base), twice = refineMiddleMission(once);
			expect(roster(twice)).toBe(roster(once));
			expect(twice.gaps.size()).toBe(once.gaps.size());
			expect(roster(base)).toBe(before);
			const layout = refineMiddleLayout(id, AC04WorldPlanner.Layout(id));
			expect(refineMiddleLayout(id, layout).returnZ).toBe(layout.returnZ);
			const plan = fresh(id);
			refineMiddleWorld(once, layout, plan);
			const counts = [plan.ops.size(), plan.parts.size(), plan.air.size()];
			refineMiddleWorld(once, layout, plan);
			expect([plan.ops.size(), plan.parts.size(), plan.air.size()]).toEqual(counts);
		}
	});
	it("preserves every phase clock, threshold and required objective", () => {
		for (const id of IDS) {
			const base = AC04MissionData.Get(id), m = refineMiddleMission(base);
			expect(m.phases).toEqual(base.phases);
			expect(m.sRank).toBe(base.sRank);
			for (const phase of m.phases) for (const required of phase.requiredGroupIds) {
				const before = base.roster.find((g) => g.id === required)!, after = m.roster.find((g) => g.id === required)!;
				expect(after.count).toBe(before.count);
				expect(after.points).toBe(before.points);
				expect(after.required).toBe(before.required);
			}
			for (const g of m.roster) {
				if (g.afterGroup !== undefined) expect(m.roster.some((o) => o.id === g.afterGroup)).toBe(true);
				if (g.afterKills !== undefined) {
					let capacity = 0;
					for (const ref of g.afterKills.groups) { const o = m.roster.find((x) => x.id === ref); expect(o).toBeDefined(); capacity += o!.count; }
					expect(g.afterKills.count).toBeLessThanOrEqual(capacity);
				}
				expect(g.required && (g.protected === true || g.invulnerable === true)).toBe(false);
			}
		}
	});
	it("keeps budgets: parts, terrain ops, unsplit wedges, part spans and unit bounds", () => {
		for (const id of IDS) {
			const b = build(id);
			expect(b.plan.parts.size()).toBeLessThanOrEqual(MIDDLE_PART_BUDGET);
			expect(b.plan.ops.size()).toBeLessThanOrEqual(MIDDLE_OP_BUDGET);
			for (const op of b.plan.ops) if (op.shape === "wedge") expect(math.ceil((op.sx + 8) / 4) * math.ceil((op.sy + 8) / 4) * math.ceil((op.sz + 8) / 4)).toBeLessThan(MIDDLE_UNSPLIT_MAX);
			for (const p of b.plan.parts) expect(math.max(p.sx, p.sy, p.sz)).toBeLessThanOrEqual(2048);
			for (const u of b.units) {
				expect(math.abs(u.p.x)).toBeLessThanOrEqual(3800);
				expect(math.abs(u.p.z)).toBeLessThanOrEqual(3800);
				expect(u.p.y).toBeLessThan(3600);
			}
			expect(solidTopWithin(b.plan, b.layout.spawn.x, b.layout.spawn.z, 100)).toBeLessThan(b.layout.spawn.y - 100);
		}
	});
	it("rests every fixed target on authored terrain at its elevation, unburied and apart", () => {
		for (const id of IDS) {
			const b = build(id), list = fixed(b), final = finalize(b);
			for (const u of list) {
				if (middleDeckMounted(u.g)) continue;
				const top = terrainTop(b.plan.ops, u.p.x, u.p.z);
				if (u.g.domain === "naval") {
					expect(top.water).toBe(SEA);
					expect(top.solid).toBeLessThan(SEA);
				} else {
					// Supported (not floating) and not inside terrain before the clearance pads exist.
					expect(math.abs(top.solid - u.p.y)).toBeLessThanOrEqual(2);
					expect(top.water === undefined || top.water < top.solid).toBe(true);
				}
				for (const part of final.parts) if (part.solid && partCovers(part, u.p.x, u.p.z) && part.name.find("foundation", 1, true)[0] === undefined)
					expect(part.y + part.sy / 2).toBeLessThanOrEqual(u.p.y + 2);
			}
			for (let a = 0; a < list.size(); a++) for (let c = a + 1; c < list.size(); c++) {
				const p = list[a], q = list[c];
				if (middleDeckMounted(p.g) || middleDeckMounted(q.g) || p.g.phase !== q.g.phase) continue;
				// 90-stud clearance pads never overlap; hulls keep their 170-250 stud lengths apart.
				expect(dist2(p.p, q.p.x, q.p.z)).toBeGreaterThan(p.g.domain === "naval" && q.g.domain === "naval" ? 150 : 92);
			}
		}
	});
});

describe("M06 Invincible Fleet rebuild", () => {
	const b = build(6), m = b.mission;
	it("splits the wiki's named Aegir hulls and separately targetable ship weapons", () => {
		for (const name of ["AEGIS RAVEN", "CARRIER GEOFON", "BATTLESHIP TANAGER", "CRUISER BELUGA", "CRUISER FENRIS", "CRUISER KOLGA", "CRUISER LAZULI", "DESTROYER HERNE", "DESTROYER TAISCH", "DESTROYER THIASSI", "SUBMARINE BEOWULF-NU", "SUBMARINE BEOWULF-PI"])
			expect(m.roster.filter((g) => g.type === name && g.count === 1 && g.domain === "naval").size()).toBe(1);
		const deck = (id: string) => m.roster.find((g) => g.id === id)!;
		expect([deck("raven-sam").count, deck("raven-sam").points]).toEqual([2, 30]);
		expect([deck("tanager-gun").count, deck("tanager-gun").points, deck("tanager-gun").type]).toEqual([3, 30, "GUN"]);
		expect([deck("cruiser-sam").count, deck("cruiser-aa").count, deck("destroyer-aa").count]).toEqual([4, 4, 2]);
		for (const u of b.units.filter((x) => middleDeckMounted(x.g))) {
			expect(u.p.y).toBe(MIDDLE_DECK_Y);
			const hulls = b.units.filter((x) => x.g.domain === "naval" && dist2(x.p, u.p.x, u.p.z) < 90);
			expect(hulls.size()).toBe(1);
			expect(math.abs(hulls[0].p.x - u.p.x)).toBeLessThan(1);
		}
		expect(typeTotal(m, "SUBMARINE")).toBe(5);
		for (const [t, n] of [["CONT. SHIP", 2], ["LNDG. SHIP", 2], ["MSSL. BOAT", 2], ["SUPPLY SHIP", 1]] as Array<[string, number]>) expect(typeTotal(m, t)).toBe(n);
	});
	it("restores fuel and gas categories at the Shotgunnova 40-ground scale, all provisional", () => {
		const ground = m.roster.filter((g) => g.domain === "ground" && !middleDeckMounted(g));
		expect(ground.reduce((n, g) => n + g.count, 0)).toBe(40);
		expect(ground.every((g) => g.provisional === true)).toBe(true);
		for (const t of ["AA GUN", "SAM", "CONTAINERS", "CRANE", "FUEL TANK", "GAS TANK", "STORAGE"]) expect(ground.some((g) => g.type === t)).toBe(true);
	});
	it("keeps wiki air totals while starting with eleven aircraft and staged reinforcements", () => {
		expect([typeTotal(m, "F-14"), typeTotal(m, "F/A-18"), typeTotal(m, "TND-IDS"), typeTotal(m, "Ka-25")]).toEqual([13, 10, 5, 1]);
		expect(m.roster.filter((g) => g.domain === "air" && !delayed(g)).reduce((n, g) => n + g.count, 0)).toBe(11);
		expect(initialEligible(m)).toBeGreaterThanOrEqual(m.phases[0].threshold! + 1000);
		expect(sum(m.roster)).toBeGreaterThanOrEqual(m.sRank);
	});
	it("berths every hull in open water in four distinct harbour sectors", () => {
		const centroid = (site: string) => {
			const ships = b.units.filter((u) => u.g.domain === "naval" && u.g.site === site);
			let x = 0, z = 0; for (const s of ships) { x += s.p.x; z += s.p.z; }
			return [x / ships.size(), z / ships.size()];
		};
		const sectors = ["harbor", "new-harbor", "shipyard", "fleet"].map(centroid);
		for (let a = 0; a < 4; a++) for (let c = a + 1; c < 4; c++) expect(math.sqrt((sectors[a][0] - sectors[c][0]) ** 2 + (sectors[a][1] - sectors[c][1]) ** 2)).toBeGreaterThan(1200);
		expect(sectors[0][0]).toBeLessThan(-1200); expect(sectors[1][1]).toBeLessThan(-1000); expect(sectors[2][0]).toBeGreaterThan(900); expect(sectors[3][1]).toBeGreaterThan(2000);
		for (const u of b.units.filter((x) => x.g.domain === "naval")) for (const dz of [-80, 80]) expect(terrainTop(b.plan.ops, u.p.x, u.p.z + dz).water).toBe(SEA);
	});
	it("builds the peninsula, harbour-mouth bridge and quays without covering any berth", () => {
		expect(terrainTop(b.plan.ops, -700, 700).solid).toBeGreaterThanOrEqual(LAND);
		expect(terrainTop(b.plan.ops, -950, 1730).water).toBe(SEA);
		const deck = b.plan.parts.find((p) => p.name === "Harbor-mouth bridge deck")!;
		expect(deck.sz).toBeGreaterThan(300);
		for (const q of b.plan.parts.filter((p) => p.name === "Harbor quay")) for (const u of b.units.filter((x) => x.g.domain === "naval"))
			expect(math.abs(q.x - u.p.x) < q.sx / 2 + 70 && math.abs(q.z - u.p.z) < q.sz / 2 + 150).toBe(false);
	});
});

describe("M07 Deep Strike rebuild", () => {
	const b = build(7);
	it("raises the plateau above the barrage ceiling while ravine floors stay far below it", () => {
		for (let r = 0; r < M07_N; r++) for (let c = 0; c < M07_N; c++) {
			const cell = middleM07Cell(c, r), top = terrainTop(b.plan.ops, cell.x, cell.z).solid;
			if (m07Ravine(c, r)) expect(top).toBeLessThanOrEqual(LAND + 1);
			else expect(top).toBeGreaterThanOrEqual(MIDDLE_BARRAGE_CEILING + 120);
		}
		expect(M07_PLATEAU_TOP).toBeGreaterThan(MIDDLE_BARRAGE_CEILING + 100);
	});
	it("connects the canyon below the plant to the return line through ravines only", () => {
		const open = (c: number, r: number) => c >= 0 && r >= 0 && c < M07_N && r < M07_N && terrainTop(b.plan.ops, middleM07Cell(c, r).x, middleM07Cell(c, r).z).solid < 300;
		const key = (c: number, r: number) => r * M07_N + c, seen = new Set<number>(), queue: number[][] = [[11, 9]];
		expect(open(11, 9)).toBe(true);
		seen.add(key(11, 9));
		let reached = false;
		while (queue.size() > 0) {
			const [c, r] = queue.remove(0)!;
			if (middleM07Cell(c, r).z >= b.layout.returnZ - 280) reached = true;
			for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(c + dc, r + dr) && !seen.has(key(c + dc, r + dr))) { seen.add(key(c + dc, r + dr)); queue.push([c + dc, r + dr]); }
		}
		expect(reached).toBe(true);
		for (const s of b.plan.air.filter((x) => x.label === "M07 ravine corridor")) expect(solidTopWithin(b.plan, s.x, s.z, s.rad)).toBeLessThan(s.limit);
	});
	it("puts the three TGTs on the plateau with a ravine within an escape dash", () => {
		for (const u of b.units.filter((x) => x.g.required)) {
			expect(u.p.y).toBe(M07_PLATEAU_TOP);
			let best = math.huge;
			for (let r = 0; r < M07_N; r++) for (let c = 0; c < M07_N; c++) if (m07Ravine(c, r)) best = math.min(best, dist2(u.p, middleM07Cell(c, r).x, middleM07Cell(c, r).z));
			expect(best).toBeLessThan(900);
		}
		for (const u of b.units.filter((x) => x.g.domain === "air")) expect(u.p.y).toBeGreaterThan(M07_PLATEAU_TOP + 40);
	});
});

describe("M08 Shattered Skies rebuild", () => {
	const b = build(8), m = b.mission;
	it("builds the Comona rocket base island, launcher and second island", () => {
		const launch = b.layout.sites.launch, east = b.layout.sites["second-island"];
		expect(terrainTop(b.plan.ops, launch.x, launch.z).solid).toBe(LAND);
		expect(terrainTop(b.plan.ops, east.x, east.z).solid).toBeGreaterThan(SEA);
		expect(b.plan.parts.some((p) => p.name === "Launch vehicle core" && p.sy > 300)).toBe(true);
		expect(terrainTop(b.plan.ops, (launch.x + east.x) / 2, launch.z).water).toBe(SEA);
	});
	it("stages Mitoro's reinforcement chain with reachable cumulative kill counts", () => {
		const fighters = m.roster.filter((g) => g.domain === "air" && g.points === 60);
		expect(fighters.every((g) => g.provisional === true)).toBe(true);
		const initial = fighters.filter((g) => !delayed(g)).reduce((n, g) => n + g.count, 0);
		expect(initial).toBe(18);
		const waves = fighters.filter((g) => g.afterKills !== undefined).sort((a, c) => a.afterKills!.count < c.afterKills!.count);
		let pool = initial;
		for (const w of waves) { expect(w.afterKills!.count).toBeLessThanOrEqual(pool); pool += w.count; }
		expect(m.roster.find((g) => g.id === "wave-west-1")!.afterKills!.groups).toEqual(["f18-island", "mig-island"]);
	});
	it("keeps the 800 gate and 2900 S feasible and routes the bombers from the west to the launch site", () => {
		expect(initialEligible(m)).toBeGreaterThanOrEqual(800);
		expect(sum(m.roster.filter((g) => !g.invulnerable))).toBeGreaterThanOrEqual(m.sRank);
		const b2 = m.roster.find((g) => g.id === "b2")!;
		expect([b2.count, b2.points, b2.required, b2.phase]).toEqual([6, 150, true, 1]);
		const start = b.units.find((u) => u.g.id === "b2")!.p;
		expect(start.x).toBeLessThan(-3000);
		const tail = b2.path![b2.path!.size() - 1];
		expect(dist2(tail, b.layout.sites.island.x, b.layout.sites.island.z)).toBeLessThan(1000);
		const sr = m.roster.find((g) => g.id === "sr71")!, sp = b.units.find((u) => u.g.id === "sr71")!.p;
		expect(dist2(sp, b.layout.spawn.x, b.layout.spawn.z)).toBeLessThan(1);
		expect(sr.path![sr.path!.size() - 1].x).toBeLessThan(-3000);
	});
});

describe("M09 Operation Bunker Shot rebuild", () => {
	const b = build(9), m = b.mission;
	const beachUnits = (beach: string) => b.units.filter((u) => u.g.site === `beach-${beach}`);
	it("orders Halle, Crowne and Caranda west to east with Halle further south", () => {
		const mean = (beach: string, axis: "x" | "z") => { const us = beachUnits(beach); let s = 0; for (const u of us) s += u.p[axis]; return s / us.size(); };
		expect(mean("west", "x")).toBeLessThan(mean("center", "x"));
		expect(mean("center", "x")).toBeLessThan(mean("east", "x"));
		expect(mean("west", "z")).toBeGreaterThan(mean("center", "z"));
		for (const beach of ["west", "center", "east"]) {
			const site = b.layout.sites[`beach-${beach}`];
			for (const u of beachUnits(beach)) expect(dist2(u.p, site.x, site.z)).toBeLessThan(1700);
			expect(beachUnits(beach).some((u) => u.g.type === "RADAR")).toBe(true);
		}
	});
	it("keeps 60 provisional ground units, verified 80-point batteries, and both score gates feasible", () => {
		const ground = m.roster.filter((g) => g.domain === "ground");
		expect(ground.reduce((n, g) => n + g.count, 0)).toBe(60);
		expect(ground.every((g) => g.provisional === true)).toBe(true);
		expect(typeTotal(m, "BATTERY")).toBe(9);
		expect(ground.filter((g) => g.type === "BATTERY").every((g) => g.points === 80)).toBe(true);
		expect(typeTotal(m, "LAUNCHER")).toBeGreaterThan(0);
		expect(initialEligible(m)).toBeGreaterThanOrEqual(2200);
		expect(sum(m.roster)).toBeGreaterThanOrEqual(m.sRank + 100);
	});
	it("sends the six required A-10s from the north to the central beach", () => {
		const a10 = m.roster.find((g) => g.id === "a10")!;
		expect([a10.count, a10.points, a10.required, a10.phase]).toEqual([6, 100, true, 1]);
		const crowne = b.layout.sites["beach-center"], tail = a10.path![a10.path!.size() - 1];
		expect(dist2(tail, crowne.x, crowne.z)).toBeLessThan(400);
		for (const u of b.units.filter((x) => x.g.id === "a10")) expect(u.p.z).toBeLessThan(-1000);
		expect(terrainTop(b.plan.ops, crowne.x, m09Sea(b)).water).toBe(SEA);
	});
});
function m09Sea(b: Built): number { return b.layout.sites["beach-center"].z + 800; }

describe("M10 Tango Line rebuild", () => {
	const b = build(10);
	it("separates the four Mitoro sectors around the central river basin", () => {
		const s = b.layout.sites;
		expect(s.airbase.z).toBeGreaterThan(1500); expect(s.vtol.x).toBeGreaterThan(1500); expect(s["sub-base"].z).toBeLessThan(-1500); expect(s.resupply.x).toBeLessThan(-1500);
		expect(terrainTop(b.plan.ops, s["sub-base"].x, s["sub-base"].z).water).toBe(SEA);
		expect(terrainTop(b.plan.ops, s.vtol.x, s.vtol.z).solid).toBe(300);
		expect(terrainTop(b.plan.ops, s.airbase.x, s.airbase.z).solid).toBe(LAND);
		expect(terrainTop(b.plan.ops, 250, -100).water).toBe(SEA);
	});
	it("raises massifs above the barrage ceiling while low corridors reach every base", () => {
		let peaks = 0;
		for (const p of [[1550, 1500], [1414, -1414], [-2100, -900], [-1000, 1900]]) if (terrainTop(b.plan.ops, p[0], p[1]).solid > MIDDLE_BARRAGE_CEILING + 200) peaks++;
		expect(peaks).toBe(4);
		for (const s of b.plan.air.filter((x) => x.label === "M10 low corridor")) expect(solidTopWithin(b.plan, s.x, s.z, s.rad)).toBeLessThan(s.limit);
		for (const site of ["airbase", "vtol", "sub-base", "resupply"]) {
			const t = b.layout.sites[site];
			for (let k = 1; k < 10; k++) expect(terrainTop(b.plan.ops, t.x * k / 10, t.z * k / 10).solid).toBeLessThan(MIDDLE_BARRAGE_CEILING);
		}
	});
	it("distributes AA/SAM across the four bases instead of an empty centre", () => {
		for (const id of ["aa", "sam"]) {
			const us = b.units.filter((u) => u.g.id === id);
			for (const u of us) expect(dist2(u.p, 0, 0)).toBeGreaterThan(900);
			const quadrant = (u: { p: FlightPoint }) => math.abs(u.p.x) > math.abs(u.p.z) ? (u.p.x > 0 ? "E" : "W") : (u.p.z > 0 ? "S" : "N");
			const seen = new Set<string>(); for (const u of us) seen.add(quadrant(u));
			expect(seen.size()).toBe(4);
		}
	});
});

describe("M11 Escort rebuild", () => {
	const b = build(11);
	it("spawns high waves near Flight 702 and low waves near Flight 701 at their trigger time", () => {
		for (const u of b.units.filter((x) => !x.g.protected)) {
			const high = u.g.site === "airliner-high", t = u.g.triggerAt ?? 0, liner = middleAirlinerAt(b.layout, u.g.site, t);
			expect(dist2(u.p, liner.x, liner.z)).toBeLessThan(1300);
			if (high) expect(u.p.y).toBeGreaterThan(b.layout.sites["airliner-low"].y + 800);
			else expect(u.p.y).toBeLessThan(b.layout.sites["airliner-low"].y + 1);
		}
		expect(b.layout.sites["airliner-high"].y).toBeGreaterThan(b.layout.sites["airliner-low"].y * 2);
	});
	it("keeps terrain far below the low flight's route and puts the allied airfield beyond the line", () => {
		for (let k = 0; k <= 20; k++) {
			const p = middleAirlinerAt(b.layout, "airliner-low", 330 * k / 20);
			expect(solidTopWithin(b.plan, p.x, p.z, 200)).toBeLessThan(p.y - 600);
		}
		const runway = b.plan.parts.find((p) => p.name === "Allied destination runway")!;
		expect(runway.z).toBeGreaterThan(b.layout.returnZ);
	});
});

describe("M12 Stonehenge Offensive rebuild", () => {
	const b = build(12), m = b.mission;
	const guns = b.units.filter((u) => u.g.id === "stonehenge");
	it("places seven guns on the ring with the ruined eighth at the south-east", () => {
		expect(guns.size()).toBe(7);
		for (const u of guns) {
			expect(dist2(u.p, 0, M12_CENTER_Z)).toBeCloseTo(M12_RADIUS, 1);
			expect(u.p.x > 100 && u.p.z > M12_CENTER_Z + 100).toBe(false);
		}
		const ruined = b.plan.parts.find((p) => p.name === "Destroyed eighth railgun foundation")!;
		expect(ruined.x).toBeGreaterThan(300); expect(ruined.z).toBeGreaterThan(M12_CENTER_Z + 300);
		expect(m.phases[1].requiredKills).toBe(1);
	});
	it("keeps the jammer and every defence clear of the barrels' sweep", () => {
		for (const u of b.units.filter((x) => x.g.id === "aa" || x.g.id === "sam" || x.g.id === "jammer")) for (const a of M12_GUN_ANGLES) {
			const ux = math.cos(a), uz = math.sin(a), rx = u.p.x, rz = u.p.z - M12_CENTER_Z;
			const along = math.clamp(rx * ux + rz * uz, M12_RADIUS, M12_BARREL_TIP + 150), px = ux * along - rx, pz = uz * along - rz;
			expect(math.sqrt(px * px + pz * pz)).toBeGreaterThan(120);
		}
		expect(b.units.filter((u) => u.g.id === "aa").size()).toBe(9);
		const jammer = b.units.find((u) => u.g.id === "jammer")!.p;
		expect(dist2(jammer, 0, M12_CENTER_Z)).toBeLessThan(1);
		for (const p of b.plan.parts) if (p.solid && p.y - p.sy / 2 < LAND + 44 && p.y + p.sy / 2 > LAND + 2) for (let dz = 20; dz <= 300; dz += 20) expect(partCovers(p, 0, M12_CENTER_Z + dz)).toBe(false);
	});
	it("launches the three R-M01 from the north-east airstrip and brings Yellow from the north", () => {
		const strip = b.layout.sites["runway-ne"];
		for (const u of b.units.filter((x) => x.g.id === "rafale")) expect(dist2(u.p, strip.x, strip.z)).toBeLessThan(700);
		for (const u of b.units.filter((x) => x.g.id === "yellow")) expect(u.p.z).toBeLessThan(-2500);
	});
});
