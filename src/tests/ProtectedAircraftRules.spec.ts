import { describe, expect, it } from "@rbxts/jest-globals";
import { damageProtected, protectedDuration, protectedPose, protectionResult, stepProtected, ProtectedState } from "../shared/ProtectedAircraftRules";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { AlliedRules } from "../shared/AlliedRules";
import { protectedAircraftFixture } from "./ProtectedAircraftFixture";
const state=():ProtectedState=>({health:100,elapsed:0,safe:false,warned:false});
describe("Dormant D7 protection contracts",()=>{
 it("accepts 2800/900 bands and samples full routes without altitude clipping",()=>{
  const b=protectedAircraftFixture(); MissionCatalog.ValidatePolicy(b);
  const p=b.phases[0].protection!; expect(protectedPose(p.aircraft[0],100).position.y).toBe(2800); expect(protectedPose(p.aircraft[1],100).position.y).toBe(900);
  expect(protectedDuration(p.aircraft[0])).toBe(200); expect(protectedPose(p.aircraft[0],400).position.z).toBe(-6000);
 });
 it("supports one evidence aircraft and rejects nonfinite damage/time without advancing",()=>{
  const b=protectedAircraftFixture();b.phases[0].protection!.aircraft.pop();MissionCatalog.ValidatePolicy(b);
  const a=state();stepProtected(a,b.phases[0].protection!.aircraft[0],0/0);expect(a.elapsed).toBe(0);expect(damageProtected(a,math.huge)).toBe(false);
  const s=R.NewState(b,0);R.ObserveProtection(s,1,false);expect(s.outcome).toBe("won");
 });
 it("keeps health and progress independent; all safe wins once without killing threats",()=>{
  const p=protectedAircraftFixture().phases[0].protection!, a=state(), b=state();
  stepProtected(a,p.aircraft[0],200); stepProtected(b,p.aircraft[1],200);
  expect(a.safe).toBe(true); expect(b.safe).toBe(false); expect(protectionResult([a,b])).toBeUndefined();
  expect(damageProtected(a,200)).toBe(false); expect(a.health).toBe(100);
  stepProtected(b,p.aircraft[1],10); expect(protectionResult([a,b])).toBe("safe");
  const s=R.NewState(protectedAircraftFixture(),0);s.score=240;R.ObserveProtection(s,1,false);expect(s.outcome).toBeUndefined();R.ObserveProtection(s,2,false);R.ObserveProtection(s,0,true);expect(s.outcome).toBe("won");expect(s.score).toBe(240);expect(s.killedIds.size()).toBe(0);
 });
 it("warns on first damage only and fails either aircraft loss",()=>{
  const a=state(), b=state(); expect(damageProtected(a,10)).toBe(true); expect(damageProtected(a,10)).toBe(false);expect(a.health).toBe(80);expect(b.health).toBe(100);
  damageProtected(b,200);expect(protectionResult([a,b])).toBe("lost");const s=R.NewState(protectedAircraftFixture(),0);R.ObserveProtection(s,0,true);expect(s.reason).toBe("protected_lost");
 });
 it("keeps hostile kill credit once-only and independent of protection progress",()=>{
  const s=R.NewState(protectedAircraftFixture(),0);
  expect(R.RecordKill(s,"attacker-1","air",false,10)).toBe(true);
  expect(R.RecordKill(s,"attacker-1","air",false,10)).toBe(false);
  expect(s.optionalAirKills).toBe(1);expect(s.phaseProgress).toBe(0);expect(s.outcome).toBeUndefined();
 });
 it("times out incomplete protection and preserves player death precedence",()=>{
  const s=R.NewState(protectedAircraftFixture(),0);R.Tick(s,330);expect(s.reason).toBe("timeout");
  const dead=R.NewState(protectedAircraftFixture(),0);R.Tick(dead,10,0);R.ObserveProtection(dead,2,false);expect(dead.reason).toBe("destroyed");
 });
 it("rejects malformed health, routes, assignments, altitude and incompatible objectives",()=>{
  const changes:((b:MissionBlueprint)=>void)[]=[b=>{b.phases[0].protection!.aircraft[0].health=0;},b=>{b.phases[0].protection!.altitudeCeiling=3600;},b=>{b.phases[0].protection!.aircraft[0].route.waypoints[0].y=2801;},b=>{b.phases[0].protection!.aircraft[0].route.speed=0;},b=>{b.phases[0].protection!.aircraft[0].route.waypoints[1]=b.phases[0].protection!.aircraft[0].route.waypoints[0];},b=>{b.phases[0].fighterWaves![0].attackProtected="missing";},b=>{b.phases[0].protection!.aircraft[1].id="high";},b=>{b.phases[0].count=1;},b=>{b.phases[0].fighterWaves![0].spawn!.y=2801;}];
  for(const change of changes) {const b=protectedAircraftFixture();change(b);const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(b));expect(ok).toBe(false);}
 });
 it("keeps protected friendlies out of targeting and player warnings; accepts D5 sector suppression",()=>{
  expect(AlliedRules.PlayerTarget({friendly:true,enabled:true,health:100})).toBe(false);
  expect(AlliedRules.WarnsPlayer({})).toBe(false);expect(AlliedRules.WarnsPlayer(undefined,"beach")).toBe(false);expect(AlliedRules.WarnsPlayer(undefined)).toBe(true);
 });
 it("leaves practice, M01–M06 and all catalog opt-ins unchanged",()=>{
  for(const b of MissionCatalog.All().filter(b=>b.id!==11 && b.id!==13)) for(const p of MissionCatalog.ExpandedPhases(b)) {expect(p.protection).toBeUndefined(); for(const w of p.fighterWaves ?? []) expect(w.attackProtected).toBeUndefined();}
 });
});
