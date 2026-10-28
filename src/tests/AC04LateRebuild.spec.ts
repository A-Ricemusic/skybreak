import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04MissionData, type AC04Mission, type AC04UnitGroup } from "../shared/AC04MissionData";
import { AC04Runner, type AC04Run } from "../shared/AC04Runner";
import { AC04WorldPlanner, type AC04Layout } from "../shared/AC04WorldData";
import { UNSPLIT_MAX } from "../shared/TerrainSchedule";
import { terrainColumn, terrainTop, type PartSpec, type WorldPlan } from "../shared/WorldPlan";
import type { FlightPoint } from "../shared/WorldTypes";
import { LATE_REBUILD_MARK, refineLateMission } from "../shared/ac04/rebuild/LateCampaign";
import { lateToLocal } from "../shared/ac04/rebuild/LateGeometry";
import { lateBuildMegalith, lateMegalithEscapeUpdate, LateMegalithSpec } from "../shared/ac04/rebuild/LateMegalith";
import { LateM13U2Path, LateM15BomberPath, LateM17, lateSurfaceUnits } from "../shared/ac04/rebuild/LatePlacement";
import { lateM14FinalMissileOffset, lateM14WaveTwoLaneX } from "../shared/ac04/rebuild/LateRuntime";
import { refineLateLayout, refineLateUnitPosition, refineLateWorld } from "../shared/ac04/rebuild/LateWorld";
import { LATE_MEGALITH_HATCH_WIRED, LateM14LaneBand, LatePartBudget } from "../shared/ac04/rebuild/LateWorldBuild";

/**
 * Pure contracts for the integrated late-campaign hooks (M13-M18). Fixtures are
 * fresh plans, never AC04WorldPlanner.Build, so this neither assumes nor
 * double-applies integration. Passing here is not a playtest, visual review or
 * FPS measurement.
 */
const LAND = 64, SEA = 32;
const SEA_MAPS = [17, 18];
function fixturePlan(id: number, baseParts: string[] = []): WorldPlan {
	const plan: WorldPlan = { id, name: `fixture ${id}`, theme: "coast", environment: "ocean_clear", lamps: false, ground: LAND, ops: [], parts: [], props: [], targets: [], waterPaths: [], groundPaths: [], air: [], materialColors: [] };
	if (SEA_MAPS.includes(id)) {
		plan.ops.push({ shape: "block", material: "Sand", x: 0, y: -32, z: 0, sx: 8000, sy: 64, sz: 8000, yaw: 0 });
		plan.ops.push({ shape: "block", material: "Water", x: 0, y: 16, z: 0, sx: 8000, sy: 32, sz: 8000, yaw: 0 });
		plan.waterY = SEA;
	} else plan.ops.push({ shape: "block", material: id === 16 ? "Sand" : "Grass", x: 0, y: LAND - 8, z: 0, sx: 8000, sy: 16, sz: 8000, yaw: 0 });
	// A base-style wedge proves the refinement replaces outdated relief deliberately.
	if (id === 13 || id === 14 || id === 16) plan.ops.push({ shape: "wedge", material: "Rock", x: 0, y: 300, z: 0, sx: 200, sy: 500, sz: 600, yaw: 0 });
	for (const name of baseParts) plan.parts.push({ name, shape: "block", x: 0, y: 200, z: 0, sx: 50, sy: 50, sz: 50, yaw: 0, color: [1, 1, 1], material: "Concrete", solid: true, grounded: false });
	return plan;
}
const BASE_PARTS: { [id: number]: string[] } = { 15: ["City block", "Window ribbon", "Runway"], 16: ["Defensive earthwork"], 17: ["City block", "Flooded building", "Silver Bridge", "Headquarters landfill"], 18: ["Megalith armored quadrant", "AC04CoreGate", "East-west tunnel roof"] };
interface Prepared { m: AC04Mission; l: AC04Layout; plan: WorldPlan; units: Array<{ group: AC04UnitGroup; index: number; at: FlightPoint; authored: boolean }> }
function prepare(id: number): Prepared {
	const m = refineLateMission(AC04MissionData.Get(id)), l = refineLateLayout(id, AC04WorldPlanner.Layout(id));
	const plan = fixturePlan(id, BASE_PARTS[id] ?? []);
	refineLateWorld(m, l, plan);
	return { m, l, plan, units: lateSurfaceUnits(m, l) };
}
const LATE = [13, 14, 15, 16, 17, 18];
function insidePart(p: PartSpec, x: number, y: number, z: number, pad: number): boolean {
	if (math.abs(y - p.y) > p.sy / 2 + pad) return false;
	const [lx, lz] = lateToLocal(x - p.x, z - p.z, p.yaw);
	const hz = p.shape === "cylinder" || p.shape === "ball" ? p.sx / 2 : p.sz / 2;
	return math.abs(lx) <= p.sx / 2 + pad && math.abs(lz) <= hz + pad;
}
function blockers(plan: WorldPlan, a: FlightPoint, b: FlightPoint, radius: number, ignore: string[] = []): string[] {
	const hits = new Set<string>();
	const len = math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2), n = math.max(1, math.ceil(len / 15));
	for (let k = 0; k <= n; k++) {
		const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n, z = a.z + (b.z - a.z) * k / n;
		for (const p of plan.parts) if (p.solid && !ignore.includes(p.name) && insidePart(p, x, y, z, radius)) hits.add(p.name);
		for (const s of terrainColumn(plan.ops, x, z)) if (s.material !== "Water" && s.hi > y - radius && s.lo < y + radius) hits.add("Terrain");
	}
	const out: string[] = [];
	for (const h of hits) out.push(h);
	return out;
}
function solidAbove(plan: WorldPlan, x: number, z: number, y: number): string | undefined {
	for (const p of plan.parts) if (p.solid && p.y + p.sy / 2 > y && insidePart(p, x, p.y, z, 0)) return p.name;
	return undefined;
}
function run(m: AC04Mission): AC04Run { const s = AC04Runner.New(m.id, 0); s.mission = m; return s; }
function kill(s: AC04Run, id: string, now: number, count?: number): void {
	const g = s.mission.roster.find((r) => r.id === id)!;
	s.spawned.add(id);
	for (let i = 0; i < (count ?? g.count); i++) AC04Runner.RecordKill(s, g, AC04MissionData.InstanceId(g, i), now);
}
const group = (m: AC04Mission, id: string) => m.roster.find((g) => g.id === id)!;
const typeTotals = (m: AC04Mission) => { const t = new Map<string, number>(); for (const g of m.roster) t.set(g.type, (t.get(g.type) ?? 0) + g.count); return t; };

describe("AC04 late rebuild hooks (pure fixtures)", () => {
	it("touches only M13-M18, is idempotent, and keeps phases, timers, thresholds and identities", () => {
		for (let id = 1; id <= 12; id++) {
			expect(refineLateMission(AC04MissionData.Get(id))).toBe(AC04MissionData.Get(id));
			const layout = AC04WorldPlanner.Layout(id);
			expect(refineLateLayout(id, layout)).toBe(layout);
			const here = { x: 1, y: 2, z: 3 };
			expect(refineLateUnitPosition(AC04MissionData.Get(id), layout, AC04MissionData.Get(id).roster[0], 0, here)).toBe(here);
		}
		for (const id of LATE) {
			const base = AC04MissionData.Get(id), before = base.roster.map((g) => `${g.id}:${g.count}:${g.points}`).join("|"), m = refineLateMission(base);
			expect(m).toBe(base); // common manifest already integrates the refinement exactly once
			expect(m.id).toBe(base.id); expect(m.title).toBe(base.title); expect(m.sRank).toBe(base.sRank);
			expect(m.phases.size()).toBe(base.phases.size());
			for (let i = 0; i < m.phases.size(); i++) {
				expect(m.phases[i].seconds).toBe(base.phases[i].seconds); expect(m.phases[i].threshold).toBe(base.phases[i].threshold);
				expect(m.phases[i].kind).toBe(base.phases[i].kind); expect(m.phases[i].requiredGroupIds.join(",")).toBe(base.phases[i].requiredGroupIds.join(","));
				for (const required of m.phases[i].requiredGroupIds) expect(m.roster.find((g) => g.id === required)).toBeDefined();
			}
			expect(m.gaps.includes(LATE_REBUILD_MARK)).toBe(true);
			expect(refineLateMission(m)).toBe(m);
			const once = refineLateLayout(id, AC04WorldPlanner.Layout(id)), twice = refineLateLayout(id, once);
			for (const [name, p] of pairs(once.sites)) { expect(twice.sites[name as string].x).toBe(p.x); expect(twice.sites[name as string].z).toBe(p.z); }
			expect(twice.returnZ).toBe(once.returnZ);
			// Base input objects are never mutated.
			expect(base.roster.map((g) => `${g.id}:${g.count}:${g.points}`).join("|")).toBe(before);
			const ids = new Set<string>();
			for (const g of m.roster) { expect(ids.has(g.id)).toBe(false); ids.add(g.id); if (g.afterGroup !== undefined) expect(ids.has(g.afterGroup) || m.roster.some((r) => r.id === g.afterGroup)).toBe(true); }
		}
	});
	it("preserves per-type unit totals except the two sourced corrections", () => {
		for (const id of LATE) {
			const before = typeTotals(AC04MissionData.Get(id)), after = typeTotals(refineLateMission(AC04MissionData.Get(id)));
			for (const [unitType, count] of before) expect(after.get(unitType)).toBe(id === 17 && unitType === "TANK" ? 29 : count);
		}
		// M17: 55 ground including the scored bridge (wiki 55/2530, Mitoro 55).
		const m17 = refineLateMission(AC04MissionData.Get(17));
		expect(m17.roster.filter((g) => g.domain === "ground").reduce((n, g) => n + g.count, 0)).toBe(55);
		// M18 secondary missiles 300 (Shotgunnova/Mitoro + wiki S-rank prose).
		expect(group(refineLateMission(AC04MissionData.Get(18)), "secondary-missiles").points).toBe(300);
	});
	it("keeps every S rank and score gate arithmetically reachable, with source-consistent margins", () => {
		const total = (m: AC04Mission, filter: (g: AC04UnitGroup) => boolean) => {
			let sum = 0;
			for (const g of m.roster) if (filter(g) && !g.invulnerable && !g.protected) sum += g.points * (m.id === 15 && g.id === "yellow" ? math.min(4, g.count) : g.count);
			return sum;
		};
		for (const id of LATE) {
			const m = refineLateMission(AC04MissionData.Get(id));
			expect(total(m, () => true)).toBeGreaterThanOrEqual(m.sRank);
			const first = m.phases[0];
			if (first.kind === "score") expect(total(m, (g) => g.phase === 0)).toBeGreaterThanOrEqual(first.threshold!);
		}
		// M14: S 2020 is exactly all missiles + both F-22 + XB-70 at 200; at 120 it is unreachable.
		const m14 = refineLateMission(AC04MissionData.Get(14));
		expect(total(m14, () => true)).toBe(2020);
		expect(total(m14, () => true) - 80).toBeLessThan(m14.sRank);
		// M18: fixed targets 3690 need at least seven of fifteen Yellows ("at least half").
		const m18 = refineLateMission(AC04MissionData.Get(18)), fixed = total(m18, (g) => g.id !== "yellow");
		expect(fixed).toBe(3690);
		expect(fixed + 7 * 90).toBeGreaterThanOrEqual(m18.sRank); expect(fixed + 6 * 90).toBeLessThan(m18.sRank);
	});
	it("gates late waves through the real runner semantics", () => {
		const m14 = refineLateMission(AC04MissionData.Get(14)), s14 = run(m14);
		kill(s14, "missile-1", 10, 2); expect(AC04Runner.GroupDue(s14, group(m14, "missile-2"))).toBe(false);
		kill(s14, "missile-1", 11, 3); expect(AC04Runner.GroupDue(s14, group(m14, "missile-2"))).toBe(true);
		kill(s14, "missile-2", 40);
		expect(AC04Runner.GroupDue(s14, group(m14, "missile-final"))).toBe(false); // two wave-1 missiles still alive
		const w1 = group(m14, "missile-1");
		for (const i of [3, 4]) AC04Runner.RecordKill(s14, w1, AC04MissionData.InstanceId(w1, i), 45);
		expect(AC04Runner.GroupDue(s14, group(m14, "missile-final"))).toBe(true);
		AC04Runner.Tick(s14, 59); expect(AC04Runner.GroupDue(s14, group(m14, "f22"))).toBe(false);
		AC04Runner.Tick(s14, 60); expect(AC04Runner.GroupDue(s14, group(m14, "f22"))).toBe(true);
		expect(s14.outcome).toBeUndefined();
		const m16 = refineLateMission(AC04MissionData.Get(16)), s16 = run(m16);
		expect(AC04Runner.GroupDue(s16, group(m16, "tanks-center-r"))).toBe(false);
		kill(s16, "tanks-center", 30, 15); expect(AC04Runner.GroupDue(s16, group(m16, "tanks-center-r"))).toBe(false);
		kill(s16, "tanks-center", 31); expect(AC04Runner.GroupDue(s16, group(m16, "tanks-center-r"))).toBe(true);
		expect(AC04Runner.GroupDue(s16, group(m16, "tanks-north"))).toBe(true);
		const m17 = refineLateMission(AC04MissionData.Get(17)), s17 = run(m17);
		kill(s17, "aa", 20, 11); expect(AC04Runner.GroupDue(s17, group(m17, "armor-reinforce"))).toBe(false);
		kill(s17, "subs", 21, 1); expect(AC04Runner.GroupDue(s17, group(m17, "armor-reinforce"))).toBe(true);
		expect(AC04Runner.GroupDue(s17, group(m17, "osprey"))).toBe(false); AC04Runner.Tick(s17, 600); expect(AC04Runner.GroupDue(s17, group(m17, "osprey"))).toBe(true);
		const m15 = refineLateMission(AC04MissionData.Get(15)), s15 = run(m15);
		kill(s15, "ef-gov", 50); AC04Runner.Tick(s15, 79); expect(AC04Runner.GroupDue(s15, group(m15, "ef-gov-r1"))).toBe(false);
		AC04Runner.Tick(s15, 80); expect(AC04Runner.GroupDue(s15, group(m15, "ef-gov-r1"))).toBe(true);
	});
	it("places every late ground and naval unit deliberately, separated, and on the right surface", () => {
		for (const id of LATE) {
			const { plan, units, l } = prepare(id);
			for (const u of units) expect(u.authored).toBe(true);
			for (let i = 0; i < units.size(); i++) for (let j = i + 1; j < units.size(); j++) {
				const a = units[i], b = units[j];
				if (a.group.type === "JAMMER BALLOON" || b.group.type === "JAMMER BALLOON" || id === 18) continue;
				expect(math.sqrt((a.at.x - b.at.x) ** 2 + (a.at.z - b.at.z) ** 2)).toBeGreaterThanOrEqual(85); // 90-stud pads may touch, never stack
			}
			for (const u of units) {
				expect(math.abs(u.at.x)).toBeLessThan(l.bounds); expect(math.abs(u.at.z)).toBeLessThan(l.bounds);
				const t = terrainTop(plan.ops, u.at.x, u.at.z);
				if (u.group.domain === "naval") { expect(t.water).toBeDefined(); expect(t.solid).toBeLessThan(SEA); }
				else if (u.group.type === "JAMMER BALLOON") expect(t.solid).toBeLessThan(u.at.y - 60);
				else if (u.group.type === "JOHNSON BRIDGE") expect(t.water).toBeDefined(); // spans the river; the build pads one central pier
				else if (id !== 18) { expect(t.solid).toBeLessThanOrEqual(u.at.y + 0.01); expect(t.water).toBeUndefined(); }
				if (id !== 18) expect(solidAbove(plan, u.at.x, u.at.z, u.at.y + 1)).toBeUndefined();
				expect(u.at.z).toBeLessThan(l.returnZ);
			}
		}
	});
	it("Safe Return: transcribed jammer belt, capped ravine relief, U-2 corridor and eastern river", () => {
		const { plan, units, l } = prepare(13);
		const balloons = units.filter((u) => u.group.id === "balloons");
		expect(balloons.size()).toBe(100);
		let right = 0, left = 0;
		for (const b of balloons) { if (b.at.x > 500 && b.at.x < 2500) right++; if (b.at.x < -1500 && b.at.x > -3500) left++; expect(b.at.z).toBeGreaterThan(-500); expect(b.at.z).toBeLessThan(1700); }
		expect(right).toBeGreaterThan(left); // Shotgunnova: dense middle-right of the canyon
		let tall = 0; for (const op of plan.ops) if (op.shape === "wedge" && op.sy >= 450) tall++;
		expect(tall).toBeGreaterThan(40); // real mountains survive the caps
		expect(plan.ops.some((op) => op.shape === "wedge" && op.x === 0 && op.y === 300)).toBe(false); // base lane ridge replaced
		for (let i = 1; i < LateM13U2Path.size(); i++) for (let k = 0; k <= 10; k++) {
			const a = LateM13U2Path[i - 1], b = LateM13U2Path[i], x = a.x + (b.x - a.x) * k / 10, z = a.z + (b.z - a.z) * k / 10, y = a.y + (b.y - a.y) * k / 10;
			expect(terrainTop(plan.ops, x, z).solid).toBeLessThan(y - 150);
		}
		expect(LateM13U2Path[0].z).toBeLessThan(-3000); expect(LateM13U2Path[LateM13U2Path.size() - 1].z).toBeGreaterThan(l.returnZ);
		const u2 = group(refineLateMission(AC04MissionData.Get(13)), "u2");
		expect(u2.path!.size()).toBe(LateM13U2Path.size()); expect(u2.protected).toBe(true); expect(u2.phase).toBe(1);
		const frigate = units.find((u) => u.group.id === "frigate")!;
		expect(frigate.at.x).toBeGreaterThan(2000);
		expect(terrainTop(plan.ops, l.spawn.x, l.spawn.z).solid).toBeLessThan(l.spawn.y - 200);
	});
	it("Breaking Arrows: low lanes stay clear, waves start north of the return line, XB-70 holds the north", () => {
		const { plan, l, m } = prepare(14);
		for (let x = LateM14LaneBand.xMin; x <= LateM14LaneBand.xMax; x += 100) for (let z = -3800; z < l.returnZ; z += 200)
			expect(terrainTop(plan.ops, x, z).solid).toBeLessThanOrEqual(LateM14LaneBand.ceiling);
		const pos = (id: string, i: number) => refineLateUnitPosition(m, l, group(m, id), i, { x: 0, y: 0, z: 0 });
		for (let i = 0; i < 5; i++) { const p = pos("missile-1", i); expect(math.sqrt((p.x - l.spawn.x) ** 2 + (p.z - l.spawn.z) ** 2)).toBeLessThan(1600); expect(p.z).toBeLessThan(l.spawn.z); expect(p.y).toBeGreaterThan(LateM14LaneBand.ceiling + 80); }
		for (let i = 0; i < 10; i++) expect(pos("missile-2", i).z).toBeLessThan(-3100);
		const xb = group(m, "xb70"); for (const q of xb.path!) expect(q.z).toBeLessThan(-3000);
		expect(terrainTop(plan.ops, 0, 3700).water).toBeDefined(); // landing beach and sea behind the line
		// Runtime steer: wave 2 diverges SW/SE once attacked; final weave hugs the eastern glacier edge.
		expect(lateM14WaveTwoLaneX(0, -260, true)).toBeLessThan(-1000); expect(lateM14WaveTwoLaneX(7, 260, true)).toBeGreaterThan(1000);
		expect(lateM14WaveTwoLaneX(7, 260, false)).toBe(260);
		for (let t = 0; t < 30; t += 0.5) { const o = lateM14FinalMissileOffset(t); expect(o.x).toBeGreaterThan(900); expect(o.x).toBeLessThanOrEqual(LateM14LaneBand.xMax); }
	});
	it("Emancipation: three distinct districts, airport and west coast read from altitude", () => {
		const { plan, units, l } = prepare(15);
		expect(plan.parts.some((p) => p.name === "City block" || p.name === "Runway")).toBe(false);
		const heights = (label: string) => plan.parts.filter((p) => p.name === `${label} building`).map((p) => p.sy);
		const gov = heights("New City"), old = heights("Old Towne");
		expect(gov.size()).toBeGreaterThan(30); expect(old.size()).toBeGreaterThan(50);
		const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.size();
		expect(mean(gov)).toBeGreaterThan(mean(old) * 2.5); // high-rise complex vs low old town
		const runway = plan.parts.find((p) => p.name === "San Profetta runway")!;
		expect(runway.sx).toBeGreaterThan(runway.sz * 5); expect(math.abs(runway.z - l.sites.airport.z)).toBeLessThan(1);
		expect(plan.parts.some((p) => p.name === "Old Towne arch crown")).toBe(true);
		expect(terrainTop(plan.ops, -3300, 0).water).toBeDefined();
		const west = units.filter((u) => u.group.id === "launchers" && u.at.x < -1500);
		expect(west.size()).toBe(2);
		for (const u of west) { let coast = false; for (let dx = 100; dx <= 900; dx += 100) if (terrainTop(plan.ops, u.at.x - dx, u.at.z).water !== undefined) coast = true; expect(coast).toBe(true); }
		expect(LateM15BomberPath[0].x).toBeLessThan(-3000);
		for (let i = 1; i < LateM15BomberPath.size(); i++) expect(LateM15BomberPath[i].x).toBeGreaterThan(LateM15BomberPath[i - 1].x); // west to east over the clusters
		expect(l.sites["new-city"].x).toBeLessThan(l.sites.airport.x); expect(l.sites["old-town"].x).toBeGreaterThan(l.sites.airport.x);
		expect(l.sites.airport.z).toBeLessThan(l.sites["new-city"].z); expect(l.spawn.z).toBeGreaterThan(l.sites["new-city"].z);
	});
	it("Whiskey Corridor: four sectors, westernmost pillboxes, salt-flat HQ, mountains never bury targets", () => {
		const { plan, units, l } = prepare(16);
		const centres: Array<[string, FlightPoint]> = [["west", l.sites["west-line"]], ["center", l.sites["defense-lines"]], ["anchor", l.sites["old-anchor"]], ["north", l.sites.headquarters], ["artillery", l.sites.artillery]];
		const sector = (u: { at: FlightPoint }) => { let best = "", d = math.huge; for (const [name, c] of centres) { const e = (u.at.x - c.x) ** 2 + (u.at.z - c.z) ** 2; if (e < d) { d = e; best = name; } } return best; };
		const pts = new Map<string, number>();
		for (const u of units) pts.set(sector(u), (pts.get(sector(u)) ?? 0) + u.group.points);
		expect(pts.get("anchor")!).toBeGreaterThan(1000); expect(pts.get("anchor")!).toBeLessThan(1600); // Shotgunnova ~1200-1300
		expect(pts.get("center")!).toBeGreaterThan(1450); // "about 1500+"
		const pillboxes = units.filter((u) => u.group.id === "pillboxes");
		let westmost = math.huge; for (const u of units) if (u.group.id !== "pillboxes") westmost = math.min(westmost, u.at.x);
		for (const p of pillboxes) expect(p.at.x).toBeLessThan(westmost);
		const hq = l.sites.headquarters, art = l.sites.artillery;
		expect(art.x).toBeGreaterThan(hq.x); expect(art.z).toBeGreaterThan(hq.z); // artillery SE of HQ (wiki trivia)
		const column = terrainColumn(plan.ops, hq.x + 300, hq.z + 300);
		expect(column[column.size() - 1].material).toBe("Pavement");
		let peak = 0; for (let x = -3600; x <= 3600; x += 200) for (let z = -3600; z <= 3600; z += 200) peak = math.max(peak, terrainTop(plan.ops, x, z).solid);
		expect(peak).toBeGreaterThan(600);
		expect(l.spawn.x).toBeGreaterThan(1000); expect(l.spawn.z).toBeGreaterThan(1500); // south-east start
		expect(plan.parts.some((p) => p.name === "Defensive earthwork")).toBe(false);
	});
	it("Farbanti: river-spanning Johnson bridge, flooded south-west, coastal GHQ, Silver Bridge clear of berths", () => {
		const { plan, units, l } = prepare(17);
		const j = units.find((u) => u.group.id === "bridge")!.at;
		expect(terrainTop(plan.ops, j.x + 120, j.z).water).toBeDefined();
		expect(terrainTop(plan.ops, j.x, j.z - 430).water).toBeUndefined(); expect(terrainTop(plan.ops, j.x, j.z + 430).water).toBeUndefined();
		for (const u of units.filter((v) => v.group.id === "armor" && v.index < 8)) expect(u.at.z).toBeLessThan(LateM17.river.zMin);
		const destroyer = units.find((u) => u.group.id === "destroyer")!.at;
		expect(destroyer.z).toBeGreaterThan(LateM17.river.zMin); expect(destroyer.z).toBeLessThan(LateM17.river.zMax);
		const flooded = plan.parts.filter((p) => p.name === "Flooded district building");
		expect(flooded.size()).toBeGreaterThan(10);
		for (const b of flooded) expect(b.y - b.sy / 2).toBeLessThan(SEA);
		for (const sub of units.filter((u) => u.group.id === "subs")) expect(flooded.some((b) => math.sqrt((b.x - sub.at.x) ** 2 + (b.z - sub.at.z) ** 2) < 450)).toBe(true);
		const hq = l.sites.headquarters;
		expect(terrainTop(plan.ops, hq.x - 700, hq.z).water).toBeDefined();
		const deck = plan.parts.find((p) => p.name === "Silver Bridge deck")!;
		expect(terrainTop(plan.ops, deck.x, deck.z).water).toBeDefined();
		expect(terrainTop(plan.ops, deck.x - deck.sx / 2 + 20, deck.z).water).toBeUndefined(); expect(terrainTop(plan.ops, deck.x + deck.sx / 2 - 20, deck.z).water).toBeUndefined();
		for (const ship of units.filter((u) => u.group.domain === "naval")) for (const p of plan.parts) if (p.solid) {
			const [lx, lz] = lateToLocal(ship.at.x - p.x, ship.at.z - p.z, p.yaw);
			expect(math.abs(lx) > p.sx / 2 + 70 || math.abs(lz) > p.sz / 2 + 100).toBe(true);
		}
		for (const p of plan.parts) expect(p.name.find("Johnson Memorial Bridge")[0]).toBeUndefined();
		expect(plan.parts.some((p) => p.name === "Silver Bridge" || p.name === "Headquarters landfill")).toBe(false);
	});
	it("Megalith: source comb topology with clear tunnels, a sealed core tube and a vertical exit", () => {
		const { plan, l, units } = prepare(18), S = LateMegalithSpec;
		expect(plan.parts.filter((p) => p.name === "AC04CoreGate").size()).toBe(1);
		expect(plan.parts.some((p) => p.name === "Megalith armored quadrant")).toBe(false);
		const armY = (S.highFloor + S.highRoof) / 2, ductY = (S.floor + S.barRoof) / 2;
		for (const x of [-720, 720]) expect(blockers(plan, { x, y: armY, z: S.south + 400 }, { x, y: armY, z: S.north - 400 }, 90).size()).toBe(0);
		expect(blockers(plan, { x: S.xMax + 400, y: ductY, z: -1000 }, { x: S.xMin - 400, y: ductY, z: -1000 }, 90).size()).toBe(0);
		const tube = blockers(plan, { x: 0, y: armY, z: S.south + 400 }, { x: 0, y: armY, z: -1300 }, 90);
		expect(tube.join(",")).toBe("AC04CoreGate");
		expect(blockers(plan, { x: 0, y: armY, z: S.south + 400 }, { x: 0, y: armY, z: -1300 }, 90, ["AC04CoreGate"]).size()).toBe(0);
		expect(blockers(plan, { x: 0, y: armY, z: -1150 }, { x: 0, y: 1400, z: -1150 }, 120, [S.hatchName]).size()).toBe(0); // shaft clear after authoritative hatch opening
		for (const wx of [-1500, 1500]) expect(blockers(plan, { x: wx, y: ductY, z: -1000 }, { x: wx, y: 1200, z: -1000 }, 120).size()).toBe(0); // duct windows
		for (const u of units) {
			// Ports stand on the deck: test their body centre, not the contact plane.
			const y = u.group.id === "ports" ? u.at.y + 30 : u.at.y;
			for (const p of plan.parts) if (p.solid) expect(insidePart(p, u.at.x, y, u.at.z, 0)).toBe(false);
			if (u.group.id === "ports" || u.group.id === "secondary-missiles") expect(solidAbove(plan, u.at.x, u.at.z, u.at.y + 1)).toBeUndefined();
		}
		for (const u of units.filter((v) => v.group.id === "ports")) expect(u.at.z).toBeGreaterThan(0);
		// Escape: detector square covers the whole shaft mouth just above the deck.
		expect(l.escape!.y).toBeGreaterThan(S.deck); expect(l.escapeRadius!).toBeGreaterThanOrEqual((S.shaft.zMax - S.shaft.zMin) / 2);
		const core = l.sites.core;
		expect(core.z).toBeGreaterThan(S.shaft.zMin); expect(core.z).toBeLessThan(S.shaft.zMax);
		expect(S.shaft.zMax - S.shaft.zMin).toBeGreaterThanOrEqual(2 * 240 / 1.25); // pull-up at 240 studs/s
		expect(LATE_MEGALITH_HATCH_WIRED).toBe(true);
		expect(plan.parts.some((p) => p.name === S.hatchName && p.solid)).toBe(true);
		const hatched = fixturePlan(18); lateBuildMegalith(hatched, true);
		expect(blockers(hatched, { x: 0, y: armY, z: -1150 }, { x: 0, y: 1400, z: -1150 }, 120).includes(S.hatchName)).toBe(true);
		// Continuous tracker: overflight never counts; a climb from inside the shaft does.
		const over = {}; expect(lateMegalithEscapeUpdate(over, l.escape!, l.escapeRadius!, 0, 900, -1150, 10)).toBe(false);
		const climb = {}; lateMegalithEscapeUpdate(climb, l.escape!, l.escapeRadius!, 0, 600, -1150, 10);
		expect(lateMegalithEscapeUpdate(climb, l.escape!, l.escapeRadius!, 0, 800, -1150, 12)).toBe(true);
	});
	it("stays within explicit terrain, part and build budgets", () => {
		const modelParts = (g: AC04UnitGroup) => g.domain === "naval" ? 12 : g.type === "C-17" ? 12 : g.type === "JOHNSON BRIDGE" ? 6 : g.type === "JAMMER BALLOON" ? 2 : 5;
		for (const id of LATE) {
			const { plan, m } = prepare(id);
			for (const op of plan.ops) if (op.shape === "wedge") expect(math.ceil((op.sx + 8) / 4) * math.ceil((op.sy + 8) / 4) * math.ceil((op.sz + 8) / 4)).toBeLessThan(UNSPLIT_MAX);
			for (const p of plan.parts) { expect(math.max(p.sx, p.sy, p.sz)).toBeLessThanOrEqual(2048); }
			const authored = plan.parts.size() - (BASE_PARTS[id] ?? []).filter((name) => plan.parts.some((p) => p.name === name)).size();
			expect(authored).toBeLessThanOrEqual(LatePartBudget[id]);
			let targetParts = 0; for (const g of m.roster) if (g.domain === "ground" || g.domain === "naval") targetParts += g.count * modelParts(g);
			expect(plan.parts.size() + targetParts).toBeLessThan(1500); // Scenery.Report budget is 1600
			expect(plan.ops.size()).toBeLessThan(400);
		}
	});
});
