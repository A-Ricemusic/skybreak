import { plansEqual, testCheckpoint } from "./TestPacing";
import { describe,expect,it } from "@rbxts/jest-globals";
import { buildM12Plan,m12Counts,m12Ground,M12,M12_ENVIRONMENT } from "../shared/M12WorldPlan";
import { buildM13Plan,m13Counts,m13Ground,m13RoutePoint,M13,M13_ENVIRONMENT,M13_ANCHORS } from "../shared/M13WorldPlan";
import { M12_AIRSPACE,M12_BUILD_LIMITS } from "../shared/M12Limits";
import { M13_AIRSPACE,M13_BUILD_LIMITS } from "../shared/M13Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import type { TerrainOp,PartSpec } from "../shared/WorldPlan";
const obstructed=(ps:PartSpec[],x:number,y:number,z:number,margin=0)=>ps.some(p=>p.solid&&math.abs(x-p.x)<p.sx/2+margin&&math.abs(z-p.z)<p.sz/2+margin&&math.abs(y-p.y)<p.sy/2+margin);
describe("Activated M12/M13 worlds",()=>{
 const a=buildM12Plan(),b=buildM13Plan();
 it("is deterministic, checkpointed, id-owned; M12 and M13 activated",()=>{
  let calls=0; expect(plansEqual(buildM12Plan(1212,()=>{calls++;}), a)).toBe(true); expect(plansEqual(buildM13Plan(), b)).toBe(true);expect(calls).toBeGreaterThan(1000);
  for(const p of [a,b]){expect(new Set(p.targets.map(t=>t.id)).size()).toBe(p.targets.size());for(const t of p.targets)expect(p.parts.some(f=>f.name===t.id)).toBe(true);for(const m of MissionCatalog.All()) if(m.id!==12 && m.id!==13)expect(MissionCatalog.WorldKey(m.id)).never.toBe(p.key);}
 });
 it("preserves eight radial pads, seven live guns, 24-kill inventory and distinct initial briefing",()=>{
  expect(M12.radius).toBe(2400);expect(M12.start.z).toBe(10080);expect(M12.service).toEqual({x:-8640,y:104,z:10560,length:2304,width:128,approachLength:3200});
  expect(M12.briefing).toEqual({air:3,ground:18,total:21});expect(M12.kills).toEqual({ground:24,air:9});expect(M12.strikeSeconds).toBe(900);expect(M12.eliteSeconds).toBe(600);
  expect(a.targets.filter(t=>t.live).size()).toBe(24);expect(a.targets.filter(t=>t.type==="ring_gun").size()).toBe(7);expect(a.targets.filter(t=>t.type==="gun_wreck").size()).toBe(1);
  expect(a.targets.filter(t=>t.type==="aa").size()).toBe(9);expect(a.targets.filter(t=>t.type==="sam").size()).toBe(7);expect(a.targets.filter(t=>t.type==="ground_ecm").size()).toBe(1);
  for(let i=0;i<8;i++){const t=a.targets[i],angle=i*math.pi/4;expect(t.x).toBe(2400*math.sin(angle));expect(t.z).toBe(-2400*math.cos(angle));}
 });
 it("supports every foundation footprint >=8 above terrain without overlapping target supports",()=>{
  const fs=a.parts.filter(f=>f.name.find("foundation")[0]!==undefined);
  for(const f of fs)for(const dx of [-f.sx/2+4,0,f.sx/2-4])for(const dz of [-f.sz/2+4,0,f.sz/2-4]){const g=m12Ground(f.x+dx,f.z+dz);expect(f.y+f.sy/2-g).toBeGreaterThanOrEqual(8);expect(f.y-f.sy/2).toBeLessThanOrEqual(g);}
  for(const t of a.targets){const f=fs.filter(f=>f.name===`${t.id}_foundation`)[0];expect(f.y+f.sy/2).toBe(t.y);for(const o of a.targets)if(t.id!==o.id){const of=fs.filter(f=>f.name===`${o.id}_foundation`)[0];expect(math.abs(t.x-o.x)>=(f.sx+of.sx)/2||math.abs(t.z-o.z)>=(f.sz+of.sz)/2).toBe(true);}}
 });
 it("clears runway, both 3200-stud approaches, side margins, and ingress",()=>{
  const s=M12.service;
  expect(a.props.size()).toBe(0);
  for(let dz=-s.length/2-s.approachLength;dz<=s.length/2+s.approachLength;dz+=32)for(const dx of [-s.width/2-100,0,s.width/2+100]){expect(m12Ground(s.x+dx,s.z+dz)).toBeLessThan(s.y);expect(obstructed(a.parts,s.x+dx,s.y+20,s.z+dz,8)).toBe(false);}
  for(let z=4000;z<=M12.start.z;z+=64)expect(m12Ground(0,z)).toBeLessThan(M12.start.y);
  expect(obstructed([{...a.parts[0],x:s.x,y:s.y+20,z:s.z+2000}],s.x,s.y+20,s.z+2000)).toBe(true);
 });
 it("exports 32 spaced 3D jammers, anchors, plane route and exact objective metadata",()=>{
  expect(M13.scoreGoal).toBe(1300);expect(M13.sweepSeconds).toBe(420);expect(M13.interceptSeconds).toBe(900);expect(M13.jammerKills).toBe(32);
  expect(M13_ANCHORS.map(p=>[p.x,p.z])).toEqual([[0,11520],[-3360,6240],[2400,0],[-1920,-5760],[0,-11520]]);
  const js=b.targets.filter(t=>t.type==="airship");expect(js.size()).toBe(32);expect(b.targets.filter(t=>t.type==="evidence_plane").size()).toBe(1);
  for(let c=0;c<8;c++)expect(js.filter(t=>t.group===`cluster_${c+1}`).size()).toBe(4);
  for(const t of js){expect(t.y).toBeGreaterThanOrEqual(450);expect(t.y).toBeLessThanOrEqual(900);expect(t.y-24-m13Ground(t.x,t.z)).toBeGreaterThan(0);for(const o of js)if(t.id!==o.id)expect(math.abs(t.x-o.x)>=60||math.abs(t.z-o.z)>=60).toBe(true);}
  expect(b.routes[0].points[128]).toEqual({x:0,y:383,z:-11520});expect(b.routes[0].durationSeconds).toBe(418);
 });
 it("connects the entire generated traversable ravine floor and clears the plane flight tube",()=>{
  // Flood fill emitted low caps, not the analytic centreline; no water is authored in these arid/ravine worlds.
  const key=(x:number,z:number)=>`${x},${z}`, cells=new Set<string>();
  for(const o of b.ops)if(o.sx>=128&&o.sz>=128&&o.y+o.sy/2<=256)for(let x=o.x-o.sx/2;x<o.x+o.sx/2;x+=128)for(let z=o.z-o.sz/2;z<o.z+o.sz/2;z+=128)cells.add(key(x,z));
  const first=m13RoutePoint(0),sx=math.floor(first.x/128)*128,sz=math.floor(first.z/128)*128,queue:Array<[number,number]>=[[sx,sz]],visited=new Set<string>([key(sx,sz)]);let cursor=0;
  while(cursor<queue.size()){const [x,z]=queue[cursor++];for(const [dx,dz]of [[128,0],[-128,0],[0,128],[0,-128]]){const k=key(x+dx,z+dz);if(cells.has(k)&&!visited.has(k)){visited.add(k);queue.push([x+dx,z+dz]);}}}
  expect(visited.size()).toBe(cells.size());
  expect(b.props.size()).toBe(0);
  for(let i=0;i<=1024;i++){const p=m13RoutePoint(i/1024);for(const dx of [-450,0,450]){expect(p.y-m13Ground(p.x+dx,p.z)).toBeGreaterThanOrEqual(100);expect(visited.has(key(math.floor((p.x+dx)/128)*128,math.floor(p.z/128)*128))).toBe(true);expect(obstructed(b.parts.filter(f=>f.name!=="m13_evidence_plane"),p.x+dx,p.y,p.z,30)).toBe(false);}}
  for(const p of [a,b]){expect(p.ops.some(o=>o.material==="Water")).toBe(false);expect(p.parts.some(f=>f.name==="Sea")).toBe(false);}
 });
 it("seals every column and shared edge down to Y=0 beyond hard airspace without a floor", () => {
  for (const [p, airspace] of [[a, M12_AIRSPACE], [b, M13_AIRSPACE]] as const) {
   testCheckpoint();
   expect(16384).toBeGreaterThan(airspace.hardHalfWidth);
   const caps = new Map<string, number>(), walls = new Map<string, TerrainOp[]>();
   for (const op of [...p.ops, ...p.parts.filter(f => f.name === "Sea").map(f => ({ ...f, shape: "block" as const, material: "Water" as const }))]) {
    testCheckpoint();
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
    testCheckpoint();
    const h = caps.get(`${x},${z}`); if (h === undefined) { gaps++; continue; }
    for (const [axis, edge, v, nx, nz] of [["x", x + 128, z, x + 128, z], ["z", z + 128, x, x, z + 128], ...(x === -16384 ? [["x", x, z, x - 128, z]] : []), ...(z === -16384 ? [["z", z, x, x, z - 128]] : [])] as Array<[string, number, number, number, number]>) {
     testCheckpoint();
     const n = caps.get(`${nx},${nz}`) ?? 0;
     if (n !== h && !(walls.get(`${axis},${edge},${v}`) ?? []).some(w => w.y - w.sy / 2 <= math.max(0, math.min(h, n) - 8) && w.y + w.sy / 2 >= math.max(h, n))) gaps++;
    }
   }
   expect(gaps).toBe(0);
  }
 });

 it("fits all dimension and chunk/yield budgets with one second headroom",()=>{
  for(const [p,c,l]of [[a,m12Counts(a),M12_BUILD_LIMITS],[b,m13Counts(b),M13_BUILD_LIMITS]]as const){print(`${p.key} BUDGET voxels=${c.voxels} jobs=${c.jobs} solidTouches=${c.solidTouches} waterTouches=${c.waterTouches} yields=${c.yields} parts=${c.parts} props=${c.props} descendants=${c.descendants} estimatedSeconds=${c.estimatedSeconds}`);for(const f of p.parts)for(const d of [f.sx,f.sy,f.sz]){expect(d).toBeGreaterThan(0);expect(d).toBeLessThanOrEqual(2048);}expect(c.voxels).toBeLessThanOrEqual(l.voxelWrites);expect(c.jobs).toBeLessThanOrEqual(l.jobs);expect(c.parts).toBeLessThanOrEqual(l.parts);expect(c.props).toBeLessThanOrEqual(l.props);expect(c.descendants).toBeLessThanOrEqual(l.descendants);expect(l.estimatedSeconds).toBeLessThanOrEqual(16);expect(c.estimatedSeconds).toBeLessThanOrEqual(l.estimatedSeconds-1);}
  expect(M12_ENVIRONMENT.clock).toBe(10+8/60);expect(M13_ENVIRONMENT.clock).toBe(11+5/60);expect(M13_ENVIRONMENT.sky).toBe("overcast");expect(M13_ENVIRONMENT.clouds.cover).toBe(1);expect(M12_ENVIRONMENT.weather).toBe("none");expect(M13_ENVIRONMENT.weather).toBe("none");
 });
});
