import { TelemetryCodec, TelemetryNumbers } from "../shared/TelemetryCodec";
import { Telemetry } from "../shared/Types";
import { describe, expect, it } from "@rbxts/jest-globals";
import { jammedLockAllowed, thresholdResult, validateBatchC, rearmPose, rearmDuration, RearmPlan } from "../shared/EngineBatchC";
import { validateNightLighting, searchlightHeading } from "../shared/NightLighting";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { AssetSelection } from "../shared/AssetSelection";
const rearm: RearmPlan={zone:{x:0,y:100,z:0},radius:200,landing:{touchdown:{x:0,y:20,z:0},headingDegrees:0,approachDistance:2400,rolloutDistance:400,approachSeconds:30,rolloutSeconds:10,glideDegrees:3},takeoffSeconds:10,missiles:true,special:true,health:true};
function blueprint(): MissionBlueprint { return {...MissionCatalog.Get(1),ground:[],phases:[{kind:"score_threshold",label:"Strike",scoreThreshold:{points:2000,seconds:600,waitForExpiry:true},rearm},{kind:"return_line",label:"Escape south",returnLine:{a:{x:-100,z:100},b:{x:100,z:100},direction:{x:0,z:1},markerY:300},update:{objective:"Escape south",radio:["Five aircraft inbound. Disengage south."],countdownSeconds:240}}]}; }
function rejects(fn:()=>void): boolean { const [ok]=pcall(fn); return !ok; }
describe("Dormant engine batch C",()=>{
 it("round-trips jam/score telemetry and clears every extension on legacy packets",()=>{
  const numbers: TelemetryNumbers={health:100,speed:160,altitude:850,kills:0,total:0,missiles:10,missileCooldown:0,evadeCooldown:0,lockProgress:0,incoming:false,lockWarning:false,boundaryWarning:false,elapsed:100,timeRemaining:900,objectiveProgress:0,objectiveTotal:1,groundKills:0,targetDistance:0};
  const into={} as Telemetry;
  const packet=TelemetryCodec.Encode(1,{...numbers,radarJammed:true,radarPartial:true,jamVisualRange:1200,missionPoints:2100});
  expect(packet.size()).toBe(33);TelemetryCodec.Decode(packet,into);expect(into.radarJammed).toBe(true);expect(into.radarPartial).toBe(true);expect(into.jamVisualRange).toBe(1200);expect(into.missionPoints).toBe(2100);
  const legacy=TelemetryCodec.Encode(2,numbers);expect(legacy.size()).toBe(29);TelemetryCodec.Decode(legacy,into);expect(into.radarJammed).toBe(false);expect(into.radarPartial).toBe(false);expect(into.jamVisualRange).toBeUndefined();expect(into.missionPoints).toBeUndefined();
 });
 it("holds a met goal until expiry and fails below the exact inclusive goal",()=>{
  const plan={points:2000,seconds:600,waitForExpiry:true};
  expect(thresholdResult(plan,2000,599.99)).toBe("continue");expect(thresholdResult(plan,1999,600)).toBe("failed");expect(thresholdResult(plan,2000,600)).toBe("complete");expect(thresholdResult({...plan,waitForExpiry:false},2000,4)).toBe("complete");
 });
 it("surprises at expiry once, resets the escape clock and wins only on the south crossing",()=>{
  const bp=blueprint();MissionCatalog.ValidatePolicy(bp);const s=Runner.NewState(bp,0);s.score=2000;
  Runner.Tick(s,400);expect(s.phaseIndex).toBe(0);Runner.Tick(s,600);expect(s.phaseIndex).toBe(1);expect(s.outcome).toBeUndefined();expect(Runner.TimeRemaining(s)).toBe(240);expect(s.updateSerial).toBe(1);
  Runner.Tick(s,601);expect(s.updateSerial).toBe(1);Runner.ObserveFlight(s,{x:0,y:300,z:90},{x:0,y:300,z:110},0.1,602);expect(s.outcome).toBe("won");
 });
 it("fails low score, death and escape timeout rather than advancing",()=>{
  const a=Runner.NewState(blueprint(),0);a.score=1999;Runner.Tick(a,600);expect(a.reason).toBe("timeout");
  const b=Runner.NewState(blueprint(),0);b.score=2000;Runner.Tick(b,600,0);expect(b.reason).toBe("destroyed");
  const c=Runner.NewState(blueprint(),0);c.score=2000;Runner.Tick(c,600);Runner.Tick(c,840);expect(c.reason).toBe("timeout");
 });
 it("keeps visual missile locks under any live jammer and restores normal lock after the last kill",()=>{
  const p={visualLockRange:1200,remainingCall:"Another jammer active.",clearCall:"Radar clear."};
  expect(jammedLockAllowed(2,1200,p)).toBe(true);expect(jammedLockAllowed(1,1201,p)).toBe(false);expect(jammedLockAllowed(0,5000,p)).toBe(true);expect(jammedLockAllowed(2,5000)).toBe(true);
 });
 it("reuses landing then automatically launches above the runway",()=>{
  expect(rearmDuration(rearm)).toBe(50);expect(rearmPose(rearm,30).y).toBe(20);expect(rearmPose(rearm,40).z).toBe(-400);expect(rearmPose(rearm,50).y).toBeGreaterThan(20);expect(rearmPose(rearm,50).speed).toBe(160);
 });
 it("rejects malformed score, runway, light budgets and nonfinite sweeps",()=>{
  for(const n of [0,-1,math.huge,0/0]) expect(rejects(()=>validateBatchC([{kind:"score_threshold",label:"Bad",scoreThreshold:{points:n,seconds:600,waitForExpiry:true}}],15000))).toBe(true);
  expect(rejects(()=>validateBatchC([{kind:"required_air",label:"Bad",count:1,rearm}],15000))).toBe(true);
  expect(rejects(()=>validateNightLighting({fields:[{origin:{x:0,y:10,z:0},rows:100,columns:100,spacing:10,realLights:20}],searchlights:[]},15000))).toBe(true);
  expect(rejects(()=>validateNightLighting({fields:[],searchlights:[{position:{x:0,y:10,z:0},heading:0,sweep:30,period:0,length:100}]},15000))).toBe(true);
 });
 it("sweeps smoothly within the authored arc and selects elite wingmen separately from the lead",()=>{
  const p={position:{x:0,y:10,z:0},heading:90,sweep:30,period:8,length:500};expect(searchlightHeading(p,0)).toBe(90);expect(searchlightHeading(p,2)).toBeCloseTo(120);expect(searchlightHeading(p,6)).toBeCloseTo(60);
  expect(AssetSelection.AircraftCandidates(true,"Elite")[0]).toBe("VantaV2Elite");expect(AssetSelection.AircraftCandidates(true,"Vulture")[0]).toBe("VantaV2Vulture");
 });
});
