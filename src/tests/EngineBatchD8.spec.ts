import { describe, expect, it } from "@rbxts/jest-globals";
import { inRingLine, inRingSweep, RingSweep, validateBatchD8 } from "../shared/EngineBatchD8";
import { validateBatchC, jammedLockAllowed } from "../shared/EngineBatchC";
import { validateArmament } from "../shared/SortieArmament";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
const source={x:0,y:50,z:0};
function strike(): MissionPhaseBlueprint { return {kind:"required_ground",label:"Ring",count:1,groundTargets:[{id:"gun",type:"railgun_emplacement",position:source,yaw:0,required:true,scoreRole:"ground"},{id:"ecm",type:"ground_ecm",position:source,yaw:0,required:false,scoreRole:"ground",ecm:true},{id:"wreck",type:"wreck",position:source,yaw:0,required:false,scoreRole:"ground"}],jamming:{visualLockRange:500,remainingCall:"JAMMING REMAINS",clearCall:"RADAR CLEAR"}}; }
const sweep=(): RingSweep=>({guns:[{targetId:"gun",source,bearingDegrees:0}],warningSeconds:2,countdownSeconds:2,intervalSeconds:12,damage:25,sweepDegrees:90,halfWidth:10,range:45000});
function rejects(fn: ()=>void): boolean { const [ok]=pcall(fn); return !ok; }
describe("D8 dormant rules",()=>{
 it("accepts ground-only ECM and keeps visual lock restriction until the last source dies",()=>{
  validateBatchC([strike()],15360); validateBatchD8([strike()],15360);
  expect(jammedLockAllowed(1,501,strike().jamming)).toBe(false); expect(jammedLockAllowed(1,500,strike().jamming)).toBe(true); expect(jammedLockAllowed(0,20000,strike().jamming)).toBe(true);
  const p=strike(); p.groundTargets![1].ecm=undefined; expect(rejects(()=>validateBatchC([p],15360))).toBe(true);
 });
 it("permits damage-preserving required-ground service using the existing landing contract",()=>{
  const p=strike(); p.rearm=MissionCatalog.Get(6).phases[0].rearm; expect(p.rearm).toBeDefined();
  validateBatchC([p],15360); p.rearm={...p.rearm!,health:true}; expect(rejects(()=>validateBatchC([p],15360))).toBe(true);
  p.kind="required_air"; p.rearm.health=false; expect(rejects(()=>validateBatchC([p],15360))).toBe(true);
 });
 it("rejects targetable wrecks and wrong ECM classes",()=>{
  const p=strike(); p.groundTargets![2].required=true; expect(rejects(()=>validateBatchD8([p],15360))).toBe(true);
  p.groundTargets![2].required=false; p.groundTargets![0].ecm=true; expect(rejects(()=>validateBatchD8([p],15360))).toBe(true);
 });
 it("keeps guided bomb exclusive with other special conversions and validates the common footprint",()=>{
  const guidedBomb={radius:10,depth:20,damage:150}; validateArmament({guidedBomb},false);
  for(const extra of [{antiShip:true as const},{areaAttack:guidedBomb},{guidedBomb:{...guidedBomb,damage:math.huge}}]) expect(rejects(()=>validateArmament({guidedBomb,...extra},false))).toBe(true);
 });
 it("completes a five-elite formation on one credited defeat, persists its story flag and rejects duplicate credit",()=>{
  const phase: MissionPhaseBlueprint={kind:"required_air",label:"Elite",count:5,execution:{directSpawn:true},update:{objective:"Defeat elite",radio:["Elite inbound"],countdownSeconds:600},eliteFormation:{ejectionFlag:"vulture_two_recovered"}};
  validateBatchD8([phase],15360);
  const b={...MissionCatalog.Get(1),phases:[phase,{kind:"required_ground" as const,label:"After",count:1}]};
  expect(MissionCatalog.RequiredAirKills(b)).toBe(1);
  const s=BlueprintRunner.NewState(b,0), ledger=new TargetScore(MissionCatalog.Scoring(b));
  expect(recordScoredKill(s,ledger,"elite1","air",true,1,"bandit")).toBe(true);
  expect(s.phaseIndex).toBe(1); expect(s.requiredAirKills).toBe(1); expect(s.vultureTwoRecovered).toBe(true);
  expect(recordScoredKill(s,ledger,"elite1","air",true,2,"bandit")).toBe(false);
  phase.count=4; expect(rejects(()=>validateBatchD8([phase],15360))).toBe(true);
 });
 it("covers the traversed firing wedge, excludes behind/range/width misses and handles reverse sweeps",()=>{
  const p=sweep(),g=p.guns[0]; expect(inRingLine(p,g,{x:0,y:300,z:-20000},0.5)).toBe(true);
  expect(inRingSweep(p,g,{x:0,y:300,z:-20000})).toBe(true); expect(inRingSweep(p,g,{x:0,y:300,z:100})).toBe(false);
  expect(inRingSweep(p,g,{x:0,y:300,z:-46000})).toBe(false); expect(inRingSweep(p,g,{x:20000,y:300,z:0})).toBe(false);
  p.sweepDegrees=-90; expect(inRingSweep(p,g,{x:100,y:300,z:-200})).toBe(true);
 });
 it("validates live ring source identity, finite budgets and phase ownership",()=>{
  const p=strike(); p.ringSweep=sweep(); validateBatchD8([p],15360);
  for(const patch of [{range:45001},{intervalSeconds:3},{damage:0/0},{halfWidth:0},{sweepDegrees:181}]) { p.ringSweep={...sweep(),...patch}; expect(rejects(()=>validateBatchD8([p],15360))).toBe(true); }
  p.ringSweep=sweep(); p.ringSweep.guns[0].targetId="wreck"; expect(rejects(()=>validateBatchD8([p],15360))).toBe(true);
 });
 it("keeps every catalog phase opted out",()=>{
  for(let id=0;id<=18;id++) for(const p of MissionCatalog.Get(id).phases) { expect(p.ringSweep).toBeUndefined(); expect(p.eliteFormation).toBeUndefined(); }
 });
});
