import { describe, expect, it } from "@rbxts/jest-globals";
import { arrivalDue, takeArrival, scramblePose, TypedGroundTarget, FighterArrival } from "../shared/CampaignEncounters";
import { GroundAirDefence as AA } from "../shared/GroundAirDefence";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { targetScoreLines } from "../shared/OutcomePoints";
import { AirRequest, WavePlan } from "../shared/WavePlan";
import { mission as practiceSnapshot } from "./EnginePracticeSnapshot";
import { mission as m01Snapshot } from "./EngineM01Snapshot";
const target: TypedGroundTarget={id:"b1",type:"parked_bomber",position:{x:0,y:50,z:0},yaw:90,required:true,scoreRole:"parked_bomber",group:"apron"};
const wave: FighterArrival={id:"scramble",trigger:{kind:"time",seconds:45},count:3,role:"raider",scoreRole:"fighter",spawn:{x:0,y:50,z:0},headingDegrees:0,scramble:true};
function blueprint(): MissionBlueprint { return {...MissionCatalog.Get(1),id:2,ground:[], phases:[{kind:"required_ground",label:"Strike",count:1,groundTargets:[target,{...target,id:"h1",type:"hangar",required:false,scoreRole:"hangar"}],fighterWaves:[wave],standaloneAce:{id:"ace",name:"DUSK",livery:"Rusk",health:200,trigger:{kind:"ground_group",group:"apron"},behaviour:"ground_attack",scoreRole:"ace"}}],scoring:{basis:"points",points:{parked_bomber:120,hangar:50,aa_gun:20,control_tower:100,substation:100,fighter:60,ace:240},rank:{S:2400,A:2000,B:1500,C:1320}}}; }
describe("Dormant campaign engine",()=>{
 it("scores M02 reference inventory exactly once by type for 2610",()=>{
  const ledger=new TargetScore(blueprint().scoring!);
  for(const [role,count] of pairs({parked_bomber:11,hangar:7,aa_gun:4,control_tower:1,substation:1,fighter:7,ace:1})) for(let i=0;i<count;i++) {expect(ledger.RecordKill(`${role}${i}`,role)).toBe(true);expect(ledger.RecordKill(`${role}${i}`,role)).toBe(false);}
  expect(ledger.Total()).toBe(2610); expect(targetScoreLines(ledger.Snapshot()).size()).toBe(7);
  const custom=new TargetScore({ ...blueprint().scoring!,points:{structure:50} }); custom.RecordKill("hangar","structure","hangar"); expect(targetScoreLines(custom.Snapshot())[0].label).toBe("HANGAR ×1");
 });
 it("counts required ground only, optional ground stays destroyable and scores once",()=>{
  const bp=blueprint(); MissionCatalog.ValidatePolicy(bp); const s=BlueprintRunner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  expect(recordScoredKill(s,ledger,"h1","ground",false,1,"hangar")).toBe(true); expect(recordScoredKill(s,ledger,"h1","ground",false,1,"hangar")).toBe(false);
  expect(s.phaseProgress).toBe(0);expect(s.optionalAirKills).toBe(0);expect(s.optionalGroundKills).toBe(1);
  expect(recordScoredKill(s,ledger,"fighter","air",false,2,"fighter")).toBe(true);expect(recordScoredKill(s,ledger,"ace","ace",false,2,"ace")).toBe(true);
  expect(s.phaseProgress).toBe(0);expect(recordScoredKill(s,ledger,"b1","ground",true,3,"parked_bomber")).toBe(true);expect(s.outcome).toBe("won");expect(ledger.Total()).toBe(470);
 });
 it("allows optional ground targets during an air objective without advancing it",()=>{
  const bp=blueprint();bp.phases=[{kind:"required_air",label:"Intercept",count:2,groundTargets:[{...target,required:false}]}];MissionCatalog.ValidatePolicy(bp);
  const state=BlueprintRunner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);expect(recordScoredKill(state,ledger,"b1","ground",false,1,"parked_bomber")).toBe(true);expect(state.phaseProgress).toBe(0);expect(state.requiredGroundKills).toBe(0);expect(ledger.Total()).toBe(120);
 });
 it("gates AA by range, life, active phase and two-gun cap; difficulty and evade are explicit",()=>{
  expect(AA.Eligible(true,true,1500)).toBe(true);expect(AA.Eligible(true,true,1501)).toBe(false);expect(AA.Eligible(true,true,79)).toBe(false);expect(AA.Eligible(false,true,500)).toBe(false);expect(AA.Eligible(true,false,500)).toBe(false);
  expect(AA.Admit(1)).toBe(true);expect(AA.Admit(2)).toBe(false);expect(AA.Hit(.34,"normal",false)).toBe(true);expect(AA.Hit(.34,"easy",false)).toBe(false);expect(AA.Hit(.4,"ace",false)).toBe(true);expect(AA.Hit(0,"normal",true)).toBe(false);
 });
 it("fires each ace/wave trigger once at control time or a named event",()=>{
  const context={elapsed:44.99,phase:0,requiredKills:0,destroyed:new Set<string>(),targets:[target]}, fired=new Set<string>();
  expect(takeArrival("time",wave.trigger,context,fired)).toBe(false);context.elapsed=45;expect(takeArrival("time",wave.trigger,context,fired)).toBe(true);expect(takeArrival("time",wave.trigger,context,fired)).toBe(false);
  const group={kind:"ground_group" as const,group:"apron"};expect(takeArrival("ace",group,context,fired)).toBe(false);context.destroyed.add("b1");expect(takeArrival("ace",group,context,fired)).toBe(true);expect(takeArrival("ace",group,context,fired)).toBe(false);
  expect(arrivalDue({kind:"phase_start",phase:1},context)).toBe(false);context.phase=1;expect(takeArrival("phase",{kind:"phase_start",phase:1},context,fired)).toBe(true);expect(takeArrival("phase",{kind:"phase_start",phase:1},context,fired)).toBe(false);
  expect(arrivalDue({kind:"required_count",count:2},context)).toBe(false);context.requiredKills=2;expect(takeArrival("kills",{kind:"required_count",count:2},context,fired)).toBe(true);expect(takeArrival("kills",{kind:"required_count",count:2},context,fired)).toBe(false);
 });
 it("retains runway spawn and scoring metadata through split capped admission, rolls then climbs",()=>{
  const queue:AirRequest[]=[{role:"raider",count:3,behind:false,arrival:wave}];const batch=WavePlan.Admit(queue,1);expect(batch[0].arrival).toEqual(wave);expect(queue[0].count).toBe(2);expect(WavePlan.Admit(queue,7)[0].arrival).toEqual(wave);
  expect(scramblePose(wave.spawn!,0,0)).toEqual(wave.spawn);expect(scramblePose(wave.spawn!,0,3).y).toBe(50);expect(scramblePose(wave.spawn!,0,8).y).toBe(275);expect(scramblePose(wave.spawn!,90,3).x).toBeGreaterThan(100);
 });
 it("validates one-phase missions and rejects duplicate ids, missing roles and invalid triggers",()=>{
  MissionCatalog.ValidatePolicy(blueprint());
  for(const mode of [0,1,2,3,4]) { const bp=blueprint(); const p=bp.phases[0]; if(mode===0)p.groundTargets![1].id="b1";if(mode===1)p.groundTargets![0].scoreRole="missing";if(mode===2)p.fighterWaves![0].trigger={kind:"ground_group",group:"missing"};if(mode===3)p.fighterWaves![0].spawn=undefined;if(mode===4)p.count=2;const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(bp));expect(ok).toBe(false); }
 });
 it("freezes entire practice and M01 catalog entries and their authored phase spawns",()=>{
  expect({...MissionCatalog.Get(0),optionalRaiderMax:undefined}).toEqual(practiceSnapshot);expect({...MissionCatalog.Get(1),optionalRaiderMax:undefined}).toEqual(m01Snapshot);
  for(const id of [0,1]) {const p=MissionCatalog.Get(id);for(const phase of p.phases){expect(phase.groundTargets).toBeUndefined();expect(phase.fighterWaves).toBeUndefined();expect(phase.standaloneAce).toBeUndefined();}}
 });
});
