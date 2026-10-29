import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM03Plan, M03, M03_ENVIRONMENT, M03_FILL_CHUNK, m03Counts, m03Detailed, m03Ground, m03Height, m03Material } from "../shared/M03WorldPlan";
import { M03_AIRSPACE, M03_BUILD_LIMITS as BUILD_BUDGET } from "../shared/M03Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { distinctChannels, ENVIRONMENTS, ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { M01_ENVIRONMENT } from "../shared/M01WorldPlan";
import { terrainJobs } from "../shared/TerrainSchedule";
import { terrainTop } from "../shared/WorldPlan";
import { weatherPlan, phoneClouds } from "../shared/WeatherRules";

describe("Dormant M03 snowy mountain composition", () => {
	const p = buildM03Plan();
	it("remains unselected and deterministic with cooperative planning", () => {
		for (const bp of MissionCatalog.All()) expect(MissionCatalog.WorldKey(bp.id)).never.toBe(p.key);
		let checkpoints = 0;
		expect(buildM03Plan(303, () => { checkpoints++; })).toEqual(p);
		expect(checkpoints).toBeGreaterThan(10000);
	});
	it("exports nine radars, four AA and a helicopter grounded on written terrain", () => {
		expect(p.targets.filter((t) => t.type === "radar" && t.group === "site1").size()).toBe(5);
		expect(p.targets.filter((t) => t.type === "radar" && t.group === "site2").size()).toBe(4);
		expect(p.targets.filter((t) => t.type === "aaGun").size()).toBe(4);
		expect(p.targets.filter((t) => t.type === "helicopter").size()).toBe(1);
		expect(p.targets.map((t) => t.y)).toEqual([736, 756, 780, 756, 736, 656, 656, 656, 656, 736, 452, 424, 520, 656]);
		for (const t of p.targets) {
			expect(t.y).toBe(terrainTop(p.ops, t.x, t.z).solid);
			expect(math.max(math.abs(t.x), math.abs(t.z))).toBeLessThan(M03_AIRSPACE.softHalfWidth);
			print(`M03_TARGET ${t.id} ${t.type} ${t.group} x=${t.x} y=${t.y} z=${t.z} yaw=${t.yaw}`);
		}
	});
	it("places site 1 on a crest and site 2 on a high saddle with AA on lower valley sides", () => {
		for (const t of p.targets) if (t.type === "radar") {
			if (t.group === "site1") {
				expect(t.y).toBeGreaterThan(680);
				for (const s of [-1, 1]) expect(t.y).toBeGreaterThan(m03Height(t.x - s * 224, t.z + s * 384));
			} else expect(t.y).toBe(656);
		}
		for (const t of p.targets) if (t.type === "aaGun" && t.group === "site2") {
			expect(t.y).toBeLessThan(656);
			expect(t.y).toBeGreaterThan(100);
		}
	});
	it("preserves full scale, return distance and a flat landing runway", () => {
		const a = M03.start, b = M03.site1, c = M03.site2;
		const distance = (x: number, z: number) => math.sqrt(x * x + z * z) / 0.96;
		expect(distance(a.x - b.x, a.z - b.z)).toBeGreaterThan(16000);
		expect(distance(a.x - b.x, a.z - b.z)).toBeLessThan(19000);
		expect(distance(b.x - c.x, b.z - c.z)).toBeGreaterThan(11500);
		expect(distance(b.x - c.x, b.z - c.z)).toBeLessThan(13000);
		expect(M03.returnLine.z - c.z).toBe(19200);
		expect(M03.returnLine.x1).toBeLessThan(c.x);
		expect(M03.returnLine.x2).toBeGreaterThan(a.x);
		const r = M03.landing;
		for (let z = r.z - r.length / 2; z <= r.z + r.length / 2; z += 64) for (const x of [r.x - r.width / 2, r.x, r.x + r.width / 2]) expect(m03Ground(x, z)).toBe(r.y);
		expect(p.parts.filter((q) => q.name === "Landing runway").size()).toBe(1);
		expect(M03.start.y).toBeGreaterThan(m03Ground(a.x, a.z) + 100);
		expect(M03.summit + 200).toBeLessThan(FlightMath.SoftAltitude);
		expect(FlightMath.SoftAltitude).toBeLessThan(FlightMath.MaxAltitude);
	});
	it("details the sites, ingress, gorge and entire return route", () => {
		for (const line of [M03.route, M03.gorge]) for (let i = 1; i < line.size(); i++) for (let n = 0; n <= 100; n++) {
			const a = line[i - 1], b = line[i];
			expect(m03Detailed(a[0] + (b[0] - a[0]) * n / 100, a[1] + (b[1] - a[1]) * n / 100)).toBe(true);
		}
		for (const t of p.targets) expect(m03Detailed(t.x, t.z)).toBe(true);
		expect(p.coarseCells).toBeGreaterThan(1000);
		expect(p.detailCells).toBeGreaterThan(1000);
	});
	it("uses slope-aware rock, snow valleys and a deep gorge inside the provisional band", () => {
		let rock = 0, snow = 0, peak = 0;
		for (let x = -14000; x <= 14000; x += 128) for (let z = -12000; z <= 12000; z += 128) {
			const h = m03Height(x, z); peak = math.max(peak, h);
			expect(h).toBeLessThanOrEqual(M03.summit);
			if (m03Material(x, z) === "Rock") rock++;
			if (m03Material(x, z) === "Snow") snow++;
		}
		expect(rock).toBeGreaterThan(100);
		expect(snow).toBeGreaterThan(1000);
		expect(peak - M03.valley).toBeGreaterThanOrEqual(576);
		expect(m03Height(-7500, -6200)).toBe(80);
	});
	it("stays within explicit budgets and bounds every native fill", () => {
		const c = m03Counts(p);
		print(`M03_ESTIMATE voxels=${c.voxels} jobs=${c.jobs} seconds=${c.estimatedSeconds} parts=${c.parts} descendants=${c.descendants} detailCells=${p.detailCells} coarseCells=${p.coarseCells}`);
		expect(M03.budget).toBe(BUILD_BUDGET);
		expect(c.estimatedSeconds).toBeLessThanOrEqual(BUILD_BUDGET.estimatedSeconds);
		expect(c.voxels).toBeLessThanOrEqual(M03.budget.voxelWrites);
		expect(c.jobs).toBeLessThanOrEqual(M03.budget.jobs);
		expect(c.parts).toBeLessThanOrEqual(M03.budget.parts);
		expect(c.descendants).toBeLessThanOrEqual(M03.budget.descendants);
		for (const job of terrainJobs(p.ops, M03_FILL_CHUNK)) expect(job.cells).toBeLessThanOrEqual(M03_FILL_CHUNK);
	});
	it("tiles the entire footprint with thin caps and closes sampled LOD edges", () => {
		const caps = p.ops.filter((o) => o.sy === 8 && o.sx >= 64 && o.sz >= 64);
		let area = 0;
		for (const o of caps) area += o.sx * o.sz;
		expect(area).toBe(4 * M03.halfX * M03.halfZ);
		expect(caps.size()).toBe(p.detailCells + p.coarseCells);
		for (const o of p.ops) {
			// No solid mountain columns: caps are eight studs, curtains four.
			expect(math.min(o.sx, o.sy, o.sz)).toBeLessThanOrEqual(8);
			for (const v of [o.x - o.sx / 2, o.z - o.sz / 2, o.y - o.sy / 2, o.sx, o.sy, o.sz]) expect(v % 4).toBe(0);
		}
		for (let i = 0; i < caps.size(); i += 97) {
			const c = caps[i], top = c.y + 4;
			expect(m03Ground(c.x, c.z)).toBe(top);
			for (const axis of ["x", "z"]) for (const sign of [-1, 1]) {
				const edge = axis === "x" ? c.x + sign * c.sx / 2 : c.z + sign * c.sz / 2;
				const along = axis === "x" ? c.z : c.x;
				const nx = axis === "x" ? edge + sign * 32 : along;
				const nz = axis === "z" ? edge + sign * 32 : along;
				const neighbor = math.abs(nx) >= M03.halfX || math.abs(nz) >= M03.halfZ ? 0 : m03Ground(nx, nz);
				if (neighbor === top) continue;
				// The tall side owns the four-stud wall, all the way down to
				// the lower cap (or Y=0 at the outside perimeter).
				const wallAt = edge + (top > neighbor ? -sign * 2 : sign * 2);
				const wx = axis === "x" ? wallAt : along, wz = axis === "z" ? wallAt : along;
				const walls = p.ops.filter((o) => o.material === "Rock" && math.min(o.sx, o.sz) === 4
					&& math.abs(wx - o.x) <= o.sx / 2 && math.abs(wz - o.z) <= o.sz / 2
					&& o.y - o.sy / 2 <= math.min(top, neighbor) && o.y + o.sy / 2 >= math.max(top, neighbor));
				expect(walls.size()).toBeGreaterThan(0);
			}
		}
	});
	it("has distinct dry clear 16:28 light, strong sun and visible moon settings", () => {
		for (const key of ENVIRONMENT_NAMES) expect(distinctChannels(M03_ENVIRONMENT, ENVIRONMENTS[key])).toBeGreaterThanOrEqual(2);
		expect(distinctChannels(M03_ENVIRONMENT, M01_ENVIRONMENT)).toBeGreaterThanOrEqual(2);
		expect(M03_ENVIRONMENT.clock).toBeCloseTo(16 + 28 / 60);
		expect(M03_ENVIRONMENT.moonSize).toBeGreaterThan(0);
		expect(p.parts.filter((q) => q.name === "Daytime moon" && !q.solid && q.y > FlightMath.MaxAltitude).size()).toBe(1);
		expect(M03_ENVIRONMENT.clouds.cover).toBe(0);
		expect(weatherPlan("m03_snow_radar", false, false)).toEqual({});
		expect(phoneClouds("m03_snow_radar", 0, 0)).toEqual({ cover: 0, density: 0 });
	});
});
