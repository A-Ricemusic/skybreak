import { protectedNavigationStep } from "./EngineBatchD9Runtime";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { protectedHealth, damageProtected, protectedPose, protectionResult, stepProtected } from "../shared/EngineBatchD7";
import type { ProtectedAircraftPlan, ProtectedState } from "../shared/EngineBatchD7";
import type { CombatSession, Enemy } from "./CombatSession";
export interface ProtectedActor { aircraft: Enemy; plan: ProtectedAircraftPlan; state: ProtectedState; label: TextLabel; navigationHeld?: number }

function createActor(session: CombatSession, plan: ProtectedAircraftPlan): ProtectedActor {
 const health=protectedHealth(plan,session.difficulty);
 plan={...plan,health};
 // Adopt the dormant world's exact id; remove collision/query from every visible surface.
 const existing=session.folder.GetDescendants().find(i=>i.IsA("Model") && i.Name===plan.id);
 const model=existing?.IsA("Model") ? existing : new Instance("Model"); model.Name=plan.callsign;
 const adopted=model.GetDescendants().filter((i): i is BasePart=>i.IsA("BasePart"));
 for(const p of adopted) { p.Anchored=true; p.CanCollide=false; p.CanQuery=false; p.CanTouch=false; p.SetAttribute("FlightSolid",false); }
 const pivot=adopted[0];
 if(pivot) model.PrimaryPart=pivot;
 const part=(name:string,size:Vector3,offset:Vector3,color:Color3)=>{
  const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=offset; p.Color=color;
  p.Anchored=true; p.CanCollide=false; p.CanQuery=false; p.CanTouch=false; p.Parent=model; return p;
 };
 const white=Color3.fromRGB(222,232,240), cyan=Color3.fromRGB(65,205,255);
 const root=pivot ?? part("Civilian fuselage",new Vector3(8,8,48),Vector3.zero,white); model.PrimaryPart=root;
 if(!pivot) {
 part("Wings",new Vector3(50,2,12),new Vector3(0,0,2),white);
 part("Tailplane",new Vector3(20,2,7),new Vector3(0,1,20),cyan);
 part("Fin",new Vector3(2,10,9),new Vector3(0,6,18),cyan);
 part("Port engine",new Vector3(5,5,12),new Vector3(-14,-3,2),white);
 part("Starboard engine",new Vector3(5,5,12),new Vector3(14,-3,2),white);
 }
 model.SetAttribute("SkybreakOwner",session.player.UserId); model.SetAttribute("SkybreakFriendly",true);
 model.SetAttribute("SkybreakEnemy",false); model.SetAttribute("Damageable",false); model.SetAttribute("RequiredTarget",false);
 model.SetAttribute("ProtectedObjective",true); model.SetAttribute("TargetKind","air"); model.SetAttribute("TargetId",plan.id);
 model.SetAttribute("Health",plan.health); model.SetAttribute("MaxHealth",plan.health);
 const marker=new Instance("BillboardGui"); marker.Name="Protected identity"; marker.Size=UDim2.fromOffset(380,28); marker.StudsOffset=new Vector3(0,15,0); marker.AlwaysOnTop=true; marker.MaxDistance=30000; marker.Adornee=root; marker.Parent=model;
 const label=new Instance("TextLabel"); label.Size=UDim2.fromScale(1,1); label.BackgroundColor3=Color3.fromRGB(7,23,30); label.BackgroundTransparency=0.2; label.TextColor3=cyan; label.TextSize=14; label.Font=Enum.Font.GothamBold; label.Parent=marker;
 const pose=protectedPose(plan,0), position=new Vector3(pose.position.x,pose.position.y,pose.position.z), direction=new Vector3(pose.facing.x,pose.facing.y,pose.facing.z);
 model.PivotTo(CFrame.lookAt(position,position.add(direction))); model.Parent=session.folder;
 const aircraft: Enemy={id:plan.id,name:plan.callsign,model,health:plan.health,maxHealth:plan.health,position,direction,velocity:direction.mul(plan.route.speed),kind:"air",friendly:true,required:false,enabled:true,fireTimer:0,windup:0,mode:"run",modeTimer:0,passDirection:direction,side:1,flares:0,flareTimer:0,speedBonus:0,lockBreakTimer:0,flareUntil:0,breakTimer:0,breakUntil:0,lockBreakChance:0,hiddenParts:[]};
 return {aircraft,plan,state:{health:plan.health,elapsed:0,safe:false,warned:false},label};
}
export function clearProtection(session: CombatSession): void {
 for(const a of session.protectedFlight?.actors ?? []) { a.aircraft.enabled=false; a.aircraft.model.Destroy(); }
 session.protectedFlight=undefined;
}
/** Called only in active flight; session folder teardown also owns every model. */
export function stepProtection(session: CombatSession, dt: number, say:(line:string)=>void): void {
 const bs=session.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.protection;
 if(!bs || !plan) { if(session.protectedFlight) clearProtection(session); return; }
 if(session.protectedFlight?.phase!==bs.phaseIndex) {
  clearProtection(session); session.protectedFlight={phase:bs.phaseIndex,actors:plan.aircraft.map(a=>createActor(session,a))};
 }
 const actors=session.protectedFlight!.actors;
 for(const a of actors) {
  if(a.state.safe) continue;
  a.state.health=a.aircraft.health;
  const nav=protectedNavigationStep(session,protectedPose(a.plan,a.state.elapsed).position,dt,a.navigationHeld ?? 0);
  a.navigationHeld=nav.held;
  a.aircraft.model.SetAttribute("NavigationJammed",nav.advance<dt);
  stepProtected(a.state,a.plan,nav.advance);
  const pose=protectedPose(a.plan,a.state.elapsed), p=pose.position, d=pose.facing;
  a.aircraft.position=new Vector3(p.x,p.y,p.z); a.aircraft.direction=new Vector3(d.x,d.y,d.z);
  a.aircraft.velocity=a.state.safe ? Vector3.zero : a.aircraft.direction.mul(a.plan.route.speed*(dt>0 ? nav.advance/dt : 1));
  a.aircraft.model.PivotTo(CFrame.lookAt(a.aircraft.position,a.aircraft.position.add(a.aircraft.direction)));
  const incoming=session.enemies.some(e=>e.enabled && e.health>0 && e.windup>0 && e.windupTarget===a.aircraft);
  a.label.Text=`${incoming ? "INCOMING · " : ""}PROTECT ${a.plan.callsign}${nav.advance<dt ? " · NAV JAM" : ""} · ${a.state.safe ? "SAFE" : `${math.ceil(a.state.health/a.plan.health*100)}%`}`;
  if(a.state.safe && a.aircraft.enabled) { a.aircraft.enabled=false; a.aircraft.model.Destroy(); say(`${a.plan.callsign} is safe.`); }
 }
 const result=protectionResult(actors.map(a=>a.state));
 BlueprintRunner.ObserveProtection(bs,actors.filter(a=>a.state.safe).size(),result==="lost");
 if(result==="safe") say("CONTROL: All protected aircraft are safe.");
 // Safe detached models are destroyed here; phase transition must not retain a target.
 if(result!==undefined) clearProtection(session);
}
export function protectedTarget(session: CombatSession, hostile: Enemy): Enemy | undefined {
 if(hostile.attackProtected===undefined) return undefined;
 const live=(session.protectedFlight?.actors ?? []).filter(a=>a.aircraft.enabled && a.aircraft.health>0 && !a.state.safe);
 const assigned=live.find(a=>a.plan.id===hostile.attackProtected);
 if(assigned) return assigned.aircraft;
 // Once the assigned plane exits, continue protecting the remaining civilian from this attacker.
 let nearest: Enemy | undefined, distance=math.huge;
 for(const a of live) { const d=a.aircraft.position.sub(hostile.position).Magnitude; if(d<distance) {nearest=a.aircraft;distance=d;} }
 return nearest;
}
/** Called from the existing hostile missile hit path; never records a kill/point. */
export function hitProtected(session: CombatSession, target: Enemy, damage: number, say:(line:string)=>void): boolean {
 const actor=session.protectedFlight?.actors.find(a=>a.aircraft===target);
 if(!actor) return false;
 actor.state.health=target.health;
 if(damageProtected(actor.state,damage)) say(`${actor.plan.callsign}: Taking damage. Intercept our attackers!`);
 target.health=actor.state.health; target.model.SetAttribute("Health",target.health);
 if(target.health<=0 && session.blueprintState) BlueprintRunner.ObserveProtection(session.blueprintState,0,true);
 return true;
}

/** Called at windup commit, before launch; distinguishes civilian warnings from player locks. */
export function warnProtectedAttack(session: CombatSession, target: Enemy | undefined, say:(line:string)=>void): void {
 const actor=session.protectedFlight?.actors.find(a=>a.aircraft===target);
 if(actor) say(`${actor.plan.callsign}: Missile lock on us! Intercept the attacker.`);
}
