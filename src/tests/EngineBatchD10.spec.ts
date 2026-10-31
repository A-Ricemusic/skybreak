import { describe, expect, it } from "@rbxts/jest-globals";
import { CruisePlan, CruiseTarget, CruiseBudget, cruiseComplete, cruiseDestroyed, cruiseRadar, cruiseRoute, newCruiseStates, validateBatchD10 } from "../shared/EngineBatchD10";
import { BomberRules } from "../shared/BomberRules";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { AlliedRules } from "../shared/AlliedRules";
import { TargetPriority } from "../shared/TargetPriority";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
const target=(id:string,start=0):CruiseTarget=>({id,route:[{x:start,y:100,z:0},{x:10000,y:100,z:0}],speed:100,scoreRole:"cruise"});
const plan=():CruisePlan=>({site:{x:10000,y:0,z:0},targets:[{...target("carrier"),separateSeconds:10},{...target("a",1000),parentId:"carrier"},{...target("b",1000),parentId:"carrier"}]});
const phase=(p=plan()):MissionPhaseBlueprint=>({kind:"required_air",label:"Intercept",count:p.targets.size(),cruiseIntercept:p});
function valid(p:MissionPhaseBlueprint): boolean {const [ok]=pcall(()=>validateBatchD10([p],15360));return ok;}
describe("D10 dormant cruise rules",()=>{
 it("samples F6 constant-speed routes through low waypoints and holds impact endpoint",()=>{
  const r=cruiseRoute(target("a"));expect(BomberRules.Sample(r,10).slots[0].position.x).toBeCloseTo(1000,0);expect(BomberRules.Sample(r,100).escaped).toBe(true);expect(BomberRules.Sample(r,200).slots[0].position.x).toBeCloseTo(10000);
 });
 it("validates bounded independent admission and release continuity",()=>{
  expect(valid(phase())).toBe(true);
  MissionCatalog.ValidatePolicy({...MissionCatalog.Get(1),ground:[],phases:[phase()],scoring:{...MissionCatalog.Scoring(1),points:{air:60,cruise:100}}});
  for(const patch of [{speed:181},{speed:0},{separateSeconds:1000},{id:""},{route:[{x:0,y:0,z:0}]}]) {const p=plan();p.targets[0]={...p.targets[0],...patch};expect(valid(phase(p))).toBe(false);}
  for(const patch of [{parentId:"missing"},{arrivalSeconds:1},{route:target("bad").route}]) {const p=plan();p.targets[1]={...p.targets[1],...patch};expect(valid(phase(p))).toBe(false);}
  const p=plan();p.targets=[];for(let i=0;i<=CruiseBudget.active;i++) p.targets.push(target(`m${i}`));expect(valid(phase(p))).toBe(false);
 });
 it("cancels unreleased descendants without credit and never double settles",()=>{
  const p=plan(),states=newCruiseStates(p);states[0].status="active";cruiseDestroyed(p,states,0);expect(states.map(s=>s.status)).toEqual(["destroyed","cancelled","cancelled"]);expect(cruiseComplete(states)).toBe(true);cruiseDestroyed(p,states,0);expect(states[1].status).toBe("cancelled");
  const split=newCruiseStates(p);split[0].status="separated";split[1].status="destroyed";split[2].status="active";expect(cruiseComplete(split)).toBe(false);split[2].status="impact";expect(cruiseComplete(split)).toBe(false);
 });
 it("limits low radar with terrain LOS without removing visual targeting",()=>{
  expect(cruiseRadar(1200,60,true)).toBe(true);expect(cruiseRadar(1201,60,true)).toBe(false);expect(cruiseRadar(2200,180,true)).toBe(true);expect(cruiseRadar(2201,180,true)).toBe(false);expect(cruiseRadar(100,60,false)).toBe(false);expect(cruiseRadar(0/0,60,true)).toBe(false);
  const contacts=[{id:1,distance:500,dot:1,onScreen:true,inRange:true},{id:2,distance:200,dot:1,onScreen:true,inRange:true}];expect(TargetPriority.Press(contacts)).toBe(2);expect(TargetPriority.Press(contacts,2)).toBe(1);
 });
 it("credits children once without completing before the director, impact wins same-frame ordering",()=>{
  const b={...MissionCatalog.Get(1),phases:[phase()]},bs=BlueprintRunner.NewState(b,0),score=new TargetScore({...MissionCatalog.Scoring(b),points:{cruise:100}});
  expect(recordScoredKill(bs,score,"a","air",true,0,"cruise")).toBe(true);expect(recordScoredKill(bs,score,"a","air",true,0,"cruise")).toBe(false);expect(score.Total()).toBe(100);expect(bs.outcome).toBeUndefined();BlueprintRunner.ResolveCruise(bs,false);BlueprintRunner.ResolveCruise(bs,true);expect(bs.reason).toBe("protected_lost");expect(recordScoredKill(bs,score,"b","air",true,0,"cruise")).toBe(false);
  const won=BlueprintRunner.NewState(b,0);BlueprintRunner.ResolveCruise(won,true);expect(won.outcome).toBe("won");expect(won.requiredAirKills).toBe(0);
 });
 it("denies allied intercept engagement and player warnings; all catalog missions remain dormant",()=>{
  expect(AlliedRules.CanEngage({} as never,{required:true,role:"bomber",enabled:true,health:24})).toBe(false);expect(AlliedRules.WarnsPlayer(undefined,"cruise_site")).toBe(false);
  for(let i=0;i<=18;i++) {const b=MissionCatalog.Get(i);if(b) for(const p of b.phases) expect(p.cruiseIntercept).toBeUndefined();}
 });
});
