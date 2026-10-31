import { finiteNumber, landingDuration, landingPose } from "./EngineBatchB";
import { FlightMath, FlightState } from "./FlightMath";
import { LaunchStage } from "./LaunchStage";
import { surfacePose, SurfaceRoute } from "./EngineBatchD2";
import type { RearmPlan } from "./EngineBatchC";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";
/** Aircraft pivot plane, including gear clearance. Deck footprint is authored, not a terrain guess. */
export interface CarrierRearm { centre: FlightPoint; width: number; length: number; catapult: FlightPoint }
export interface GroundSector {
 /** D11 presentation only; progression remains the D5 director. */ formation?: "city_squad" | "desert_column";
 id: string; clearTargetIds: string[]; after?: string; seconds: number; health: number;
 route: SurfaceRoute; kind: "landing_craft" | "troops" | "column"; advanceCall: string; securedCall: string; hitCall: string;
}
export interface GroundProgressPlan { sectors: GroundSector[] }
export interface SectorState { elapsed: number; health: number; started: boolean; secured: boolean; warned: boolean }
export function newGroundProgress(p: GroundProgressPlan): SectorState[] { return p.sectors.map(s=>({elapsed:0,health:s.health,started:false,secured:false,warned:false})); }
/** No allied offensive damage/kill path: the existing sortie-wide ally budget remains authoritative. */
export function stepGroundProgress(p: GroundProgressPlan, states: SectorState[], destroyed: Set<string>, dt: number): string[] {
 const lines: string[]=[];
 if(!finiteNumber(dt) || dt<=0) return lines;
 const secured=new Set<string>(); for(let i=0;i<states.size();i++) if(states[i].secured) secured.add(p.sectors[i].id);
 for(let i=0;i<p.sectors.size();i++) {
  const s=p.sectors[i], state=states[i];
  if(state.health<=0 || state.secured || (s.after!==undefined && !secured.has(s.after)) || !s.clearTargetIds.every(id=>destroyed.has(id))) continue;
  if(!state.started) { state.started=true; lines.push(s.advanceCall); }
  state.elapsed=math.min(s.seconds,state.elapsed+dt);
  if(state.elapsed>=s.seconds) { state.secured=true; lines.push(s.securedCall); }
 }
 return lines;
}
export function groundProgressPose(s: GroundSector, state: SectorState): FlightPoint { return surfacePose(s.route,state.elapsed).position; }
/** A committed attack never silently retargets the player when the landing force is absent. */
export function attackSectorIndex(p: GroundProgressPlan, states: SectorState[], id: string): number | undefined {
 for(let i=0;i<p.sectors.size();i++) if(p.sectors[i].id===id && states[i].health>0) return i;
 return undefined;
}
export function damageSector(s: SectorState, damage: number): boolean {
 if(!finiteNumber(damage) || damage<=0 || s.health<=0) return false;
 s.health=math.max(0,s.health-damage); const announce=!s.warned; s.warned=true; return announce;
}
/** Arrested landing, short deck taxi to the authored catapult, then M01's fixed-heading fly-off. */
export function carrierRearmPose(p: RearmPlan, elapsed: number): FlightState {
 const c=p.carrier!, landed=landingDuration(p.landing), rollout=landingPose(p.landing,landed);
 if(elapsed<landed) return landingPose(p.landing,elapsed);
 const taxi=p.takeoffSeconds-LaunchStage.Seconds, t=math.clamp(elapsed-landed,0,p.takeoffSeconds), a=math.rad(p.landing.headingDegrees);
 if(t<taxi) { const f=t/taxi; return FlightMath.FromPose(rollout.x+(c.catapult.x-rollout.x)*f,c.catapult.y,rollout.z+(c.catapult.z-rollout.z)*f,-a,0,0); }
 const state=LaunchStage.Pose({kind:"carrier_flyoff",...c.catapult,headingDegrees:-p.landing.headingDegrees,speed:FlightMath.CruiseSpeed+20});
 LaunchStage.Advance({elapsed:0},state,t-taxi); return state;
}
export function validateBatchD5(phases: MissionPhaseBlueprint[], limit: number): void {
 const positive=(n:number,max:number)=>assert(finiteNumber(n) && n>0 && n<=max,"D5 invalid positive budget");
 const point=(p:FlightPoint)=>assert(finiteNumber(p.x) && finiteNumber(p.y) && finiteNumber(p.z) && math.abs(p.x)<=limit && math.abs(p.z)<=limit && p.y>=0 && p.y<=2000,"D5 point outside airspace");
 for(const phase of phases) {
  const r=phase.rearm, c=r?.carrier;
  if(r && c) {
   point(c.centre); point(c.catapult); positive(c.width,200); positive(c.length,600);
   assert(r.takeoffSeconds>LaunchStage.Seconds && r.takeoffSeconds<=30,"Carrier needs taxi plus fly-off");
   const a=math.rad(r.landing.headingDegrees);
   const onDeck=(p:FlightPoint)=>{ const x=p.x-c.centre.x,z=p.z-c.centre.z; assert(math.abs(x*math.cos(a)+z*math.sin(a))<=c.width/2-12 && math.abs(x*math.sin(a)-z*math.cos(a))<=c.length/2-12 && math.abs(p.y-c.centre.y)<0.1,"Carrier pose outside deck"); };
   onDeck(r.landing.touchdown); onDeck(landingPose(r.landing,landingDuration(r.landing))); onDeck(c.catapult);
   assert(r.landing.accomplishedSeconds===undefined,"Carrier service has no mission completion hold");
  }
  const p=phase.groundProgress;
  if(p) {
   assert(p.sectors.size()>0 && p.sectors.size()<=12,"D5 sector budget"); const ids=new Set<string>();
   for(const s of p.sectors) {
    assert(s.id.size()>0 && !ids.has(s.id) && (s.after===undefined || ids.has(s.after)),"D5 sectors need unique ordered dependencies"); ids.add(s.id);
    positive(s.seconds,3600); positive(s.health,2000); positive(s.route.speed,60);
    assert(["landing_craft","troops","column"].includes(s.kind),"Invalid friendly route kind");
    assert(s.clearTargetIds.size()>0 && s.clearTargetIds.size()<=128,"D5 sector needs bounded clear targets");
    const targets=new Set<string>(); for(const id of s.clearTargetIds) { assert(!targets.has(id) && (phase.groundTargets ?? []).some(t=>t.id===id),"Unknown/duplicate sector target"); targets.add(id); }
    for(const line of [s.advanceCall,s.securedCall,s.hitCall]) assert(line.size()>0 && line.size()<=72,"Invalid sector radio");
    assert(s.route.waypoints.size()>=2 && s.route.waypoints.size()<=32,"Invalid friendly route");
    let length=0; for(let i=0;i<s.route.waypoints.size();i++) { const v=s.route.waypoints[i]; point(v); if(i>0) { const u=s.route.waypoints[i-1]; const leg=math.sqrt((v.x-u.x)**2+(v.z-u.z)**2); assert(leg>1 && v.y===u.y,"Friendly route needs distinct level legs"); length+=leg; } }
    assert(length/s.route.speed<=s.seconds,"Sector time must include route traversal");
   }
  }
  for(const w of phase.fighterWaves ?? []) if(w.attackSector!==undefined) assert(p!==undefined && p.sectors.some(s=>s.id===w.attackSector) && w.aircraft===undefined && w.route===undefined && w.scramble!==true,"Beach attacker needs a same-phase sector and fighter flight");
 }
}
