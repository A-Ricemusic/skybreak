// Server adapters for FinaleDuelRules: duel activity, target permission and finale steps. Formerly EngineBatchD13Runtime.
import { clearCruise } from "./CruiseMissileRuntime";
import { AircraftCollision } from "./AircraftCollision";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { resolveEnvironment } from "../shared/WorldEnvironments";
import { WorldEnvironment } from "./WorldEnvironment";
import type { CombatSession, Enemy } from "./CombatSession";

/** Session-scoped ownership. New retry session restores the world through its normal builder. */
export function duelActive(s: CombatSession): boolean {
 return s.blueprintState!==undefined && BlueprintRunner.ActivePhase(s.blueprintState)?.finale?.duel!==undefined;
}
export function finaleTargetAllowed(s: CombatSession,e: Enemy): boolean {
 const bs=s.blueprintState,d=bs && BlueprintRunner.ActivePhase(bs)?.finale;
 if(d?.duel) return e.kind==="ace" && e.required && e.phaseOwner===bs!.phaseIndex;
 if(d?.vent && e.id===d.vent.core) return bs!.vent!==undefined && bs!.vent!.elapsed>=d.vent.openingSeconds && bs!.vent!.checkpoint>=d.vent.checkpoints.size();
 return true;
}
export function stepFinaleDuel(s: CombatSession,say:(line:string)=>void): void {
 const bs=s.blueprintState,d=bs && BlueprintRunner.ActivePhase(bs)?.finale;
 if(!bs || !d) return;
 if(s.d13Phase!==bs.phaseIndex) {
  s.d13Gate?.Destroy(); s.d13Gate=undefined;
  s.d13Beacon?.Destroy(); s.d13Beacon=undefined;
  s.d13Phase=bs.phaseIndex;
  if(d.vent) {
   const g=d.vent.gate, shutter=new Instance("Part");
   shutter.Name="Vent timed shutter"; shutter.Anchored=true; shutter.CanCollide=false; shutter.CanTouch=false;
   shutter.Size=new Vector3(g.half.x*2,g.half.y*2,4);
   shutter.Position=new Vector3(g.center.x,g.center.y,g.center.z);
   shutter.Material=Enum.Material.Neon; shutter.Color=Color3.fromRGB(255,150,50);
   shutter.SetAttribute("FlightSolid",true); shutter.Parent=s.folder; s.d13Gate=shutter;
   s.collisionParams=AircraftCollision.Parameters(s.folder);
   const beacon=new Instance("Part"); beacon.Name="Vent route beacon"; beacon.Anchored=true;
   beacon.CanCollide=false; beacon.CanTouch=false; beacon.CanQuery=false;
   beacon.Size=new Vector3(12,12,12); beacon.Shape=Enum.PartType.Ball;
   beacon.Material=Enum.Material.Neon; beacon.Color=Color3.fromRGB(70,255,230); beacon.Parent=s.folder;
   s.d13Beacon=beacon;
   say("CORE ROUTE REVEALED · AMBER SHUTTER OPENS ON COUNTDOWN · FOLLOW CYAN BEACONS");
  }
  if(d.environment) {
   const environment=resolveEnvironment(d.environment);
   assert(environment!==undefined,"Validated environment missing");
   // Replaces named atmosphere/clouds through the existing single world owner.
   // NightLighting only owns local lamps and never writes Lighting.
   WorldEnvironment.ApplySpec(environment,d.environment);
  }
  if(d.duel) {
   clearCruise(s);
   s.airQueue.clear();
   for(let i=s.projectiles.size()-1;i>=0;i--) { s.projectiles[i].part.Destroy(); s.projectiles.remove(i); }
   for(const e of s.enemies) {
    if(e.kind==="ace" && e.required && e.phaseOwner===bs.phaseIndex) continue;
    e.enabled=false; e.windup=0; e.model.SetAttribute("AttackWarning",false);
    if(e.warning) e.warning.Enabled=false;
    if(e.kind!=="ground") { e.health=0; e.model.Destroy(); }
   }
   for(const ally of s.allies) { ally.windup=0; ally.combatTarget=undefined; }
   s.target=undefined; s.lockProgress=0;
   say("RUSK ALONE · ALLIES HOLD FIRE · FIVE MINUTES");
  }
 }
 if(d.vent && bs.vent) {
  if(bs.vent.elapsed>=d.vent.openingSeconds && s.d13Gate) {
   s.d13Gate.Destroy(); s.d13Gate=undefined;
   say("VENT OPEN · FOLLOW CYAN CHECKPOINTS · EXIT REQUIRED AFTER CORE");
  }
  const target=d.vent.checkpoints[bs.vent.checkpoint]?.center ?? d.vent.exit.center;
  if(s.d13Beacon) s.d13Beacon.Position=new Vector3(target.x,target.y,target.z);
 }
}
