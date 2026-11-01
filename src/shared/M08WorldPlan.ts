import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, surfaceSide, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
export const M08_WORLD_KEY = "m08_island_broadcast";
export const M08 = {
 half: 16384, sea: 32,
 start: { x: 7680, y: 851, z: 7680, headingDegrees: 315 },
 transmitter: { x: 1920, y: 90, z: 0 }, battle: { x: 0, y: 1000, z: -960 },
 bomberEntry: { x: -13440, y: 1200, z: -960 }, bomberMidpoint: { x: -5760, y: 1200, z: -960 },
 protectedAirspace: { x: 1920, y: 1200, z: 0 },
};
export const M08_ENVIRONMENT: EnvironmentSpec = {
 ...M06_ENVIRONMENT, label: "Tropical broadcast daylight 13:35", clock: 13 + 35 / 60, brightness: 2.6,
 ambient: [116, 139, 152], outdoorAmbient: [150, 164, 160],
 atmosphere: { density: 0.3, offset: 0.1, haze: 2.2, glare: 0.4, color: [174, 205, 224], decay: [94, 130, 161] },
 clouds: { cover: 0.35, density: 0.25, color: [245, 248, 249] },
 grade: { saturation: 0.02, contrast: 0.06, brightness: 0, tint: [255, 253, 243] },
 water: { color: [28, 68, 106], reflectance: 0.25, transparency: 0, waveSize: 0.1, waveSpeed: 5 },
};
function m08Height(x: number, z: number): number {
 // Whole complex, roads and their full sampled cells sit on a level shelf.
 if (math.abs(x - 1920) < 1700 && math.abs(z) < 1300) return 76;
 const r = math.sqrt(((x - 1920) / 5900) ** 2 + (z / 4300) ** 2);
 const islet = math.sqrt(((x + 6500) / 1900) ** 2 + ((z + 5500) / 1500) ** 2);
 if (r > 1 && islet > 1) return 32;
 if (r > 0.83 && islet > 0.8) return 40;
 return 56 + 4 * math.floor(38 * math.abs(math.sin(x / 1800) * math.cos(z / 1700)));
}
export const M08_SURFACE: WorldSurface = {
 height: m08Height, nativeWater: () => false,
 detail: (x, z) => math.abs(x - 1920) < 2300 && math.abs(z) < 1700,
 material: (x, z) => m08Height(x, z) === 32 ? "Water" : m08Height(x, z) <= 40 ? "Sand" : "LeafyGrass",
};
export const m08Ground = (x: number, z: number) => surfaceGround(M08_SURFACE, x, z);
/** GRND 000: these are broadcast scenery anchors, never combat actors. */
export function m08TargetLayout() {
 return [
  { id: "m08_broadcast_mast", type: "mast", group: "broadcast", x: 1920, y: 90, z: 0, yaw: 0 },
  { id: "m08_broadcast_control", type: "control", group: "broadcast", x: 1440, y: 90, z: 0, yaw: 0 },
  { id: "m08_broadcast_power", type: "power", group: "broadcast", x: 2400, y: 90, z: 0, yaw: 0 },
 ];
}
export function buildM08Plan(seed = 808, checkpoint: (phase?: string) => void = () => {}) {
 const terrain = compactSurface(M08_SURFACE, checkpoint), parts: PartSpec[] = [...terrain.seaParts], props: PropSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material = "Concrete", color: [number, number, number] = [165, 169, 156]) => parts.push({ name, x, y, z, sx, sy, sz, material, color, shape: "block", yaw: 0, solid: true, grounded: false });
 part("Broadcast foundation", 1920, 78, 0, 1600, 24, 1000);
 for (const t of m08TargetLayout()) {
  if (t.type === "mast") {
   props.push({ asset: "RelayMast", x: t.x, y: t.y, z: t.z, yaw: 0, scale: 2, tint: 0, tag: t.id });
   for (const dx of [-120, 120]) part(t.id, t.x + dx, 170, 0, 12, 160, 12, "Metal");
  } else { part(t.id, t.x, 114, 0, 200, 48, 160); part(t.id, t.x, 140, 0, 212, 4, 172, "Metal"); }
 }
 for (const z of [-800, 800]) part("Coastal road foundation", 1920, 76, z, 2048, 16, 64, "Asphalt", [62, 69, 65]);
 // Deterministic vegetation kept off facilities/roads. Uploaded original trees.
 for (let i = 0; i < 24; i++) {
  const angle = i * math.pi / 12, rawX = 1920 + 3100 * math.cos(angle), rawZ = 2400 * math.sin(angle);
  const side = surfaceSide(M08_SURFACE, rawX, rawZ), x = math.floor(rawX / side) * side + side / 2, z = math.floor(rawZ / side) * side + side / 2;
  props.push({ asset: "Broadleaf", x, y: m08Ground(x, z), z, yaw: angle, scale: 2, tint: 0 });
 }
 for (const p of parts) if (p.name === "Sea") p.color = [28, 68, 106];
 return { ...terrain, key: M08_WORLD_KEY, seed, parts, props, targets: m08TargetLayout() };
}
export const m08Counts = (p: ReturnType<typeof buildM08Plan>) => compactWorldCounts(p, 0);
