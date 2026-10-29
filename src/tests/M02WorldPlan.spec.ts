import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM02Plan, M02, M02_ENVIRONMENT, M02_FILL_CHUNK, M02_RUNWAY, m02Counts, m02Detailed, m02Ground, m02Height, m02TargetLayout } from "../shared/M02WorldPlan";
import { M02_AIRSPACE, M02_START } from "../shared/M02Limits";
import { M01_ENVIRONMENT } from "../shared/M01WorldPlan";
import { MissionCatalog } from "../shared/MissionCatalog";
import { distinctChannels, ENVIRONMENTS, ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { terrainJobs } from "../shared/TerrainSchedule";
import { terrainTop } from "../shared/WorldPlan";
import { weatherPlan, phoneClouds } from "../shared/WeatherRules";

describe("Dormant mission 2 farmland composition", () => {
	const plan = buildM02Plan();
	it("is deterministic and unselected by every mission", () => {
		expect(buildM02Plan()).toEqual(plan);
		expect(buildM02Plan(203).props).never.toEqual(plan.props);
		for (const bp of MissionCatalog.All()) expect(MissionCatalog.WorldKey(bp.id)).never.toBe(plan.key);
	});
	it("exports the full contact roster on flat terrain, with a separate substation", () => {
		const targets = m02TargetLayout();
		for (const [targetType, count] of [["bomber", 11], ["hangar", 7], ["aa", 4], ["control_tower", 1], ["substation", 1]] as const) expect(targets.filter((t) => t.type === targetType).size()).toBe(count);
		for (const [group, count] of [["A", 4], ["B", 3], ["C", 2], ["D", 2]] as const) expect(targets.filter((t) => t.type === "bomber" && t.group === group).size()).toBe(count);
		for (const t of targets) {
			expect(t.y).toBe(32);
			expect(t.y).toBe(terrainTop(plan.ops, t.x, t.z).solid);
			for (const dx of [-48, 0, 48]) for (const dz of [-48, 0, 48]) expect(m02Ground(t.x + dx, t.z + dz)).toBe(t.y);
			expect(math.abs(t.x)).toBeLessThan(M02_AIRSPACE.softHalfWidth);
			expect(math.abs(t.z)).toBeLessThan(M02_AIRSPACE.softHalfWidth);
			const r = t.type === "substation" ? M02.substation : M02.base;
			expect(math.abs(t.x - r.x)).toBeLessThan(r.hx);
			expect(math.abs(t.z - r.z)).toBeLessThan(r.hz);
		}
	});
	it("reserves detail for start, entire corridor, substation and base edges", () => {
		for (let i = 1; i < M02.route.size(); i++) for (let t = 0; t <= 1; t += 0.02) {
			const a = M02.route[i - 1], b = M02.route[i];
			expect(m02Detailed(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(true);
		}
		for (const r of [M02.base, M02.substation]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(m02Detailed(r.x + sx * r.hx, r.z + sz * r.hz)).toBe(true);
		expect(M02_START.y - m02Ground(M02_START.x, M02_START.z)).toBeGreaterThan(450);
		expect(M02_START.headingDegrees).toBe(0);
		for (const pose of [M02_RUNWAY.centreline, M02_RUNWAY.threshold, M02_RUNWAY.northThreshold]) expect(m02Ground(pose.x, pose.z)).toBe(pose.y);
	});
	it("grounds every prop against actual sampled terrain and spans the full footprint", () => {
		for (const p of plan.props) expect(p.y).toBe(terrainTop(plan.ops, p.x, p.z).solid);
		for (const x of [-16256, 16256]) for (let z = -16256; z < 16384; z += 256) expect(terrainTop(plan.ops, x, z).solid).toBe(m02Ground(x, z));
		expect(m02Height(-3500, -11700)).toBeLessThan(24);
		expect(m02Height(-6800, -12500)).toBeGreaterThan(150);
	});
	it("keeps native fills, instance estimates and runtime estimate within local budgets", () => {
		const c = m02Counts(plan);
		print(`M02_ESTIMATE voxels=${c.voxels} jobs=${c.jobs} seconds=${c.estimatedSeconds} parts=${c.parts} props=${c.props} descendants=${c.descendants} detail=${plan.detailCells} coarse=${plan.coarseCells}`);
		for (const job of terrainJobs(plan.ops, M02_FILL_CHUNK)) expect(job.cells).toBeLessThanOrEqual(65536);
		expect(c.voxels).toBeLessThanOrEqual(M02.budget.voxelWrites);
		expect(c.jobs).toBeLessThanOrEqual(M02.budget.jobs);
		expect(c.parts).toBeLessThanOrEqual(M02.budget.parts);
		expect(c.props).toBeLessThanOrEqual(M02.budget.props);
		expect(c.descendants).toBeLessThanOrEqual(M02.budget.descendants);
		expect(c.estimatedSeconds).toBeLessThan(30);
		for (const p of plan.parts) { expect(p.sx).toBeLessThanOrEqual(2048); expect(p.sz).toBeLessThanOrEqual(2048); }
	});
	it("keeps the northbound pylon line clear of runway pavement", () => {
		for (const b of plan.beams) if (b.name === "Pylon leg") {
			expect(b.a[1]).toBe(m02Ground(0, 12500 - math.floor((12500 - b.a[2] + 750) / 1500) * 1500));
			if (b.a[2] < M02_RUNWAY.threshold.z && b.a[2] > M02_RUNWAY.northThreshold.z) expect(math.abs(b.a[0] - M02_RUNWAY.centreline.x)).toBeGreaterThan(64);
		}
	});
	it("preserves the dry grey-green 13:29 overcast on desktop and phone", () => {
		for (const key of ENVIRONMENT_NAMES) expect(distinctChannels(M02_ENVIRONMENT, ENVIRONMENTS[key])).toBeGreaterThanOrEqual(2);
		expect(distinctChannels(M02_ENVIRONMENT, M01_ENVIRONMENT)).toBeGreaterThanOrEqual(2);
		expect(M02_ENVIRONMENT.clock).toBe(13 + 29 / 60);
		expect(weatherPlan(plan.key as "m02_farm_airbase", false, false)).toEqual({});
		expect(phoneClouds("m02_farm_airbase", 0.8, 0.28)).toEqual({ cover: 0.8, density: 0.18 });
	});
});
