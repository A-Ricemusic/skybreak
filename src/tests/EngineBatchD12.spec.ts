import { describe, expect, it } from "@rbxts/jest-globals";
import { bridgeRouteClosed, leaderPose, newWithdrawal, stepWithdrawal, validateBatchD12 } from "../shared/EngineBatchD12";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { AlliedRules } from "../shared/AlliedRules";
import { newGroundProgress, stepGroundProgress } from "../shared/EngineBatchD5";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
const departure={waypoints:[{x:0,y:500,z:0},{x:-2000,y:500,z:0}],speed:200};
function phase(): MissionPhaseBlueprint { return {kind:"required_air",label:"Last wing",count:4,execution:{directSpawn:true},update:{objective:"Defeat four wingmen; Rusk will depart",radio:[],countdownSeconds:1080},leaderWithdrawal:{departure}}; }
function rejects(fn:()=>void): boolean { const [ok]=pcall(fn); return !ok; }
describe("D12 protected leader and bridge rules",()=>{
 it("requires four credited wingmen then departure, never pays for Rusk or repeated kills",()=>{
  const p=phase(); validateBatchD12([p],15360);
  const b={...MissionCatalog.Get(1),phases:[p,{kind:"required_ground" as const,label:"Next",count:1}]};
  const s=BlueprintRunner.NewState(b,0), ledger=new TargetScore(MissionCatalog.Scoring(b));
  expect(MissionCatalog.RequiredAirKills(b)).toBe(4);
  BlueprintRunner.ObserveLeaderDeparture(s); expect(s.phaseIndex).toBe(0);
  for(let i=0;i<4;i++) expect(recordScoredKill(s,ledger,`wing${i}`,"air",true,1,"bandit")).toBe(true);
  expect(s.phaseIndex).toBe(0); expect(s.requiredAirKills).toBe(4); expect(s.vultureTwoRecovered).toBeUndefined();
  expect(recordScoredKill(s,ledger,"wing0","air",true,2,"bandit")).toBe(false);
  BlueprintRunner.ObserveLeaderDeparture(s); expect(s.phaseIndex).toBe(1); expect(s.ruskDeparted).toBe(true);
  BlueprintRunner.ObserveLeaderDeparture(s); expect(s.phaseIndex).toBe(1); expect(s.requiredAirKills).toBe(4);
 });
 it("holds leader until four kills, pauses on invalid time and emits completion once",()=>{
  const state=newWithdrawal(),p=phase().leaderWithdrawal!;
  expect(stepWithdrawal(state,p,3,500)).toBe(false); expect(state.elapsed).toBe(0);
  for(const dt of [0,-1,0/0,math.huge]) expect(stepWithdrawal(state,p,4,dt)).toBe(false);
  expect(stepWithdrawal(state,p,4,5)).toBe(false); expect(leaderPose(p,state).position.x).toBe(-1000);
  expect(stepWithdrawal(state,p,4,1000)).toBe(true); expect(leaderPose(p,state).position.x).toBe(-2000);
  expect(stepWithdrawal(state,p,4,1)).toBe(false);
 });
 it("rejects overlapping lifecycles, incorrect counts and malformed departure budgets",()=>{
  for(const patch of [{count:5},{eliteFormation:{ejectionFlag:"vulture_two_recovered" as const}},{execution:{directSpawn:false}},{twist:{}}]) expect(rejects(()=>validateBatchD12([{...phase(),...patch} as MissionPhaseBlueprint],15360))).toBe(true);
  for(const route of [{...departure,speed:0},{...departure,speed:math.huge},{...departure,waypoints:[departure.waypoints[0],departure.waypoints[0]]},{...departure,waypoints:[departure.waypoints[0],{x:16000,y:500,z:0}]}]) expect(rejects(()=>validateBatchD12([{...phase(),leaderWithdrawal:{departure:route}}],15360))).toBe(true);
  const p=phase(); p.update!.countdownSeconds=35; expect(rejects(()=>validateBatchD12([p],15360))).toBe(true);
 });
 it("protects required wingmen from allied engagement and in-flight kill credit",()=>{
  const policy=MissionCatalog.Get(1).allies!;
  expect(AlliedRules.CanEngage(policy,{required:true,role:"bandit",enabled:true,health:100})).toBe(false);
  expect(AlliedRules.ShotDamage(policy,0,true,1000)).toBe(0);
  expect(AlliedRules.BudgetRemaining({...policy,killBudget:1},1)).toBe(false);
  expect(AlliedRules.WarnsPlayer(undefined,"bridge-force")).toBe(false);
  expect(AlliedRules.WarnsPlayer({},undefined)).toBe(false); expect(AlliedRules.WarnsPlayer(undefined)).toBe(true);
 });
 it("closes only linked routes after actual bridge destruction and preserves independent routes",()=>{
  const links=[{targetId:"bridge",sectorIds:["crossing"],hullIds:["ship"]}], killed=new Set<string>();
  expect(bridgeRouteClosed(links,killed,"ship","hull")).toBe(false);
  killed.add("bridge"); expect(bridgeRouteClosed(links,killed,"ship","hull")).toBe(true);
  expect(bridgeRouteClosed(links,killed,"witnesses","sector")).toBe(false);
  const sector={id:"crossing",clearTargetIds:["bridge"],seconds:20,health:100,route:{...departure,speed:100},kind:"column" as const,advanceCall:"Go",securedCall:"Safe",hitCall:"Hit"};
  const plan={sectors:[sector,{...sector,id:"witnesses"}]},states=newGroundProgress(plan);
  stepGroundProgress(plan,states,killed,1,new Set(["crossing"]));
  expect(states[0].elapsed).toBe(0); expect(states[0].secured).toBe(false); expect(states[1].elapsed).toBe(1);
 });
 it("validates same-phase bridge and route identities",()=>{
  const p: MissionPhaseBlueprint={kind:"required_ground",label:"Bridge",count:1,groundTargets:[{id:"bridge",type:"bridge_section",required:true,position:{x:0,y:32,z:0},yaw:0,scoreRole:"ground"},{id:"ship",type:"destroyer",required:false,position:{x:0,y:32,z:0},yaw:0,scoreRole:"ground",route:departure}],bridgeClosures:[{targetId:"bridge",sectorIds:[],hullIds:["ship"]}]};
  validateBatchD12([p],15360);
  p.bridgeClosures![0].hullIds.push("ship"); expect(rejects(()=>validateBatchD12([p],15360))).toBe(true);
  p.bridgeClosures![0].hullIds=["unknown"]; expect(rejects(()=>validateBatchD12([p],15360))).toBe(true);
 });
 it("keeps all catalog missions dormant",()=>{
  for(let id=0;id<=18;id++) for(const p of MissionCatalog.Get(id).phases) { expect(p.leaderWithdrawal).toBeUndefined(); expect(p.bridgeClosures).toBeUndefined(); }
 });
});
