// Enemy leader withdrawal routes and bridge closures (pure). Formerly EngineBatchD12.
import { finiteNumber } from "./LandingRules";
import { surfacePose, SurfaceRoute } from "./SurfaceTargetRules";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";
/** Reserved sortie identities, shared by admission and runtime spawning. Rusk is never credited. */
export const WithdrawalIdentities = { leader: "d12_rusk", wingmen: ["d12_wingman_1", "d12_wingman_2", "d12_wingman_3", "d12_wingman_4"] } as const;
/** Four normal required fighters; leader is a separate noncombat story actor. */
export interface LeaderWithdrawal { departure: SurfaceRoute }
/** A destroyed military bridge closes a route. Friendly witness routes must remain separate. */
export interface BridgeClosure { targetId: string; sectorIds: string[]; hullIds: string[] }
export interface WithdrawalState { elapsed: number; departing: boolean; departed: boolean }
export function newWithdrawal(): WithdrawalState { return {elapsed:0,departing:false,departed:false}; }
export function routeDuration(route: SurfaceRoute): number {
 let distance=0;
 for(let i=1;i<route.waypoints.size();i++) { const a=route.waypoints[i-1],b=route.waypoints[i]; distance+=math.sqrt((a.x-b.x)**2+(a.z-b.z)**2); }
 return distance/route.speed;
}
/** Cannot leave early or softlock on leader damage: only four credited wingmen start departure. */
export function stepWithdrawal(state: WithdrawalState, plan: LeaderWithdrawal, kills: number, dt: number): boolean {
 if(state.departed || kills<4 || !finiteNumber(dt) || dt<=0) return false;
 state.departing=true; state.elapsed=math.min(routeDuration(plan.departure),state.elapsed+dt);
 state.departed=state.elapsed>=routeDuration(plan.departure); return state.departed;
}
export function bridgeRouteClosed(links: BridgeClosure[] | undefined, destroyed: Set<string>, id: string, kind: "sector" | "hull"): boolean {
 return (links ?? []).some(link=>destroyed.has(link.targetId) && (kind==="sector" ? link.sectorIds : link.hullIds).includes(id));
}
export function leaderPose(plan: LeaderWithdrawal, state: WithdrawalState) { return surfacePose(plan.departure,state.elapsed); }
export function validateLeaderWithdrawalPhases(phases: MissionPhaseBlueprint[], limit: number): void {
 assert(phases.filter(p=>p.leaderWithdrawal!==undefined).size()<=1,"One Rusk departure per sortie");
 for(const p of phases) {
  const plan=p.leaderWithdrawal;
  if(plan) {
   assert(p.kind==="required_air" && p.count===4 && p.execution?.directSpawn===true,"Rusk needs four direct required wingmen");
   assert(p.execution.launchDelay===undefined && !p.points && !p.returnLine && !p.landing && !p.rearm && !p.hazard && !p.scoreThreshold && (p.optionalRaiders ?? 0)===0 && (p.reinforce?.size() ?? 0)===0 && !p.eliteFormation && !p.cruiseIntercept && !p.spatialJamming && !p.protection && !p.bombers && !p.interceptHold && !p.twist && !p.execution.preservePursuers && !p.standaloneAce && !p.concurrentFighters && (p.fighterWaves?.size() ?? 0)===0,"Withdrawal owns its five-aircraft budget and cleanup");
   const r=plan.departure;
   assert(finiteNumber(r.speed) && r.speed>=100 && r.speed<=400 && r.waypoints.size()>=2 && r.waypoints.size()<=16,"Invalid leader route");
   for(const v of r.waypoints) assert(finiteNumber(v.x) && finiteNumber(v.y) && finiteNumber(v.z) && math.abs(v.x)<=limit && math.abs(v.z)<=limit && v.y>=170 && v.y<=2000 && v.y===r.waypoints[0].y,"Leader outside airspace");
   for(let i=1;i<r.waypoints.size();i++) { const a=r.waypoints[i-1],b=r.waypoints[i]; assert((a.x-b.x)**2+(a.z-b.z)**2>1,"Duplicate leader leg"); }
   const seconds=p.update?.countdownSeconds;
   assert(seconds!==undefined && finiteNumber(seconds) && seconds>routeDuration(r)+30 && seconds<=1800 && routeDuration(r)<=120,"Fresh clock must include departure reserve");
  }
  const owners=new Set<string>(), targets=p.groundTargets ?? [];
  assert((p.bridgeClosures?.size() ?? 0)<=16,"Bridge budget exceeded");
  for(const link of p.bridgeClosures ?? []) {
   assert(targets.some(t=>t.id===link.targetId && t.type==="bridge_section" && !t.parentId && !t.route),"Closure needs same-phase bridge target");
   assert(link.sectorIds.size()+link.hullIds.size()>0 && link.sectorIds.size()+link.hullIds.size()<=24,"Closure needs bounded route owners");
   for(const id of link.sectorIds) {
    assert(!owners.has(id) && p.groundProgress?.sectors.some(s=>s.id===id)===true,"Unknown/duplicate bridge sector"); owners.add(id);
   }
   for(const id of link.hullIds) {
    assert(!owners.has(id) && targets.some(t=>t.id===id && t.route!==undefined && !t.parentId),"Unknown/duplicate bridge hull"); owners.add(id);
   }
  }
 }
}
