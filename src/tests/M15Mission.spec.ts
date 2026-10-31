import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { mission as bp, M15_TARGETS, M15_GROUND, M15_WAVES } from "../shared/missions/m15";
import { buildM15ScenePlan, m15TargetLayout, M15_WORLD_KEY } from "../shared/M15WorldPlan";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { completeRearmRepair } from "../server/EngineBatchD11Runtime";
import { createCombatSession } from "../server/CombatSessionFactory";
import { FlightMath } from "../shared/FlightMath";
import { MissionScore } from "../shared/MissionScore";
import { recordScoredKill, recordAlliedKill } from "../server/SortieScore";
import { damageSector, newGroundProgress, stepGroundProgress } from "../shared/EngineBatchD5";
import { sectorReinforcementReady, repairAllowed } from "../shared/EngineBatchD11";
import { rearmDuration, rearmPose } from "../shared/EngineBatchC";
import { SortieArmament } from "../shared/SortieArmament";
import { compileBomberEncounter } from "../shared/BomberEncounter";
import { canLaunchMission } from "../shared/CampaignProgress";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
const policy=bp.scoring!;
function strike(){ const s=R.NewState(bp,0),ledger=new TargetScore(policy);for(const t of M15_TARGETS) recordScoredKill(s,ledger,t.id,"ground",t.required,100,t.scoreRole);return {s,ledger}; }
function earlier(fn:()=>void){ const before=MISSIONS.map(m=>m.available);for(let i=0;i<14;i++) MISSIONS[i].available=true;const [ok,err]=pcall(fn);MISSIONS.forEach((m,i)=>m.available=before[i]);if(!ok)error(err,0); }
describe("M15 SILENT STREETS",()=>{
 it("filters all fourteen airborne proxies before composition while retaining ground adoption geometry",()=>{
  const plan=buildM15ScenePlan(),air=m15TargetLayout().filter(t=>t.group==="retaliation"||t.group==="optional_air");
  expect(air.size()).toBe(14);
  for(const t of air){expect(plan.targets.some(p=>p.id===t.id)).toBe(false);expect(plan.parts.some(p=>p.name===t.id)).toBe(false);}
  for(const t of M15_TARGETS){expect(plan.targets.some(p=>p.id===t.id)).toBe(true);expect(plan.parts.some(p=>p.name===t.id)).toBe(true);}
 });
 it("validates an opt-in world, two fresh ten-minute clocks, and finite pressure",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(MissionCatalog.WorldKey(15)).toBe(M15_WORLD_KEY);expect(bp.available).toBe(true);
  expect(bp.phases.map(p=>p.kind)).toEqual(["score_threshold","required_air"]);expect(bp.phases[1].update!.countdownSeconds).toBe(600);
  expect(MissionCatalog.RequiredGroundKills(bp)).toBe(1);expect(MissionCatalog.RequiredAirKills(bp)).toBe(6);
  expect(bp.phases[0].concurrentRoutes).toBe(2);expect(M15_WAVES.filter(w=>w.attackSector!==undefined).reduce((n,w)=>n+w.count,0)).toBe(12);
 });
 it("adopts 69 unique ground world ids and the six bomber ids without double credit",()=>{
  const layout=m15TargetLayout();expect(M15_TARGETS.size()).toBe(69);expect(new Set(M15_TARGETS.map(t=>t.id)).size()).toBe(69);
  for(const t of M15_TARGETS){const w=layout.find(w=>w.id===t.id)!;expect(t.position).toEqual({x:w.x,y:w.y,z:w.z});}
  expect(bp.phases[1].bombers!.targetIds).toEqual(layout.filter(t=>t.type==="bomber").map(t=>t.id));
  expect(M15_TARGETS.filter(t=>t.required).map(t=>t.id)).toEqual(["m15_command_relay"]);
  expect(M15_TARGETS.filter((_,i)=>i<53).reduce((n,t)=>n+policy.points[t.scoreRole],0)).toBe(2440);
 });
 it("reconciles the 6370 maximum and provisional ranks with the observed 4930 S run",()=>{
  const ground=M15_TARGETS.reduce((n,t)=>n+policy.points[t.scoreRole],0);expect(ground).toBe(3500);
  const air=M15_WAVES.reduce((n,w)=>n+w.count*policy.points[w.scoreRole],0)+240+960+360;expect(ground+air).toBe(6370);
  for(const [score,rank]of [[2000,"C"],[3200,"B"],[4000,"A"],[4929,"A"],[4930,"S"],[6370,"S"]]as [number,string][])expect(MissionScore.RankPoints(score,true,policy)).toBe(rank);
 });
 it("requires relay and score at expiry, carries points, and wins only on the sixth bomber",()=>{
  const {s,ledger}=strike();R.Tick(s,599);expect(s.phaseIndex).toBe(0);R.Tick(s,600);expect(s.phaseIndex).toBe(1);expect(R.TimeRemaining(s)).toBe(600);
  for(const [i,id]of bp.phases[1].bombers!.targetIds!.map((id,i)=>[i,id]as const)){expect(recordScoredKill(s,ledger,id,"air",true,620+i,"bomber")).toBe(true);if(i<5)expect(s.outcome).toBeUndefined();}
  expect(s.outcome).toBe("won");expect(ledger.Total()).toBe(4460);expect(recordScoredKill(s,ledger,"m15_bomber_6","air",true,630,"bomber")).toBe(false);
  const forged=R.NewState(bp,0);expect(R.RecordKill(forged,"fake-relay","ground",true,1)).toBe(false);
  const boundary=R.NewState(bp,0);boundary.score=2000;expect(R.RecordKill(boundary,"m15_command_relay","ground",true,600)).toBe(false);expect(boundary.reason).toBe("timeout");
  const missing=R.NewState(bp,0);missing.score=6370;R.Tick(missing,600);expect(missing.reason).toBe("timeout");
  const low=R.NewState(bp,0);R.RecordKill(low,"m15_command_relay","ground",true,100);low.score=1999;R.Tick(low,600);expect(low.reason).toBe("timeout");
  const late=strike().s;R.Tick(late,600);R.Tick(late,1200);expect(late.reason).toBe("timeout");const escape=strike().s;R.Tick(escape,600);R.EscapeBombers(escape);expect(escape.reason).toBe("bombers_escaped");
  const dead=R.NewState(bp,0);R.Tick(dead,1,0);expect(dead.reason).toBe("destroyed");
 });
 it("advances cleared city squads and gates nine reserves without circular requirements",()=>{
  const states=newGroundProgress(M15_GROUND),destroyed=new Set<string>();expect(stepGroundProgress(M15_GROUND,states,destroyed,60)).toEqual([]);
  expect(sectorReinforcementReady("m15_arch_squad",M15_GROUND,states)).toBe(false);
  for(const id of M15_GROUND.sectors[0].clearTargetIds)destroyed.add(id);stepGroundProgress(M15_GROUND,states,destroyed,60);
  expect(states[0].secured).toBe(true);expect(states[1].started).toBe(false);expect(sectorReinforcementReady("m15_arch_squad",M15_GROUND,states)).toBe(true);
  expect(M15_TARGETS.filter(t=>t.reinforceAfterSector!==undefined).size()).toBe(9);damageSector(states[0],600);expect(sectorReinforcementReady("m15_arch_squad",M15_GROUND,states)).toBe(false);
 });
 it("pauses objectives for repair service and restores authored finite stores",()=>{
  const service=createCombatSession({} as Player,1,{} as Folder,{} as Model,FlightMath.FromPose(0,100,0,0,0,200),15,"salvo","normal",0);service.health=24;completeRearmRepair(service,true);expect(service.health).toBe(100);service.health=0;completeRearmRepair(service,true);expect(service.health).toBe(0);
  const p=bp.phases[0].rearm!;expect(p.health).toBe(true);expect(repairAllowed(15,p.health)).toBe(true);expect(repairAllowed(14,true)).toBe(false);
  expect(SortieArmament.Refill(p,bp.armament,"salvo").missiles).toBe(80);expect(rearmPose(p,rearmDuration(p)).y).toBeGreaterThan(p.landing.touchdown.y);
  const s=R.NewState(bp,0);s.rearmActive=true;R.Tick(s,900);expect(s.elapsed).toBe(0);expect(s.outcome).toBeUndefined();
 });
 it("allows one eligible optional allied kill with no score or required kills",()=>{
  const s=R.NewState(bp,0),ledger=new TargetScore(policy),ids:string[]=[];
  expect(recordAlliedKill(s,ledger,ids,bp.allies!,"m15_command_relay","ground",true,1,"relay")).toBe(false);
  expect(recordAlliedKill(s,ledger,ids,bp.allies!,"m15_bomber_1","air",true,1,"bomber")).toBe(false);
  expect(recordAlliedKill(s,ledger,ids,bp.allies!,"m15_air_7","air",false,1,"raider")).toBe(true);
  expect(recordAlliedKill(s,ledger,ids,bp.allies!,"another","air",false,2,"raider")).toBe(false);expect(ledger.Total()).toBe(0);expect(s.requiredGroundKills).toBe(0);
 });
 it("requires all fourteen predecessors, rejects incomplete settlements, persists a full win",()=>earlier(()=>{
  const c=new CampaignCoordinator("m15",undefined,{now:()=>1000,defer:()=>undefined});c.load();let slot=c.getSlots()[0];slot.missions??={};
  for(let id=1;id<=14;id++){expect(canLaunchMission(15,slot)).toBe(false);c.recordMissionResult(1,id,true,100,100);slot=c.getSlots()[0];}expect(canLaunchMission(15,slot)).toBe(true);
  for(let missing=1;missing<=14;missing++){slot.missions![missing].completed=false;expect(canLaunchMission(15,slot)).toBe(false);slot.missions![missing].completed=true;}
  const ledger=strike().ledger;for(let i=1;i<=6;i++)ledger.RecordKill(`m15_bomber_${i}`,"bomber");
  const settle=(phases:number,ground=1)=>completeMission(c,1,15,true,{slot:1,missionId:15,kills:7,groundKills:ground,completedPhases:phases,elapsed:800,targetScore:ledger.Snapshot()},()=>undefined,0);
  settle(1);expect(c.getSlots()[0].missions?.[15]?.completed===true).toBe(false);settle(2,0);expect(c.getSlots()[0].missions?.[15]?.completed===true).toBe(false);settle(2);
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];expect(saved.missions![15].completed).toBe(true);expect(saved.missions![15].bestScore).toBe(4460);expect(canLaunchMission(16,saved)).toBe(false);
 }));
});
