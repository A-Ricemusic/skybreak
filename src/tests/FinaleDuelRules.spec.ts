import { validateEncounterIdentities } from "../shared/CampaignEncounters";
import { duelTargetId } from "../shared/FinaleDuelRules";
import { describe, expect, it } from "@rbxts/jest-globals";
import { crossesVolume, ventObstructed, dependenciesMet, newVent, stepVent, validateFinaleDuel, VentRun } from "../shared/FinaleDuelRules";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { resolveEnvironment } from "../shared/WorldEnvironments";
import { SortieArmament } from "../shared/SortieArmament";
const box=(z:number)=>({center:{x:0,y:174,z},half:{x:70,y:50,z:40}});
const vent=():VentRun=>({generators:["g1","g2","g3"],core:"core",checkpoints:[box(-3400),box(-3700)],gate:box(-3400),exit:box(-7000),openingSeconds:3});
function fixture():MissionBlueprint {
 const v=vent();
 return {...MissionCatalog.Get(18),armament:undefined,phases:[
  {kind:"required_ground",label:"Generators",count:3,groundTargets:v.generators.map(id=>({id,type:"generator",required:true,scoreRole:"ground",position:{x:0,y:104,z:-2880},yaw:0}))},
  {kind:"required_ground",label:"Vent core",count:1,hidden:true,update:{objective:"Core",radio:["Vent revealed"],countdownSeconds:1800},groundTargets:[{id:"core",type:"core",required:true,scoreRole:"ground",position:{x:-130,y:174,z:-4000},yaw:0}],finale:{vent:v}},
  {kind:"ace",label:"Rusk",update:{objective:"Duel",radio:["Rusk alone"],countdownSeconds:300},finale:{duel:{center:{x:0,y:1000,z:-2880},radius:5760,minY:800,maxY:2400},environment:"m18_voice_breaks"}}
 ]};
}
function rejects(fn:()=>void):boolean { const [ok]=pcall(fn);return !ok; }
describe("D13 dormant finale contracts",()=>{
 it("leaves practice and missions 1–17 dormant",()=>{
  for(let i=0;i<18;i++) expect(MissionCatalog.Get(i).phases.some(p=>p.finale!==undefined)).toBe(false);
 });
 it("validates ordered generator reveal, a single hidden core and final isolated duel",()=>{
  validateFinaleDuel(fixture());
  const b=fixture(); b.phases[0].groundTargets![0].required=false;
  expect(rejects(()=>validateFinaleDuel(b))).toBe(true);
  const c=fixture(); c.phases[2].optionalRaiders=1;
  expect(rejects(()=>validateFinaleDuel(c))).toBe(true);
  const d=fixture(); d.phases[2].update!.countdownSeconds=299;
  expect(rejects(()=>validateFinaleDuel(d))).toBe(true);
 });
 it("reserves generator, core and duel credits across the sortie",()=>{
  validateEncounterIdentities(fixture().phases);
  for(const id of ["g1","core",duelTargetId(2)]) {
   const b=fixture();
   b.phases.push({kind:"required_ground",label:"Collision",groundTargets:[{...b.phases[0].groundTargets![0],id}]});
   expect(rejects(()=>validateEncounterIdentities(b.phases))).toBe(true);
  }
 });
 it("rejects competing cruise ownership in the vent or duel",()=>{
  for(const index of [1,2]) {
   const b=fixture();
   b.phases[index].cruiseIntercept={site:{x:0,y:0,z:0},targets:[]};
   expect(rejects(()=>validateFinaleDuel(b))).toBe(true);
  }
 });
 it("rejects finite racks and unknown environments",()=>{
  const b=fixture(); b.armament={stock:{missiles:8}};
  expect(rejects(()=>validateFinaleDuel(b))).toBe(true);
  b.armament=undefined;b.phases[2].finale!.environment="missing";
  expect(rejects(()=>validateFinaleDuel(b))).toBe(true);
  expect(resolveEnvironment("m18_voice_breaks")?.weather).toBe("storm");
 });
 it("uses swept forgiving volumes without accepting wall-side or out-of-height shortcuts",()=>{
  expect(crossesVolume(box(-3400),{x:69,y:174,z:-3300},{x:69,y:174,z:-3500})).toBe(true);
  expect(crossesVolume(box(-3400),{x:80,y:174,z:-3300},{x:80,y:174,z:-3500})).toBe(false);
  expect(crossesVolume(box(-3400),{x:0,y:230,z:-3300},{x:0,y:230,z:-3500})).toBe(false);
 });
 it("requires generators, timed opening, ordered checkpoints, core then a distinct exit crossing",()=>{
  const p=vent(),s=newVent(),k=new Set<string>(),at=box(-3400).center;
  stepVent(s,p,k,at,at,0.1);expect(s.elapsed).toBe(0);
  for(const id of p.generators) k.add(id);expect(dependenciesMet(p,k)).toBe(true);
  stepVent(s,p,k,at,at,0.1);expect(s.checkpoint).toBe(0);
  for(let i=0;i<30;i++) stepVent(s,p,k,{x:0,y:174,z:0},{x:0,y:174,z:0},0.1);
  stepVent(s,p,k,box(-3700).center,box(-3700).center,0.1);expect(s.checkpoint).toBe(0);
  stepVent(s,p,k,at,at,0.1);expect(s.checkpoint).toBe(1);
  stepVent(s,p,k,box(-3700).center,box(-3700).center,0.1);expect(s.checkpoint).toBe(2);
  stepVent(s,p,k,p.exit.center,p.exit.center,0.1);expect(s.exited).toBe(false);
  k.add(p.core);expect(s.exited).toBe(false);
  stepVent(s,p,k,{x:0,y:174,z:-6900},{x:0,y:174,z:-7100},0.1);expect(s.exited).toBe(true);
  expect(newVent()).toEqual({checkpoint:0,elapsed:0,exited:false});
 });
 it("holds core credit until exit, starts independent duel clock and settles once",()=>{
  const b=fixture(),s=BlueprintRunner.NewState(b,0);
  for(const id of vent().generators) expect(BlueprintRunner.RecordKill(s,id,"ground",true,1)).toBe(true);
  expect(s.phaseIndex).toBe(1);expect(s.vent).toBeDefined();
  s.vent!.elapsed=3;s.vent!.checkpoint=2;
  expect(BlueprintRunner.RecordKill(s,"core","ground",true,2)).toBe(true);
  expect(s.phaseIndex).toBe(1);expect(s.outcome).toBeUndefined();
  s.vent!.elapsed=3;s.vent!.checkpoint=2;
  BlueprintRunner.ObserveFlight(s,{x:0,y:174,z:-6900},{x:0,y:174,z:-7100},0.1,10);
  expect(s.phaseIndex).toBe(2);expect(BlueprintRunner.TimeRemaining(s)).toBe(300);
  expect(BlueprintRunner.RecordKill(s,duelTargetId(2),"ace",true,11)).toBe(true);
  expect(s.outcome).toBe("won");
  expect(BlueprintRunner.RecordKill(s,duelTargetId(2),"ace",true,12)).toBe(false);
  const retry=BlueprintRunner.NewState(b,0);expect(retry.killedIds.size()).toBe(0);
 });
 it("expires the duel independently without a finale",()=>{
  const b=fixture(),s=BlueprintRunner.NewState(b,0);
  for(const id of vent().generators) BlueprintRunner.RecordKill(s,id,"ground",true,1);
  s.vent!.elapsed=3;s.vent!.checkpoint=2;
  BlueprintRunner.RecordKill(s,"core","ground",true,2);
  s.vent!.elapsed=3;s.vent!.checkpoint=2;
  BlueprintRunner.ObserveFlight(s,{x:0,y:174,z:-6900},{x:0,y:174,z:-7100},0.1,100);
  BlueprintRunner.Tick(s,399,100);expect(s.outcome).toBeUndefined();
  BlueprintRunner.Tick(s,400,100);expect(s.outcome).toBe("failed");
  expect(BlueprintRunner.RecordKill(s,"late","ace",true,400)).toBe(false);
 });
 it("segments long vent sightlines and blocks a roof between camera and core",()=>{
  let rays=0,max=0;
  expect(ventObstructed({x:0,y:0,z:0},{x:0,y:0,z:31000},(o,d)=>{rays++;max=math.max(max,math.abs(d.z));return o.z>=16000 ? 10 : undefined;})).toBe(true);
  expect(rays).toBe(17);expect(max).toBeLessThanOrEqual(1000);
  expect(ventObstructed({x:0,y:174,z:0},{x:0,y:174,z:2000},()=>undefined)).toBe(false);
 });
 it("continues partial rack regeneration with no transition refill",()=>{
  const [count,progress]=SortieArmament.RackTick(2,1,0.1,undefined);
  expect(count).toBe(2);expect(progress).toBeCloseTo(1.1);
 });
});
