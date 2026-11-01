import { crossesVolume as crosses } from "../shared/FinaleDuelRules";
import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M18_TARGETS, M18_VENT as v } from "../shared/missions/m18";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { buildM18Plan, m18Ground, m18TargetLayout, m18VentRoute } from "../shared/M18WorldPlan";
import { M18_ASCENDING, ascendingPose } from "../shared/M18FinaleRules";
import { duelTargetId, newVent, stepVent, ventObstructed } from "../shared/FinaleDuelRules";
import { FlightMath } from "../shared/FlightMath";
import { WeaponRules } from "../shared/WeaponRules";
import { AlliedRules } from "../shared/AlliedRules";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { SortieArmament } from "../shared/SortieArmament";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { Settlement } from "../shared/SessionGuard";
import { STORY, chapterBeforeMission } from "../shared/RelayStory";
function generators(){const s=R.NewState(bp,0);for(const t of M18_TARGETS.filter(t=>t.type==="generator"))R.RecordKill(s,t.id,"ground",true,1);return s;}
function duel(){const s=generators();s.vent!.elapsed=3;s.vent!.checkpoint=v.checkpoints.size();R.RecordKill(s,v.core,"ground",true,2);R.ObserveFlight(s,{x:0,y:174,z:-6900},{x:0,y:174,z:-7100},0.1,10);return s;}
function prerequisites(fn:()=>void){const old=MISSIONS.map(m=>m.available);for(let i=0;i<17;i++)MISSIONS[i].available=true;const [ok,e]=pcall(fn);for(let i=0;i<18;i++)MISSIONS[i].available=old[i];if(!ok)error(e,0);}
describe("M18 playable finale",()=>{
 it("validates authored ids, adopted world targets, phase clocks, original story and raw ledger",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.phases.size()).toBe(3);
  expect(bp.countdownSeconds).toBe(1200);expect(bp.phases[1].update!.countdownSeconds).toBe(1800);expect(bp.phases[2].update!.countdownSeconds).toBe(300);
  for(const t of M18_TARGETS){const world=m18TargetLayout().find(w=>w.id===t.id)!;expect(t.position).toEqual({x:world.x,y:world.y,z:world.z});expect(t.required).toBe(true);}
  const ids=[...M18_TARGETS.map(t=>t.id),...bp.phases[0].fighterWaves!.map(t=>t.id),bp.phases[0].standaloneAce!.id,...M18_ASCENDING.map(t=>t.id),duelTargetId(2)];expect(new Set(ids).size()).toBe(21);
  const invalid={...bp,phases:bp.phases.map(p=>({...p}))};invalid.phases[1].batchD13={...bp.phases[1].batchD13,ascending:M18_ASCENDING.map((t,i)=>i===0?{...t,id:v.core}:t)};
  const [ok]=pcall(()=>MissionCatalog.ValidatePolicy(invalid));expect(ok).toBe(false);
  const ledger=new TargetScore(bp.scoring!);for(let i=0;i<11;i++)ledger.RecordKill(`e${i}`,"elite");ledger.RecordKill("named","ace");for(const t of M18_TARGETS)ledger.RecordKill(t.id,t.scoreRole);for(const t of M18_ASCENDING)ledger.RecordKill(t.id,"ascending");expect(ledger.Total()).toBe(4920);ledger.RecordKill("rusk","ace");expect(ledger.Total()).toBe(5160);
  expect(bp.scoring!.rank).toEqual({S:4920,A:4200,B:3300,C:2730});expect(5160-240).toBeGreaterThanOrEqual(bp.scoring!.rank.S);
  expect(chapterBeforeMission(18)).toBe(17);expect(STORY[17].title).toBe("Broken relay");expect(STORY[18].title).toBe("A clear frequency");
 });
 it("admits every opening fighter and ace without assuming any fighter retires",()=>{
  const phase=bp.phases[0],q:AirRequest[]=phase.fighterWaves!.map(a=>({arrival:a,role:a.role,count:a.count,behind:false}));q.push({arrival:phase.standaloneAce,role:"ace",count:1,behind:false});
  const admitted=WavePlan.Admit(q,phase.concurrentFighters!,0);expect(admitted.reduce((n,a)=>n+a.count,0)).toBe(12);expect(q.size()).toBe(0);
  const optional={enabled:true,health:100,required:false,role:"raider"};expect(AlliedRules.CanEngage(bp.allies!,optional)).toBe(true);expect(AlliedRules.CanEngage(bp.allies!,{...optional,required:true})).toBe(false);expect(AlliedRules.CanEngage(bp.allies!,optional,false)).toBe(false);
  expect(AlliedRules.BudgetRemaining(bp.allies!,0)).toBe(true);expect(AlliedRules.BudgetRemaining(bp.allies!,1)).toBe(false);expect(AlliedRules.Credit(bp.allies!)).toBe(false);
 });
 it("requires three generators, timed checkpoints, core and an exit before the isolated duel",()=>{
  const s=R.NewState(bp,0);expect(R.RecordKill(s,v.core,"ground",true,0.5)).toBe(false);
  const g=generators();expect(g.phaseIndex).toBe(1);expect(g.outcome).toBeUndefined();
  const vs=newVent(),k=new Set(v.generators);for(let i=0;i<30;i++)stepVent(vs,v,k,{x:0,y:174,z:0},{x:0,y:174,z:0},0.1);
  for(const box of v.checkpoints)stepVent(vs,v,k,box.center,box.center,0.1);expect(vs.checkpoint).toBe(2);
  stepVent(vs,v,k,{x:0,y:174,z:-6900},{x:0,y:174,z:-7100},0.1);expect(vs.exited).toBe(false);
  g.vent!.elapsed=3;g.vent!.checkpoint=2;R.RecordKill(g,v.core,"ground",true,2);expect(g.phaseIndex).toBe(1);expect(g.outcome).toBeUndefined();
  const d=duel();expect(d.phaseIndex).toBe(2);expect(R.TimeRemaining(d)).toBe(300);expect(R.RecordKill(d,duelTargetId(2),"ace",true,11)).toBe(true);expect(d.outcome).toBe("won");expect(R.RecordKill(d,duelTargetId(2),"ace",true,12)).toBe(false);
  const late=duel();R.Tick(late,310);expect(late.outcome).toBe("failed");expect(R.RecordKill(late,duelTargetId(2),"ace",true,310)).toBe(false);
  const tie=duel();expect(R.RecordKill(tie,duelTargetId(2),"ace",true,310)).toBe(false);expect(tie.outcome).toBe("failed");
  const dead=duel();R.Tick(dead,11,0);expect(dead.reason).toBe("destroyed");
 });
 it("credits optional launches only once, never makes departure required, preserves rack progress",()=>{
  const s=generators(),ledger=new TargetScore(bp.scoring!);
  for(const t of M18_ASCENDING){expect(ascendingPose(t,100).y).toBe(t.end.y);expect(t.start.y).toBeGreaterThan(m18Ground(t.start.x,t.start.z)+100);expect(recordScoredKill(s,ledger,t.id,"air",false,2,"ascending")).toBe(true);expect(recordScoredKill(s,ledger,t.id,"air",false,2,"ascending")).toBe(false);}
  expect(ledger.Total()).toBe(1200);
  // Real opening fighters persist into the vent; their remaining credits cannot consume launch capacity.
  expect(bp.phases[1].execution!.preservePursuers).toBe(true);
  for(let i=0;i<11;i++)expect(R.RecordKill(s,`retained_${i}`,"air",false,2)).toBe(true);
  expect(R.RecordKill(s,"last_echo","ace",false,2)).toBe(true);
  expect(R.CanDamage(s,"air",false)).toBe(false);expect(s.phaseIndex).toBe(1);
  const ignored=generators();R.Tick(ignored,100);expect(ignored.outcome).toBeUndefined();
  expect(SortieArmament.Regenerates(bp.armament)).toBe(true);const [count,progress]=SortieArmament.RackTick(2,2.45,0.1,bp.armament);expect(count).toBe(3);expect(progress).toBeCloseTo(0.05);expect(WeaponRules.MaxMissiles).toBe(8);
 });
 it("flies the descent and enclosed line using real cruise speed and pitch rate with swept clearance",()=>{
  const parts=buildM18Plan().parts.filter(p=>p.solid),radius=FlightMath.CruiseSpeed/FlightMath.PitchRate;
  expect(radius).toBe(128);expect(FlightMath.CruiseSpeed/FlightMath.TurnRate).toBeLessThan(150);
  // Follow an actual bounded-stick dive and recovery; no instantaneous attitude changes.
  const s=FlightMath.FromPose(0,617,-2960,0,0,FlightMath.CruiseSpeed);let levelling=false,min=math.huge;
  for(let i=0;i<2000 && s.z>-7100;i++){
   const before={x:s.x,y:s.y,z:s.z};
   if(s.y<=174+radius*(1-math.cos(s.pitch))+2)levelling=true;
   const pitch=levelling?(s.pitch< -0.005?1:0):(s.pitch> -0.65?-1:0);
   FlightMath.Step(s,{x:0,y:pitch,throttle:FlightMath.CruiseThrottle},0.02,bp.airspace);
   for(const p of parts){const a={center:{x:p.x,y:p.y,z:p.z},half:{x:p.sx/2+24,y:p.sy/2+24,z:p.sz/2+24}};
    // Swept AABB cast is the same segmented LOS primitive's supplied collision predicate.
    expect(ventObstructed(before,s,(o,d)=>{
     const finish={x:o.x+d.x,y:o.y+d.y,z:o.z+d.z};
     return crosses(a,o,finish)?0:undefined;
    },0)).toBe(false);
   }
   if(s.z< -3700){min=math.min(min,s.y);expect(math.abs(s.y-174)).toBeLessThan(8);}
  }
  expect(s.z).toBeLessThan(-7000);expect(min).toBeGreaterThan(150);
  const route=m18VentRoute();expect(route[0].z).toBe(-2960);expect(route[route.size()-1].z).toBe(-7000);
  // Opening is permanent, and reachable after the three-second gate at cruise.
  expect((3700-2960)/FlightMath.CruiseSpeed).toBeGreaterThan(v.openingSeconds);
  const core=M18_TARGETS.find(t=>t.id===v.core)!.position;
  const dx=core.x,dz=core.z-v.checkpoints[1].center.z,distance=math.sqrt(dx*dx+dz*dz);
  expect(WeaponRules.Launch({missiles:1,missileCooldown:0,hasTarget:true,lockProgress:1,distance,dot:-dz/distance,groundTarget:true}).kind).toBe("guided");
  expect(WeaponRules.LockBuildSeconds+distance/WeaponRules.MissileSpeed).toBeLessThan(-dz/FlightMath.CruiseSpeed);
 });
 it("records the campaign ending sequentially, rejects forged unlocks and mission 19, settles once",()=>prerequisites(()=>{
  const ledger=new TargetScore(bp.scoring!);for(const t of M18_TARGETS)ledger.RecordKill(t.id,t.scoreRole);ledger.RecordKill(duelTargetId(2),"ace");
  const c=new CampaignCoordinator("m18",undefined,{now:()=>1000,defer:()=>undefined});c.load();
  expect(canLaunchMission(18,c.getSlots()[0])).toBe(false);
  for(let id=1;id<=18;id++){
   const b=MissionCatalog.Get(id);expect(canLaunchMission(id,c.getSlots()[0])).toBe(true);
   expect(completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(b)+MissionCatalog.RequiredGroundKills(b),groundKills:MissionCatalog.RequiredGroundKills(b),completedPhases:MissionCatalog.TotalPhases(b),elapsed:100,...(id===18?{targetScore:ledger.Snapshot()}:{})},()=>undefined,0)).toBe(true);
  }
  const slot=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0];expect(slot.completed).toBe(true);expect(slot.missions![18].completed).toBe(true);expect(slot.missions![18].bestTargetScore).toEqual(ledger.Snapshot());expect(highestUnlocked(slot)).toBe(18);expect(slot.currentMission).toBe(18);expect(canLaunchMission(19,slot)).toBe(false);
  expect(canLaunchMission(18,slot)).toBe(true);expect(MissionCatalog.IsValidId(19)).toBe(false);
  delete slot.missions![17];expect(canLaunchMission(18,slot)).toBe(false);const forged=new CampaignCoordinator("m18-forged",undefined,{now:()=>1000,defer:()=>undefined});forged.load();expect(completeMission(forged,1,18,true,{slot:1,missionId:18,kills:0,groundKills:0,completedPhases:0,elapsed:0},()=>undefined,0)).toBe(false);
  let saves=0,finales=0;const state=Settlement.New();const hooks={announce:()=>{finales++;},schedule:(f:()=>void)=>f(),save:()=>{saves++;},unsaved:()=>undefined,teardown:()=>undefined,release:()=>undefined,warn:()=>undefined};Settlement.Begin(state,hooks);Settlement.Begin(state,hooks);expect(saves).toBe(1);expect(finales).toBe(1);
 }));
});
