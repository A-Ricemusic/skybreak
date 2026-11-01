import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { landingPose } from "../shared/LandingRules";
import { PauseRules } from "../shared/SessionGuard";
import { SortieArmament } from "../shared/SortieArmament";
import { TargetScore } from "../shared/TargetScore";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { completeEliteRetreat, stepRingSweep } from "../server/RingSweepRuntime";
import { stepRearm, skipRearm, liveJammers, announceJammerKill, lockAllowed } from "../server/RearmRuntime";
import { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { RingSweep } from "../shared/RingSweepRules";
import { FlightMath } from "../shared/FlightMath";
import { createGroundTarget } from "../server/GroundTargetFactory";
function fixture() {
 const folder=new Instance("Folder"); folder.Parent=Workspace;
 const p: RingSweep={guns:[{targetId:"gun",source:{x:0,y:10000,z:20000},bearingDegrees:0}],warningSeconds:2,countdownSeconds:2,intervalSeconds:12,damage:25,sweepDegrees:90,halfWidth:30,range:45000};
 const phase={kind:"required_ground" as const,label:"Ring",count:1,ringSweep:p,jamming:{visualLockRange:500,remainingCall:"REMAINS",clearCall:"CLEAR"}};
 const bs=BlueprintRunner.NewState({...engineRuntimeFixture(),phases:[phase]},0);
 const params=new RaycastParams(); params.FilterType=Enum.RaycastFilterType.Include; params.FilterDescendantsInstances=[folder];
 const gun={id:"gun",enabled:true,health:100,phaseOwner:0} as Enemy;
 const session={blueprint:bs.blueprint,blueprintState:bs,folder,enemies:[gun],projectiles:[],airQueue:[],collisionParams:params,state:FlightMath.FromPose(0,10000,0,0,0,160),health:100,damageTaken:0,lowestHealth:100} as unknown as CombatSession;
 return {folder,session,gun};
}
describe("D8 runtime contracts (Studio pending)",()=>{
 it("applies a single ring impact across a >15,000 stud line and clears phase-owned state",()=>{
  const f=fixture(); try {
   const lines: string[]=[]; stepRingSweep(f.session,4,l=>{lines.push(l);}); expect(f.session.health).toBe(75); expect(lines.size()).toBe(2);
   stepRingSweep(f.session,1,()=>{}); expect(f.session.health).toBe(75); expect(f.session.damageTaken).toBe(25); expect(f.session.lowestHealth).toBe(75);
   f.session.blueprintState!.phases[0].ringSweep=undefined; stepRingSweep(f.session,1,()=>{}); expect(f.session.ringArtillery).toBeUndefined();
  } finally { f.folder.Destroy(); }
 });
 it("honors an opted-in absolute sweep ceiling and keeps overlapping guns to one damage event",()=>{
  const f=fixture(); try {
   const p=f.session.blueprintState!.phases[0].ringSweep!; p.ceiling=900;
   f.session.state.y=901; stepRingSweep(f.session,4,()=>{}); expect(f.session.health).toBe(100);
   stepRingSweep(f.session,8,()=>{}); f.session.state.y=900;
   p.guns.push({...p.guns[0],targetId:"second"}); f.session.enemies.push({...f.gun,id:"second"});
   stepRingSweep(f.session,4,()=>{}); expect(f.session.health).toBe(75);
  } finally { f.folder.Destroy(); }
 });
 it("uses segmented terrain masking beyond 15,000 studs and stops destroyed guns",()=>{
  const f=fixture(); try {
   const ridge=new Instance("Part"); ridge.Anchored=true; ridge.Size=new Vector3(1000,1000,50); ridge.Position=new Vector3(0,10000,3000); ridge.Parent=f.folder;
   stepRingSweep(f.session,4,()=>{}); expect(f.session.health).toBe(100);
   ridge.Destroy(); stepRingSweep(f.session,8,()=>{}); f.gun.health=0; stepRingSweep(f.session,4,()=>{}); expect(f.session.health).toBe(100);
  } finally { f.folder.Destroy(); }
 });
 it("counts only enabled live ground ECM and announces clearance once",()=>{
  const f=fixture(); try {
   const e={enabled:true,health:50,typedGround:{ecm:true}} as Enemy; f.session.enemies.push(e);
   expect(liveJammers(f.session)).toBe(1); expect(lockAllowed(f.session,501)).toBe(false);
   e.enabled=false; expect(liveJammers(f.session)).toBe(0); e.enabled=true; e.health=0;
   const lines: string[]=[]; announceJammerKill(f.session,e,l=>{lines.push(l);}); announceJammerKill(f.session,e,l=>{lines.push(l);}); expect(lines).toEqual(["CLEAR"]);
  } finally { f.folder.Destroy(); }
 });
 it("owns once-only elite recovery cues, pending wave cleanup and hostile missile cleanup",()=>{
  const f=fixture(); try {
   const missile=new Instance("Part"); missile.Parent=f.folder;
   f.session.projectiles.push({hostile:true,part:missile} as CombatSession["projectiles"][number]);
   let withdrawals=0; const lines: string[]=[];
   completeEliteRetreat(f.session,()=>{withdrawals++;},l=>{lines.push(l);}); completeEliteRetreat(f.session,()=>{withdrawals++;},l=>{lines.push(l);});
   expect(withdrawals).toBe(1); expect(lines.size()).toBe(1); expect(f.session.projectiles.size()).toBe(0); expect(f.folder.GetAttribute("VultureTwoRecovered")).toBe(true);
  } finally { f.folder.Destroy(); }
 });
 it("services an unfinished required strike without changing damage, kills or progress, and honors pause/threat gates",()=>{
  const plan={zone:{x:0,y:100,z:1000},radius:1500,landing:{touchdown:{x:0,y:100,z:0},headingDegrees:0,approachDistance:1000,rolloutDistance:150,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:false,weaponMenu:false};
  const bp={...engineRuntimeFixture(),phases:[{kind:"required_ground" as const,label:"Strike",count:7,rearm:plan}]};
  const bs=BlueprintRunner.NewState(bp,os.clock()); bs.phaseProgress=2; bs.requiredGroundKills=2;
  const s={active:true,blueprint:bp,blueprintState:bs,pause:PauseRules.New(),state:landingPose(plan.landing,0),targetScore:new TargetScore(MissionCatalog.Scoring(engineRuntimeFixture())),enemies:[],projectiles:[],special:SortieArmament.NewSpecial("salvo",undefined),missiles:0,health:35} as unknown as CombatSession;
  s.enemies=[{enabled:true,health:100,windup:2} as Enemy]; expect(stepRearm(s,1,40,()=>{})).toBe(false);
  s.enemies[0].attackSector="beach"; expect(stepRearm(s,1,40,()=>{})).toBe(true);
  PauseRules.Pause(s.pause,os.clock()); stepRearm(s,30,40,()=>{}); expect(s.rearmElapsed).toBe(1); PauseRules.Resume(s.pause,os.clock());
  skipRearm(s,plan,()=>{}); skipRearm(s,plan,()=>{}); stepRearm(s,0.1,40,()=>{});
  expect(s.missiles).toBe(40); expect(s.health).toBe(35); expect(bs.phaseProgress).toBe(2); expect(bs.requiredGroundKills).toBe(2); expect(bs.rearmActive).toBeUndefined();
 });
 it("builds distinct procedural railgun, wreck and ECM stand-ins with stable identities",()=>{
  for(const targetType of ["railgun_emplacement","wreck","ground_ecm"] as const) {
   const model=createGroundTarget({id:"d8",type:targetType,position:{x:0,y:0,z:0},yaw:0,required:false,scoreRole:"ground"});
   try { expect(model.GetAttribute("TargetId")).toBe("d8"); expect(model.GetChildren().size()).toBeGreaterThan(2); } finally { model.Destroy(); }
  }
 });
});
