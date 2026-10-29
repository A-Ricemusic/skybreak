import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM03Plan, M03, M03_ENVIRONMENT, M03_FILL_CHUNK, M03_RUNWAY_TOP, m03Counts, m03Detailed, m03Ground, m03Height, m03Material } from "../shared/M03WorldPlan";
import type { TerrainOp } from "../shared/WorldPlan";
import { M03_AIRSPACE, M03_BUILD_LIMITS as BUILD_BUDGET } from "../shared/M03Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { distinctChannels, ENVIRONMENTS, ENVIRONMENT_NAMES } from "../shared/EnvironmentPresets";
import { M01_ENVIRONMENT } from "../shared/M01WorldPlan";
import { terrainJobs } from "../shared/TerrainSchedule";
import { terrainTop } from "../shared/WorldPlan";
import { weatherPlan, phoneClouds } from "../shared/WeatherRules";

describe("M03 snowy mountain composition", () => {
	const p = buildM03Plan();
	it("is selected by mission 3 alone and deterministic with cooperative planning", () => {
		for (const bp of MissionCatalog.All()) if (bp.id !== 3) expect(MissionCatalog.WorldKey(bp.id)).never.toBe(p.key);
		expect(MissionCatalog.WorldKey(3)).toBe(p.key);
		let checkpoints = 0;
		expect(buildM03Plan(303, () => { checkpoints++; })).toEqual(p);
		expect(checkpoints).toBeGreaterThan(10000);
	});
	it("exports nine radars, four AA and a helicopter grounded on written terrain", () => {
		expect(p.targets.filter((t) => t.type === "radar" && t.group === "site1").size()).toBe(5);
		expect(p.targets.filter((t) => t.type === "radar" && t.group === "site2").size()).toBe(4);
		expect(p.targets.filter((t) => t.type === "aaGun").size()).toBe(4);
		expect(p.targets.filter((t) => t.type === "helicopter").size()).toBe(1);

		for (const t of p.targets) {
			expect(t.y).toBeGreaterThanOrEqual(terrainTop(p.ops, t.x, t.z).solid);
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
		expect(p.parts.filter((q) => q.name === "Landing runway").size()).toBe(2);
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
		// Exhaustive: the written cap heights on a 64-stud column grid (outside the footprint is open air down to Y=0).
		const columns = (2 * M03.halfX) / 64;
		const grid: number[] = [];
		for (const c of caps) {
			const top = c.y + 4;
			expect(m03Ground(c.x, c.z)).toBe(top);
			for (let gx = c.x - c.sx / 2; gx < c.x + c.sx / 2; gx += 64) for (let gz = c.z - c.sz / 2; gz < c.z + c.sz / 2; gz += 64) {
				const index = ((gx + M03.halfX) / 64) * columns + (gz + M03.halfZ) / 64;
				expect(grid[index]).toBe(undefined);
				grid[index] = top;
			}
		}
		const height = (gx: number, gz: number) => math.abs(gx + 32) >= M03.halfX || math.abs(gz + 32) >= M03.halfZ ? 0
			: grid[((gx + M03.halfX) / 64) * columns + (gz + M03.halfZ) / 64];
		// Index every four-stud rock curtain by the line it stands on.
		const walls = new Map<string, TerrainOp[]>();
		for (const o of p.ops) if (o.material === "Rock" && o.sy !== 4 && math.min(o.sx, o.sz) === 4) {
			const key = o.sx === 4 ? `x${o.x}` : `z${o.z}`;
			const list = walls.get(key) ?? []; list.push(o); walls.set(key, list);
		}
		let checked = 0, closed = 0;
		for (const c of caps) {
			const top = c.y + 4, x0 = c.x - c.sx / 2, z0 = c.z - c.sz / 2;
			for (const axis of ["x", "z"]) for (const sign of [-1, 1]) {
				const edge = axis === "x" ? c.x + sign * c.sx / 2 : c.z + sign * c.sz / 2;
				const first = axis === "x" ? z0 : x0, length = axis === "x" ? c.sz : c.sx;
				// Every 64-stud column along the whole edge, not a sample.
				for (let v = first; v < first + length; v += 64) {
					checked++;
					const neighbor = axis === "x" ? height(sign > 0 ? edge : edge - 64, v) : height(v, sign > 0 ? edge : edge - 64);
					if (neighbor === top) continue;
					// The tall side owns the four-stud wall, all the way down to the lower cap (or Y=0 outside).
					const wallAt = edge + (top > neighbor ? -sign * 2 : sign * 2);
					const lo = math.min(top, neighbor), hi = math.max(top, neighbor);
					const covering = (walls.get(`${axis}${wallAt}`) ?? []).filter((o) => {
						const from = axis === "x" ? o.z - o.sz / 2 : o.x - o.sx / 2, to = axis === "x" ? o.z + o.sz / 2 : o.x + o.sx / 2;
						return from <= v && to >= v + 64 && o.y - o.sy / 2 <= lo && o.y + o.sy / 2 >= hi;
					});
					expect(covering.size()).toBeGreaterThan(0);
					closed++;
				}
			}
		}
		print(`M03_SHELL_COVERAGE columns=${checked} height_steps=${closed} caps=${caps.size()}`);
		expect(closed).toBeGreaterThan(1000);
	});
	it("seals the entire hard airspace with one continuous bottom floor", () => {
		expect(M03.halfX).toBeGreaterThan(M03_AIRSPACE.hardHalfWidth);
		expect(M03.halfZ).toBeGreaterThan(M03_AIRSPACE.hardHalfWidth);
		const floor = p.ops.filter((o) => o.x === 0 && o.z === 0 && o.y === -2 && o.sy === 4);
		expect(floor.size()).toBe(1);
		expect(floor[0].sx).toBe(2 * M03.halfX);
		expect(floor[0].sz).toBe(2 * M03.halfZ);
		// A solid, unrotated rock block: no air pocket, no wedge, no gap at the corners.
		expect(floor[0].material).toBe("Rock");
		expect(floor[0].shape).toBe("block");
		expect(floor[0].yaw).toBe(0);
	});
	it("uses unique mission ids and supports the entire non-overlapping target footprint", () => {
		const ids = new Set<string>();
		for (const t of p.targets) {
			expect(t.id.sub(1, 4)).toBe("m03_");
			expect(ids.has(t.id)).toBe(false); ids.add(t.id);
			const f = p.parts.find((q) => q.name === `${t.id} foundation`)!;
			expect(f.y + f.sy / 2).toBe(t.y);
			for (let dx = -24; dx <= 24; dx += 4) for (let dz = -24; dz <= 24; dz += 4) {
				const h = m03Ground(t.x + dx, t.z + dz);
				expect(h).toBeLessThanOrEqual(t.y);
				expect(f.y - f.sy / 2).toBeLessThan(h);
			}
			for (const other of p.targets) if (other.id !== t.id)
				expect(math.max(math.abs(t.x - other.x), math.abs(t.z - other.z))).toBeGreaterThan(48);
		}
	});
	it("keeps all native parts within 2048 and tiles both runway thresholds above terrain", () => {
		for (const q of p.parts) for (const side of [q.sx, q.sy, q.sz]) {
			expect(side).toBeGreaterThan(0); expect(side).toBeLessThanOrEqual(2048);
		}
		const r = M03.landing, strips = p.parts.filter((q) => q.name === "Landing runway");
		expect(strips[0].z - strips[0].sz / 2).toBe(r.z - r.length / 2);
		expect(strips[0].z + strips[0].sz / 2).toBe(strips[1].z - strips[1].sz / 2);
		expect(strips[1].z + strips[1].sz / 2).toBe(r.z + r.length / 2);
		for (const q of strips) {
			// D-064: an eight-stud slab from the lowland (80) to 88, like mission 2's raised pavement (D-056).
			expect(q.sx).toBe(128); expect(q.y + q.sy / 2).toBe(M03_RUNWAY_TOP); expect(q.sy).toBe(8);
			for (let z = q.z - q.sz / 2; z <= q.z + q.sz / 2; z += 32)
				for (let x = q.x - q.sx / 2; x <= q.x + q.sx / 2; x += 16)
					expect(m03Ground(x, z)).toBeLessThanOrEqual(q.y - q.sy / 2);
		}
	});
	it("clears terrain and structures along a swept southern three-degree landing approach", () => {
		const r = M03.landing, threshold = r.z + r.length / 2;
		// 96-stud-wide corridor, 8-stud depth below the aircraft; stops at hard airspace.
		for (let z = threshold + 32; z <= M03_AIRSPACE.hardHalfWidth; z += 16) {
			const bottom = M03_RUNWAY_TOP + 12 + (z - threshold) * math.tan(math.rad(3)) - 8;
			for (let x = r.x - 48; x <= r.x + 48; x += 16) {
				expect(m03Ground(x, z)).toBeLessThan(bottom);
				for (const q of p.parts) if (math.abs(x - q.x) <= q.sx / 2 + 8 && math.abs(z - q.z) <= q.sz / 2 + 8)
					expect(q.y + q.sy / 2).toBeLessThan(bottom);
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
