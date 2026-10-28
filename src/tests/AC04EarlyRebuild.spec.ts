import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04MissionData, type AC04Mission, type AC04UnitGroup } from "../shared/AC04MissionData";
import { AC04WorldPlanner, type AC04Layout } from "../shared/AC04WorldData";
import { solidTopWithin, terrainTop, type PartSpec, type WorldPlan } from "../shared/WorldPlan";
import type { FlightPoint } from "../shared/WorldTypes";
import { EARLY_AIR_PREFIX, EARLY_LAND, EARLY_OP_BUDGET, EARLY_PART_BUDGET, EARLY_SEA, EARLY_UNSPLIT_MAX, earlyRegionCells } from "../shared/ac04/rebuild/EarlyGeometry";
import { M02_RUNWAY, M02_SUBSTATION, M03_EAST, M03_WEST } from "../shared/ac04/rebuild/EarlyPlacement";
import {
	M01_CRATER, M01_RUNWAY, M05_DECK, M05_DECK_TOP, m01HalfWidths, m01Local, m01World, m04CoastX, m05CoastX, refineEarlyLayout, refineEarlyUnitPosition, refineEarlyWorld,
} from "../shared/ac04/rebuild/EarlyWorld";

/**
 * Direct contracts for the early-campaign (M1-M5) rebuild hooks on fresh
 * fixture plans. Integrated placement contracts below also exercise AC04WorldPlanner.Build.
 * These do not prove native rendering or mission playability.
 */
const LAND = EARLY_LAND, SEA = EARLY_SEA;
interface Unit { g: AC04UnitGroup; i: number; p: FlightPoint; current: FlightPoint }
interface Built { mission: AC04Mission; layout: AC04Layout; plan: WorldPlan; units: Unit[] }
function fresh(id: number): WorldPlan {
	const plan: WorldPlan = { id, name: `fixture ${id}`, theme: "coast", environment: "ocean_clear", lamps: false, ground: LAND, ops: [], parts: [], props: [], targets: [], waterPaths: [], groundPaths: [], air: [], materialColors: [] };
	if (id === 1 || id === 4 || id === 5) {
		plan.ops.push({ shape: "block", material: "Sand", x: 0, y: -32, z: 0, sx: 8000, sy: 64, sz: 8000, yaw: 0 });
		plan.ops.push({ shape: "block", material: "Water", x: 0, y: 16, z: 0, sx: 8000, sy: 32, sz: 8000, yaw: 0 });
		plan.waterY = SEA;
	} else plan.ops.push({ shape: "block", material: "Grass", x: 0, y: LAND - 8, z: 0, sx: 8000, sy: 16, sz: 8000, yaw: 0 });
	// Old coarse geometry the rebuild must replace.
	plan.ops.push({ shape: "wedge", material: "Grass", x: 0, y: 200, z: 0, sx: 200, sy: 300, sz: 200, yaw: 0 });
	plan.parts.push({ name: "Old greybox", shape: "block", x: 0, y: 80, z: 0, sx: 50, sy: 50, sz: 50, yaw: 0, color: [1, 1, 1], material: "Concrete", solid: true, grounded: false });
	return plan;
}
function build(id: number): Built {
	const mission = AC04MissionData.Get(id), layout = refineEarlyLayout(id, AC04WorldPlanner.Layout(id)), plan = fresh(id);
	refineEarlyWorld(mission, layout, plan);
	const units: Unit[] = [];
	for (const g of mission.roster) for (let i = 0; i < g.count; i++) {
		const current = AC04WorldPlanner.UnitPosition(id, g, i);
		units.push({ g, i, current, p: refineEarlyUnitPosition(mission, layout, g, i, current) });
	}
	return { mission, layout, plan, units };
}
/** Emulates AC04WorldData's final clearance (pads, air columns, berths) and the spawn sample. */
function finalize(b: Built): WorldPlan {
	const plan: WorldPlan = { ...b.plan, ops: [...b.plan.ops], parts: [...b.plan.parts], air: [...b.plan.air] };
	for (const u of b.units) {
		if (u.g.domain === "ground" && u.g.site !== "rigs") {
			const pad = u.g.type === "Tu-95" ? 140 : 90;
			plan.ops.push({ shape: "block", material: "Concrete", x: u.p.x, y: u.p.y - 8, z: u.p.z, sx: pad, sy: 16, sz: pad, yaw: 0 });
			plan.ops.push({ shape: "block", material: "Air", x: u.p.x, y: u.p.y + 500, z: u.p.z, sx: pad, sy: 1000, sz: pad, yaw: 0 });
		}
		if (u.g.domain === "naval") {
			plan.ops.push({ shape: "block", material: "Air", x: u.p.x, y: 120, z: u.p.z, sx: 180, sy: 320, sz: 340, yaw: 0 });
			plan.ops.push({ shape: "block", material: "Water", x: u.p.x, y: 16, z: u.p.z, sx: 180, sy: 32, sz: 340, yaw: 0 });
		}
	}
	plan.air.push({ x: b.layout.spawn.x, z: b.layout.spawn.z, limit: b.layout.spawn.y - 100, rad: 100, label: "AC04 sortie spawn" });
	return plan;
}
function solidPartsNear(plan: WorldPlan, x: number, z: number, rad: number): PartSpec[] {
	return plan.parts.filter((p) => {
		if (!p.solid) return false;
		const hz = p.shape === "cylinder" || p.shape === "ball" ? p.sx : p.sz, c = math.cos(p.yaw), s = math.sin(p.yaw), dx = x - p.x, dz = z - p.z;
		const lx = c * dx - s * dz, lz = s * dx + c * dz;
		const ex = math.max(math.abs(lx) - p.sx / 2, 0), ez = math.max(math.abs(lz) - hz / 2, 0);
		return math.sqrt(ex * ex + ez * ez) <= rad;
	});
}
const dist = (a: FlightPoint, b: FlightPoint) => math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));
const EARLY = [1, 2, 3, 4, 5];

describe("AC04 early rebuild hooks (M1-M5)", () => {
	it("preserves all 121 Lifeline placements against the frozen pre-rebuild candidate", () => {
		// Fixed oracle transcribed from candidate 91927612ddb4049cc2010a5cfa2a8e0cfaa166eef7a51d5eeaf8d48dc3cf5659:
		// its embedded AC04MissionData roster, sites and unitPosition arithmetic, independent of current hooks.
		const expected = "f16:0:-780,1100,1000;f16:1:-520,1220,1000;f16-return-1:0:-260,1100,1000;f16-return-1:1:0,1220,1000;f16-return-2:0:260,1100,1000;f16-return-2:1:520,1220,1000;f16-return-2:2:780,1340,1000;mirage:0:1710,1200,-1800;mirage:1:1970,1320,-1800;mirage-return-1:0:-2880,1100,-2060;mirage-return-1:1:-2620,1220,-2060;mirage-return-2:0:-2360,1100,-2060;mirage-return-2:1:-2100,1220,-2060;mirage-return-2:2:-1840,1340,-2060;mig-offshore:0:2230,1200,-1800;mig-offshore:1:2490,1320,-1800;mig:0:-1580,1100,-2060;mig:1:-1320,1220,-2060;mig:2:-2880,1340,-1800;mig-return-1:0:-2620,1100,-1800;mig-return-1:1:-2360,1220,-1800;mig-return-1:2:-2100,1340,-1800;mig-return-1:3:-1840,1100,-1800;mig-return-2:0:-1580,1100,-1800;mig-return-2:1:-1320,1220,-1800;mig-return-2:2:-2880,1340,-1540;mig-return-2:3:-2620,1100,-1540;ka50:0:-2360,1100,-1540;ka50:1:-2100,1220,-1540;ka50:2:-1840,1340,-1540;cranes:0:1900,110,-1700;cranes:1:2000,110,-1700;cranes:2:2100,110,-1700;cranes:3:2200,110,-1700;cranes:4:2300,110,-1700;cranes:5:1900,110,-1600;cranes:6:2000,110,-1600;cranes:7:2100,110,-1600;cranes:8:2200,110,-1600;cranes:9:2300,110,-1600;cranes:10:1900,110,-1500;cranes:11:2000,110,-1500;cranes:12:2100,110,-1500;cranes:13:2200,110,-1500;cranes:14:2300,110,-1500;cranes:15:1900,110,-1400;cranes:16:2000,110,-1400;cranes:17:2100,110,-1400;controls:0:2200,110,-1400;controls:1:2300,110,-1400;controls:2:1900,110,-1300;controls:3:2000,110,-1300;controls:4:2100,110,-1300;controls:5:2200,110,-1300;controls:6:2300,110,-1300;controls:7:1900,110,-1200;controls:8:2000,110,-1200;controls:9:2100,110,-1200;controls:10:2200,110,-1200;towers:0:2300,110,-1200;towers:1:1900,110,-1100;towers:2:2000,110,-1100;towers:3:2100,110,-1100;towers:4:2200,110,-1100;towers:5:2300,110,-1100;towers:6:1900,110,-1000;towers:7:2000,110,-1000;towers:8:2100,110,-1000;towers:9:2200,110,-1000;towers:10:2300,110,-1000;fuel-small:0:-2300,64,-1650;fuel-small:1:-2200,64,-1650;fuel-small:2:-2100,64,-1650;fuel-small:3:-2000,64,-1650;fuel-small:4:-1900,64,-1650;fuel-small:5:-2300,64,-1550;fuel-medium:0:-2200,64,-1550;fuel-medium:1:-2100,64,-1550;fuel-medium:2:-2000,64,-1550;fuel-medium:3:-1900,64,-1550;fuel-medium:4:-2300,64,-1450;fuel-medium:5:-2200,64,-1450;fuel-medium:6:-2100,64,-1450;fuel-medium:7:-2000,64,-1450;fuel-medium:8:-1900,64,-1450;fuel-large:0:-2300,64,-1350;fuel-large:1:-2200,64,-1350;fuel-large:2:-2100,64,-1350;fuel-large:3:-2000,64,-1350;fuel-large:4:-1900,64,-1350;fuel-large:5:-2300,64,-1250;fuel-large:6:-2200,64,-1250;fuel-large:7:-2100,64,-1250;fuel-large:8:-2000,64,-1250;fuel-large:9:-1900,64,-1250;fuel-large:10:-2300,64,-1150;fuel-large:11:-2200,64,-1150;gas:0:-2100,64,-1150;gas:1:-2000,64,-1150;gas:2:-1900,64,-1150;gas:3:-2300,64,-1050;pumps:0:-2200,64,-1050;pumps:1:-2100,64,-1050;refinery:0:-2000,64,-1050;refinery:1:-1900,64,-1050;stacks:0:-2300,64,-950;stacks:1:-2200,64,-950;stacks:2:-2100,64,-950;stacks:3:-2000,64,-950;aa:0:1900,110,-900;aa:1:2000,110,-900;aa:2:2100,110,-900;aa:3:2200,110,-900;sam:0:2300,110,-900;tankers:0:1650,32,100;tankers:1:1950,32,100;yellow:0:-520,900,-2400;yellow:1:-260,1020,-2400;yellow:2:0,1140,-2400;yellow:3:260,900,-2400;yellow:4:520,1020,-2400".split(";");
		const actual: string[] = [];
		const plan = AC04WorldPlanner.Build(5);
		let target = 0;
		for (const group of AC04MissionData.Get(5).roster) for (let i = 0; i < group.count; i++) {
			const p = AC04WorldPlanner.UnitPosition(5, group, i);
			actual.push(`${group.id}:${i}:${p.x},${p.y},${p.z}`);
			if (group.domain === "ground" || group.domain === "naval") {
				const built = plan.targets[target++];
				expect({ x: built.x, y: built.baseY, z: built.z }).toEqual(p);
			}
		}
		expect(actual).toEqual(expected);
		expect(actual.size()).toBe(121);
		expect(plan.targets.size()).toBe(target);
	});

	it("uses the intended Rigley bomber clusters and exactly four Shezna summit air lifts", () => {
		const expected = [[-1311.5,-1467],[-1311.5,-1332],[-1176.5,-1399.5],[-752.5,-963.5],[-655,-843.5],[-520,-843.5],[-231.5,-859.5],[-96.5,-859.5],[38.5,-859.5],[-218,-1710],[-83,-1710]];
		const m2 = AC04MissionData.Get(2), plan = AC04WorldPlanner.Build(2);
		let bomber = 0, target = 0;
		for (const g of m2.roster) for (let i = 0; i < g.count; i++) {
			const p = AC04WorldPlanner.UnitPosition(2, g, i);
			if (g.type === "Tu-95") { expect([p.x, p.z]).toEqual(expected[bomber++]); expect(p.y).toBe(64); }
			if (g.domain === "ground" || g.domain === "naval") {
				const built = plan.targets[target++];
				expect({ x: built.x, y: built.baseY, z: built.z }).toEqual(p);
			}
		}
		expect(bomber).toBe(11);
		const m3 = AC04MissionData.Get(3), lifts: string[] = [];
		for (const g of m3.roster) if (g.domain === "air" && g.site === "radar-west") for (let i = 0; i < g.count; i++) {
			const p = AC04WorldPlanner.UnitPosition(3, g, i);
			lifts.push(`${g.id}:${i}:${p.x},${p.y},${p.z}`);
		}
		expect(lifts).toEqual(["ch47:0:-2690,1050,-2100", "f16:0:-2430,1050,-2100", "f16-reinforcement:0:-2170,1050,-2100", "f16-reinforcement:1:-1910,1050,-2100"]);
	});

	it("leave other missions untouched and keep spawn, return line and M5 sites", () => {
		for (const id of [6, 12, 18]) {
			const layout = AC04WorldPlanner.Layout(id), m = AC04MissionData.Get(id), here = { x: 1, y: 2, z: 3 };
			expect(refineEarlyLayout(id, layout)).toBe(layout);
			expect(refineEarlyUnitPosition(m, layout, m.roster[0], 0, here)).toBe(here);
			const plan = fresh(id), before = plan.ops.size();
			refineEarlyWorld(m, layout, plan);
			expect(plan.ops.size()).toBe(before);
		}
		for (const id of EARLY) {
			const base = AC04WorldPlanner.Layout(id), once = refineEarlyLayout(id, base), twice = refineEarlyLayout(id, once);
			expect(once.spawn).toEqual(base.spawn);
			expect(once.returnZ).toBe(base.returnZ);
			expect(twice).toEqual(once);
		}
		const m5 = AC04WorldPlanner.Layout(5), r5 = refineEarlyLayout(5, m5);
		for (const name of ["refinery", "rigs", "sea", "south-patrol", "rig-patrol", "refinery-patrol"]) expect(r5.sites[name]).toEqual(m5.sites[name]);
	});

	it("re-places only M2/M3 ground units (plus M3 summit air lift); M1, M4 and M5 are unchanged", () => {
		for (const id of [1, 4, 5]) for (const u of build(id).units) expect(u.p).toBe(u.current);
		for (const id of [2, 3]) {
			const b = build(id), ground = b.units.filter((u) => u.g.domain === "ground");
			for (const u of b.units.filter((v) => v.g.domain === "air")) {
				expect(u.p.x).toBe(u.current.x);
				expect(u.p.z).toBe(u.current.z);
				expect(u.p.y).toBeGreaterThanOrEqual(u.current.y);
			}
			for (let a = 0; a < ground.size(); a++) for (let c = a + 1; c < ground.size(); c++) expect(dist(ground[a].p, ground[c].p)).toBeGreaterThanOrEqual(100);
			for (const u of ground) expect(refineEarlyUnitPosition(b.mission, b.layout, u.g, u.i, u.p)).toEqual(u.p);
		}
	});

	it("keeps every authored budget and the engine's unsplit voxel cap", () => {
		for (const id of EARLY) {
			const plan = finalize(build(id));
			expect(build(id).plan.parts.size()).toBeLessThanOrEqual(EARLY_PART_BUDGET);
			expect(build(id).plan.ops.size()).toBeLessThanOrEqual(EARLY_OP_BUDGET);
			for (const op of plan.ops) if (op.shape === "wedge" || op.shape === "ball") expect(earlyRegionCells(op)).toBeLessThan(EARLY_UNSPLIT_MAX);
			for (const p of plan.parts) expect(math.max(p.sx, p.sy, p.sz)).toBeLessThanOrEqual(2048);
			expect(plan.parts.some((p) => p.name === "Old greybox")).toBe(false);
		}
	});

	it("is idempotent when the world hook runs twice on the same plan", () => {
		for (const id of EARLY) {
			const b = build(id), ops = b.plan.ops.size(), parts = b.plan.parts.size(), samples = b.plan.air.size();
			refineEarlyWorld(b.mission, b.layout, b.plan);
			expect(b.plan.ops.size()).toBe(ops);
			expect(b.plan.parts.size()).toBe(parts);
			expect(b.plan.air.size()).toBe(samples);
		}
	});

	it("exposes every ground target, floats every ship and clears every air spawn and audited sample", () => {
		for (const id of EARLY) {
			const b = build(id), plan = finalize(b);
			for (const u of b.units) {
				if (u.g.domain === "naval") {
					const t = terrainTop(plan.ops, u.p.x, u.p.z);
					expect(t.water).toBe(SEA);
					expect(solidPartsNear(plan, u.p.x, u.p.z, 150).size()).toBe(0);
				} else if (u.g.domain === "ground") {
					const covering = solidPartsNear(plan, u.p.x, u.p.z, 32).filter((p) => p.y + p.sy / 2 > u.p.y + 0.5);
					expect(covering.size()).toBe(0);
					if (u.g.site === "rigs") expect(solidPartsNear(plan, u.p.x, u.p.z, 0).some((p) => math.abs(p.y + p.sy / 2 - M05_DECK_TOP) < 0.01)).toBe(true);
					else expect(terrainTop(plan.ops, u.p.x, u.p.z).solid).toBe(u.p.y);
				} else expect(solidTopWithin(plan, u.p.x, u.p.z, 60)).toBeLessThan(u.p.y - 60);
			}
			for (const s of plan.air) expect(solidTopWithin(plan, s.x, s.z, s.rad)).toBeLessThanOrEqual(s.limit);
			expect(plan.air.some((s) => s.label.sub(1, EARLY_AIR_PREFIX.size()) === EARLY_AIR_PREFIX)).toBe(true);
		}
	});

	it("M1 builds Newfield Island under the bomber route with Allenfort, Belta Port and Anderson Crater", () => {
		const b = build(1), plan = finalize(b);
		// Island axis SW->NE: both tips are land-adjacent sea, the centre is land.
		expect(terrainTop(plan.ops, m01World(-1200, 0).x, m01World(-1200, 0).z).water).toBe(undefined);
		expect(terrainTop(plan.ops, m01World(2700, 0).x, m01World(2700, 0).z).water).toBe(SEA);
		// Allenfort runway on dry, level land at the north tip; Belta Port south-east of it.
		const rw = b.plan.parts.find((p) => p.name === "Allenfort runway")!;
		expect(m01Local(rw.x, rw.z)[0]).toBeGreaterThan(1500);
		for (const k of [-0.45, 0, 0.45]) {
			const p = m01World(M01_RUNWAY.s + k * M01_RUNWAY.length, 0), t = terrainTop(plan.ops, p.x, p.z);
			expect(t.water).toBe(undefined);
			expect(t.solid).toBe(LAND);
		}
		expect(rw.z).toBeLessThan(b.layout.spawn.z);
		const blocks = b.plan.parts.filter((p) => p.name === "Belta Port block");
		expect(blocks.size()).toBeGreaterThanOrEqual(8);
		for (const p of blocks) { const [, n] = m01Local(p.x, p.z), [, se] = m01HalfWidths(m01Local(p.x, p.z)[0]); expect(n).toBeLessThan(se); expect(terrainTop(plan.ops, p.x, p.z).water).toBe(undefined); }
		// Flooded crater bowl connected to the sea through its SSW breach.
		const c = m01World(M01_CRATER.s, M01_CRATER.n);
		expect(terrainTop(plan.ops, c.x, c.z).water).toBe(SEA);
		// Probe the breach beside (not on) the small islet authored in its mouth.
		for (const t of [0.2, 0.5, 0.95]) { const p = m01World(M01_CRATER.s - 600 * t, M01_CRATER.n + 190 * t); expect(terrainTop(plan.ops, p.x, p.z).water).toBe(SEA); }
		const rim = m01World(M01_CRATER.s + M01_CRATER.rim, M01_CRATER.n);
		expect(terrainTop(plan.ops, rim.x, rim.z).solid).toBeGreaterThan(LAND + 60);
		// Mountains are real but stay below every bomber; spawn is over open sea with a clear nose.
		let peak = 0;
		for (let s = -2000; s <= 1400; s += 100) for (let n = -500; n <= 100; n += 100) { const p = m01World(s, n); peak = math.max(peak, terrainTop(plan.ops, p.x, p.z).solid); }
		expect(peak).toBeGreaterThan(400);
		for (const u of b.units) if (u.g.id === "bombers") expect(u.p.y - peak).toBeGreaterThan(400);
		expect(terrainTop(plan.ops, b.layout.spawn.x, b.layout.spawn.z).water).toBe(SEA);
		for (let dz = 0; dz <= 500; dz += 50) expect(solidTopWithin(plan, b.layout.spawn.x, b.layout.spawn.z - dz, 20)).toBeLessThan(b.layout.spawn.y - 30);
		expect(b.plan.parts.filter((p) => p.name.find("Fort Grays")[0] !== undefined).every((p) => !p.solid)).toBe(true);
	});

	it("M2 lays out Rigley's dispersed ramp, a clear runway and the substation on the southern approach", () => {
		const b = build(2), plan = finalize(b), rw = M02_RUNWAY;
		const bombers = b.units.filter((u) => u.g.id === "parked-bombers");
		expect(bombers.size()).toBe(11);
		for (let a = 0; a < bombers.size(); a++) for (let c = a + 1; c < bombers.size(); c++) expect(dist(bombers[a].p, bombers[c].p)).toBeGreaterThanOrEqual(130);
		for (const u of b.units.filter((v) => v.g.domain === "ground")) {
			const pad = u.g.type === "Tu-95" ? 70 : 45;
			const clear = math.abs(u.p.x - rw.x) - rw.width / 2 - pad > 0 || math.abs(u.p.z - rw.z) - rw.length / 2 - pad > 0;
			expect(clear).toBe(true);
		}
		const west = bombers.filter((u) => u.p.x < rw.x).size(), east = bombers.filter((u) => u.p.x > rw.x).size();
		expect(west).toBeGreaterThan(0);
		expect(east).toBeGreaterThan(0);
		const sub = b.units.find((u) => u.g.id === "substation")!;
		expect(sub.p).toEqual(M02_SUBSTATION);
		expect(sub.p.z).toBeGreaterThan(rw.z + rw.length);
		expect(sub.p.z).toBeLessThan(b.layout.spawn.z);
		// The runway itself is solid, unobstructed asphalt on level ground.
		const runway = b.plan.parts.find((p) => p.name === "Rigley runway")!;
		expect(runway.solid).toBe(true);
		for (const dz of [-500, 0, 500]) expect(solidTopWithin(plan, rw.x, rw.z + dz, 40)).toBeLessThanOrEqual(LAND + 4.5);
	});

	it("M3 raises two Mt. Shezna summit chains above a low southern return", () => {
		const b = build(3), plan = finalize(b);
		for (const chain of [M03_EAST, M03_WEST]) {
			expect(terrainTop(plan.ops, chain.center.x, chain.center.z).solid).toBe(chain.center.y);
			// Real relief: the summit stands far above the valley 1,400 studs south.
			expect(terrainTop(plan.ops, chain.center.x, chain.center.z + 1400).solid).toBeLessThan(LAND + 120);
		}
		const radars = b.units.filter((u) => u.g.type === "RADAR");
		expect(radars.size()).toBe(9);
		for (const u of radars) expect(u.p.y).toBe(u.g.site === "radar-east" ? M03_EAST.center.y : M03_WEST.center.y);
		// The ridge line (north) is above the old barrage-free 400 ceiling; the return descent south is open.
		expect(terrainTop(plan.ops, 0, -3380).solid).toBeGreaterThan(500);
		for (let x = -3000; x <= 3000; x += 500) for (let z = 0; z <= 3200; z += 400) expect(terrainTop(plan.ops, x, z).solid).toBeLessThanOrEqual(LAND + 1);
	});

	it("M4 places a coast with wind farms and creates no ground objectives", () => {
		const b = build(4), plan = finalize(b);
		expect(b.units.some((u) => u.g.domain !== "air")).toBe(false);
		for (const z of [-3000, 0, 3000]) {
			expect(terrainTop(plan.ops, m04CoastX(z) - 400, z).water).toBe(undefined);
			expect(terrainTop(plan.ops, m04CoastX(z) + 400, z).water).toBe(SEA);
		}
		const towers = b.plan.parts.filter((p) => p.name === "Wind turbine tower base");
		expect(towers.size()).toBeGreaterThanOrEqual(12);
		for (const t of towers) { const g = terrainTop(plan.ops, t.x, t.z); expect(g.water).toBe(undefined); expect(g.solid).toBe(LAND); }
		for (const p of b.plan.parts) if (p.name.find("blade")[0] !== undefined) expect(p.solid).toBe(false);
	});

	it("M5 keeps production placement and puts the refinery on the coast and rigs on a deck at sea", () => {
		const b = build(5), plan = finalize(b), types = new Set(b.mission.roster.map((g) => g.type));
		for (const u of b.units) expect(u.p).toBe(u.current);
		for (const u of b.units.filter((v) => v.g.site === "refinery")) {
			expect(u.p.x).toBeLessThan(m05CoastX(u.p.z) - 400);
			expect(terrainTop(plan.ops, u.p.x, u.p.z).water).toBe(undefined);
		}
		for (const u of b.units.filter((v) => v.g.site === "rigs")) {
			expect(math.abs(u.p.x - M05_DECK.x)).toBeLessThanOrEqual(M05_DECK.sx / 2 - 60);
			expect(math.abs(u.p.z - M05_DECK.z)).toBeLessThanOrEqual(M05_DECK.sz / 2 - 30);
			expect(u.p.y).toBe(M05_DECK_TOP);
			expect(terrainTop(plan.ops, u.p.x, u.p.z).water).toBe(SEA);
		}
		// Decoration never reuses a scored type name, and no decorative hull exists.
		for (const p of b.plan.parts) { expect(types.has(p.name)).toBe(false); expect(p.name.find("Hull")[0]).toBe(undefined); }
		// Relocated player arrives above the deck clear of every structure.
		const rigs = b.layout.sites.rigs;
		expect(solidTopWithin(plan, rigs.x, rigs.z, 120)).toBeLessThan(600 - 100);
	});
});
