import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM06Plan, m06Counts, m06Ground, M06, M06_ENVIRONMENT } from "../shared/M06WorldPlan";
import { buildM07Plan, m07Counts, m07Ground, M07, M07_CANYON, M07_ENVIRONMENT } from "../shared/M07WorldPlan";
import { M06_BUILD_LIMITS, M06_AIRSPACE } from "../shared/M06Limits";
import { M07_BUILD_LIMITS, M07_AIRSPACE } from "../shared/M07Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { chunkTouches, compactWorldCounts } from "../shared/M06M07WorldCounts";
import type { TerrainOp } from "../shared/WorldPlan";

describe("Dormant M06/M07 worlds", () => {
 const a = buildM06Plan(), b = buildM07Plan();
 it("counts scheduled chunk touches and charges water and full yield frames", () => {
  const op: TerrainOp = { shape: "block", material: "Rock", x: 64, y: 4, z: 64, sx: 128, sy: 8, sz: 128, yaw: 0 };
  expect(chunkTouches(op)).toBe(1);
  expect(chunkTouches({ ...op, x: 0 })).toBe(2);
  const land = compactWorldCounts({ ops: [op], parts: [], props: [] }, 0);
  const water = compactWorldCounts({ ops: [{ ...op, material: "Water" }], parts: [], props: [] }, 0);
  expect(land.yields).toBe(1); expect(water.yields).toBe(1);
  expect(math.abs(land.estimatedSeconds - 3.20007)).toBeLessThan(1e-6);
  expect(math.abs(water.estimatedSeconds - 3.6502)).toBeLessThan(1e-6);
  // Main's WorldCompositionCounts (#158) now charges water too, so the legacy figures legitimately differ.
  expect(water.legacyEstimatedSeconds).toBeGreaterThan(land.legacyEstimatedSeconds);
 });
 it("is deterministic, checkpointed, selected only by missions 6 and 7", () => {
  let checkpoints = 0;
  expect(buildM06Plan(606, () => { checkpoints++; })).toEqual(a);
  expect(buildM07Plan()).toEqual(b); expect(checkpoints).toBeGreaterThan(1000);
  for (const mission of MissionCatalog.All()) { if (mission.id !== 6) expect(MissionCatalog.WorldKey(mission.id)).never.toBe(a.key); if (mission.id !== 7) expect(MissionCatalog.WorldKey(mission.id)).never.toBe(b.key); }
  expect(MissionCatalog.WorldKey(6)).toBe(a.key); expect(MissionCatalog.WorldKey(7)).toBe(b.key);
 });
 it("exports unique ids, provisional counts and the exact sketch anchors", () => {
  for (const [plan, prefix] of [[a, "m06_"], [b, "m07_"]] as const) {
   expect(new Set(plan.targets.map(t => t.id)).size()).toBe(plan.targets.size());
   for (const t of plan.targets) expect(t.id.sub(1, 4)).toBe(prefix);
  }
  expect(a.targets.filter(t => t.y === 32).size()).toBe(36);
  expect(a.targets.filter(t => t.group === "west_yard").size()).toBe(12);
  expect(a.targets.filter(t => t.group === "central_yard").size()).toBe(16);
  expect(a.targets.filter(t => t.group === "east_yard").size()).toBe(12);
  expect(a.targets.filter(t => t.y === 48).size()).toBe(58);
  expect(b.targets.size()).toBe(52); expect(b.targets.filter(t => t.type === "solar_panel").size()).toBe(41);
  for (const targetType of ["radar", "control_room", "solar_tower"]) expect(b.targets.filter(t => t.type === targetType).size()).toBe(1);
  for (const targetType of ["flak", "sam", "aa", "pillbox"]) expect(b.targets.filter(t => t.type === targetType).size()).toBe(2);
  expect(M06.start).toEqual({ x: 0, y: 385, z: 9600, headingDegrees: 0 });
  expect(M06.basins.map(t => [t.x, t.z])).toEqual([[-6720, -2880], [0, -3840], [6720, -3840]]);
  expect(M06.runway).toEqual({ x: -6720, y: 48, z: 11520, width: 96, length: 2880, headingDegrees: 0 });
  expect(M07.start).toEqual({ x: 0, y: 968, z: 15360, headingDegrees: 0 });
  expect([M07.south, M07.middle, M07.plant, M07.escape]).toEqual([{ x: 0, y: 160, z: 6720 }, { x: 960, y: 190, z: 0 }, { x: 0, y: 230, z: -8640 }, { x: 0, y: 32, z: 11520 }]);
 });
 it("supports nonoverlapping target footprints and keeps all pavement above grass", () => {
  for (const [p, ground] of [[a, m06Ground], [b, m07Ground]] as const) {
   for (const t of p.targets) {
    const marine = t.y === 32, defence = t.group.find("_defence")[0] !== undefined, hx = defence ? 12 : marine ? 40 : t.type === "crane" ? 30 : 80, hz = defence ? 18 : marine ? 220 : t.type === "crane" ? 100 : 60;
    for (const dx of [-hx, hx]) for (const dz of [-hz, hz]) {
     const x = t.x + dx, z = t.z + dz;
     if (marine) { expect(ground(x, z)).toBe(32); continue; }
     expect(p.parts.some(f => f.y + f.sy / 2 === t.y && math.abs(x - f.x) <= f.sx / 2 && math.abs(z - f.z) <= f.sz / 2)).toBe(true);
    }
    for (const other of p.targets) if (other.id !== t.id) expect(math.abs(t.x - other.x) >= hx * 2 || math.abs(t.z - other.z) >= hz * 2).toBe(true);
   }
   for (const f of p.parts.filter(part => part.name.find("foundation")[0] !== undefined || part.name === "Service runway" || part.name === "Service apron")) {
    for (const dx of [-f.sx / 2 + 4, 0, f.sx / 2 - 4]) for (const dz of [-f.sz / 2 + 4, 0, f.sz / 2 - 4]) {
     expect(f.y + f.sy / 2 - ground(f.x + dx, f.z + dz)).toBeGreaterThanOrEqual(8);
     expect(f.y - f.sy / 2).toBeLessThanOrEqual(ground(f.x + dx, f.z + dz));
    }
   }
  }
 });
 it("supports every rotated uploaded prop, preserves water depth and limits every Part", () => {
  for (const p of a.props) {
   const spec = UploadedAssetSpecs[p.asset];
   for (const dx of [-spec.size.X * p.scale / 2, spec.size.X * p.scale / 2]) for (const dz of [-spec.size.Z * p.scale / 2, spec.size.Z * p.scale / 2]) {
    const x = p.x + dx * math.cos(p.yaw) + dz * math.sin(p.yaw), z = p.z - dx * math.sin(p.yaw) + dz * math.cos(p.yaw);
    if (p.asset === "HarbourQuay") expect(m06Ground(x, z)).toBe(32);
    else expect(a.parts.some(f => f.y + f.sy / 2 === p.y && math.abs(x - f.x) <= f.sx / 2 && math.abs(z - f.z) <= f.sz / 2)).toBe(true);
   }
   for (const dim of [spec.size.X, spec.size.Y, spec.size.Z]) expect(dim * p.scale).toBeLessThanOrEqual(2048);
  }
  for (const t of a.targets.filter(t => t.y === 32)) for (const dx of [-40, 0, 40]) for (const dz of [-220, 0, 220]) {
   const x = t.x + dx, z = t.z + dz;
   expect(a.ops.some(op => op.material === "Water" && math.abs(x - op.x) <= op.sx / 2 && math.abs(z - op.z) <= op.sz / 2 && op.y - op.sy / 2 === 0)).toBe(true);
   expect(a.ops.some(op => op.material !== "Water" && math.abs(x - op.x) < op.sx / 2 && math.abs(z - op.z) < op.sz / 2)).toBe(false);
  }
  expect(a.parts.some(p => p.name === "Sea")).toBe(true);
  for (const p of [a, b]) for (const f of p.parts) for (const dim of [f.sx, f.sy, f.sz]) { expect(dim).toBeGreaterThan(0); expect(dim).toBeLessThanOrEqual(2048); }
 });
 it("seals every column and shared edge down to Y=0 beyond hard airspace without a floor", () => {
  for (const [p, airspace] of [[a, M06_AIRSPACE], [b, M07_AIRSPACE]] as const) {
   expect(16384).toBeGreaterThan(airspace.hardHalfWidth);
   const caps = new Map<string, number>(), walls = new Map<string, TerrainOp[]>();
   for (const op of [...p.ops, ...p.parts.filter(f => f.name === "Sea").map(f => ({ ...f, shape: "block" as const, material: "Water" as const }))]) {
    expect(op.y - op.sy / 2).toBeGreaterThanOrEqual(0);
    if (op.sx >= 128 && op.sz >= 128) {
     for (let x = op.x - op.sx / 2; x < op.x + op.sx / 2; x += 128) for (let z = op.z - op.sz / 2; z < op.z + op.sz / 2; z += 128) { expect(caps.has(`${x},${z}`)).toBe(false); caps.set(`${x},${z}`, op.y + op.sy / 2); }
    } else {
     const axis = op.sx === 4 ? "x" : "z", edge = math.floor((axis === "x" ? op.x : op.z) / 128 + 0.5) * 128;
     const start = axis === "x" ? op.z - op.sz / 2 : op.x - op.sx / 2, length = axis === "x" ? op.sz : op.sx;
     for (let v = start; v < start + length; v += 128) { const key = `${axis},${edge},${v}`, list = walls.get(key) ?? []; list.push(op); walls.set(key, list); }
    }
   }
   let gaps = 0;
   for (let x = -16384; x < 16384; x += 128) for (let z = -16384; z < 16384; z += 128) {
    const h = caps.get(`${x},${z}`); if (h === undefined) { gaps++; continue; }
    for (const [axis, edge, v, nx, nz] of [["x", x + 128, z, x + 128, z], ["z", z + 128, x, x, z + 128], ...(x === -16384 ? [["x", x, z, x - 128, z]] : []), ...(z === -16384 ? [["z", z, x, x, z - 128]] : [])] as Array<[string, number, number, number, number]>) {
     const n = caps.get(`${nx},${nz}`) ?? 0;
     if (n !== h && !(walls.get(`${axis},${edge},${v}`) ?? []).some(w => w.y - w.sy / 2 <= math.max(0, math.min(h, n) - 8) && w.y + w.sy / 2 >= math.max(h, n))) gaps++;
    }
   }
   expect(gaps).toBe(0);
  }
 });
 it("keeps a clear 256-stud-wide low escape path through all canyon bends", () => {
  let length = 0;
  for (let i = 1; i < M07_CANYON.size(); i++) {
   const a = M07_CANYON[i - 1], c = M07_CANYON[i], dx = c.x - a.x, dz = c.z - a.z, len = math.sqrt(dx * dx + dz * dz); length += len;
   for (let s = 0; s <= len; s += 64) {
    const x = a.x + dx * s / len, z = a.z + dz * s / len, y = a.floor + (c.floor - a.floor) * s / len + 80;
    expect(y + 24).toBeLessThan(M07.artilleryCeiling);
    for (const offset of [-128, 0, 128]) {
     const px = x + dz / len * offset, pz = z - dx / len * offset;
     expect(y - m07Ground(px, pz)).toBeGreaterThanOrEqual(32);
     expect(b.parts.some(p => math.abs(px - p.x) < p.sx / 2 + 24 && math.abs(pz - p.z) < p.sz / 2 + 24 && p.y + p.sy / 2 > y - 24)).toBe(false);
    }
   }
  }
  // ~2 min at 160 studs/s without compressing the sketch.
  expect(length / 160).toBeGreaterThan(120); expect(length / 160).toBeLessThan(140);
 });
 it("enforces the ≤16-second calibrated budget and specified weather/time", () => {
  for (const [p, counts, limit] of [[a, m06Counts(a), M06_BUILD_LIMITS], [b, m07Counts(b), M07_BUILD_LIMITS]] as const) {
   expect(p.detailCells).toBeGreaterThan(0);
   print(`${p.key} BUDGET solidTouches=${counts.solidTouches} waterTouches=${counts.waterTouches} yields=${counts.yields} legacyEstimatedSeconds=${counts.legacyEstimatedSeconds} voxels=${counts.voxels} jobs=${counts.jobs} parts=${counts.parts} props=${counts.props} descendants=${counts.descendants} estimatedSeconds=${counts.estimatedSeconds}`);
   expect(counts.voxels).toBeLessThanOrEqual(limit.voxelWrites); expect(counts.jobs).toBeLessThanOrEqual(limit.jobs); expect(counts.parts).toBeLessThanOrEqual(limit.parts);
   expect(counts.props).toBeLessThanOrEqual(limit.props); expect(counts.descendants).toBeLessThanOrEqual(limit.descendants); expect(counts.estimatedSeconds).toBeLessThanOrEqual(limit.estimatedSeconds);
  }
  expect(M06_ENVIRONMENT.clock).toBe(12); expect(M07_ENVIRONMENT.clock).toBe(16 + 40 / 60);
  expect(M06_ENVIRONMENT.weather).toBe("none"); expect(M07_ENVIRONMENT.weather).toBe("none"); expect(M07_ENVIRONMENT.moonSize).toBeGreaterThan(0);
 });
});
