import type { EnvironmentSpec } from "./EnvironmentPresets";
import type { PartSpec, PropSpec } from "./WorldPlan";
import { compactSurface, surfaceGround, type WorldSurface } from "./CompactWorldSurface";
import { compactWorldCounts } from "./M06M07WorldCounts";
import { M06_ENVIRONMENT } from "./M06WorldPlan";
export const M11_WORLD_KEY = "m11_high_crossing";
export const M11 = { half: 16384, start: { x: 0, y: 735, z: 9600, headingDegrees: 315 }, durationSeconds: 330, cloudBand: { bottom: 1600, top: 2200 }, lowBand: 900, highBand: 2800 };
export const M11_ENVIRONMENT: EnvironmentSpec = {
 ...M06_ENVIRONMENT, label: "Bright snowy overcast 15:31", clock: 15 + 31 / 60, sky: "overcast", brightness: 1.8, sunSize: 0,
 ambient: [145, 146, 144], outdoorAmbient: [170, 172, 170],
 atmosphere: { density: 0.34, offset: 0.15, haze: 2.2, glare: 0.1, color: [224, 224, 209], decay: [153, 158, 165] },
 clouds: { cover: 0.95, density: 0.3, color: [218, 220, 214] },
 grade: { saturation: -0.22, contrast: 0.06, brightness: 0, tint: [252, 251, 238] },
};
export interface M11Point { x: number; y: number; z: number }
/** Smooth northbound civilian tracks, preserving all sketch anchors; no 2000-stud clipping. */
export function m11RoutePoint(high: boolean, t: number): M11Point {
 const z = 6240 - 17760 * t, startX = high ? 2880 : -1440, midX = high ? 1920 : -1920;
 const split = 6240 / 17760, first = t <= split, u = first ? t / split : (t - split) / (1 - split);
 const blend = (1 - math.cos(math.pi * u)) / 2;
 return { x: first ? startX + (midX - startX) * blend : midX * (1 - blend), y: high ? 2800 : 900, z };
}
export function m11Routes() {
 return [false, true].map(high => ({ id: high ? "m11_civilian_high" : "m11_civilian_low", durationSeconds: 313.28, points: new Array<M11Point>() } )).map((r, i) => {
  for (let j = 0; j <= 64; j++) r.points.push(m11RoutePoint(i === 1, j / 64));
  return r;
 });
}
export function m11Height(x: number, z: number): number {
 const low = m11RoutePoint(false, math.clamp((6240 - z) / 17760, 0, 1));
 if (math.abs(x - low.x) < 1000 || math.abs(x) < 1500 && z > 7500) return 480;
 return 520 + 4 * math.floor(57 * math.abs(math.sin(x / 2100) * math.cos(z / 2900)));
}
export const M11_SURFACE: WorldSurface = { height: m11Height, detail: () => false, material: (x, z) => m11Height(x, z) >= 640 ? "Snow" : "Rock" };
export const m11Ground = (x: number, z: number) => surfaceGround(M11_SURFACE, x, z);
export function m11CivilianLayout() {
 return m11Routes().map(r => ({ id: r.id, type: "civilian", group: "protected", ...r.points[0], yaw: 0 }));
}
export function buildM11Plan(seed = 1111, checkpoint: (phase?: string) => void = () => {}) {
 const terrain = compactSurface(M11_SURFACE, checkpoint), parts: PartSpec[] = [], props: PropSpec[] = [], targets = m11CivilianLayout();
 // Original primitive passenger silhouettes for dormant review; future actor integration adopts ids.
 for (const t of targets) for (const [sx, sy, sz, dy, dz] of [[8, 8, 50, 0, 0], [48, 2, 12, 0, 2], [20, 2, 8, 2, 20], [2, 10, 8, 5, 20]]) parts.push({ name: t.id, x: t.x, y: t.y + dy, z: t.z + dz, sx, sy, sz, yaw: 0, material: "SmoothPlastic", color: [226, 235, 240], shape: "block", solid: true, grounded: false });
 return { ...terrain, key: M11_WORLD_KEY, seed, parts, props, targets, routes: m11Routes() };
}
export const m11Counts = (p: ReturnType<typeof buildM11Plan>) => compactWorldCounts(p, 0);
