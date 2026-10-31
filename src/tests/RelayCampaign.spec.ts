import { m01CarrierFlyoffStart } from "../shared/M01CarrierPlan";
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
import { compileBomberEncounter, laterEscortsDue, reinforcementFraction } from "../shared/BomberEncounter";
import { FlightMath } from "../shared/FlightMath";
import { MissionScore } from "../shared/MissionScore";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { BomberRules } from "../shared/BomberRules";
import { AlliedRules } from "../shared/AlliedRules";
import { encodeCampaignSlot, normalizeMissionRecords } from "../shared/CampaignWire";
import { STORY, storyFor, MARSHAL, RUSK, shouldPlayChapter, chapterBeforeMission, reachableStoryChapters } from "../shared/RelayStory";
import { MissionCatalog as Legacy } from "./LegacyCatalog";
const bp = MissionCatalog.Get(1);
function fresh() { const c = new CampaignCoordinator("campaign18",undefined,{now:()=>1000,defer:()=>undefined}); c.load(); return c; }
describe("Released 18-mission campaign",()=>{
 it("contains 18 ordered numbered missions and optional practice outside the count",()=>{
  expect(MISSION_COUNT).toBe(18); expect(GameConfig.Campaign.MissionCount).toBe(18); expect(MISSIONS.size()).toBe(18);
  expect(PRACTICE.id).toBe(0); expect(MissionCatalog.Get(0)).toBe(PRACTICE);
  MISSIONS.forEach((m,i)=>{expect(m.id).toBe(i+1);expect(MissionCatalog.Available(m)).toBe(i<=5);if(i>5){expect(m.title).toBe(`Mission ${i+1}`);expect(m.briefing.size()>30).toBe(true);}});
  for(const id of [19,27,-1,1.5,math.huge]) expect(MissionCatalog.IsValidId(id)).toBe(false);
 });
 it("keeps the three original control exercises and radar without enemies",()=>{
  const expected = Legacy.Get(1).phases.filter((_,i)=>i<3).map((phase, i) => i !== 1 ? phase : {
   ...phase, beat: "Select radar: tap box / TGT / Tab / Y. Turn back if you pass it.",
   execution: { ...phase.execution, objective: "Tap the target box or press TGT to select the practice target" },
  });
  expect(PRACTICE.phases).toEqual(expected); expect(PRACTICE.ground).toEqual(Legacy.Get(1).ground);
  expect(MissionCatalog.RequiredAirKills(PRACTICE)).toBe(0); expect(MissionCatalog.Available(0)).toBe(true);
 });
 it("wins on all six bombers with 960 raw points, B, and persists the authoritative ledger",()=>{
  const s=BlueprintRunner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
  for(const id of ["escort1","escort2"]) recordScoredKill(s,ledger,id,"air",false,100,"escort");
  recordScoredKill(s,ledger,"ace","ace",false,151,"ace");
  for(let i=0;i<6;i++) { recordScoredKill(s,ledger,`b${i}`,"air",true,170+i,"bomber"); if(i<5)expect(s.outcome).toBeUndefined(); }
  expect(s.outcome).toBe("won"); expect(ledger.Total()).toBe(960);
  const c=fresh(); let rank="";
  expect(completeMission(c,1,1,true,{slot:1,missionId:1,kills:9,groundKills:0,optionalKills:3,completedPhases:1,elapsed:175,targetScore:ledger.Snapshot()},m=>{rank=m.rank ?? "";},0)).toBe(true);
  expect(rank).toBe("B");expect(c.getSlots()[0].missions?.[1]?.bestScore).toBe(960);
  expect(highestUnlocked(c.getSlots()[0])).toBe(2);
  expect(normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions?.[1]?.bestScore).toBe(960);
 });
 it("returns the six-bomber 600/B best through the save, remote and menu normalization path",()=>{
  const state=BlueprintRunner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(let i=0;i<6;i++)recordScoredKill(state,ledger,`b${i}`,"air",true,170+i,"bomber");
  const c=fresh();
  expect(completeMission(c,1,1,true,{slot:1,missionId:1,kills:6,groundKills:0,optionalKills:0,completedPhases:1,elapsed:62,targetScore:ledger.Snapshot()},()=>undefined,0)).toBe(true);
  const wire=encodeCampaignSlot(c.getSlots()[0]),record=normalizeMissionRecords(wire.missions)?.[1];
  expect(record?.completed).toBe(true);expect(record?.bestScore).toBe(600);expect(record?.bestRank).toBe("B");
  expect(record?.bestTargetScore).toEqual(ledger.Snapshot());expect(record?.bestTargetScore?.total).toBe(record?.bestScore);
 });
 for(const cause of ["escape","timeout","destroyed"])it(`fails by ${cause}`,()=>{
  const s=BlueprintRunner.NewState(bp,0);
  if(cause==="escape") BlueprintRunner.EscapeBombers(s); else BlueprintRunner.Tick(s,cause==="timeout" ? 600 : 20,cause==="destroyed" ? 0 : 100);
  expect(s.outcome).toBe("failed");expect(s.reason).toBe(cause==="escape" ? "bombers_escaped" : cause);
 });
 it("unlocks missions 2–6 in order and keeps 7–18 locked across forged records, omitted requests, retry and next",()=>{
  const c=fresh();let slot=c.getSlots()[0];
  // A fresh slot cannot skip ahead: the server refuses mission 2 and 3 requests before mission 1 is complete.
  expect(canLaunchMission(2,slot)).toBe(false);expect(resolveMissionRequest(slot,2)[0]).toBeUndefined();
  expect(canLaunchMission(3,slot)).toBe(false);expect(resolveMissionRequest(slot,3)[0]).toBeUndefined();
  // Practice and a failed mission 1 never unlock it.
  c.recordMissionResult(1,0,true,0,20);c.recordMissionResult(1,1,false,2,300);slot=c.getSlots()[0];
  expect(highestUnlocked(slot)).toBe(1);expect(resolveMissionRequest(slot,2)[0]).toBeUndefined();expect(resolveMissionRequest(slot,undefined)[0]).toBe(1);
  slot.missions ??= {};
  // Mission 1 alone opens mission 2; mission 3 needs mission 2 (a failed mission 2 does not count).
  slot.missions[1]={completed:true};
  expect(highestUnlocked(slot)).toBe(2);expect(resolveMissionRequest(slot,2)[0]).toBe(2);expect(resolveMissionRequest(slot,undefined)[0]).toBe(2);
  expect(canLaunchMission(3,slot)).toBe(false);expect(resolveMissionRequest(slot,3)[0]).toBeUndefined();
  slot.missions[2]={completed:false};
  expect(highestUnlocked(slot)).toBe(2);expect(canLaunchMission(3,slot)).toBe(false);
  for(const forged of [false,true]){
   if(forged)for(let id=1;id<=18;id++)slot.missions[id]={completed:true};
   else slot.missions[2]={completed:true};
   for(const id of [0,1,2,3])expect(canLaunchMission(id,slot)).toBe(true);
   expect(highestUnlocked(slot)).toBe(forged ? 6 : 3);expect(resolveMissionRequest(slot,3)[0]).toBe(3);expect(resolveMissionRequest(slot,undefined)[0]).toBe(forged ? 6 : 3);
   expect(canLaunchMission(4,slot)).toBe(forged);expect(resolveMissionRequest(slot,4)[0]).toBe(forged ? 4 : undefined);
   // Missions 5 and 6 follow in order (#148, mission 6); a forged slot reaches them, nothing past them.
   expect(canLaunchMission(5,slot)).toBe(forged);expect(canLaunchMission(6,slot)).toBe(forged);
   for(let id=7;id<=18;id++){expect(canLaunchMission(id,slot)).toBe(false);expect(resolveMissionRequest(slot,id)[0]).toBeUndefined();}
  }
  for(const id of [-1,19,27,"1",math.huge])expect(resolveMissionRequest(slot,id)[0]).toBeUndefined();
 });
 it("uses only the new save namespace and keeps practice replay records outside progress",()=>{
  expect(GameConfig.Campaign.DataStoreName).toBe("SkybreakCampaign18_v1");
  const c=fresh();c.recordMissionResult(1,0,true,0,20);
  const slot=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];
  expect(slot.missions?.[0]?.completed).toBe(true);expect(slot.mission1Completed).toBe(false);expect(highestUnlocked(slot)).toBe(1);
 });
 it("reaches the three live chapters and retains later chapters dormant",()=>{
  expect(reachableStoryChapters()).toEqual([0,1,2]);expect(STORY.size()).toBe(19);
  expect(STORY[0].beats[5].text).toBe("An empty chair and a checkout nobody's signing. Fine. I'll fly the pattern.");
 });
 it("maps every mission to D-030 and keeps the closing chapter after M18",()=>{
  const titles: string[] = ["A voice in the static", "The sealed case", "An unlisted station", "The orchard witnesses", "Fuel under grain", "Military quays", "Two ridges", "The loyalist window", "The frigate ring", "Walking the storm", "High crossing", "Vulture Two", "The evidence launch", "Aurora archive", "The city in darkness", "The dawn landing", "The last fracture", "Broken relay", "A clear frequency"];
  expect(chapterBeforeMission(0)).toBe(0);
  expect(shouldPlayChapter(0,[0],true,true)).toBe(false);
  expect(shouldPlayChapter(1,[0],false,true)).toBe(false);
  expect(shouldPlayChapter(1,[0],true,true)).toBe(true);
  expect(shouldPlayChapter(1,[0],true,false)).toBe(false); // Retry after death in completed M1
  expect(shouldPlayChapter(1,[0],false,false)).toBe(false);
  expect(shouldPlayChapter(3,[],false,false)).toBe(true);
  expect(shouldPlayChapter(3,[2],true,true)).toBe(false);
  for(let id=1;id<=18;id++) { expect(chapterBeforeMission(id)).toBe(id-1); expect(STORY[chapterBeforeMission(id)].title).toBe(titles[id-1]); }
  expect(STORY[18].title).toBe("A clear frequency");
  for(const c of STORY) {
   expect(c.id<=18).toBe(true); expect(c.beats.size()>=3 && c.beats.size()<=8).toBe(true);
   for(const b of c.beats) { if(b.speaker===RUSK) expect(c.id>=14).toBe(true); if(b.speaker===MARSHAL) expect(c.id<14).toBe(true); }
  }
  for(const id of [19,26,27]) { expect(pcall(()=>storyFor(id))[0]).toBe(false); }
  expect(STORY[5].beats[0].text.find("got clear of Vulture Lead")[0]!==undefined).toBe(true);
  expect(STORY[16].beats[5].text.find("Vulture Lead is one of them")[0]!==undefined).toBe(true);
  expect(STORY[17].beats[0].text.find("left his wingmen")[0]!==undefined).toBe(true);
 });
 it("normalises numeric cutscene compatibility without touching retired stores",()=>{
  const profile=normalizeProfile({version:3,slots:[{name:"Seen",cutscenesSeen:[0,1,2,17,18,19,27,-1,1.5,"3"]}]});
  expect(profile.slots[0].cutscenesSeen).toEqual([0,1,2,17,18]);
  expect(normalizeProfile(serializeProfile(profile)).slots[0].cutscenesSeen).toEqual([0,1,2,17,18]);
 });
 it("takes 240 seconds over the reserved island band, schedules the ace once and protects required targets",()=>{
  const b=bp.phases[0].bombers!,route=compileBomberEncounter(b);
  expect(BomberRules.Sample(route,239).escaped).toBe(false);expect(BomberRules.Sample(route,240.001).escaped).toBe(true);
  expect(route.duration).toBeCloseTo(240,8);
  const start=m01CarrierFlyoffStart();
  expect(b.waypoints[0].z).toBeLessThan(start.z-5000);
  expect(b.waypoints).toEqual([{x:0,y:727,z:5200},{x:512,y:727,z:4200},{x:1280,y:727,z:256},{x:-1280,y:727,z:-3200}]);
  expect(start.z-b.waypoints[0].z).toBe(5628);
  expect(route.speed).toBeGreaterThan(45);expect(route.speed).toBeLessThan(55);
  expect((5700/(FlightMath.MaxSpeed-route.speed))).toBeLessThan(12);
  // Numeric full-throttle pursuit including acceleration and the 637-stud climb.
  const player=FlightMath.FromPose(start.x,start.y,start.z,0,0,start.speed!);
  let caught=false;
  for(let step=1;step<=1200;step++){
   const t=step/60,target=BomberRules.Sample(route,t).slots[1].position;
   const dx=target.x-player.x,dy=target.y-player.y,dz=target.z-player.z;
   const desired=math.atan2(dy,math.sqrt(dx*dx+dz*dz));
   FlightMath.Step(player,{x:0,y:math.clamp((desired-player.pitch)*2,-1,1),throttle:1},1/60,bp.airspace);
   if(math.sqrt(dx*dx+dy*dy+dz*dz)<1500){caught=true;break;}
  }
  expect(caught).toBe(true);
  expect(b.escape).toEqual({x:-1280,y:727,z:-5600});
  expect(bp.region).toBe("coastal_city");
  for(let t=0;t<=240;t++)for(const pose of BomberRules.Sample(route,t).slots){
   expect(polyDist(pose.position.x,pose.position.z,M01.route)<=M01.corridorHalf).toBe(true);
   expect(math.abs(pose.position.x)<bp.airspace!.spawnLimit && math.abs(pose.position.z)<bp.airspace!.spawnLimit).toBe(true);
   expect(pose.position.y>m01Height(pose.position.x,pose.position.z)+72).toBe(true);
  }
  const state={route,startedAt:0,laterSpawned:false,escortsSpawned:2};
  expect(laterEscortsDue(b,state,149.99)).toBe(false);expect(laterEscortsDue(b,state,150)).toBe(true);expect(laterEscortsDue(b,state,151)).toBe(false);
  const s=BlueprintRunner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
  expect(recordAlliedKill(s,ledger,[],bp.allies!,"allied-escort","air",false,10,"escort")).toBe(true);
  expect(ledger.Total()).toBe(0);expect(s.optionalAirKills).toBe(0);expect(s.requiredAirKills).toBe(0);
  expect(AlliedRules.Credit(bp.allies!)).toBe(false);expect(AlliedRules.CanEngage(bp.allies!,{enabled:true,health:100,required:true,role:"bomber"})).toBe(false);
 });
 it("adds two optional attacking waves without inflating required objectives or bypassing the seven-fighter queue",()=>{
  const phase=bp.phases[0],route=compileBomberEncounter(phase.bombers!);
  expect(bp.pressure?.playerPriority).toBe(0.8);expect(MissionCatalog.Get(2).pressure).toBeUndefined();
  for (const mission of [PRACTICE, ...MISSIONS]) expect(mission.pressure !== undefined).toBe(mission.id === 1 || mission.id === 6);
  expect(MissionCatalog.InitialRaiders(phase)).toBe(6);expect(phase.reinforce).toEqual([{at:0.5,count:2}]);
  expect(reinforcementFraction(1,119.99,route)<0.5).toBe(true);
  expect(reinforcementFraction(0,120,route)).toBe(0.5);
  expect(reinforcementFraction(0.25,120)).toBe(0.25);
  expect(MissionCatalog.RequiredAirKills(bp)).toBe(6);expect(MissionCatalog.MaxOptionalRaiders(bp)).toBe(12);
  for(const extra of [0,1]){
   expect(MissionCatalog.RaiderCap(phase,extra)).toBe(12+2*extra);
   expect(MissionCatalog.PeakAircraft(phase,extra)).toBe(18+2*extra);
   const q:AirRequest[]=[{role:"escort",count:2,behind:false},{role:"raider",count:6+extra,behind:false}];
   let live=WavePlan.Admit(q,7).reduce((n,w)=>n+w.count,0);
   expect(live).toBe(7);
   q.push({role:"raider",count:2+extra,behind:true});
   live+=WavePlan.Admit(q,7-live).reduce((n,w)=>n+w.count,0);expect(live).toBe(7);
   q.push({role:"ace",count:1,behind:false},{role:"escort",count:1,behind:false});
   expect(WavePlan.Admit(q,0).size()).toBe(0);
   expect(WavePlan.Admit(q,1)[0].role).toBe("ace");
   expect(WavePlan.Admit(q,1)[0].role).toBe("escort");
  }
 });
 it("scores every optional fighter, keeps six bombers sufficient, and raises S above the non-ace maximum",()=>{
  const state=BlueprintRunner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(let i=0;i<8;i++)expect(recordScoredKill(state,ledger,`r${i}`,"air",false,120+i,"raider")).toBe(true);
  for(let i=0;i<3;i++)expect(recordScoredKill(state,ledger,`e${i}`,"air",false,150+i,"escort")).toBe(true);
  expect(recordScoredKill(state,ledger,"ace","ace",false,160,"ace")).toBe(true);
  expect(recordScoredKill(state,ledger,"overflow","air",false,161,"raider")).toBe(false);
  expect(state.phaseProgress).toBe(0);expect(state.outcome).toBeUndefined();
  for(let i=0;i<6;i++)expect(recordScoredKill(state,ledger,`b${i}`,"air",true,170+i,"bomber")).toBe(true);
  expect(state.outcome).toBe("won");expect(ledger.Total()).toBe(1500);expect(ledger.RolePoints("raider")).toBe(480);
  expect(bp.scoring!.rank).toEqual({S:1320,A:1020,B:600,C:500});
  expect(1500-240<bp.scoring!.rank.S).toBe(true);
  for(const [points,rank] of [[1320,"S"],[1319,"A"],[1020,"A"],[1019,"B"],[600,"B"],[599,"C"],[500,"C"],[499,"D"]] as [number,string][]){
   expect(MissionScore.RankPoints(points,true,bp.scoring!)).toBe(rank);
   expect(MissionScore.RankPoints(points,false,bp.scoring!)).toBe("D");
  }
 });

});
