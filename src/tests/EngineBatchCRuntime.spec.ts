import { describe, expect, it } from "@rbxts/jest-globals";
import { stepRearm, liveJammers, lockAllowed } from "../server/EngineBatchCRuntime";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { TargetScore } from "../shared/TargetScore";
import { FlightMath } from "../shared/FlightMath";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { buildNightLighting } from "../server/NightLighting";
describe("Batch C runtime paths (Studio lease required to execute)",()=>{
 it("pauses the main epoch, refills once, launches, and requires zone departure before another rearm",()=>{
  const plan={zone:{x:0,y:100,z:0},radius:2000,landing:{touchdown:{x:0,y:20,z:0},headingDegrees:0,approachDistance:2400,rolloutDistance:400,approachSeconds:30,rolloutSeconds:10,glideDegrees:3},takeoffSeconds:10,missiles:true,special:true,health:true};
  const bp={...MissionCatalog.Get(1),phases:[{kind:"score_threshold" as const,label:"Strike",scoreThreshold:{points:2000,seconds:600,waitForExpiry:true},rearm:plan}]};
  const state=BlueprintRunner.NewState(bp,os.clock());
  const s={active:true,blueprintState:state,state:FlightMath.FromPose(0,100,0,0,0,160),targetScore:new TargetScore(MissionCatalog.Scoring(1)),enemies:[],projectiles:[],special:SpecialWeapons.New("salvo"),missiles:0,health:10,stateSequence:1} as unknown as CombatSession;
  s.special.charges=0;const messages:defined[]=[];const epoch=state.startedAt;
  expect(stepRearm(s,25,52,m=>messages.push(m as defined))).toBe(true);expect(s.missiles).toBe(0);expect(state.startedAt).toBe(epoch);expect(state.rearmActive).toBe(true); BlueprintRunner.Tick(state,epoch+200);expect(state.elapsed).toBeLessThan(1);
  expect(stepRearm(s,25,52,m=>messages.push(m as defined))).toBe(true);expect(s.missiles).toBe(52);expect(s.health).toBe(100);expect(s.special.charges).toBe(3);expect(s.rearmElapsed).toBeUndefined();expect(messages.size()).toBe(2);expect(stepRearm(s,0.1,52,()=>{})).toBe(false);
 });
 it("counts only living enabled jammers and preserves unconfigured missions",()=>{
  const s={enemies:[{enabled:true,health:100,routeActor:{jammer:true}},{enabled:true,health:0,routeActor:{jammer:true}},{enabled:false,health:100,routeActor:{jammer:true}}]} as unknown as CombatSession;
  expect(liveJammers(s)).toBe(1);expect(lockAllowed(s,5000)).toBe(true);
 });
 it("builds ship target roots on authored water coordinates and bounded procedural night fields",()=>{
  const ship=createGroundTarget({id:"ship",type:"ship",position:{x:100,y:32,z:200},yaw:0,required:false,scoreRole:"ship"});expect(ship.PrimaryPart).toBeDefined();expect(ship.GetPivot().Position.X).toBe(100);ship.Destroy();
  const folder=new Instance("Folder");buildNightLighting(folder,{fields:[{origin:{x:0,y:10,z:0},rows:2,columns:2,spacing:20,realLights:1}],searchlights:[{position:{x:0,y:10,z:0},heading:0,sweep:30,period:8,length:400}]});expect(folder.GetChildren().size()).toBe(5);folder.Destroy();
 });
});
