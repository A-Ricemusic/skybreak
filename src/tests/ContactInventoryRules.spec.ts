import { validateInterceptHoldPhases } from "../shared/InterceptHoldRules";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { TargetPriority } from "../shared/TargetPriority";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { describe, expect, it } from "@rbxts/jest-globals";
import { ContactBudget, detailContacts, newSchedule, RepeatedArtillery, stepSchedule, validateContactInventoryPhases } from "../shared/ContactInventoryRules";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
import { navalHull } from "../shared/SurfaceTargetRules";
const schedule=():RepeatedArtillery=>({startSeconds:10,salvos:2,ceiling:585,source:{x:3000,y:1000,z:0},warningSeconds:3,countdownSeconds:4,intervalSeconds:12,damage:30,clearance:60,channel:[{x:0,y:300,z:0},{x:0,y:300,z:100}]});
const phase=():MissionPhaseBlueprint=>({kind:"score_threshold",label:"River",cheapContacts:true,repeatedArtillery:schedule(),groundTargets:[{id:"parked",type:"parked_helicopter",position:{x:0,y:0,z:0},yaw:0,required:false,scoreRole:"air"}],fighterWaves:[{id:"scramble",parkedSourceId:"parked",count:1,role:"raider",scoreRole:"air",trigger:{kind:"time",seconds:30}}]});
function valid(p:MissionPhaseBlueprint):boolean {const [ok]=pcall(()=>validateContactInventoryPhases([p],15360,true));return ok;}
describe("Dormant D6 contracts",()=>{
 it("delays, repeats and stops without catch-up salvo bursts",()=>{
  const s=newSchedule(),p=schedule(); expect(stepSchedule(s,p,10).warning).toBe(false);
  expect(stepSchedule(s,p,1).warning).toBe(true); expect(stepSchedule(s,p,2).countdown).toBe(true); expect(stepSchedule(s,p,4).impact).toBe(true);
  expect(stepSchedule(s,p,5).impact).toBe(false); expect(s.completed).toBe(1);
  expect(stepSchedule(s,p,1000).impact).toBe(true); expect(s.completed).toBe(2); expect(stepSchedule(s,p,1000).impact).toBe(false);
 });
 it("ignores invalid/paused time, including while waiting for the first salvo",()=>{
  const s=newSchedule(),p=schedule(); for(const dt of [0,-1,math.huge,0/0]) expect(stepSchedule(s,p,dt).impact).toBe(false); expect(s.delay).toBe(0); expect(s.salvo.elapsed).toBe(0);
 });
 it("shares D3 validation for bounded safe channels, timings and masking sources",()=>{
  expect(valid(phase())).toBe(true);
  const authored=phase();authored.scoreThreshold={points:3000,seconds:1200,waitForExpiry:true};
  MissionCatalog.ValidatePolicy({...MissionCatalog.Get(1),ground:[],terrainRelativeWarnings:true,scoring:{...MissionCatalog.Scoring(1),points:{air:60,ground:100}},phases:[authored]});
  for(const patch of [{salvos:101},{salvos:1.5},{startSeconds:-1},{startSeconds:math.huge},{intervalSeconds:2},{channel:[]},{ceiling:0},{source:{x:20000,y:1000,z:0}}]) {const p=phase();p.repeatedArtillery={...schedule(),...patch};expect(valid(p)).toBe(false);}
  const p=phase();p.kind="return_line";expect(valid(p)).toBe(false);
 });
 it("requires a unique same-phase optional parked identity and matching credit role",()=>{
  for(const change of ["missing","count","role","duplicate","required"]) {const p=phase(),w=p.fighterWaves![0]; if(change==="missing") w.parkedSourceId="unknown";if(change==="count") w.count=2;if(change==="role") w.scoreRole="other";if(change==="duplicate") p.fighterWaves!.push({...w,id:"again"});if(change==="required") p.groundTargets![0].required=true;expect(valid(p)).toBe(false);}
 });
 it("bounds a dense 150-contact battle to 24 nearby details with stable distance ordering",()=>{
  const contacts: {id:string;distanceSquared:number}[]=[]; for(let i=149;i>=0;i--) contacts.push({id:`c${i}`,distanceSquared:i*i});
  const chosen=detailContacts(contacts); let count=0;for(const _ of chosen) count++;expect(count).toBe(ContactBudget.detailed);expect(chosen.has("c0")).toBe(true);expect(chosen.has("c23")).toBe(true);expect(chosen.has("c24")).toBe(false);
  expect(detailContacts([{id:"far",distanceSquared:2401**2}]).has("far")).toBe(false);
  contacts.push({id:"overflow",distanceSquared:0}); const [ok]=pcall(()=>detailContacts(contacts));expect(ok).toBe(false);
 });
 it("combines 150 ground contacts with the D4 finite fighter queue without bypassing admission",()=>{
  const p=phase();p.concurrentFighters=2;
  p.groundTargets=[];p.fighterWaves=[];
  for(let i=0;i<150;i++) {
   p.groundTargets.push({id:`parked${i}`,type:"parked_helicopter",position:{x:i,y:0,z:0},yaw:0,required:false,scoreRole:"air"});
   p.fighterWaves.push({id:`wave${i}`,parkedSourceId:`parked${i}`,count:1,role:"raider",scoreRole:"air",trigger:{kind:"time",seconds:1}});
  }
  validateInterceptHoldPhases([p],15360);validateContactInventoryPhases([p],15360,true);
  const queue:AirRequest[]=p.fighterWaves.map(arrival=>({arrival,role:arrival.role,count:arrival.count,behind:false}));
  expect(WavePlan.Admit(queue,0).size()).toBe(0);expect(queue.size()).toBe(150);
  const first=WavePlan.Admit(queue,p.concurrentFighters);expect(first.size()).toBe(2);expect(queue.size()).toBe(148);
  expect(first[0].arrival?.id).toBe("wave0");expect(first[1].arrival?.id).toBe("wave1");
  expect(WavePlan.Admit(queue,0).size()).toBe(0);
  expect(WavePlan.Admit(queue,1)[0].arrival?.id).toBe("wave2");expect(queue.size()).toBe(147);
  const [badAir]=pcall(()=>validateInterceptHoldPhases([{...p,concurrentFighters:13}],15360));expect(badAir).toBe(false);
  const [badGround]=pcall(()=>validateContactInventoryPhases([{...p,groundTargets:[...p.groundTargets!,{...p.groundTargets![0],id:"overflow"}]}],15360,true));expect(badGround).toBe(false);
 });
 it("limits LOS work to four candidates for either 150-contact acquisition path",()=>{
  const contacts: {id:number;distance:number;dot:number;inRange:boolean;onScreen:boolean}[]=[];for(let i=0;i<150;i++) contacts.push({id:i,distance:i+1,dot:1,inRange:true,onScreen:true});
  expect(TargetPriority.LosChecks(contacts).size()).toBe(4);expect(TargetPriority.PressLosChecks(contacts).size()).toBe(4);
 });
 it("awards one score and one kill for either parked-first or airborne-first destruction",()=>{
  for(const first of ["air","ground"] as const) {
   const b={...MissionCatalog.Get(1),phases:[{...phase(),scoreThreshold:{points:9999,seconds:1200,waitForExpiry:true}}]};
   const state=BlueprintRunner.NewState(b,0),ledger=new TargetScore({...MissionCatalog.Scoring(b),points:{air:60}});
   expect(recordScoredKill(state,ledger,"same-airframe",first,false,1,"air")).toBe(true);
   expect(recordScoredKill(state,ledger,"same-airframe",first==="air" ? "ground" : "air",false,2,"air")).toBe(false);
   expect(ledger.Total()).toBe(60);expect(state.score).toBe(60);expect(state.phaseIndex).toBe(0);
  }
 });
 it("provides six M10 labels and naval lifecycle for the gunboat",()=>{
  expect([GROUND_TARGET_LABELS.container,GROUND_TARGET_LABELS.watchtower,GROUND_TARGET_LABELS.antenna,GROUND_TARGET_LABELS.barracks,GROUND_TARGET_LABELS.gunboat,GROUND_TARGET_LABELS.sub_pen]).toEqual(["CONTAINER","WATCHTOWER","ANTENNA","BARRACKS","GUNBOAT","SUB PEN"]);expect(navalHull("gunboat")).toBe(true);
 });
 it("keeps catalog phases other than M10 dormant",()=>{
  for(let id=0;id<=18;id++) { if(id===10 || id===15 || id===16 || id===17) continue; const b=MissionCatalog.Get(id); if(b) for(const p of b.phases) {expect(p.repeatedArtillery).toBeUndefined();expect(p.cheapContacts).toBeUndefined();for(const w of p.fighterWaves ?? []) expect(w.parkedSourceId).toBeUndefined();} }
 });
});
