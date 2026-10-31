import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { recordScoredKill } from "../server/SortieScore";
import { TargetScore } from "../shared/TargetScore";
import { validateEncounterIdentities } from "../shared/CampaignEncounters";
import { describe, expect, it } from "@rbxts/jest-globals";
import { cheapArmourAllowed, cheapArmourEligible, repairAllowed, sectorReinforcementReady, validateBatchD11 } from "../shared/EngineBatchD11";
import { GroundProgressPlan, newGroundProgress, stepGroundProgress, validateBatchD5 } from "../shared/EngineBatchD5";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { validateBatchC, RearmPlan } from "../shared/EngineBatchC";
import { rearmClock, rearmMenuDue, takeoffChoice } from "../shared/SortieCutaways";
import { d4Fixture } from "./EngineBatchD4Fixture";
function phase(): MissionPhaseBlueprint {
 const groundProgress:GroundProgressPlan={sectors:[{id:"city",formation:"city_squad",kind:"troops",clearTargetIds:["tank"],seconds:10,health:100,route:{speed:10,waypoints:[{x:0,y:40,z:0},{x:0,y:40,z:-100}]},advanceCall:"Advance",securedCall:"City secured",hitCall:"Squad hit"},{id:"road",formation:"desert_column",kind:"column",after:"city",clearTargetIds:["reserve"],seconds:10,health:100,route:{speed:10,waypoints:[{x:0,y:40,z:-100},{x:0,y:40,z:-200}]},advanceCall:"Column advance",securedCall:"Road secured",hitCall:"Column hit"}]};
 return {kind:"score_threshold",label:"Support",scoreThreshold:{points:100,seconds:300,waitForExpiry:true},cheapContacts:true,groundProgress,groundTargets:[{id:"tank",type:"tank",position:{x:0,y:40,z:0},yaw:0,required:false,scoreRole:"ground"},{id:"reserve",type:"vehicle",position:{x:0,y:40,z:-100},yaw:0,required:false,scoreRole:"ground",reinforceAfterSector:"city"}]};
}
function service():RearmPlan {return {zone:{x:0,y:100,z:1000},radius:1500,landing:{touchdown:{x:0,y:100,z:0},headingDegrees:0,approachDistance:1000,rolloutDistance:150,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:true,weaponMenu:true};}
describe("Dormant D11 ground support and service",()=>{
 it("keeps late armour disabled for every live and missing mission identity",()=>{
  for(let id=0;id<=18;id++) expect(cheapArmourAllowed(id)).toBe(id>=15 && id<=17);
  expect(cheapArmourAllowed(undefined)).toBe(false);
 });
 it("shares squad, column and reserve identities with every authored encounter source",()=>{
  const sources:MissionPhaseBlueprint[]=[
   {...phase(),groundProgress:undefined},
   {kind:"required_air",label:"Bombers",bombers:{targetIds:["city"]}},
   {kind:"required_air",label:"Fighters",fighterWaves:[{id:"city"}]},
   {kind:"required_air",label:"Ace",standaloneAce:{id:"city"}},
   {kind:"required_air",label:"Cruise",cruiseIntercept:{targets:[{id:"city"}]}},
   {kind:"required_air",label:"Protected",protection:{aircraft:[{id:"city"}]}},
   {kind:"required_air",label:"Spatial",spatialJamming:{airships:[{id:"city"}]}}
  ] as MissionPhaseBlueprint[];
  validateEncounterIdentities([phase()]);
  sources[0].groundTargets![1].id="city";
  for(const source of sources) expect(pcall(()=>validateEncounterIdentities([phase(),source]))[0]).toBe(false);
  const duplicate=phase();duplicate.groundProgress!.sectors[1].id="city";
  expect(pcall(()=>validateEncounterIdentities([duplicate]))[0]).toBe(false);
 });
 it("composes D8 strike rearm with D11 repair identity checks",()=>{
  for(let id=0;id<=18;id++) {
   const p:MissionPhaseBlueprint={kind:"required_ground",label:"Strike",rearm:service()};
   expect(pcall(()=>validateBatchC([p],3000,id))[0]).toBe(id>=15 && id<=17);
   p.rearm!.health=false;validateBatchC([p],3000,id);
  }
 });

 it("repairs only explicit mission 15–17 authoring identities",()=>{
  for(let id=0;id<=18;id++) {expect(repairAllowed(id,true)).toBe(id>=15 && id<=17);expect(repairAllowed(id,false)).toBe(false);}
  expect(repairAllowed(undefined,true)).toBe(false);
 });
 it("validates repair through both batch C and catalog authoring without weakening defaults",()=>{
  for(let id=0;id<=18;id++) {const p={...phase(),rearm:service()};const [ok]=pcall(()=>validateBatchC([p],3000,id));expect(ok).toBe(id>=15 && id<=17);}
  const p={...phase(),rearm:service()};expect(pcall(()=>validateBatchC([p],3000))[0]).toBe(false);
  const bp={...engineRuntimeFixture(),id:15,phases:[p]};MissionCatalog.ValidatePolicy(bp);
 });
 it("extends the existing D5 director with squads, columns and once-only reserve gates",()=>{
  const p=phase(), plan=p.groundProgress!, states=newGroundProgress(plan);validateBatchD5([p],3000);validateBatchD11([p],15);
  expect(sectorReinforcementReady("city",plan,states)).toBe(false);
  expect(stepGroundProgress(plan,states,new Set(["tank"]),10)).toEqual(["Advance","City secured"]);
  expect(sectorReinforcementReady("city",plan,states)).toBe(true);expect(states[1].elapsed).toBe(0);
  expect(stepGroundProgress(plan,states,new Set(["tank"]),10)).toEqual([]);
  expect(stepGroundProgress(plan,states,new Set(["tank","reserve"]),10)).toEqual(["Column advance","Road secured"]);
  expect(stepGroundProgress(plan,states,new Set(["tank","reserve"]),100)).toEqual([]);
 });
 it("admits a reserve score once only in an authored ground-target phase",()=>{
  const p=phase(), bp={...engineRuntimeFixture(),id:15,phases:[p]};MissionCatalog.ValidatePolicy(bp);
  const missing=R.NewState({...bp,phases:[{...p,groundTargets:undefined}]},0), rejected=new TargetScore({...MissionCatalog.Scoring(engineRuntimeFixture()),points:{ground:150}});
  expect(recordScoredKill(missing,rejected,"reserve","ground",false,1,"ground")).toBe(false);
  expect(missing.killedIds.size()).toBe(0);expect(rejected.Total()).toBe(0);
  const bs=R.NewState(bp,0), ledger=new TargetScore({...MissionCatalog.Scoring(engineRuntimeFixture()),points:{ground:150}});
  expect(recordScoredKill(bs,ledger,"reserve","ground",false,1,"ground")).toBe(true);
  const points=ledger.Total();expect(points).toBe(150);expect(bs.optionalGroundKills).toBe(1);
  expect(recordScoredKill(bs,ledger,"reserve","ground",false,2,"ground")).toBe(false);
  expect(ledger.Total()).toBe(points);expect(bs.killedIds.size()).toBe(1);expect(bs.optionalGroundKills).toBe(1);
 });
 it("rejects missing, required, circular and unbudgeted reserves",()=>{
  for(const mutate of [(p:MissionPhaseBlueprint)=>{p.groundTargets![1].reinforceAfterSector="missing";},(p:MissionPhaseBlueprint)=>{p.groundTargets![1].required=true;},(p:MissionPhaseBlueprint)=>{p.groundProgress!.sectors[0].clearTargetIds.push("reserve");},(p:MissionPhaseBlueprint)=>{p.cheapContacts=undefined;},(p:MissionPhaseBlueprint)=>{p.groundProgress!.sectors[0].kind="column";}]) {const p=phase();mutate(p);expect(pcall(()=>validateBatchD11([p],15))[0]).toBe(false);}
 });
 it("never releases absent, dead or unsecured sectors",()=>{
  const plan=phase().groundProgress!, states=newGroundProgress(plan);states[0].secured=true;states[0].health=0;
  expect(sectorReinforcementReady("city",plan,states)).toBe(false);expect(sectorReinforcementReady("missing",plan,states)).toBe(false);expect(sectorReinforcementReady("city")).toBe(false);expect(sectorReinforcementReady(undefined)).toBe(true);
 });
 it("keeps active SAMs and movers out of cheap armour",()=>{
  const t=phase().groundTargets![0];expect(cheapArmourEligible(t)).toBe(true);expect(cheapArmourEligible({...t,sam:true})).toBe(false);expect(cheapArmourEligible({...t,parentId:"hull"})).toBe(false);expect(cheapArmourEligible({...t,route:{speed:1,waypoints:[]}})).toBe(false);
 });
 it("reuses weapon choice and independent service clocks with the menu held",()=>{
  const p=service();expect(rearmClock(p,0,false)).toEqual({label:"LANDING",seconds:180});expect(rearmClock(p,13,true)).toEqual({label:"TAKEOFF",seconds:60});expect(rearmClock(p,17,false)).toEqual({label:"TAKEOFF",seconds:56});expect(rearmMenuDue(p,13,false)).toBe(true);expect(rearmMenuDue(p,13,true)).toBe(false);expect(takeoffChoice("salvo")).toBe("salvo");expect(takeoffChoice("forged")).toBeUndefined();
 });
 it("reuses D4 for six city bombers: once-only kills hold to expiry and penetration loses the site",()=>{
  const bp=d4Fixture();bp.id=15;bp.phases[1].interceptHold!.siteName="CITY ZONES";MissionCatalog.ValidatePolicy(bp);
  const s=R.NewState(bp,0);s.score=800;R.Tick(s,420);for(let i=1;i<=6;i++) R.RecordKill(s,`west-${i}`,"air",true,421+i);
  expect(R.RecordKill(s,"west-6","air",true,440)).toBe(false);R.Tick(s,779);expect(s.outcome).toBeUndefined();R.Tick(s,780);expect(s.outcome).toBe("won");
  const lost=R.NewState(bp,0);lost.score=800;R.Tick(lost,420);R.EscapeBombers(lost);expect(lost.protectedHealth).toBe(0);expect(lost.reason).toBe("bombers_escaped");
 });
 it("keeps all new contracts dormant in the catalog",()=>{
  for(let id=0;id<=18;id++) if(id!==15 && id!==16) for(const p of MissionCatalog.ExpandedPhases(MissionCatalog.Get(id))) {expect(p.rearm?.health===true).toBe(false);for(const s of p.groundProgress?.sectors ?? []) expect(s.formation).toBeUndefined();for(const t of p.groundTargets ?? []) expect(t.reinforceAfterSector).toBeUndefined();}
 });
});
