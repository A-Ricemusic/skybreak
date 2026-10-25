import { Players, RunService, Workspace } from "@rbxts/services";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { JetFactory } from "../shared/JetFactory";
import { FinishedCallback, FlightInput, Remotes, Telemetry } from "../shared/Types";

interface Enemy {
	name: string; model: Model; health: number; position: Vector3;
	direction: Vector3; velocity: Vector3; angle: number; fireTimer: number;
}
interface Projectile {
	part: Part; position: Vector3; direction: Vector3; target?: Enemy; hostile: boolean; age: number;
}
export interface CombatSession {
	player: Player; slot: number; folder: Folder; aircraft: Model; state: FlightState; input: FlightInput;
	health: number; kills: number; elapsed: number; missiles: number; missileCooldown: number;
	evadeCooldown: number; evadeRemaining: number; regen: number; lockProgress: number;
	enemies: Enemy[]; projectiles: Projectile[]; target?: Enemy; telemetryTime: number;
	lastInput: number; lastInputEvent: number; lastActionEvent: number; active: boolean; finished: boolean;
	previousReplicationFocus?: BasePart; characterRoot?: BasePart; wasAnchored?: boolean;
}
const sessions = new Map<Player, CombatSession>();
const connections: RBXScriptConnection[] = [];
let missionSerial = 0;
let missionRoot: Instance | undefined;
let missionState: RemoteEvent | undefined;
let onFinished: FinishedCallback | undefined;
const FIXED_STEP = 1 / 30;
const LOCK_RANGE = 2450;
const LOCK_DOT = math.cos(math.rad(62));
const MAX_MISSILES = 8;
const ENEMY_NAMES = ["VANTA 01", "VANTA 02", "VANTA 03"];
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
function alive(enemy: Enemy | undefined): enemy is Enemy {
	return enemy !== undefined && enemy.health > 0 && enemy.model.Parent !== undefined;
}
function ownsEnemy(session: CombatSession, enemy: Enemy | undefined): enemy is Enemy {
	return alive(enemy) && enemy.model.Parent === session.folder && enemy.model.GetAttribute("SkybreakOwner") === session.player.UserId;
}
function targetMetrics(session: CombatSession, enemy: Enemy): LuaTuple<[number, number]> {
	const delta = enemy.position.sub(positionFor(session.state));
	const distance = delta.Magnitude;
	return $tuple(distance, distance > 0.01 ? directionFor(session.state).Dot(delta.div(distance)) : 1);
}
function acquireTarget(session: CombatSession): void {
	let best: Enemy | undefined;
	let score: number | undefined;
	for (const enemy of session.enemies) {
		if (ownsEnemy(session, enemy)) {
			const [distance, dot] = targetMetrics(session, enemy);
			const candidateScore = distance + (dot < 0 ? 5000 : (1 - dot) * 700);
			if (score === undefined || candidateScore < score) { best = enemy; score = candidateScore; }
		}
	}
	session.target = best;
	session.lockProgress = 0;
}
function cycleTarget(session: CombatSession): void {
	const current = session.target === undefined ? -1 : session.enemies.indexOf(session.target);
	for (let offset = 1; offset <= session.enemies.size(); offset++) {
		const candidate = session.enemies[(current + offset) % session.enemies.size()];
		if (ownsEnemy(session, candidate)) { session.target = candidate; session.lockProgress = 0; return; }
	}
}
function sendTelemetry(session: CombatSession): void {
	if (session.player.Parent !== Players) return;
	let incoming = false;
	for (const missile of session.projectiles) {
		if (missile.hostile && missile.position.sub(positionFor(session.state)).Magnitude < 1500) { incoming = true; break; }
	}
	const target = ownsEnemy(session, session.target) ? session.target : undefined;
	const message: Telemetry = {
		kind: "Telemetry", health: session.health, speed: session.state.speed, altitude: session.state.y,
		kills: session.kills, total: 3, missiles: session.missiles, missileCooldown: session.missileCooldown,
		evadeCooldown: session.evadeCooldown, target: target?.model, targetName: target?.name ?? "",
		lockProgress: session.lockProgress, incoming, elapsed: session.elapsed,
	};
	missionState!.FireClient(session.player, message);
}
function finish(session: CombatSession, won: boolean): void {
	if (!session.active || session.finished) return;
	// Guard before the potentially yielding persistence callback.
	session.finished = true;
	session.active = false;
	for (const missile of session.projectiles) missile.part.Destroy();
	session.projectiles.clear();
	sendTelemetry(session);
	const stats = { kills: session.kills, elapsed: session.elapsed, slot: session.slot };
	const callback = onFinished!;
	task.spawn(() => {
		const [ok, message] = pcall(callback, session.player, won, stats);
		if (!ok) warn(`SKYBREAK mission completion callback: ${tostring(message)}`);
	});
}
function destroyEnemy(session: CombatSession, enemy: Enemy): void {
	if (!ownsEnemy(session, enemy)) return;
	enemy.health = 0;
	enemy.model.SetAttribute("Health", 0);
	JetFactory.Burst(session.folder, enemy.position, Color3.fromRGB(255, 169, 87), 12);
	enemy.model.Destroy();
	session.kills += 1;
	if (session.target === enemy) acquireTarget(session);
	if (session.kills === 3) finish(session, true);
}
function launchMissile(session: CombatSession, hostile: boolean, enemy?: Enemy): void {
	let position: Vector3;
	let direction: Vector3;
	let target: Enemy | undefined;
	if (hostile) {
		assert(enemy);
		position = enemy.position;
		direction = positionFor(session.state).sub(position).Unit;
	} else {
		if (session.lockProgress < 0.99 || !ownsEnemy(session, session.target)) return;
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
			missile.part.Destroy();
			session.projectiles.remove(index);
		}
	}
}
function stepEnemies(session: CombatSession, dt: number): void {
	for (let zeroIndex = 0; zeroIndex < session.enemies.size(); zeroIndex++) {
		const enemy = session.enemies[zeroIndex];
		const index = zeroIndex + 1;
		if (!alive(enemy)) continue;
		enemy.angle += dt * (0.19 + index * 0.012);
		const radius = 720 + index * 95;
		const destination = new Vector3(math.sin(enemy.angle) * radius + (index - 2) * 120,
			280 + index * 45 + math.sin(session.elapsed * 0.22 + index) * 65, -650 - math.cos(enemy.angle) * radius);
		const delta = destination.sub(enemy.position);
		const direction = delta.Magnitude > 0.01 ? delta.Unit : enemy.direction;
		const distance = math.min(delta.Magnitude, (170 + index * 6) * dt);
		const oldDirection = enemy.direction;
		enemy.direction = oldDirection.Lerp(direction, FlightMath.DampAlpha(1.8, dt)).Unit;
		enemy.position = enemy.position.add(enemy.direction.mul(distance));
		enemy.velocity = enemy.direction.mul(170 + index * 6);
		const bank = math.clamp(-oldDirection.Cross(enemy.direction).Y * 26, -0.6, 0.6);
		enemy.model.PivotTo(CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction)).mul(CFrame.Angles(0, 0, bank)));
		enemy.fireTimer -= dt;
		if (enemy.fireTimer <= 0) {
			enemy.fireTimer = 19 + index * 2;
			const separation = enemy.position.sub(positionFor(session.state)).Magnitude;
			if (separation < 1900 && separation > 240 && session.evadeRemaining <= 0) launchMissile(session, true, enemy);
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
		let removed = missile.age > 8 || !(missile.hostile || ownsEnemy(session, missile.target));
		if (!removed) {
			const targetPosition = missile.hostile ? positionFor(session.state) : missile.target!.position;
			const velocity = missile.hostile ? directionFor(session.state).mul(session.state.speed) : missile.target!.velocity;
			const speed = missile.hostile ? 420 : 650;
			const distance = targetPosition.sub(missile.position).Magnitude;
			const lead = missile.hostile ? 0.1 : math.clamp(distance / speed, 0, 0.65);
			const delta = targetPosition.add(velocity.mul(lead)).sub(missile.position);
			if (delta.Magnitude > 0.01) {
				const blended = missile.direction.Lerp(delta.Unit, FlightMath.DampAlpha(missile.hostile ? 1.7 : 7, dt));
				if (blended.Magnitude > 0.01) missile.direction = blended.Unit;
			}
			const nextPosition = missile.position.add(missile.direction.mul(speed * dt));
			if (segmentDistance(targetPosition, missile.position, nextPosition) < (missile.hostile ? 22 : 32)) {
				removed = true;
				JetFactory.Burst(session.folder, targetPosition, Color3.fromRGB(255, 179, 102), missile.hostile ? 6 : 8);
				if (missile.hostile) {
					if (session.evadeRemaining <= 0) session.health = math.max(0, session.health - 16);
				} else {
					const enemy = missile.target!;
					if (enemy.health <= 55) {
						// Remove this missile before the third kill clears all others.
						missile.part.Destroy();
						session.projectiles.remove(index);
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
}
function stepSession(session: CombatSession, dt: number): void {
	session.elapsed += dt;
	session.missileCooldown = math.max(0, session.missileCooldown - dt);
	session.evadeCooldown = math.max(0, session.evadeCooldown - dt);
	session.evadeRemaining = math.max(0, session.evadeRemaining - dt);
	session.regen += dt;
	if (session.regen >= 6) { session.regen -= 6; session.missiles = math.min(MAX_MISSILES, session.missiles + 1); }
	if (os.clock() - session.lastInput > 0.7) { session.input.x = 0; session.input.y = 0; }
	FlightMath.Step(session.state, session.input, dt);
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
	if (!session.active) return;
	if (session.health <= 0) {
		JetFactory.Burst(session.folder, positionFor(session.state), Color3.fromRGB(255, 139, 87), 14);
		finish(session, false); return;
	}
	session.telemetryTime += dt;
	if (session.telemetryTime >= 0.1) { session.telemetryTime -= 0.1; sendTelemetry(session); }
}

// Authoritative isolated missions. Clients supply controls, never hits or results.
export const CombatService = {
	EndMission(player: Player): void {
		const session = sessions.get(player);
		if (!session) return;
		sessions.delete(player);
		session.active = false;
		if (session.characterRoot?.Parent) session.characterRoot.Anchored = session.wasAnchored!;
		if (player.Parent === Players) player.ReplicationFocus = session.previousReplicationFocus;
		session.folder.Destroy();
	},
	GetSession(player: Player): CombatSession | undefined { return sessions.get(player); },
	IsActive(player: Player): boolean { return sessions.get(player)?.active ?? false; },
	StartMission(player: Player, slot: number): LuaTuple<[boolean, string?]> {
		if (!missionState || !onFinished) return $tuple(false, "CombatService is not initialized");
		if (!FlightMath.IsFinite(slot) || slot % 1 !== 0 || slot < 1 || slot > 4) return $tuple(false, "Choose a save slot from 1 to 4");
		if (!typeIs(player, "Instance") || !player.IsA("Player") || player.Parent !== Players) return $tuple(false, "Player is unavailable");
		CombatService.EndMission(player);
		missionSerial += 1;
		const folder = new Instance("Folder");
		folder.Name = `Mission_${player.UserId}_${missionSerial}`;
		folder.Parent = missionRoot;
		const aircraft = JetFactory.Create("SKYBREAK - Kestrel", false);
		aircraft.SetAttribute("SkybreakOwner", player.UserId);
		aircraft.SetAttribute("SkybreakPlayer", true);
		aircraft.Parent = folder;
		const state = FlightMath.NewState();
		aircraft.PivotTo(frameFor(state));
		const session: CombatSession = {
			player, slot, folder, aircraft, state, input: { x: 0, y: 0, throttle: 0.65 }, health: 100, kills: 0, elapsed: 0,
			missiles: MAX_MISSILES, missileCooldown: 0, evadeCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
			enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
			lastActionEvent: -math.huge, active: true, finished: false, previousReplicationFocus: player.ReplicationFocus,
		};
		player.ReplicationFocus = aircraft.PrimaryPart;
		const characterRoot = player.Character?.FindFirstChild("HumanoidRootPart");
		if (characterRoot?.IsA("BasePart")) {
			session.characterRoot = characterRoot; session.wasAnchored = characterRoot.Anchored; characterRoot.Anchored = true;
		}
		for (let zeroIndex = 0; zeroIndex < ENEMY_NAMES.size(); zeroIndex++) {
			const name = ENEMY_NAMES[zeroIndex];
			const index = zeroIndex + 1;
			const model = JetFactory.Create(name, true);
			model.SetAttribute("SkybreakEnemy", true);
			model.SetAttribute("SkybreakOwner", player.UserId);
			model.SetAttribute("Health", 100);
			model.Parent = folder;
			const position = new Vector3((index - 2) * 260, 270 + index * 40, 150 - index * 550);
			const direction = new Vector3(index % 2 === 0 ? 0.55 : -0.35, 0, -1).Unit;
			model.PivotTo(CFrame.lookAt(position, position.add(direction)));
			session.enemies.push({ name, model, health: 100, position, direction, velocity: direction.mul(170 + index * 6), angle: (index - 2) * 0.8, fireTimer: 16 + index * 5 });
		}
		sessions.set(player, session);
		acquireTarget(session);
		missionState.FireClient(player, { kind: "Started", slot, aircraft });
		sendTelemetry(session);
		return $tuple(true);
	},
	Init(remotes: Remotes | Instance, finishedCallback: FinishedCallback): void {
		assert(typeIs(finishedCallback, "function"), "CombatService.Init requires onFinished");
		for (const connection of connections) connection.Disconnect();
		connections.clear();
		for (const [player] of sessions) CombatService.EndMission(player);
		onFinished = finishedCallback;
		missionState = remote(remotes, "MissionState");
		missionRoot = Workspace.FindFirstChild("SkybreakCombat");
		if (!missionRoot) { missionRoot = new Instance("Folder"); missionRoot.Name = "SkybreakCombat"; missionRoot.Parent = Workspace; }
		connections.push(remote(remotes, "FlightInput").OnServerEvent.Connect((player, payload: unknown) => {
			const session = sessions.get(player);
			if (!session?.active || !typeIs(payload, "table")) return;
			const now = os.clock();
			if (now - session.lastInputEvent < 1 / 40) return;
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
			if (now - session.lastActionEvent < 0.09) return;
			session.lastActionEvent = now;
			if (data.action === "FireMissile") launchMissile(session, false);
			else if (data.action === "Evade") evade(session);
			else if (data.action === "CycleTarget") cycleTarget(session);
		}));
		connections.push(Players.PlayerRemoving.Connect((player) => CombatService.EndMission(player)));
		let accumulator = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			accumulator = math.min(accumulator + dt, FIXED_STEP * 5);
			while (accumulator >= FIXED_STEP) {
				accumulator -= FIXED_STEP;
				for (const [, session] of sessions) if (session.active) stepSession(session, FIXED_STEP);
			}
		}));
	},
};
