import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM03Plan, M03 } from "../shared/M03WorldPlan";
import { buildM04Plan, M04, m04TargetLayout } from "../shared/M04WorldPlan";
import { buildM05Plan, M05 } from "../shared/M05WorldPlan";
import { m03Ground as rawM03, baselineM04 as rawM04, baselineM05 as rawM05 } from "./M03M05Baseline";
import { M03_LANDING, M03_START_ALTITUDE, M03_RETURN_LINE } from "../shared/missions/m03";
import { M05_REARM_LANDING } from "../shared/missions/m05";
import { landingPose, landingDuration } from "../shared/EngineBatchB";
import type { TerrainOp, PartSpec } from "../shared/WorldPlan";

// Index actual emitted caps, curtains and flight-solid Sea parts. Ground lookup
// alone would miss the reviewer's four-stud rock curtain across the gorge.
function collisionTop(ops: TerrainOp[], sea: PartSpec[]) {
 const bins = new Map<string, TerrainOp[]>();
 for (const q of [...ops, ...sea.filter(p => p.name === "Sea")]) {
  if (q.shape !== "block") continue;
  for (let x = math.floor((q.x - q.sx / 2) / 128); x <= math.floor((q.x + q.sx / 2) / 128); x++)
   for (let z = math.floor((q.z - q.sz / 2) / 128); z <= math.floor((q.z + q.sz / 2) / 128); z++) {
    const k = `${x},${z}`, list = bins.get(k) ?? []; list.push(q as TerrainOp); bins.set(k, list);
   }
 }
 return (x: number, z: number) => {
  let top = 0;
  for (const q of bins.get(`${math.floor(x / 128)},${math.floor(z / 128)}`) ?? [])
   if (math.abs(x - q.x) <= q.sx / 2 && math.abs(z - q.z) <= q.sz / 2) top = math.max(top, q.y + q.sy / 2);
  return top;
 };
}
type Height = (x: number, z: number) => number;
// Baseline grids are aligned to 64 studs; memoize columns, never path samples.
function cachedBaseline(h: Height): Height {
 const cache = new Map<string, number>();
 return (x, z) => {
  const gx = math.floor(x / 64), gz = math.floor(z / 64), key = `${gx},${gz}`;
  const old = cache.get(key); if (old !== undefined) return old;
  const top = h(gx * 64 + 32, gz * 64 + 32); cache.set(key, top); return top;
 };
}
const baselineM03 = cachedBaseline(rawM03), baselineM04 = cachedBaseline(rawM04), baselineM05 = cachedBaseline(rawM05);
function baselineAt(h: Height, x: number, z: number) {
 // Closed cap faces on exact grid boundaries belong to both adjacent columns.
 return math.max(h(x, z), h(x - 0.001, z), h(x, z - 0.001), h(x - 0.001, z - 0.001));
}
function checkPoint(top: Height, baseline: Height, x: number, z: number, altitude: number) {
 const old = baselineAt(baseline, x, z), current = top(x, z);
 if (current > old + 0.01 || altitude - current < altitude - old - 0.01)
  error(`Clearance regression at (${x}, ${z}), altitude=${altitude}: old=${old}, emitted=${current}`);
}
function corridor(top: Height, baseline: Height, points: number[][], halfWidth: number, altitude: number) {
 let count = 0;
 for (let i = 1; i < points.size(); i++) {
  const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1], len = math.sqrt(dx * dx + dz * dz);
  const steps = math.ceil(len / 4), offsets = [0, halfWidth];
  for (let offset = -halfWidth; offset < halfWidth; offset += 32) offsets.push(offset);
  // Dense 4-stud longitudinal samples, both reservation edges and 32-stud lateral strips.
  for (let j = 0; j <= steps; j++) for (const offset of offsets) {
   const x = a[0] + dx * j / steps - dz / len * offset, z = a[1] + dz * j / steps + dx / len * offset;
   checkPoint(top, baseline, x, z, altitude); count++;
  }
 }
 expect(count).toBeGreaterThan(0);
}

describe("pre-PR authored corridor collision clearance", () => {
 it("never raises M03 route, gorge legs, return line or landing lane above baseline", () => {
  const p = buildM03Plan(), top = collisionTop(p.ops, p.parts);
  corridor(top, baselineM03, M03.route, 640, M03_START_ALTITUDE);
  corridor(top, baselineM03, M03.gorge, 768, 128);
  corridor(top, baselineM03, [[M03.returnLine.x1, M03.returnLine.z], [M03.returnLine.x2, M03.returnLine.z]], 640, M03_RETURN_LINE.markerY);
  corridor(top, baselineM03, [[6000, 9600], [6000, 14976]], 512, 100);
  expect(baselineM03(-5238, -4993.6)).toBe(80);
  expect(top(-5238, -4993.6)).toBeLessThanOrEqual(80);
  expect(128 - top(-5238, -4993.6)).toBeGreaterThanOrEqual(48);
  for (let t = 0; t <= landingDuration(M03_LANDING); t += 0.025) {
   const q = landingPose(M03_LANDING, t); checkPoint(top, baselineM03, q.x, q.z, q.y);
  }
 });
 it("preserves M04 courier/jammer route, river valley and authored dirt-track path", () => {
  const p = buildM04Plan(), top = collisionTop(p.ops, p.parts);
  corridor(top, baselineM04, M04.route, 320, 1202);
  corridor(top, baselineM04, M04.river, 320, 1202);
  for (const t of m04TargetLayout()) if (t.type === "jammer")
   corridor(top, baselineM04, [[t.x, t.z], ...M04.route.filter((_, i) => i > 0)], 320, t.y);
  const track: number[][] = [];
  for (let z = -14000; z <= 13280; z += 32) track.push([-1800 + 2400 * math.sin(z / 4200), z]);
  corridor(top, baselineM04, track, 32, 1202);
 });
 it("preserves M05 escape strip, return line, runway approach and helicopter routes", () => {
  const p = buildM05Plan(), top = collisionTop(p.ops, p.parts);
  corridor(top, baselineM05, [[M05.escape.x, M05.escape.z1], [M05.escape.x, M05.escape.z2]], M05.escape.halfWidth, 544);
  corridor(top, baselineM05, [[M05.returnLine.x1, M05.returnLine.z], [M05.returnLine.x2, M05.returnLine.z]], 640, 600);
  corridor(top, baselineM05, [[-1024, 4660], [-1024, 10200]], 96, 54);
  corridor(top, baselineM05, [[8600, -6600], [11300, -6600], [11300, -8400], [7900, -8400], [7900, -6600]], 96, 260);
  for (let t = 0; t <= landingDuration(M05_REARM_LANDING); t += 0.025) {
   const q = landingPose(M05_REARM_LANDING, t); checkPoint(top, baselineM05, q.x, q.z, q.y);
  }
 });
});
