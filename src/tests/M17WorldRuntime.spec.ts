import { describe, expect, it } from "@rbxts/jest-globals";
import { M17World } from "../server/M17World";
import { M17_WORLD_KEY, m17TargetLayout } from "../shared/M17WorldPlan";
import { M17_TARGETS } from "../shared/missions/m17";

describe("M17 built world contact ownership",()=>{
 it("builds no airborne scenery and adopts every ground contact",()=>{
  const folder=new Instance("Folder");
  const [ok,failure]=pcall(()=>{
   const built=M17World.Build(folder),scene=folder.FindFirstChild(M17_WORLD_KEY)!;
   for(const t of m17TargetLayout().filter(t=>t.group==="elite"||t.group==="optional_air"))expect(scene.FindFirstChild(t.id)).toBeUndefined();
   expect(built.targetVisuals.size()).toBe(M17_TARGETS.size());
   for(const t of M17_TARGETS){
    const model=built.targetVisuals.get(t.id)!;
    const adopted=scene.GetDescendants().filter(child=>child.IsA("Model")&&child.GetAttribute("TargetId")===t.id);
    expect(adopted.size()).toBe(1);
    expect(model).toBe(adopted[0]);
    expect(model.Parent).toBe(scene);
    expect(model.PrimaryPart?.Name).toBe("Aim");
    expect(model.GetDescendants().some(p=>p.IsA("BasePart"))).toBe(true);
   }
  });
  folder.Destroy();M17World.Clear(()=>false);
  if(!ok)error(failure);
 },120000);
});
