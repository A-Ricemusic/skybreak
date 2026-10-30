import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
export const M10_WORLD_KEY = "m10_river_line";
export const M10 = {
 half: 16384, sea: 32, start: { x: 0, y: 617, z: 12480, headingDegrees: 45 },
 districts: [{ group: "A", x: 3840, z: 6720 }, { group: "B", x: -3360, z: 960 }, { group: "C", x: 3360, z: -4800 }, { group: "D", x: -4800, z: -9600 }],
 service: { x: -9600, y: 80, z: 12000, width: 128, length: 2304, approachLength: 3200 },
 scoreGoal: 3000, durationSeconds: 1200, briefing: { air: 26, ground: 100, naval: 24, total: 150 },
};
export const M10_ENVIRONMENT: EnvironmentSpec = {
 ...M06_ENVIRONMENT, label: "Clear river daylight 14:15", clock: 14.25, brightness: 2.5, sky: "day",
 atmosphere: { density: 0.23, offset: 0.05, haze: 1.2, glare: 0.25, color: [194, 215, 232], decay: [115, 139, 157] },
 clouds: { cover: 0.18, density: 0.18, color: [240, 244, 248] },
 water: { color: [95, 82, 57], reflectance: 0.08, transparency: 0, waveSize: 0.06, waveSpeed: 3 },
};
/** Authored centreline; the sampled water footprint below also covers each row's sweep. */
export function m10RiverX(z: number): number {
 const ds = M10.districts;
 for (let i = 0; i < ds.size() - 1; i++) {
  const a = ds[i], b = ds[i + 1];
  if (z <= a.z && z >= b.z) return a.x - 1800 + (b.x - a.x) * math.clamp((a.z - z - 1800) / (a.z - b.z - 3600), 0, 1);
 }
 return (z > ds[0].z ? ds[0] : ds[3]).x - 1800;
}
function wet(x: number, z: number): boolean {
 // Cover the entire centreline sweep across a 256-stud terrain row, not just
 // its midpoint. Even the steep C→D bend then shares water faces with the
 // next row; 480-stud margins also absorb the cell's 128-stud X rounding.
 const rowZ = math.floor(z / 256) * 256;
 const a = m10RiverX(rowZ), b = m10RiverX(rowZ + 256);
 return x > math.min(a, b) - 480 && x < math.max(a, b) + 480 || M10.districts.some(b => math.abs(x - (b.x - 1800)) < 800 && math.abs(z - b.z) < 1800);
}
export function m10Height(x: number, z: number): number {
 if (math.abs(x + 9600) < 900 && math.abs(z - 12000) < 5000) return 64;
 if (math.abs(x - 2940) < 500 && math.abs(z - 6720) < 4600) return 64;
 if (wet(x, z)) return 32;
 for (const b of M10.districts) if (math.abs(x - b.x) < 1200 && math.abs(z - b.z) < 1700) return b.group === "C" || b.group === "D" ? 32 : 64;
 // Lower ingress/escape pocket; high, abrupt rock/forest ranges elsewhere.
 if (math.abs(x) < 2400 && z > 10240) return 180;
 // Keep distant ridge relief on its 3072-stud sampling lattice even where
 // the nearby river forces finer cells. Avoid paying for incidental fine
 // ridge curtains to fund continuous native water without losing ship detail.
 const ridgeX = math.floor(x / 3072) * 3072 + 1536, ridgeZ = math.floor(z / 3072) * 3072 + 1536;
 return 256 + 128 * math.floor(3 * math.abs(math.sin(ridgeX / 1800) * math.cos(ridgeZ / 2300)));
}
export const M10_SURFACE: WorldSurface = {
 height: m10Height, nativeWater: () => true,
 detail: (x, z) => wet(x, z) || M10.districts.some(b => math.abs(x - b.x) < 1000 && math.abs(z - b.z) < 1500) || math.abs(x + 9600) < 1000 && math.abs(z - 12000) < 5000,
 material: (x, z) => wet(x, z) && m10Height(x, z) === 32 ? "Water" : m10Height(x, z) < 100 ? "Ground" : m10Height(x, z) > 400 ? "Rock" : "LeafyGrass",
};
export const m10Ground = (x: number, z: number) => surfaceGround(M10_SURFACE, x, z);
export interface M10Target { id: string; type: string; group: string; x: number; y: number; z: number; yaw: number; domain: "ground" | "naval" }
/** Per-type split is authored capacity, not a recovered reference roster (D-180). */
export function m10TargetLayout(): M10Target[] {
 const targets: M10Target[] = [];
 const kinds = ["container", "barracks", "tank", "aa", "sam", "antenna", "watchtower", "flak", "fuel", "radar"];
 for (const b of M10.districts) {
  for (let i = 0; i < 25; i++) {
   const kind = kinds[i % kinds.size()], x = b.x - 600 + i % 5 * 300, z = b.z - 600 + math.floor(i / 5) * 300;
   targets.push({ id: `m10_${b.group}_${kind}_${i + 1}`, type: kind, group: b.group, x, y: b.group === "C" || b.group === "D" ? 48 : 80, z, yaw: 0, domain: "ground" });
  }
  for (let i = 0; i < 6; i++) {
   const kind = i < 2 ? "frigate" : i < 4 ? "tanker" : b.group === "D" ? "river_submarine" : "gunboat";
   targets.push({ id: `m10_${b.group}_${kind}_${i + 1}`, type: kind, group: b.group, x: b.x - 1800 + (i % 2 === 0 ? -220 : 220), y: 32, z: b.z - 600 + math.floor(i / 2) * 600, yaw: 0, domain: "naval" });
  }
 }
 return targets;
}
export function buildM10Plan(seed = 1010, checkpoint: () => void = () => {}) {
 const terrain = compactSurface(M10_SURFACE, checkpoint), parts: PartSpec[] = [...terrain.seaParts], props: PropSpec[] = [];
 const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material = "Concrete", color: [number, number, number] = [104, 110, 96]) => parts.push({ name, x, y, z, sx, sy, sz, material, color, yaw: 0, shape: "block", solid: true, grounded: false });
 const targets = m10TargetLayout();
 for (const t of targets) {
  if (t.domain === "ground") {
   part(`${t.id}_foundation`, t.x, t.y - 12, t.z, 160, 24, 160);
   const tall = t.type === "antenna" || t.type === "watchtower" || t.type === "radar";
   part(t.id, t.x, t.y + (tall ? 30 : 10), t.z, tall ? 16 : 60, tall ? 60 : 20, tall ? 16 : 80, "Metal");
   part(t.id, t.x, t.y + (tall ? 62 : 24), t.z, tall ? 48 : 24, 8, tall ? 32 : 40, "Metal");
  } else if (t.type === "gunboat" || t.type === "river_submarine") {
   part(t.id, t.x, 30, t.z, 40, 16, 140, "Metal", [47, 57, 54]);
   part(t.id, t.x, 44, t.z, 24, 12, 40, "Metal");
  }
 }
 // Runways split into bounded sections; the central district target grid is east of A's strip.
 for (const [x, z, length, width] of [[-9600, 12000, 2304, 128], [2940, 6720, 1920, 58]]) {
  for (let i = 0; i < 2; i++) part("m10_runway_foundation", x, 66, z + (i === 0 ? -1 : 1) * length / 4, width + 200, 24, length / 2, "Concrete");
  for (let i = 0; i < 2; i++) part("m10_runway", x, 79, z + (i === 0 ? -1 : 1) * length / 4, width, 2, length / 2, "Asphalt", [48, 52, 49]);
 }
 // Recessed water-level pen: two pillars + roof, 120-wide, 80-high clear mouth and 180 depth.
 for (const z of [-10950, -8250]) {
  for (const x of [-6850, -6690]) part("m10_pen_pillar", x, 72, z, 40, 80, 180, "Rock");
  part("m10_pen_roof", -6770, 120, z, 200, 16, 180, "Rock");
 }
 for (const b of M10.districts) {
  const x = b.x + 850, z = b.z + 1000, y = b.group === "C" || b.group === "D" ? 48 : 80;
  part("m10_landmark_foundation", x, y - 12, z, 180, 24, 240);
  props.push({ asset: b.group === "A" ? "ControlTower" : b.group === "B" ? "Hangar" : "GantryCrane", x, y, z, scale: 1, yaw: 0, tint: 0 });
 }
 for (let i = 0; i < 12; i++) {
  const x = -12000 + i * 1536, z = -14000;
  props.push({ asset: "Pine", x, y: m10Ground(x, z), z, scale: 1, yaw: 0, tint: 0 });
 }
 return { ...terrain, key: M10_WORLD_KEY, seed, parts, props, targets };
}
export function m10Counts(p: ReturnType<typeof buildM10Plan>) {
 const c = compactWorldCounts(p, 16 * 4);
 return { ...c, descendants: c.descendants + 16 * 24 };
}
