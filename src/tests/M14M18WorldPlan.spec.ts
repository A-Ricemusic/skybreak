import { describe,expect,it } from "@rbxts/jest-globals";
import { buildM14Plan,m14Counts,m14Ground,M14,M14_ENVIRONMENT,m14Routes } from "../shared/M14WorldPlan";
import { buildM15Plan,m15Counts,m15Ground,M15,m15BomberRoutes } from "../shared/M15WorldPlan";
import { buildM16Plan,m16Counts,m16Ground,M16 } from "../shared/M16WorldPlan";
import { buildM17Plan,m17Counts,m17Ground,M17,M17_ENVIRONMENT } from "../shared/M17WorldPlan";
import { buildM18Plan,m18Counts,m18Ground,M18,m18VentRoute } from "../shared/M18WorldPlan";
import { M14_BUILD_LIMITS } from "../shared/M14Limits";
import { M15_BUILD_LIMITS } from "../shared/M15Limits";
import { M16_BUILD_LIMITS } from "../shared/M16Limits";
import { M17_BUILD_LIMITS } from "../shared/M17Limits";
import { M18_BUILD_LIMITS } from "../shared/M18Limits";
import { MissionCatalog } from "../shared/MissionCatalog";
import type { PartSpec,TerrainOp } from "../shared/WorldPlan";
// Swept AABB intersection, including segment endpoints; diagonal exits cannot skip a beam.
function hit(ps:PartSpec[],a:{x:number;y:number;z:number},b:typeof a,r=24):boolean{
 return ps.some(p=>{
  if(!p.solid)return false;
  let lo=0,hi=1;
  for(const axis of ["x","y","z"] as const){
   const size=axis==="x"?p.sx:axis==="y"?p.sy:p.sz,d=b[axis]-a[axis],mn=p[axis]-size/2-r,mx=p[axis]+size/2+r;
   if(math.abs(d)<1e-9){if(a[axis]<mn||a[axis]>mx)return false;}else{
    const t1=(mn-a[axis])/d,t2=(mx-a[axis])/d;lo=math.max(lo,math.min(t1,t2));hi=math.min(hi,math.max(t1,t2));if(lo>hi)return false;
   }
  }
  return true;
 });
}
describe("Dormant M14–M18 procedural worlds",()=>{
 const a=buildM14Plan(),b=buildM15Plan(),c=buildM16Plan(),d=buildM17Plan(),e=buildM18Plan();
 const worlds=[a,b,c,d,e],grounds=[m14Ground,m15Ground,m16Ground,m17Ground,m18Ground];
 it("exports deterministic id-owned scenery without changing catalog selection",()=>{
  for(const [i,build]of [buildM14Plan,buildM15Plan,buildM16Plan,buildM17Plan,buildM18Plan].map((build,i)=>[i,build] as const)){
   let calls=0;expect(build(undefined,()=>{calls++;})).toEqual(worlds[i]);expect(calls).toBeGreaterThan(1000);
   const p=worlds[i];expect(p.props.size()).toBe(0);expect(new Set(p.targets.map(t=>t.id)).size()).toBe(p.targets.size());
   for(const t of p.targets){expect(t.id.sub(1,4)).toBe("m"+(14+i)+"_");expect(p.parts.some(f=>f.name===t.id)).toBe(!((i===3&&(t.group==="elite"||t.group==="optional_air")) || (i===4&&(t.group==="optional_air"||t.group==="optional_missile"))));}
   for(const m of MissionCatalog.All().filter(m=>m.id!==14 && m.id!==15 && m.id!==16 && m.id!==17 && m.id!==18))expect(MissionCatalog.WorldKey(m.id)).never.toBe(p.key);
  }
 });
 it("retains inventories, stages and proposed anchors separately from credited kills",()=>{
  expect(a.targets.filter(t=>t.type==="cruise_slot").size()).toBe(15);expect(a.targets.filter(t=>t.type==="high_value_cruise").size()).toBe(1);
  expect(M14_ENVIRONMENT.sky).toBe("night");expect(M14_ENVIRONMENT.clouds.cover).toBe(0.1);expect(M14.cloudType).toBe("cirrus");expect(M14_ENVIRONMENT.weather).toBe("aurora");
  expect(b.targets.filter(t=>t.group==="city").size()).toBe(62);expect(M15.creditedGround).toBe(53);
  expect(b.targets.filter(t=>t.type==="parked_transport").size()).toBe(7);expect(m15BomberRoutes().size()).toBe(6);
  expect(b.targets[0]).toEqual({id:"m15_command_relay",type:"command_relay",group:"city",x:2880,y:92,z:-4800,yaw:0});
  expect(c.targets.filter(t=>t.type==="unresolved_ground").size()).toBe(138);expect(c.targets.filter(t=>t.group==="air_cover").size()).toBe(14);expect(M16.initial).toEqual({ground:113,air:13});
  expect(d.targets.filter(t=>t.group==="capital"||t.group==="naval_mount").size()).toBe(55);expect(d.targets.filter(t=>t.group==="naval").size()).toBe(4);expect(d.targets.filter(t=>t.type==="elite_wingman").size()).toBe(4);expect(d.targets.filter(t=>t.type==="rusk_retreat").size()).toBe(1);
  for(const p of [b,d])for(const t of p.targets.filter(t=>t.group==="city"||t.group==="capital"))for(const f of p.parts.filter(f=>f.name.find("m15_block_")[0]!==undefined||f.name.find("m17_city_")[0]!==undefined)){
   expect(math.abs(t.x-f.x)>=f.sx/2+48||math.abs(t.z-f.z)>=f.sz/2+48).toBe(true);
  }
  expect(M17.exit.x).toBe(-13440);expect(e.targets.filter(t=>t.type==="generator").size()).toBe(3);expect(e.targets.filter(t=>t.type==="core").size()).toBe(1);
 });
 it("supports complete foundation footprints and keeps both runway approaches clear",()=>{
  for(const [i,p]of worlds.map((p,i)=>[i,p] as const))for(const f of p.parts.filter(f=>f.name.find("foundation")[0]!==undefined)){
   for(const dx of [-f.sx/2+1,0,f.sx/2-1])for(const dz of [-f.sz/2+1,0,f.sz/2-1]){
    const g=grounds[i](f.x+dx,f.z+dz);expect(f.y+f.sy/2-g).toBeGreaterThanOrEqual(8);expect(f.y-f.sy/2).toBeLessThanOrEqual(g);
   }
  }
  for(const [p,g,s]of [[b,m15Ground,M15.service],[c,m16Ground,M16.service]]as const){
   for(let z=s.z-s.length/2-s.approachLength;z<=s.z+s.length/2+s.approachLength;z+=32)
    for(const dx of [-164,0,164]){const q={x:s.x+dx,y:s.y+40,z};expect(g(q.x,q.z)).toBeLessThan(s.y);expect(hit(p.parts,q,q,16)).toBe(false);}
  }
 });
 it("grounds M18 structural decks, walls, targets and buttresses across their full footprints",()=>{
  // Explicit structural roles: this does not depend on a 'foundation' name being present.
  const floors=e.parts.filter(f=>f.name==="m18_groove_floor"||f.name==="m18_vent_floor");
  expect(floors.size()).toBe(13);
  for(const f of floors){
   expect(f.y+f.sy/2).toBe(M18.floor);
   for(let dx=-f.sx/2+1;dx<f.sx/2;dx+=32)for(let dz=-f.sz/2+1;dz<f.sz/2;dz+=32){
    const g=m18Ground(f.x+dx,f.z+dz);expect(f.y-f.sy/2).toBeLessThanOrEqual(g);expect(f.y+f.sy/2-g).toBeGreaterThanOrEqual(8);
   }
  }
  const supported=(f:PartSpec)=>{
   for(const dx of [-f.sx/2+1,0,f.sx/2-1])for(const dz of [-f.sz/2+1,0,f.sz/2-1]){
    const x=f.x+dx,z=f.z+dz,bottom=f.y-f.sy/2;
    if(bottom<=m18Ground(x,z))continue;
    if(!floors.some(p=>math.abs(x-p.x)<=p.sx/2&&math.abs(z-p.z)<=p.sz/2&&p.y+p.sy/2>=bottom))return false;
   }
   return true;
  };
  const structures=e.parts.filter(f=>f.name==="m18_groove_wall"||f.name==="m18_vent_wall"||f.name==="m18_buttress"||f.name.find("m18_generator_")[0]!==undefined||f.name==="m18_core");
  expect(structures.size()).toBe(40);
  for(const f of structures)expect(supported(f)).toBe(true);
  // Original thin/floating floors must fail this check even when they are not named 'foundation'.
  expect(96-16/2>m18Ground(0,-500)).toBe(true);
  expect(96-16/2>m18Ground(0,-6800)).toBe(true);
  expect(M17_ENVIRONMENT.clock).toBe(18+20/60);expect(M17.cloudFeet).toBe(12000);
 });
 it("clears missile lanes, bomber ingress, Rusk retreat and player starts",()=>{
  for(const r of m14Routes())expect(hit(a.parts.filter(p=>p.name.find("m14_cruise")[0]===undefined),r.points[0],r.points[1],40)).toBe(false);
  for(const r of m15BomberRoutes())expect(hit(b.parts.filter(p=>p.name!==r.id),r.points[0],r.points[1],40)).toBe(false);
  expect(hit(d.parts.filter(p=>p.name.find("m17_rusk")[0]===undefined),M17.elite,M17.exit,100)).toBe(false);
  for(const [i,s]of [M14.start,M15.start,M16.start,M17.start,M18.start].map((s,i)=>[i,s] as const)){
   expect(grounds[i](s.x,s.z)).toBeLessThan(s.y-100);expect(hit(worlds[i].parts,s,s,60)).toBe(false);
  }
 });
 it("flies all three covered grooves, central vent descent/run/escape, and the original open duel arena",()=>{
  // The target is a shot endpoint, never an aircraft checkpoint through a solid generator.
  for(const x of M18.grooves){const start={x,y:174,z:300},finish={x,y:174,z:-2750};
   expect(hit(e.parts,start,finish,40)).toBe(false);
   for(let z=300;z>=-2750;z-=16)expect(m18Ground(x,z)+40).toBeLessThan(174);
  }
  const route=m18VentRoute();
  for(let i=1;i<route.size();i++){
   expect(hit(e.parts,route[i-1],route[i],24)).toBe(false);
   for(let j=0;j<=256;j++){const t=j/256,u=route[i-1],v=route[i],x=u.x+(v.x-u.x)*t,y=u.y+(v.y-u.y)*t,z=u.z+(v.z-u.z)*t;expect(m18Ground(x,z)+24).toBeLessThan(y);}
  }
  // Negative control proves the swept test sees a beam between clear endpoints.
  expect(hit([{...e.parts[0],solid:true,x:0,y:174,z:-5000,sx:400,sy:20,sz:20}],{x:0,y:174,z:-4500},{x:0,y:174,z:-5500})).toBe(true);
  const ar=M18.duel;expect(ar.radius).toBe(5760);expect(ar.minY).toBe(800);expect(ar.maxY).toBe(2400);
  for(let x=-ar.radius;x<=ar.radius;x+=256)for(let z=ar.z-ar.radius;z<=ar.z+ar.radius;z+=256){
   if(x*x+(z-ar.z)*(z-ar.z)>ar.radius*ar.radius)continue;
   expect(m18Ground(x,z)).toBeLessThan(ar.minY-100);expect(hit(e.parts,{x,y:ar.minY,z},{x,y:ar.maxY,z},100)).toBe(false);
   expect(math.abs(x)+100).toBeLessThan(15360);expect(math.abs(z)+100).toBeLessThan(15360);
  }
 });
 it("seals every column and shared edge down to Y=0 beyond hard airspace without a floor", () => {
  for (const p of worlds) {
   expect(16384).toBeGreaterThan(15360);
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
 it("connects every emitted water cell; sea uses water only, with no solid sea bed",()=>{
  for(const p of [a,b,d,e]){
   const wet=new Set<string>(),key=(x:number,z:number)=>`${x},${z}`;
   // One node per coarse cell (all late-world surfaces intentionally use 1024).
   for(const f of p.parts.filter(f=>f.name==="Sea"))for(let x=f.x-f.sx/2;x<f.x+f.sx/2;x+=1024)for(let z=f.z-f.sz/2;z<f.z+f.sz/2;z+=1024)wet.add(key(x,z));
   expect(wet.size()).toBeGreaterThan(0);
   const queue:Array<[number,number]>=[[-16384,-16384]],visited=new Set<string>([key(-16384,-16384)]);let cursor=0;
   // M15's river touches only north/south world edge, not the west corner.
   if(p.key===b.key){queue[0]=[1024,-16384];visited.clear();visited.add(key(1024,-16384));}
   while(cursor<queue.size()){const [x,z]=queue[cursor++];for(const [dx,dz]of [[1024,0],[-1024,0],[0,1024],[0,-1024]]){const k=key(x+dx,z+dz);if(wet.has(k)&&!visited.has(k)){visited.add(k);queue.push([x+dx,z+dz]);}}}
   expect(visited.size()).toBe(wet.size());
   for(const o of p.ops)if(o.sx>=128&&o.sz>=128){expect(o.material).never.toBe("Water");expect(wet.has(key(math.floor(o.x/1024)*1024,math.floor(o.z/1024)*1024))).toBe(false);}
  }
 });
 it("fits dimensions, phone instance allowances and modeled build time with >=1 second headroom",()=>{
  for(const [p,count,l]of [[a,m14Counts(a),M14_BUILD_LIMITS],[b,m15Counts(b),M15_BUILD_LIMITS],[c,m16Counts(c),M16_BUILD_LIMITS],[d,m17Counts(d),M17_BUILD_LIMITS],[e,m18Counts(e),M18_BUILD_LIMITS]]as const){
   print(`${p.key} BUDGET voxels=${count.voxels} jobs=${count.jobs} solidTouches=${count.solidTouches} waterTouches=${count.waterTouches} yields=${count.yields} parts=${count.parts} props=${count.props} descendants=${count.descendants} estimatedSeconds=${count.estimatedSeconds}`);
   for(const f of p.parts)for(const n of [f.sx,f.sy,f.sz]){expect(n).toBeGreaterThan(0);expect(n).toBeLessThanOrEqual(2048);}
   expect(count.voxels).toBeLessThanOrEqual(l.voxelWrites);expect(count.jobs).toBeLessThanOrEqual(l.jobs);expect(count.parts).toBeLessThanOrEqual(l.parts);expect(count.descendants).toBeLessThanOrEqual(l.descendants);
   expect(count.estimatedSeconds).toBeLessThanOrEqual(l.estimatedSeconds-1);
   // Model wrappers + Parts + root folder; no lights, per-window instances or uploads.
   expect(p.parts.size()+p.targets.size()+1).toBeLessThan(count.descendants);
  }
 });
});
