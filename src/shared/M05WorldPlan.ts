/** Loading only: retain native opaque water and amortize its expensive full-frame yields.
 * This permits up to 3 s of server work per resumption; Studio/device acceptance is still required. */
export const M05_TERRAIN_BUDGET = 3;
import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { sealedSurface, surfaceGround, type WorldSurface } from "./SealedWorldSurface";
import { worldCounts } from "./WorldCompositionCounts";
export const M05_WORLD_KEY = "m05_night_refinery";
export const M05 = {
 half: 16384, sea: 32, pavement: 48, deck: 120,
 refinery: { x: -8900, z: -7000, hx: 1056, hz: 1536 },
 rig: { x: 9600, z: -7500 }, base: { x: -1024, z: 6700 },
 start: { x: 0, y: 544, z: 5740, headingDegrees: 0 },
 returnLine: { x1: -14000, x2: 14000, z: 9400 },
 escape: { x: 2400, halfWidth: 1800, z1: -5000, z2: 12000 },
 runway: { x: -1024, z: 6700, y: 48, length: 2880, width: 96, headingDegrees: 0 },
};
export const M05_ENVIRONMENT: EnvironmentSpec = {
 label: "Clear pre-dawn 05:50", clock: 5 + 50 / 60, brightness: 0.65, exposure: -0.25,
 ambient: [27, 34, 47], outdoorAmbient: [40, 50, 68], diffuse: 0.3, specular: 0.55,
 atmosphere: { density: 0.16, offset: 0, haze: 0.6, glare: 0, color: [51, 62, 82], decay: [40, 50, 68] },
 clouds: { cover: 0.1, density: 0.1, color: [49, 59, 78] },
 grade: { saturation: -0.2, contrast: 0.1, brightness: 0, tint: [201, 218, 244] },
 bloom: { intensity: 0.2, size: 32, threshold: 1.5 }, sky: "night", starCount: 1400, sunSize: 0, moonSize: 11,
 water: { color: [17, 25, 32], reflectance: 0.35, transparency: 0, waveSize: 0.05, waveSpeed: 2 }, weather: "none",
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
/** Sea cells are opaque native water from Y=0 to 32 with no rock under it (D-121); m05Height's 8 stays the
 * nominal bed used for keel clearance, and the real clearance below every keel is 16 studs of water. */
export const M05_SURFACE: WorldSurface = { height: m05Height, detail: m05Detailed, material: (x, z) => m05Height(x, z) < 32 ? "Mud" : x < -11000 ? "LeafyGrass" : "Ground", waterColumns: true };
export const m05Ground = (x: number, z: number) => surfaceGround(M05_SURFACE, x, z);
export type M05TargetType = "crane" | "tower" | "control_room" | "sam" | "aa" | "fuel_tank_large" | "fuel_tank" | "gas_tank" | "refinery_unit" | "smokestack" | "pump_station" | "refinery_command" | "tanker" | "helicopter";
/** Observed points except SAM=50 (observed range 30–50) and pump=40 (unread).
 * refinery_command interprets the observed unidentified 100-point contact.
 */
export const M05_TARGET_POINTS: Record<M05TargetType, number> = {
 crane: 50, tower: 60, control_room: 60, sam: 50, aa: 20,
 fuel_tank_large: 50, fuel_tank: 40, gas_tank: 30, refinery_unit: 60,
 smokestack: 60, pump_station: 40, refinery_command: 100, tanker: 120, helicopter: 40,
};
export interface M05Target { id: string; type: M05TargetType; group: "rig" | "refinery" | "shipping" | "rig_air"; x: number; y: number; z: number; yaw: number }
/** A3: exactly 48 rig + 40 refinery ground contacts. Per-type counts and
 * individual coordinates are assumptions, not frame-readable evidence.
 * Rig contacts sit on decks; ships/platform waterline anchors remain at sea Y=32.
 */
export function m05TargetLayout(): M05Target[] {
 const out: M05Target[] = [];
 const add = (targetType: M05TargetType, group: M05Target["group"], x: number, y: number, z: number, yaw = 0) => out.push({ id: `m05_${group}_${targetType}_${out.size() + 1}`, type: targetType, group, x, y, z, yaw });
 const rigTypes: M05TargetType[] = ["crane", "tower", "control_room", "sam", "aa", "tower"];
 for (let col = 0; col < 8; col++) for (let row = 0; row < 6; row++) add(rigTypes[row], "rig", 8340 + col * 360, 120, -7740 + row * 96);
 const landTypes: M05TargetType[] = ["fuel_tank_large", "fuel_tank", "fuel_tank", "gas_tank", "refinery_unit", "pump_station", "control_room", "aa"];
 for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) add(row === 0 && col === 4 ? "smokestack" : row === 0 && col === 6 ? "refinery_command" : landTypes[col], "refinery", -9740 + col * 240, 48, -8200 + row * 600);
 add("tanker", "shipping", 1800, 32, 840, -0.15);
 add("tanker", "shipping", 8000, 32, -5600, math.pi / 2);
 for (let i = 0; i < 3; i++) add("helicopter", "rig_air", 8600 + i * 800, 240, -6600);
 return out;
}
export interface M05LightAnchor { id: string; kind: "point" | "searchlight" | "runway"; x: number; y: number; z: number; yaw: number }
/** Engine batch C owns actual lights/beams. No Instances or timing here. */
export function m05LightAnchors(): M05LightAnchor[] {
 const out: M05LightAnchor[] = [];
 const add = (kind: M05LightAnchor["kind"], x: number, y: number, z: number, yaw = 0) => out.push({ id: `m05_light_${out.size() + 1}`, kind, x, y, z, yaw });
 for (let x = -9800; x <= -8000; x += 120) for (let z = -8400; z <= -5600; z += 120) add("point", x, 60, z);
 for (let i = 0; i < 8; i++) { add("searchlight", -9900 + (i % 2) * 2000, 72, -8200 + math.floor(i / 2) * 800, i * math.pi / 4); add("point", 8340 + i * 360, 132, -7500); }
 for (let i = 0; i < 25; i++) for (const s of [-1, 1]) add("runway", -1024 + s * 52, 50, 5260 + i * 120);
 return out;
}
export function buildM05Plan(seed = 505, checkpoint: () => void = () => {}) {
 const terrain = sealedSurface(M05_SURFACE, checkpoint), parts: PartSpec[] = [], props: PropSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, shape: PartSpec["shape"] = "block", color: [number, number, number] = [72, 78, 80]) => parts.push({ name, x, y, z, sx, sy, sz, shape, color, material: "Metal", yaw: 0, solid: true, grounded: false });
 // Foundations rise 12 studs above the flat native terrain (D-056).
 for (const x of [-9428, -8372]) for (const z of [-7768, -6232]) part("Refinery foundation", x, 40, z, 1056, 16, 1536);
 for (const z of [5980, 7420]) part("Southern runway", -1024, 40, z, 96, 16, 1440);
 part("Base apron", -1250, 40, 6900, 480, 16, 1600);
 for (const z of [6300, 6700, 7100]) props.push({ asset: "Hangar", x: -1400, y: 48, z, yaw: math.pi / 2, scale: 0.6, tint: 0 });
 props.push({ asset: "ControlTower", x: -1300, y: 48, z: 7500, yaw: 0, scale: 0.5, tint: 0 });
 for (let i = 0; i < 8; i++) {
  const x = 8340 + i * 360;
  // Uploaded OilPlatform is a waterline-anchored central landmark.
  part("Rig working deck", x, 116, -7500, 280, 8, 600);
  for (const dx of [-100, 100]) for (const dz of [-260, 260]) part("Rig support leg", x + dx, 64, -7500 + dz, 8, 112, 8);
  if (i < 7) {
   part("Trestle walkway", x + 180, 116, -7500, 80, 8, 24);
   part("Trestle pipeline", x + 180, 124, -7484, 80, 6, 6);
   for (const dz of [-10, 10]) part("Trestle leg", x + 180, 64, -7500 + dz, 6, 112, 6);
  }
 }
 props.push({ asset: "OilPlatform", x: 9600, y: 32, z: -8150, yaw: 0, scale: 1, tint: 0 });
 // All target visuals have an exact id model wrapper in the builder. Parts use
 // id-prefixed names to group compound silhouettes without creating combat targets.
 for (const t of m05TargetLayout()) {
  if (t.type === "tanker" || t.type === "helicopter") continue;
  const y = t.y;
  if (t.type === "fuel_tank" || t.type === "fuel_tank_large" || t.type === "gas_tank") {
   const d = t.type === "fuel_tank_large" ? 136 : t.type === "fuel_tank" ? 100 : 64, h = t.type === "gas_tank" ? 40 : 72;
   part(t.id, t.x, y + h / 2, t.z, d, h, d, "cylinder", [142, 149, 151]);
  } else if (t.type === "smokestack" || t.type === "tower" || t.type === "refinery_unit") {
   const h = t.type === "smokestack" ? 360 : t.type === "tower" ? 120 : 96;
   part(t.id, t.x, y + h / 2, t.z, 28, h, 28, "cylinder");
   for (const dz of [-22, 22]) part(t.id, t.x + 24, y + 24, t.z + dz, 10, 48, 10);
  } else if (t.type === "crane") {
   part(t.id, t.x, y + 60, t.z, 10, 120, 10);
   part(t.id, t.x + 26, y + 116, t.z, 80, 8, 8);
   part(t.id, t.x + 60, y + 90, t.z, 2, 48, 2);
  } else if (t.type === "aa" || t.type === "sam") {
   part(t.id, t.x, y + 4, t.z, 24, 8, 24);
   part(t.id, t.x, y + 12, t.z - 8, 12, 8, 28);
  } else part(t.id, t.x, y + 16, t.z, 56, 32, 40);
 }
 return { ...terrain, key: M05_WORLD_KEY, seed, parts, props, targets: m05TargetLayout(), lightAnchors: m05LightAnchors() };
}
export const m05Counts = (p: ReturnType<typeof buildM05Plan>) => worldCounts(p, 5 * 4, M05_TERRAIN_BUDGET);
