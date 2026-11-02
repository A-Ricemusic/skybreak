import { plansEqual, testCheckpoint } from "./TestPacing";
import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM02Plan, M02, M02_ENVIRONMENT, M02_FILL_CHUNK, M02_RUNWAY, M02_PAVEMENT_TOP, m02Counts, m02Detailed, m02Ground, m02Height, m02TargetLayout } from "../shared/M02WorldPlan";
import { M02_AIRSPACE, M02_START } from "../shared/M02Limits";
import { M01_ENVIRONMENT } from "../shared/M01WorldPlan";
import { MissionCatalog } from "../shared/MissionCatalog";
import { distinctChannels, ENVIRONMENTS, ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { terrainJobs } from "../shared/TerrainSchedule";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { terrainTop } from "../shared/WorldPlan";
import { weatherPlan, phoneClouds } from "../shared/WeatherRules";

// Conservative world-axis bounds: yaw-rotated manifest boxes, not point targets.
function bounds(x: number, z: number, sx: number, sz: number, yaw = 0) {
	const c = math.abs(math.cos(yaw)), s = math.abs(math.sin(yaw));
	return { x, z, hx: (sx * c + sz * s) / 2, hz: (sx * s + sz * c) / 2 };
}
function overlaps(a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>): boolean {
	return math.abs(a.x - b.x) < a.hx + b.hx && math.abs(a.z - b.z) < a.hz + b.hz;
}
const targets = m02TargetLayout();
const targetBounds = targets.map((t) => {
	const size = t.type === "bomber" ? UploadedAssetSpecs.HeavyBomber.size : t.type === "hangar" ? UploadedAssetSpecs.Hangar.size : t.type === "control_tower" ? UploadedAssetSpecs.ControlTower.size : undefined;
	return bounds(t.x, t.z, size?.X ?? (t.type === "aa" ? 22 : 160), size?.Z ?? (t.type === "aa" ? 58 : 96), t.yaw);
});

describe("Mission 2 farmland composition", () => {
	const plan = buildM02Plan();
	it("is deterministic and selected only by mission 2", () => {
		expect(plansEqual(buildM02Plan(), plan)).toBe(true);
		expect(buildM02Plan(203).props).never.toEqual(plan.props);
		for (const bp of MissionCatalog.All()) expect(MissionCatalog.WorldKey(bp.id) === plan.key).toBe(bp.id === 2);
		expect(MissionCatalog.WorldKey(0)).never.toBe(plan.key);
	});
	it("exports the full contact roster on flat terrain, with a separate substation", () => {
		const targets = m02TargetLayout();
		for (const [targetType, count] of [["bomber", 11], ["hangar", 7], ["aa", 4], ["control_tower", 1], ["substation", 1]] as const) expect(targets.filter((t) => t.type === targetType).size()).toBe(count);
		for (const [group, count] of [["A", 4], ["B", 3], ["C", 2], ["D", 2]] as const) expect(targets.filter((t) => t.type === "bomber" && t.group === group).size()).toBe(count);
		for (const t of targets) {
			testCheckpoint();
			expect(t.y).toBe(t.type === "bomber" || t.type === "control_tower" || t.type === "substation" ? M02_PAVEMENT_TOP : 32);
			expect(terrainTop(plan.ops, t.x, t.z).solid).toBe(32);
			for (const dx of [-48, 0, 48]) for (const dz of [-48, 0, 48]) expect(m02Ground(t.x + dx, t.z + dz)).toBe(32);
			expect(math.abs(t.x)).toBeLessThan(M02_AIRSPACE.softHalfWidth);
			expect(math.abs(t.z)).toBeLessThan(M02_AIRSPACE.softHalfWidth);
			const r = t.type === "substation" ? M02.substation : M02.base;
			expect(math.abs(t.x - r.x)).toBeLessThan(r.hx);
			expect(math.abs(t.z - r.z)).toBeLessThan(r.hz);
		}
	});
	it("exports unique m02_ ids and non-overlapping manifest-sized target footprints", () => {
		const ids = new Set<string>();
		for (const t of targets) { expect(t.id.sub(1, 4)).toBe("m02_"); expect(ids.has(t.id)).toBe(false); ids.add(t.id); }
		for (let i = 0; i < targets.size(); i++) for (let j = i + 1; j < targets.size(); j++) expect(overlaps(targetBounds[i], targetBounds[j])).toBe(false);
	});
	it("supports each parked bomber's entire manifest footprint on pavement", () => {
		for (let i = 0; i < targets.size(); i++) if (targets[i].type === "bomber") {
			testCheckpoint();
			const b = targetBounds[i];
			// The full conservative bounding box must fit inside one surface, including circular pads.
			const supported = plan.parts.some((p) => {
				if (p.name !== "Dispersal hardstand" && p.name !== "Main apron" && p.name !== "Loop taxiway") return false;
				if (p.y + p.sy / 2 !== targets[i].y) return false;
				const dx = math.abs(b.x - p.x) + b.hx, dz = math.abs(b.z - p.z) + b.hz;
				return p.shape === "cylinder" ? dx * dx + dz * dz <= (p.sx / 2) ** 2 : dx <= p.sx / 2 && dz <= p.sz / 2;
			});
			expect(supported).toBe(true);
		}
	});
	it("places all pavement above actual terrain and keeps contact poses on their support", () => {
		const names = new Set(["Runway", "Parallel taxiway", "Taxiway crosslink", "West taxiway", "Main apron", "Pad connector", "Dispersal hardstand", "Loop taxiway", "Substation yard"]);
		for (const p of plan.parts) if (names.has(p.name)) {
			testCheckpoint();
			expect(p.y + p.sy / 2).toBe(M02_PAVEMENT_TOP);
			for (const op of plan.ops) if (op.material !== "Water" && overlaps(bounds(p.x, p.z, p.sx, p.sz), bounds(op.x, op.z, op.sx, op.sz))) expect(p.y + p.sy / 2).toBeGreaterThan(op.y + op.sy / 2);
		}
		for (const t of targets) {
			testCheckpoint();
			let support = terrainTop(plan.ops, t.x, t.z).solid;
			for (const p of plan.parts) if (names.has(p.name) && math.abs(t.x - p.x) <= p.sx / 2 && math.abs(t.z - p.z) <= p.sz / 2) support = math.max(support, p.y + p.sy / 2);
			expect(t.y).toBe(support);
		}
		for (const p of plan.parts) if (p.name === "Runway centre stripe") expect(p.y - p.sy / 2).toBeGreaterThan(M02_PAVEMENT_TOP);
	});
	it("clears a swept northbound scramble climb-out of terrain and every structure", () => {
		// Prospective integration contract: 3,000 studs beyond the north threshold,
		// 1:8 climb, lower hull 8 studs above pavement. Each contiguous 32-stud
		// slab covers the whole bomber width plus 16 studs of clearance per side.
		const half = UploadedAssetSpecs.HeavyBomber.size.X / 2 + 16;
		const obstacles = plan.ops.map((op) => ({ ...bounds(op.x, op.z, op.sx, op.sz), top: op.y + op.sy / 2 }));
		for (const p of plan.parts) obstacles.push({ ...bounds(p.x, p.z, p.sx, p.sz, p.yaw), top: p.y + p.sy / 2 });
		for (const p of plan.props) {
			testCheckpoint();
			const spec = UploadedAssetSpecs[p.asset];
			obstacles.push({ ...bounds(p.x, p.z, spec.size.X * p.scale, spec.size.Z * p.scale, p.yaw), top: p.y + (spec.size.Y - spec.groundOffset) * p.scale });
		}
		for (let i = 0; i < targets.size(); i++) if (targets[i].type === "bomber") obstacles.push({ ...targetBounds[i], top: targets[i].y + UploadedAssetSpecs.HeavyBomber.size.Y });
		for (const b of plan.beams) obstacles.push({ ...bounds((b.a[0] + b.b[0]) / 2, (b.a[2] + b.b[2]) / 2, math.abs(b.a[0] - b.b[0]) + 2, math.abs(b.a[2] - b.b[2]) + 2), top: math.max(b.a[1], b.b[1]) + 1 });
		for (let d = 0; d < 3000; d += 32) {
			testCheckpoint();
			const sweep = bounds(M02_RUNWAY.northThreshold.x, M02_RUNWAY.northThreshold.z - d - 16, half * 2, 32);
			const bottom = M02_RUNWAY.northThreshold.y + 8 + d / 8;
			for (const o of obstacles) if (overlaps(sweep, o)) expect(o.top).toBeLessThan(bottom);
		}
	});
	it("reserves detail for start, entire corridor, substation and base edges", () => {
		for (let i = 1; i < M02.route.size(); i++) for (let t = 0; t <= 1; t += 0.02) {
			testCheckpoint();
			const a = M02.route[i - 1], b = M02.route[i];
			expect(m02Detailed(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(true);
		}
		for (const r of [M02.base, M02.substation]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(m02Detailed(r.x + sx * r.hx, r.z + sz * r.hz)).toBe(true);
		expect(M02_START.y - m02Ground(M02_START.x, M02_START.z)).toBeGreaterThan(450);
		expect(M02_START.headingDegrees).toBe(0);
		for (const pose of [M02_RUNWAY.centreline, M02_RUNWAY.threshold, M02_RUNWAY.northThreshold]) { expect(pose.y).toBe(M02_PAVEMENT_TOP); expect(pose.y).toBeGreaterThan(m02Ground(pose.x, pose.z)); }
	});
	it("grounds every prop against actual sampled terrain and spans the full footprint", () => {
		for (const p of plan.props) expect(p.y).toBe(p.asset === "ControlTower" ? M02_PAVEMENT_TOP : terrainTop(plan.ops, p.x, p.z).solid);
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
			testCheckpoint();
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
