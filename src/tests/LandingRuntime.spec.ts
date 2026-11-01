import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { sampleClearance, skipLanding, stepLanding } from "../server/LandingRuntime";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { LandingPlan } from "../shared/LandingRules";

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
 it("says each tower cue once on the fixed step and skips to the runway hold, telling the client where",()=>{
  const plan: LandingPlan={touchdown:{x:6000,y:94,z:11896},headingDegrees:0,approachDistance:2100,rolloutDistance:612.5,approachSeconds:24,rolloutSeconds:14,glideDegrees:3,
   countdownSeconds:180,accomplishedSeconds:4,radio:[{at:0.5,text:"one"},{at:7,text:"two"},{at:20,text:"skipped"},{at:34.5,text:"three"}]};
  const bp={...MissionCatalog.Get(1),phases:[{kind:"landing" as const,label:"Landing",landing:plan}]};
  const bs=BlueprintRunner.NewState(bp,0);
  const session={state:FlightMath.NewState(),blueprintState:bs} as CombatSession;
  const said: string[]=[],sent: defined[]=[];
  for(let i=0;i<300;i++) stepLanding(session,1/30,m=>sent.push(m as defined),l=>said.push(l));
  expect(said).toEqual(["one","two"]);expect(BlueprintRunner.TimeRemaining(bs)).toBeCloseTo(170);
  skipLanding(session,m=>sent.push(m as defined));
  expect(bs.outcome).toBeUndefined();expect(bs.landingElapsed).toBe(34);
  expect((sent[sent.size()-1] as {kind:string;elapsed:number}).kind).toBe("LandingSkipped");expect((sent[sent.size()-1] as {elapsed:number}).elapsed).toBe(34);
  // The skipped cue stays silent; the hold's own cue plays, then the sortie ends after four seconds.
  for(let i=0;i<119;i++) stepLanding(session,1/30,m=>sent.push(m as defined),l=>said.push(l));
  expect(bs.outcome).toBeUndefined();expect(said).toEqual(["one","two","three"]);
  stepLanding(session,1/30,m=>sent.push(m as defined),l=>said.push(l));stepLanding(session,1/30,m=>sent.push(m as defined),l=>said.push(l));
  expect(bs.outcome).toBe("won");
 });
});
