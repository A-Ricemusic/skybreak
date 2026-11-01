import { describe, expect, it } from "@rbxts/jest-globals";
import { boundDuelPosition, projectileContact, ventObstructed } from "../shared/FinaleDuelRules";
describe("D13 combat geometry",()=>{
 it("preserves the vent exit and projects radial and altitude edges",()=>{
  const arena={center:{x:0,y:1000,z:-2880},radius:5760,minY:800,maxY:2400};
  expect(boundDuelPosition({x:0,y:1800,z:-7000},arena)).toEqual({x:0,y:1800,z:-7000});
  for(const p of [{x:8000,y:3000,z:-2880},{x:-8000,y:100,z:-2880},{x:0,y:100,z:-10000}]) {
   const b=boundDuelPosition(p,arena);expect(b.x*b.x+(b.z+2880)*(b.z+2880)).toBeLessThanOrEqual(5760*5760+0.01);
   expect(b.y).toBeGreaterThanOrEqual(800);expect(b.y).toBeLessThanOrEqual(2400);
  }
 });
 it("sweeps the entire movement including the final two studs and segments long casts",()=>{
  let casts=0;
  expect(ventObstructed({x:0,y:0,z:0},{x:0,y:0,z:32001},(o,d)=>{
   casts++;expect(d.z).toBeLessThanOrEqual(15000);
   return o.z+d.z>=32000.5 ? 0.5 : undefined;
  },0)).toBe(true);expect(casts).toBe(33);
 });
 it("checks the projectile path rather than the covered player's sightline",()=>{
  const a={x:0,y:0,z:120},b={x:0,y:0,z:-120},target={x:0,y:0,z:0};
  const contact=projectileContact(a,b,target);
  const wall=(z:number)=>(o:typeof a,d:typeof a)=>o.z>=z && o.z+d.z<=z ? o.z-z : undefined;
  expect(ventObstructed(a,contact,wall(60),0)).toBe(true);
  expect(ventObstructed(a,contact,wall(-60),0)).toBe(false);
  expect(contact).toEqual(target);
 });
});
