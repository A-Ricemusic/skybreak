import { validateBatchC } from "../shared/EngineBatchC";
import { validateBatchD8 } from "../shared/EngineBatchD8";
import { validateBatchD9 } from "../shared/EngineBatchD9";
import { GunRules } from "../shared/SortieArmament";
import { describe, expect, it } from "@rbxts/jest-globals";
import { coveringJammers, inJammingCorridor, navigationStep } from "../shared/EngineBatchD9";
import { MissionCatalog } from "../shared/MissionCatalog";
import { d9Fixture } from "./EngineBatchD9Fixture";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { AlliedRules } from "../shared/AlliedRules";
describe("D9 dormant spatial jammer rules",()=>{
 it("bounds the capsule in three dimensions, including caps and radius edge",()=>{
  const c=d9Fixture().phases[0].spatialJamming!.corridors[0];
  expect(inJammingCorridor({x:1300,y:900,z:4500},c)).toBe(true);
  expect(inJammingCorridor({x:1301,y:900,z:4500},c)).toBe(false);
  expect(inJammingCorridor({x:1000,y:1201,z:4500},c)).toBe(false);
  expect(inJammingCorridor({x:1000,y:900,z:6301},c)).toBe(false);
  c.b=c.a;expect(inJammingCorridor(c.a,c)).toBe(true);
 });
 it("counts live sources once, clears locally with distant sources still alive",()=>{
  const p=d9Fixture().phases[0].spatialJamming!,at={x:1000,y:900,z:4500};p.corridors.push(p.corridors[0]);
  expect(coveringJammers(p,at,["balloon"])).toBe(1);expect(coveringJammers(p,at,[])).toBe(0);
  expect(coveringJammers(p,{x:8000,y:900,z:0},["balloon"])).toBe(0);
 });
 it("holds navigation only locally, caps total delay and ignores invalid time",()=>{
  expect(navigationStep(10,true,0,20).advance).toBe(0);
  const s=navigationStep(15,true,10,20);expect(s.held).toBe(20);expect(s.advance).toBe(5);
  expect(navigationStep(10,true,20,20).advance).toBe(10);expect(navigationStep(10,false,0,20).advance).toBe(10);
  expect(navigationStep(math.huge,true,0,20).held).toBe(0);
 });
 it("validates dormant opt-in and rejects invalid sources, geometry and unbounded holds",()=>{
  MissionCatalog.ValidatePolicy(d9Fixture());
  const changes=[(b:ReturnType<typeof d9Fixture>)=>{b.scoring!.points.jammer=0;},(b:ReturnType<typeof d9Fixture>)=>{b.armament=undefined;},(b:ReturnType<typeof d9Fixture>)=>{b.phases[0].spatialJamming!.corridors[0].sourceId="missing";},(b:ReturnType<typeof d9Fixture>)=>{b.phases[0].spatialJamming!.navigationHoldSeconds=math.huge;},(b:ReturnType<typeof d9Fixture>)=>{b.phases[0].spatialJamming!.airships[0].position.y=0;},(b:ReturnType<typeof d9Fixture>)=>{b.phases[0].spatialJamming!.corridors[0].radius=0;},(b:ReturnType<typeof d9Fixture>)=>{b.phases[0].execution=undefined;}];
  for(const change of changes) {const b=d9Fixture();change(b);expect(pcall(()=>MissionCatalog.ValidatePolicy(b))[0]).toBe(false);}
 });
 it("resolves the authored airship through D1 visual gun targeting",()=>{
  const a=d9Fixture().phases[0].spatialJamming!.airships[0];
  expect(GunRules.Resolve({x:a.position.x,y:a.position.y,z:a.position.z+200},{x:0,y:0,z:-1},[{position:a.position,ground:false,allowed:true}])).toBe(0);
 });
 it("uses the accepted once-only optional air kill path and cannot be claimed by armed allies",()=>{
  const b=d9Fixture(),s=BlueprintRunner.NewState(b,0);
  expect(BlueprintRunner.RecordKill(s,"balloon","air",false,1)).toBe(true);expect(BlueprintRunner.RecordKill(s,"balloon","air",false,1)).toBe(false);
  const ledger=new TargetScore({basis:"points",points:{jammer:100},rank:{S:400,A:300,B:200,C:100}});
  ledger.RecordKill("balloon","jammer");ledger.RecordKill("balloon","jammer");expect(ledger.Total()).toBe(100);
  expect(AlliedRules.CanEngage({} as Parameters<typeof AlliedRules.CanEngage>[0],{role:"bomber",required:false,enabled:true,health:60})).toBe(false);
 });
 it("admits all 32 M13 balloons without a thirteenth-kill cutoff, and bounds the 33rd",()=>{
  const b=d9Fixture(),p=b.phases[0].spatialJamming!,a=p.airships[0],c=p.corridors[0];
  p.airships=[];p.corridors=[];
  for(let i=0;i<32;i++) {p.airships.push({...a,id:`balloon${i}`});p.corridors.push({...c,sourceId:`balloon${i}`});}
  MissionCatalog.ValidatePolicy(b);const s=BlueprintRunner.NewState(b,0),ledger=new TargetScore(b.scoring!);
  for(const a0 of p.airships) {expect(BlueprintRunner.RecordKill(s,a0.id,"air",false,1)).toBe(true);ledger.RecordKill(a0.id,a0.scoreRole);}
  expect(ledger.Total()).toBe(3200);expect(s.outcome).toBeUndefined();
  p.airships.push({...a,id:"overflow"});expect(pcall(()=>MissionCatalog.ValidatePolicy(b))[0]).toBe(false);
 });
 it("validates D8 global ground ECM alongside D9 airship corridors without admitting ground corridor sources",()=>{
  const b=d9Fixture(), spatial=b.phases[0];
  const ground={kind:"required_ground" as const,label:"ECM",count:1,jamming:spatial.jamming,groundTargets:[{id:"ecm",type:"ground_ecm" as const,position:{x:0,y:50,z:0},yaw:0,required:true,scoreRole:"ground",ecm:true as const}]};
  const phases=[ground,spatial];
  validateBatchC(phases,15360);validateBatchD8(phases,15360);validateBatchD9(phases,15360,true,b.scoring!.points);
  spatial.spatialJamming!.corridors[0].sourceId="ecm";
  expect(pcall(()=>validateBatchD9(phases,15360,true,b.scoring!.points))[0]).toBe(false);
 });
 it("keeps all catalog missions and practice dormant",()=>{for(const b of MissionCatalog.All()) for(const p of MissionCatalog.ExpandedPhases(b)) expect(p.spatialJamming).toBeUndefined();});
});
