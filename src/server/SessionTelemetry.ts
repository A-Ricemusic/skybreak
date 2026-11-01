// Server -> client streams for one sortie: the 10 Hz Telemetry packet, the
// reliable HudState (radio, FIRE refusals, target, navigation), the 20 Hz
// FlightState echo and cosmetic CombatEffect packets. Remotes are bound by
// CombatService.Init through CombatRemotes.
import * as RearmRuntime from "./RearmRuntime";
import * as LandingRuntime from "./LandingRuntime";
import { AlliedRules } from "../shared/AlliedRules";
import { CombatSession, Enemy } from "./CombatSession";
import { airspaceWarning } from "../shared/WorldAirspace";
import { Players } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { CombatEffectPacket, HudState } from "../shared/Types";
import { ExplosionKind } from "../shared/ExplosionFx";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { FireNotice } from "../shared/WeaponRules";
import { EvadeRules } from "../shared/EvadeRules";
import { PauseRules } from "../shared/SessionGuard";
import { FIXED_STEP, positionFor, ownsEnemy, targetMetrics, sessionTotalRequired, sessionRequiredKills, sessionGroundKills, sessionTimeRemaining, sessionObjective, canHurt } from "./SessionQueries";
import { CombatRemotes } from "./CombatRemotes";
import { sessions } from "./SessionRegistry";

/** Replicates canHurt as `Damageable`, only on change: the HUD boxes exactly these. */
export function publishEnemyDamageable(session: CombatSession, enemy: Enemy): void {
	const damageable = canHurt(session, enemy);
	if (enemy.damageable === damageable) return;
	enemy.damageable = damageable;
	enemy.model.SetAttribute("Damageable", damageable);
}

export function publishDamageable(session: CombatSession): void {
	for (const enemy of session.enemies) publishEnemyDamageable(session, enemy);
}

export function sendTelemetry(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	publishDamageable(session);
	let incoming = false;
	let evadeThreat = false;
	let lockWarning = false;
	let incomingDistance = math.huge;
	for (const missile of session.projectiles) {
		if (!missile.hostile || missile.wingman !== undefined) continue;
		const range = missile.position.sub(positionFor(session.state)).Magnitude;
		incomingDistance = math.min(incomingDistance, range);
		if (range < 1800) incoming = true;
		if (EvadeRules.Decoys(range, (missile.life ?? 0) - missile.age)) evadeThreat = true;
	}
	// A windup is a lock warning, not a missile: evading now would waste the countermeasure.
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.windup > 0 && enemy.attackProtected === undefined && AlliedRules.WarnsPlayer(enemy.windupTarget, enemy.attackSector)) { lockWarning = true; break; }
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	let distance = 0;
	if (target) { const [targetDistance] = targetMetrics(session, target); distance = targetDistance; }
	const objective = sessionObjective(session);
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	// Protected-actor health is a replicated attribute; 10 Hz here is plenty for the HUD.
	if (session.blueprintState && session.navigationActor?.Parent) session.navigationActor.SetAttribute("Health", session.blueprintState.protectedHealth);
	sendHud(session, objective, target, phase);
	session.telemetrySequence += 1;
	CombatRemotes.telemetry!.FireClient(session.player, TelemetryCodec.Encode(session.telemetrySequence, {
		health: session.health, speed: session.state.speed, altitude: session.state.y,
		terrainClearance: LandingRuntime.sampleClearance(session,os.clock()),
		missionUpdateSeconds: session.blueprintState?.updateUntil !== undefined ? math.max(0,session.blueprintState.updateUntil-session.elapsed) : undefined,
		// The HUD tally counts required destructions only; raiders travel separately so it never reads 7/4.
		kills: sessionRequiredKills(session), total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown, evadeCooldown: EvadeRules.Cooldown(session.evade, session.evadeRemaining),
		// A points mission keeps its PTS line through the phases after its score threshold.
		missionPoints: phase?.scoreThreshold || session.blueprint?.phases.some((p) => p.scoreThreshold !== undefined) ? session.targetScore.Total() : undefined,
		gunRounds: session.gun?.rounds,
		radarPartial: phase?.jamming ? RearmRuntime.liveJammers(session)===1 : undefined,
		jamVisualRange: phase?.jamming && RearmRuntime.liveJammers(session)>0 ? phase.jamming.visualLockRange : undefined,
		radarJammed: session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.jamming ? RearmRuntime.liveJammers(session)>0 : undefined,
		lockProgress: session.lockProgress, incoming, lockWarning, evadeThreat,
		boundaryWarning: airspaceWarning(session.state.x, session.state.z, session.airspace),
		targetDamageable: target ? canHurt(session, target) : undefined,
		elapsed: session.elapsed, timeRemaining: sessionTimeRemaining(session),
		objectiveProgress: objective.objectiveProgress, objectiveTotal: objective.objectiveTotal,
		groundKills: sessionGroundKills(session), targetDistance: distance,
		targetHealth: target ? math.clamp(target.health / math.max(1, target.maxHealth), 0, 1) : undefined,
		protectedHealth: phase?.kind === "escort" || phase?.kind === "defend" ? session.blueprintState?.protectedHealth : undefined,
		specialCharges: session.special.charges, specialCooldown: session.special.cooldown, specialActive: session.special.active,
		aceKilled: (session.blueprintState?.aceKilled ?? false) || (session.blueprintState?.optionalAceKilled ?? false),
		paused: PauseRules.Paused(session.pause),
		pauseAck: session.pauseAck,
		pauseRemaining: PauseRules.Remaining(session.pause, os.clock()),
		turnObserved: session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_move" ? session.blueprintState.turnObserved : undefined,
		pitchObserved: session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_move" ? session.blueprintState.pitchObserved : undefined,
		evadeCharges: session.evade.charges,
		optionalKills: session.blueprintState?.optionalAirKills ?? 0,
		incomingDistance: incomingDistance < math.huge ? incomingDistance : undefined,
	}));
}

/**
 * Text, the target Model and navigation go out on the reliable MissionState
 * remote, and only when one of them changed. That keeps the 10 Hz packet small,
 * never loses a radio line, and guarantees the target Model has replicated
 * before the reference to it arrives (reliable events are ordered with
 * instance replication; unreliable ones are not).
 */
function sendHud(session: CombatSession, objective: ReturnType<typeof sessionObjective>, target: Enemy | undefined, phase: MissionPhaseBlueprint | undefined): void {
	const nav = session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState, session.state) : undefined;
	const previous = session.hud;
	const targetKind = target ? (target.kind === "ground" ? "ground" : "air") : "";
	if (previous && previous.missionId === session.missionId && previous.phase === objective.phase && previous.objective === objective.objective
		&& previous.tutorialStep === objective.tutorialStep && previous.target === target?.model && previous.targetName === (target?.name ?? "")
		&& previous.targetKind === targetKind && previous.targetRequired === (target?.required ?? false)
		&& previous.navigationRadius === phase?.radius && previous.navigationCeiling === phase?.ceiling
		&& previous.radioSerial === session.radioSerial && previous.fireDeniedSerial === session.fireDeniedSerial && previous.special === session.special.kind
		// A moving escort point only re-sends after it travels 20 studs (the cue is a screen marker, not a hitbox).
		&& (nav ? previous.navigation !== undefined && math.abs(previous.navigation.X - nav.x) + math.abs(previous.navigation.Y - nav.y) + math.abs(previous.navigation.Z - nav.z) < 20 : previous.navigation === undefined)) return;
	const hud: HudState = {
		kind: "HudState", missionId: session.missionId, phase: objective.phase, objective: objective.objective, tutorialStep: objective.tutorialStep,
		target: target?.model, targetName: target?.name ?? "", targetKind, targetRequired: target?.required ?? false,
		navigation: nav ? new Vector3(nav.x, nav.y, nav.z) : undefined, navigationRadius: phase?.radius, navigationCeiling: phase?.ceiling,
		radio: session.radio, radioSerial: session.radioSerial, radioSeconds: session.radioSeconds, radioPriority: session.radioPriority,
		fireDenied: session.fireDenied, fireDeniedSerial: session.fireDeniedSerial, special: session.special.kind,
	};
	session.hud = hud;
	CombatRemotes.missionState!.FireClient(session.player, hud);
}

/** Only the reliable HudState (radio, FIRE refusals, target, objective), sent at once if anything in it changed. */
function sendHudNow(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	sendHud(session, sessionObjective(session), target, session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined);
}

/** 20 Hz authoritative flight state for the client's prediction (unreliable, ~100 bytes). */
export function sendFlightState(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	session.stateSequence += 1;
	// Simulated time this state has run on the newest input. The client stamps each
	// input with the predicted time at which it starts applying it, so the matching
	// prediction is exactly echoedClientTime + hold, independent of either network leg.
	const hold = session.inputClientTime > 0 ? session.inputSteps * FIXED_STEP : 0;
	CombatRemotes.flightState!.FireClient(session.player, FlightPrediction.Encode(session.stateSequence, session.state, session.evadeRemaining, session.inputClientTime, hold));
}

/** Push a radio line to the HUD immediately (phase beats, chatter, ace stages, flares). */
export function radio(session: CombatSession, text: string, seconds?: number, priority = false): void {
	session.radio = text;
	session.radioSerial += 1;
	session.radioSeconds = seconds;
	session.radioPriority = priority;
	// The line travels on HudState alone: the server keeps one radio slot, so it must go out now, but the 10 Hz numbers need not.
	if (session.active && sessions.get(session.player) === session) sendHudNow(session);
}

/** Tell the HUD why a FIRE press did nothing; the serial makes every repeated press visible. */
export function denyFire(session: CombatSession, reason: FireNotice): void {
	session.fireDenied = reason;
	session.fireDeniedSerial = (session.fireDeniedSerial ?? 0) + 1;
	if (session.active && sessions.get(session.player) === session) sendHudNow(session);
}

/** Cosmetic explosion, drawn by the client (src/client/CombatEffects.ts) so no effect parts replicate. */
export function effect(session: CombatSession, kind: ExplosionKind, position: Vector3, extra?: Omit<CombatEffectPacket, "kind" | "position">): void {
	if (session.cleaned || session.player.Parent !== Players) return;
	CombatRemotes.combatEffect?.FireClient(session.player, { kind, position, ...extra });
}
