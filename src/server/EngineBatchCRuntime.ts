import { FlightMath } from "../shared/FlightMath";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { jammedLockAllowed, rearmDuration, rearmPose } from "../shared/EngineBatchC";
import { CombatSession } from "./CombatSession";

export function liveJammers(s: CombatSession): number {
 return s.enemies.filter(e => e.enabled && e.health > 0 && e.withdrawUntil === undefined && e.routeActor?.jammer === true).size();
}
export function lockAllowed(s: CombatSession, distance: number): boolean {
 const plan = s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.jamming;
 return jammedLockAllowed(liveJammers(s), distance, plan);
}
/** Owns the complete fixed step. Pause simulation and shift the epoch by actual wall time.
 * Re-entry requires leaving the zone, so a takeoff ending inside it cannot refill repeatedly. */
export function stepRearm(s: CombatSession, dt: number, maxMissiles: number, send: (message: unknown) => void): boolean {
 const bs = s.blueprintState, plan = bs && BlueprintRunner.ActivePhase(bs)?.rearm;
 if (!s.active || !bs || !plan || bs.outcome !== undefined || s.launch || s.loading) return false;
 const distance = math.sqrt((s.state.x-plan.zone.x)**2 + (s.state.y-plan.zone.y)**2 + (s.state.z-plan.zone.z)**2);
 if (s.rearmElapsed === undefined) {
  if (distance > plan.radius) s.rearmLatched = false;
  if (distance > plan.radius || s.rearmLatched) return false;
  // Settle the clock before entering: landing cannot rescue an already expired strike.
  bs.score = s.targetScore.Total();
  BlueprintRunner.Tick(bs, os.clock(), s.health);
  if (bs.outcome !== undefined || BlueprintRunner.ActivePhase(bs)?.rearm !== plan) return false;
  send({kind:"RearmStarted", plan});
  bs.rearmActive = true;
  s.rearmStartedAt = os.clock(); s.rearmEpoch = bs.startedAt;
  s.rearmElapsed = 0; s.rearmLatched = true; s.lockProgress = 0;
  for (const projectile of s.projectiles) projectile.part.Destroy();
  s.projectiles.clear();
 }
 s.rearmElapsed += dt;
 s.state = rearmPose(plan, s.rearmElapsed);
 const position = new Vector3(s.state.x,s.state.y,s.state.z);
 const [fx,fy,fz] = FlightMath.ForwardOf(s.state);
 s.aircraftFrame = CFrame.lookAt(position,position.add(new Vector3(fx,fy,fz)));
 if (s.rearmElapsed >= rearmDuration(plan)) {
  if (plan.missiles) s.missiles = maxMissiles;
  if (plan.health) s.health = 100;
  if (plan.special) s.special = SpecialWeapons.New(s.special.kind);
  bs.startedAt = (s.rearmEpoch ?? bs.startedAt) + os.clock() - (s.rearmStartedAt ?? os.clock());
  bs.rearmActive = undefined; s.rearmElapsed = undefined;
  send({kind:"RearmComplete",state:s.state,sequence:s.stateSequence});
 }
 return true;
}
