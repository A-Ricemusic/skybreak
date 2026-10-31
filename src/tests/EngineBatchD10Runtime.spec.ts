import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { clearCruise, cruiseKilled, cruiseOccluded, stepCruise } from "../server/EngineBatchD10Runtime";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { CruisePlan } from "../shared/EngineBatchD10";
import { MissionCatalog } from "../shared/MissionCatalog";
import { recordScoredKill } from "../server/SortieScore";
import { TargetScore } from "../shared/TargetScore";
const plan=():CruisePlan=>({site:{x:1000,y:100,z:0},targets:[{id:"carrier",speed:100,scoreRole:"cruise",route:[{x:0,y:100,z:0},{x:1000,y:100,z:0}],separateSeconds:3},{id:"child1",parentId:"carrier",speed:100,scoreRole:"cruise",route:[{x:300,y:100,z:0},{x:1000,y:100,z:0}]},{id:"child2",parentId:"carrier",speed:100,scoreRole:"cruise",route:[{x:300,y:100,z:0},{x:1000,y:100,z:0}]}]});
function fixture(p=plan()) {
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const floor=new Instance("Part");floor.Size=new Vector3(4000,10,4000);floor.Position=new Vector3(0,45,0);floor.Anchored=true;floor.Parent=folder;
 const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[floor];
 const bs=BlueprintRunner.NewState({...engineRuntimeFixture(),phases:[{kind:"required_air",label:"Intercept",count:p.targets.size(),cruiseIntercept:p}]},0);
 const session={active:true,cleaned:false,folder,player:{UserId:1},enemies:[],projectiles:[],state:{x:0,y:200,z:0},blueprint:bs.blueprint,blueprintState:bs,pause:{used:0},collisionParams:params} as unknown as CombatSession;
 return {s:session,folder,floor,params};
}
describe("D10 server lifecycle (Studio execution pending)",()=>{
 it("spawns targetable procedural threats, follows terrain, separates without kills and scores children once",()=>{
  const {s,folder}=fixture();try {
   for(let i=0;i<31;i++) stepCruise(s,0.1);
   expect(s.cruise!.states[0].status).toBe("separated");expect(s.enemies.size()).toBe(3);expect(s.blueprintState!.requiredAirKills).toBe(0);
   const child=s.cruise!.actors.get(1)!;expect(child.position.Y).toBe(110);expect(child.model.GetAttribute("Damageable")).toBe(true);expect(child.model.GetAttribute("RequiredTarget")).toBe(true);expect(child.windup).toBe(0);expect(child.flares).toBe(0);
   const ledger=new TargetScore({...MissionCatalog.Scoring(engineRuntimeFixture()),points:{cruise:100}});
   const live=[...s.cruise!.actors].map(([,actor])=>actor);
   for(const e of live) if(e?.enabled) {expect(recordScoredKill(s.blueprintState!,ledger,e.id,"air",true,0,"cruise")).toBe(true);expect(recordScoredKill(s.blueprintState!,ledger,e.id,"air",true,0,"cruise")).toBe(false);e.health=0;cruiseKilled(s,e);}
   stepCruise(s,0.1);expect(s.blueprintState!.outcome).toBe("won");expect(ledger.Total()).toBe(200);expect(s.cruise).toBeUndefined();
  } finally {clearCruise(s);folder.Destroy();}
 });
 it("carrier destruction cancels children and releases selection without phantom credit",()=>{
  const {s,folder}=fixture();try {stepCruise(s,0.1);s.target=s.cruise!.actors.get(0);s.lockProgress=1;s.target!.health=0;stepCruise(s,0.1);expect(s.enemies.size()).toBe(1);expect(s.blueprintState!.outcome).toBe("won");expect(s.blueprintState!.requiredAirKills).toBe(0);expect(s.target).toBeUndefined();expect(s.lockProgress).toBe(0);} finally {clearCruise(s);folder.Destroy();}
 });
 it("impact loses the protected site before weapon settlement",()=>{
  const p=plan();p.targets=[{...p.targets[0],separateSeconds:undefined}];const {s,folder}=fixture(p);
  try {for(let i=0;i<102;i++) stepCruise(s,0.1);expect(s.blueprintState!.reason).toBe("protected_lost");expect(s.cruise).toBeUndefined();} finally {clearCruise(s);folder.Destroy();}
 });
 it("freezes at lifecycle gates and cleans on phase exit and repeated disposal",()=>{
  const {s,folder}=fixture();try {
   for(const gate of ["loading","launch","rearm","cutIn","landing"]) {
    if(gate==="loading") s.loading={} as never;if(gate==="launch") s.launch={} as never;if(gate==="rearm") s.rearmElapsed=0;if(gate==="cutIn") s.cutInElapsed=0;if(gate==="landing") s.blueprintState!.landingElapsed=0;
    stepCruise(s,1);expect(s.cruise).toBeUndefined();s.loading=undefined;s.launch=undefined;s.rearmElapsed=undefined;s.cutInElapsed=undefined;s.blueprintState!.landingElapsed=undefined;
   }
   s.pause.pausedAt=1;stepCruise(s,1);expect(s.cruise).toBeUndefined();s.pause.pausedAt=undefined;
   stepCruise(s,0.1);const actor=s.cruise!.actors.get(0)!;s.blueprintState!.phaseIndex=1;stepCruise(s,0.1);expect(s.cruise).toBeUndefined();expect(actor.enabled).toBe(false);expect(actor.model.Parent).toBeUndefined();clearCruise(s);clearCruise(s);
  } finally {clearCruise(s);folder.Destroy();}
 });
 it("admits later roots independently and cleans sparse actors without fighter queue ownership",()=>{
  const p=plan();p.targets=[{...p.targets[0],id:"late",separateSeconds:undefined,arrivalSeconds:5},{...p.targets[0],id:"early",separateSeconds:undefined}];
  const {s,folder}=fixture(p);try {
   stepCruise(s,0.1);expect(s.cruise!.actors.get(0)).toBeUndefined();expect(s.cruise!.actors.get(1)).toBeDefined();const early=s.cruise!.actors.get(1)!;
   clearCruise(s);expect(early.model.Parent).toBeUndefined();expect(early.enabled).toBe(false);
  } finally {clearCruise(s);folder.Destroy();}
 });
 it("segments long occlusion rays and fails safely when terrain is unavailable",()=>{
  const {s,folder,floor,params}=fixture();try {
   const wall=new Instance("Part");wall.Anchored=true;wall.Size=new Vector3(10,100,100);wall.Position=new Vector3(20000,100,0);wall.Parent=folder;params.FilterDescendantsInstances=[floor,wall];
   expect(cruiseOccluded(new Vector3(0,100,0),new Vector3(40000,100,0),params)).toBe(true);expect(cruiseOccluded(new Vector3(0,300,0),new Vector3(40000,300,0),params)).toBe(false);
   params.FilterDescendantsInstances=[];stepCruise(s,0.1);expect(s.crashReason).toBe("internal_error");
  } finally {clearCruise(s);folder.Destroy();}
 });
});
