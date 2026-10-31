import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { applyGroundPhase, completeRearmRepair, releaseZoneReserves } from "../server/EngineBatchD11Runtime";
import { clearGroundDirector, stepGroundDirector } from "../server/EngineBatchD5Runtime";
import { createCheapContact, cheapEligible, setContactDetail, stepContacts } from "../server/EngineBatchD6Runtime";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { TypedGroundTarget } from "../shared/CampaignEncounters";
import { stepRearm, skipRearm, answerRearmMenu } from "../server/EngineBatchCRuntime";
import { RearmPlan } from "../shared/EngineBatchC";
import { landingPose } from "../shared/EngineBatchB";
import { TargetScore } from "../shared/TargetScore";
import { SortieArmament } from "../shared/SortieArmament";
import { recordScoredKill } from "../server/SortieScore";
import { d4Fixture } from "./EngineBatchD4Fixture";
function spec(id:string):TypedGroundTarget {return {id,type:"tank",position:{x:0,y:100,z:0},yaw:45,required:false,scoreRole:"ground"};}
describe("D11 runtime (compiled; Studio execution pending)",()=>{
 it("releases reserves through D5 only after clearance, freezes at service, never resurrects, and cleans on phase exit",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  const t={...spec("reserve"),reinforceAfterSector:"city"}, model=createCheapContact(t);model.Parent=folder;model.PrimaryPart!.Transparency=1;
  const b:MissionBlueprint={...MissionCatalog.Get(15),phases:[{kind:"score_threshold",label:"City",groundProgress:{sectors:[{id:"city",kind:"troops",formation:"city_squad",clearTargetIds:["gun"],seconds:10,health:100,route:{speed:10,waypoints:[{x:0,y:40,z:0},{x:0,y:40,z:-100}]},advanceCall:"Advance",securedCall:"Secured",hitCall:"Hit"}]}}]};
  const bs=BlueprintRunner.NewState(b,0), e={id:t.id,model,typedGround:t,phaseOwner:0,kind:"ground",enabled:false,health:55,position:model.PrimaryPart!.Position} as Enemy;
  const s={active:true,folder,blueprint:b,blueprintState:bs,enemies:[e],pause:{used:0}} as unknown as CombatSession;
  try {
   stepGroundDirector(s,10,()=>{});expect(e.enabled).toBe(false);bs.killedIds.add("gun");s.rearmElapsed=0;stepGroundDirector(s,10,()=>{});expect(e.enabled).toBe(false);s.rearmElapsed=undefined;
   stepGroundDirector(s,10,()=>{});expect(e.enabled).toBe(true);expect(model.GetAttribute("SkybreakEnemy")).toBe(true);expect(model.PrimaryPart!.Transparency).toBe(0);
   const actor=s.groundDirector!.actors[0];expect(actor.GetAttribute("Friendly")).toBe(true);expect(actor.CanQuery).toBe(false);expect(bs.killedIds.size()).toBe(1);
   const ledger=new TargetScore(MissionCatalog.Scoring(1));expect(recordScoredKill(bs,ledger,e.id,"ground",false,1,"ground")).toBe(true);const points=ledger.Total();expect(recordScoredKill(bs,ledger,e.id,"ground",false,2,"ground")).toBe(false);expect(ledger.Total()).toBe(points);
   e.health=0;e.enabled=false;releaseZoneReserves(s);expect(e.enabled).toBe(false);
   bs.phaseIndex=1;stepGroundDirector(s,1,()=>{});expect(s.groundDirector).toBeUndefined();expect(actor.Parent).toBeUndefined();
  } finally {clearGroundDirector(s);folder.Destroy();}
 });
 it("keeps unopened reserves hidden at score expiry and destroys them with the sortie folder",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  const t={...spec("unreleased"),reinforceAfterSector:"city"}, model=createCheapContact(t);model.Parent=folder;
  const bp=d4Fixture();bp.id=15;
  const bs=BlueprintRunner.NewState(bp,0), e={id:t.id,model,typedGround:t,phaseOwner:0,kind:"ground",enabled:false,health:55} as Enemy;
  try {
   applyGroundPhase([e],0);bs.score=800;BlueprintRunner.Tick(bs,420);expect(bs.phaseIndex).toBe(1);
   applyGroundPhase([e],bs.phaseIndex);
   expect(e.reserveReleased).toBeUndefined();expect(e.enabled).toBe(false);
   for(const part of model.GetDescendants()) if(part.IsA("BasePart")) {expect(part.Transparency).toBe(1);expect(part.CanQuery).toBe(false);}
   expect(model.GetAttribute("SkybreakEnemy")).toBe(false);
   // cleanupSession destroys this owning folder; hidden reserves have no separate lifetime.
   const descendants=model.GetDescendants();folder.Destroy();expect(model.Parent).toBeUndefined();
   for(const part of descendants) expect(part.Parent).toBeUndefined();
  } finally {folder.Destroy();}
 });
 it("repairs at completed service only, retains historical damage and weapon menu behavior",()=>{
  const plan:RearmPlan={zone:{x:0,y:100,z:1000},radius:1500,landing:{touchdown:{x:0,y:100,z:0},headingDegrees:0,approachDistance:1000,rolloutDistance:150,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:true,weaponMenu:true};
  const bp={...MissionCatalog.Get(15),phases:[{kind:"score_threshold" as const,label:"Support",scoreThreshold:{points:1000,seconds:600,waitForExpiry:true},rearm:plan}]},bs=BlueprintRunner.NewState(bp,os.clock());
  const s={active:true,blueprint:bp,blueprintState:bs,pause:{used:0},state:landingPose(plan.landing,0),targetScore:new TargetScore(MissionCatalog.Scoring(1)),enemies:[],projectiles:[],special:SortieArmament.NewSpecial("salvo",undefined),missiles:0,health:35,damageTaken:65,lowestHealth:35} as unknown as CombatSession;
  stepRearm(s,1,8,()=>{});expect(s.health).toBe(35);skipRearm(s,plan,()=>{});stepRearm(s,0.1,8,()=>{});expect(s.rearmMenu).toBe(0);expect(s.health).toBe(35);
  answerRearmMenu(s,"lance",()=>{});expect(s.special.kind).toBe("lance");skipRearm(s,plan,()=>{});stepRearm(s,0.1,8,()=>{});expect(s.health).toBe(100);expect(s.damageTaken).toBe(65);expect(s.lowestHealth).toBe(35);expect(s.missiles).toBe(8);expect(bs.rearmActive).toBeUndefined();
 });
 it("rejects runtime repair for other identities and never revives a destroyed player",()=>{
  for(const id of [5,6,9,10,12,18]) {const s={blueprint:{id},health:35} as CombatSession;completeRearmRepair(s,true);expect(s.health).toBe(35);}
  for(const id of [15,16,17]) {const s={blueprint:{id},health:35} as CombatSession;completeRearmRepair(s,false);expect(s.health).toBe(35);s.health=0;completeRearmRepair(s,true);expect(s.health).toBe(0);}
 });
 it("preserves armour aim, yaw, identity and health through LOD swaps",()=>{
  for(const targetType of ["tank","vehicle","artillery","bunker"] as const) {
   const t={...spec(targetType),type:targetType}, m=createCheapContact(t),full=createGroundTarget(t),aim=m.PrimaryPart!;
   try {expect(cheapEligible(t)).toBe(true);expect(aim.CFrame).toEqual(full.PrimaryPart!.CFrame);m.SetAttribute("Health",23);setContactDetail(m,t,true);expect(m.PrimaryPart).toBe(aim);expect(m.GetAttribute("Health")).toBe(23);setContactDetail(m,t,false);expect(m.GetDescendants().size()).toBe(1);expect(m.GetAttribute("TargetId")).toBe(targetType);} finally {m.Destroy();full.Destroy();}
  }
 });
 it("uses D6's 150-contact, 24-detail, two-changes budget for a desert armour battle",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  try {const enemies:Enemy[]=[];for(let i=0;i<150;i++) {const t=spec(`tank-${i}`),model=createCheapContact(t);model.Parent=folder;enemies.push({id:t.id,model,typedGround:t,enabled:true,health:55,position:model.PrimaryPart!.Position} as Enemy);}
   const bs=BlueprintRunner.NewState({...MissionCatalog.Get(16),phases:[{kind:"score_threshold",label:"Desert",cheapContacts:true}]},0),s={blueprintState:bs,enemies,state:{x:0,z:0}} as CombatSession;
   stepContacts(s,0.5);expect(enemies.filter(e=>e.model.GetAttribute("D6Detailed")===true).size()).toBe(2);for(let i=0;i<20;i++)stepContacts(s,0.5);expect(enemies.filter(e=>e.model.GetAttribute("D6Detailed")===true).size()).toBe(24);
  } finally {folder.Destroy();}
 });
});
