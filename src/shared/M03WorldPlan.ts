import type { EnvironmentSpec } from "./EnvironmentPresets";
import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import { polyDist, type TerrainOp, type PartSpec, type TerrainMaterial } from "./WorldPlan";

export const M03_WORLD_KEY = "m03_snow_radar";
export const M03_FILL_CHUNK = 65536;
export const M03 = {
	halfX: 14976, halfZ: 12928, bottom: 0, coarse: 256, detail: 64, corridorHalf: 640,
	valley: 80, summit: 944, scale: 0.96,
	start: { x: 12000, y: 640, z: 9120, headingDegrees: 47.3 }, // CFrame yaw: -Z toward NW
	site1: { x: -480, z: -2400 }, site2: { x: -10080, z: -8160 },
	route: [[12000, 9120], [-480, -2400], [-10080, -8160], [-10080, 11040]],
	gorge: [[-4500, -4600], [-7500, -6200], [-8500, -900]],
	returnLine: { x1: -13500, x2: 13500, z: 11040 },
	// Flat lowland east of the mountain return route; runway heading north.
	landing: { x: 6000, y: 80, z: 11264, headingDegrees: 0, length: 2304, width: 128 },
	budget: { voxelWrites: 8e9, jobs: 180000, parts: 340, descendants: 450 },
};
export const M03_ENVIRONMENT: EnvironmentSpec = {
	label: "Clear snow late afternoon", clock: 16 + 28 / 60, brightness: 3, exposure: -0.12,
	ambient: [83, 108, 151], outdoorAmbient: [133, 154, 184], diffuse: 0.65, specular: 0.7,
	atmosphere: { density: 0.13, offset: 0, haze: 0.55, glare: 0.45, color: [195, 214, 231], decay: [29, 63, 122] },
	clouds: { cover: 0, density: 0, color: [255, 255, 255] },
	grade: { saturation: 0.08, contrast: 0.09, brightness: 0, tint: [235, 244, 255] },
	bloom: { intensity: 0.15, size: 32, threshold: 1.7 }, sky: "day", starCount: 0, sunSize: 18, moonSize: 8,
	water: { color: [60, 78, 86], reflectance: 0, transparency: 0, waveSize: 0, waveSpeed: 0 }, weather: "none",
};
export interface M03Target {
	id: string; type: "radar" | "aaGun" | "helicopter"; group: "site1" | "site2";
	x: number; y: number; z: number; yaw: number;
}
export interface M03Plan { key: string; seed: number; ops: TerrainOp[]; parts: PartSpec[]; targets: M03Target[]; detailCells: number; coarseCells: number }
const ridge = (x: number, z: number) => {
	const along = (x + 480) * 0.866 + (z + 2400) * 0.5;
	const across = -(x + 480) * 0.5 + (z + 2400) * 0.866;
	return 700 * math.clamp(1 - math.abs(across) / 850, 0, 1) * math.clamp(1 - math.max(0, math.abs(along) - 1100) / 2200, 0, 1);
};
export function m03Height(x: number, z: number): number {
	const wave = math.abs(math.sin((x + z * 0.4) / 1700)) * math.abs(math.cos((z - x * 0.2) / 1350));
	let h = 80 + 864 * wave;
	// Continuous deep gorge, with steep dark walls and a snow-covered floor.
	const gorge = polyDist(x, z, M03.gorge);
	h = math.max(h, 80 + ridge(x, z));
	// A high saddle: two higher peaks beyond a broad central snow bench.
	const dx = math.abs(x - M03.site2.x), dz = math.abs(z - M03.site2.z);
	const saddle = math.max(dx / 1050, dz / 650);
	if (saddle <= 1) h = 656;
	else if (saddle < 2) h = 656 - (saddle - 1) * 500;
	else if (saddle < 3) h = 156 + (saddle - 2) * 650;
	else if (saddle < 3.6) {
		const blend = (saddle - 3) / 0.6;
		h = 806 * (1 - blend) + h * blend;
	}
	if (gorge < 600) h = 80 + (h - 80) * math.clamp((gorge - 100) / 500, 0, 1);
	// Home lowland, blended through foothills rather than an abrupt slab.
	const low = math.max(math.abs(x - M03.landing.x) / 1400, math.abs(z - M03.landing.z) / 1408);
	const blend = math.clamp((low - 1) / 0.8, 0, 1);
	h = 80 + (h - 80) * blend;
	return math.floor(math.clamp(h, 80, M03.summit) / 4) * 4;
}
export function m03Detailed(x: number, z: number): boolean {
	return polyDist(x, z, M03.route) <= M03.corridorHalf || polyDist(x, z, M03.gorge) <= 768
		|| math.abs(x - M03.site1.x) < 1600 && math.abs(z - M03.site1.z) < 1200
		|| math.abs(x - M03.site2.x) < 1600 && math.abs(z - M03.site2.z) < 1400
		|| math.abs(x - M03.landing.x) < 1800 && math.abs(z - M03.landing.z) < 1600;
}
/** Entire coarse tiles are replaced, avoiding overlapping LOD surfaces. */
function detailedTile(x: number, z: number): boolean {
	for (let dx = 0; dx <= 256; dx += 128) for (let dz = 0; dz <= 256; dz += 128) if (m03Detailed(x + dx, z + dz)) return true;
	return false;
}
export function m03Ground(x: number, z: number): number {
	const tx = math.floor((x + M03.halfX) / 256) * 256 - M03.halfX;
	const tz = math.floor((z + M03.halfZ) / 256) * 256 - M03.halfZ;
	const side = detailedTile(tx, tz) ? 64 : 256;
	return m03Height(tx + math.floor((x - tx) / side) * side + side / 2, tz + math.floor((z - tz) / side) * side + side / 2);
}
export function m03Material(x: number, z: number): TerrainMaterial {
	const dx = (m03Height(x + 32, z) - m03Height(x - 32, z)) / 64;
	const dz = (m03Height(x, z + 32) - m03Height(x, z - 32)) / 64;
	if (math.sqrt(dx * dx + dz * dz) > 0.65 || dx > 0.32 && dz > 0.1) return "Rock";
	return z > 9600 && x > 3000 ? "Ground" : "Snow";
}
/** Engine-facing pure layout; y is the base, yaw radians uses CFrame convention. */
export function m03TargetLayout(): M03Target[] {
	const targets: M03Target[] = [];
	const add = (id: string, targetType: M03Target["type"], group: M03Target["group"], x: number, z: number, yaw = 0) => targets.push({ id, type: targetType, group, x, y: m03Ground(x, z), z, yaw });
	for (let i = 0; i < 5; i++) add(`m03_s1_radar_${i + 1}`, "radar", "site1", -480 + (i - 2) * 384, -2400 + (i - 2) * 192);
	for (let i = 0; i < 4; i++) add(`m03_s2_radar_${i + 1}`, "radar", "site2", -10400 + i * 224, -8160 + (i % 2) * 192);
	add("m03_s1_aa_1", "aaGun", "site1", -160, -2272, math.pi / 4);
	add("m03_s2_aa_1", "aaGun", "site2", -11552, -7520, 0);
	add("m03_s2_aa_2", "aaGun", "site2", -8544, -7520, math.pi);
	add("m03_s2_aa_3", "aaGun", "site2", -10528, -6496, math.pi / 2);
	add("m03_s2_helicopter", "helicopter", "site2", -10080, -8480, math.pi / 2);
	return targets;
}
export function buildM03Plan(seed = 303, checkpoint: () => void = () => {}): M03Plan {
	const p: M03Plan = { key: M03_WORLD_KEY, seed, ops: [], parts: [], targets: m03TargetLayout(), detailCells: 0, coarseCells: 0 };
	const block = (material: TerrainMaterial, x: number, z: number, side: number, bottom: number, top: number) => p.ops.push({ shape: "block", material, x, y: (bottom + top) / 2, z, sx: side, sy: top - bottom, sz: side, yaw: 0 });
	for (let x = -M03.halfX; x < M03.halfX; x += 256) for (let z = -M03.halfZ; z < M03.halfZ; z += 256) {
		const side = detailedTile(x, z) ? 64 : 256;
		for (let dx = 0; dx < 256; dx += side) for (let dz = 0; dz < 256; dz += side) {
			const cx = x + dx + side / 2, cz = z + dz + side / 2, top = m03Height(cx, cz), mat = m03Material(cx, cz);
			if (mat === "Rock") block(mat, cx, cz, side, 0, top);
			else { block("Rock", cx, cz, side, 0, top - 8); block(mat, cx, cz, side, top - 8, top); }
			if (side === 64) p.detailCells++; else p.coarseCells++;
		}
		checkpoint();
	}
	const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: [number, number, number], solid = false) => p.parts.push({ name, shape: "block", x, y, z, sx, sy, sz, yaw: 0, material: "Concrete", color, solid, grounded: solid });
	// Native moon direction is tied to the sun. A non-solid untextured distant
	// sphere keeps the reference's daytime moon above the horizon at 16:28.
	p.parts.push({ name: "Daytime moon", shape: "ball", x: -12000, y: 12000, z: -12500,
		sx: 120, sy: 120, sz: 120, yaw: 0, color: [216, 225, 235], material: "Neon", solid: false, grounded: false });
	const r = M03.landing;
	part("Landing runway", r.x, r.y + 2, r.z, r.width, 4, r.length, [39, 43, 48], true);
	part("Landing apron", r.x + 256, r.y + 2, r.z, 384, 4, 1024, [96, 102, 105], true);
	for (let i = 0; i < 16; i++) {
		const z = r.z - r.length / 2 + 64 + i * 144;
		part("Runway centre marking", r.x, 84.5, z, 5, 1, 56, [240, 240, 225]);
		for (const s of [-1, 1]) part("Runway edge light", r.x + s * 68, 86, z, 3, 4, 3, [255, 237, 170]);
	}
	for (let i = 0; i < 3; i++) part("Lowland hangar", r.x + 300, 104, r.z - 320 + i * 256, 128, 48, 160, [112, 121, 130], true);
	part("Control tower shaft", r.x + 160, 112, r.z + 512, 24, 64, 24, [130, 140, 150], true);
	part("Control tower cab", r.x + 160, 150, r.z + 512, 48, 12, 48, [74, 115, 139]);
	for (const t of p.targets) {
		// A level structural foundation covers all sampled columns beneath each small model.
		part(`${t.id} foundation`, t.x, t.y - 16, t.z, 48, 32, 48, [111, 117, 119], true);
		if (t.type === "radar") part("Radar equipment shed", t.x + 64, m03Ground(t.x + 64, t.z) + 6, t.z, 32, 12, 16, [110, 119, 124], true);
	}
	return p;
}
export function m03Counts(p: M03Plan) {
	let voxels = 0;
	for (const op of p.ops) voxels += fillVoxels(op);
	const jobs = terrainJobs(p.ops, M03_FILL_CHUNK).size();
	const targetParts = 9 * 2 + 4 * 3 + 7;
	return { voxels, jobs, parts: p.parts.size() + targetParts, descendants: p.parts.size() + targetParts + p.targets.size() + 1,
		// Conservative extrapolation from the 35k coarse spike, doubled for layered snow and variability.
		estimatedSeconds: 2 * jobs / 14124 * 13.78 };
}
