import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { MissionAssets } from "../shared/MissionAssets";
import { JetFactory } from "../shared/JetFactory";
import { MissionPhase, MissionRules, MissionRuleState, TargetKind } from "../shared/MissionRules";
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";
import { MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { FinishedCallback, FlightInput, MissionLoading, MissionStats, Remotes, Telemetry } from "../shared/Types";
import { LoadingGate, LoadingGateState } from "../shared/LoadingGate";
import { MissionWorld } from "./MissionWorld";

interface Enemy {
	id: string; name: string; model: Model; health: number; position: Vector3;
	kind: TargetKind; required: boolean; enabled: boolean;
	direction: Vector3; velocity: Vector3; fireTimer: number; windup: number;
	passRemaining: number; passDirection: Vector3; warning?: BillboardGui;
	groundIndex?: number;
	hiddenParts: { part: BasePart; transparency: number }[];
}
interface Projectile {
	part: Part; position: Vector3; direction: Vector3; target?: Enemy; hostile: boolean; age: number;
}
export interface CombatSession {
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	rules?: MissionRuleState;
	blueprintState?: BlueprintState;
	blueprint?: MissionBlueprint;
	missionId: number;
	appliedPhase?: MissionPhase | string; nextHostileAt: number;
	appliedBlueprintPhaseIndex?: number;
	health: number; kills: number; elapsed: number; missiles: number; missileCooldown: number;
	evadeCooldown: number; evadeRemaining: number; regen: number; lockProgress: number;
	enemies: Enemy[]; projectiles: Projectile[]; target?: Enemy; telemetryTime: number;
	lastInput: number; lastInputEvent: number; lastActionEvent: number; active: boolean; finished: boolean; cleaned: boolean;
	navigationMarker?: Part; navigationActor?: Model;
	previousReplicationFocus?: BasePart; characterRoot?: BasePart; wasAnchored?: boolean;
	/** Present while the client is still receiving the world; nothing simulates until it is released. */
	loading?: LoadingGateState;
}
const sessions = new Map<Player, CombatSession>();
const completing = new Set<Player>();
const connections: RBXScriptConnection[] = [];
let missionSerial = 0;
let buildingMission = false;
let missionRoot: Instance | undefined;
let missionState: RemoteEvent | undefined;
let onFinished: FinishedCallback | undefined;
const FIXED_STEP = 1 / 30;
const LOCK_RANGE = 2450;
const LOCK_DOT = math.cos(math.rad(62));
const MAX_MISSILES = 8;
function remote<K extends keyof Remotes>(remotes: Remotes | Instance, name: K): Remotes[K] {
	if (typeIs(remotes, "Instance")) return remotes.WaitForChild(name) as Remotes[K];
	assert(remotes[name], `Missing combat remote: ${name}`);
	return remotes[name];
}
function frameFor(state: FlightState): CFrame {
	return new CFrame(state.x, state.y, state.z).mul(CFrame.Angles(0, state.yaw, 0)).mul(CFrame.Angles(state.pitch, 0, state.roll));
}
function positionFor(state: FlightState): Vector3 { return new Vector3(state.x, state.y, state.z); }
function directionFor(state: FlightState): Vector3 {
	const [x, y, z] = FlightMath.Forward(state.yaw, state.pitch);
	return new Vector3(x, y, z);
}
function unitOr(vector: Vector3, fallback: Vector3): Vector3 { return vector.Magnitude > 0.01 ? vector.Unit : fallback; }
function ownsEnemy(session: CombatSession, enemy: Enemy | undefined): enemy is Enemy {
	return enemy !== undefined && enemy.enabled && enemy.health > 0 && enemy.model.Parent === session.folder
		&& enemy.model.GetAttribute("SkybreakOwner") === session.player.UserId;
}
function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}

function sessionTotalRequired(session: CombatSession): number {
	if (session.missionId === 1) return 3;
	if (session.missionId === 2) return 9;
	// Required air + required ground + ace = all required destructions.
	const bp = session.blueprint!;
	return MissionCatalog.RequiredAirKills(bp) + MissionCatalog.RequiredGroundKills(bp);
}

function sessionGroundKills(session: CombatSession): number {
	return session.rules?.groundKills ?? session.blueprintState?.requiredGroundKills ?? 0;
}

function sessionCanDamage(session: CombatSession, kind: TargetKind, required: boolean): boolean {
	if (session.rules) return MissionRules.CanDamage(session.rules, kind, required);
	if (session.blueprintState) {
		const stateKind = kind === "ace" ? "ace" : kind;
		return BlueprintRunner.CanDamage(session.blueprintState, stateKind, required);
	}
	return false;
}

function sessionRecordKill(session: CombatSession, id: string, kind: TargetKind, required: boolean, now: number): boolean {
	if (session.rules) return MissionRules.RecordKill(session.rules, id, kind, required, now);
	if (session.blueprintState) return BlueprintRunner.RecordKill(session.blueprintState, id, kind, required, now);
	return false;
}

function sessionTick(session: CombatSession, now: number, health: number): void {
	if (session.rules) MissionRules.Tick(session.rules, now, health);
	else if (session.blueprintState) BlueprintRunner.Tick(session.blueprintState, now, health);
}

function sessionOutcome(session: CombatSession): "won" | "failed" | undefined {
	return session.rules?.outcome ?? session.blueprintState?.outcome;
}

function sessionReason(session: CombatSession): string | undefined {
	return session.rules?.reason ?? session.blueprintState?.reason;
}

function sessionTimeRemaining(session: CombatSession): number {
	if (session.rules) return MissionRules.TimeRemaining(session.rules);
	if (session.blueprintState) return BlueprintRunner.TimeRemaining(session.blueprintState);
	return 0;
}

function sessionObjective(session: CombatSession): {
	phase: string;
	objective: string;
	objectiveProgress: number;
	objectiveTotal: number;
	tutorialStep: string;
} {
	if (session.rules) {
		const info = MissionRules.Objective(session.rules);
		return {
			phase: session.rules.phase,
			objective: info.objective,
			objectiveProgress: info.objectiveProgress,
			objectiveTotal: info.objectiveTotal,
			tutorialStep: info.tutorialStep,
		};
	}
	assert(session.blueprintState, "session must have rules or blueprintState");
	const info = BlueprintRunner.Objective(session.blueprintState);
	return {
		phase: info.phase,
		objective: info.objective,
		objectiveProgress: info.objectiveProgress,
		objectiveTotal: info.objectiveTotal,
		tutorialStep: "",
	};
}

function acquireTarget(session: CombatSession): void {
	let best: Enemy | undefined;
	let score = math.huge;
	for (const enemy of session.enemies) {
		if (!ownsEnemy(session, enemy)) continue;
		const [distance, dot] = targetMetrics(session, enemy);
		const candidateScore = distance + (dot < 0 ? 5000 : (1 - dot) * 700);
		if (!best || (enemy.required && !best.required) || (enemy.required === best.required && candidateScore < score)) {
			best = enemy; score = candidateScore;
		}
	}
	session.target = best;
	session.lockProgress = 0;
}
function cycleTarget(session: CombatSession): void {
	const current = session.target === undefined ? -1 : session.enemies.indexOf(session.target);
	for (let offset = 1; offset <= session.enemies.size(); offset++) {
		const candidate = session.enemies[(current + offset) % session.enemies.size()];
		if (ownsEnemy(session, candidate)) {
			session.target = candidate; session.lockProgress = 0;
			// Only the legacy Mission 1 tutorial watches the CycleTarget event.
			if (session.rules) {
				MissionRules.CycleTarget(session.rules, os.clock());
				applyPhase(session);
			}
			return;
		}
	}
}
function sendTelemetry(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	let incoming = false;
	for (const missile of session.projectiles) {
		if (missile.hostile && missile.position.sub(positionFor(session.state)).Magnitude < 1800) { incoming = true; break; }
	}
	for (const enemy of session.enemies) if (ownsEnemy(session, enemy) && enemy.windup > 0) incoming = true;
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	let distance = 0;
	if (target) { const [targetDistance] = targetMetrics(session, target); distance = targetDistance; }
	const objective = sessionObjective(session);
	const nav = session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState) : undefined;
	const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	// Protected-actor health is a replicated attribute; 10 Hz here is plenty for the HUD.
	if (session.blueprintState && session.navigationActor?.Parent) session.navigationActor.SetAttribute("Health", session.blueprintState.protectedHealth);
	const message: Telemetry = {
		navigation: nav ? new Vector3(nav.x, nav.y, nav.z) : undefined,
		navigationRadius: phase?.radius, navigationCeiling: phase?.ceiling,
		protectedHealth: phase?.kind === "escort" || phase?.kind === "defend" ? session.blueprintState?.protectedHealth : undefined,
		kind: "Telemetry", missionId: session.missionId, phase: objective.phase,
		objective: objective.objective, objectiveProgress: objective.objectiveProgress,
		objectiveTotal: objective.objectiveTotal, tutorialStep: objective.tutorialStep,
		timeRemaining: sessionTimeRemaining(session), groundKills: sessionGroundKills(session),
		health: session.health, speed: session.state.speed, altitude: session.state.y,
		kills: session.kills, total: sessionTotalRequired(session),
		missiles: session.missiles, missileCooldown: session.missileCooldown,
		evadeCooldown: session.evadeCooldown, target: target?.model, targetName: target?.name ?? "",
		targetKind: target ? (target.kind === "ground" ? "ground" : "air") : "", targetRequired: target?.required ?? false, targetDistance: distance,
		lockProgress: session.lockProgress, incoming, elapsed: session.elapsed,
		boundaryWarning: math.max(math.abs(session.state.x), math.abs(session.state.z)) > FlightMath.SoftBoundary,
	};
	missionState!.FireClient(session.player, message);
}
function restoreMenu(): void {
	if (sessions.size() > 0) return;
	const [ok, message] = pcall(() => MissionWorld.RestoreMenu());
	if (!ok) warn(`SKYBREAK menu restoration failed: ${tostring(message)}`);
}
function cleanupSession(session: CombatSession, restore = true): void {
	if (session.cleaned) return;
	session.cleaned = true;
	session.active = false;
	if (sessions.get(session.player) === session) {
		sessions.delete(session.player);
		if (session.characterRoot?.Parent) session.characterRoot.Anchored = session.wasAnchored ?? false;
		if (session.player.Parent === Players) session.player.ReplicationFocus = session.previousReplicationFocus;
	}
	session.folder.Destroy();
	session.projectiles.clear();
	session.enemies.clear();
	session.target = undefined;
	if (restore) restoreMenu();
}
function finish(session: CombatSession): void {
	if (!session.active || session.finished) return;
	const outcome = sessionOutcome(session);
	if (outcome === undefined) return;
	session.finished = true;
	session.active = false;
	completing.add(session.player);
	// Sync elapsed from whichever authoritative runner owns the mission.
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	sendTelemetry(session);
	const won = outcome === "won";
	const stats: MissionStats = {
		kills: session.kills,
		groundKills: sessionGroundKills(session),
		missionId: session.missionId,
		elapsed: session.elapsed,
		slot: session.slot,
		reason: sessionReason(session),
		completedPhases: session.blueprintState?.phaseIndex,
	};
	const callback = onFinished!;
	task.defer(() => {
		if (session.cleaned) { completing.delete(session.player); return; }
		const [ok, message] = pcall(callback, session.player, won, stats);
		if (!ok) {
			warn(`SKYBREAK mission completion callback: ${tostring(message)}`);
			if (!session.cleaned && session.player.Parent === Players) missionState!.FireClient(session.player, {
				kind: won ? "Completed" : "Failed", ...stats, saved: false,
			});
		}
		cleanupSession(session);
		completing.delete(session.player);
	});
}
function refreshSession(session: CombatSession, now: number): boolean {
	if (!session.active) return false;
	// The mission clock is monotonic; never tick it while the client is still loading.
	if (session.loading) return true;
	sessionTick(session, now, session.health);
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	if (sessionOutcome(session) !== undefined) { finish(session); return false; }
	return true;
}
function countParts(root: Instance): number {
	let count = 0;
	for (const item of root.GetDescendants()) if (item.IsA("BasePart")) count++;
	return count;
}
// Leaves the loading gate: the playable clock starts now, and the client gets
// the same "Started" message it always did.
function beginPlay(session: CombatSession): void {
	if (!session.loading || !session.active || session.cleaned) return;
	session.loading = undefined;
	const now = os.clock();
	if (session.rules) { session.rules.startedAt = now; session.rules.elapsed = 0; }
	if (session.blueprintState) { session.blueprintState.startedAt = now; session.blueprintState.elapsed = 0; }
	session.elapsed = 0;
	session.lastInput = now;
	session.telemetryTime = 0;
	if (session.player.Parent !== Players) { cleanupSession(session); return; }
	missionState!.FireClient(session.player, { kind: "Started", slot: session.slot, missionId: session.missionId, aircraft: session.aircraft });
	if (refreshSession(session, now)) sendTelemetry(session);
}
function markTarget(session: CombatSession, enemy: Enemy): void {
	enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled);
	enemy.model.SetAttribute("SkybreakOwner", session.player.UserId);
	enemy.model.SetAttribute("TargetKind", enemy.kind === "ground" ? "ground" : "air");
	enemy.model.SetAttribute("RequiredTarget", enemy.enabled && enemy.required);
	enemy.model.SetAttribute("Health", enemy.health);
}
function activateGround(session: CombatSession, start=0, count=math.huge): void {
	for (const enemy of session.enemies) {
		if (enemy.kind !== "ground" || enemy.enabled || enemy.health <= 0 || (enemy.groundIndex ?? 0) < start || (enemy.groundIndex ?? 0) >= start+count) continue;
		enemy.enabled = true;
		for (const hidden of enemy.hiddenParts) hidden.part.Transparency = hidden.transparency;
		enemy.hiddenParts.clear();
		markTarget(session, enemy);
	}
}
function attackWarning(model: Model): BillboardGui {
	const warning = new Instance("BillboardGui");
	warning.Name = "MissileWarning";
	warning.Adornee = model.PrimaryPart;
	warning.Size = UDim2.fromOffset(135, 28);
	warning.StudsOffsetWorldSpace = new Vector3(0, 18, 0);
	warning.MaxDistance = 2300;
	warning.AlwaysOnTop = true;
	warning.Enabled = false;
	warning.Parent = model;
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromScale(1, 1);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.GothamBold;
	label.TextSize = 16;
	label.TextColor3 = Color3.fromRGB(255, 130, 85);
	label.TextStrokeTransparency = 0.2;
	label.Text = "MISSILE WARNING";
	label.Parent = warning;
	return warning;
}
function spawnAir(session: CombatSession, count: number, required: boolean, ace = false, aceHealth = 165): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
	for (let index = 0; index < count; index++) {
		const name = ace ? "ACE" : `${required ? "BANDIT" : "RAIDER"} 0${index + 1}`;
		const model = JetFactory.Create(name, true);
		if (!session.active || session.folder.Parent === undefined) { model.Destroy(); return; }
		const offset = forward.mul(850 + index * 100).add(right.mul((index - (count - 1) / 2) * 250));
		const spawn = positionFor(session.state).add(offset);
		const position = new Vector3(math.clamp(spawn.X, -2400, 2400), math.clamp(spawn.Y + 80 + index * 25, 230, 900), math.clamp(spawn.Z, -2400, 2400));
		const direction = unitOr(positionFor(session.state).sub(position).add(right.mul(150)), forward.mul(-1));
		model.Parent = session.folder;
		model.PivotTo(CFrame.lookAt(position, position.add(direction)));
		const enemy: Enemy = {
			id: `air_${session.enemies.size() + 1}_${missionSerial}`, name, model, health: ace ? aceHealth : session.missionId <= 2 ? 100 : 100 + (session.blueprint!.act - 1)*8,
			position, direction, velocity: direction.mul(300), kind: ace ? "ace" : "air", required, enabled: true,
			fireTimer: 8 + index * 3, windup: 0, passRemaining: 0, passDirection: direction,
			hiddenParts: [], warning: attackWarning(model),
		};
		markTarget(session, enemy);
		session.enemies.push(enemy);
	}
}

// Legacy Mission 1/2 phase application: byte-for-byte compatible with the
// pre-blueprint CombatService behavior that the existing engine tests cover.
function applyLegacyPhase(session: CombatSession): void {
	assert(session.rules, "legacy phase application requires MissionRules state");
	if (session.appliedPhase === session.rules.phase || session.rules.outcome !== undefined) return;
	session.appliedPhase = session.rules.phase;
	const phase = session.rules.phase;
	if (phase === "tutorial_target") activateGround(session);
	else if (phase === "tutorial_bandits" || phase === "intercept") spawnAir(session, 3, true);
	else if (phase === "warehouses") { activateGround(session); spawnAir(session, 5, false); }
	else if (phase === "ace") spawnAir(session, 1, true, true);
	acquireTarget(session);
}

// Blueprint-driven phase application for missions 3-27.
function applyBlueprintPhase(session: CombatSession): void {
	assert(session.blueprintState && session.blueprint, "blueprint phase application requires blueprint state");
	const state=session.blueprintState;
	if (state.outcome !== undefined || session.appliedBlueprintPhaseIndex === state.phaseIndex) return;
	session.appliedBlueprintPhaseIndex=state.phaseIndex;
	// Retire optional pursuers at the end of their authored window. Never let
	// invisible old waves damage a convoy or count in a later phase.
	for (const enemy of session.enemies) if (enemy.kind !== "ground" && enemy.health > 0) {
		enemy.enabled=false; enemy.health=0; enemy.model.Destroy();
	}
	session.navigationMarker?.Destroy(); session.navigationMarker=undefined;
	session.navigationActor?.Destroy(); session.navigationActor=undefined;
	const phase: MissionPhaseBlueprint | undefined=state.blueprint.phases[state.phaseIndex];
	if (!phase) return;
	if (phase.kind === "required_ground") {
		let start=0;
		for(let i=0;i<state.phaseIndex;i++) if(state.blueprint.phases[i].kind === "required_ground") start+=state.blueprint.phases[i].count ?? 0;
		activateGround(session,start,phase.count ?? 0);
	} else if (phase.kind === "required_air") spawnAir(session,phase.count ?? 0,true);
	else if (phase.kind === "ace") spawnAir(session,1,true,true,session.blueprint.aceHealth ?? 165);
	if ((phase.optionalRaiders ?? 0)>0) spawnAir(session,phase.optionalRaiders!,false);
	const nav=BlueprintRunner.NavigationPoint(state);
	if (nav) {
		const marker=new Instance("Part"); marker.Name="Flight objective"; marker.Size=new Vector3(20,20,20); marker.Shape=Enum.PartType.Ball;
		marker.Anchored=true; marker.CanCollide=false; marker.CanTouch=false; marker.CanQuery=false;
		marker.Color=Color3.fromRGB(75,238,212); marker.Material=Enum.Material.Neon; marker.Transparency=.3;
		marker.Position=new Vector3(nav.x,nav.y,nav.z); marker.Parent=session.folder;
		marker.SetAttribute("ObjectiveRadius",phase.radius); marker.SetAttribute("ObjectiveCeiling",phase.ceiling);
		session.navigationMarker=marker;
		const gui=new Instance("BillboardGui"); gui.Size=UDim2.fromOffset(160,38); gui.AlwaysOnTop=true; gui.StudsOffsetWorldSpace=new Vector3(0,30,0); gui.Parent=marker;
		const label=new Instance("TextLabel"); label.Size=UDim2.fromScale(1,1); label.BackgroundTransparency=.25;
		label.BackgroundColor3=Color3.fromRGB(7,23,30); label.TextColor3=marker.Color; label.Text=phase.kind === "route" ? "FLIGHT BEACON" : phase.kind === "escort" ? "PROTECT CONVOY" : phase.kind === "defend" ? "PROTECT SITE" : "SIGNAL VOLUME";
		label.TextSize=13; label.Font=Enum.Font.GothamBold; label.Parent=gui;
		if (phase.kind === "escort" || phase.kind === "defend") {
			const coast=session.blueprint.region === "coastal_city" || session.blueprint.region === "ocean_platform";
			const actor=coast ? MissionAssets.CreateHarborLaunch("LOYALIST LAUNCH") : phase.kind === "defend" ? MissionAssets.CreateCommsRelay("LOYALIST TOWER") : MissionAssets.CreateRelayTruck("LOYALIST TRUCK");
			if (!session.active || !session.folder.Parent) {actor.Destroy(); return;}
			actor.SetAttribute("ProtectedObjective",true); actor.Parent=session.folder; session.navigationActor=actor;
			actor.PivotTo(new CFrame(nav.x,phase.kind === "defend" ? 92 : nav.y,nav.z));
		}
	}
	acquireTarget(session);
}

function applyPhase(session: CombatSession): void {
	if (session.rules) applyLegacyPhase(session);
	else applyBlueprintPhase(session);
}

function destroyEnemy(session: CombatSession, enemy: Enemy): void {
	if (!ownsEnemy(session, enemy)) return;
	const accepted = sessionRecordKill(session, enemy.id, enemy.kind, enemy.required, os.clock());
	if (session.rules) session.elapsed = session.rules.elapsed;
	else if (session.blueprintState) session.elapsed = session.blueprintState.elapsed;
	if (!accepted) { if (sessionOutcome(session) !== undefined) finish(session); return; }
	enemy.health = 0;
	enemy.enabled = false;
	enemy.model.SetAttribute("Health", 0);
	enemy.model.SetAttribute("SkybreakEnemy", false);
	enemy.model.SetAttribute("RequiredTarget", false);
	JetFactory.Burst(session.folder, enemy.position, Color3.fromRGB(255, 169, 87), enemy.kind === "ground" ? 26 : 12);
	enemy.model.Destroy();
	if (session.rules) {
		session.kills = session.rules.requiredAirKills + session.rules.optionalAirKills + (session.rules.aceKilled ? 1 : 0);
	} else if (session.blueprintState) {
		const bs = session.blueprintState;
		session.kills = bs.requiredAirKills + bs.optionalAirKills + (bs.aceKilled ? 1 : 0);
	}
	applyPhase(session);
	if (session.target === enemy || !ownsEnemy(session, session.target)) acquireTarget(session);
	if (sessionOutcome(session) !== undefined) finish(session);
}
function launchMissile(session: CombatSession, hostile: boolean, enemy?: Enemy): void {
	let position: Vector3;
	let direction: Vector3;
	let target: Enemy | undefined;
	if (hostile) {
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") return;
		position = enemy.position.add(enemy.direction.mul(18));
		direction = unitOr(positionFor(session.state).sub(position), enemy.direction);
	} else {
		if (session.lockProgress < 0.99 || !ownsEnemy(session, session.target)) return;
		if (!sessionCanDamage(session, session.target.kind, session.target.required)) return;
		const [distance, dot] = targetMetrics(session, session.target);
		if (session.missiles <= 0 || session.missileCooldown > 0 || distance > LOCK_RANGE || dot < LOCK_DOT) return;
		position = positionFor(session.state).add(directionFor(session.state).mul(16)).sub(new Vector3(0, 2, 0));
		direction = directionFor(session.state);
		target = session.target;
		session.missiles -= 1;
		session.missileCooldown = 1.15;
	}
	session.projectiles.push({ part: JetFactory.CreateMissile(session.folder, position, direction, hostile), position, direction, target, hostile, age: 0 });
}
function evade(session: CombatSession): void {
	if (session.evadeCooldown > 0) return;
	session.evadeCooldown = 6;
	session.evadeRemaining = 2.1;
	JetFactory.Flares(session.folder, positionFor(session.state));
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		if (missile.hostile) {
			JetFactory.Burst(session.folder, missile.position, Color3.fromRGB(255, 220, 142), 3);
			missile.part.Destroy(); session.projectiles.remove(index);
		}
	}
}
function stepEnemies(session: CombatSession, dt: number): void {
	const playerPosition = positionFor(session.state);
	const playerForward = directionFor(session.state);
	const playerVelocity = playerForward.mul(session.state.speed);
	const lateral = new Vector3(-playerForward.Z, 0, playerForward.X);
	const phase=session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
	const site=session.blueprintState ? BlueprintRunner.NavigationPoint(session.blueprintState) : undefined;
	const guarding=site !== undefined && (phase?.kind === "escort" || phase?.kind === "defend");
	for (let index = 0; index < session.enemies.size(); index++) {
		const enemy = session.enemies[index];
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") continue;
		const ace = enemy.kind === "ace";
		const separation = playerPosition.sub(enemy.position).Magnitude;
		const speed = math.clamp(session.state.speed + (ace ? 48 : 24), ace ? 320 : 285, ace ? 380 : 350);
		enemy.passRemaining = math.max(0, enemy.passRemaining - dt);
		if (separation < 280 && enemy.passRemaining <= 0) {
			enemy.passRemaining = ace ? 2 : 2.6;
			enemy.passDirection = unitOr(enemy.direction.add(playerForward.mul(0.2)), enemy.direction);
		}
		const lead = math.clamp(separation / (speed + session.state.speed), 0.35, 1.8);
		const weave = math.sin(session.elapsed * (ace ? 1.7 : 0.65) + index * 1.8) * (ace ? 125 : 45);
		const protects=guarding && !enemy.required;
		const destination = protects ? new Vector3(site!.x + math.sin(session.elapsed*.4+index)*240,230,site!.z + math.cos(session.elapsed*.4+index)*240) : playerPosition.add(playerVelocity.mul(lead)).add(lateral.mul(weave)).add(new Vector3(0, ace ? math.sin(session.elapsed * 1.4) * 65 : 25, 0));
		const desired = enemy.passRemaining > 0 ? enemy.passDirection : unitOr(destination.sub(enemy.position), enemy.direction);
		const oldDirection = enemy.direction;
		enemy.direction = unitOr(oldDirection.Lerp(desired, FlightMath.DampAlpha(ace ? 2.8 : 2.1, dt)), oldDirection);
		enemy.velocity = enemy.direction.mul(speed);
		enemy.position = enemy.position.add(enemy.velocity.mul(dt));
		const bank = math.clamp(-oldDirection.Cross(enemy.direction).Y * 26, -0.65, 0.65);
		enemy.model.PivotTo(CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction)).mul(CFrame.Angles(0, 0, bank)));
		enemy.fireTimer = math.max(0, enemy.fireTimer - dt);
		const aimDot = enemy.direction.Dot(unitOr(playerPosition.sub(enemy.position), enemy.direction));
		if (enemy.windup > 0) {
			enemy.windup = math.max(0, enemy.windup - dt);
			if (enemy.windup <= 0) {
				enemy.warning!.Enabled = false;
				enemy.model.SetAttribute("AttackWarning", false);
				if (separation > 300 && separation < 2100 && session.evadeRemaining <= 0) launchMissile(session, true, enemy);
				enemy.fireTimer = ace ? 12 : 17;
			}
		} else if (enemy.fireTimer <= 0 && session.elapsed >= session.nextHostileAt && separation > 450 && separation < 1800 && aimDot > 0.65 && session.evadeRemaining <= 0) {
			enemy.windup = 2.6;
			enemy.warning!.Enabled = true;
			enemy.model.SetAttribute("AttackWarning", true);
			session.nextHostileAt = session.elapsed + (ace ? 7.5 : 9);
		}
	}
}
function segmentDistance(point: Vector3, startPosition: Vector3, endPosition: Vector3): number {
	const segment = endPosition.sub(startPosition);
	const lengthSquared = segment.Dot(segment);
	const t = lengthSquared > 0 ? math.clamp(point.sub(startPosition).Dot(segment) / lengthSquared, 0, 1) : 0;
	return point.sub(startPosition.add(segment.mul(t))).Magnitude;
}
function stepMissiles(session: CombatSession, dt: number): void {
	for (let index = session.projectiles.size() - 1; index >= 0; index--) {
		const missile = session.projectiles[index];
		missile.age += dt;
		let removed = missile.age > (missile.hostile ? 5.5 : 8) || (!missile.hostile && !ownsEnemy(session, missile.target));
		if (!removed) {
			const targetPosition = missile.hostile ? positionFor(session.state) : missile.target!.position;
			const velocity = missile.hostile ? directionFor(session.state).mul(session.state.speed) : missile.target!.velocity;
			const speed = missile.hostile ? 450 : 750;
			const distance = targetPosition.sub(missile.position).Magnitude;
			const lead = missile.hostile ? 0.08 : math.clamp(distance / speed, 0, 0.65);
			const delta = targetPosition.add(velocity.mul(lead)).sub(missile.position);
			if (!missile.hostile || missile.age < 1.1) missile.direction = unitOr(missile.direction.Lerp(unitOr(delta, missile.direction), FlightMath.DampAlpha(missile.hostile ? 0.65 : 7, dt)), missile.direction);
			const nextPosition = missile.position.add(missile.direction.mul(speed * dt));
			if (segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile ? 18 : 32)) {
				removed = true;
				JetFactory.Burst(session.folder, targetPosition, Color3.fromRGB(255, 179, 102), missile.hostile ? 6 : 8);
				if (missile.hostile) {
					if (session.evadeRemaining <= 0) session.health = math.max(0, session.health - 10);
				} else if (sessionCanDamage(session, missile.target!.kind, missile.target!.required)) {
					const enemy = missile.target!;
					if (enemy.health <= 55) {
						missile.part.Destroy(); session.projectiles.remove(index);
						destroyEnemy(session, enemy);
						if (!session.active) return;
						continue;
					}
					enemy.health -= 55;
					enemy.model.SetAttribute("Health", enemy.health);
				}
			} else {
				missile.position = nextPosition;
				missile.part.CFrame = CFrame.lookAt(nextPosition, nextPosition.add(missile.direction));
			}
		}
		if (removed) { missile.part.Destroy(); session.projectiles.remove(index); }
	}
	// One rules tick per step covers hostile hits; destroyEnemy already finishes
	// the session itself when a kill settles the outcome.
	refreshSession(session, os.clock());
}
function stepSession(session: CombatSession, dt: number): void {
	if (!refreshSession(session, os.clock())) return;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeCooldown = math.max(0, session.evadeCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	session.regen += dt;
	if (session.regen >= 2.5) { session.regen -= 2.5; session.missiles = math.min(MAX_MISSILES, session.missiles + 1); }
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; }
	// Legacy Mission 1 observes real control usage during its tutorial phases.
	if (session.rules) MissionRules.ObserveControls(session.rules, session.input.x, session.input.y, dt, os.clock());
	if (sessionOutcome(session) !== undefined) { finish(session); return; }
	applyPhase(session);
	const from={x:session.state.x,y:session.state.y,z:session.state.z};
	FlightMath.Step(session.state, session.input, dt);
	if (session.blueprintState) {
		const bs=session.blueprintState, nav=BlueprintRunner.NavigationPoint(bs);
		let threats=0;
		if (nav) for(const enemy of session.enemies) if(ownsEnemy(session,enemy) && enemy.kind !== "ground" && enemy.position.sub(new Vector3(nav.x,230,nav.z)).Magnitude < 650) threats++;
		BlueprintRunner.ObserveFlight(bs,from,{x:session.state.x,y:session.state.y,z:session.state.z},dt,os.clock(),threats);
		if (bs.outcome !== undefined) {finish(session); return;}
		applyPhase(session);
		const point=BlueprintRunner.NavigationPoint(bs);
		if (point && session.navigationMarker) {
			const pos=new Vector3(point.x,point.y,point.z);
			session.navigationMarker.Position=pos;
			const actor=session.navigationActor;
			if(actor) {
				const phase=BlueprintRunner.ActivePhase(bs)!;
				const old=actor.GetPivot().Position;
				const direction=new Vector3(pos.X-old.X,0,pos.Z-old.Z);
				const y=phase.kind === "defend" ? 92 : pos.Y;
				const current=new Vector3(pos.X,y,pos.Z);
				actor.PivotTo(direction.Magnitude>.01 ? CFrame.lookAt(current,current.add(direction)) : new CFrame(current));
			}
		}
	}
	let flightFrame = frameFor(session.state);
	if (session.evadeRemaining > 0) flightFrame = flightFrame.mul(CFrame.Angles(0, 0, (1 - session.evadeRemaining / 2.1) * math.pi * 2));
	session.aircraft.PivotTo(flightFrame);
	stepEnemies(session, dt);
	if (!ownsEnemy(session, session.target)) acquireTarget(session);
	if (session.target) {
		const [distance, dot] = targetMetrics(session, session.target);
		session.lockProgress = distance <= LOCK_RANGE && dot >= LOCK_DOT
			? math.min(1, session.lockProgress + dt / 0.8) : math.max(0, session.lockProgress - dt * 1.6);
	}
	stepMissiles(session, dt);
	if (!refreshSession(session, os.clock())) return;
	session.telemetryTime += dt;
	if (session.telemetryTime >= 0.1) { session.telemetryTime -= 0.1; sendTelemetry(session); }
}

// Clients supply validated controls and button events, never damage or results.
export const CombatService = {
	EndMission(player: Player): void {
		const session = sessions.get(player);
		if (session) cleanupSession(session);
	},
	GetSession(player: Player): CombatSession | undefined { return sessions.get(player); },
	IsActive(player: Player): boolean { return sessions.get(player)?.active ?? false; },
	StartMission(player: Player, slot: number, missionId = 1): LuaTuple<[boolean, string?]> {
		if (!missionState || !onFinished) return $tuple(false, "CombatService is not initialized");
		if (!FlightMath.IsFinite(slot) || slot % 1 !== 0 || slot < 1 || slot > 4) return $tuple(false, "Choose a save slot from 1 to 4");
		if (!MissionCatalog.IsValidId(missionId)) return $tuple(false, "Choose a valid mission");
		if (!typeIs(player, "Instance") || !player.IsA("Player") || player.Parent !== Players) return $tuple(false, "Player is unavailable");
		if (completing.has(player)) return $tuple(false, "Your mission result is still being saved");
		if (sessions.has(player)) return $tuple(false, "A mission is already in progress or its result is being saved");
		if (buildingMission || sessions.size() > 0) return $tuple(false, "This mission world is single-player");
		buildingMission = true;
		const startedAt = os.clock();
		missionSerial += 1;
		const folder = new Instance("Folder");
		folder.Name = `Mission_${player.UserId}_${missionSerial}`;
		folder.Parent = missionRoot;
		const [ok, result] = pcall(() => {
			const legacy = missionId === 1 || missionId === 2;
			const world = MissionWorld.Build(missionId, folder);
			assert(player.Parent === Players, "Player left during world construction");
			if (legacy) {
				assert(world.groundTargets.size() === (missionId === 1 ? 1 : 5), "Mission world has an incorrect ground target count");
			} else {
				const blueprint = MissionCatalog.Get(missionId);
				assert(world.groundTargets.size() === blueprint.ground.size(), `Mission ${missionId} world ground target count mismatch`);
			}
			const aircraft = JetFactory.Create("SKYBREAK - Kestrel", false);
			assert(player.Parent === Players, "Player left during aircraft construction");
			aircraft.SetAttribute("SkybreakOwner", player.UserId);
			aircraft.SetAttribute("SkybreakPlayer", true);
			aircraft.Parent = folder;
			const state = FlightMath.NewState();
			aircraft.PivotTo(frameFor(state));
			const session: CombatSession = {
				player, slot, folder, aircraft, state, missionId, nextHostileAt: 8,
				input: { x: 0, y: 0, throttle: 0.65 }, health: 100, kills: 0, elapsed: 0,
				missiles: MAX_MISSILES, missileCooldown: 0, evadeCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				lastActionEvent: -math.huge, active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
			};
			if (legacy) {
				session.rules = MissionRules.NewState(missionId as 1 | 2, startedAt);
			} else {
				session.blueprint = MissionCatalog.Get(missionId);
				session.blueprintState = BlueprintRunner.NewState(session.blueprint, startedAt);
			}
			for (let index = 0; index < world.groundTargets.size(); index++) {
				const model = world.groundTargets[index];
				assert(model.Parent === folder && model.PrimaryPart !== undefined, "Ground target must have a stationary aim center in its session");
				const enemy: Enemy = {
					id: `ground_${index + 1}_${missionSerial}`, name: model.Name, model, health: 55,
					position: model.PrimaryPart.Position, direction: new Vector3(0, 0, -1), velocity: Vector3.zero,
					kind: "ground", groundIndex: index, required: true, enabled: false, fireTimer: 0, windup: 0,
					passRemaining: 0, passDirection: new Vector3(0, 0, -1), hiddenParts: [],
				};
				// Legacy Mission 1 hides the training radar until the tutorial activates it.
				const hideUntilActivated = missionId === 1;
				for (const item of model.GetDescendants()) {
					if (item.IsA("BasePart")) {
						item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = false;
						if (hideUntilActivated) { enemy.hiddenParts.push({ part: item, transparency: item.Transparency }); item.Transparency = 1; }
					}
				}
				markTarget(session, enemy);
				session.enemies.push(enemy);
			}
			// The opening wave is created here (JetFactory may yield on first mesh
			// generation, which is safe on this RemoteFunction thread) so its parts
			// replicate under the loading screen. Enemy timers only advance once play
			// begins, so this is gameplay-equivalent to spawning at launch.
			applyPhase(session);
			assert(player.Parent === Players, "Player left during mission setup");
			// Hold in the loading gate: no clock, stepping or input until the client
			// confirms replication (CombatAction "Ready") or the timeout elapses.
			session.loading = LoadingGate.New(os.clock());
			sessions.set(player, session);
			player.ReplicationFocus = aircraft.PrimaryPart;
			const characterRoot = player.Character?.FindFirstChild("HumanoidRootPart");
			if (characterRoot?.IsA("BasePart")) {
				session.characterRoot = characterRoot; session.wasAnchored = characterRoot.Anchored; characterRoot.Anchored = true;
			}
			const loading: MissionLoading = { kind: "Loading", slot, missionId, aircraft, expectedParts: countParts(folder) };
			missionState!.FireClient(player, loading);
		});
		buildingMission = false;
		if (!ok) {
			const session = sessions.get(player);
			if (session) cleanupSession(session, false);
			folder.Destroy();
			restoreMenu();
			warn(`SKYBREAK mission construction failed: ${tostring(result)}`);
			return $tuple(false, "The mission world could not be built. Please retry.");
		}
		return $tuple(true);
	},
	Init(remotes: Remotes | Instance, finishedCallback: FinishedCallback): void {
		assert(typeIs(finishedCallback, "function"), "CombatService.Init requires onFinished");
		for (const connection of connections) connection.Disconnect();
		connections.clear();
		for (const [, session] of sessions) cleanupSession(session, false);
		onFinished = finishedCallback;
		missionState = remote(remotes, "MissionState");
		missionRoot = Workspace.FindFirstChild("SkybreakCombat");
		if (!missionRoot) { missionRoot = new Instance("Folder"); missionRoot.Name = "SkybreakCombat"; missionRoot.Parent = Workspace; }
		connections.push(remote(remotes, "FlightInput").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || session.loading || !typeIs(payload, "table")) return;
			const now = os.clock();
			if (!refreshSession(session, now) || now - session.lastInputEvent < 1 / 40) return;
			session.lastInputEvent = now;
			const data = payload as { x?: unknown; y?: unknown; throttle?: unknown };
			if (!FlightMath.IsFinite(data.x) || !FlightMath.IsFinite(data.y) || !FlightMath.IsFinite(data.throttle)) return;
			session.input.x = math.clamp(data.x, -1, 1);
			session.input.y = math.clamp(data.y, -1, 1);
			session.input.throttle = math.clamp(data.throttle, 0, 1);
			session.lastInput = now;
		}));
		connections.push(remote(remotes, "CombatAction").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || !typeIs(payload, "table")) return;
			const data = payload as { action?: unknown };
			if (!typeIs(data.action, "string")) return;
			const now = os.clock();
			if (session.loading) {
				// The client has the aircraft and world locally; release the gate now.
				if (data.action === "Ready") { LoadingGate.MarkReady(session.loading); if (LoadingGate.Release(session.loading, now)) beginPlay(session); }
				return;
			}
			if (!refreshSession(session, now) || now - session.lastActionEvent < 0.09) return;
			session.lastActionEvent = now;
			if (data.action === "FireMissile") launchMissile(session, false);
			else if (data.action === "Evade") evade(session);
			else if (data.action === "CycleTarget") cycleTarget(session);
		}));
		connections.push(Players.PlayerRemoving.Connect((player) => CombatService.EndMission(player)));
		let accumulator = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			const now = os.clock();
			for (const [, session] of sessions) {
				if (session.loading) { if (LoadingGate.Release(session.loading, now)) beginPlay(session); continue; }
				refreshSession(session, now);
			}
			if (!FlightMath.IsFinite(dt) || dt <= 0) return;
			accumulator = math.min(accumulator + dt, FIXED_STEP * 5);
			while (accumulator >= FIXED_STEP) {
				accumulator -= FIXED_STEP;
				for (const [, session] of sessions) if (session.active && !session.loading) stepSession(session, FIXED_STEP);
			}
		}));
	},
};
