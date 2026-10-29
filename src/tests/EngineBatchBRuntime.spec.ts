import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { sampleClearance, stepLanding } from "../server/EngineBatchBRuntime";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { LandingPlan } from "../shared/EngineBatchB";

// Studio-only paths: real query filtering and the server's fixed-step cinematic adapter.
describe("Engine batch B runtime adapters (Studio)",()=>{
 it("queries flight-solid scenery, throttles and leaves the legacy mission unprobed",()=>{
  const surface=new Instance("Part");surface.Anchored=true;surface.CanCollide=false;surface.Size=new Vector3(100,10,100);surface.Position=new Vector3(0,800,0);surface.Parent=Workspace;
  const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[surface];params.RespectCanCollide=false;
  const state=FlightMath.FromPose(0,850,0,0,0,160);
  const session={state,collisionParams:params,blueprint:{...MissionCatalog.Get(1),terrainRelativeWarnings:true}} as CombatSession;
  const [ok,message]=pcall(()=>{
   expect(sampleClearance(session,0)).toBe(45);surface.Position=new Vector3(0,700,0);
   expect(sampleClearance(session,0.05)).toBe(45);expect(sampleClearance(session,0.11)).toBe(145);
   session.blueprint!.terrainRelativeWarnings=undefined;expect(sampleClearance(session,1)).toBeUndefined();
  });surface.Destroy();assert(ok,tostring(message));
 });
 it("takes over once and ends successfully without advancing combat elapsed time",()=>{
  const plan: LandingPlan={touchdown:{x:6000,y:90,z:12000},headingDegrees:0,approachDistance:2400,rolloutDistance:400,approachSeconds:30,rolloutSeconds:10,glideDegrees:3};
  const bp={...MissionCatalog.Get(1),phases:[{kind:"landing" as const,label:"Landing",landing:plan}]};
  const bs=BlueprintRunner.NewState(bp,0);bs.elapsed=123;
  const session={state:FlightMath.NewState(),blueprintState:bs} as CombatSession;
  const messages: string[]=[];
  expect(stepLanding(session,20,m=>messages.push(tostring(m)))).toBe(true);expect(session.state.y).toBeGreaterThan(90);
  expect(stepLanding(session,20,m=>messages.push(tostring(m)))).toBe(true);expect(bs.outcome).toBe("won");expect(bs.elapsed).toBe(123);expect(messages.size()).toBe(1);
 });
});
