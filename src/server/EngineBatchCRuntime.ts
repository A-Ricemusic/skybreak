import { FlightMath } from "../shared/FlightMath";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { jammedLockAllowed, rearmDuration, rearmPose } from "../shared/EngineBatchC";
import { PauseRules } from "../shared/SessionGuard";
import { landingPose } from "../shared/EngineBatchB";
import { AlliedRules } from "../shared/AlliedRules";
import { CombatSession, Enemy } from "./CombatSession";

export function liveJammers(s: CombatSession): number {
	return s.enemies.filter(e => e.enabled && e.health > 0 && e.withdrawUntil === undefined && e.routeActor?.jammer === true).size();
}
export function lockAllowed(s: CombatSession, distance: number): boolean {
	const plan = s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.jamming;
	return !plan || jammedLockAllowed(liveJammers(s), distance, plan);
}
/** Called only by the accepted kill path, before phase compaction. */
export function announceJammerKill(s: CombatSession, enemy: Enemy, radio: (line: string) => void): void {
	const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.jamming;
	if(!plan || !enemy.routeActor?.jammer || enemy.health>0 || enemy.withdrawUntil!==undefined || enemy.jammerKillAnnounced) return;
	enemy.jammerKillAnnounced=true;
	radio(liveJammers(s)>0 ? plan.remainingCall : plan.clearCall);
}
/** Owns the complete fixed step. Pause simulation and shift the epoch by actual wall time.
	* Re-entry requires leaving the zone, so a takeoff ending inside it cannot refill repeatedly. */
export function stepRearm(s: CombatSession, dt: number, maxMissiles: number, send: (message: unknown) => void): boolean {
	const bs = s.blueprintState, plan = bs && BlueprintRunner.ActivePhase(bs)?.rearm;
	if (s.pause && PauseRules.Paused(s.pause)) return s.rearmElapsed !== undefined;
	if (!s.active || !bs || !plan || bs.outcome !== undefined || s.launch || s.loading) return false;
	const distance = math.sqrt((s.state.x-plan.zone.x)**2 + (s.state.y-plan.zone.y)**2 + (s.state.z-plan.zone.z)**2);
	if (s.rearmElapsed === undefined) {
		if (distance > plan.radius) s.rearmLatched = false;
		if (distance > plan.radius || s.rearmLatched) return false;
		const start = landingPose(plan.landing, 0);
		const gateDistance = math.sqrt((s.state.x-start.x)**2+(s.state.y-start.y)**2+(s.state.z-start.z)**2);
		if (gateDistance > 100 || s.projectiles.some(p => p.hostile && p.wingman === undefined) || s.enemies.some(e => e.enabled && e.health > 0 && e.windup > 0 && AlliedRules.WarnsPlayer(e.windupTarget))) return false;
		// Settle the clock before entering: landing cannot rescue an already expired strike.
		bs.score = s.targetScore.Total();
		BlueprintRunner.Tick(bs, os.clock(), s.health);
		if (bs.outcome !== undefined || BlueprintRunner.ActivePhase(bs)?.rearm !== plan) return false;
		send({kind:"RearmStarted", plan});
		bs.rearmActive = true;
		s.rearmStartedAt = os.clock(); s.rearmEpoch = bs.startedAt;
		s.rearmElapsed = 0; s.rearmLatched = true; s.lockProgress = 0;

	}
	s.rearmElapsed += dt;
	s.state = rearmPose(plan, s.rearmElapsed);
	const position = new Vector3(s.state.x,s.state.y,s.state.z);
	const [fx,fy,fz] = FlightMath.ForwardOf(s.state);
	s.aircraftFrame = CFrame.lookAt(position,position.add(new Vector3(fx,fy,fz)));
	if (s.rearmElapsed >= rearmDuration(plan)) {
		if (plan.missiles) s.missiles = maxMissiles;
		// M05 only confirms missile/special refill; damage is preserved.
		if (plan.special) s.special = SpecialWeapons.New(s.special.kind);
		bs.startedAt = (s.rearmEpoch ?? bs.startedAt) + os.clock() - (s.rearmStartedAt ?? os.clock());
		bs.rearmActive = undefined; s.rearmElapsed = undefined;
		send({kind:"RearmComplete",state:s.state,sequence:s.stateSequence});
	}
	return true;
}
