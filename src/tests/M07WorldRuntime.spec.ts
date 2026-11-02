import { boundedWorldWork, cancelWorldWork } from "./BoundedWorldWork";
import { destroyWorld } from "../server/WorldDisposal";
import { beforeEach, afterAll } from "@rbxts/jest-globals";
import { UploadedAssets } from "../shared/UploadedAssets";
import { fakeIds, fakeUpload, probe } from "./WorldBuildFixtures";
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { M07World } from "../server/M07World";
import { AircraftCollision } from "../server/AircraftCollision";
import { auditCanyon, stepCanyon } from "../server/ArtilleryRuntime";
import { artilleryMasked, artilleryExposed } from "../shared/ArtilleryRules";
import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import type { CombatSession } from "../server/CombatSession";

beforeEach(() => UploadedAssets.Configure({ ids: fakeIds(true), probe, loader: fakeUpload }));
afterAll(() => UploadedAssets.Configure());

describe("M07 built-world D-242 first-step audit", () => {
 let folder: Folder | undefined;
 afterEach(() => { cancelWorldWork();
  boundedWorldWork("M07 cleanup", () => { destroyWorld(folder); M07World.Clear(() => false); }, 30);
  folder = undefined;
 }, 35000);
 it("accepts the real composition and initializes artillery on the first escape step", () => {
  folder=new Instance("Folder"); folder.Name="M07AuditFixture"; folder.Parent=Workspace;
  boundedWorldWork("M07 build", () => { M07World.Clear(() => false); return M07World.Build(folder!); });
  const params=AircraftCollision.Parameters(folder), bp=MissionCatalog.Get(7), plan=bp.phases[1].canyonEscape!;
  expect(auditCanyon(plan,params)).toBe(true);
  const state=BlueprintRunner.NewState(bp,0); state.phaseIndex=1;
  // stepCanyon reads only these session fields before the first impact.
  const session={blueprintState:state,collisionParams:params} as CombatSession;
  const warnings: string[]=[];
  stepCanyon(session,1/30,line=>warnings.push(line));
  expect(session.crashReason).toBeUndefined(); expect(session.artillery?.phase).toBe(1); expect(warnings.size()).toBe(1);
  // Real masking at the ingress basin and exit, not just abstract height samples.
  for(const point of [plan.channel[1],plan.channel[plan.channel.size()-1]]) {
   const masked=artilleryMasked(plan,point,(a,d)=>Workspace.Raycast(new Vector3(a.x,a.y,a.z),new Vector3(d.x,d.y,d.z),params)?.Distance);
   expect(masked).toBe(true); expect(artilleryExposed(plan,point.y,masked)).toBe(false);
  }
  const blocker=new Instance("Part"); blocker.Anchored=true; blocker.Size=new Vector3(100,100,100);
  const entry=plan.channel[0]; blocker.Position=new Vector3(entry.x,entry.y,entry.z); blocker.Parent=folder; blocker.SetAttribute("FlightSolid",true);
  const blocked={blueprintState:state,collisionParams:AircraftCollision.Parameters(folder)} as CombatSession;
  stepCanyon(blocked,1/30,()=>undefined);
  expect(blocked.crashReason).toBe("internal_error"); expect(blocked.artillery).toBeUndefined();
 },120000);
 it("detects cover near the aircraft on an actual 25,000-stud ray", () => {
  folder=new Instance("Folder"); folder.Parent=Workspace;
  const cover=new Instance("Part"); cover.Anchored=true; cover.Size=new Vector3(100,100,10);
  cover.Position=new Vector3(0,10000,24950); cover.Parent=folder;
  const params=new RaycastParams(); params.FilterType=Enum.RaycastFilterType.Include; params.FilterDescendantsInstances=[folder];
  const plan={...MissionCatalog.Get(7).phases[1].canyonEscape!,source:{x:0,y:10000,z:0}};
  expect(artilleryMasked(plan,{x:0,y:10000,z:25000},(a,d)=>Workspace.Raycast(new Vector3(a.x,a.y,a.z),new Vector3(d.x,d.y,d.z),params)?.Distance)).toBe(true);
 });
});
