import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { mission as bp, M10_TARGETS, M10_WORLD_TARGETS, M10_ARTILLERY as plan } from "../shared/missions/m10";
import { M10, m10TargetLayout, m10Height, m10Ground } from "../shared/M10WorldPlan";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { artilleryMasked, artilleryExposed, canyonSampleSafe } from "../shared/EngineBatchD3";
import { newSchedule, stepSchedule, ContactBudget } from "../shared/EngineBatchD6";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { FlightMath } from "../shared/FlightMath";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { takeArrival } from "../shared/CampaignEncounters";
import { BomberRules } from "../shared/BomberRules";
const strike=bp.phases[0];
function groundScore() {return M10_TARGETS.reduce((n,t)=>n+bp.scoring!.points[t.scoreRole],0);}
function earlier(fn:()=>void) {
 const before=MISSIONS.map(m=>m.available);
 for(let i=0;i<9;i++) MISSIONS[i].available=true;
 const [ok,err]=pcall(fn);
 for(let i=0;i<MISSIONS.size();i++) MISSIONS[i].available=before[i];
 if(!ok) error(err,0);
}
function result(c:CampaignCoordinator,phases:number,elapsed:number,ledger?:TargetScore) {
 return completeMission(c,1,10,true,{slot:1,missionId:10,kills:100,groundKills:100,completedPhases:phases,elapsed,targetScore:ledger?.Snapshot()},()=>undefined,0);
}
describe("M10 River Line",()=>{
 it("validates all 124 adopted ids and a bounded authored roster with subtitle-only handoff",()=>{
  MissionCatalog.ValidatePolicy(bp); expect(bp.available).toBe(true);expect(bp.worldKey).toBe("m10_river_line");
  expect(M10_WORLD_TARGETS.size()).toBe(124);expect(M10_TARGETS.size()).toBe(140);
  expect(M10_TARGETS.size()<=ContactBudget.maxContacts).toBe(true);expect(new Set(M10_TARGETS.map(t=>t.id)).size()).toBe(140);
  for(const t of M10_WORLD_TARGETS) {const p=m10TargetLayout().find(p=>p.id===t.id)!;expect(t.position).toEqual({x:p.x,y:p.y,z:p.z});expect(t.required).toBe(false);}
  expect(bp.briefing).toBe(MISSION_STORY_TEXT[10].briefing);expect(bp.allies!.killBudget).toBe(1);expect(bp.allies!.creditPlayerKills).toBe(false);expect(strike.concurrentFighters).toBe(8);
 });
 it("uses 44 airframes, counts parked handoffs once and makes S reachable",()=>{
  const waves=strike.fighterWaves!, linked=waves.filter(w=>w.parkedSourceId!==undefined);
  expect(linked.size()).toBe(12);expect(waves.reduce((n,w)=>n+w.count,1)).toBe(44);
  let maximum=groundScore()+240;
  for(const w of waves) if(!w.parkedSourceId) maximum+=w.count*bp.scoring!.points[w.scoreRole];
  expect(groundScore()).toBe(7360);expect(maximum).toBe(9340);
  expect(bp.scoring!.rank).toEqual({S:5400,A:4200,B:3800,C:3000});
  expect(maximum).toBeGreaterThan(bp.scoring!.rank.S);
  for(const w of linked) for(const first of ["ground","air"] as const) {
   const s=Runner.NewState(bp,0), ledger=new TargetScore(bp.scoring!);
   expect(recordScoredKill(s,ledger,w.parkedSourceId!,first,false,1,w.scoreRole)).toBe(true);
   expect(recordScoredKill(s,ledger,w.parkedSourceId!,first==="air"?"ground":"air",false,2,w.scoreRole)).toBe(false);
   expect(ledger.Total()).toBe(bp.scoring!.points[w.scoreRole]);
  }
 });
 it("ignores every helicopter while later pursuers and LOCKKEEPER launch on schedule within eight slots",()=>{
  const queue:AirRequest[]=[], fired=new Set<string>(), destroyed=new Set<string>();
  let live:{retireAt:number;routed:boolean}[]=[], admitted=0, peak=0;
  const counts=new Map<string,number>();
  for(let t=0;t<1200;t++) {
   // Fighters are cleared in ten seconds; helicopters are NEVER killed, only route-retired.
   live=live.filter(a=>a.retireAt>t);
   for(const a of [...strike.fighterWaves!,strike.standaloneAce!]) {
    if(takeArrival(a.id,a.trigger,{elapsed:t,phase:0,requiredKills:0,destroyed,targets:M10_TARGETS},fired))
     queue.push({arrival:a,role:"name" in a?"ace":a.role,count:"name" in a?1:a.count,behind:false});
   }
   const routed=live.filter(a=>a.routed).size();
   for(const batch of WavePlan.Admit(queue,strike.concurrentFighters!-live.size(),strike.concurrentRoutes!-routed)) {
    const a=batch.arrival!, route="route" in a?a.route:undefined;
    const duration=route?BomberRules.Create(route.waypoints,route.speed,[{x:0,y:0,z:0}]).duration:10;
    if(route) expect(duration<90).toBe(true);
    else expect(t).toBe(a.trigger.kind==="time"?a.trigger.seconds:0);
    for(let i=0;i<batch.count;i++) live.push({retireAt:t+duration,routed:route!==undefined});
    admitted+=batch.count;counts.set(a.id,(counts.get(a.id)??0)+batch.count);
   }
   expect(live.size()<=8).toBe(true);expect(live.filter(a=>a.routed).size()<=2).toBe(true);
   expect(M10_TARGETS.size()+live.size()<=ContactBudget.maxContacts).toBe(true);
   peak=math.max(peak,live.size());
  }
  expect(peak).toBe(8);expect(admitted).toBe(44);expect(queue.size()).toBe(0);
  for(const wave of strike.fighterWaves!) expect(counts.get(wave.id)).toBe(wave.count);
  expect(counts.get("m10_lockkeeper")).toBe(1);
 });
 it("holds the same strike until expiry; fails low score and destruction, pauses for rearm",()=>{
  const s=Runner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);
  for(const t of M10_TARGETS) recordScoredKill(s,ledger,t.id,"ground",false,10,t.scoreRole);
  Runner.Tick(s,1199);expect(s.phaseIndex).toBe(0);expect(s.outcome).toBeUndefined();
  s.rearmActive=true;Runner.Tick(s,1500);expect(s.elapsed).toBe(1199);s.rearmActive=false;
  Runner.Tick(s,1200);expect(s.outcome).toBe("won");expect(ledger.Total()).toBe(groundScore());
  const low=Runner.NewState(bp,0);Runner.Tick(low,1200);expect(low.outcome).toBe("failed");
  const dead=Runner.NewState(bp,0);Runner.Tick(dead,1,0);expect(dead.reason).toBe("destroyed");
  expect(strike.rearm!.health).toBe(false);expect(bp.armament!.stock!.missiles).toBe(58);
 });
 it("warns at 240, impacts at 300 then every 120 seconds through 1140; ignores pause",()=>{
  const s=newSchedule(), impacts:number[]=[];
  for(let t=1;t<=1200;t++) {const before=s.delay;stepSchedule(s,plan,0);expect(s.delay).toBe(before);const event=stepSchedule(s,plan,1);if(event.impact)impacts.push(t);}
  expect(impacts).toEqual([300,420,540,660,780,900,1020,1140]);expect(s.completed).toBe(8);
 });
 it("keeps the runway refuge clear, below an absolute ceiling, with segmented distant masking",()=>{
  for(let z=5500;z<=9000;z+=32) expect(canyonSampleSafe(plan,{x:2940,y:300,z},m10Height(2940,z))).toBe(true);
  const player={x:2940,y:300,z:8000};let travelled=0;
  expect(artilleryMasked(plan,player,(a,d)=>{
   const length=math.sqrt(d.x*d.x+d.y*d.y+d.z*d.z);expect(length).toBeLessThanOrEqual(1000.000001);travelled+=length;
   for(let k=0;k<=math.ceil(length/4);k++) {const t=k/math.ceil(length/4);if(a.y+d.y*t<=m10Ground(a.x+d.x*t,a.z+d.z*t)) return length*t;}
   return undefined;
  })).toBe(true);expect(travelled>0).toBe(true);
  expect(artilleryExposed(plan,586,true)).toBe(true);expect(artilleryExposed(plan,300,true)).toBe(false);expect(artilleryExposed(plan,300,false)).toBe(true);
 });
 it("flies the authored ingress into refuge before the first impact at normal cruise",()=>{
  const jet=FlightMath.FromPose(M10.start.x,M10.start.y,M10.start.z,-math.rad(45),0,160);
  let reached=false;
  for(let i=0;i<3000;i++) {
   const dx=2940-jet.x,dz=8000-jet.z,h=math.sqrt(dx*dx+dz*dz),pitch=math.clamp(math.atan2(300-jet.y,math.max(h,300)),-0.4,0.4);
   FlightMath.Step(jet,{x:math.clamp(-FlightMath.WrapAngle(math.atan2(-dx,-dz)-jet.yaw)*4,-1,1),y:math.clamp((pitch-jet.pitch)*4,-1,1),throttle:FlightMath.CruiseThrottle},1/30,bp.airspace);
   expect(jet.y-m10Ground(jet.x,jet.z)).toBeGreaterThan(60);
   if(h<200 && jet.y<585) {reached=true;break;}
  }
  expect(reached).toBe(true);
 });
 it("rejects forged unlock records across every prerequisite including mission 9",()=>earlier(()=>{
  const c=new CampaignCoordinator("m10-forged",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions??={};
  for(let i=1;i<=18;i++) slot.missions[i]={completed:true};
  for(let missing=1;missing<=9;missing++) {slot.missions[missing]={completed:false};expect(canLaunchMission(10,slot)).toBe(false);slot.missions[missing]={completed:true};}
  expect(canLaunchMission(10,slot)).toBe(true);expect(canLaunchMission(11,slot)).toBe(true);expect(canLaunchMission(12,slot)).toBe(true);expect(canLaunchMission(13,slot)).toBe(false);
 }));
 it("settles a full win once and round-trips its points; rejects incomplete phases",()=>earlier(()=>{
  const c=new CampaignCoordinator("m10-settle",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions??={};
  for(let i=1;i<=9;i++) c.recordMissionResult(1,i,true,100,100);
  const ledger=new TargetScore(bp.scoring!);for(const t of M10_TARGETS)ledger.RecordKill(t.id,t.scoreRole);
  result(c,0,1200,ledger);expect(slot.missions[10]?.completed===true).toBe(false);
  result(c,1,1200,ledger);
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![10];
  expect(saved.completed).toBe(true);expect(saved.bestTargetScore!.total).toBe(groundScore());
 }));
});
