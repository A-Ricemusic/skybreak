import type { EnvironmentSpec } from "./EnvironmentPresets";
import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import { polyDist, terrainTop, type TerrainOp, type PartSpec, type PropSpec, type TerrainMaterial } from "./WorldPlan";

/** Dormant C1 composition. No mission catalog or legacy planner imports this module. */
export const M01_FILL_CHUNK = 65536;
export { M01, M01_WORLD_KEY } from "./M01Geometry";
import { M01, M01_WORLD_KEY } from "./M01Geometry";

/** Separate preset keeps every existing preset and catalog union byte-for-byte unchanged. */
export const M01_ENVIRONMENT: EnvironmentSpec = {
	label: "Sea overcast afternoon", clock: 14 + 5 / 60, brightness: 2, exposure: -0.03,
	ambient: [114, 132, 154], outdoorAmbient: [140, 155, 177], diffuse: 0.6, specular: 0.3,
	atmosphere: { density: 0.19, offset: 0.05, haze: 1.0, glare: 0.18, color: [126, 150, 186], decay: [77, 105, 135] },
	clouds: { cover: 0.65, density: 0.28, color: [185, 199, 216] },
	grade: { saturation: -0.22, contrast: 0.03, brightness: 0, tint: [222, 237, 252] },
	bloom: { intensity: 0.08, size: 20, threshold: 1.8 }, sky: "day", starCount: 0, sunSize: 10, moonSize: 0,
	water: { color: [53, 73, 103], reflectance: 0.16, transparency: 0, waveSize: 0.05, waveSpeed: 5 }, weather: "none",
};
export const M01_CLOUD_BASE = 32 + 6000 * 0.3048 * 0.96;
export interface M01Plan { key: string; seed: number; ops: TerrainOp[]; parts: PartSpec[]; props: PropSpec[]; detailCells: number; coarseCells: number }
const inside = (x: number, z: number, r: { x: number; z: number; hx: number; hz: number }) => math.abs(x - r.x) <= r.hx && math.abs(z - r.z) <= r.hz;
export function m01Detailed(x: number, z: number): boolean {
	return polyDist(x, z, M01.route) <= M01.corridorHalf || inside(x, z, M01.city) || inside(x, z, M01.airbase) || inside(x, z, M01.launch) || inside(x, z, M01.carrier);
}
const ISLETS = [[-2944, -5632, 384, 512], [2944, -3456, 320, 448], [-2816, 1536, 256, 384]];
function terraceHeight(h: number, x: number, z: number, r: { x: number; z: number; hx: number; hz: number }): number {
	const dx = math.max(0, math.abs(x - r.x) - r.hx), dz = math.max(0, math.abs(z - r.z) - r.hz);
	const blend = math.clamp(1 - math.sqrt(dx * dx + dz * dz) / 192, 0, 1);
	return h * (1 - blend) + 72 * blend;
}
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
	h = terraceHeight(h, x, z, M01.city);
	h = terraceHeight(h, x, z, M01.airbase);
	return math.floor(h / 4) * 4;
}
export function m01Block(material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number): TerrainOp {
	return { shape: "block", material, x, y, z, sx, sy, sz, yaw: 0 };
}
export function buildM01Plan(seed = 101, checkpoint: () => void = () => {}): M01Plan {
	const p: M01Plan = { key: M01_WORLD_KEY, seed, ops: [], parts: [], props: [], detailCells: 0, coarseCells: 0 };
	// Native water retains the coastal/launch depth. A single uniform visual sea
	// surface below replaces the mixed Part/voxel surface (and its rectangular joins).
	p.ops.push(m01Block("Water", 0, 0, -512, 7168, 64, 12288));
	p.ops.push(m01Block("Water", 0, -32, 10240, 2048, 128, 4096));
	const column = (x: number, z: number, side: number) => {
		const top = m01Height(x, z);
		if (top <= M01.bottom) return;
		const cap = math.min(8, top - M01.bottom);
		const slope = math.max(math.abs(m01Height(x + 16, z) - m01Height(x - 16, z)), math.abs(m01Height(x, z + 16) - m01Height(x, z - 16))) / 32;
		if (slope > 0.65) {
			// Rock cliffs need no separate rock cap/body jobs.
			p.ops.push(m01Block("Rock", x, (top + M01.bottom) / 2, z, side, top - M01.bottom, side));
		} else {
			if (top - cap > M01.bottom) p.ops.push(m01Block("Rock", x, (top - cap + M01.bottom) / 2, z, side, top - cap - M01.bottom, side));
			p.ops.push(m01Block(top <= 56 ? "Sand" : "LeafyGrass", x, top - cap / 2, z, side, cap, side));
		}
	};
	const landTiles = new Map<string, TerrainOp[]>();
	const tileKey = (x: number, z: number) => `${math.floor(x / 256)},${math.floor(z / 256)}`;
	// Refine coastal tiles to 16 studs, including terrace skirts and islets. Entire
	// coarse cells are replaced, so there are no overlapping land LOD surfaces.
	const tile = (x: number, z: number, side: number): void => {
		let lo = math.huge, hi = -math.huge;
		for (let dx = 0; dx <= side; dx += side / 2) for (let dz = 0; dz <= side; dz += side / 2) {
			const h = m01Height(x + dx, z + dz); lo = math.min(lo, h); hi = math.max(hi, h);
		}
		if (((side > 32 && lo < 56 && hi > 8) || (side > 16 && lo < 36 && hi > 28)) && hi - lo > 4) {
			const half = side / 2;
			for (let dx = 0; dx < side; dx += half) for (let dz = 0; dz < side; dz += half) tile(x + dx, z + dz, half);
		} else { column(x + side / 2, z + side / 2, side); if (side <= 64) p.detailCells++; else p.coarseCells++; }
	};
	for (let x = -3584; x < 3584; x += 256) {
		for (let z = -6656; z < 5632; z += 256) {
			const first = p.ops.size();
			let detailed = false;
			for (let dx = 0; dx <= 256; dx += 64) for (let dz = 0; dz <= 256; dz += 64) if (m01Detailed(x + dx, z + dz)) detailed = true;
			if (detailed) for (let dx = 0; dx < 256; dx += 64) for (let dz = 0; dz < 256; dz += 64) tile(x + dx, z + dz, 64);
			else tile(x, z, 256);
			const localOps: TerrainOp[] = [];
			for (let i = first; i < p.ops.size(); i++) localOps.push(p.ops[i]);
			landTiles.set(tileKey(x, z), localOps);
			checkpoint();
		}
	}
	const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: [number, number, number], solid = false) => p.parts.push({ name, shape: "block", x, y, z, sx, sy, sz, yaw: 0, color, material: "SmoothPlastic", solid, grounded: solid });
	// Identical opaque, non-solid sea tiles overlap by four studs. The surface is
	// 0.25 studs above native water, including its 0.05-stud waves, avoiding z-fighting.
	for (let x = -16384; x < 16384; x += 2040) for (let z = -16384; z < 16384; z += 2040) {
		const sx = math.min(2040, 16384 - x), sz = math.min(2040, 16384 - z);
		part("Far sea", x + sx / 2, 30.25, z + sz / 2, sx + 4, 4, sz + 4, [53, 73, 103]);
	}
	// Pale sand at gentle shore slopes provides a continuous natural edge; no
	// disconnected rectangular foam Parts on this calm/slight sea.
	part("Runway", -1280, 74, -3200, 180, 4, 2880, [34, 49, 59], true);
	part("Apron", -1504, 74, -3200, 256, 4, 1536, [75, 86, 94], true);
	const prop = (asset: PropSpec["asset"], x: number, z: number, scale = 1) => { p.props.push({ asset, x, y: terrainTop(landTiles.get(tileKey(x, z)) ?? [], x, z).solid, z, yaw: 0, scale, tint: 0 }); checkpoint(); };
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
	checkpoint();
	return p;
}
export function m01Counts(p: M01Plan) {
	let voxels = 0;
	for (const op of p.ops) voxels += fillVoxels(op);
	const jobs = terrainJobs(p.ops, M01_FILL_CHUNK).size();
	// Measured 16k LOD: 6104 jobs / 1.55s; 7.2k water ~3s. Double for layered columns/cache variance.
	return { voxels, jobs, estimatedSeconds: 2 * (jobs / 6104 * 1.55 + 3), parts: p.parts.size() + 8, props: p.props.size(), descendants: p.parts.size() + 8 + p.props.size() * 4 + 4 };
}
