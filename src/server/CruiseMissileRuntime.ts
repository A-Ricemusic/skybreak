// Server adapters for CruiseMissileRules: cruise actors, occlusion and kills.
import { claimM14WorldActor } from "./M14WorldActors";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { BomberRoute, BomberRules } from "../shared/BomberRules";
import {
	CruiseBudget,
	CruiseState,
	cruiseComplete,
	cruiseDestroyed,
	cruiseRadar,
	cruiseRoute,
	newCruiseStates,
} from "../shared/CruiseMissileRules";
import { finiteNumber } from "../shared/LandingRules";
import { PauseRules } from "../shared/SessionGuard";
import { sphereSweep } from "../shared/SphereSweep";
import type { CombatSession, Enemy } from "./CombatSession";
export interface CruiseRuntime {
	phase: number;
	elapsed: number;
	states: CruiseState[];
	routes: BomberRoute[];
	actors: Map<number, Enemy>;
}
/** Each ray stays below Roblox's 15,000-stud limit, including float rounding. */
export function cruiseOccluded(origin: Vector3, destination: Vector3, params: RaycastParams): boolean {
	const delta = destination.sub(origin);
	const distance = delta.Magnitude;
	if (distance < 0.01) return false;
	for (let offset = 0; offset < distance; offset += 14000)
		if (
			Workspace.Raycast(
				origin.add(delta.Unit.mul(offset)),
				delta.Unit.mul(math.min(14000, distance - offset)),
				params,
			)
		)
			return true;
	return false;
}
function retire(session: CombatSession, enemy: Enemy): void {
	enemy.enabled = false;
	enemy.health = 0;
	enemy.model.Destroy();
	if (session.target === enemy) {
		session.target = undefined;
		session.lockProgress = 0;
	}
	// No refunds, score or kill callbacks at separation/cleanup.
	for (let i = session.projectiles.size() - 1; i >= 0; i--)
		if (session.projectiles[i].target === enemy) {
			session.projectiles[i].part.Destroy();
			session.projectiles.remove(i);
		}
}
export function clearCruise(session: CombatSession): void {
	if (session.cruise) for (const [, enemy] of session.cruise.actors) retire(session, enemy);
	session.cruise = undefined;
}
function createCruise(session: CombatSession, index: number): Enemy {
	const runtime = session.cruise!;
	const plan = BlueprintRunner.ActivePhase(session.blueprintState!)!.cruiseIntercept!;
	const target = plan.targets[index];
	const model = claimM14WorldActor(session, target.id) ?? new Instance("Model");
	const aim = new Instance("Part");
	model.Name = target.separateSeconds === undefined ? "CRUISE" : "CARRIER";
	aim.Name = "Aim";
	aim.Size = new Vector3(8, 6, 24);
	aim.Anchored = true;
	aim.CanCollide = false;
	aim.CanTouch = false;
	aim.CanQuery = true;
	aim.Material = Enum.Material.Neon;
	aim.Color = Color3.fromRGB(240, 110, 65);
	aim.Parent = model;
	model.PrimaryPart = aim;
	const slot = BomberRules.Sample(runtime.routes[index], 0).slots[0];
	const position = new Vector3(slot.position.x, slot.position.y, slot.position.z);
	const direction = new Vector3(slot.facing.x, slot.facing.y, slot.facing.z);
	const floor =
		session.collisionParams &&
		Workspace.Raycast(new Vector3(position.X, 4096, position.Z), new Vector3(0, -8192, 0), session.collisionParams);
	const grounded = new Vector3(
		position.X,
		math.max(position.Y, (floor?.Position.Y ?? position.Y) + CruiseBudget.clearance),
		position.Z,
	);
	model.PivotTo(CFrame.lookAt(grounded, grounded.add(direction)));
	model.Parent = session.folder;
	for (const [key, value] of pairs({
		SkybreakEnemy: true,
		SkybreakOwner: session.player.UserId,
		TargetKind: "air",
		RequiredTarget: true,
		Damageable: true,
		Health: CruiseBudget.health,
		RadarDetected: false,
	}))
		model.SetAttribute(key, value);
	const enemy: Enemy = {
		id: target.id,
		name: model.Name,
		model,
		health: CruiseBudget.health,
		maxHealth: CruiseBudget.health,
		kind: "air",
		role: "bomber",
		cruiseTarget: true,
		scoreRole: target.scoreRole,
		phaseOwner: runtime.phase,
		attackSector: "cruise_site",
		position: grounded,
		direction,
		velocity: direction.mul(target.speed),
		required: true,
		enabled: true,
		fireTimer: math.huge,
		windup: 0,
		mode: "run",
		modeTimer: 0,
		passDirection: direction,
		side: 1,
		flares: 0,
		flareTimer: 0,
		flareUntil: 0,
		speedBonus: 0,
		lockBreakTimer: 0,
		breakTimer: 0,
		breakUntil: 0,
		lockBreakChance: 0,
		hiddenParts: [],
	};
	session.enemies.push(enemy);
	return enemy;
}
/** Settle a weapon kill immediately, so a later clock tick cannot steal an already completed intercept. */
export function cruiseKilled(session: CombatSession, enemy: Enemy): void {
	const blueprintState = session.blueprintState;
	const runtime = session.cruise;
	const plan = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.cruiseIntercept;
	if (!enemy.cruiseTarget || !blueprintState || !runtime || !plan || runtime.phase !== blueprintState.phaseIndex)
		return;
	for (const [index, actor] of runtime.actors) if (actor === enemy) cruiseDestroyed(plan, runtime.states, index);
	blueprintState.phaseProgress = runtime.states
		.filter((state) => state.status === "destroyed" || state.status === "cancelled" || state.status === "separated")
		.size();
	if (cruiseComplete(runtime.states)) {
		BlueprintRunner.ResolveCruise(blueprintState, true);
		clearCruise(session);
	}
}
/** Called only on live simulation time; endpoint impact is resolved before same-frame weapon hits. */
export function stepCruise(session: CombatSession, dt: number): void {
	const blueprintState = session.blueprintState;
	const plan = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.cruiseIntercept;
	if (
		!plan ||
		!blueprintState ||
		(session.cruise && session.cruise.phase !== blueprintState.phaseIndex) ||
		!session.active ||
		session.cleaned ||
		blueprintState.outcome !== undefined
	)
		clearCruise(session);
	if (
		!plan ||
		!blueprintState ||
		!session.active ||
		session.cleaned ||
		blueprintState.outcome !== undefined ||
		session.loading ||
		session.launch ||
		session.rearmElapsed !== undefined ||
		session.cutInElapsed !== undefined ||
		blueprintState.landingElapsed !== undefined ||
		PauseRules.Paused(session.pause) ||
		!finiteNumber(dt) ||
		dt <= 0
	)
		return;
	if (!session.collisionParams) {
		session.crashReason = "internal_error";
		return;
	}
	if (!session.cruise)
		session.cruise = {
			phase: blueprintState.phaseIndex,
			elapsed: 0,
			states: newCruiseStates(plan),
			routes: plan.targets.map(cruiseRoute),
			actors: new Map(),
		};
	const runtime = session.cruise;
	runtime.elapsed += dt;
	for (let i = 0; i < plan.targets.size(); i++) {
		const target = plan.targets[i];
		const state = runtime.states[i];
		let enemy = runtime.actors.get(i);
		if (state.status === "active" && enemy && enemy.health <= 0) cruiseDestroyed(plan, runtime.states, i);
		if (
			state.status === "waiting" &&
			target.parentId === undefined &&
			runtime.elapsed >= (target.arrivalSeconds ?? 0)
		) {
			state.status = "active";
			enemy = createCruise(session, i);
			runtime.actors.set(i, enemy);
			state.elapsed = -math.max(0, (target.arrivalSeconds ?? 0) - (runtime.elapsed - dt));
		}
		if (state.status !== "active" || !enemy) continue;
		const previous = enemy.position;
		state.elapsed += dt;
		const pose = BomberRules.Sample(runtime.routes[i], state.elapsed).slots[0];
		// Waypoint Y is a minimum cruise altitude; actual terrain/water owns the floor.
		const floor = Workspace.Raycast(
			new Vector3(pose.position.x, 4096, pose.position.z),
			new Vector3(0, -8192, 0),
			session.collisionParams,
		);
		if (!floor) {
			session.crashReason = "internal_error";
			return;
		}
		enemy.position = new Vector3(
			pose.position.x,
			math.max(pose.position.y, floor.Position.Y + CruiseBudget.clearance),
			pose.position.z,
		);
		if (sphereSweep(previous, 4, enemy.position.sub(previous), session.collisionParams)) {
			session.crashReason = "internal_error";
			return;
		}
		enemy.direction =
			enemy.position.sub(previous).Magnitude > 0.01 ? enemy.position.sub(previous).Unit : enemy.direction;
		enemy.velocity = enemy.direction.mul(target.speed);
		enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction));
		const player = new Vector3(session.state.x, session.state.y, session.state.z);
		const distance = player.sub(enemy.position).Magnitude;
		const detected = cruiseRadar(
			distance,
			enemy.position.Y - floor.Position.Y,
			distance <= CruiseBudget.radarRange && !cruiseOccluded(player, enemy.position, session.collisionParams),
		);
		modelRadar(enemy, detected);
		if (target.separateSeconds !== undefined && state.elapsed >= target.separateSeconds) {
			state.status = "separated";
			retire(session, enemy);
			for (let j = 0; j < plan.targets.size(); j++)
				if (plan.targets[j].parentId === target.id) {
					runtime.states[j].status = "active";
					runtime.actors.set(j, createCruise(session, j));
					runtime.states[j].elapsed = -dt;
				}
		} else if (state.elapsed >= runtime.routes[i].duration) {
			state.status = "impact";
			BlueprintRunner.ResolveCruise(blueprintState, false);
			clearCruise(session);
			return;
		}
	}
	blueprintState.phaseProgress = runtime.states
		.filter((state) => state.status === "destroyed" || state.status === "cancelled" || state.status === "separated")
		.size();
	if (cruiseComplete(runtime.states)) {
		BlueprintRunner.ResolveCruise(blueprintState, true);
		clearCruise(session);
	}
}
function modelRadar(enemy: Enemy, detected: boolean): void {
	enemy.model.SetAttribute("RadarDetected", detected);
}
