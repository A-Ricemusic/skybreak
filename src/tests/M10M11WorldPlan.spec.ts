import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM10Plan, m10Counts, m10Ground, M10, M10_ENVIRONMENT } from "../shared/M10WorldPlan";
import { buildM11Plan, m11Counts, m11Ground, m11RoutePoint, M11, M11_ENVIRONMENT } from "../shared/M11WorldPlan";
import { M10_BUILD_LIMITS, M10_AIRSPACE } from "../shared/M10Limits";
import { M11_BUILD_LIMITS, M11_AIRSPACE } from "../shared/M11Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import type { PartSpec, PropSpec, TerrainOp } from "../shared/WorldPlan";
// Rotated prop bounds use the same bottom/waterline convention as WorldAssets.
function obstructed(parts: PartSpec[], props: PropSpec[], x: number, y: number, z: number, margin = 0): boolean {
 return parts.some(p => p.solid && math.abs(x - p.x) < p.sx / 2 + margin && math.abs(z - p.z) < p.sz / 2 + margin && y >= p.y - p.sy / 2 && y <= p.y + p.sy / 2) || props.some(p => {
  const s = UploadedAssetSpecs[p.asset], dx = x - p.x, dz = z - p.z;
  return math.abs(dx * math.cos(p.yaw) - dz * math.sin(p.yaw)) < s.size.X * p.scale / 2 + margin && math.abs(dx * math.sin(p.yaw) + dz * math.cos(p.yaw)) < s.size.Z * p.scale / 2 + margin && y >= p.y - s.groundOffset * p.scale && y <= p.y + (s.size.Y - s.groundOffset) * p.scale;
 });
}
describe("Dormant M10/M11 worlds", () => {
 const a = buildM10Plan(), b = buildM11Plan();
 it("is deterministic, checkpointed, dormant and names every contact once", () => {
  let calls = 0; expect(buildM10Plan(1010, () => { calls++; })).toEqual(a); expect(buildM11Plan()).toEqual(b); expect(calls).toBeGreaterThan(1000);
  for (const p of [a, b]) {
   expect(new Set(p.targets.map(t => t.id)).size()).toBe(p.targets.size());
   for (const t of p.targets) expect(p.parts.some(f => f.name === t.id) || t.type === "frigate" || t.type === "tanker").toBe(true);
   for (const m of MissionCatalog.All()) expect(MissionCatalog.WorldKey(m.id)).never.toBe(p.key);
  }
 });
 it("preserves spec anchors, NE ingress, 100/24 scenery capacity and mission metadata", () => {
  expect(M10.start).toEqual({x: 0, y: 617, z: 12480, headingDegrees: 45});
  expect(M10.districts.map(d => [d.x, d.z])).toEqual([[3840,6720],[-3360,960],[3360,-4800],[-4800,-9600]]);
  expect(M10.districts[0].x).toBeGreaterThan(M10.start.x); expect(M10.districts[0].z).toBeLessThan(M10.start.z);
  expect(M10.briefing).toEqual({air:26,ground:100,naval:24,total:150}); expect(M10.scoreGoal).toBe(3000); expect(M10.durationSeconds).toBe(1200);
  expect(a.targets.filter(t => t.domain === "ground").size()).toBe(100); expect(a.targets.filter(t => t.domain === "naval").size()).toBe(24);
  for (const d of M10.districts) { expect(a.targets.filter(t => t.group === d.group && t.domain === "ground").size()).toBe(25); expect(a.targets.filter(t => t.group === d.group && t.domain === "naval").size()).toBe(6); }
  expect(M11.start).toEqual({x:0,y:735,z:9600,headingDegrees:315}); expect(M11.durationSeconds).toBe(330); expect(b.targets.size()).toBe(2);
 });
 it("supports ground footprints, with non-overlap and >=8-stud terrain clearance", () => {
  const ts = a.targets.filter(t => t.domain === "ground");
  for (const t of ts) {
   const f = a.parts.filter(p => p.name === `${t.id}_foundation`)[0]; expect(f.y + f.sy / 2).toBe(t.y);
   for (const o of ts) if (t.id !== o.id) expect(math.abs(t.x-o.x) >= 160 || math.abs(t.z-o.z) >= 160).toBe(true);
  }
  for (const f of a.parts.filter(p => p.name.find("foundation")[0] !== undefined)) for (const dx of [-f.sx/2+4,0,f.sx/2-4]) for (const dz of [-f.sz/2+4,0,f.sz/2-4]) {
   const g = m10Ground(f.x+dx,f.z+dz); expect(f.y+f.sy/2-g).toBeGreaterThanOrEqual(8); expect(f.y-f.sy/2).toBeLessThanOrEqual(g);
  }
  for (const p of a.props.filter(p => p.asset !== "Pine")) {
   const s = UploadedAssetSpecs[p.asset];
   for (const dx of [-s.size.X/2,s.size.X/2]) for (const dz of [-s.size.Z/2,s.size.Z/2]) expect(a.parts.some(f => f.y+f.sy/2===p.y && math.abs(p.x+dx-f.x)<=f.sx/2 && math.abs(p.z+dz-f.z)<=f.sz/2)).toBe(true);
  }
 });
 it("keeps complete ship footprints in native water at correct keel offsets, without overlaps", () => {
  const ships = a.targets.filter(t => t.domain === "naval");
  for (const t of ships) {
   const s = t.type === "frigate" ? UploadedAssetSpecs.Frigate : t.type === "tanker" ? UploadedAssetSpecs.FuelTanker : undefined;
   expect(t.y).toBe(32); if (s !== undefined) expect(t.y-s.groundOffset).toBe(16);
   const sx = s?.size.X ?? 40, sz = s?.size.Z ?? 140;
   for (let dx = -sx/2; dx <= sx/2; dx += sx/4) for (let dz = -sz/2; dz <= sz/2; dz += sz/8) {
    const x=t.x+dx,z=t.z+dz;
    expect(a.ops.some(o => o.material === "Water" && math.abs(x-o.x)<=o.sx/2 && math.abs(z-o.z)<=o.sz/2 && o.y-o.sy/2===0 && o.y+o.sy/2===32)).toBe(true);
    expect(a.ops.some(o => o.material !== "Water" && math.abs(x-o.x)<o.sx/2 && math.abs(z-o.z)<o.sz/2)).toBe(false);
   }
   for (const o of ships) if (t.id!==o.id) expect(math.abs(t.x-o.x)>64 || math.abs(t.z-o.z)>430).toBe(true);
   // Procedural hull itself is intended; pens and quays must not intersect ship envelopes.
   expect(a.parts.some(p => p.name !== t.id && p.name !== "Sea" && math.abs(p.x-t.x)<p.sx/2+sx/2 && math.abs(p.z-t.z)<p.sz/2+sz/2)).toBe(false);
  }
 });
 it("keeps service/landing envelopes clear of terrain, Parts AND props", () => {
  for (const [x,z,length,width] of [[-9600,12000,2304,128],[2940,6720,1920,58]]) for (let dz=-length/2-3200;dz<=length/2+3200;dz+=64) for (const dx of [-width/2-100,0,width/2+100]) {
   // Full 100-stud side margin, tested 8 above runway and along both approach extensions.
   expect(m10Ground(x+dx,z+dz)).toBeLessThan(88);
   expect(obstructed(a.parts,a.props,x+dx,90,z+dz,16)).toBe(false);
  }
  // The checker must reject a prop in an otherwise terrain-clear approach.
  expect(obstructed([], [{asset:"ControlTower",x:-9600,y:80,z:14500,yaw:0,scale:1,tint:0}],-9600,90,14500)).toBe(true);
 });
 it("preserves both unclipped route bands, saddle clearance and safe exits", () => {
  expect(b.routes.map(r=>r.id)).toEqual(["m11_civilian_low","m11_civilian_high"]);
  expect(m11RoutePoint(false,0)).toEqual({x:-1440,y:900,z:6240}); expect(m11RoutePoint(true,0)).toEqual({x:2880,y:2800,z:6240});
  expect(m11RoutePoint(false,6240/17760).x).toBe(-1920); expect(m11RoutePoint(true,6240/17760).x).toBe(1920);
  for (const high of [false,true]) for (let j=0;j<=512;j++) {
   const p=m11RoutePoint(high,j/512); expect(p.y).toBe(high?2800:900);
   for (const dx of [-720,0,720]) { expect(p.y-m11Ground(p.x+dx,p.z)).toBeGreaterThanOrEqual(150); expect(obstructed(b.parts.filter(f=>f.name!==(high?"m11_civilian_high":"m11_civilian_low")),b.props,p.x+dx,p.y,p.z,40)).toBe(false); }
  }
  for (const r of b.routes) { expect(r.points[64]).toEqual({x:0,y:r.points[0].y,z:-11520}); expect(r.durationSeconds).toBeLessThan(M11.durationSeconds); }
 });
 it("seals every column and shared edge down to Y=0 beyond hard airspace without a floor", () => {
  for (const [p, airspace] of [[a, M10_AIRSPACE], [b, M11_AIRSPACE]] as const) {
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

 it("enforces Part/prop bounds and <=16-second modeled build budgets", () => {
  for (const [p,c,limit] of [[a,m10Counts(a),M10_BUILD_LIMITS],[b,m11Counts(b),M11_BUILD_LIMITS]] as const) {
   print(`${p.key} BUDGET solidTouches=${c.solidTouches} waterTouches=${c.waterTouches} yields=${c.yields} voxels=${c.voxels} jobs=${c.jobs} parts=${c.parts} props=${c.props} descendants=${c.descendants} estimatedSeconds=${c.estimatedSeconds}`);
   for (const f of p.parts) for (const dim of [f.sx,f.sy,f.sz]) { expect(dim).toBeGreaterThan(0); expect(dim).toBeLessThanOrEqual(2048); }
   for (const f of p.props) for (const dim of [UploadedAssetSpecs[f.asset].size.X,UploadedAssetSpecs[f.asset].size.Y,UploadedAssetSpecs[f.asset].size.Z]) expect(dim*f.scale).toBeLessThanOrEqual(2048);
   expect(c.voxels).toBeLessThanOrEqual(limit.voxelWrites); expect(c.jobs).toBeLessThanOrEqual(limit.jobs); expect(c.parts).toBeLessThanOrEqual(limit.parts); expect(c.props).toBeLessThanOrEqual(limit.props); expect(c.descendants).toBeLessThanOrEqual(limit.descendants); expect(c.estimatedSeconds).toBeLessThanOrEqual(limit.estimatedSeconds);
  }
  expect(M10_ENVIRONMENT.clock).toBe(14.25); expect(M11_ENVIRONMENT.sky).toBe("overcast"); expect(M10_ENVIRONMENT.weather).toBe("none"); expect(M11_ENVIRONMENT.weather).toBe("none");
 });
});
