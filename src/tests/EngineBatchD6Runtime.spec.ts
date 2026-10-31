import { AircraftCollision } from "../server/AircraftCollision";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { createCheapContact, handoffParked, setContactDetail, stepContacts, stepRepeatedArtillery } from "../server/EngineBatchD6Runtime";
import { CombatSession, Enemy } from "../server/CombatSession";
import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TypedGroundTarget } from "../shared/CampaignEncounters";
import { ContactBudget } from "../shared/EngineBatchD6";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { recordScoredKill } from "../server/SortieScore";
import { TargetScore } from "../shared/TargetScore";
const spec=(i:number):TypedGroundTarget=>({id:`prop${i}`,type:"barracks",position:{x:i*4,y:0,z:0},yaw:0,required:false,scoreRole:"ground"});
describe("D6 server lifecycle (Studio execution pending)",()=>{
 it("keeps 150 distant contacts at one Part, caps detail at 24 and changes at two per tick",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  try {
   const enemies:Enemy[]=[];
   for(let i=0;i<150;i++) {const t=spec(i),model=createCheapContact(t);model.Parent=folder;expect(model.GetDescendants().size()).toBe(1);enemies.push({id:t.id,model,typedGround:t,health:55,enabled:true,position:model.PrimaryPart!.Position} as Enemy);}
   const bs=BlueprintRunner.NewState({...MissionCatalog.Get(1),phases:[{kind:"score_threshold",label:"River",cheapContacts:true}]},0);
   const session={blueprintState:bs,enemies,state:{x:0,z:0}} as CombatSession;
   const count=()=>enemies.filter(e=>e.model.GetAttribute("D6Detailed")===true).size();
   stepContacts(session,0.49);expect(count()).toBe(0);stepContacts(session,0.01);expect(count()).toBe(2);
   for(let i=0;i<20;i++) stepContacts(session,0.5);expect(count()).toBe(ContactBudget.detailed);
   for(const e of enemies) e.enabled=false;stepContacts(session,0.5);expect(count()).toBe(22);
   for(let i=0;i<20;i++) stepContacts(session,0.5);expect(count()).toBe(0);
   for(const e of enemies) expect(e.model.GetDescendants().size()).toBe(1);
  } finally {folder.Destroy();}
 });
 it("preserves Model, aim, health and target identifiers through detail changes",()=>{
  const t=spec(0),m=createCheapContact(t),aim=m.PrimaryPart!;m.SetAttribute("Health",20);
  try {setContactDetail(m,t,true);expect(m.PrimaryPart).toBe(aim);expect(m.GetAttribute("Health")).toBe(20);expect(m.GetAttribute("TargetId")).toBe(t.id);setContactDetail(m,t,false);expect(m.PrimaryPart).toBe(aim);expect(m.GetDescendants().size()).toBe(1);} finally {m.Destroy();}
 });
 it("keeps collision queries current when detail children replace a proxy",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  const t={...spec(0),position:{x:0,y:10000,z:0}},m=createCheapContact(t);m.Parent=folder;
  try {const params=AircraftCollision.Parameters(folder);setContactDetail(m,t,true);expect(Workspace.Raycast(new Vector3(12,10050,0),new Vector3(0,-60,0),params)).toBeDefined();setContactDetail(m,t,false);expect(Workspace.Raycast(new Vector3(12,10050,0),new Vector3(0,-60,0),params)).toBeUndefined();} finally {folder.Destroy();}
 });
 it("transfers only live parked representations and preserves the once-only scoring identity",()=>{
  const t={...spec(0),type:"parked_helicopter" as const},m=createGroundTarget(t);
  const parked={id:t.id,kind:"ground",health:55,enabled:true,model:m} as Enemy;
  const session={enemies:[parked],target:parked,lockProgress:1} as CombatSession;
  expect(handoffParked(session,t.id)).toBe(t.id);expect(handoffParked(session,t.id)).toBeUndefined();expect(parked.enabled).toBe(false);expect(session.target).toBeUndefined();expect(session.lockProgress).toBe(0);
  const b={...MissionCatalog.Get(1),phases:[{kind:"score_threshold" as const,label:"River",scoreThreshold:{points:9999,seconds:900,waitForExpiry:true}}]},bs=BlueprintRunner.NewState(b,0),score=new TargetScore(MissionCatalog.Scoring(b));
  expect(recordScoredKill(bs,score,t.id,"air",false,1)).toBe(true);expect(recordScoredKill(bs,score,t.id,"ground",false,2)).toBe(false);
  const dead=createGroundTarget(t);try {session.enemies=[{...parked,model:dead,health:0}];expect(handoffParked(session,t.id)).toBeUndefined();} finally {dead.Destroy();}
 });
 it("runs repeated impacts only on active time, keeps strike score/clock, and releases phase state",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  try {
   const floor=new Instance("Part");floor.Size=new Vector3(600,20,600);floor.Position=new Vector3(0,9990,0);floor.Anchored=true;floor.Parent=folder;
   const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[folder];
   const plan={startSeconds:2,salvos:2,ceiling:10585,source:{x:400,y:10300,z:0},warningSeconds:3,countdownSeconds:4,intervalSeconds:12,damage:30,clearance:60,channel:[{x:0,y:10300,z:-100},{x:0,y:10300,z:100}]};
   const bs=BlueprintRunner.NewState({...MissionCatalog.Get(1),phases:[{kind:"score_threshold",label:"River",repeatedArtillery:plan},{kind:"required_air",count:1,label:"Exit"}]},0);
   const session={blueprintState:bs,collisionParams:params,state:{x:0,y:10300,z:0},health:100,damageTaken:0,lowestHealth:100} as CombatSession;
   const say=(_:string)=>{};stepRepeatedArtillery(session,2,say);stepRepeatedArtillery(session,0,say);expect(session.health).toBe(100);
   stepRepeatedArtillery(session,7,say);expect(session.health).toBe(70);stepRepeatedArtillery(session,5,say);stepRepeatedArtillery(session,7,say);expect(session.health).toBe(40);
   bs.phaseIndex=1;stepRepeatedArtillery(session,1,say);expect(session.repeatedArtillery).toBeUndefined();expect(session.damageTaken).toBe(60);
  } finally {folder.Destroy();}
 });
 it("builds six distinct procedural target classes without uploaded geometry",()=>{
  for(const targetType of ["container","watchtower","antenna","barracks","gunboat","sub_pen"] as const) {const m=createGroundTarget({...spec(0),type:targetType});try {expect(m.PrimaryPart).toBeDefined();expect(m.GetAttribute("UploadedAsset")).toBeUndefined();expect(m.GetDescendants().size()).toBeLessThanOrEqual(4);} finally {m.Destroy();}}
 });
});
