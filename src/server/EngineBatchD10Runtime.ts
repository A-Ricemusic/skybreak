import { claimM14WorldActor } from "./M14WorldActors";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { BomberRoute, BomberRules } from "../shared/BomberRules";
import { CruiseBudget, CruiseState, cruiseComplete, cruiseDestroyed, cruiseRadar, cruiseRoute, newCruiseStates } from "../shared/EngineBatchD10";
import { finiteNumber } from "../shared/EngineBatchB";
import { PauseRules } from "../shared/SessionGuard";
import { sphereSweep } from "../shared/SphereSweep";
import type { CombatSession, Enemy } from "./CombatSession";
export interface CruiseRuntime { phase: number; elapsed: number; states: CruiseState[]; routes: BomberRoute[]; actors: Map<number, Enemy> }
/** Each ray stays below Roblox's 15,000-stud limit, including float rounding. */
export function cruiseOccluded(a: Vector3, b: Vector3, params: RaycastParams): boolean {
 const delta=b.sub(a), distance=delta.Magnitude;
 if(distance<0.01) return false;
 for(let offset=0;offset<distance;offset+=14000) if(Workspace.Raycast(a.add(delta.Unit.mul(offset)),delta.Unit.mul(math.min(14000,distance-offset)),params)) return true;
 return false;
}
function retire(s: CombatSession, e: Enemy): void {
 e.enabled=false; e.health=0; e.model.Destroy();
 if(s.target===e) {s.target=undefined;s.lockProgress=0;}
 // No refunds, score or kill callbacks at separation/cleanup.
 for(let i=s.projectiles.size()-1;i>=0;i--) if(s.projectiles[i].target===e) {s.projectiles[i].part.Destroy();s.projectiles.remove(i);}
}
export function clearCruise(s: CombatSession): void { if(s.cruise) for(const [,e] of s.cruise.actors) retire(s,e); s.cruise=undefined; }
export function createCruise(s: CombatSession, index: number): Enemy {
 const runtime=s.cruise!, plan=BlueprintRunner.ActivePhase(s.blueprintState!)!.cruiseIntercept!, t=plan.targets[index];
 const model=claimM14WorldActor(s,t.id) ?? new Instance("Model"), aim=new Instance("Part"); model.Name=t.separateSeconds===undefined ? "CRUISE" : "CARRIER";
 aim.Name="Aim"; aim.Size=new Vector3(8,6,24);aim.Anchored=true;aim.CanCollide=false;aim.CanTouch=false;aim.CanQuery=true;aim.Material=Enum.Material.Neon;aim.Color=Color3.fromRGB(240,110,65);aim.Parent=model;model.PrimaryPart=aim;
 const p=BomberRules.Sample(runtime.routes[index],0).slots[0],position=new Vector3(p.position.x,p.position.y,p.position.z),direction=new Vector3(p.facing.x,p.facing.y,p.facing.z);
 const floor=s.collisionParams && Workspace.Raycast(new Vector3(position.X,4096,position.Z),new Vector3(0,-8192,0),s.collisionParams);
 const grounded=new Vector3(position.X,math.max(position.Y,(floor?.Position.Y ?? position.Y)+CruiseBudget.clearance),position.Z);
 model.PivotTo(CFrame.lookAt(grounded,grounded.add(direction)));model.Parent=s.folder;
 for(const [key,value] of pairs({SkybreakEnemy:true,SkybreakOwner:s.player.UserId,TargetKind:"air",RequiredTarget:true,Damageable:true,Health:CruiseBudget.health,RadarDetected:false})) model.SetAttribute(key,value);
 const e:Enemy={id:t.id,name:model.Name,model,health:CruiseBudget.health,maxHealth:CruiseBudget.health,kind:"air",role:"bomber",cruiseTarget:true,scoreRole:t.scoreRole,phaseOwner:runtime.phase,attackSector:"cruise_site",position:grounded,direction,velocity:direction.mul(t.speed),required:true,enabled:true,fireTimer:math.huge,windup:0,mode:"run",modeTimer:0,passDirection:direction,side:1,flares:0,flareTimer:0,flareUntil:0,speedBonus:0,lockBreakTimer:0,breakTimer:0,breakUntil:0,lockBreakChance:0,hiddenParts:[]};
 s.enemies.push(e);return e;
}
/** Settle a weapon kill immediately, so a later clock tick cannot steal an already completed intercept. */
export function cruiseKilled(s: CombatSession, enemy: Enemy): void {
 const bs=s.blueprintState, r=s.cruise, plan=bs && BlueprintRunner.ActivePhase(bs)?.cruiseIntercept;
 if(!enemy.cruiseTarget || !bs || !r || !plan || r.phase!==bs.phaseIndex) return;
 for(const [index,actor] of r.actors) if(actor===enemy) cruiseDestroyed(plan,r.states,index);
 bs.phaseProgress=r.states.filter(state=>state.status==="destroyed" || state.status==="cancelled" || state.status==="separated").size();
 if(cruiseComplete(r.states)) {BlueprintRunner.ResolveCruise(bs,true);clearCruise(s);}
}
/** Called only on live simulation time; endpoint impact is resolved before same-frame weapon hits. */
export function stepCruise(s: CombatSession, dt: number): void {
 const bs=s.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.cruiseIntercept;
 if(!plan || !bs || s.cruise && s.cruise.phase!==bs.phaseIndex || !s.active || s.cleaned || bs.outcome!==undefined) clearCruise(s);
 if(!plan || !bs || !s.active || s.cleaned || bs.outcome!==undefined || s.loading || s.launch || s.rearmElapsed!==undefined || s.cutInElapsed!==undefined || bs.landingElapsed!==undefined || PauseRules.Paused(s.pause) || !finiteNumber(dt) || dt<=0) return;
 if(!s.collisionParams) {s.crashReason="internal_error";return;}
 if(!s.cruise) s.cruise={phase:bs.phaseIndex,elapsed:0,states:newCruiseStates(plan),routes:plan.targets.map(cruiseRoute),actors:new Map()};
 const r=s.cruise; r.elapsed+=dt;
 for(let i=0;i<plan.targets.size();i++) {
  const t=plan.targets[i], state=r.states[i]; let e=r.actors.get(i);
  if(state.status==="active" && e && e.health<=0) cruiseDestroyed(plan,r.states,i);
  if(state.status==="waiting" && t.parentId===undefined && r.elapsed>=(t.arrivalSeconds ?? 0)) {state.status="active";e=createCruise(s,i);r.actors.set(i,e);state.elapsed=-math.max(0,(t.arrivalSeconds ?? 0)-(r.elapsed-dt));}
  if(state.status!=="active" || !e) continue;
  const previous=e.position; state.elapsed+=dt;
  const pose=BomberRules.Sample(r.routes[i],state.elapsed).slots[0];
  // Waypoint Y is a minimum cruise altitude; actual terrain/water owns the floor.
  const floor=Workspace.Raycast(new Vector3(pose.position.x,4096,pose.position.z),new Vector3(0,-8192,0),s.collisionParams);
  if(!floor) {s.crashReason="internal_error";return;}
  e.position=new Vector3(pose.position.x,math.max(pose.position.y,floor.Position.Y+CruiseBudget.clearance),pose.position.z);
  if(sphereSweep(previous,4,e.position.sub(previous),s.collisionParams)) {s.crashReason="internal_error";return;}
  e.direction=e.position.sub(previous).Magnitude>0.01 ? e.position.sub(previous).Unit : e.direction;e.velocity=e.direction.mul(t.speed);e.frame=CFrame.lookAt(e.position,e.position.add(e.direction));
  const player=new Vector3(s.state.x,s.state.y,s.state.z),distance=player.sub(e.position).Magnitude;
  const detected=cruiseRadar(distance,e.position.Y-floor.Position.Y,distance<=CruiseBudget.radarRange && !cruiseOccluded(player,e.position,s.collisionParams));modelRadar(e,detected);
  if(t.separateSeconds!==undefined && state.elapsed>=t.separateSeconds) {
   state.status="separated";retire(s,e);
   for(let j=0;j<plan.targets.size();j++) if(plan.targets[j].parentId===t.id) {r.states[j].status="active";r.actors.set(j,createCruise(s,j));r.states[j].elapsed=-dt;}
  } else if(state.elapsed>=r.routes[i].duration) {state.status="impact";BlueprintRunner.ResolveCruise(bs,false);clearCruise(s);return;}
 }
 bs.phaseProgress=r.states.filter(state=>state.status==="destroyed" || state.status==="cancelled" || state.status==="separated").size();
 if(cruiseComplete(r.states)) {BlueprintRunner.ResolveCruise(bs,true);clearCruise(s);}
}
function modelRadar(e: Enemy, detected: boolean): void { e.model.SetAttribute("RadarDetected",detected); }
