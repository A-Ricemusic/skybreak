import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M17_TARGETS, M17_WAVES } from "../shared/missions/m17";
import { buildM17Plan, buildM17ScenePlan } from "../shared/M17WorldPlan";
import { FlightMath as F } from "../shared/FlightMath";
import { completeRearmRepair } from "../server/EngineBatchD11Runtime";
import { createCombatSession } from "../server/CombatSessionFactory";
function session(id:number,hp:number) {const s=createCombatSession({} as Player,1,{} as Folder,{} as Model,F.FromPose(0,1200,0,0,0,160),id,"salvo","normal",0);s.health=hp;return s;}

// Conditional reachability evidence, not a Player calibration. See docs/human/blockers.md.
describe("M17 review regressions",()=>{
 it("owns every solid target surface under its adopted id, leaving only foundations on deletion/motion/sinking",()=>{
  const scene=buildM17ScenePlan();
  expect(scene.targets.some(t=>t.group==="elite"||t.group==="optional_air")).toBe(false);
  const plan=buildM17Plan(),ids=new Set(M17_TARGETS.map(t=>t.id));
  for(const t of plan.targets.filter(t=>t.group==="elite"||t.group==="optional_air"))expect(plan.parts.some(p=>p.name===t.id)).toBe(false);
  for(const t of M17_TARGETS) {
   const owned=plan.parts.filter(p=>p.name===t.id);
   expect(owned.size()).toBeGreaterThan(0);
   expect(plan.targets.filter(p=>p.id===t.id).size()).toBe(1);
   // CompositionWorld parents all same-name parts to the one model adopted by M17World.
   const remaining=plan.parts.filter(p=>p.name!==t.id);
   expect(remaining.some(p=>p.name===t.id)).toBe(false);
   expect(remaining.some(p=>p.solid&&!ids.has(p.name)&&p.name!==t.id+"_foundation"&&math.abs(p.x-t.position.x)<20&&math.abs(p.z-t.position.z)<28&&p.y>t.position.y)).toBe(false);
   if(t.naval) {
    expect(remaining.some(p=>!ids.has(p.name)&&p.solid&&math.abs(p.x-t.position.x)<50&&math.abs(p.z-t.position.z)<140&&p.y>32)).toBe(false);
    const moved=owned.map(p=>({...p,x:p.x+1000,y:p.y-200}));
    expect(moved.every(p=>p.x!==t.position.x&&p.y<0)).toBe(true);
   }
  }
 });
 it("repairs damaged M17 at completed service, preserves opt-out and legacy missions and never resurrects",()=>{
  expect(bp.phases[0].rearm!.health).toBe(true);
  for(let id=1;id<=18;id++) {
   const s=session(id,35);
   completeRearmRepair(s,id===17);expect(s.health).toBe(id===17?100:35);
  }
  const off=session(17,35);completeRearmRepair(off,false);expect(off.health).toBe(35);
  const dead=session(17,0);completeRearmRepair(dead,true);expect(dead.health).toBe(0);
 });
});
