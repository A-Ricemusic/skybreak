import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { AlliedRules } from "../shared/AlliedRules";
import { stepRearm, skipRearm } from "../server/RearmRuntime";
import { landingPose } from "../shared/LandingRules";
import { RearmPlan } from "../shared/RearmRules";
import { FlightMath } from "../shared/FlightMath";
import { SortieArmament } from "../shared/SortieArmament";
import { TargetScore } from "../shared/TargetScore";
import { PauseRules } from "../shared/SessionGuard";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { clearGroundDirector, stepBeachAttacker, stepGroundDirector } from "../server/GroundSectorRuntime";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { GroundProgressPlan } from "../shared/GroundSectorRules";
import { sessionFixture } from "./SessionFixture";
function fixture() {
 const folder=new Instance("Folder"); folder.Parent=Workspace;
 const scenery=new Instance("Folder"); scenery.Parent=folder;
 const params=new RaycastParams(); params.FilterType=Enum.RaycastFilterType.Include; params.FilterDescendantsInstances=[scenery];
 const plan: GroundProgressPlan={sectors:[{id:"beach",kind:"landing_craft",clearTargetIds:["gun"],seconds:10,health:20,route:{speed:10,waypoints:[{x:0,y:40,z:0},{x:0,y:40,z:-100}]},advanceCall:"Advance",securedCall:"Secured",hitCall:"Beach hit"}]};
 const bs=BlueprintRunner.NewState({...engineRuntimeFixture(),phases:[{kind:"score_threshold",label:"Beach",scoreThreshold:{points:100,seconds:100,waitForExpiry:true},groundProgress:plan}]},0);
 const session=sessionFixture(bs.blueprint,{folder}); session.blueprintState=bs; session.collisionParams=params; session.airspace={...session.airspace,spawnLimit:3000};
 const model=new Instance("Model"); model.Parent=folder;
 const enemy={model,phaseOwner:0,attackSector:"beach",position:new Vector3(0,280,300),direction:new Vector3(0,0,-1),fireTimer:0,windup:0} as Enemy;
 return {folder,scenery,session,enemy,bs};
}
describe("D5 server director and beach attacker",()=>{
 it("reuses carrier service pause/skip, finite ammo refill and leave-zone latch without repairing damage",()=>{
  const plan: RearmPlan={zone:{x:0,y:150,z:1150},radius:1500,landing:{touchdown:{x:0,y:100,z:150},headingDegrees:0,approachDistance:1000,rolloutDistance:50,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:false,carrier:{centre:{x:0,y:100,z:0},width:150,length:560,catapult:{x:0,y:100,z:-240}}};
  const bp={...engineRuntimeFixture(),armament:{stock:{missiles:40,specialCharges:5},gun:{rounds:200}},phases:[{kind:"score_threshold" as const,label:"Beach",scoreThreshold:{points:1000,seconds:600,waitForExpiry:true},rearm:plan}]};
  const bs=BlueprintRunner.NewState(bp,os.clock());
  const s=sessionFixture(bp,{state:landingPose(plan.landing,0)}); s.blueprintState=bs; s.missiles=0; s.health=25;
  s.special.charges=0; s.gun!.rounds=0;
  expect(stepRearm(s,1,40,()=>{})).toBe(true); expect(bs.rearmActive).toBe(true);
  PauseRules.Pause(s.pause,os.clock()); stepRearm(s,30,40,()=>{}); expect(s.rearmElapsed).toBe(1); PauseRules.Resume(s.pause,os.clock());
  skipRearm(s,plan,()=>{}); expect(s.rearmElapsed).toBe(13); expect(s.missiles).toBe(0);
  skipRearm(s,plan,()=>{}); stepRearm(s,0.1,40,()=>{});
  expect(s.missiles).toBe(40); expect(s.special.charges).toBe(5); expect(s.gun!.rounds).toBe(200); expect(s.health).toBe(25); expect(bs.rearmActive).toBeUndefined();
  s.state=landingPose(plan.landing,0); expect(stepRearm(s,1,40,()=>{})).toBe(false);
  s.state=FlightMath.FromPose(0,300,4000,0,0,160); stepRearm(s,1,40,()=>{}); s.state=landingPose(plan.landing,0); expect(stepRearm(s,1,40,()=>{})).toBe(true);
 });
 it("allows carrier entry during sector and protected-aircraft windups while player threats still block service",()=>{
  const f=fixture(); try {
   const plan: RearmPlan={zone:{x:0,y:150,z:1150},radius:1500,landing:{touchdown:{x:0,y:100,z:150},headingDegrees:0,approachDistance:1000,rolloutDistance:50,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:false,carrier:{centre:{x:0,y:100,z:0},width:150,length:560,catapult:{x:0,y:100,z:-240}}};
   const bp={...f.bs.blueprint,phases:[{...f.bs.blueprint.phases[0],rearm:plan}]};
   const s=f.session; s.blueprint=bp; s.blueprintState=BlueprintRunner.NewState(bp,os.clock());
   s.state=landingPose(plan.landing,0); s.health=25; s.targetScore=new TargetScore(MissionCatalog.Scoring(engineRuntimeFixture())); s.projectiles=[]; s.special=SortieArmament.NewSpecial("salvo",undefined);
   f.enemy.enabled=true; f.enemy.health=100; s.enemies=[f.enemy];
   stepGroundDirector(s,0.01,()=>{}); stepBeachAttacker(s,f.enemy,0.01,()=>{});
   expect(f.enemy.windup).toBe(2); expect(f.enemy.model.GetAttribute("AttackWarning")).toBe(true);
   expect(AlliedRules.WarnsPlayer(f.enemy.windupTarget,f.enemy.attackSector)).toBe(false);
   // The same live windup, owned by the player instead, must retain both legacy threat effects.
   const player={...f.enemy,attackSector:undefined,windupTarget:undefined}; s.enemies.push(player);
   expect(AlliedRules.WarnsPlayer(player.windupTarget,player.attackSector)).toBe(true);
   expect(stepRearm(s,0.1,40,()=>{})).toBe(false); expect(s.rearmElapsed).toBeUndefined();
   const protectedAircraft={...f.enemy,id:"protected-high",friendly:true};
   const protectedAttacker={...f.enemy,attackSector:undefined,windupTarget:protectedAircraft};
   expect(AlliedRules.WarnsPlayer(protectedAttacker.windupTarget,protectedAttacker.attackSector)).toBe(false);
   s.enemies=[f.enemy,protectedAttacker];
   s.projectiles=[{hostile:true,wingman:protectedAircraft} as CombatSession["projectiles"][number],{hostile:true} as CombatSession["projectiles"][number]];
   expect(stepRearm(s,0.1,40,()=>{})).toBe(false);
   s.projectiles=[{hostile:true,wingman:protectedAircraft} as CombatSession["projectiles"][number]];
   const messages:{kind:string}[]=[];
   expect(stepRearm(s,0.1,40,m=>messages.push(m as {kind:string}))).toBe(true);
   expect(messages[0].kind).toBe("RearmStarted"); expect(s.blueprintState.rearmActive).toBe(true); expect(f.enemy.windup).toBe(2);
  } finally { f.folder.Destroy(); }
 });
 it("creates friendly non-target actors after loading, progresses only on cleared targets and cleans on transition",()=>{
  const f=fixture(); try {
   f.session.loading={} as CombatSession["loading"]; stepGroundDirector(f.session,1,()=>{}); expect(f.session.groundDirector).toBeUndefined();
   f.session.loading=undefined; const lines:string[]=[];
   stepGroundDirector(f.session,1,line=>lines.push(line)); const runtime=f.session.groundDirector!;
   expect(runtime.actors[0].Position.Z).toBe(0); expect(runtime.actors[0].CanQuery).toBe(false); expect(runtime.actors[0].GetAttribute("Friendly")).toBe(true);
   f.bs.killedIds.add("gun"); stepGroundDirector(f.session,5,line=>lines.push(line)); expect(runtime.actors[0].Position.Z).toBe(-50);
   f.session.rearmElapsed=0; stepGroundDirector(f.session,20,line=>lines.push(line)); expect(runtime.states[0].elapsed).toBe(5);
   f.session.rearmElapsed=undefined; stepGroundDirector(f.session,5,line=>lines.push(line)); expect(lines).toEqual(["Advance","Secured"]);
   f.bs.phaseIndex=1; stepGroundDirector(f.session,1,()=>{}); expect(f.session.groundDirector).toBeUndefined(); expect(runtime.folder.Parent).toBeUndefined();
  } finally { clearGroundDirector(f.session); f.folder.Destroy(); }
 });
 it("warns then strikes the force only, respects scenery, never falls back to player damage, and fails its loss",()=>{
  const f=fixture(); try {
   const lines:string[]=[]; const say=(line:string)=>{lines.push(line);}; stepGroundDirector(f.session,0.01,say);
   const state=f.session.groundDirector!.states[0]; f.enemy.windup=0.1;
   const wall=new Instance("Part"); wall.Anchored=true; wall.Size=new Vector3(1000,10,1000); wall.Position=new Vector3(0,150,0); wall.Parent=f.scenery;
   expect(stepBeachAttacker(f.session,f.enemy,0.1,say)).toBe(true); expect(state.health).toBe(20); wall.Destroy();
   f.enemy.windup=0.1; stepBeachAttacker(f.session,f.enemy,0.1,say); expect(state.health).toBe(10); expect(lines).toEqual(["Beach hit"]);
   f.enemy.windup=0.1; stepBeachAttacker(f.session,f.enemy,0.1,say); expect(state.health).toBe(0); expect(f.bs.reason).toBe("protected_lost"); expect(f.bs.outcome).toBe("failed"); expect(lines.size()).toBe(1);
   expect(f.bs.killedIds.size()).toBe(0); expect(stepBeachAttacker(f.session,{...f.enemy,attackSector:undefined},1,say)).toBe(false);
  } finally { f.folder.Destroy(); }
 });
 it("freezes attacker clocks during service and consumes missing-sector attackers without a player fallback",()=>{
  const f=fixture(); try {
   stepGroundDirector(f.session,0.01,()=>{}); f.session.rearmElapsed=0; f.enemy.windup=2;
   stepBeachAttacker(f.session,f.enemy,10,()=>{}); expect(f.enemy.windup).toBe(2);
   f.session.rearmElapsed=undefined; f.enemy.attackSector="missing"; stepBeachAttacker(f.session,f.enemy,1,()=>{}); expect(f.enemy.windup).toBe(0); expect(f.session.groundDirector!.states[0].health).toBe(20);
  } finally { f.folder.Destroy(); }
 });
 it("uses procedural geometry with one identity per M09 target",()=>{
  for(const targetType of ["artillery","bunker","tank","vehicle"] as const) {
   const model=createGroundTarget({id:targetType,type:targetType,position:{x:0,y:0,z:0},yaw:0,required:false,scoreRole:"ground"});
   try { expect(model.GetAttribute("TargetId")).toBe(targetType); expect(model.GetChildren().size()).toBeGreaterThan(2); } finally { model.Destroy(); }
  }
 });
});
