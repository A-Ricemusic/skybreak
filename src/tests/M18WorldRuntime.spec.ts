import { boundedWorldWork, cancelWorldWork } from "./BoundedWorldWork";
import { destroyWorld } from "../server/WorldDisposal";
import { beforeEach, afterAll, afterEach } from "@rbxts/jest-globals";
import { UploadedAssets } from "../shared/UploadedAssets";
import { fakeIds, fakeUpload, probe } from "./WorldBuildFixtures";
import { describe, expect, it } from "@rbxts/jest-globals";
import { M18World } from "../server/M18World";
import { M18_WORLD_KEY, m18TargetLayout } from "../shared/M18WorldPlan";
import { M18_TARGETS } from "../shared/missions/m18";

beforeEach(() => UploadedAssets.Configure({ ids: fakeIds(true), probe, loader: fakeUpload }));
afterAll(() => UploadedAssets.Configure());

describe("M18 built world contact ownership",()=>{
 let folder: Folder | undefined;
 afterEach(() => { cancelWorldWork(); boundedWorldWork("M18 cleanup", () => { destroyWorld(folder); M18World.Clear(() => false); }, 30); folder = undefined; }, 35000);
 it("builds no airborne scenery and adopts every ground contact",()=>{
  folder=new Instance("Folder");
  const [ok,failure]=pcall(()=>{
   const built=boundedWorldWork("M18 build", () => M18World.Build(folder!)),scene=folder!.FindFirstChild(M18_WORLD_KEY)!;
   for(const t of m18TargetLayout().filter(t=>t.group==="optional_missile"||t.group==="optional_air"))expect(scene.FindFirstChild(t.id)).toBeUndefined();
   expect(built.targetVisuals.size()).toBe(M18_TARGETS.size());
   for(const t of M18_TARGETS){
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
