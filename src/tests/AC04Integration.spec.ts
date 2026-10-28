import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04MissionData } from "../shared/AC04MissionData";
import { AC04Runner, type AC04Run } from "../shared/AC04Runner";
import { AC04WorldPlanner } from "../shared/AC04WorldData";
import { terrainTop } from "../shared/WorldPlan";
import { middleDeckMounted } from "../shared/ac04/rebuild/MiddleCampaign";
import { middleDeckHost, middleHullHasComponents, middleEscortSpawn } from "../shared/ac04/rebuild/MiddleWorld";
import { lateMegalithEscapeUpdate, type LateEscapeTracker } from "../shared/ac04/rebuild/LateMegalith";
import { lateFormationWaypoint, lateLockDenied, lateM14FinalMissileOffset, lateM14WaveTwoLaneX, lateMissilePastDefense } from "../shared/ac04/rebuild/LateRuntime";

function kill(run: AC04Run, id: string): void {
	const g = run.mission.roster.find((g) => g.id === id)!;
	run.spawned.add(id);
	for (let i = 0; i < g.count; i++) expect(AC04Runner.RecordKill(run, g, AC04MissionData.InstanceId(g, i), 10)).toBe(true);
}
const escape = AC04WorldPlanner.Layout(18).escape!;
const sample = (t: LateEscapeTracker, x: number, y: number, z = -1150) => lateMegalithEscapeUpdate(t, escape, 300, x, y, z, 10);
describe("AC04 composed campaign runtime", () => {
	it("requires continuous upward passage inside the real shaft and ignores overflight", () => {
		const t: LateEscapeTracker = {};
		expect(sample(t, 0, 900)).toBe(false);expect(sample(t, 0, 1000)).toBe(false);
		expect(sample(t, 0, 600)).toBe(false);expect(sample(t, 0, 740)).toBe(false);expect(sample(t, 0, 800)).toBe(true);
		expect(sample(t, 0, 850)).toBe(false);
	});
	it("discards earlier shaft visits, lateral flybacks and out-of-bounds crossings", () => {
		const t: LateEscapeTracker = {};
		sample(t, 0, 600);sample(t, 500, 650);expect(sample(t, 0, 900)).toBe(false);
		sample(t, 0, 600);expect(sample(t, 200, 800)).toBe(false);
		sample(t, 0, 600);expect(sample(t, 0, 800, -800)).toBe(false);
		// A new retry tracker has no remembered approach.
		expect(sample({}, 0, 800)).toBe(false);
	});
	it("retains authoritative core-before-success ordering only for an actual shaft crossing", () => {
		const run = AC04Runner.New(18, 0);
		for (const id of ["generator-west", "generator-east", "generator-north"]) kill(run, id);
		const t: LateEscapeTracker = {};
		if (sample(t, 0, 950)) AC04Runner.Escape(run, 10);
		expect(run.outcome).toBeUndefined();
		sample(t, 0, 600);if (sample(t, 0, 800)) AC04Runner.Escape(run, 10);
		expect(run.reason).toBe("core_not_destroyed");
		const retry = AC04Runner.New(18, 0);
		for (const id of ["generator-west", "generator-east", "generator-north", "core"]) kill(retry, id);
		const ascent: LateEscapeTracker = {};sample(ascent, 0, 600);
		if (sample(ascent, 0, 800)) AC04Runner.Escape(retry, 10);
		expect(retry.outcome).toBe("won");
	});
	it("keeps all final composed Tango Line submarine berths wet, including bow and stern", () => {
		const m = AC04MissionData.Get(10), plan = AC04WorldPlanner.Build(10);
		for (const g of m.roster.filter((g) => g.domain === "naval")) for (let i = 0; i < g.count; i++) {
			const a = AC04WorldPlanner.UnitPosition(10, g, i);
			for (const dz of [-65, 0, 65]) { const top = terrainTop(plan.ops, a.x, a.z + dz);expect(top.water).toBeDefined();expect(top.solid).toBeLessThan(32); }
		}
	});
	it("maps each deck component to a real host and suppresses only those hosts' abstract fire", () => {
		const m = AC04MissionData.Get(6);
		for (const g of m.roster.filter(middleDeckMounted)) for (let i = 0; i < g.count; i++) {
			const host = middleDeckHost(g, i)!;
			expect(m.roster.some((h) => h.id === host && h.domain === "naval")).toBe(true);
			expect(middleHullHasComponents(m, host)).toBe(true);
			const plan = AC04WorldPlanner.Build(6), a = AC04WorldPlanner.UnitPosition(6, g, i);
			expect(plan.targets.some((t) => t.x === a.x && t.z === a.z && t.deck)).toBe(true);
			expect(plan.ops.some((op) => op.material === "Concrete" && op.x === a.x && op.z === a.z && op.sy === 16)).toBe(false);
		}
		expect(middleHullHasComponents(m, "geofon")).toBe(false);
		const run = AC04Runner.New(6, 0);kill(run, "raven");expect(run.score).toBe(150);
		expect(run.groupKills.has("raven-sam")).toBe(false);kill(run, "raven-sam");expect(run.score).toBe(210);
	});
	it("preserves original formation offsets independently of live leader presence", () => {
		const m = AC04MissionData.Get(15), g = m.roster.find((g) => g.id === "tu160")!;
		const lead = AC04WorldPlanner.UnitPosition(15, g, 0), wing = AC04WorldPlanner.UnitPosition(15, g, 5);
		for (const point of g.path!) { const p = lateFormationWaypoint(point, wing, lead);expect(p.x - point.x).toBe(wing.x - lead.x);expect(p.z - point.z).toBe(wing.z - lead.z);expect(p.y - point.y).toBe(wing.y - lead.y); }
	});
	it("splits five missiles per lane after attack and keeps a finite 16-missile score budget", () => {
		for (let i = 0; i < 10; i++) { const station = i < 5 ? -260 : 260;expect(lateM14WaveTwoLaneX(i, station, false)).toBe(station);expect(lateM14WaveTwoLaneX(i, station, true) < 0).toBe(i < 5); }
		const missiles = AC04MissionData.Get(14).roster.filter((g) => g.domain === "missile");
		expect(missiles.reduce((n, g) => n + g.count, 0)).toBe(16);expect(missiles.reduce((n, g) => n + g.count * g.points, 0)).toBe(1700);
		expect(lateM14FinalMissileOffset(0).dy).toBe(0);expect(lateM14FinalMissileOffset(1).dy).toBeGreaterThan(0);
	});
	it("fails a missile at the defended line after steering without dropping earlier missile requirements", () => {
		const run = AC04Runner.New(14, 0), line = AC04WorldPlanner.Layout(14).returnZ;
		expect(lateMissilePastDefense(line - 31, line)).toBe(false);
		if (lateMissilePastDefense(line - 30, line)) AC04Runner.Fail(run, "missile_escaped");
		expect(run.outcome).toBe("failed");expect(run.reason).toBe("missile_escaped");
	});
	it("denies only the source-hidden M13 lock targets and uses live M11 escort altitude", () => {
		expect(lateLockDenied(13, "frigate")).toBe(true);expect(lateLockDenied(13, "balloons")).toBe(true);expect(lateLockDenied(13, "f15e")).toBe(false);expect(lateLockDenied(17, "frigate")).toBe(false);
		const g = AC04MissionData.Get(11).roster.find((g) => g.id === "wave-2")!;
		const a = middleEscortSpawn(11, g, 0, 1200)!, b = middleEscortSpawn(11, g, 0, 900)!;
		expect(a.dx).toBe(1190);expect(a.dz).toBe(-70);expect(a.y / b.y).toBeCloseTo(1200 / 900);
	});
});
