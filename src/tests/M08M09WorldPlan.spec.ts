import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM08Plan, m08Counts, m08Ground, M08, M08_ENVIRONMENT } from "../shared/M08WorldPlan";
import { buildM09Plan, m09Counts, m09Ground, M09, M09_SERVICE, M09_ENVIRONMENT } from "../shared/M09WorldPlan";
import { M08_BUILD_LIMITS, M08_AIRSPACE } from "../shared/M08Limits";
import { M09_BUILD_LIMITS, M09_AIRSPACE } from "../shared/M09Limits";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { MissionCatalog } from "../shared/MissionCatalog";
import type { TerrainOp } from "../shared/WorldPlan";
describe("Dormant M08/M09 worlds", () => {
 const a = buildM08Plan(), b = buildM09Plan();
 it("is deterministic, checkpointed, exports M08 and M09 for their missions and exports unique named scenery", () => {
  let calls = 0;
  expect(buildM08Plan(808, () => { calls++; })).toEqual(a); expect(buildM09Plan()).toEqual(b);
  expect(calls).toBeGreaterThan(1000);
  for (const p of [a, b]) {
   expect(new Set(p.targets.map(t => t.id)).size()).toBe(p.targets.size());
   for (const t of p.targets) expect(p.parts.some(f => f.name === t.id) || p.props.some(f => f.tag === t.id)).toBe(true);
   for (const m of MissionCatalog.All().filter(m=>m.id!==8 && m.id!==9)) expect(MissionCatalog.WorldKey(m.id)).never.toBe(p.key);
  }
  for (const t of a.targets) expect(t.id.sub(1, 4)).toBe("m08_");
  for (const t of b.targets) expect(t.id.sub(1, 4)).toBe("m09_");
 });
 it("preserves exact sketch anchors, the NW opening and the finite provisional inventory", () => {
  expect(M08.start).toEqual({ x: 7680, y: 851, z: 7680, headingDegrees: 315 });
  expect(M08.transmitter).toEqual({ x: 1920, y: 90, z: 0 });
  expect([M08.battle, M08.bomberEntry, M08.bomberMidpoint, M08.protectedAirspace]).toEqual([
   { x: 0, y: 1000, z: -960 }, { x: -13440, y: 1200, z: -960 }, { x: -5760, y: 1200, z: -960 }, { x: 1920, y: 1200, z: 0 },
  ]);
  expect(M09.start).toEqual({ x: 0, y: 126, z: 7680, headingDegrees: 0 });
  expect(M09.beaches.map(t => [t.x, t.y, t.z])).toEqual([[-7680, 40, 0], [0, 40, -960], [7680, 40, 0]]);
  expect(M09.gunBelt).toEqual({ x: 0, y: 180, z: -2880 });
  expect(M09.attackEntry).toEqual({ x: 11520, y: 700, z: -5760 });
  expect(a.targets.size()).toBe(3); expect(b.targets.size()).toBe(55);
  for (const [kind, count] of [["radar", 9], ["battery", 6], ["pillbox", 16], ["tank", 7], ["launcher", 5], ["howitzer", 3], ["aa", 7], ["sam", 2]] as Array<[string, number]>) expect(b.targets.filter(t => t.type === kind).size()).toBe(count);
 });
 it("supports target footprints without overlap and raises foundations at least eight studs", () => {
  for (const [p, ground] of [[a, m08Ground], [b, m09Ground]] as const) {
   for (const t of p.targets) {
    for (const dx of [-110, 110]) for (const dz of [-90, 90]) expect(p.parts.some(f => f.y + f.sy / 2 === t.y && math.abs(t.x + dx - f.x) <= f.sx / 2 && math.abs(t.z + dz - f.z) <= f.sz / 2)).toBe(true);
    for (const o of p.targets) if (o.id !== t.id) expect(math.abs(t.x - o.x) >= 220 || math.abs(t.z - o.z) >= 180).toBe(true);
   }
   for (const f of p.parts.filter(f => f.name.lower().find("foundation")[0] !== undefined)) for (const dx of [-f.sx / 2 + 4, 0, f.sx / 2 - 4]) for (const dz of [-f.sz / 2 + 4, 0, f.sz / 2 - 4]) {
    expect(f.y + f.sy / 2 - ground(f.x + dx, f.z + dz)).toBeGreaterThanOrEqual(8);
    expect(f.y - f.sy / 2).toBeLessThanOrEqual(ground(f.x + dx, f.z + dz));
   }
  }
 });
 it("keeps ships over native water only, with correct carrier keel/deck and a clear service approach", () => {
  const carrier = b.props.filter(p => p.asset === "Carrier"); expect(carrier.size()).toBe(1);
  expect(carrier[0].y).toBe(32); expect(carrier[0].z).toBe(11520);
  expect(carrier[0].y - UploadedAssetSpecs.Carrier.groundOffset).toBe(12);
  expect(M09_SERVICE.deckY).toBe(66); expect(M09_SERVICE.touchdown.y).toBe(M09_SERVICE.deckY);
  for (const p of b.props.filter(p => p.asset === "Carrier" || p.asset === "Frigate")) {
   const spec = UploadedAssetSpecs[p.asset];
   for (const dx of [-spec.size.X / 2, 0, spec.size.X / 2]) for (const dz of [-spec.size.Z / 2, 0, spec.size.Z / 2]) {
    const x = p.x + dx, z = p.z + dz;
    expect(b.ops.some(o => o.material === "Water" && math.abs(x - o.x) <= o.sx / 2 && math.abs(z - o.z) <= o.sz / 2 && o.y - o.sy / 2 === 0)).toBe(true);
    expect(b.ops.some(o => o.material !== "Water" && math.abs(x - o.x) < o.sx / 2 && math.abs(z - o.z) < o.sz / 2)).toBe(false);
   }
  }
  for (let z = 12000; z <= 13500; z += 64) for (const x of [-128, 0, 128]) expect(m09Ground(x, z)).toBe(32);
  for (const beach of M09.beaches) for (const dx of [-600, 0, 600]) {
   expect(m09Ground(beach.x + dx, beach.z)).toBe(40);
   expect(b.parts.some(f => f.name !== "Sea" && math.abs(beach.x + dx - f.x) < f.sx / 2 && math.abs(beach.z - f.z) < f.sz / 2)).toBe(false);
  }
 });
 it("supports rotated uploaded dry props and respects every Part dimension", () => {
  for (const [p, ground] of [[a, m08Ground], [b, m09Ground]] as const) {
   for (const f of p.parts) for (const dim of [f.sx, f.sy, f.sz]) { expect(dim).toBeGreaterThan(0); expect(dim).toBeLessThanOrEqual(2048); }
   for (const f of p.props) {
    const spec = UploadedAssetSpecs[f.asset];
    for (const dim of [spec.size.X, spec.size.Y, spec.size.Z]) expect(dim * f.scale).toBeLessThanOrEqual(2048);
    if (f.asset === "Carrier" || f.asset === "Frigate") continue;
    for (const dx of [-spec.size.X * f.scale / 2, spec.size.X * f.scale / 2]) for (const dz of [-spec.size.Z * f.scale / 2, spec.size.Z * f.scale / 2]) {
     const x = f.x + dx * math.cos(f.yaw) + dz * math.sin(f.yaw), z = f.z - dx * math.sin(f.yaw) + dz * math.cos(f.yaw);
     if (f.asset === "Pine" || f.asset === "Broadleaf") expect(ground(x, z)).toBe(f.y);
     else expect(p.parts.some(s => s.y + s.sy / 2 === f.y && math.abs(x - s.x) <= s.sx / 2 && math.abs(z - s.z) <= s.sz / 2)).toBe(true);
    }
   }
  }
 });
 it("seals every column and shared edge down to Y=0 beyond hard airspace without a floor", () => {
  for (const [p, airspace] of [[a, M08_AIRSPACE], [b, M09_AIRSPACE]] as const) {
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
 it("enforces the calibrated ≤16-second budget and mission weather", () => {
  for (const [p, c, limit] of [[a, m08Counts(a), M08_BUILD_LIMITS], [b, m09Counts(b), M09_BUILD_LIMITS]] as const) {
   print(`${p.key} BUDGET solidTouches=${c.solidTouches} waterTouches=${c.waterTouches} yields=${c.yields} voxels=${c.voxels} jobs=${c.jobs} parts=${c.parts} props=${c.props} descendants=${c.descendants} estimatedSeconds=${c.estimatedSeconds}`);
   expect(c.voxels).toBeLessThanOrEqual(limit.voxelWrites); expect(c.jobs).toBeLessThanOrEqual(limit.jobs); expect(c.parts).toBeLessThanOrEqual(limit.parts);
   expect(c.props).toBeLessThanOrEqual(limit.props); expect(c.descendants).toBeLessThanOrEqual(limit.descendants); expect(c.estimatedSeconds).toBeLessThanOrEqual(limit.estimatedSeconds);
  }
  expect(M08_ENVIRONMENT.clock).toBe(13 + 35 / 60); expect(M09_ENVIRONMENT.clock).toBe(17);
  expect(M08_ENVIRONMENT.weather).toBe("none"); expect(M09_ENVIRONMENT.weather).toBe("none");
 });
});
