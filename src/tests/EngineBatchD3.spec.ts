import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { describe, expect, it } from "@rbxts/jest-globals";
import { AreaAttack, CanyonEscape, M07_SAFE_CEILING, artilleryExposed, canyonSampleSafe, insideArea, newArtillery, stepArtillery } from "../shared/EngineBatchD3";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { validateArmament } from "../shared/SortieArmament";
import { flightAdvice } from "../shared/FlightWarnings";
import { GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
const p=(x=0,y=300,z=0)=>({x,y,z});
const canyon=(): CanyonEscape=>({ceiling:M07_SAFE_CEILING,source:p(3000,1000),warningSeconds:3,countdownSeconds:4,intervalSeconds:12,damage:30,clearance:60,channel:[p(0,300,-100),p(0,300,100)]});
function bp(): MissionBlueprint { return {...MissionCatalog.Get(1),ground:[],scoring:{...MissionCatalog.Scoring(MissionCatalog.Get(1)),points:{ground:100},basis:"points"},terrainRelativeWarnings:true,countdownSeconds:900,phases:[{kind:"required_ground",label:"Installations",count:3,groundTargets:[0,1,2].map(i=>({id:`plant${i}`,type:"solar_tower" as const,position:p(i*100,0),yaw:0,required:true,scoreRole:"ground"}))},{kind:"return_line",label:"Escape south",returnLine:{a:{x:-100,z:100},b:{x:100,z:100},direction:{x:0,z:1},markerY:300},update:{objective:"Descend below 2,000 ft and head south",radio:["Artillery incoming. Use the canyon."],countdownSeconds:300},canyonEscape:canyon()}]}; }
function rejects(b: MissionBlueprint): boolean { const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(b)); return !ok; }
describe("Dormant D3 mission rules",()=>{
 it("requires all indicated installations, updates once with a fresh five-minute clock and preserves kill ids",()=>{
  const b=bp(); MissionCatalog.ValidatePolicy(b); const s=Runner.NewState(b,0); const ledger=new TargetScore(MissionCatalog.Scoring(b));
  recordScoredKill(s,ledger,"plant0","ground",true,100,"ground"); recordScoredKill(s,ledger,"plant1","ground",true,200,"ground");
  expect(s.phaseIndex).toBe(0); recordScoredKill(s,ledger,"plant2","ground",true,400,"ground");
  expect(s.phaseIndex).toBe(1); expect(Runner.TimeRemaining(s)).toBe(300); expect(s.elapsed).toBe(400); expect(s.updateSerial).toBe(1);
  recordScoredKill(s,ledger,"plant2","ground",true,400,"ground"); expect(s.updateSerial).toBe(1); expect(ledger.Total()).toBe(300); expect(s.killedIds.size()).toBe(3);
  expect(Runner.TakeRadio(s)).toBe("Artillery incoming. Use the canyon."); expect(Runner.TakeRadio(s)).toBeUndefined();
  Runner.ObserveFlight(s,p(0,600,90),p(0,600,110),0.1,401); expect(s.outcome).toBeUndefined();
  Runner.ObserveFlight(s,p(0,300,90),p(0,300,110),0.1,402); expect(s.outcome).toBe("won");
 });
 it("fails escape expiry independently of the initial strike clock",()=>{
  const s=Runner.NewState(bp(),0); for(let i=0;i<3;i++) Runner.RecordKill(s,`plant${i}`,"ground",true,400);
  Runner.Tick(s,700); expect(s.outcome).toBe("failed"); expect(s.reason).toBe("timeout");
 });
 it("warns/counts/impacts once per salvo with no warning spam or catch-up damage",()=>{
  const s=newArtillery(), plan=canyon();
  expect(stepArtillery(s,plan,0).warning).toBe(false);
  expect(stepArtillery(s,plan,1)).toEqual({warning:true,countdown:false,impact:false});
  expect(stepArtillery(s,plan,1)).toEqual({warning:false,countdown:false,impact:false});
  expect(stepArtillery(s,plan,1).countdown).toBe(true);
  expect(stepArtillery(s,plan,4).impact).toBe(true);
  expect(stepArtillery(s,plan,1).impact).toBe(false);
  expect(stepArtillery(s,plan,4).impact).toBe(false);
  expect(stepArtillery(s,plan,1).warning).toBe(true);
  expect(stepArtillery(s,plan,1000).impact).toBe(true); expect(s.cycle).toBe(2);
 });
 it("uses absolute altitude AND terrain masking, keeping terrain collision advice separate",()=>{
  const plan=canyon(); expect(artilleryExposed(plan,585,true)).toBe(false);
  expect(artilleryExposed(plan,586,true)).toBe(true); expect(artilleryExposed(plan,300,false)).toBe(true);
  expect(flightAdvice({speed:160,altitude:300,terrainClearance:150,incoming:false})).toBe("");
  expect(flightAdvice({speed:160,altitude:300,terrainClearance:50,incoming:false})).toBe("LOW ALTITUDE");
  expect(flightAdvice({speed:160,altitude:300,terrainClearance:150,terrainSeconds:1,incoming:false})).toBe("PULL UP");
 });
 it("rejects missing ground, impossible ravine clearance and ceiling breaches",()=>{
  const plan=canyon(); expect(canyonSampleSafe(plan,p(),240)).toBe(true); expect(canyonSampleSafe(plan,p(),241)).toBe(false); expect(canyonSampleSafe(plan,p())).toBe(false); expect(canyonSampleSafe(plan,p(0,586),200)).toBe(false);
 });
 it("validates canyon lifecycle, finite budgets, fresh clock and terrain warning opt-in",()=>{
  for(const patch of [{ceiling:0},{ceiling:math.huge},{damage:0/0},{intervalSeconds:2},{clearance:600},{channel:[p()]},{channel:[p(),p()]},{channel:[p(),p(0,600)]}]) { const b=bp(); b.phases[1].canyonEscape={...canyon(),...patch}; expect(rejects(b)).toBe(true); }
  let b=bp(); b.terrainRelativeWarnings=false; expect(rejects(b)).toBe(true);
  b=bp(); b.phases[1].update!.countdownSeconds=undefined; expect(rejects(b)).toBe(true);
  b=bp(); b.phases[0].canyonEscape=canyon(); expect(rejects(b)).toBe(true);
 });
 it("authors a radial multi-target footprint with bounded vertical depth",()=>{
  const area: AreaAttack={radius:100,depth:30,damage:110};
  expect(insideArea(area,p(),p(60,300,80))).toBe(true); expect(insideArea(area,p(),p(101))).toBe(false); expect(insideArea(area,p(),p(0,331))).toBe(false);
  validateArmament({areaAttack:area},false);
  for(const patch of [{radius:0},{radius:401},{depth:101},{damage:math.huge},{damage:0/0}]) { const [ok]=pcall(()=>validateArmament({areaAttack:{...area,...patch}},false)); expect(ok).toBe(false); }
  const [ok]=pcall(()=>validateArmament({areaAttack:area,antiShip:true},false)); expect(ok).toBe(false);
 });
 it("has distinct labels for the M7 installation and defence types",()=>{
  expect(GROUND_TARGET_LABELS.solar_panel).toBe("SOLAR PANEL"); expect(GROUND_TARGET_LABELS.solar_tower).toBe("SOLAR TOWER"); expect(GROUND_TARGET_LABELS.flak_gun).toBe("FLAK GUN"); expect(GROUND_TARGET_LABELS.pillbox).toBe("PILLBOX");
 });
});
