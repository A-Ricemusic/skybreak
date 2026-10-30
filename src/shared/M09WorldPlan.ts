import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
import { UploadedAssetSpecs } from "./UploadedAssetSpecs";
export const M09_WORLD_KEY = "m09_frigate_landing";
export const M09 = {
 half: 16384, sea: 32, start: { x: 0, y: 126, z: 7680, headingDegrees: 0 },
 beaches: [{ group: "west", x: -7680, y: 40, z: 0 }, { group: "central", x: 0, y: 40, z: -960 }, { group: "east", x: 7680, y: 40, z: 0 }],
 gunBelt: { x: 0, y: 180, z: -2880 }, carrier: { x: 0, y: 32, z: 11520, yaw: 0 },
 attackEntry: { x: 11520, y: 700, z: -5760 }, town: { x: 3840, z: -6400 },
};
/** Exact uploaded carrier-2: deck is 54 above keel, waterline 20 above keel.
 * The sketch's Y=64 service anchor becomes Y=66; never lift hull to match sketch. */
export const M09_SERVICE = {
 deckY: M09.sea - UploadedAssetSpecs.Carrier.groundOffset + 54,
 approach: { x: -32, y: 170, z: 13000 }, touchdown: { x: -32, y: 66, z: 11640 },
 catapult: { x: 24.5155, y: 66, z: 11244 }, headingDegrees: 0,
};
export const M09_ENVIRONMENT: EnvironmentSpec = {
 ...M06_ENVIRONMENT, label: "Overcast landing 17:00", clock: 17, brightness: 1.2, exposure: -0.2,
 ambient: [78, 90, 85], outdoorAmbient: [108, 119, 113],
 atmosphere: { density: 0.42, offset: 0.05, haze: 3.2, glare: 0, color: [145, 159, 151], decay: [70, 86, 82] },
 clouds: { cover: 0.95, density: 0.85, color: [133, 145, 138] },
 grade: { saturation: -0.35, contrast: 0.08, brightness: -0.02, tint: [220, 235, 225] },
 water: { color: [43, 62, 60], reflectance: 0.12, transparency: 0, waveSize: 0.15, waveSpeed: 6 },
};
export function m09Height(x: number, z: number): number {
 for (const b of M09.beaches) {
  if (math.abs(x - b.x) < 1700 && z > b.z - 2100 && z < b.z + 650) return z > b.z - 256 ? 40 : 168;
 }
 if (math.abs(x - 3840) < 1100 && math.abs(z + 6400) < 1100) return 240;
 if (z > 1000) return 32;
 if (z > -1400) return 40 + 4 * math.floor(90 * math.abs(math.sin((x + 1400) / 2600)));
 return 180 + 4 * math.floor(96 * math.abs(math.sin(x / 2400) * math.cos(z / 3500)));
}
export const M09_SURFACE: WorldSurface = {
 height: m09Height,
 nativeWater: (x, z) => math.abs(x) < 1200 && math.abs(z - 11520) < 2100 || M09.beaches.some(b => math.abs(x - b.x) < 1400 && z > 1500 && z < 3500),
 detail: (x, z) => M09.beaches.some(b => math.abs(x - b.x) < 1800 && math.abs(z - b.z) < 1800),
 material: (x, z) => m09Height(x, z) === 32 ? "Water" : m09Height(x, z) === 40 ? "Sand" : m09Height(x, z) < 240 ? "Ground" : "LeafyGrass",
};
export const m09Ground = (x: number, z: number) => surfaceGround(M09_SURFACE, x, z);
export type M09TargetType = "radar" | "battery" | "pillbox" | "tank" | "launcher" | "howitzer" | "aa" | "sam";
export interface M09Target { id: string; type: M09TargetType; group: string; x: number; y: number; z: number; yaw: number }
/** D-171: 55 credited contacts reconstruction, NOT the complete 83-ground roster. */
export function m09TargetLayout(): M09Target[] {
 const types: M09TargetType[] = [];
 for (const [kind, count] of [["radar", 9], ["battery", 6], ["pillbox", 16], ["tank", 7], ["launcher", 5], ["howitzer", 3], ["aa", 7], ["sam", 2]] as Array<[M09TargetType, number]>) for (let i = 0; i < count; i++) types.push(kind);
 return types.map((kind, i) => {
  const b = M09.beaches[i % 3], slot = math.floor(i / 3), x = b.x - 1000 + slot % 5 * 500, z = b.z - 600 - math.floor(slot / 5) * 280;
  return { id: `m09_${b.group}_${kind}_${i + 1}`, type: kind, group: b.group, x, y: 180, z, yaw: 0 };
 });
}
export function buildM09Plan(seed = 909, checkpoint: () => void = () => {}) {
 const terrain = compactSurface(M09_SURFACE, checkpoint), parts: PartSpec[] = [...terrain.seaParts], props: PropSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material = "Concrete", color: [number, number, number] = [100, 110, 100]) => parts.push({ name, x, y, z, sx, sy, sz, material, color, shape: "block", yaw: 0, solid: true, grounded: false });
 for (const b of M09.beaches) {
  for (const dx of [-600, 600]) part("Gun belt foundation", b.x + dx, 168, b.z - 1050, 1200, 24, 1300);
  // Open 2400 x 600 landing beach at each exact sketch anchor; guns are behind it.
  for (const dx of [-800, 800]) props.push({ asset: "Frigate", x: b.x + dx, y: 32, z: 2400, yaw: 0, scale: 1, tint: 0 });
  for (let i = 0; i < 2; i++) {
   part("Friendly landing craft hull", b.x - 180 + i * 360, 30, 1800, 70, 16, 180, "Metal");
   part("Friendly landing craft well", b.x - 180 + i * 360, 40, 1800, 52, 4, 140, "Metal");
  }
 }
 for (const t of m09TargetLayout()) {
  if (t.type === "radar") {
   part(t.id, t.x, 200, t.z, 16, 40, 16, "Metal"); part(t.id, t.x, 224, t.z, 60, 8, 36, "Metal");
  } else if (t.type === "pillbox") {
   part(t.id, t.x, 194, t.z, 100, 28, 80); part(t.id, t.x, 206, t.z - 20, 70, 4, 4, "Metal", [35, 41, 37]);
  } else {
   part(t.id, t.x, 188, t.z, 48, 16, 64, "Metal"); part(t.id, t.x, 202, t.z - 24, 12, 12, t.type === "battery" ? 100 : 56, "Metal");
  }
 }
 props.push({ asset: "Carrier", ...M09.carrier, scale: 1, tint: 0 });
 for (let i = 0; i < 12; i++) {
  const x = 3200 + i % 4 * 400, z = -7000 + math.floor(i / 4) * 400;
  part("Town foundation", x, 240, z, 240, 24, 240);
  props.push({ asset: "Farmhouse", x, y: 252, z, yaw: 0, scale: 2, tint: 0 });
 }
 for (let i = 0; i < 18; i++) {
  const x = -10752 + i * 1024, z = -4608;
  props.push({ asset: "Pine", x, y: m09Ground(x, z), z, yaw: 0, scale: 1.5, tint: 0 });
 }
 for (const p of parts) if (p.name === "Sea") p.color = [43, 62, 60];
 return { ...terrain, key: M09_WORLD_KEY, seed, parts, props, targets: m09TargetLayout() };
}
export const m09Counts = (p: ReturnType<typeof buildM09Plan>) => compactWorldCounts(p, 0);
