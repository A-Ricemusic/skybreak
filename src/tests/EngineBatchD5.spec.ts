import { recordScoredKill } from "../server/SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { describe, expect, it } from "@rbxts/jest-globals";
import { attackSectorIndex, carrierRearmPose, damageSector, GroundProgressPlan, newGroundProgress, stepGroundProgress, validateBatchD5 } from "../shared/EngineBatchD5";
import { rearmDuration, RearmPlan, rearmPose } from "../shared/EngineBatchC";
import { GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
function groundPlan(): GroundProgressPlan { return {sectors:[{id:"beach",clearTargetIds:["gun"],seconds:10,health:100,kind:"landing_craft",route:{speed:10,waypoints:[{x:0,y:40,z:0},{x:0,y:40,z:-100}]},advanceCall:"Advance",securedCall:"Secured",hitCall:"Under attack"},{id:"ridge",after:"beach",clearTargetIds:["gun"],seconds:10,health:100,kind:"troops",route:{speed:10,waypoints:[{x:0,y:40,z:-100},{x:0,y:40,z:-200}]},advanceCall:"Troops advance",securedCall:"Ridge secured",hitCall:"Troops hit"}]}; }
function carrierPlan(): RearmPlan { return {zone:{x:0,y:100,z:1200},radius:1500,landing:{touchdown:{x:0,y:100,z:150},headingDegrees:0,approachDistance:1000,rolloutDistance:50,approachSeconds:10,rolloutSeconds:3,glideDegrees:3},takeoffSeconds:8,missiles:true,special:true,health:false,carrier:{centre:{x:0,y:100,z:0},width:150,length:560,catapult:{x:0,y:100,z:-240}}}; }
function phase(): MissionPhaseBlueprint { return {kind:"score_threshold",label:"Beach",scoreThreshold:{points:100,seconds:100,waitForExpiry:true},groundProgress:groundPlan(),rearm:carrierPlan(),groundTargets:[{id:"gun",type:"artillery",position:{x:0,y:40,z:0},yaw:0,required:false,scoreRole:"ground"}],fighterWaves:[{id:"attack",trigger:{kind:"time",seconds:0},count:1,role:"raider",scoreRole:"raider",attackSector:"beach"}]}; }
describe("Dormant D5 shared rules",()=>{
 it("credits an attacking aircraft once without ending a held score phase",()=>{
  const b={...MissionCatalog.Get(1),phases:[phase()]}, state=BlueprintRunner.NewState(b,0), ledger=new TargetScore(MissionCatalog.Scoring(b));
  expect(recordScoredKill(state,ledger,"attack-1","air",false,1,"raider")).toBe(true);
  const points=ledger.Total(); expect(points).toBeGreaterThan(0);
  expect(recordScoredKill(state,ledger,"attack-1","air",false,2,"raider")).toBe(false); expect(ledger.Total()).toBe(points); expect(state.outcome).toBeUndefined();
 });
 it("holds uncleared sectors, advances once, orders dependencies and never catches up a successor",()=>{
  const p=groundPlan(), s=newGroundProgress(p), ids=new Set<string>(); expect(stepGroundProgress(p,s,ids,50).size()).toBe(0);
  ids.add("gun"); expect(stepGroundProgress(p,s,ids,10)).toEqual(["Advance","Secured"]); expect(s[1].elapsed).toBe(0);
  expect(stepGroundProgress(p,s,ids,10)).toEqual(["Troops advance","Ridge secured"]); expect(stepGroundProgress(p,s,ids,10).size()).toBe(0);
 });
 it("bounds damage, warns once, preserves sector identity and stops a lost force",()=>{
  const p=groundPlan(), s=newGroundProgress(p); expect(attackSectorIndex(p,s,"beach")).toBe(0); expect(attackSectorIndex(p,s,"missing")).toBeUndefined();
  expect(damageSector(s[0],10)).toBe(true); expect(damageSector(s[0],math.huge)).toBe(false); expect(damageSector(s[0],100)).toBe(false);
  expect(s[0].health).toBe(0); expect(attackSectorIndex(p,s,"beach")).toBeUndefined(); expect(stepGroundProgress(p,s,new Set(["gun"]),100).size()).toBe(0);
 });
 it("lands on the deck, taxis to the catapult and reuses the bounded three-second launch",()=>{
  const p=carrierPlan(); expect(rearmPose(p,10).y).toBe(100); expect(rearmPose(p,13).z).toBe(100); expect(carrierRearmPose(p,18).z).toBe(-240);
  const finalPose=rearmPose(p,rearmDuration(p)); expect(finalPose.z).toBeLessThan(-700); expect(finalPose.y).toBe(100); expect(rearmPose(p,1000)).toEqual(finalPose);
 });
 it("validates budgets, references, deck footprint and no aircraft fallback",()=>{
  validateBatchD5([phase()],3000);
  for(const mutate of [(p:MissionPhaseBlueprint)=>{p.groundProgress!.sectors[0].after="ridge";},(p:MissionPhaseBlueprint)=>{p.groundProgress!.sectors[0].clearTargetIds=["missing"];},(p:MissionPhaseBlueprint)=>{p.fighterWaves![0].attackSector="missing";},(p:MissionPhaseBlueprint)=>{p.rearm!.carrier!.catapult.x=100;},(p:MissionPhaseBlueprint)=>{p.rearm!.takeoffSeconds=3;},(p:MissionPhaseBlueprint)=>{p.groundProgress!.sectors[0].route.speed=0/0;}]) { const p=phase(); mutate(p); const [ok]=pcall(()=>validateBatchD5([p],3000)); expect(ok).toBe(false); }
 });
 it("keeps missions other than M09 dormant and supplies distinct M09 labels",()=>{
  for(let i=0;i<=18;i++) { if(i===9) continue; const b=MissionCatalog.Get(i); for(const p of b.phases) { expect(p.groundProgress).toBeUndefined(); expect(p.rearm?.carrier).toBeUndefined(); } }
  expect(GROUND_TARGET_LABELS.artillery).toBe("ARTILLERY"); expect(GROUND_TARGET_LABELS.bunker).toBe("BUNKER"); expect(GROUND_TARGET_LABELS.tank).toBe("TANK"); expect(GROUND_TARGET_LABELS.vehicle).toBe("VEHICLE");
 });
});
