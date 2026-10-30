import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { worldCounts } from "./WorldCompositionCounts";
export const M06_WORLD_KEY = "m06_military_quays";
export const M06 = {
 half: 16384, sea: 32, pavement: 48,
 start: { x: 0, y: 385, z: 9600, headingDegrees: 0 },
 outer: { x: 0, y: 32, z: 3840 },
 basins: [{ x: -6720, z: -2880, group: "west" }, { x: 0, z: -3840, group: "central" }, { x: 6720, z: -3840, group: "east" }],
 runway: { x: -6720, y: 48, z: 11520, width: 96, length: 2880, headingDegrees: 0 },
};
export const M06_ENVIRONMENT: EnvironmentSpec = {
 label: "Hazy harbour noon 12:00", clock: 12, brightness: 2, exposure: 0,
 ambient: [111, 120, 132], outdoorAmbient: [140, 143, 139], diffuse: 0.6, specular: 0.4,
 atmosphere: { density: 0.32, offset: 0.1, haze: 2.2, glare: 0.3, color: [177, 186, 194], decay: [117, 122, 113] },
 clouds: { cover: 0.25, density: 0.18, color: [192, 198, 202] },
 grade: { saturation: -0.16, contrast: 0.04, brightness: 0, tint: [242, 239, 222] },
 bloom: { intensity: 0.1, size: 24, threshold: 1.6 }, sky: "day", starCount: 0, sunSize: 20, moonSize: 0,
 water: { color: [77, 85, 67], reflectance: 0.15, transparency: 0, waveSize: 0.08, waveSpeed: 4 }, weather: "none",
};
export function m06Height(x: number, z: number): number {
 if (x >= 9600 && x <= 11200 && z >= -7000 && z <= -5400) return 36;
 if (math.abs(x + 6720) < 1400 && math.abs(z - 11520) < 2200) return 36;
 for (const b of M06.basins) if (math.abs(x - b.x) < 2800 && z < b.z - 1800 && z > b.z - 4300) return 36;
 if (z < -8500) return 48 + 4 * math.floor(64 * math.abs(math.sin(x / 3200) * math.cos(z / 3900)));
 if (z < -500 && math.abs(x) < 11200 && !M06.basins.some(b => math.abs(x - b.x) < 2000 && z > b.z - 1800)) return 36;
 return 32;
}
export const M06_SURFACE: WorldSurface = {
 height: m06Height, detail: (x, z) => M06.basins.some(b => math.abs(x - b.x) < 3000 && math.abs(z - b.z + 2000) < 1000) || math.abs(x + 6720) < 1600 && math.abs(z - 11520) < 2400,
 material: (x, z) => m06Height(x, z) === 32 ? "Water" : z < -8500 ? "Grass" : "Ground",
};
export const m06Ground = (x: number, z: number) => surfaceGround(M06_SURFACE, x, z);
export type M06TargetType = "destroyer" | "cruiser" | "submarine" | "missile_boat" | "supply_ship" | "landing_ship" | "container_ship" | "frigate" | "crane" | "gas_tank" | "fuel_tank" | "containers" | "storage" | "aa" | "sam" | "gun";
export interface M06Target { id: string; type: M06TargetType; group: string; x: number; y: number; z: number; yaw: number }
/** D-160: provisional finite scenery inventory, NOT a spawn/score roster. */
export function m06TargetLayout(): M06Target[] {
 const out: M06Target[] = [];
 const add = (targetType: M06TargetType, group: string, x: number, y: number, z: number, yaw = 0) => out.push({ id: `m06_${group}_${targetType}_${out.size() + 1}`, type: targetType, group, x, y, z, yaw });
 const hulls: M06TargetType[] = ["destroyer", "destroyer", "cruiser", "cruiser", "submarine", "missile_boat", "supply_ship", "landing_ship", "container_ship", "frigate", "frigate", "cruiser"];
 const shore: M06TargetType[] = ["crane", "containers", "fuel_tank", "gas_tank", "storage", "aa", "sam", "containers", "crane", "fuel_tank", "gas_tank", "storage", "aa", "sam", "containers", "storage"];
 for (const b of M06.basins) {
  for (let i = 0; i < 12; i++) add(hulls[i], b.group, i === 11 ? b.x * 0.35 : b.x - 650 + (i % 3) * 650, 32, i === 11 ? 3840 : b.z - 900 + math.floor(i / 3) * 900);
  const n = b.group === "central" ? 16 : 12;
  for (let i = 0; i < n; i++) add(shore[i], `${b.group}_yard`, b.x - 600 + (i % 4) * 400, 48, b.z - 3550 + math.floor(i / 4) * 500);
 }
 // Six deck mounts per basin. Keep off the uploaded superstructures by using
 // separate small military pontoon pads beside the hulls (not duplicate actors).
 for (const b of M06.basins) for (let i = 0; i < 6; i++) add(i % 3 === 0 ? "gun" : i % 3 === 1 ? "aa" : "sam", `${b.group}_defence`, b.x - 650 + (i % 3) * 650 + 180, 48, b.z - 900 + math.floor(i / 3) * 900);
 return out;
}
export function buildM06Plan(seed = 606, checkpoint: () => void = () => {}) {
 const terrain = compactSurface(M06_SURFACE, checkpoint), parts: PartSpec[] = [], props: PropSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, shape: PartSpec["shape"] = "block", material = "Concrete", color: [number, number, number] = [99, 103, 98]) => parts.push({ name, x, y, z, sx, sy, sz, shape, material, color, yaw: 0, solid: true, grounded: false });
 for (const b of M06.basins) {
  part("Military yard foundation", b.x, 40, b.z - 2800, 1800, 16, 2000);
  for (const dx of [-1200, 1200]) {
   // Quays are waterline props; no terrain or foundations intersect their feet.
   props.push({ asset: "HarbourQuay", x: b.x + dx, y: 32, z: b.z, yaw: math.pi / 2, scale: 1, tint: 0 });
   part("Projecting pier", b.x + dx, 40, b.z - 1000, 180, 16, 1600);
   for (const dz of [-1200, -600]) props.push({ asset: "GantryCrane", x: b.x + dx, y: 48, z: b.z + dz, yaw: 0, scale: 0.6, tint: 0 });
  }
 }
 for (const dz of [-720, 720]) part("Service runway", -6720, 40, 11520 + dz, 96, 16, 1440, "block", "Asphalt");
 part("Service apron", -7040, 40, 11520, 480, 16, 1600);
 for (const dz of [-400, 0, 400]) props.push({ asset: "Hangar", x: -7040, y: 48, z: 11520 + dz, yaw: math.pi / 2, scale: 0.6, tint: 0 });
 // Untargetable civilian district separated from the military yards.
 for (let i = 0; i < 12; i++) {
  const x = 9800 + (i % 4) * 280, z = -6500 + math.floor(i / 4) * 280, y = m06Ground(x, z);
  part("Civilian district foundation", x, y + 4, z, 160, 8, 160);
  part("Untargetable fish market / worker housing", x, y + 28, z, 110, 40, 100);
 }
 const targets = m06TargetLayout();
 for (const t of targets) {
  if (t.y === 32) continue; // Naval uploaded/fallback silhouettes are rendered by CompositionWorld.
  if (t.group === "west_defence" || t.group === "central_defence" || t.group === "east_defence") part("Defence pontoon", t.x, 40, t.z, 56, 16, 56);
  if (t.type === "containers" || t.type === "crane") props.push({ asset: t.type === "crane" ? "GantryCrane" : "ContainerStack", x: t.x, y: t.y, z: t.z, yaw: t.yaw, scale: 1, tint: 0, tag: t.id });
  else if (t.type === "gas_tank" || t.type === "fuel_tank") part(t.id, t.x, t.y + 30, t.z, 90, 60, 90, "cylinder", "Metal");
  else if (t.type === "storage") part(t.id, t.x, t.y + 24, t.z, 140, 48, 100);
  else { part(t.id, t.x, t.y + 5, t.z, 24, 10, 24); part(t.id, t.x, t.y + 14, t.z - 10, 12, 8, 36, "block", "Metal"); }
 }
 return { ...terrain, key: M06_WORLD_KEY, seed, parts, props, targets };
}
// Main lacks #158's estimator: M02/M03 calibration with the requested ×1.5 reserve.
export const m06Counts = (p: ReturnType<typeof buildM06Plan>) => { const c = worldCounts(p, 36 * 4); return { ...c, estimatedSeconds: c.estimatedSeconds * 1.5 }; };
