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
 it("uses the accepted once-only optional air kill path and cannot be claimed by armed allies",()=>{
  const b=d9Fixture(),s=BlueprintRunner.NewState(b,0);
  expect(BlueprintRunner.RecordKill(s,"balloon","air",false,1)).toBe(true);expect(BlueprintRunner.RecordKill(s,"balloon","air",false,1)).toBe(false);
  const ledger=new TargetScore({basis:"points",points:{jammer:100},rank:{S:400,A:300,B:200,C:100}});
  ledger.RecordKill("balloon","jammer");ledger.RecordKill("balloon","jammer");expect(ledger.Total()).toBe(100);
  expect(AlliedRules.CanEngage({} as Parameters<typeof AlliedRules.CanEngage>[0],{role:"bomber",required:false,enabled:true,health:60})).toBe(false);
 });
 it("keeps all catalog missions and practice dormant",()=>{for(const b of MissionCatalog.All()) for(const p of MissionCatalog.ExpandedPhases(b)) expect(p.spatialJamming).toBeUndefined();});
});
