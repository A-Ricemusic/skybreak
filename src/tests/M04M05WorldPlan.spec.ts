import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM04Plan, M04, M04_ENVIRONMENT, M04_SURFACE, m04Counts, m04Ground } from "../shared/M04WorldPlan";
import { buildM05Plan, M05, M05_ENVIRONMENT, M05_SURFACE, m05Counts, m05Ground, m05Coast, M05_TARGET_POINTS } from "../shared/M05WorldPlan";
import { M04_BUILD_LIMITS, M04_AIRSPACE } from "../shared/M04Limits";
import { M05_BUILD_LIMITS, M05_AIRSPACE } from "../shared/M05Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { WORLD_HALF, surfaceSide } from "../shared/SealedWorldSurface";
import { terrainTop, polyDist } from "../shared/WorldPlan";

// Roblox CFrame yaw: local X rotates toward -Z.
function footprint(x: number, z: number, sx: number, sz: number, yaw: number): Array<[number, number]> {
 const out: Array<[number, number]> = [[x, z]];
 for (const dx of [-sx / 2, sx / 2]) for (const dz of [-sz / 2, sz / 2])
  out.push([x + dx * math.cos(yaw) + dz * math.sin(yaw), z - dx * math.sin(yaw) + dz * math.cos(yaw)]);
 return out;
}
describe("Dormant M04/M05 world compositions", () => {
 const a = buildM04Plan(), b = buildM05Plan();
 it("is deterministic, cooperatively planned with only M04 activated", () => {
  let checkpoints = 0;
  expect(buildM04Plan(404, () => { checkpoints++; })).toEqual(a);
  expect(buildM05Plan()).toEqual(b); expect(checkpoints).toBeGreaterThan(1000);
  for (const bp of MissionCatalog.All()) { if(bp.id!==4) expect(MissionCatalog.WorldKey(bp.id)).never.toBe(a.key); expect(MissionCatalog.WorldKey(bp.id)).never.toBe(b.key); }
 });
 it("exports unique prefixed ids, required air counts and NNE contact poses", () => {
  for (const [targets, prefix] of [[a.targets, "m04_"], [b.targets, "m05_"]] as const) {
   const ids = new Set<string>();
   for (const t of targets) { expect(t.id.sub(1, 4)).toBe(prefix); expect(ids.has(t.id)).toBe(false); ids.add(t.id); }
  }
  expect(a.ops.some(op => op.material === "Water")).toBe(true);
  expect(a.targets.filter(t => t.type === "transport").size()).toBe(3);
  expect(a.targets.filter(t => t.type === "jammer").size()).toBe(2);
  expect(a.targets.filter(t => t.type === "escort").size()).toBe(9);
  expect(a.targets.filter(t => t.type === "ace").size()).toBe(1);
  expect(a.targets.find(t => t.type === "ace")!.id).toBe("m04_ace");
  let score = 0;
  for (const t of a.targets) score += t.type === "transport" ? 160 : t.type === "jammer" ? 140 : t.type === "ace" ? 240 : 60;
  expect(score).toBe(1540);
  for (const t of a.targets) { expect(t.x).toBeGreaterThan(M04.start.x); expect(t.z).toBeLessThan(M04.start.z); expect(t.y - m04Ground(t.x, t.z)).toBeGreaterThan(300); }
  let length = 0;
  for (let i = 1; i < M04.route.size(); i++) { const dx = M04.route[i][0] - M04.route[i - 1][0], dz = M04.route[i][1] - M04.route[i - 1][1]; length += math.sqrt(dx * dx + dz * dz); }
  expect(length).toBeGreaterThan(40000); expect(length).toBeLessThan(45000);
 });
 it("places exactly 88 industrial ground contacts, two tankers and three helicopters", () => {
  expect(b.targets.filter(t => t.group === "rig").size()).toBe(48);
  expect(b.targets.filter(t => t.group === "refinery").size()).toBe(40);
  expect(b.targets.filter(t => t.type === "tanker").size()).toBe(2);
  expect(b.targets.filter(t => t.type === "helicopter").size()).toBe(3);
  for (const t of b.targets) {
   if (t.group === "rig") { expect(t.y).toBe(120); expect(m05Ground(t.x, t.z)).toBe(8); }
   if (t.group === "refinery") { expect(t.y).toBe(48); expect(m05Ground(t.x, t.z)).toBe(36); }
   if (t.type === "tanker") {
    expect(t.y).toBe(32);
    // Uploaded bounds and larger fallback hull, each in the authored CFrame yaw.
    const spec = UploadedAssetSpecs.FuelTanker;
    for (const [sx, sz, draft] of [[64, 360, 16], [spec.size.X, spec.size.Z, spec.groundOffset]])
     for (const [x, z] of footprint(t.x, t.z, sx, sz, t.yaw)) {
      expect(t.y - draft - m05Ground(x, z)).toBeGreaterThanOrEqual(8);
      expect(terrainTop(b.ops, x, z).solid).toBe(m05Ground(x, z));
     }
   }
  }
  expect(math.abs(m05Coast(M05.refinery.z) - (M05.refinery.x + M05.refinery.hx))).toBeLessThan(400);
  expect(math.abs(M05.rig.x - M05.refinery.x)).toBe(18500);
  expect(M05.returnLine.z - M05.base.z).toBe(2700);
  for (let z = -5000; z <= 12000; z += 256) for (const dx of [-1800, 0, 1800]) expect(m05Ground(M05.escape.x + dx, z)).toBe(8);
 });
 it("supports every refinery and rig footprint without target overlaps", () => {
  const ground = b.targets.filter(t => t.group === "rig" || t.group === "refinery");
  for (const t of ground) {
   const radius = t.type === "fuel_tank_large" ? 68 : t.type === "fuel_tank" ? 50 : 40;
   for (const dx of [-radius, radius]) for (const dz of [-radius, radius]) {
    if (t.group === "refinery") expect(m05Ground(t.x + dx, t.z + dz)).toBe(36);
    const decks = b.parts.filter(p => p.name === (t.group === "rig" ? "Rig working deck" : "Refinery foundation"));
    expect(decks.some(p => math.abs(t.x + dx - p.x) <= p.sx / 2 && math.abs(t.z + dz - p.z) <= p.sz / 2 && p.y + p.sy / 2 === t.y)).toBe(true);
   }
   for (const other of ground) if (other.id !== t.id) expect(math.abs(t.x - other.x) >= radius * 2 || math.abs(t.z - other.z) >= radius * 2).toBe(true);
  }
  for (const p of b.parts.filter(p => p.name === "Southern runway" || p.name === "Refinery foundation" || p.name === "Base apron"))
   for (const dx of [-p.sx / 2 + 4, 0, p.sx / 2 - 4]) for (const dz of [-p.sz / 2 + 4, 0, p.sz / 2 - 4]) expect(p.y + p.sy / 2 - m05Ground(p.x + dx, p.z + dz)).toBeGreaterThanOrEqual(8);
 });
 it("supports and clears every rotated track centre and corner", () => {
  for (const p of a.parts) for (const [x, z] of footprint(p.x, p.z, p.sx, p.sz, p.yaw)) {
   const ground = terrainTop(a.ops, x, z);
   expect(ground.solid).toBe(p.y - p.sy / 2);
   expect(a.ops.some(op => op.material === "Ground" && op.y + op.sy / 2 === ground.solid && math.abs(x - op.x) < op.sx / 2 && math.abs(z - op.z) < op.sz / 2)).toBe(true);
   expect(p.y + p.sy / 2 - ground.solid).toBeGreaterThanOrEqual(1);
  }
 });
 it("supports every prop footprint including the tower and waterline platform", () => {
  for (const p of b.props) {
   const spec = UploadedAssetSpecs[p.asset];
   for (const [x, z] of footprint(p.x, p.z, spec.size.X * p.scale, spec.size.Z * p.scale, p.yaw)) {
    if (p.asset === "OilPlatform") {
     // Piled marine structure: sea supports its waterline; legs enter the bed.
     expect(terrainTop(b.ops, x, z).water).toBe(p.y);
     expect(m05Ground(x, z)).toBeLessThan(p.y);
    } else {
     expect(p.y - m05Ground(x, z)).toBeGreaterThanOrEqual(8);
     expect(b.parts.some(deck => deck.y + deck.sy / 2 === p.y && math.abs(x - deck.x) <= deck.sx / 2 && math.abs(z - deck.z) <= deck.sz / 2)).toBe(true);
    }
   }
  }
  for (const p of a.props) for (const [x, z] of footprint(p.x, p.z, UploadedAssetSpecs[p.asset].size.X * p.scale, UploadedAssetSpecs[p.asset].size.Z * p.scale, p.yaw))
   expect(m04Ground(x, z)).toBe(p.y);
 });
 it("exports the observed 100-point contact and a rig ledger above the goal", () => {
  expect(b.targets.filter(t => t.type === "refinery_command").size()).toBe(1);
  let rig = 0, refinery = 0, total = 0;
  for (const t of b.targets) { const score = M05_TARGET_POINTS[t.type]; total += score; if (t.group === "rig") rig += score; if (t.group === "refinery") refinery += score; }
  expect(rig).toBe(2400); expect(refinery).toBe(1740); expect(total).toBe(4500);
 });
 it("caps Part dimensions and enforces M01-calibrated budgets", () => {
  for (const [p, counts, limits] of [[a, m04Counts(a), M04_BUILD_LIMITS], [b, m05Counts(b), M05_BUILD_LIMITS]] as const) {
   print(`${p.key} BUDGET voxels=${counts.voxels} jobs=${counts.jobs} parts=${counts.parts} props=${counts.props} descendants=${counts.descendants} estimatedSeconds=${counts.estimatedSeconds}`);
   for (const prop of p.props) {
    const size = UploadedAssetSpecs[prop.asset].size;
    for (const dim of [size.X, size.Y, size.Z]) expect(dim * prop.scale).toBeLessThanOrEqual(2048);
   }
   for (const part of p.parts) for (const dim of [part.sx, part.sy, part.sz]) { expect(dim).toBeGreaterThan(0); expect(dim).toBeLessThanOrEqual(2048); }
   expect(counts.voxels).toBeLessThanOrEqual(limits.voxelWrites); expect(counts.jobs).toBeLessThanOrEqual(limits.jobs);
   expect(counts.parts).toBeLessThanOrEqual(limits.parts); expect(counts.props).toBeLessThanOrEqual(limits.props); expect(counts.descendants).toBeLessThanOrEqual(limits.descendants);
   expect(counts.estimatedSeconds).toBeLessThanOrEqual(limits.estimatedSeconds);

  }
 });
 it("seals both undersides and perimeters beyond the hard airspace", () => {
  for (const [p, surface, ground, airspace] of [[a, M04_SURFACE, m04Ground, M04_AIRSPACE], [b, M05_SURFACE, m05Ground, M05_AIRSPACE]] as const) {
   const floor = p.ops[0]; expect(floor.y - floor.sy / 2).toBe(-4); expect(floor.y + floor.sy / 2).toBe(0);
   expect(floor.sx / 2).toBeGreaterThan(airspace.hardHalfWidth);
   // Index all caps/walls on the same finest address grid, then check every
   // exposed step and fine/coarse join for a curtain overlapping both caps.
   const caps = new Map<string, number>();
   const walls = new Map<string, Array<{lo: number; hi: number}>>();
   for (const op of p.ops) {
    if (op.material === "Water" || op === floor) continue;
    const x0 = op.x - op.sx / 2, z0 = op.z - op.sz / 2, lo = op.y - op.sy / 2, hi = op.y + op.sy / 2;
    if (op.sx >= 128 && op.sz >= 128) {
     for (let x = x0; x < x0 + op.sx; x += 128) for (let z = z0; z < z0 + op.sz; z += 128) caps.set(`${x},${z}`, hi);
    } else {
     const axis = op.sx === 4 ? "x" : "z", edge = math.floor((axis === "x" ? op.x : op.z) / 128 + 0.5) * 128;
     const begin = axis === "x" ? z0 : x0, length = axis === "x" ? op.sz : op.sx;
     for (let v = begin; v < begin + length; v += 128) { const key = `${axis},${edge},${v}`, list = walls.get(key) ?? []; list.push({lo, hi}); walls.set(key, list); }
    }
   }
   let gaps = 0;
   for (let x = -WORLD_HALF; x < WORLD_HALF; x += 128) for (let z = -WORLD_HALF; z < WORLD_HALF; z += 128) {
    const h = caps.get(`${x},${z}`); if (h === undefined) { gaps++; continue; }
    for (const [axis, edge, v, nx, nz] of [["x", x + 128, z, x + 128, z], ["z", z + 128, x, x, z + 128], ...(x === -WORLD_HALF ? [["x", x, z, x - 128, z]] : []), ...(z === -WORLD_HALF ? [["z", z, x, x, z - 128]] : [])] as Array<[string, number, number, number, number]>) {
     const neighbor = caps.get(`${nx},${nz}`) ?? 0;
     if (h !== neighbor && !(walls.get(`${axis},${edge},${v}`) ?? []).some(w => w.lo <= math.max(0, math.min(h, neighbor) - 8) && w.hi >= math.max(h, neighbor))) gaps++;
    }
   }
   expect(gaps).toBe(0);
   for (const x of [-12000, 0, 12000]) for (const z of [-12000, 0, 12000]) expect(terrainTop(p.ops, x + 17, z + 17).solid).toBe(ground(x + 17, z + 17));
   expect(surfaceSide(surface, 0, 0)).toBeGreaterThanOrEqual(128);
  }
 });
 it("matches noon/night weather and exports bounded light fields", () => {
  expect(M04_ENVIRONMENT.clock).toBe(12 + 26 / 60); expect(M04_ENVIRONMENT.clouds.cover).toBe(0.15);
  expect(M05_ENVIRONMENT.clock).toBe(5 + 50 / 60); expect(M05_ENVIRONMENT.sky).toBe("night"); expect(M05_ENVIRONMENT.clouds.cover).toBe(0.1);
  expect(M04_ENVIRONMENT.weather).toBe("none"); expect(M05_ENVIRONMENT.weather).toBe("none");
  expect(b.lightAnchors.filter(p => p.kind === "searchlight").size()).toBe(8);
  expect(b.lightAnchors.filter(p => p.kind === "point").size()).toBe(392);
  expect(b.lightAnchors.filter(p => p.kind === "runway").size()).toBe(50);
  expect(new Set(b.lightAnchors.map(p => p.id)).size()).toBe(b.lightAnchors.size());
  expect(polyDist(M04.start.x, M04.start.z, M04.route)).toBe(0);
 });
});
