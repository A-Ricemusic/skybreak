import { m01Height, M01 } from "../shared/M01WorldPlan";
import { polyDist } from "../shared/WorldPlan";
import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS, MISSION_COUNT, PRACTICE } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, resolveMissionRequest, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { TargetScore } from "../shared/TargetScore";
import { recordAlliedKill, recordScoredKill } from "../server/SortieScore";
import { GameConfig } from "../shared/GameConfig";
import { compileBomberEncounter, laterEscortsDue } from "../shared/BomberEncounter";
import { BomberRules } from "../shared/BomberRules";
import { AlliedRules } from "../shared/AlliedRules";
import { STORY, reachableStoryChapters } from "../shared/RelayStory";
import { MissionCatalog as Legacy } from "./LegacyCatalog";
const bp = MissionCatalog.Get(1);
function fresh() { const c = new CampaignCoordinator("campaign18",undefined,{now:()=>1000,defer:()=>undefined}); c.load(); return c; }
describe("Released 18-mission campaign",()=>{
 it("contains 18 ordered numbered missions and optional practice outside the count",()=>{
  expect(MISSION_COUNT).toBe(18); expect(GameConfig.Campaign.MissionCount).toBe(18); expect(MISSIONS.size()).toBe(18);
  expect(PRACTICE.id).toBe(0); expect(MissionCatalog.Get(0)).toBe(PRACTICE);
  MISSIONS.forEach((m,i)=>{expect(m.id).toBe(i+1);expect(MissionCatalog.Available(m)).toBe(i===0);if(i>0){expect(m.title).toBe(`Mission ${i+1}`);expect(m.briefing).toBe("In development");}});
  for(const id of [19,27,-1,1.5,math.huge]) expect(MissionCatalog.IsValidId(id)).toBe(false);
 });
 it("keeps the three original control exercises and radar without enemies",()=>{
  expect(PRACTICE.phases).toEqual(Legacy.Get(1).phases.filter((_,i)=>i<3)); expect(PRACTICE.ground).toEqual(Legacy.Get(1).ground);
  expect(MissionCatalog.RequiredAirKills(PRACTICE)).toBe(0); expect(MissionCatalog.Available(0)).toBe(true);
 });
 it("wins on all six bombers with 960 raw points, S, and persists the authoritative ledger",()=>{
  const s=BlueprintRunner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
  for(const id of ["escort1","escort2"]) recordScoredKill(s,ledger,id,"air",false,100,"escort");
  recordScoredKill(s,ledger,"ace","ace",false,151,"ace");
  for(let i=0;i<6;i++) { recordScoredKill(s,ledger,`b${i}`,"air",true,170+i,"bomber"); if(i<5)expect(s.outcome).toBeUndefined(); }
  expect(s.outcome).toBe("won"); expect(ledger.Total()).toBe(960);
  const c=fresh(); let rank="";
  expect(completeMission(c,1,1,true,{slot:1,missionId:1,kills:9,groundKills:0,optionalKills:3,completedPhases:1,elapsed:175,targetScore:ledger.Snapshot()},m=>{rank=m.rank ?? "";},0)).toBe(true);
  expect(rank).toBe("S");expect(c.getSlots()[0].missions?.[1]?.bestScore).toBe(960);
  expect(highestUnlocked(c.getSlots()[0])).toBe(1);
  expect(normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions?.[1]?.bestScore).toBe(960);
 });
 for(const cause of ["escape","timeout","destroyed"])it(`fails by ${cause}`,()=>{
  const s=BlueprintRunner.NewState(bp,0);
  if(cause==="escape") BlueprintRunner.EscapeBombers(s); else BlueprintRunner.Tick(s,cause==="timeout" ? 600 : 20,cause==="destroyed" ? 0 : 100);
  expect(s.outcome).toBe("failed");expect(s.reason).toBe(cause==="escape" ? "bombers_escaped" : cause);
 });
 it("keeps release locks across completion, forged records, omitted requests, retry and next",()=>{
  const c=fresh(),slot=c.getSlots()[0];
  for(const forged of [false,true]){
   if(forged)for(let id=1;id<=18;id++)slot.missions![id]={completed:true};
   expect(canLaunchMission(0,slot)).toBe(true);expect(canLaunchMission(1,slot)).toBe(true);
   expect(resolveMissionRequest(slot,undefined)[0]).toBe(1);
   for(let id=2;id<=18;id++){expect(canLaunchMission(id,slot)).toBe(false);expect(resolveMissionRequest(slot,id)[0]).toBeUndefined();}
  }
  for(const id of [-1,19,27,"1",math.huge])expect(resolveMissionRequest(slot,id)[0]).toBeUndefined();
 });
 it("uses only the new save namespace and keeps practice replay records outside progress",()=>{
  expect(GameConfig.Campaign.DataStoreName).toBe("SkybreakCampaign18_v1");
  const c=fresh();c.recordMissionResult(1,0,true,0,20);
  const slot=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];
  expect(slot.missions?.[0]?.completed).toBe(true);expect(slot.mission1Completed).toBe(false);expect(highestUnlocked(slot)).toBe(1);
 });
 it("reaches only the opening chapter and retains later scripts and finale dormant",()=>{
  expect(reachableStoryChapters()).toEqual([0]);expect(STORY.size()).toBe(28);
  expect(STORY[0].beats[5].text).toBe("An empty chair and a checkout nobody's signing. Fine. I'll fly the pattern.");
 });
 it("takes 240 seconds over the reserved island band, schedules the ace once and protects required targets",()=>{
  const b=bp.phases[0].bombers!,route=compileBomberEncounter(b);
  expect(BomberRules.Sample(route,239).escaped).toBe(false);expect(BomberRules.Sample(route,240.001).escaped).toBe(true);
  expect(route.duration).toBeCloseTo(240,8);
  for(let t=0;t<=240;t++)for(const pose of BomberRules.Sample(route,t).slots){
   expect(polyDist(pose.position.x,pose.position.z,M01.route)<=M01.corridorHalf).toBe(true);
   expect(pose.position.y>m01Height(pose.position.x,pose.position.z)+72).toBe(true);
  }
  const state={route,startedAt:0,laterSpawned:false,escortsSpawned:2};
  expect(laterEscortsDue(b,state,149.99)).toBe(false);expect(laterEscortsDue(b,state,150)).toBe(true);expect(laterEscortsDue(b,state,151)).toBe(false);
  const s=BlueprintRunner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
  expect(recordAlliedKill(s,ledger,[],bp.allies!,"allied-escort","air",false,10,"escort")).toBe(true);
  expect(ledger.Total()).toBe(0);expect(s.optionalAirKills).toBe(0);expect(s.requiredAirKills).toBe(0);
  expect(AlliedRules.Credit(bp.allies!)).toBe(false);expect(AlliedRules.CanEngage(bp.allies!,{enabled:true,health:100,required:true,role:"bomber"})).toBe(false);
 });
});
