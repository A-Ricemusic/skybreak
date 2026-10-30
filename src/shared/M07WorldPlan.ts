import type { PartSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import type { EnvironmentSpec } from "./EnvironmentPresets";
export const M07_WORLD_KEY = "m07_two_ridges";
export const M07 = {
 half: 16384, start: { x: 0, y: 968, z: 15360, headingDegrees: 0 },
 south: { x: 0, y: 160, z: 6720 }, middle: { x: 960, y: 190, z: 0 }, plant: { x: 0, y: 230, z: -8640 },
 canyonA: { x: -1920, y: 120, z: -4800 }, canyonB: { x: -3840, y: 90, z: 0 }, canyonC: { x: -1920, y: 70, z: 5760 },
 escape: { x: 0, y: 32, z: 11520 }, artilleryCeiling: 32 + 0.96 * 0.3048 * 2000,
};
export const M07_ENVIRONMENT: EnvironmentSpec = {
 ...M06_ENVIRONMENT, label: "Golden arid dusk 16:40", clock: 16 + 40 / 60, brightness: 1.7, exposure: 0,
 ambient: [111, 103, 108], outdoorAmbient: [148, 128, 112],
 atmosphere: { density: 0.23, offset: 0.1, haze: 1.3, glare: 0.25, color: [196, 179, 162], decay: [106, 116, 139] },
 clouds: { cover: 0.12, density: 0.12, color: [207, 185, 164] },
 grade: { saturation: -0.12, contrast: 0.12, brightness: 0, tint: [255, 231, 202] },
 sky: "dusk", moonSize: 12, sunSize: 22,
};
/** Centreline preserves all three sketch bends. Heights are floor heights;
 * flight route adds 56 studs, below the absolute 2,000-ft hazard band. */
export const M07_CANYON = [
 { x: 0, z: -7000, floor: 100 }, { x: -1920, z: -4800, floor: 64 },
 { x: -3840, z: 0, floor: 32 }, { x: -1920, z: 5760, floor: 12 }, { x: 0, z: 11520, floor: 8 },
];
export function m07CanyonSample(x: number, z: number): { distance: number; floor: number } {
 let distance = math.huge, floor = 8;
 for (let i = 1; i < M07_CANYON.size(); i++) {
  const a = M07_CANYON[i - 1], b = M07_CANYON[i], dx = b.x - a.x, dz = b.z - a.z;
  const t = math.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
  const ex = x - a.x - dx * t, ez = z - a.z - dz * t, d = math.sqrt(ex * ex + ez * ez);
  if (d < distance) { distance = d; floor = a.floor + t * (b.floor - a.floor); }
 }
 return { distance, floor };
}
export function m07Height(x: number, z: number): number {
 for (const f of [M07.south, M07.middle, M07.plant]) if (math.abs(x - f.x) < (f === M07.south ? 900 : 1500) && math.abs(z - f.z) < (f === M07.south ? 900 : 1100)) return 4 * math.floor((f.y - 12) / 4);
 const c = m07CanyonSample(x, z);
 if (c.distance < 1400) return 4 * math.floor((c.floor + math.clamp((c.distance - 640) / 760, 0, 1) * 540) / 4);
 return 320 + 32 * math.floor(8 * math.abs(math.sin(x / 1900) * math.cos(z / 2600)));
}
export const M07_SURFACE: WorldSurface = { height: m07Height, detail: (x, z) => m07CanyonSample(x, z).distance < 1500 || [M07.south, M07.middle, M07.plant].some(f => math.abs(x - f.x) < 1700 && math.abs(z - f.z) < 1300), material: () => "Sandstone" };
export const m07Ground = (x: number, z: number) => surfaceGround(M07_SURFACE, x, z);
export type M07TargetType = "solar_panel" | "radar" | "control_room" | "solar_tower" | "flak" | "sam" | "aa" | "pillbox";
export interface M07Target { id: string; type: M07TargetType; group: string; x: number; y: number; z: number; yaw: number }
/** 52 credited ground contacts; the initial 51 roster discrepancy is unresolved.
 * No air actors or inferred spawn waves are instantiated by this scenery. */
export function m07TargetLayout(): M07Target[] {
 const out: M07Target[] = [];
 const add = (targetType: M07TargetType, group: string, x: number, y: number, z: number) => out.push({ id: `m07_${group}_${targetType}_${out.size() + 1}`, type: targetType, group, x, y, z, yaw: 0 });
 for (const f of [M07.south, M07.middle, M07.plant]) {
  const group = f === M07.south ? "south" : f === M07.middle ? "middle" : "plant", n = group === "plant" ? 11 : 15;
  for (let i = 0; i < n; i++) add("solar_panel", group, f.x - (group === "south" ? 600 : 1000) + (i % 5) * (group === "south" ? 300 : 400), f.y, f.z - (group === "south" ? 400 : 600) + math.floor(i / 5) * 400);
 }
 add("radar", "plant", -1000, 230, -8040); add("control_room", "plant", -400, 230, -8040); add("solar_tower", "plant", 400, 230, -8040);
 const types: M07TargetType[] = ["flak", "flak", "sam", "sam", "aa", "aa", "pillbox", "pillbox"];
 for (let i = 0; i < types.size(); i++) add(types[i], "plant", -1200 + (i % 4) * 800, 230, i < 4 ? -9500 : -7780);
 return out;
}
export function buildM07Plan(seed = 707, checkpoint: () => void = () => {}) {
 const terrain = compactSurface(M07_SURFACE, checkpoint), parts: PartSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material = "Concrete", color: [number, number, number] = [129, 112, 88], shape: PartSpec["shape"] = "block") => parts.push({ name, x, y, z, sx, sy, sz, material, color, shape, yaw: 0, solid: true, grounded: false });
 for (const f of [M07.south, M07.middle, M07.plant]) {
  const w = f === M07.south ? 800 : 1300, d = f === M07.south ? 1400 : 2000;
  for (const sign of [-1, 1]) part("Array foundation", f.x + sign * w / 2, f.y - 8, f.z, w, 16, d);
 }
 for (const t of m07TargetLayout()) {
  if (t.type === "solar_panel") {
   part(t.id, t.x, t.y + 8, t.z, 120, 16, 80, "Metal", [70, 75, 76]);
   part(t.id, t.x, t.y + 18, t.z, 160, 4, 120, "Glass", [156, 186, 197]);
  } else if (t.type === "solar_tower") {
   part(t.id, t.x, t.y + 150, t.z, 30, 300, 30); part(t.id, t.x, t.y + 290, t.z, 64, 32, 64, "Metal", [224, 202, 143]);
  } else if (t.type === "radar") {
   part(t.id, t.x, t.y + 24, t.z, 24, 48, 24); part(t.id, t.x, t.y + 54, t.z, 52, 12, 32, "Metal");
  } else if (t.type === "control_room" || t.type === "pillbox") part(t.id, t.x, t.y + 18, t.z, 100, 36, 80);
  else { part(t.id, t.x, t.y + 5, t.z, 24, 10, 24); part(t.id, t.x, t.y + 14, t.z, 12, 8, 40, "Metal"); }
 }
 return { ...terrain, key: M07_WORLD_KEY, seed, parts, props: [], targets: m07TargetLayout() };
}
export const m07Counts = (p: ReturnType<typeof buildM07Plan>) => compactWorldCounts(p, 0);
