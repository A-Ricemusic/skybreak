import { plansEqual, testCheckpoint } from "./TestPacing";
import { weatherPlan, phoneClouds } from "../shared/WeatherRules";
import { MissionCatalog } from "../shared/MissionCatalog";
import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM01Plan, mergeLandColumns, m01Block, M01, M01_ENVIRONMENT, M01_FILL_CHUNK, m01Counts, m01Detailed, m01Height } from "../shared/M01WorldPlan";
import { distinctChannels, ENVIRONMENTS, ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { terrainJobs } from "../shared/TerrainSchedule";
import { polyDist, terrainTop } from "../shared/WorldPlan";

describe("Unselected full-scale M01 world", () => {
	const plan = buildM01Plan();
	it("is selected only by mission 1", () => {
		for (const bp of MissionCatalog.All()) expect(MissionCatalog.WorldKey(bp.id) === plan.key).toBe(bp.id === 1);
	});
	it("is deterministic, including seeded forest dressing", () => {
		expect(plansEqual(buildM01Plan(), plan)).toBe(true);
		expect(buildM01Plan(102).props).never.toEqual(plan.props);
	});
	it("covers every route leg and civic/start footprint with detailed sampling", () => {
		for (let i = 1; i < M01.route.size(); i++) for (let t = 0; t <= 1; t += 0.02) {
			testCheckpoint();
			const a = M01.route[i - 1], b = M01.route[i];
			expect(m01Detailed(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(true);
		}
		for (const r of [M01.city, M01.airbase, M01.carrier, M01.launch]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(m01Detailed(r.x + sx * r.hx, r.z + sz * r.hz)).toBe(true);
		expect(m01Detailed(M01.start.x, M01.start.z)).toBe(true);
	});
	it("keeps actual terrain and structures below the whole bomber altitude band", () => {
		for (const op of plan.ops) if (op.material !== "Water") expect(op.y + op.sy / 2 + 48).toBeLessThan(M01.routeFloor);
		for (const p of plan.parts) if (p.solid) expect(p.y + p.sy / 2 + 48).toBeLessThan(M01.routeFloor);
		// Actual approved bounds include template height and ground-contact offset.
		for (const p of plan.props) if (polyDist(p.x, p.z, M01.route) < 768) expect(p.y + (UploadedAssetSpecs[p.asset].size.Y - UploadedAssetSpecs[p.asset].groundOffset) * p.scale + 48).toBeLessThan(M01.routeFloor);
	});
	it("covers the full sea with one consistent opaque surface above native water", () => {
		for (let x = -16382; x < 16384; x += 256) for (let z = -16382; z < 16384; z += 256) {
			testCheckpoint();
			let surfaces = 0;
			for (const p of plan.parts) if (p.name === "Far sea" && math.abs(x - p.x) < p.sx / 2 && math.abs(z - p.z) < p.sz / 2) surfaces++;
			expect(surfaces).toBeGreaterThanOrEqual(1);
		}
		expect(m01Height(-1600, 1728 + 120 * math.sin(-1600 / 400))).toBeLessThan(32);
		expect(terrainTop(plan.ops, 0, 11200).solid).toBeLessThan(32);
	});
	it("keeps cooperative planning identical and removes artificial surf strips", () => {
		let checkpoints = 0;
		expect(plansEqual(buildM01Plan(101, () => { checkpoints++; }), plan)).toBe(true);
		expect(checkpoints).toBeGreaterThan(1000);
		for (const p of plan.parts) {
			testCheckpoint();
			expect(p.name).never.toBe("Shore surf");
			if (p.name === "Far sea") { expect(p.sx).toBeLessThanOrEqual(2048); expect(p.sz).toBeLessThanOrEqual(2048); }
		}
	});
	it("grounds dressing on the actual planned land", () => {
		for (const p of plan.props) if (p.asset !== "HarbourQuay") expect(p.y).toBe(terrainTop(plan.ops, p.x, p.z).solid);
	});
	it("coalesces land columns without changing occupied voxels or materials", () => {
		const original = [m01Block("Rock", 2, 4, 2, 4, 8, 4), m01Block("Rock", 6, 4, 2, 4, 8, 4),
			m01Block("Rock", 2, 4, 6, 4, 8, 4), m01Block("Rock", 6, 4, 6, 4, 8, 4),
			m01Block("Sand", 10, 4, 2, 4, 8, 4), m01Block("Rock", 2, 12, 2, 4, 8, 4)];
		const merged = mergeLandColumns(original);
		expect(merged.size()).toBe(3);
		for (let x = -2; x <= 14; x += 4) for (let y = -2; y <= 18; y += 4) for (let z = -2; z <= 10; z += 4) {
			testCheckpoint();
			const materials = (ops: typeof original) => ops.filter(o => math.abs(x - o.x) < o.sx / 2 && math.abs(y - o.y) < o.sy / 2 && math.abs(z - o.z) < o.sz / 2).map(o => o.material);
			expect(materials(merged)).toEqual(materials(original));
		}
	});
	it("bounds each M01 native fill without raising shared limits", () => {
		for (const job of terrainJobs(plan.ops, M01_FILL_CHUNK)) expect(job.cells).toBeLessThanOrEqual(M01_FILL_CHUNK);
	});
	it("stays within explicit new budgets without changing old limits", () => {
		const c = m01Counts(plan);
		print(`M01_ESTIMATE voxels=${c.voxels} jobs=${c.jobs} seconds=${c.estimatedSeconds} parts=${c.parts} props=${c.props} descendants=${c.descendants}`);
		expect(c.voxels).toBeLessThanOrEqual(M01.budget.voxelWrites);
		expect(c.jobs).toBeLessThanOrEqual(M01.budget.jobs);
		expect(c.parts).toBeLessThanOrEqual(M01.budget.parts);
		expect(c.props).toBeLessThanOrEqual(M01.budget.props);
		expect(c.descendants).toBeLessThanOrEqual(M01.budget.descendants);
		expect(c.estimatedSeconds).toBeLessThanOrEqual(16);
	});
	it("has a distinct calm dry early-afternoon environment", () => {
		for (const key of ENVIRONMENT_NAMES) expect(distinctChannels(M01_ENVIRONMENT, ENVIRONMENTS[key])).toBeGreaterThanOrEqual(2);
		expect(M01_ENVIRONMENT.weather).toBe("none");
		expect(weatherPlan("m01_sea_island", false, false)).toEqual({});
		expect(phoneClouds("m01_sea_island", 0.65, 0.28)).toEqual({ cover: 0.65, density: 0.18 });
	});
});
