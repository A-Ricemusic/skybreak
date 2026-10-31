import { spatialJammersAt } from "./EngineBatchD9Runtime";
import { FlightMath } from "../shared/FlightMath";
import { GunRules, SortieArmament } from "../shared/SortieArmament";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { jammedLockAllowed, rearmDuration, rearmPose } from "../shared/EngineBatchC";
import { PauseRules } from "../shared/SessionGuard";
import { canSkipLanding, landingDuration, landingPose } from "../shared/EngineBatchB";
import { canSkipCutIn, cutInDue, rearmMenuDue, rearmRadioDue, REARM_MENU_SECONDS, takeoffChoice } from "../shared/SortieCutaways";
import type { RearmPlan } from "../shared/EngineBatchC";
import { AlliedRules } from "../shared/AlliedRules";
import { CombatSession, Enemy } from "./CombatSession";

export function liveJammers(s: CombatSession): number {
	const spatial=spatialJammersAt(s,s.state);
	if(spatial!==undefined) return spatial;
	return s.enemies.filter(e => e.enabled && e.health > 0 && e.withdrawUntil === undefined && (e.routeActor?.jammer === true || e.typedGround?.ecm === true)).size();
}
export function lockAllowed(s: CombatSession, distance: number): boolean {
	const plan = s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.jamming;
	return !plan || jammedLockAllowed(liveJammers(s), distance, plan);
}
/** Called only by the accepted kill path, before phase compaction. */
export function announceJammerKill(s: CombatSession, enemy: Enemy, radio: (line: string) => void): void {
	const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.jamming;
	if(!plan || !(enemy.routeActor?.jammer || enemy.typedGround?.ecm || enemy.airshipJammer) || enemy.health>0 || enemy.withdrawUntil!==undefined || enemy.jammerKillAnnounced) return;
	enemy.jammerKillAnnounced=true;
	radio(liveJammers(s)>0 ? plan.remainingCall : plan.clearCall);
}
/** Owns the complete fixed step. Pause simulation and shift the epoch by actual wall time.
	* Re-entry requires leaving the zone, so a takeoff ending inside it cannot refill repeatedly.
	* `maxMissiles` is the sortie's rack capacity: eight by default, the finite stock under batch D1. */
export function stepRearm(s: CombatSession, dt: number, maxMissiles: number, send: (message: unknown) => void, say?: (line: string) => void): boolean {
	const bs = s.blueprintState, plan = bs && BlueprintRunner.ActivePhase(bs)?.rearm;
	if (s.pause && PauseRules.Paused(s.pause)) return s.rearmElapsed !== undefined;
	if (!s.active || !bs || !plan || bs.outcome !== undefined || s.launch || s.loading) return false;
	const distance = math.sqrt((s.state.x-plan.zone.x)**2 + (s.state.y-plan.zone.y)**2 + (s.state.z-plan.zone.z)**2);
	if (s.rearmElapsed === undefined) {
		if (distance > plan.radius) s.rearmLatched = false;
		if (distance > plan.radius || s.rearmLatched) return false;
		const start = landingPose(plan.landing, 0);
		const gateDistance = math.sqrt((s.state.x-start.x)**2+(s.state.y-start.y)**2+(s.state.z-start.z)**2);
		if (gateDistance > 100 || s.projectiles.some(p => p.hostile && p.wingman === undefined) || s.enemies.some(e => e.enabled && e.health > 0 && e.windup > 0 && AlliedRules.WarnsPlayer(e.windupTarget, e.attackSector))) return false;
		// Settle the clock before entering: landing cannot rescue an already expired strike.
		bs.score = s.targetScore.Total();
		BlueprintRunner.Tick(bs, os.clock(), s.health);
		if (bs.outcome !== undefined || BlueprintRunner.ActivePhase(bs)?.rearm !== plan) return false;
		send({kind:"RearmStarted", plan});
		bs.rearmActive = true;
		s.rearmStartedAt = os.clock(); s.rearmEpoch = bs.startedAt;
		s.rearmElapsed = 0; s.rearmLatched = true; s.lockProgress = 0;
		if (s.gun) GunRules.Stop(s.gun);

	}
	// The TAKEOFF / CHANGE WEAPON menu holds the jet on the runway until answered (or REARM_MENU_SECONDS).
	if (s.rearmMenu !== undefined) {
		s.rearmMenu += dt;
		if (s.rearmMenu >= REARM_MENU_SECONDS) answerRearmMenu(s, undefined, send);
		return true;
	}
	const before = s.rearmElapsed;
	s.rearmElapsed += dt;
	if (rearmMenuDue(plan, s.rearmElapsed, s.rearmAnswered === true)) {
		s.rearmElapsed = landingDuration(plan.landing); s.rearmMenu = 0;
		send({ kind: "RearmMenu", elapsed: s.rearmElapsed, special: s.special.kind });
	}
	if (say) for (const line of rearmRadioDue(plan, before, s.rearmElapsed)) say(line);
	s.state = rearmPose(plan, s.rearmElapsed);
	const position = new Vector3(s.state.x,s.state.y,s.state.z);
	const [fx,fy,fz] = FlightMath.ForwardOf(s.state);
	s.aircraftFrame = CFrame.lookAt(position,position.add(new Vector3(fx,fy,fz)));
	if (s.rearmElapsed >= rearmDuration(plan)) {
		if (plan.missiles) s.missiles = maxMissiles;
		// M05 only confirms missile/special refill; damage is preserved. Default armament gives a fresh special
		// exactly as before; a finite stock restores its own charges and the fitted gun's magazine (batch D1).
		const armament = s.blueprint?.armament;
		const refill = SortieArmament.Refill(plan, armament, s.special.kind);
		if (refill.special) s.special = refill.special;
		if (s.gun && refill.gunRounds !== undefined) GunRules.Refill(s.gun, refill.gunRounds);
		bs.startedAt = (s.rearmEpoch ?? bs.startedAt) + os.clock() - (s.rearmStartedAt ?? os.clock());
		bs.rearmActive = undefined; s.rearmElapsed = undefined; s.rearmMenu = undefined; s.rearmAnswered = undefined;
		send({kind:"RearmComplete",state:s.state,sequence:s.stateSequence});
	}
	return true;
}

/** TAKEOFF / CHANGE WEAPON: a valid special swaps the loadout (refilled at takeoff as authored); anything else keeps it. */
export function answerRearmMenu(s: CombatSession, special: unknown, send: (message: unknown) => void): boolean {
	if (s.rearmElapsed === undefined || s.rearmMenu === undefined) return false;
	const kind = takeoffChoice(special);
	// Batch D1: a finite-stock sortie gets the new special's stock; default armament is SpecialWeapons.New exactly.
	if (kind !== undefined && kind !== s.special.kind) s.special = SortieArmament.NewSpecial(kind, s.blueprint?.armament);
	s.rearmMenu = undefined; s.rearmAnswered = true;
	send({ kind: "RearmTakeoff", elapsed: s.rearmElapsed, special: s.special.kind });
	return true;
}
/** SKIP during a rearm: the approach jumps to the menu (or takeoff), the menu takes off as loaded, the climb-out ends. */
export function skipRearm(s: CombatSession, plan: RearmPlan, send: (message: unknown) => void): void {
	const elapsed = s.rearmElapsed;
	if (elapsed === undefined || !canSkipLanding(elapsed)) return;
	if (s.rearmMenu !== undefined) { answerRearmMenu(s, undefined, send); return; }
	const landed = landingDuration(plan.landing);
	s.rearmElapsed = elapsed < landed ? landed : rearmDuration(plan);
	send({ kind: "RearmSkipped", elapsed: s.rearmElapsed });
}
/** The approach gate the rearm opens at, drawn as a beacon: a 100-stud sphere is otherwise invisible at night. */
export function buildRearmGate(parent: Instance, plan: RearmPlan): BasePart {
	const start = landingPose(plan.landing, 0);
	const marker = new Instance("Part");
	marker.Name = "Rearm gate"; marker.Shape = Enum.PartType.Ball; marker.Size = new Vector3(60, 60, 60);
	marker.Anchored = true; marker.CanCollide = false; marker.CanTouch = false; marker.CanQuery = false;
	marker.Color = Color3.fromRGB(108, 255, 176); marker.Material = Enum.Material.Neon; marker.Transparency = 0.45;
	if(plan.carrier) {
		const c=plan.carrier, deck=new Instance("Part"); deck.Name="Procedural service carrier deck";
		deck.Size=new Vector3(c.width,8,c.length); deck.Anchored=true; deck.CanTouch=false;
		deck.Color=Color3.fromRGB(62,72,80); deck.Material=Enum.Material.Metal;
		deck.CFrame=new CFrame(c.centre.x,c.centre.y-10,c.centre.z).mul(CFrame.Angles(0,-math.rad(plan.landing.headingDegrees),0)); deck.Parent=marker;
	}
	marker.Position = new Vector3(start.x, start.y, start.z); marker.SetAttribute("ObjectiveRadius", 100); marker.Parent = parent;
	const gui = new Instance("BillboardGui"); gui.Size = UDim2.fromOffset(170, 38); gui.AlwaysOnTop = true; gui.StudsOffsetWorldSpace = new Vector3(0, 60, 0); gui.Parent = marker;
	const label = new Instance("TextLabel"); label.Size = UDim2.fromScale(1, 1); label.BackgroundTransparency = 0.25;
	label.BackgroundColor3 = Color3.fromRGB(7, 23, 30); label.TextColor3 = marker.Color; label.Text = "REARM · FLY THROUGH";
	label.TextSize = 13; label.Font = Enum.Font.GothamBold; label.Parent = gui;
	return marker;
}
/**
 * Owns the complete fixed step while a cut-in plays, like a rearm: no flight, input, damage or hostile simulation,
 * and the mission epoch shifts by the wall time spent so the phase clock reads as paused (m05 §3).
 */
export function stepCutIn(s: CombatSession, dt: number, send: (message: unknown) => void, say: (line: string) => void): boolean {
	const bs = s.blueprintState, plan = bs && BlueprintRunner.ActivePhase(bs)?.cutIn;
	if (s.pause && PauseRules.Paused(s.pause)) return s.cutInElapsed !== undefined;
	if (!s.active || !bs || !plan || bs.outcome !== undefined || s.launch || s.loading) { s.cutInElapsed = undefined; if (bs) bs.cutInActive = undefined; return false; }
	if (s.cutInElapsed === undefined) {
		if (s.cutInPlayed === bs.phaseIndex) return false;
		const subjects = s.enemies.filter(e => e.enabled && e.health > 0 && e.withdrawUntil === undefined && e.friendly !== true && plan.subjects.includes(e.scoreRole ?? ""));
		if (!cutInDue(plan, bs.elapsed, subjects.size())) return false;
		// Lead first (the first listed role), then wingmen in spawn order.
		const ordered = [...subjects.filter(e => e.scoreRole === plan.subjects[0]), ...subjects.filter(e => e.scoreRole !== plan.subjects[0])];
		s.cutInPlayed = bs.phaseIndex; s.cutInElapsed = 0; s.cutInStartedAt = os.clock(); s.cutInEpoch = bs.startedAt;
		bs.cutInActive = true; s.lockProgress = 0;
		send({ kind: "CutInStarted", plan, subjects: ordered.map(e => e.model) });
	}
	s.cutInElapsed += dt;
	if (s.cutInElapsed >= plan.seconds) {
		bs.startedAt = (s.cutInEpoch ?? bs.startedAt) + os.clock() - (s.cutInStartedAt ?? os.clock());
		bs.cutInActive = undefined; s.cutInElapsed = undefined;
		send({ kind: "CutInComplete", state: s.state, sequence: s.stateSequence });
		for (const line of plan.after ?? []) say(line);
	}
	return true;
}
/** SKIP during a cut-in, after the shared 0.75 s guard: it ends on the next step. */
export function skipCutIn(s: CombatSession): void {
	const plan = s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.cutIn;
	if (plan && s.cutInElapsed !== undefined && canSkipCutIn(s.cutInElapsed)) s.cutInElapsed = math.max(s.cutInElapsed, plan.seconds);
}
