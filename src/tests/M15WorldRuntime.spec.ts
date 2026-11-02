import { boundedWorldWork, cancelWorldWork } from "./BoundedWorldWork";
import { destroyWorld } from "../server/WorldDisposal";
import { beforeEach, afterAll } from "@rbxts/jest-globals";
import { UploadedAssets } from "../shared/UploadedAssets";
import { fakeIds, fakeUpload, probe } from "./WorldBuildFixtures";
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { M15World } from "../server/M15World";
import { M15_WORLD_KEY, m15TargetLayout } from "../shared/M15WorldPlan";
import { M15_TARGETS } from "../shared/missions/m15";

beforeEach(() => UploadedAssets.Configure({ ids: fakeIds(true), probe, loader: fakeUpload }));
afterAll(() => UploadedAssets.Configure());

describe("M15 built world contact ownership",()=>{
 let folder: Folder | undefined;
 afterEach(() => { cancelWorldWork(); boundedWorldWork("M15 cleanup", () => { destroyWorld(folder); M15World.Clear(() => false); }, 30); folder = undefined; }, 35000);
 it("builds no airborne scenery and adopts every ground contact",()=>{
  folder=new Instance("Folder");
  const [ok,failure]=pcall(()=>{
   const built=boundedWorldWork("M15 build", () => M15World.Build(folder!)),scene=folder!.FindFirstChild(M15_WORLD_KEY)!;
   for(const t of m15TargetLayout().filter(t=>t.group==="retaliation"||t.group==="optional_air"))expect(scene.FindFirstChild(t.id)).toBeUndefined();
   expect(built.targetVisuals.size()).toBe(M15_TARGETS.size());
   for(const t of M15_TARGETS){
    const model=built.targetVisuals.get(t.id)!;
    const adopted=scene.GetDescendants().filter(child=>child.IsA("Model")&&child.GetAttribute("TargetId")===t.id);
    expect(adopted.size()).toBe(1);
    expect(model).toBe(adopted[0]);
    expect(model.Parent).toBe(scene);
    expect(model.PrimaryPart?.Name).toBe("Aim");
    expect(model.GetDescendants().some(p=>p.IsA("BasePart"))).toBe(true);
   }
  });

  if(!ok)error(failure);
 },120000);
});
