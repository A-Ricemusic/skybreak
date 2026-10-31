import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M16_TARGETS, M16_COLUMN, M16_WAVES } from "../shared/missions/m16";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { buildM16ScenePlan, m16TargetLayout } from "../shared/M16WorldPlan";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { newGroundProgress, stepGroundProgress, damageSector, groundProgressPose } from "../shared/EngineBatchD5";
import { sectorReinforcementReady, repairAllowed, cheapArmourEligible } from "../shared/EngineBatchD11";
import { ContactBudget } from "../shared/EngineBatchD6";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { takeArrival } from "../shared/CampaignEncounters";
import { BomberRules } from "../shared/BomberRules";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { AlliedRules } from "../shared/AlliedRules";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty } from "../shared/Difficulty";
import { completeRearmRepair } from "../server/EngineBatchD11Runtime";
import { createCombatSession } from "../server/CombatSessionFactory";
import { FlightMath } from "../shared/FlightMath";
import { SortieArmament } from "../shared/SortieArmament";
import { rearmClock, rearmMenuDue } from "../shared/SortieCutaways";
const phase=bp.phases[0];
function earlier(fn:()=>void) {
 const before=MISSIONS.map(m=>m.available);for(let i=0;i<15;i++) MISSIONS[i].available=true;
 const [ok,err]=pcall(fn);for(let i=0;i<MISSIONS.size();i++) MISSIONS[i].available=before[i];if(!ok) error(err,0);
}
describe("M16 Dust Road",()=>{
 it("removes airborne contact blocks and column placeholders from runtime scenery",()=>{
  const plan=buildM16ScenePlan();
  expect(plan.targets.size()).toBe(138);
  for(const t of m16TargetLayout().filter(t=>t.group==="air_cover")) {
   expect(plan.targets.some(x=>x.id===t.id)).toBe(false);
   expect(plan.parts.some(p=>p.name===t.id)).toBe(false);
  }
  expect(plan.parts.some(p=>p.name.sub(1,20)==="m16_friendly_column_")).toBe(false);
 });
 it("validates adopted world ids, authored ledger and S headroom",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.worldKey).toBe("m16_road_home");
  expect(M16_TARGETS.size()).toBe(138);expect(new Set(M16_TARGETS.map(t=>t.id)).size()).toBe(138);
  for(const t of M16_TARGETS) {const w=m16TargetLayout().find(w=>w.id===t.id)!;expect(t.position).toEqual({x:w.x,y:w.y,z:w.z});expect(t.required).toBe(false);}
  const ground=M16_TARGETS.reduce((n,t)=>n+bp.scoring!.points[t.scoreRole],0);
  const air=M16_WAVES.reduce((n,w)=>n+w.count*bp.scoring!.points[w.scoreRole],0);
  expect(ground).toBe(6830);expect(air).toBe(2050);expect(ground+air).toBe(8880);expect(bp.scoring!.rank).toEqual({S:7800,A:6000,B:4500,C:3500});
  expect(M16_TARGETS.filter(cheapArmourEligible).size()).toBe(124);
 });
 it("advances the visible column only after clearance, releases 25 reserves, reaches town",()=>{
  const states=newGroundProgress(M16_COLUMN), destroyed=new Set<string>();
  stepGroundProgress(M16_COLUMN,states,destroyed,100);expect(states[0].elapsed).toBe(0);
  expect(M16_TARGETS.filter(t=>!sectorReinforcementReady(t.reinforceAfterSector,M16_COLUMN,states)).size()).toBe(25);
  for(let i=0;i<3;i++) {
   for(const id of M16_COLUMN.sectors[i].clearTargetIds) destroyed.add(id);
   stepGroundProgress(M16_COLUMN,states,destroyed,M16_COLUMN.sectors[i].seconds);
   expect(states[i].secured).toBe(true);expect(groundProgressPose(M16_COLUMN.sectors[i],states[i])).toEqual(M16_COLUMN.sectors[i].route.waypoints[1]);
  }
  expect(M16_TARGETS.every(t=>sectorReinforcementReady(t.reinforceAfterSector,M16_COLUMN,states))).toBe(true);
  expect(stepGroundProgress(M16_COLUMN,states,destroyed,1000)).toEqual([]);
  damageSector(states[0],320);expect(sectorReinforcementReady("m16_south",M16_COLUMN,states)).toBe(false);
 });
 it("reserves three attack slots with persistent cover and actual partial route admission",()=>{
  const queue:AirRequest[]=[],fired=new Set<string>(),destroyed=new Set<string>();
  let live:{id:string;until:number;routed:boolean}[]=[],admitted=0;
  const entries=new Map<string,number[]>();
  for(let t=0;t<1200;t++) {
   // Conservative 159s defense deadline, verified by M16Fairness; ordinary cover NEVER times out.
   live=live.filter(a=>a.until>t);
   for(const w of M16_WAVES) if(takeArrival(w.id,w.trigger,{elapsed:t,phase:0,requiredKills:0,destroyed,targets:M16_TARGETS},fired)) queue.push({arrival:w,role:w.role,count:w.count,behind:false});
   for(const batch of WavePlan.Admit(queue,phase.concurrentFighters!-live.size(),phase.concurrentRoutes!-live.filter(a=>a.routed).size())) {
    const w=batch.arrival!; const route="route" in w?w.route:undefined;
    const times=entries.get(w.id)??[]; for(let k=0;k<batch.count;k++) times.push(t); entries.set(w.id,times);
    const duration=route?BomberRules.Create(route.waypoints,route.speed,[{x:0,y:0,z:0}]).duration: "attackSector" in w && w.attackSector?159:math.huge;
    for(let i=0;i<batch.count;i++) live.push({id:w.id,until:t+duration,routed:route!==undefined});admitted+=batch.count;
   }
   expect(live.size()).toBeLessThanOrEqual(11);expect(live.filter(a=>a.routed).size()).toBeLessThanOrEqual(2);
   expect(M16_TARGETS.size()+live.size()).toBeLessThanOrEqual(ContactBudget.maxContacts);
   if(t===1199) expect(live.filter(a=>a.until===math.huge).size()).toBe(6);
  }
  const route=M16_WAVES[3].route!;const actor=BomberRules.Create(route.waypoints,route.speed,[{x:0,y:0,z:0}]);
  expect(BomberRules.Sample(actor,99.99).escaped).toBe(false);expect(BomberRules.Sample(actor,100).escaped).toBe(true);
  expect(entries.get("m16_low_cover")).toEqual([0,0,100,100,200]);
  for(const w of M16_WAVES) if(w.attackSector) expect(entries.get(w.id)).toEqual([0,1,2].map(()=>w.trigger.kind==="time"?w.trigger.seconds:0));
  expect(admitted).toBe(32);expect(queue.size()).toBe(0);
  // Old eight-slot configuration: five persistent fighters + two routes leaves ONE slot.
  const old:AirRequest[]=[{arrival:M16_WAVES[5],role:"raider",count:3,behind:false}];
  expect(WavePlan.Admit(old,8-5-2,0)[0].count).toBe(1);expect(old[0].count).toBe(2);
 });
 it("capacity estimate ONLY: assumed 12s kills fit the ammunition stock",()=>{
  // Runtime D5: 10 damage, 2s windup, 8s reload, no difficulty multiplier.
  // Conservative unobstructed range from admission. Actual flight/LOS can reduce damage.
  // SupportHealth caps hull at 100; budget a wasted missile for the pressure flare.
  // Aiming/transit assumption: sequential 12-second kills, to be checked in Player.
  for(const difficulty of Difficulty.Order) for(const attentive of [false,true]) {
   const states=newGroundProgress(M16_COLUMN);let missiles=bp.armament!.stock!.missiles;
   const shots=math.ceil(Difficulty.SupportHealth(difficulty,100)/SpecialWeapons.StandardDamage)+(AlliedRules.PressureFlare(bp.pressure,false,"raider",difficulty)?1:0);
   for(const w of M16_WAVES) if(w.attackSector) {
    const index=M16_COLUMN.sectors.findIndex(s=>s.id===w.attackSector);
    for(let t=1;t<=120;t++) for(let k=0;k<w.count;k++) {
     const killAt=12*(k+1);
     if(attentive && t===killAt) missiles-=shots;
     if(attentive && t>=killAt) continue;
     if(t>=2 && (t-2)%10===0) damageSector(states[index],10);
    }
   }
   expect(states.every(s=>s.health>0)).toBe(attentive);expect(missiles).toBeGreaterThanOrEqual(17);
   expect(Difficulty.Coerce(difficulty)).toBe(difficulty);
  }
 });
 it("allows one optional allied kill and never required or bomber kills",()=>{
  expect(M16_WAVES[0].attackSector).toBe("m16_south");expect(M16_WAVES[0].count).toBe(3);
  expect(bp.allies!.killBudget).toBe(1);expect(bp.allies!.creditPlayerKills).toBe(false);
  const target={enabled:true,health:100,required:false,role:M16_WAVES[0].role};
  expect(AlliedRules.CanEngage(bp.allies!,target)).toBe(true);
  expect(AlliedRules.CanEngage(bp.allies!,{...target,required:true})).toBe(false);
  expect(AlliedRules.CanEngage(bp.allies!,{...target,role:"bomber"})).toBe(false);
  expect(AlliedRules.BudgetRemaining(bp.allies!,1)).toBe(false);
 });
 it("holds threshold to expiry, fails low points or destruction and pauses for repair service",()=>{
  const s=R.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(const t of M16_TARGETS) recordScoredKill(s,ledger,t.id,"ground",false,1,t.scoreRole);
  expect(recordScoredKill(s,ledger,M16_TARGETS[0].id,"ground",false,2,"tank")).toBe(false);
  R.Tick(s,1199);expect(s.outcome).toBeUndefined();s.rearmActive=true;R.Tick(s,1500);expect(s.elapsed).toBe(1199);s.rearmActive=false;R.Tick(s,1200);expect(s.outcome).toBe("won");
  const low=R.NewState(bp,0);R.Tick(low,1200);expect(low.reason).toBe("timeout");const dead=R.NewState(bp,0);R.Tick(dead,1,0);expect(dead.reason).toBe("destroyed");
  expect(repairAllowed(16,phase.rearm!.health===true)).toBe(true);expect(phase.rearm!.weaponMenu).toBe(true);
 });
 it("repairs an actual damaged session only on service completion and refills selected stocks",()=>{
  const session=createCombatSession({} as Player,1,{} as Folder,{} as Model,FlightMath.FromPose(0,500,0,0,0,0),16,"salvo","normal",0);session.health=35;session.damageTaken=65;
  completeRearmRepair(session,false);expect(session.health).toBe(35);
  completeRearmRepair(session,phase.rearm!.health);expect(session.health).toBe(100);expect(session.damageTaken).toBe(65);
  session.health=0;completeRearmRepair(session,true);expect(session.health).toBe(0);
  const stocks=SortieArmament.Refill(phase.rearm!,bp.armament,"salvo");expect(stocks.missiles).toBe(80);expect(stocks.gunRounds).toBe(1000);
  expect(rearmClock(phase.rearm!,0,false)).toEqual({label:"LANDING",seconds:180});expect(rearmMenuDue(phase.rearm!,35,false)).toBe(true);expect(rearmClock(phase.rearm!,35,true)).toEqual({label:"TAKEOFF",seconds:60});
 });
 it("uses the existing deadline-first rule when the threshold hit shares the expiry timestamp",()=>{
  for(const time of [1199.99,1200]) {
   const state=R.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
   for(let i=0;i<69;i++) recordScoredKill(state,ledger,`before_${i}`,"ground",false,1,"tank");
   expect(recordScoredKill(state,ledger,"last","ground",false,time,"tank")).toBe(time<1200);
   R.Tick(state,1200);expect(state.outcome).toBe(time<1200?"won":"failed");
  }
 });
 it("requires all 15 predecessors even with forged later records and settles only full wins",()=>earlier(()=>{
  const c=new CampaignCoordinator("m16",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions??={};
  for(let i=1;i<=18;i++) slot.missions[i]={completed:true};
  for(let i=1;i<=15;i++) {slot.missions[i]={completed:false};expect(canLaunchMission(16,slot)).toBe(false);slot.missions[i]={completed:true};}
  expect(canLaunchMission(16,slot)).toBe(true);slot.missions[16]={completed:false};
  for(let i=1;i<=15;i++) c.recordMissionResult(1,i,true,100,100);
  const ledger=new TargetScore(bp.scoring!);for(const t of M16_TARGETS)ledger.RecordKill(t.id,t.scoreRole);
  for(const phases of [0,1]) {
   completeMission(c,1,16,true,{slot:1,missionId:16,kills:138,groundKills:138,completedPhases:phases,elapsed:1200,targetScore:ledger.Snapshot()},()=>undefined,0);
   expect(c.getSlots()[0].missions?.[16]?.completed===true).toBe(phases===1);
  }
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![16];expect(saved.bestTargetScore!.total).toBe(6830);
 }));
});
