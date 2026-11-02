import type { EnvironmentSpec } from "./EnvironmentPresets";
import { fillVoxels, terrainJobs } from "./TerrainSchedule";
import { polyDist } from "./Polyline";
import type { TerrainOp, TerrainMaterial, PartSpec, PropSpec } from "./WorldPlan";

export const M02_WORLD_KEY = "m02_farm_airbase";
export const M02_FILL_CHUNK = 65536;
// An eight-stud slab from the terrain terrace (32) up to 40. Measured in Studio: smooth grass renders
// about 4-6 studs above its voxels, so a four-stud slab topping out at 36 was invisible at every range.
export const M02_PAVEMENT_TOP = 40;
const PAVEMENT_DEPTH = 8;
const PAVEMENT_CENTRE = M02_PAVEMENT_TOP - PAVEMENT_DEPTH / 2;
export const M02 = {
	half: 16384, coarse: 256, detail: 64, corridorHalf: 768,
	base: { x: -1024, z: -12500, hx: 1408, hz: 1920 },
	substation: { x: 0, z: 3200, hx: 256, hz: 256 },
	route: [[0, 12500], [0, 3200], [-1024, -12500]],
	budget: { voxelWrites: 260e6, jobs: 30000, parts: 340, props: 240, descendants: 1300 },
};
export const M02_ENVIRONMENT: EnvironmentSpec = {
	label: "Farmland overcast 13:29", clock: 13 + 29 / 60, brightness: 1.7, exposure: -0.05,
	ambient: [110, 126, 116], outdoorAmbient: [132, 151, 142], diffuse: 0.65, specular: 0.15,
	atmosphere: { density: 0.19, offset: 0.04, haze: 1.2, glare: 0, color: [132, 163, 171], decay: [103, 126, 114] },
	clouds: { cover: 0.8, density: 0.28, color: [166, 181, 178] },
	grade: { saturation: -0.3, contrast: 0.02, brightness: 0, tint: [225, 238, 222] },
	bloom: { intensity: 0, size: 20, threshold: 2 }, sky: "overcast", starCount: 0, sunSize: 0, moonSize: 0,
	water: { color: [72, 94, 85], reflectance: 0.1, transparency: 0, waveSize: 0.05, waveSpeed: 3 }, weather: "none",
};
const inside = (x: number, z: number, r: { x: number; z: number; hx: number; hz: number }, skirt = 0) => math.abs(x - r.x) <= r.hx + skirt && math.abs(z - r.z) <= r.hz + skirt;
export function m02Detailed(x: number, z: number): boolean {
	return polyDist(x, z, M02.route) <= M02.corridorHalf || inside(x, z, M02.base, 256) || inside(x, z, M02.substation);
}
/** Continuous lake basin, west of the base; lake surface is 24. */
function lakeRadius(x: number, z: number): number {
	return math.sqrt(((x + 3500 + 120 * math.sin(z / 900)) / 850) ** 2 + ((z + 11700) / 3400) ** 2);
}
export function m02Height(x: number, z: number): number {
	if (inside(x, z, M02.base, 128) || inside(x, z, M02.substation, 128)) return 32;
	let h = 32 + 8 * math.sin(x / 1100) * math.sin(z / 1400);
	const west = math.max(0, 1 - math.abs(x + 6800) / 3600);
	const north = math.clamp((-z - 5000) / 6000, 0, 1);
	// Two rounded ridges separated by a NW valley.
	h += west * north * (180 + 180 * (0.5 + 0.5 * math.cos((x + z) / 1200)));
	const lake = lakeRadius(x, z);
	if (lake < 1.12) h = math.min(h, 8 + math.clamp((lake - 0.88) / 0.24, 0, 1) * 32);
	return math.floor(h / 4) * 4;
}
export type M02TargetType = "bomber" | "hangar" | "aa" | "control_tower" | "substation";
export interface M02Target { id: string; type: M02TargetType; x: number; y: number; z: number; yaw: number; group: string }
/** Contact poses, not combat instances. Eleven bombers TOTAL, in groups 4/3/2/2. */
export function m02TargetLayout(): M02Target[] {
	const out: M02Target[] = [];
	const add = (targetType: M02TargetType, x: number, z: number, group: string, yaw = 0) => out.push({ id: `m02_${targetType}_${out.size() + 1}`, type: targetType, x, y: targetType === "bomber" || targetType === "control_tower" || targetType === "substation" ? M02_PAVEMENT_TOP : m02Ground(x, z), z, yaw, group });
	for (let i = 0; i < 4; i++) add("bomber", -1500, -12950 + i * 180, "A", math.pi / 2);
	for (let i = 0; i < 3; i++) add("bomber", -200, -13700 + i * 220, "B");
	for (let i = 0; i < 2; i++) add("bomber", -1600, -11400 + i * 180, "C");
	for (let i = 0; i < 2; i++) add("bomber", -1800, -13800 + i * 180, "D");
	for (const z of [-14000, -13750, -13500, -11750, -11500, -11250, -11000]) add("hangar", -2000, z, "west", -math.pi / 2);
	for (const x of [-2200, 100]) for (const z of [-14000, -11000]) add("aa", x, z, "perimeter");
	add("control_tower", -1700, -12400, "terminal");
	add("substation", 0, 3200, "power_line");
	return out;
}
export const M02_RUNWAY = {
	centreline: { x: -1024, y: M02_PAVEMENT_TOP, z: -12500, yaw: 0, length: 2880, width: 64 },
	threshold: { x: -1024, y: M02_PAVEMENT_TOP, z: -11060, yaw: 0 },
	northThreshold: { x: -1024, y: M02_PAVEMENT_TOP, z: -13940, yaw: 0 },
};
export interface M02Beam { name: string; a: [number, number, number]; b: [number, number, number]; color: [number, number, number] }
/** `target` names the m02TargetLayout id a part or prop draws; the world hands those to combat as that target's model. */
export type M02Part = PartSpec & { target?: string };
export interface M02Plan { key: string; seed: number; ops: TerrainOp[]; parts: M02Part[]; props: PropSpec[]; beams: M02Beam[]; detailCells: number; coarseCells: number }
const block = (material: TerrainMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number): TerrainOp => ({ shape: "block", material, x, y, z, sx, sy, sz, yaw: 0 });
/** Same tile subdivision used by terrain and contact queries. Shore sampled at 16 studs. */
function tileSide(x: number, z: number, side: number): boolean {
	const r = lakeRadius(x + side / 2, z + side / 2);
	return side > 16 && math.abs(r - 1) < side / 600 + 0.12;
}
export function m02Ground(x: number, z: number): number {
	let tx = math.floor(x / 256) * 256, tz = math.floor(z / 256) * 256, side = 256;
	if (detailTile(tx, tz)) side = 64;
	tx = math.floor(x / side) * side; tz = math.floor(z / side) * side;
	while (tileSide(tx, tz, side)) { side /= 2; tx = math.floor(x / side) * side; tz = math.floor(z / side) * side; }
	return m02Height(tx + side / 2, tz + side / 2);
}
function detailTile(x: number, z: number): boolean {
	for (let dx = 0; dx <= 256; dx += 64) for (let dz = 0; dz <= 256; dz += 64) if (m02Detailed(x + dx, z + dz)) return true;
	return false;
}
export function buildM02Plan(seed = 202, checkpoint: (phase?: string) => void = () => {}): M02Plan {
	const p: M02Plan = { key: M02_WORLD_KEY, seed, ops: [], parts: [], props: [], beams: [], detailCells: 0, coarseCells: 0 };
	// Coalesce identical neighbouring columns without reducing 64/16-stud sampling.
	// Native fills stay under the same 65,536-cell bound; all surfaces are unchanged.
	const previous = new Map<string, TerrainOp>();
	const append = (op: TerrainOp) => {
		const key = `${op.x},${op.sx},${op.material}`;
		const last = previous.get(key);
		if (last !== undefined && last.y === op.y && last.sy === op.sy && last.z + last.sz / 2 === op.z - op.sz / 2 && last.sz + op.sz <= 2048 && (last.sz + op.sz) * op.sx * op.sy / 64 <= M02_FILL_CHUNK) {
			last.z += op.sz / 2; last.sz += op.sz;
		} else { p.ops.push(op); previous.set(key, op); }
	};
	const tile = (x: number, z: number, side: number): void => {
		if (tileSide(x, z, side)) { const s = side / 2; for (let dx = 0; dx < side; dx += s) for (let dz = 0; dz < side; dz += s) tile(x + dx, z + dz, s); return; }
		const cx = x + side / 2, cz = z + side / 2, top = m02Height(cx, cz);
		// Shallow connected crust: enough buried depth to bridge neighbouring sampled heights.
		let bottom = top - 8;
		for (const dx of [-side, 0, side]) for (const dz of [-side, 0, side]) bottom = math.min(bottom, m02Height(cx + dx, cz + dz) - 8);
		const field = (math.abs(math.floor(cx / 512) * 7 + math.floor(cz / 768) * 3) % 4);
		const mat: TerrainMaterial = top < 24 ? "Mud" : cx < -4800 && cz < -5000 ? "LeafyGrass" : field === 0 ? "Ground" : field === 1 ? "Grass" : "LeafyGrass";
		append(block(mat, cx, (top + bottom) / 2, cz, side, top - bottom, side));
		if (top < 24) append(block("Water", cx, (top + 24) / 2, cz, side, 24 - top, side));
		if (side <= 64) p.detailCells++; else p.coarseCells++;
	};
	for (let x = -M02.half; x < M02.half; x += 256) for (let z = -M02.half; z < M02.half; z += 256) {
		const side = detailTile(x, z) ? 64 : 256;
		for (let dx = 0; dx < 256; dx += side) for (let dz = 0; dz < 256; dz += side) tile(x + dx, z + dz, side);
		checkpoint("surface.sample");
	}
	const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: [number, number, number], shape: PartSpec["shape"] = "block", solid = false, target?: string) => p.parts.push({ name, x, y, z, sx, sy, sz, color, shape, material: "SmoothPlastic", yaw: 0, solid, grounded: false, target });
	// One consistent opaque lake surface, no mixed native/Part seam; 16-stud sampled shore clips it.
	for (let z = -15100; z < -8300; z += 400) {
		const rz = (z + 200 + 11700) / 3400;
		if (math.abs(rz) >= 1) continue;
		const width = 2 * 850 * math.sqrt(1 - rz * rz);
		part("Lake surface", -3500 - 120 * math.sin((z + 200) / 900), 22.25, z + 200, width, 4, 404, [72, 94, 85]);
	}
	const pavement: [number, number, number] = [111, 119, 111];
	for (const z of [-13220, -11780]) {
		part("Runway", -1024, PAVEMENT_CENTRE, z, 64, PAVEMENT_DEPTH, 1440, pavement, "block", true);
		part("Parallel taxiway", -736, PAVEMENT_CENTRE, z, 40, PAVEMENT_DEPTH, 1440, pavement, "block", true);
	}
	for (const z of [-13800, -12500, -11300]) part("Taxiway crosslink", -1150, PAVEMENT_CENTRE, z, 900, PAVEMENT_DEPTH, 36, pavement, "block", true);
	for (const z of [-13220, -11780]) part("West taxiway", -1530, PAVEMENT_CENTRE, z, 36, PAVEMENT_DEPTH, 1440, pavement, "block", true);
	part("Main apron", -1530, PAVEMENT_CENTRE, -12500, 500, PAVEMENT_DEPTH, 1100, pavement, "block", true);
	for (let i = 0; i < 12; i++) part("Runway centre stripe", -1024, M02_PAVEMENT_TOP + 0.15, -13820 + i * 240, 3, 0.2, 80, [205, 210, 198]);
	for (const t of m02TargetLayout()) {
		if (t.type === "bomber") {
			if (t.group !== "A") { const lane = t.group === "B" ? -736 : -1530; part("Pad connector", (lane + t.x) / 2, PAVEMENT_CENTRE, t.z, math.abs(lane - t.x) + 36, PAVEMENT_DEPTH, 28, pavement, "block", true); }
			part("Dispersal hardstand", t.x, PAVEMENT_CENTRE, t.z, 140, PAVEMENT_DEPTH, 140, pavement, "cylinder", true);
			// Annular taxi loop: four short tangent slabs around a clear inner grass square.
			if (t.group === "B" || t.group === "D") for (const s of [-1, 1]) {
				part("Loop taxiway", t.x + s * 85, PAVEMENT_CENTRE, t.z, 24, PAVEMENT_DEPTH, 194, pavement, "block", true);
				part("Loop taxiway", t.x, PAVEMENT_CENTRE, t.z + s * 85, 146, PAVEMENT_DEPTH, 24, pavement, "block", true);
			}
		} else if (t.type === "hangar" || t.type === "control_tower") p.props.push({ asset: t.type === "hangar" ? "Hangar" : "ControlTower", x: t.x, y: t.y, z: t.z, yaw: t.yaw, scale: 1, tint: 0, tag: t.id });
		else if (t.type === "aa") {
			// The emplacement rises clear of the rendered grass, like the pavement.
			part("AA emplacement", t.x, 36, t.z, 22, 8, 22, [77, 85, 67], "cylinder", false, t.id);
			part("AA turret", t.x, 44, t.z, 10, 8, 12, [62, 74, 61], "block", false, t.id);
			part("AA barrel", t.x, 47, t.z - 15, 2, 2, 28, [65, 71, 64], "block", false, t.id);
		} else {
			part("Substation yard", t.x, PAVEMENT_CENTRE, t.z, 160, PAVEMENT_DEPTH, 96, pavement, "block", true);
			for (const x of [-50, 0, 50]) part("Transformer", x, t.y + 10, t.z, 26, 20, 32, [88, 98, 91], "block", false, t.id);
			for (const s of [-1, 1]) { part("Yard fence", s * 80, t.y + 6, t.z, 2, 12, 96, [119, 128, 119]); part("Yard fence", 0, t.y + 6, t.z + s * 48, 160, 12, 2, [119, 128, 119]); }
		}
	}
	part("Terminal", -1850, 48, -12400, 160, 32, 58, [177, 184, 174], "block", true);
	for (let i = 0; i < 5; i++) part("Shore fuel tank", -2330, 51, -11600 + i * 85, 58, 38, 58, [190, 197, 185], "cylinder", true);
	// Eighteen red/white lattice pylons, with actual diagonal braces and suspended wires.
	for (let i = 0; i < 18; i++) {
		const z = 12500 - i * 1500, x = 0, y = m02Ground(x, z);
		for (const s of [-1, 1]) {
			const color: [number, number, number] = s === -1 ? [177, 63, 53] : [219, 221, 208];
			for (const depth of [-8, 8]) p.beams.push({ name: "Pylon leg", a: [x + s * 16, y, z + depth], b: [x + s * 5, y + 56, z + depth / 2], color });
			p.beams.push({ name: "Pylon brace", a: [x + s * 16, y, z], b: [x - s * 10, y + 28, z], color });
			p.beams.push({ name: "Pylon brace", a: [x + s * 10, y + 28, z], b: [x - s * 5, y + 56, z], color });
		}
		part("Pylon crossarm", x, y + 52, z, 56, 3, 3, [219, 221, 208]);
		if (i > 0) { const px = 0, pz = z + 1500; p.beams.push({ name: "Power cable", a: [px, m02Ground(px, pz) + 52, pz], b: [x, y + 52, z], color: [56, 62, 57] }); }
	}
	let state = math.abs(math.floor(seed)) % 2147483646 + 1;
	const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
	for (let i = 0; i < 150; i++) {
		const x = i < 100 ? -7800 + random() * 3200 : -2500 + random() * 5000, z = -14500 + random() * 27000;
		if (inside(x, z, M02.base, 256) || inside(x, z, M02.substation, 256) || lakeRadius(x, z) < 1.2) continue;
		p.props.push({ asset: "Broadleaf", x, y: m02Ground(x, z), z, yaw: random() * math.pi, scale: 1.2 + random(), tint: 0 });
	}
	for (let i = 0; i < 18; i++) {
		const z = 12000 - i * 1200, x = i % 2 === 0 ? 1100 : -1900;
		part("Hedgerow", x, m02Ground(x, z) + 6, z, 400, 12, 12, [47, 65, 42]);
		if (i % 3 === 0) p.props.push({ asset: i % 2 === 0 ? "Barn" : "Farmhouse", x: x + 240, y: m02Ground(x + 240, z), z, yaw: 0, scale: 1, tint: 0 });
	}
	checkpoint("surface.sample");
	return p;
}
export function m02Counts(p: M02Plan) {
	let voxels = 0;
	for (const op of p.ops) voxels += fillVoxels(op);
	const jobs = terrainJobs(p.ops, M02_FILL_CHUNK).size(), parts = p.parts.size() + p.beams.size() + 8;
	// Extrapolation from M01 tuned cold 7.915s / 27,494 jobs; reserve 2x variance.
	return { voxels, jobs, parts, props: p.props.size() + 11, descendants: parts + p.props.size() * 4 + 11 * 20 + 4, estimatedSeconds: 2 * (jobs / 27494 * 7.915 + 1) };
}
