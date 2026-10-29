import { TelemetryCodec, TelemetryNumbers } from "../shared/TelemetryCodec";
import { Telemetry } from "../shared/Types";
import { FlightMath } from "../shared/FlightMath";
import { describe, expect, it } from "@rbxts/jest-globals";
import { canSkipLanding, crossesReturnLine, landingPose, landingDuration, terrainClearance, validateBatchB, ReturnLine, LandingPlan } from "../shared/EngineBatchB";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { flightAdvice, warningAltitude } from "../shared/FlightWarnings";
import { CountdownDisplay } from "../shared/CountdownDisplay";
import { takeArrival, TypedGroundTarget } from "../shared/CampaignEncounters";
const line: ReturnLine={a:{x:-100,z:11040},b:{x:100,z:11040},direction:{x:0,z:1},markerY:400};
const landing: LandingPlan={touchdown:{x:6000,y:90,z:12000},headingDegrees:0,approachDistance:2400,rolloutDistance:400,approachSeconds:30,rolloutSeconds:10,glideDegrees:3};
function blueprint(): MissionBlueprint { return {...MissionCatalog.Get(1),ground:[],phases:[{kind:"required_air",label:"Fight",count:1},{kind:"return_line",label:"Return",returnLine:line,update:{objective:"Return to base",radio:["Return across the line.","Home field is ready."],countdownSeconds:900}},{kind:"landing",label:"Landing",landing}]}; }
describe("Dormant engine batch B",()=>{
 it("crosses the finite segment only toward its completing side, including a swept endpoint",()=>{
  expect(crossesReturnLine(line,{x:0,z:11000},{x:0,z:11100})).toBe(true);
  expect(crossesReturnLine(line,{x:100,z:11000},{x:100,z:11040})).toBe(true);
  for(const pair of [[{x:0,z:11100},{x:0,z:11000}],[{x:101,z:11000},{x:101,z:11100}],[{x:0,z:11040},{x:0,z:11100}],[{x:0,z:11000},{x:10,z:11000}]]) expect(crossesReturnLine(line,pair[0],pair[1])).toBe(false);
 });
 it("uses a three-degree northbound glide and clamps touchdown/rollout without overshoot",()=>{
  const a=landingPose(landing,0),touch=landingPose(landing,30),last=landingPose(landing,100);
  expect(a.z).toBe(14400);expect(a.y).toBeCloseTo(90+2400*math.tan(math.rad(3)));
  expect(touch.y).toBe(90);expect(touch.z).toBe(12000);expect(last.z).toBe(11600);expect(last.speed).toBe(0);
  const east=landingPose({...landing,headingDegrees:90},0);expect(east.x).toBeCloseTo(3600);
  const [fx]=FlightMath.ForwardOf(east);expect(fx).toBeGreaterThan(0);
  expect(landingDuration(landing)).toBe(40);
 });
 it("fires an entry update once, resets countdown without resetting score time, navigates and excludes landing time",()=>{
  const bp=blueprint();MissionCatalog.ValidatePolicy(bp);const s=Runner.NewState(bp,0);
  Runner.RecordKill(s,"enemy","air",true,100);
  expect(s.elapsed).toBe(100);expect(Runner.TimeRemaining(s)).toBe(900);expect(s.updateSerial).toBe(1);
  expect(Runner.TakeRadio(s)).toBe("Return across the line.");expect(Runner.TakeRadio(s)).toBe("Home field is ready.");expect(Runner.TakeRadio(s)).toBeUndefined();
  expect(Runner.Objective(s).objective).toBe("Return to base");expect(Runner.NavigationPoint(s)?.z).toBe(11040);
  Runner.ObserveFlight(s,{x:0,y:400,z:11000},{x:0,y:400,z:11100},0.1,110);
  Runner.Tick(s,9999,0); expect(s.outcome).toBeUndefined();expect(s.elapsed).toBe(110);expect(Runner.TimeRemaining(s)).toBe(890);
  Runner.AdvanceLanding(s,39);expect(s.outcome).toBeUndefined();Runner.AdvanceLanding(s,1);expect(s.outcome).toBe("won");expect(s.elapsed).toBe(110);
  expect(CountdownDisplay.Limit({...bp,countdownSeconds:600})).toBe(900);
 });
 it("rejects handoff FIRE/skip for 0.75 seconds on the authoritative landing clock",()=>{
  const s=Runner.NewState(blueprint(),0);Runner.RecordKill(s,"enemy","air",true,5);Runner.ObserveFlight(s,{x:0,y:400,z:11000},{x:0,y:400,z:11100},0.1,10);
  expect(canSkipLanding(0)).toBe(false);expect(canSkipLanding(0.749)).toBe(false);expect(canSkipLanding(0.75)).toBe(true);
  Runner.AdvanceLanding(s,0,true);expect(s.outcome).toBeUndefined();
  Runner.AdvanceLanding(s,0.749,true);expect(s.outcome).toBeUndefined();
  Runner.AdvanceLanding(s,0.001,true);expect(s.outcome).toBe("won");expect(s.elapsed).toBe(10);
 });
 it("projects return guidance onto the segment and clamps both endpoints",()=>{
  const s=Runner.NewState(blueprint(),0);Runner.RecordKill(s,"enemy","air",true,5);
  for (const x of [-200,-100,-25,100,200]) expect(Runner.NavigationPoint(s,{x,y:900,z:10000})).toEqual({x:math.clamp(x,-100,100),y:400,z:11040});
  const diagonal={...line,a:{x:0,z:0},b:{x:100,z:100}};
  s.phases[1]={...s.phases[1],returnLine:diagonal};
  expect(Runner.NavigationPoint(s,{x:100,y:900,z:0})).toEqual({x:50,y:400,z:50});
 });
 it("levels the flare continuously before touchdown",()=>{
  const pitch=(t:number)=>FlightMath.ForwardOf(landingPose(landing,t))[1];
  expect(pitch(28)).toBeLessThan(pitch(29));expect(pitch(29)).toBeLessThan(pitch(29.99));expect(pitch(30)).toBeCloseTo(0);
 });
 it("computes mountain clearance, rejects no-hit/nonfinite inputs and preserves absolute fallback",()=>{
  expect(warningAltitude({altitude:850,terrainClearance:50})).toBe(50);expect(warningAltitude({altitude:850})).toBe(850);
  expect(terrainClearance(850,800)).toBe(50);expect(terrainClearance(790,800)).toBe(0);expect(terrainClearance(850)).toBeUndefined();expect(terrainClearance(math.huge,800)).toBeUndefined();
  expect(flightAdvice({speed:160,altitude:850,incoming:false,terrainClearance:50})).toBe("LOW ALTITUDE");expect(flightAdvice({speed:160,altitude:850,incoming:false})).toBe("");
 });
 it("rejects malformed line, landing, update and flag data",()=>{
  const bad: MissionBlueprint[]=[];
  let b=blueprint();b.phases[0].update={objective:"Invalid initial",radio:["No"]};bad.push(b);
  b=blueprint();b.phases[2].update={objective:"Invalid landing",radio:["No"]};bad.push(b);
  b=blueprint();b.phases[1].returnLine={...line,direction:{x:1,z:0}};bad.push(b);
  b=blueprint();b.phases[1].returnLine={...line,b:line.a};bad.push(b);
  b=blueprint();b.phases[1].update={objective:"",radio:[],countdownSeconds:-1};bad.push(b);
  b=blueprint();b.phases[2].landing={...landing,approachSeconds:0};bad.push(b);
  b=blueprint();b.phases[2].landing={...landing,glideDegrees:math.huge};bad.push(b);
  b=blueprint();b.phases[1].returnLine=undefined;bad.push(b);
  b=blueprint();b.phases=[b.phases[2],b.phases[1],b.phases[0]];bad.push(b);
  for(const item of bad) {const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(item));expect(ok).toBe(false);}
  const [ok]=pcall(()=>validateBatchB([{kind:"route",landing}],15000));expect(ok).toBe(false);
 });
 it("round-trips optional clearance/update telemetry and clears it on old packets",()=>{
  const numbers: TelemetryNumbers={health:100,speed:160,altitude:850,kills:0,total:0,missiles:10,missileCooldown:0,evadeCooldown:0,lockProgress:0,incoming:false,lockWarning:false,boundaryWarning:false,elapsed:100,timeRemaining:900,objectiveProgress:0,objectiveTotal:1,groundKills:0,targetDistance:0};
  const into={} as Telemetry;
  const packet=TelemetryCodec.Encode(1,{...numbers,terrainClearance:50,missionUpdateSeconds:8});expect(packet.size()).toBe(31);
  expect(TelemetryCodec.Decode(packet,into)).toBe(1);expect(into.terrainClearance).toBe(50);expect(into.missionUpdateSeconds).toBe(8);
  const legacy=TelemetryCodec.Encode(2,numbers);expect(legacy.size()).toBe(29);TelemetryCodec.Decode(legacy,into);expect(into.terrainClearance).toBeUndefined();expect(into.missionUpdateSeconds).toBeUndefined();
 });
 it("expresses site one destroyed -> two fighters plus standalone ace once each",()=>{
  const targets: TypedGroundTarget[]=[];for(let i=0;i<5;i++) targets.push({id:`radar${i}`,type:"radar_dome",position:{x:i,y:400,z:0},yaw:0,required:true,scoreRole:"radar",group:"site1"});
  const ctx={elapsed:0,phase:0,requiredKills:0,targets,destroyed:new Set<string>()}, fired=new Set<string>();const trigger={kind:"ground_group" as const,group:"site1"};
  for(let i=0;i<4;i++) ctx.destroyed.add(`radar${i}`);
  expect(takeArrival("fighters",trigger,ctx,fired)).toBe(false);ctx.destroyed.add("radar4");
  expect(takeArrival("fighters",trigger,ctx,fired)).toBe(true);expect(takeArrival("ace",trigger,ctx,fired)).toBe(true);expect(takeArrival("ace",trigger,ctx,fired)).toBe(false);
 });
});
