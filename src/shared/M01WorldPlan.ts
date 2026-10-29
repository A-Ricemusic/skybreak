import type { EnvironmentSpec } from "./EnvironmentPresets";
import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import { polyDist, terrainTop, type TerrainOp, type PartSpec, type PropSpec, type TerrainMaterial } from "./WorldPlan";

/** Dormant C1 composition. No mission catalog or legacy planner imports this module. */
export const M01_WORLD_KEY = "m01_sea_island";
export const M01 = {
	half: 16384, scale: 0.96, waterY: 32, bottom: -32,
	islandWidth: 3840, islandLength: 9600, islandZ: -600,
	coarse: 256, detail: 64, corridorHalf: 768,
	city: { x: 1280, z: 256, hx: 448, hz: 768 },
	airbase: { x: -1280, z: -3200, hx: 448, hz: 1536 },
	start: { x: 0, z: 10000, y: 622 },
	carrier: { x: 0, z: 11200, hx: 512, hz: 768 },
	launch: { x: 0, z: 9600, hx: 384, hz: 1600 },
	// Spatial reservation, NOT an encounter/timing script. E1/E2 own the final route.
	route: [[0, 10000], [512, 4200], [1280, 256], [-1280, -3200], [-1280, -8000]],
	routeFloor: 622, routeCeiling: 832,
	budget: { props: 240, parts: 340, descendants: 1300, voxelWrites: 260e6, jobs: 30000 },
};

/** Separate preset keeps every existing preset and catalog union byte-for-byte unchanged. */
export const M01_ENVIRONMENT: EnvironmentSpec = {
	label: "Sea overcast afternoon", clock: 14 + 5 / 60, brightness: 2, exposure: -0.03,
	ambient: [114, 132, 154], outdoorAmbient: [140, 155, 177], diffuse: 0.6, specular: 0.3,
	atmosphere: { density: 0.35, offset: 0.25, haze: 2.8, glare: 0.18, color: [126, 150, 186], decay: [77, 105, 135] },
	clouds: { cover: 0.65, density: 0.28, color: [185, 199, 216] },
	grade: { saturation: -0.22, contrast: 0.03, brightness: 0, tint: [222, 237, 252] },
	bloom: { intensity: 0.08, size: 20, threshold: 1.8 }, sky: "day", starCount: 0, sunSize: 10, moonSize: 0,
	water: { color: [53, 73, 103], reflectance: 0.16, transparency: 0.12, waveSize: 0.05, waveSpeed: 5 }, weather: "none",
};
export const M01_CLOUD_BASE = 32 + 6000 * 0.3048 * 0.96;
export interface M01Plan { key: string; seed: number; ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]; detailCells: number; coarseCells: number }
const inside = (x: number, z: number, r: { x: number; z: number; hx: number; hz: number }) => math.abs(x - r.x) <= r.hx && math.abs(z - r.z) <= r.hz;
export function m01Detailed(x: number, z: number): boolean {
	return polyDist(x, z, M01.route) <= M01.corridorHalf || inside(x, z, M01.city) || inside(x, z, M01.airbase) || inside(x, z, M01.launch) || inside(x, z, M01.carrier);
}
const ISLETS = [[-2944, -5632, 384, 512], [2944, -3456, 320, 448], [-2816, 1536, 256, 384]];
/** Single continuous height function at both LODs; no stacked overlapping detail patches. */
export function m01Height(x: number, z: number): number {
	const nz = (z - M01.islandZ) / 4800;
	const centre = -180 * math.sin(nz * math.pi);
	const radius = math.sqrt(((x - centre) / 1920) ** 2 + nz * nz);
	let h = -32;
	if (radius < 1) {
		const edge = math.clamp((1 - radius) / 0.12, 0, 1);
		const spine = math.max(0, 1 - math.abs(x - centre) / 1500);
		h = -16 + edge * (112 + 432 * spine * (0.65 + 0.35 * math.cos(nz * 4)));
		// East bay opens to the sea. Inlet cuts west through the cliff coast.
		if (x > 1152 && math.abs(z - 256) < 1100) h = math.min(h, 64 - (x - 1152) * 0.25);
		const riverZ = 1728 + 120 * math.sin(x / 400);
		if (x < 0 && math.abs(z - riverZ) < 96) h = -8;
	}
	for (const [ix, iz, rx, rz] of ISLETS) {
		const r = math.sqrt(((x - ix) / rx) ** 2 + ((z - iz) / rz) ** 2);
		if (r < 1) h = math.max(h, -16 + 144 * (1 - r));
	}
	// Flat civic terraces are part of the island, not floating props.
	if (inside(x, z, M01.city) || inside(x, z, M01.airbase)) h = 72;
	return math.floor(h / 4) * 4;
}
export function m01Block(material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number): TerrainOp {
	return { shape: "block", material, x, y, z, sx, sy, sz, yaw: 0 };
}
export function buildM01Plan(seed = 101): M01Plan {
	const p: M01Plan = { key: M01_WORLD_KEY, seed, ops: [], parts: [], props: [], detailCells: 0, coarseCells: 0 };
	// Shallow coastal water plus a deeper carrier/launch berth. Flat sea elsewhere is visual only.
	p.ops.push(m01Block("Water", 0, 0, -512, 7168, 64, 12288));
	p.ops.push(m01Block("Water", 0, -32, 10240, 2048, 128, 4096));
	const column = (x: number, z: number, side: number) => {
		const top = m01Height(x, z);
		if (top <= M01.bottom) return;
		const cap = math.min(8, top - M01.bottom);
		if (top - cap > M01.bottom) p.ops.push(m01Block("Rock", x, (top - cap + M01.bottom) / 2, z, side, top - cap - M01.bottom, side));
		p.ops.push(m01Block(top <= 44 ? "Sand" : "LeafyGrass", x, top - cap / 2, z, side, cap, side));
	};
	// Refine a whole coarse tile if ANY point could intersect the corridor. Shared grid edges avoid cracks.
	for (let x = -3584; x < 3584; x += 256) for (let z = -6656; z < 5632; z += 256) {
		const cx = x + 128, cz = z + 128;
		let detailed = false;
		for (let dx = -128; dx <= 128; dx += 64) for (let dz = -128; dz <= 128; dz += 64) if (m01Detailed(cx + dx, cz + dz)) detailed = true;
		if (detailed) {
			for (let dx = 32; dx < 256; dx += 64) for (let dz = 32; dz < 256; dz += 64) { column(x + dx, z + dz, 64); p.detailCells++; }
		} else { column(cx, cz, 256); p.coarseCells++; }
	}
	const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: [number, number, number], solid = false) => p.parts.push({ name, shape: "block", x, y, z, sx, sy, sz, yaw: 0, color, material: "SmoothPlastic", solid, grounded: solid });
	// Partition sea into disjoint rectangles around the two voxel-water regions.
	const bands = [-16384, -6656, 5632, 8192, 12288, 16384];
	for (let i = 1; i < bands.size(); i++) {
		const lo = bands[i - 1], hi = bands[i];
		const half = lo === -6656 ? 3584 : lo === 8192 ? 1024 : 0;
		const spans = half > 0 ? [[-16384, -half], [half, 16384]] : [[-16384, 16384]];
		for (const [left, right] of spans) for (let x = left; x < right; x += 2048) for (let z = lo; z < hi; z += 2048) {
			const sx = math.min(2048, right - x), sz = math.min(2048, hi - z);
			part("Far sea", x + sx / 2, 30, z + sz / 2, sx, 4, sz, [53, 73, 103]);
		}
	}
	// Sparse pale surf strokes at actual sampled shoreline crossings; not offshore whitecaps.
	for (let z = -4608; z <= 3584; z += 512) for (const side of [-1, 1]) {
		let shore = 0;
		for (let x = 0; x <= 2176; x += 32) if (m01Height(side * x, z) > 32) shore = x;
		if (shore > 0) part("Shore surf", side * (shore + 24), 32.5, z, 8, 1, 128, [187, 203, 213]);
	}
	part("Runway", -1280, 74, -3200, 180, 4, 2880, [34, 49, 59], true);
	part("Apron", -1504, 74, -3200, 256, 4, 1536, [75, 86, 94], true);
	const prop = (asset: PropSpec["asset"], x: number, z: number, scale = 1) => p.props.push({ asset, x, y: terrainTop(p.ops, x, z).solid, z, yaw: 0, scale, tint: 0 });
	for (let i = 0; i < 8; i++) prop("Hangar", -1568, -3800 + i * 180);
	prop("ControlTower", -1024, -3000);
	for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) prop(i % 3 === 0 ? "OfficeMidrise" : "ApartmentBlock", 896 + i * 100, -384 + j * 180, 0.8);
	for (const z of [-128, 512]) p.props.push({ asset: "HarbourQuay", x: 1856, y: 32, z, yaw: math.pi / 2, scale: 1, tint: 0 });
	for (let i = 0; i < 8; i++) part("City street", 1248, 74, -474 + i * 180, 832, 4, 20, [61, 70, 78], true);
	// Seed affects dressing only; terrain/route/shoreline stay reproducible across seeds.
	let state = math.abs(math.floor(seed)) % 2147483646 + 1;
	const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
	for (let i = 0; i < 160; i++) {
		const x = -1728 + random() * 3456, z = -4800 + random() * 8640;
		if (m01Height(x, z) > 100 && m01Height(x, z) < 400 && !inside(x, z, M01.city) && !inside(x, z, M01.airbase)) prop("Pine", x, z, 1 + random() * 0.5);
	}
	return p;
}
export function m01Counts(p: M01Plan) {
	let voxels = 0;
	for (const op of p.ops) voxels += fillVoxels(op);
	const jobs = terrainJobs(p.ops).size();
	// Measured 16k LOD: 6104 jobs / 1.55s; 7.2k water ~3s. Double for layered columns/cache variance.
	return { voxels, jobs, estimatedSeconds: 2 * (jobs / 6104 * 1.55 + 3), parts: p.parts.size() + 8, props: p.props.size(), descendants: p.parts.size() + 8 + p.props.size() * 4 + 4 };
}
