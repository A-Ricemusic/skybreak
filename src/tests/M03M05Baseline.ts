// Frozen pre-PR height fields from origin/main cb8e1d101bfa66f41c34870035e38919dd689ef4.
// Intentionally independent of the current world height/detail functions.
import { polyDist } from "../shared/Polyline";
const M03_BUILD_LIMITS = {};
export const M03 = {
	halfX: 15488, halfZ: 15488, bottom: 0, coarse: 512, detail: 128, targetDetail: 64, corridorHalf: 640,
	valley: 80, summit: 944, scale: 0.96,
	start: { x: 12000, y: 640, z: 9120, headingDegrees: 47.3 }, // CFrame yaw: -Z toward NW
	site1: { x: -480, z: -2400 }, site2: { x: -10080, z: -8160 },
	route: [[12000, 9120], [-480, -2400], [-10080, -8160], [-10080, 11040]],
	gorge: [[-4500, -4600], [-7500, -6200], [-8500, -900]],
	returnLine: { x1: -13500, x2: 13500, z: 11040 },
	// Flat lowland east of the mountain return route; runway heading north.
	landing: { x: 6000, y: 80, z: 11264, headingDegrees: 0, length: 2304, width: 128 },
	budget: M03_BUILD_LIMITS,
};
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
	// Flat exterior skirt covers the hard airspace without adding distant ridges.
	const skirt = math.clamp(math.min((14976 - math.abs(x)) / 512, (12928 - math.abs(z)) / 512), 0, 1);
	h = 80 + (h - 80) * skirt;
	// Reserve the entire southern landing corridor, blending its sides.
	if (z >= M03.landing.z) h = 80 + (h - 80) * math.clamp((math.abs(x - M03.landing.x) - 512) / 512, 0, 1);
	return math.floor(math.clamp(h, 80, M03.summit) / 4) * 4;
}
export function m03Detailed(x: number, z: number): boolean {
	return polyDist(x, z, M03.route) <= M03.corridorHalf || polyDist(x, z, M03.gorge) <= 768
		|| math.abs(x - M03.site1.x) < 1600 && math.abs(z - M03.site1.z) < 1200
		|| math.abs(x - M03.site2.x) < 1600 && math.abs(z - M03.site2.z) < 1400
		|| math.abs(x - M03.landing.x) < 1800 && math.abs(z - M03.landing.z) < 1600;
}
// Keep the original 64-stud sampling under every target, shed and rotor.
// This list contains coordinates only; querying ground here would recurse.
function targetPositions(): number[][] {
	const out: number[][] = [];
	for (let i = 0; i < 5; i++) out.push([-480 + (i - 2) * 384, -2400 + (i - 2) * 192]);
	for (let i = 0; i < 4; i++) out.push([-10400 + i * 224, -8160 + (i % 2) * 192]);
	out.push([-160, -2272], [-11552, -7520], [-8544, -7520], [-10528, -6496], [-10080, -8480]);
	return out;
}
const TARGET_POSITIONS = targetPositions();
function targetTile(x: number, z: number): boolean {
	for (const t of TARGET_POSITIONS) if (t[0] >= x - 128 && t[0] <= x + 256 && t[1] >= z - 128 && t[1] <= z + 256) return true;
	return false;
}
/** Whole 512-stud tiles refine to 128 along the flight reservation. */
function detailedTile(x: number, z: number): boolean {
	for (let dx = 0; dx <= 512; dx += 128) for (let dz = 0; dz <= 512; dz += 128) if (m03Detailed(x + dx, z + dz)) return true;
	return false;
}
function cellAt(x: number, z: number) {
	const tx = math.floor((x + M03.halfX) / 512) * 512 - M03.halfX;
	const tz = math.floor((z + M03.halfZ) / 512) * 512 - M03.halfZ;
	let side = detailedTile(tx, tz) ? 128 : 512;
	let cx = tx + math.floor((x - tx) / side) * side, cz = tz + math.floor((z - tz) / side) * side;
	if (side === 128 && targetTile(cx, cz)) {
		side = 64;
		cx += math.floor((x - cx) / side) * side; cz += math.floor((z - cz) / side) * side;
	}
	const sx = math.min(side, M03.halfX - cx), sz = math.min(side, M03.halfZ - cz);
	return { x: cx, z: cz, sx, sz, top: m03Height(cx + sx / 2, cz + sz / 2) };
}
export function m03Ground(x: number, z: number): number {
	return cellAt(x, z).top;
}
export const M04 = {
 half: 16384, start: { x: -7000, y: 1202, z: 10000, headingDegrees: 20 },
 // D-096: extend the NE/east/SE hook south then west for a 6:30–7:00 escape at 140 studs/s.
 route: [[-7000, 10000], [-3000, 2000], [2000, -10000], [11000, -11000], [12500, 2000], [12500, 11000], [4500, 11000]],
 river: [[-9000, 14000], [-5000, 5000], [0, 0], [-1500, -6000], [3000, -15000]],
};
export function m04Height(x: number, z: number): number {
 const valley = polyDist(x, z, M04.river);
 const relief = 150 + 420 * math.abs(math.sin(x / 2600 + z / 5100) * math.cos(z / 2300));
 return math.floor((24 + relief * math.clamp((valley - 128) / 1500, 0, 1)) / 4) * 4;
}
export function m04Detailed(x: number, z: number): boolean {
 // Only the middle route band needs near-ground detail in this aerial mission.
 return polyDist(x, z, [[-3000, 2000], [2000, -10000]]) < 320;
}
export const M05 = {
 half: 16384, sea: 32, pavement: 48, deck: 120,
 refinery: { x: -8900, z: -7000, hx: 1056, hz: 1536 },
 rig: { x: 9600, z: -7500 }, base: { x: -1024, z: 6700 },
 start: { x: 0, y: 544, z: 5740, headingDegrees: 0 },
 returnLine: { x1: -14000, x2: 14000, z: 9400 },
 escape: { x: 2400, halfWidth: 1800, z1: -5000, z2: 12000 },
 runway: { x: -1024, z: 6700, y: 48, length: 2880, width: 96, headingDegrees: 0 },
};
export const m05Coast = (z: number) => math.min(-256, -4000 + z * 0.52);
export function m05Height(x: number, z: number): number {
 // The refinery is inland of the north/south coast; flatten its full foundation.
 if (math.abs(x + 8900) < 1600 && math.abs(z + 7000) < 2100) return 36;
 if (math.abs(x + 1024) < 768 && math.abs(z - 6700) < 2048) return 36;
 const inland = m05Coast(z) - x;
 if (inland < 0) return 8; // Keel Y=16: eight studs clear across the navigable sea.
 return math.floor((36 + math.clamp((inland - 2000) / 3500, 0, 1) * (96 + 192 * math.abs(math.sin(x / 2100) * math.cos(z / 2700)))) / 4) * 4;
}
export function m05Detailed(x: number, z: number): boolean {
 // Flat seabed needs no fine tiles: retain detail only at land foundations.
 return math.abs(x + 8900) < 1300 && math.abs(z + 7000) < 1800
  || math.abs(x + 1024) < 800 && math.abs(z - 6700) < 1800;
}

function surfaceGround(height: (x: number, z: number) => number, detail: (x: number, z: number) => boolean, x: number, z: number): number {
 const tx = math.floor(x / 1024) * 1024, tz = math.floor(z / 1024) * 1024;
 let side = 1024;
 for (let dx = 0; dx <= 1024; dx += 256) for (let dz = 0; dz <= 1024; dz += 256)
  if (detail(tx + dx, tz + dz)) side = 128;
 return math.max(32, height(math.floor(x / side) * side + side / 2, math.floor(z / side) * side + side / 2));
}
export const baselineM04 = (x: number, z: number) => surfaceGround(m04Height, m04Detailed, x, z);
export const baselineM05 = (x: number, z: number) => surfaceGround(m05Height, m05Detailed, x, z);
