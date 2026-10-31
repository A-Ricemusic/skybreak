import { closedBridgeRoute } from "./EngineBatchD12Runtime";
import { releaseZoneReserves } from "./EngineBatchD11Runtime";
import { surfacePose } from "../shared/EngineBatchD2";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { SquadAttackRules, squadStrikeReachable, attackSectorIndex, damageSector, groundProgressPose, newGroundProgress, SectorState, stepGroundProgress } from "../shared/EngineBatchD5";
import { finiteNumber } from "../shared/EngineBatchB";
import { PauseRules } from "../shared/SessionGuard";
import type { CombatSession, Enemy } from "./CombatSession";
export interface GroundDirectorRuntime { phase: number; states: SectorState[]; folder: Folder; actors: BasePart[] }
export function clearGroundDirector(s: CombatSession): void { s.groundDirector?.folder.Destroy(); s.groundDirector=undefined; }
function running(s: CombatSession): boolean { return s.active && !s.cleaned && !s.loading && !s.launch && s.rearmElapsed===undefined && s.cutInElapsed===undefined && !PauseRules.Paused(s.pause) && s.blueprintState?.outcome===undefined && s.blueprintState?.landingElapsed===undefined; }
/** Owned below the session folder; creation only from the live simulation after the world/launch gate. */
export function stepGroundDirector(s: CombatSession, dt: number, say: (line:string)=>void): void {
 const bs=s.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.groundProgress;
 if(!plan || !bs || s.groundDirector && s.groundDirector.phase!==bs.phaseIndex) clearGroundDirector(s);
 if(!plan || !bs || !running(s) || !finiteNumber(dt) || dt<=0) return;
 if(!s.groundDirector) {
  const folder=new Instance("Folder"); folder.Name="Friendly ground force"; folder.Parent=s.folder;
  const actors=plan.sectors.map(sector=>{
   const p=new Instance("Part"); p.Name=sector.id; p.Size=sector.kind==="landing_craft" ? new Vector3(24,8,55) : sector.kind==="column" ? new Vector3(12,8,25) : new Vector3(10,5,12);
   p.Color=Color3.fromRGB(75,160,130); p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false;
   p.SetAttribute("Friendly",true); p.SetAttribute("SectorId",sector.id); p.Parent=folder; return p;
  });
  s.groundDirector={phase:bs.phaseIndex,states:newGroundProgress(plan),folder,actors};
 }
 const runtime=s.groundDirector;
 const cleared=new Set<string>(); for(const id of bs.killedIds) cleared.add(id); if(s.retiredGroundIds) for(const id of s.retiredGroundIds) cleared.add(id);
 const closed=new Set<string>();
 for(const sector of plan.sectors) if(closedBridgeRoute(s,sector.id,"sector")) closed.add(sector.id);
 for(const line of stepGroundProgress(plan,runtime.states,cleared,dt,closed)) say(line);
 releaseZoneReserves(s);
 for(let i=0;i<plan.sectors.size();i++) {
  const sector=plan.sectors[i], state=runtime.states[i], p=groundProgressPose(sector,state), actor=runtime.actors[i];
  actor.CFrame=new CFrame(p.x,p.y,p.z).mul(CFrame.Angles(0,math.rad(surfacePose(sector.route,state.elapsed).yaw),0)); actor.SetAttribute("Health",state.health); actor.SetAttribute("Secured",state.secured); actor.SetAttribute("Progress",state.elapsed/sector.seconds);
  if(state.health<=0) { bs.outcome="failed"; bs.reason="protected_lost"; }
 }
}
/** Returns true for an opted-in attacker, even if its sector is no longer available. No player fallback.
 * A visible two-second attack warning precedes one server LOS strike, then an eight-second reload.
 * Aircraft continue using the normal player weapon/once-only kill ledger; friendlies never award score.
 */
export function stepBeachAttacker(s: CombatSession, e: Enemy, dt: number, say:(line:string)=>void): boolean {
 if(e.attackSector===undefined) return false;
 if(!running(s) || !finiteNumber(dt) || dt<=0) return true;
 const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.groundProgress, runtime=s.groundDirector;
 const index=plan && runtime && e.phaseOwner===runtime.phase ? attackSectorIndex(plan,runtime.states,e.attackSector) : undefined;
 if(index===undefined || !plan || !runtime) { e.windup=0; e.model.SetAttribute("AttackWarning",false); if(e.warning) e.warning.Enabled=false; return true; }
 const sector=plan.sectors[index], state=runtime.states[index], p=groundProgressPose(sector,state);
 const target=new Vector3(p.x,p.y,p.z), station=target.add(new Vector3(0,240,0)), delta=station.sub(e.position);
 const distance=target.sub(e.position).Magnitude;
 // Fly repeated passes over the force at a safe band; existing terrain probes keep scenery ahead clear.
 let desired=delta.Magnitude>1 ? delta.Unit : e.direction;
 if(distance<400) desired=e.direction.add(new Vector3(0,0.3,0)).Unit;
 if(s.collisionParams && Workspace.Raycast(e.position,e.direction.mul(250),s.collisionParams)) desired=new Vector3(desired.X,1,desired.Z).Unit;
 e.direction=e.direction.Lerp(desired,math.clamp(dt*1.5,0,1)).Unit; e.velocity=e.direction.mul(SquadAttackRules.speed); e.position=e.position.add(e.velocity.mul(dt));
 e.position=new Vector3(math.clamp(e.position.X,-s.airspace.spawnLimit,s.airspace.spawnLimit),math.clamp(e.position.Y,170,2000),math.clamp(e.position.Z,-s.airspace.spawnLimit,s.airspace.spawnLimit));
 e.frame=CFrame.lookAt(e.position,e.position.add(e.direction));
 e.fireTimer=math.max(0,e.fireTimer-dt);
 if(e.windup>0) {
  e.windup=math.max(0,e.windup-dt);
  if(e.windup<=0) {
   e.model.SetAttribute("AttackWarning",false); if(e.warning) e.warning.Enabled=false; e.fireTimer=SquadAttackRules.reload;
   if(s.collisionParams && squadStrikeReachable(distance,Workspace.Raycast(e.position,target.sub(e.position),s.collisionParams)!==undefined)) {
    if(damageSector(state,SquadAttackRules.damage)) say(sector.hitCall);
    if(state.health<=0 && s.blueprintState) { s.blueprintState.outcome="failed"; s.blueprintState.reason="protected_lost"; }
   }
  }
 } else if(e.fireTimer<=0 && distance<=SquadAttackRules.range) { e.windup=SquadAttackRules.warning; e.model.SetAttribute("AttackWarning",true); if(e.warning) e.warning.Enabled=true; }
 return true;
}
