import { describe, expect, it } from "@rbxts/jest-globals";
import { mission as bp, M17_TARGETS, M17_WAVES } from "../shared/missions/m17";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { WithdrawalIdentities, bridgeRouteClosed, newWithdrawal, stepWithdrawal, routeDuration } from "../shared/LeaderWithdrawalRules";
import { buildM17Plan, m17Ground, m17TargetLayout } from "../shared/M17WorldPlan";
import { AlliedRules } from "../shared/AlliedRules";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { takeArrival } from "../shared/CampaignEncounters";
import { BomberRules } from "../shared/BomberRules";
import { FlightMath } from "../shared/FlightMath";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
const strike=bp.phases[0],elite=bp.phases[1];
function score(){const s=Runner.NewState(bp,0),ledger=new TargetScore(bp.scoring!);for(const t of M17_TARGETS)recordScoredKill(s,ledger,t.id,"ground",false,1,t.scoreRole);return {s,ledger};}
function earlier(fn:()=>void){const saved=MISSIONS.map(m=>m.available);for(let i=0;i<16;i++)MISSIONS[i].available=true;const [ok,err]=pcall(fn);for(let i=0;i<MISSIONS.size();i++)MISSIONS[i].available=saved[i];if(!ok)error(err,0);}
describe("M17 Last Wing",()=>{
 it("validates adopted world ids, ledger, ranks and allied eligibility",()=>{
  MissionCatalog.ValidatePolicy(bp);expect(bp.available).toBe(true);expect(bp.worldKey).toBe("m17_capital_assault");
  const ids=new Set<string>();for(const t of M17_TARGETS){expect(ids.has(t.id)).toBe(false);ids.add(t.id);const p=m17TargetLayout().find(p=>p.id===t.id)!;expect(t.position).toEqual({x:p.x,y:p.y,z:p.z});}
  expect(M17_TARGETS.size()).toBe(60);expect(score().ledger.Total()).toBe(3110);
  let air=0;for(const w of M17_WAVES)air+=w.count*bp.scoring!.points[w.scoreRole];expect(air).toBe(1180);
  expect(3110+air+4*150).toBe(4890);expect(bp.scoring!.rank).toEqual({S:4500,A:3900,B:3200,C:2100});
  expect(4890-120).toBeGreaterThan(bp.scoring!.rank.S);expect(bp.allies!.killBudget).toBe(1);
  expect(M17_WAVES.some(w=>AlliedRules.CanEngage(bp.allies!,{required:false,enabled:true,health:100,role:w.role}))).toBe(true);
  expect(AlliedRules.CanEngage(bp.allies!,{required:true,enabled:true,health:100,role:"bandit"})).toBe(false);
  expect(AlliedRules.ShotDamage(bp.allies!,0,true,100)).toBe(0);expect(AlliedRules.ShotDamage(bp.allies!,1,false,100)).toBe(0);
 });
 it("waits the full 12 minutes, fails neglect and destruction, requires four kills AND departure",()=>{
  const {s,ledger}=score();Runner.Tick(s,719);expect(s.phaseIndex).toBe(0);Runner.Tick(s,720);expect(s.phaseIndex).toBe(1);
  for(let i=0;i<4;i++)recordScoredKill(s,ledger,WithdrawalIdentities.wingmen[i],"air",true,721+i,"bandit");
  expect(s.outcome).toBeUndefined();expect(ledger.Total()).toBe(3710);expect(recordScoredKill(s,ledger,WithdrawalIdentities.wingmen[0],"air",true,726,"bandit")).toBe(false);
  const w=newWithdrawal();expect(stepWithdrawal(w,elite.leaderWithdrawal!,3,1000)).toBe(false);expect(w.elapsed).toBe(0);
  expect(stepWithdrawal(w,elite.leaderWithdrawal!,4,routeDuration(elite.leaderWithdrawal!.departure))).toBe(true);
  Runner.ObserveLeaderDeparture(s);expect(s.outcome).toBe("won");expect(s.ruskDeparted).toBe(true);
  const early=score().s;Runner.Tick(early,720);Runner.ObserveLeaderDeparture(early);expect(early.outcome).toBeUndefined();
  const exact=score();Runner.Tick(exact.s,720);for(const id of WithdrawalIdentities.wingmen)recordScoredKill(exact.s,exact.ledger,id,"air",true,1800,"bandit");Runner.Tick(exact.s,1800);Runner.ObserveLeaderDeparture(exact.s);expect(exact.s.outcome).toBe("failed");
  const low=Runner.NewState(bp,0);Runner.Tick(low,720);expect(low.outcome).toBe("failed");
  const dead=Runner.NewState(bp,0);Runner.Tick(dead,1,0);expect(dead.reason).toBe("destroyed");
  const late=score().s;Runner.Tick(late,720);Runner.Tick(late,1800);expect(late.outcome).toBe("failed");
  const paused=Runner.NewState(bp,0);paused.rearmActive=true;Runner.Tick(paused,900);expect(paused.elapsed).toBe(0);expect(strike.rearm!.health).toBe(true);
 });
 it("keeps bridge ownership separate from witnesses and stops linked hull routes",()=>{
  const dead=new Set<string>();expect(bridgeRouteClosed(strike.bridgeClosures,dead,"m17_hull_4","hull")).toBe(false);dead.add("m17_enemy_bridge");
  expect(bridgeRouteClosed(strike.bridgeClosures,dead,"m17_hull_4","hull")).toBe(true);expect(bridgeRouteClosed(strike.bridgeClosures,dead,"m17_witnesses","sector")).toBe(false);
  expect(M17_TARGETS.filter(t=>t.parentId!==undefined).size()).toBe(7);for(const t of M17_TARGETS.filter(t=>t.parentId!==undefined))expect(M17_TARGETS.some(h=>h.id===t.parentId)).toBe(true);
 });
 it("uses real admission with persistent fighters; routed patrols cannot monopolise the budget",()=>{
  const queue:AirRequest[]=[],fired=new Set<string>();let live:{route:boolean;until:number}[]=[];const counts=new Map<string,number>();
  for(let t=0;t<720;t++){
   live=live.filter(a=>!a.route||a.until>t); // No fictional fighter despawn or assumed kill.
   for(const a of M17_WAVES)if(takeArrival(a.id,a.trigger,{elapsed:t,phase:0,requiredKills:0,destroyed:new Set(),targets:M17_TARGETS},fired))queue.push({arrival:a,role:a.role,count:a.count,behind:false});
   for(const b of WavePlan.Admit(queue,8-live.size(),2-live.filter(a=>a.route).size())){const a=b.arrival! as typeof M17_WAVES[number];for(let i=0;i<b.count;i++)live.push({route:a.route!==undefined,until:a.route?t+BomberRules.Create(a.route.waypoints,a.route.speed,[{x:0,y:0,z:0}]).duration:math.huge});counts.set(a.id,(counts.get(a.id)??0)+b.count);}
   expect(live.size()<=8).toBe(true);expect(live.filter(a=>a.route).size()<=2).toBe(true);
  }
  expect(counts.get("m17_air_5")).toBe(1);expect(counts.get("m17_air_10")).toBe(1);expect(queue.size()>0).toBe(true); // Later optional fighters await genuine kills.
  const required:AirRequest[]=[...queue,{role:"bandit",count:4,behind:false}];expect(WavePlan.Admit(required,4,2)[0].role).toBe("bandit");
 });
 it("clears terrain, foundations, bridge decks and skyline along entire authored routes",()=>{
  const world=buildM17Plan();const routes=[elite.leaderWithdrawal!.departure,...M17_WAVES.filter(w=>w.route!==undefined).map(w=>w.route!),...M17_TARGETS.filter(t=>t.route!==undefined).map(t=>t.route!),...strike.groundProgress!.sectors.map(s=>s.route)];
  for(const r of routes)for(let i=1;i<r.waypoints.size();i++){const a=r.waypoints[i-1],b=r.waypoints[i];const length=math.sqrt((a.x-b.x)**2+(a.z-b.z)**2);expect(length).toBeLessThanOrEqual(15000);const steps=math.ceil(length/16);for(let k=0;k<=steps;k++){const f=k/steps,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f,y=a.y;assert(y-m17Ground(x,z)>=8,`Route terrain at ${x},${y},${z}: ${m17Ground(x,z)}`);for(const p of world.parts)if(p.solid&&y>=p.y-p.sy/2-8&&p.name!=="m17_hull_4"&&math.abs(x-p.x)<p.sx/2&&math.abs(z-p.z)<p.sz/2)assert(y-(p.y+p.sy/2)>=8,`Route part ${p.name} at ${x},${y},${z}: top ${p.y+p.sy/2}`);}}
 });
 it("flies the ingress with the actual flight integrator above the capital",()=>{
  const jet=FlightMath.FromPose(0,471,7680,0,0,160);let reached=false;
  for(let i=0;i<6000;i++){const dx=-1000-jet.x,dz=-3840-jet.z,h=math.sqrt(dx*dx+dz*dz),pitch=math.clamp(math.atan2(1200-jet.y,math.max(h,300)),-0.4,0.4);FlightMath.Step(jet,{x:math.clamp(-FlightMath.WrapAngle(math.atan2(-dx,-dz)-jet.yaw)*4,-1,1),y:math.clamp((pitch-jet.pitch)*4,-1,1),throttle:FlightMath.CruiseThrottle},1/30,bp.airspace);expect(jet.y-m17Ground(jet.x,jet.z)).toBeGreaterThan(60);if(h<250){reached=true;break;}}
  expect(reached).toBe(true);
 });
 it("rejects forged unlocks, settles both phases once, and round trips points",()=>earlier(()=>{
  const c=new CampaignCoordinator("m17",undefined,{now:()=>1000,defer:()=>undefined});c.load();const slot=c.getSlots()[0];slot.missions??={};for(let i=1;i<=18;i++)slot.missions[i]={completed:true};
  for(let i=1;i<=16;i++){slot.missions[i]={completed:false};expect(canLaunchMission(17,slot)).toBe(false);slot.missions[i]={completed:true};}expect(canLaunchMission(17,slot)).toBe(true);expect(canLaunchMission(18,slot)).toBe(true);
  for(let i=1;i<=16;i++)c.recordMissionResult(1,i,true,100,100);
  slot.missions[17]={completed:false};const ledger=score().ledger;
  const settle=(phases:number)=>completeMission(c,1,17,true,{slot:1,missionId:17,kills:4,groundKills:60,completedPhases:phases,elapsed:900,targetScore:ledger.Snapshot()},()=>undefined,0);
  settle(1);expect(slot.missions[17].completed).toBe(false);settle(2);expect(c.getSlots()[0].missions![17].completed).toBe(true);settle(2);
  expect(normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![17].bestTargetScore!.total).toBe(3110);
 }));
});
