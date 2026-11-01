export const M04_TERRAIN_BUDGET = 0.25;
import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { polyDist } from "./Polyline";
import { sealedSurface, surfaceGround, surfaceSide, type WorldSurface } from "./SealedWorldSurface";
import { worldCounts } from "./WorldCompositionCounts";
export const M04_WORLD_KEY = "m04_inland_hills";
export const M04 = {
 half: 16384, start: { x: -7000, y: 1202, z: 10000, headingDegrees: 20 },
 // D-096: extend the NE/east/SE hook south then west for a 6:30–7:00 escape at 140 studs/s.
 route: [[-7000, 10000], [-3000, 2000], [2000, -10000], [11000, -11000], [12500, 2000], [12500, 11000], [4500, 11000]],
 river: [[-9000, 14000], [-5000, 5000], [0, 0], [-1500, -6000], [3000, -15000]],
};
export const M04_ENVIRONMENT: EnvironmentSpec = {
 label: "Clear inland noon 12:26", clock: 12 + 26 / 60, brightness: 2.7, exposure: -0.1,
 ambient: [80, 99, 137], outdoorAmbient: [116, 137, 163], diffuse: 0.7, specular: 0.25,
 atmosphere: { density: 0.24, offset: 0, haze: 1.5, glare: 0.1, color: [109, 133, 184], decay: [40, 69, 137] },
 clouds: { cover: 0.15, density: 0.2, color: [225, 231, 241] },
 grade: { saturation: 0.04, contrast: 0.04, brightness: 0, tint: [235, 243, 255] },
 bloom: { intensity: 0.05, size: 24, threshold: 2 }, sky: "day", starCount: 0, sunSize: 14, moonSize: 0,
 water: { color: [55, 74, 80], reflectance: 0.1, transparency: 0, waveSize: 0, waveSpeed: 0 }, weather: "none",
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
/** Snap each short rotated strip inside one sampled cell, avoiding every terrain step. */
export function m04Tracks() {
 const out: Array<{x: number; z: number; yaw: number}> = [];
 for (let i = 0; i < 32; i++) {
  const z = -14000 + i * 880, x = -1800 + 2400 * math.sin(z / 4200);
  const side = surfaceSide(M04_SURFACE, x, z);
  out.push({x: math.floor(x / side) * side + side / 2, z: math.floor(z / side) * side + side / 2, yaw: 0.3 * math.cos(z / 4200)});
 }
 return out;
}
export const M04_SURFACE: WorldSurface = {
 height: m04Height, detail: m04Detailed,
 material: (x, z) => m04Tracks().some(t => t.x === x && t.z === z) ? "Ground" : polyDist(x, z, M04.river) < 160 ? "Mud" : math.sin(x / 640) * math.cos(z / 768) > 0.65 ? "Grass" : "LeafyGrass",
};
export const m04Ground = (x: number, z: number) => surfaceGround(M04_SURFACE, x, z);
export interface M04Target { id: string; type: "transport" | "jammer" | "escort" | "ace"; group: string; x: number; y: number; z: number; yaw: number }
/** Initial air contact poses only: five escorts and the ace initially, four later reinforcements.
 * Scene poses do not implement the mission's movement or spawn timing.
 */
export function m04TargetLayout(): M04Target[] {
 const out: M04Target[] = [];
 const add = (targetType: M04Target["type"], i: number, x: number, y: number, z: number, group: string) => out.push({ id: targetType === "ace" ? "m04_ace" : `m04_${targetType}_${i + 1}`, type: targetType, group, x, y, z, yaw: -math.pi / 4 });
 for (let i = 0; i < 3; i++) add("transport", i, -4550 + i * 240, 1202, 5100 + i * 160, "transports");
 for (let i = 0; i < 2; i++) add("jammer", i, -5100 + i * 1500, 1524, 4800, "jammers");
 for (let i = 0; i < 10; i++) add(i === 9 ? "ace" : "escort", i, -5500 + (i % 5) * 480, 1000 + (i % 3) * 160, 3800 + math.floor(i / 5) * 900, i < 5 || i === 9 ? "initial_escorts" : "reinforcements");
 return out;
}
export function buildM04Plan(seed = 404, checkpoint: () => void = () => {}) {
 const terrain = sealedSurface(M04_SURFACE, checkpoint), parts: PartSpec[] = [], props: PropSpec[] = [];
 // Pale valley tracks; no invented settlement, highway, coast or airbase.
 for (const {x, z, yaw} of m04Tracks()) {
  const y = m04Ground(x, z);
  parts.push({ name: "Valley dirt track", shape: "block", x, y: y + 0.5, z, sx: 10, sy: 1, sz: 100, yaw, color: [143, 132, 94], material: "Ground", solid: false, grounded: false });
 }
 // Sparse canopy silhouettes; material carries the distant forest.
 for (let i = 0; i < 120; i++) {
  const x = -13000 + ((i * 997 + math.abs(seed)) % 26000), z = -14000 + ((i * 1733) % 28000);
  const side = surfaceSide(M04_SURFACE, x, z), px = math.floor(x / side) * side + side / 2, pz = math.floor(z / side) * side + side / 2;
  props.push({ asset: "Pine", x: px, y: m04Ground(px, pz), z: pz, yaw: i, scale: 1.8, tint: 0 });
 }
 return { ...terrain, key: M04_WORLD_KEY, seed, parts, props, targets: m04TargetLayout() };
}
export const m04Counts = (p: ReturnType<typeof buildM04Plan>) => worldCounts(p, 15 * 4);
