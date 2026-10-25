import { Players, RunService, Workspace } from "@rbxts/services";
import { getCombatPhasePlan, shouldApplyCombatPhase } from "../shared/CombatPhasePlan";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { JetFactory } from "../shared/JetFactory";
import { getMission, MISSION_COUNT, MissionPhase } from "../shared/MissionCatalog";
import { MissionPhaseString, MissionRules, MissionRuleState, TargetKind } from "../shared/MissionRules";
import { FinishedCallback, FlightInput, MissionStats, Remotes, Telemetry } from "../shared/Types";
import { MissionWorld } from "./MissionWorld";

interface Enemy {
	id: string; name: string; model: Model; health: number; position: Vector3;
	kind: TargetKind; required: boolean; enabled: boolean;
	direction: Vector3; velocity: Vector3; fireTimer: number; windup: number;
	passRemaining: number; passDirection: Vector3; warning?: BillboardGui;
	hiddenParts: { part: BasePart; transparency: number }[];
}
interface Projectile {
	part: Part; position: Vector3; direction: Vector3; target?: Enemy; hostile: boolean; age: number;
}
export interface CombatSession {
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	rules: MissionRuleState; appliedPhase?: MissionPhaseString; nextHostileAt: number;
	health: number; kills: number; elapsed: number; missiles: number; missileCooldown: number;
	evadeCooldown: number; evadeRemaining: number; regen: number; lockProgress: number;
	enemies: Enemy[]; projectiles: Projectile[]; target?: Enemy; telemetryTime: number;
	navigationTargets: Model[]; navigationPhase?: number;
	lastInput: number; lastInputEvent: number; lastActionEvent: number; active: boolean; finished: boolean; cleaned: boolean;
	previousReplicationFocus?: BasePart; characterRoot?: BasePart; wasAnchored?: boolean;
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
			// A real CycleTarget event with an available target is the tutorial gate.
			MissionRules.CycleTarget(session.rules, os.clock());
			applyPhase(session);
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
	const navigation = session.navigationTargets[math.floor(session.rules.phaseProgress)];
	const navigationActive = session.rules.phase.find("nav_")[0] === 1 && navigation?.Parent === session.folder;
	const displayTarget = navigationActive ? navigation : target?.model;
	let distance = 0;
	if (navigationActive) distance = navigation.GetPivot().Position.sub(positionFor(session.state)).Magnitude;
	else if (target) { const [targetDistance] = targetMetrics(session, target); distance = targetDistance; }
	const objective = MissionRules.Objective(session.rules);
	const mission = session.rules.missionId;
	const total = mission === 1 ? 3 : mission === 2 ? 9 : (() => {
		const def = getMission(mission);
		let sum = 0;
		for (const phase of def.phases) sum += phase.required;
		return math.max(1, sum);
	})();
	const message: Telemetry = {
		kind: "Telemetry", missionId: session.rules.missionId, phase: session.rules.phase,
		objective: objective.objective, objectiveProgress: objective.objectiveProgress,
		objectiveTotal: objective.objectiveTotal, tutorialStep: objective.tutorialStep,
		timeRemaining: MissionRules.TimeRemaining(session.rules), groundKills: session.rules.groundKills,
		health: session.health, speed: session.state.speed, altitude: session.state.y,
		kills: session.kills, total,
		missiles: session.missiles, missileCooldown: session.missileCooldown,
		evadeCooldown: session.evadeCooldown, target: displayTarget, targetName: navigationActive ? `ROUTE GATE ${math.floor(session.rules.phaseProgress) + 1}` : target?.name ?? "",
		targetKind: navigationActive ? "navigation" : target ? (target.kind === "ground" ? "ground" : "air") : "", targetRequired: navigationActive || (target?.required ?? false), targetDistance: distance,
		lockProgress: navigationActive ? 0 : session.lockProgress, incoming, elapsed: session.elapsed,
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
	// An old yielding completion must never detach a newly launched aircraft.
	if (sessions.get(session.player) === session) {
		sessions.delete(session.player);
		if (session.characterRoot?.Parent) session.characterRoot.Anchored = session.wasAnchored ?? false;
		if (session.player.Parent === Players) session.player.ReplicationFocus = session.previousReplicationFocus;
	}
	session.folder.Destroy();
	session.projectiles.clear();
	session.enemies.clear();
	session.navigationTargets.clear();
	session.target = undefined;
	if (restore) restoreMenu();
}
function finish(session: CombatSession): void {
	if (!session.active || session.finished || session.rules.outcome === undefined) return;
	// Guard before persistence can yield; the callback owns the normal Finished message.
	session.finished = true;
	session.active = false;
	completing.add(session.player);
	session.elapsed = session.rules.elapsed;
	sendTelemetry(session);
	const won = session.rules.outcome === "won";
	const stats: MissionStats = {
		kills: session.kills, groundKills: session.rules.groundKills, missionId: session.rules.missionId,
		elapsed: session.elapsed, slot: session.slot, reason: session.rules.reason,
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
		// Finished reaches the client first, so outcome UI survives aircraft/world teardown.
		cleanupSession(session);
		completing.delete(session.player);
	});
}
function refreshSession(session: CombatSession, now: number): boolean {
	if (!session.active) return false;
	MissionRules.Tick(session.rules, now, session.health);
	session.elapsed = session.rules.elapsed;
	if (session.rules.outcome !== undefined) { finish(session); return false; }
	return true;
}
function markTarget(session: CombatSession, enemy: Enemy): void {
	enemy.model.SetAttribute("SkybreakEnemy", enemy.enabled);
	enemy.model.SetAttribute("SkybreakOwner", session.player.UserId);
	enemy.model.SetAttribute("TargetKind", enemy.kind === "ground" ? "ground" : "air");
	enemy.model.SetAttribute("RequiredTarget", enemy.enabled && enemy.required);
	enemy.model.SetAttribute("Health", enemy.health);
}
function activateGround(session: CombatSession): void {
	for (const enemy of session.enemies) {
		if (enemy.kind !== "ground" || enemy.enabled) continue;
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
function spawnAir(session: CombatSession, count: number, required: boolean, ace = false, nameOverride?: string, aceHealth?: number): void {
	const forward = directionFor(session.state);
	const right = new Vector3(-forward.Z, 0, forward.X);
	for (let index = 0; index < count; index++) {
		const name = nameOverride ?? (ace ? "VANTA ACE" : `${required ? "VANTA" : "RAIDER"} 0${index + 1}`);
		const model = JetFactory.Create(name, true);
		// The first mesh generation may yield; completion/exit can occur meanwhile.
		if (!session.active || session.folder.Parent === undefined) { model.Destroy(); return; }
		const offset = forward.mul(850 + index * 100).add(right.mul((index - (count - 1) / 2) * 250));
		const spawn = positionFor(session.state).add(offset);
		const position = new Vector3(math.clamp(spawn.X, -2400, 2400), math.clamp(spawn.Y + 80 + index * 25, 230, 900), math.clamp(spawn.Z, -2400, 2400));
		const direction = unitOr(positionFor(session.state).sub(position).add(right.mul(150)), forward.mul(-1));
		model.Parent = session.folder;
		model.PivotTo(CFrame.lookAt(position, position.add(direction)));
		const health = ace ? (aceHealth ?? 165) : 100;
		const enemy: Enemy = {
			id: `air_${session.enemies.size() + 1}`, name, model, health,
			position, direction, velocity: direction.mul(300), kind: ace ? "ace" : "air", required, enabled: true,
			fireTimer: 8 + index * 3, windup: 0, passRemaining: 0, passDirection: direction,
			hiddenParts: [], warning: attackWarning(model),
		};
		markTarget(session, enemy);
		session.enemies.push(enemy);
	}
}

function navigationMarker(session: CombatSession, position: Vector3, index: number): Model {
	const model = new Instance("Model");
	model.Name = `ROUTE GATE ${index + 1}`;
	model.SetAttribute("LastTideNavigation", true);
	const root = new Instance("Part");
	root.Name = "Root"; root.Size = new Vector3(10, 10, 10); root.Transparency = 1; root.Anchored = true;
	root.CanCollide = false; root.CanTouch = false; root.CanQuery = false; root.CFrame = new CFrame(position); root.Parent = model; model.PrimaryPart = root;
	for (const offset of [-1, 1]) {
		const bar = new Instance("Part");
		bar.Name = "GateArc"; bar.Size = new Vector3(10, 100, 10); bar.Anchored = true; bar.CanCollide = false; bar.CanTouch = false; bar.CanQuery = false;
		bar.Material = Enum.Material.Neon; bar.Color = Color3.fromRGB(75, 234, 211); bar.Transparency = index === 0 ? 0.12 : 0.68;
		bar.CFrame = new CFrame(position.add(new Vector3(offset * 54, 0, 0))); bar.Parent = model;
	}
	for (const offset of [-1, 1]) {
		const bar = new Instance("Part");
		bar.Name = "GateRail"; bar.Size = new Vector3(118, 10, 10); bar.Anchored = true; bar.CanCollide = false; bar.CanTouch = false; bar.CanQuery = false;
		bar.Material = Enum.Material.Neon; bar.Color = Color3.fromRGB(75, 234, 211); bar.Transparency = index === 0 ? 0.12 : 0.68;
		bar.CFrame = new CFrame(position.add(new Vector3(0, offset * 44, 0))); bar.Parent = model;
	}
	const label = new Instance("BillboardGui"); label.Name = "RouteLabel"; label.Adornee = root; label.Size = UDim2.fromOffset(150, 28); label.StudsOffsetWorldSpace = new Vector3(0, 62, 0); label.AlwaysOnTop = true; label.MaxDistance = 3000; label.Parent = model;
	const text = new Instance("TextLabel"); text.Size = UDim2.fromScale(1, 1); text.BackgroundTransparency = 1; text.Font = Enum.Font.GothamBold; text.Text = `ROUTE ${index + 1}`; text.TextColor3 = Color3.fromRGB(108, 244, 226); text.TextStrokeTransparency = 0.35; text.TextSize = 15; text.Parent = label;
	model.Parent = session.folder;
	return model;
}

function clearNavigation(session: CombatSession): void {
	for (const marker of session.navigationTargets) marker.Destroy();
	session.navigationTargets.clear();
	session.navigationPhase = undefined;
}

function beginNavigation(session: CombatSession, phase: MissionPhase, phaseIndex: number): void {
	clearNavigation(session);
	assert(phase.route !== undefined && phase.route.size() === phase.required, `Mission ${session.rules.missionId} navigation phase ${phaseIndex} route mismatch`);
	for (let index = 0; index < phase.route.size(); index++) {
		const point = phase.route[index];
		session.navigationTargets.push(navigationMarker(session, new Vector3(point[0], point[1], point[2]), index));
	}
	session.navigationPhase = phaseIndex;
}

function applyPhase(session: CombatSession): void {
	if (!shouldApplyCombatPhase(session.appliedPhase, session.rules.phase, session.rules.outcome !== undefined)) return;
	session.appliedPhase = session.rules.phase;
	clearNavigation(session);
	const deployment = getCombatPhasePlan(session.rules.missionId, session.rules.phase);
	if (deployment !== undefined) {
		if (deployment.activateAllGround) activateGround(session);
		else if (deployment.groundCount > 0) activateGroundSubset(session, deployment.groundCount);
		if (deployment.requiredAir > 0) spawnAir(session, deployment.requiredAir, true);
		if (deployment.optionalAir > 0) spawnAir(session, deployment.optionalAir, false);
		if (deployment.aceCount > 0) spawnAir(session, deployment.aceCount, true, true, undefined, deployment.aceHealth);
		if (deployment.kind === "nav" && deployment.phaseIndex !== undefined) {
			const phaseDef = getMission(session.rules.missionId).phases[deployment.phaseIndex];
			beginNavigation(session, phaseDef, deployment.phaseIndex);
		}
	}
	acquireTarget(session);
}

function stepMissionObjective(session: CombatSession, dt: number): void {
	if (session.rules.missionId < 3 || session.rules.outcome !== undefined) return;
	const mission = getMission(session.rules.missionId);
	const phase = mission.phases[session.rules.phaseIndex];
	if (phase?.kind === "nav") {
		const index = math.floor(session.rules.phaseProgress);
		const marker = session.navigationTargets[index];
		if (marker?.Parent === session.folder && marker.GetPivot().Position.sub(positionFor(session.state)).Magnitude <= 145) {
			marker.Destroy();
			MissionRules.AdvanceObjective(session.rules, "nav", 1, os.clock());
			if (session.rules.outcome !== undefined) { finish(session); return; }
			if (session.rules.phaseIndex !== session.navigationPhase) applyPhase(session);
			else {
				const nextMarker = session.navigationTargets[index + 1];
				if (nextMarker) for (const item of nextMarker.GetDescendants()) if (item.IsA("BasePart") && item.Name !== "Root") item.Transparency = 0.12;
			}
		}
	} else if (phase?.kind === "hold") {
		MissionRules.AdvanceObjective(session.rules, "hold", dt, os.clock());
		if (session.rules.outcome !== undefined) { finish(session); return; }
		if (session.appliedPhase !== session.rules.phase) applyPhase(session);
	}
}

/**
 * Activates up to `count` ground targets that are currently inactive. This lets
 * multi-step missions reveal ground targets in waves while leaving the rest
 * invisible until their phase arrives.
 */
function activateGroundSubset(session: CombatSession, count: number): void {
	let activated = 0;
	for (const enemy of session.enemies) {
		if (activated >= count) return;
		if (enemy.kind !== "ground" || enemy.enabled) continue;
		enemy.enabled = true;
		for (const hidden of enemy.hiddenParts) hidden.part.Transparency = hidden.transparency;
		enemy.hiddenParts.clear();
		markTarget(session, enemy);
		activated += 1;
	}
}
function destroyEnemy(session: CombatSession, enemy: Enemy): void {
	if (!ownsEnemy(session, enemy)) return;
	const accepted = MissionRules.RecordKill(session.rules, enemy.id, enemy.kind, enemy.required, os.clock());
	session.elapsed = session.rules.elapsed;
	if (!accepted) { if (session.rules.outcome !== undefined) finish(session); return; }
	enemy.health = 0;
	enemy.enabled = false;
	enemy.model.SetAttribute("Health", 0);
	enemy.model.SetAttribute("SkybreakEnemy", false);
	enemy.model.SetAttribute("RequiredTarget", false);
	JetFactory.Burst(session.folder, enemy.position, Color3.fromRGB(255, 169, 87), enemy.kind === "ground" ? 26 : 12);
	enemy.model.Destroy();
	session.kills = session.rules.requiredAirKills + session.rules.optionalAirKills + session.rules.aceKills;
	applyPhase(session);
	if (session.target === enemy || !ownsEnemy(session, session.target)) acquireTarget(session);
	if (session.rules.outcome !== undefined) finish(session);
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
		if (!MissionRules.CanDamage(session.rules, session.target.kind, session.target.required)) return;
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
	for (let index = 0; index < session.enemies.size(); index++) {
		const enemy = session.enemies[index];
		if (!ownsEnemy(session, enemy) || enemy.kind === "ground") continue;
		const ace = enemy.kind === "ace";
		const separation = playerPosition.sub(enemy.position).Magnitude;
		const speed = math.clamp(session.state.speed + (ace ? 48 : 24), ace ? 320 : 285, ace ? 380 : 350);
		enemy.passRemaining = math.max(0, enemy.passRemaining - dt);
		if (separation < 280 && enemy.passRemaining <= 0) {
			// Commit to a straight pass, then reacquire; no permanent overlap or orbit.
			enemy.passRemaining = ace ? 2 : 2.6;
			enemy.passDirection = unitOr(enemy.direction.add(playerForward.mul(0.2)), enemy.direction);
		}
		const lead = math.clamp(separation / (speed + session.state.speed), 0.35, 1.8);
		const lateral = new Vector3(-playerForward.Z, 0, playerForward.X);
		const weave = math.sin(session.elapsed * (ace ? 1.7 : 0.65) + index * 1.8) * (ace ? 125 : 45);
		const destination = playerPosition.add(playerVelocity.mul(lead)).add(lateral.mul(weave)).add(new Vector3(0, ace ? math.sin(session.elapsed * 1.4) * 65 : 25, 0));
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
			// Shared spacing prevents five optional fighters from firing a phone-unfriendly volley.
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
			// Hostile missiles commit after a short tracking period, so steering alone can evade.
			if (!missile.hostile || missile.age < 1.1) missile.direction = unitOr(missile.direction.Lerp(unitOr(delta, missile.direction), FlightMath.DampAlpha(missile.hostile ? 0.65 : 7, dt)), missile.direction);
			const nextPosition = missile.position.add(missile.direction.mul(speed * dt));
			if (segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile ? 18 : 32)) {
				removed = true;
				JetFactory.Burst(session.folder, targetPosition, Color3.fromRGB(255, 179, 102), missile.hostile ? 6 : 8);
				if (missile.hostile) {
					if (session.evadeRemaining <= 0) session.health = math.max(0, session.health - 10);
				} else if (MissionRules.CanDamage(session.rules, missile.target!.kind, missile.target!.required)) {
					const enemy = missile.target!;
					if (enemy.health <= 55) {
						// Remove this projectile before a final kill can begin asynchronous cleanup.
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
		if (!refreshSession(session, os.clock())) return;
	}
}
function stepSession(session: CombatSession, dt: number): void {
	if (!refreshSession(session, os.clock())) return;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeCooldown = math.max(0, session.evadeCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	session.regen += dt;
	if (session.regen >= 2.5) { session.regen -= 2.5; session.missiles = math.min(MAX_MISSILES, session.missiles + 1); }
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; }
	MissionRules.ObserveControls(session.rules, session.input.x, session.input.y, dt, os.clock());
	if (session.rules.outcome !== undefined) { finish(session); return; }
	applyPhase(session);
	FlightMath.Step(session.state, session.input, dt);
	let flightFrame = frameFor(session.state);
	if (session.evadeRemaining > 0) flightFrame = flightFrame.mul(CFrame.Angles(0, 0, (1 - session.evadeRemaining / 2.1) * math.pi * 2));
	session.aircraft.PivotTo(flightFrame);
	stepMissionObjective(session, dt);
	if (!session.active) return;
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
		if (!FlightMath.IsFinite(missionId) || missionId % 1 !== 0 || missionId < 1 || missionId > MISSION_COUNT) return $tuple(false, `Choose a mission from 1 to ${MISSION_COUNT}`);
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
			const world = MissionWorld.Build(missionId, folder);
			assert(player.Parent === Players, "Player left during world construction");
			const expectedTargets = missionId === 1 ? 1 : missionId === 2 ? 5 : getMission(missionId).targets.size();
			assert(world.groundTargets.size() === expectedTargets, "Mission world has an incorrect ground target count");
			const aircraft = JetFactory.Create("SKYBREAK - Kestrel", false);
			assert(player.Parent === Players, "Player left during aircraft construction");
			aircraft.SetAttribute("SkybreakOwner", player.UserId);
			aircraft.SetAttribute("SkybreakPlayer", true);
			aircraft.Parent = folder;
			const state = FlightMath.NewState();
			aircraft.PivotTo(frameFor(state));
			const session: CombatSession = {
				player, slot, folder, aircraft, state, rules: MissionRules.NewState(missionId, startedAt), nextHostileAt: 8,
				input: { x: 0, y: 0, throttle: 0.65 }, health: 100, kills: 0, elapsed: 0,
				missiles: MAX_MISSILES, missileCooldown: 0, evadeCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
				enemies: [], projectiles: [], navigationTargets: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
				lastActionEvent: -math.huge, active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
			};
			for (const model of world.groundTargets) {
				assert(model.Parent === folder && model.PrimaryPart !== undefined, "Ground target must have a stationary aim center in its session");
				const kindAttr = model.GetAttribute("LastTideKind");
				const groundHealth = kindAttr === "corvette" ? 70 : kindAttr === "sam" ? 45 : 55;
				const enemy: Enemy = {
					id: `ground_${session.enemies.size() + 1}`, name: model.Name, model, health: groundHealth,
					position: model.PrimaryPart.Position, direction: new Vector3(0, 0, -1), velocity: Vector3.zero,
					kind: "ground", required: true, enabled: false, fireTimer: 0, windup: 0,
					passRemaining: 0, passDirection: new Vector3(0, 0, -1), hiddenParts: [],
				};
				// Hide ground models until their phase activates; mission 1's tutorial reveals its radar
				// only after the player cycles target, and 3-27 missions reveal ground models in waves.
				const hideInitially = missionId === 1 || missionId >= 3;
				for (const item of model.GetDescendants()) {
					if (item.IsA("BasePart")) {
						item.Anchored = true; item.CanCollide = false; item.CanTouch = false; item.CanQuery = false;
						if (hideInitially) { enemy.hiddenParts.push({ part: item, transparency: item.Transparency }); item.Transparency = 1; }
					}
				}
				markTarget(session, enemy);
				session.enemies.push(enemy);
			}
			applyPhase(session);
			sessions.set(player, session);
			player.ReplicationFocus = aircraft.PrimaryPart;
			const characterRoot = player.Character?.FindFirstChild("HumanoidRootPart");
			if (characterRoot?.IsA("BasePart")) {
				session.characterRoot = characterRoot; session.wasAnchored = characterRoot.Anchored; characterRoot.Anchored = true;
			}
			missionState!.FireClient(player, { kind: "Started", slot, missionId, aircraft });
			if (refreshSession(session, os.clock())) sendTelemetry(session);
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
			if (!session?.active || !typeIs(payload, "table")) return;
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
			if (!refreshSession(session, now) || now - session.lastActionEvent < 0.09) return;
			session.lastActionEvent = now;
			if (data.action === "FireMissile") launchMissile(session, false);
			else if (data.action === "Evade") evade(session);
			else if (data.action === "CycleTarget") cycleTarget(session);
		}));
		connections.push(Players.PlayerRemoving.Connect((player) => CombatService.EndMission(player)));
		let accumulator = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			// Check every heartbeat, including ones too small for a step or too long to catch up.
			const now = os.clock();
			for (const [, session] of sessions) refreshSession(session, now);
			if (!FlightMath.IsFinite(dt) || dt <= 0) return;
			accumulator = math.min(accumulator + dt, FIXED_STEP * 5);
			while (accumulator >= FIXED_STEP) {
				accumulator -= FIXED_STEP;
				for (const [, session] of sessions) if (session.active) stepSession(session, FIXED_STEP);
			}
		}));
	},
};
