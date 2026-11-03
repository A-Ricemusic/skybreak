// Server adapters for AlliedRules: wingman spawn, station keeping, target selection and allied fire control.
// Extracted from CombatService; `spawnAir` stays there and arrives as a callback.
import { Workspace } from "@rbxts/services";
import * as FinaleDuelRuntime from "./FinaleDuelRuntime";
import { AlliedRules } from "../shared/AlliedRules";
import { CombatBalance } from "../shared/CombatBalance";
import { JetFactory } from "../shared/JetFactory";
import { ThreatRules } from "../shared/ThreatRules";
import { WeaponRules } from "../shared/WeaponRules";
import { AVOID_RANGE, AVOID_EVERY } from "./SessionTuning";
import { frameFor, positionFor, directionFor, unitOr, point, canHurt, steerAircraft } from "./SessionQueries";
import type { SpawnOptions } from "./PhaseDirector";
import type { CombatSession, Enemy, AirRole } from "./CombatSession";

export type SpawnAir = (session: CombatSession, count: number, role: AirRole, options?: SpawnOptions) => void;

export function liveWingman(session: CombatSession, ally: Enemy): boolean {
	return ally.friendly === true && ally.enabled && ally.health > 0 && ally.model.Parent === session.folder;
}
export function nearestWingman(session: CombatSession, hostile: Enemy): Enemy | undefined {
	if (FinaleDuelRuntime.duelActive(session)) return undefined;
	if (hostile.kind === "ace" || hostile.role === "courier") return undefined;
	const playerDistance = positionFor(session.state).sub(hostile.position).Magnitude;
	const current = hostile.combatTarget;
	if (
		current !== undefined &&
		liveWingman(session, current) &&
		AlliedRules.HostileTargetsWingman(
			hostile.kind,
			hostile.role,
			playerDistance,
			current.position.sub(hostile.position).Magnitude,
			true,
		)
	)
		return current;
	let nearest: Enemy | undefined;
	let distance = math.huge;
	for (const ally of session.allies) {
		const range = ally.position.sub(hostile.position).Magnitude;
		if (liveWingman(session, ally) && range < distance) {
			distance = range;
			nearest = ally;
		}
	}
	return nearest !== undefined &&
		AlliedRules.HostileTargetsWingman(hostile.kind, hostile.role, playerDistance, distance, false)
		? nearest
		: undefined;
}
/** Director calls this once: casualties persist across phases, no respawn. */
export function spawnAllies(session: CombatSession, spawnAir: SpawnAir): void {
	const policy = session.blueprint?.allies;
	if (!policy || session.alliesSpawned) return;
	session.alliesSpawned = true;
	const frame = frameFor(session.state);
	for (let index = 0; index < AlliedRules.Count(policy); index++) {
		const offset = policy.formation[index];
		const position = frame.PointToWorldSpace(new Vector3(offset.x, offset.y, offset.z));
		spawnAir(session, 1, "raider", {
			friendly: true,
			optional: true,
			name: `${policy.callsignPrefix} ${index + 1}`,
			pose: { position: point(position), facing: point(directionFor(session.state)) },
		});
	}
}
export function stepAllies(session: CombatSession, dt: number, weaponsEnabled = true): void {
	const policy = session.blueprint?.allies;
	if (!policy) return;
	const player = positionFor(session.state);
	const frame = frameFor(session.state);
	let inFlight = 0;
	for (const missile of session.projectiles) if (missile.allied) inFlight += 1;
	for (let index = 0; index < session.allies.size(); index++) {
		const ally = session.allies[index];
		if (!liveWingman(session, ally)) continue;
		const offset = policy.formation[index];
		const station = frame.PointToWorldSpace(new Vector3(offset.x, offset.y, offset.z));
		let target: Enemy | undefined;
		let range = AlliedRules.Range;
		if (
			weaponsEnabled &&
			AlliedRules.BudgetRemaining(policy, session.alliedKills.size()) &&
			ally.position.sub(player).Magnitude < AlliedRules.Leash
		)
			for (const enemy of session.enemies) {
				const distance = enemy.position.sub(ally.position).Magnitude;
				if (
					distance < range &&
					AlliedRules.CanEngage(policy, enemy, weaponsEnabled) &&
					canHurt(session, enemy)
				) {
					target = enemy;
					range = distance;
				}
			}
		const destination = target ? target.position.add(target.velocity.mul(math.min(range / 600, 0.65))) : station;
		let desired = unitOr(destination.sub(ally.position), directionFor(session.state));
		if (
			(session.stepCount + index) % AVOID_EVERY === 0 &&
			session.collisionParams &&
			Workspace.Raycast(ally.position, ally.direction.mul(AVOID_RANGE), session.collisionParams)
		)
			ally.pullUpUntil = session.elapsed + 0.8;
		if ((ally.pullUpUntil ?? 0) > session.elapsed) desired = unitOr(desired.add(new Vector3(0, 2, 0)), desired);
		if (target && range < 280)
			desired = unitOr(ally.direction.add(frame.RightVector.mul(index % 2 === 0 ? 1 : -1)), ally.direction);
		ally.direction = steerAircraft(ally.direction, desired, 2.1, dt);
		const speed = target
			? math.clamp(session.state.speed + 24, 285, CombatBalance.banditSpeedCap)
			: AlliedRules.FormationSpeed(session.state.speed, station.sub(ally.position).Magnitude);
		ally.velocity = ally.direction.mul(speed);
		const moved = ally.position.add(ally.velocity.mul(dt));
		ally.position = new Vector3(
			math.clamp(moved.X, -session.airspace.spawnLimit, session.airspace.spawnLimit),
			math.max(170, moved.Y),
			math.clamp(moved.Z, -session.airspace.spawnLimit, session.airspace.spawnLimit),
		);
		ally.frame = CFrame.lookAt(ally.position, ally.position.add(ally.direction));
		ally.fireTimer = math.max(0, ally.fireTimer - dt);
		if (
			target &&
			(ally.alliedAmmo ?? 0) > 0 &&
			inFlight < AlliedRules.MaxInFlight &&
			session.elapsed - session.alliedFireAt >= AlliedRules.FlightSpacing &&
			ThreatRules.MayFire({
				separation: range,
				aimDot: ally.direction.Dot(unitOr(target.position.sub(ally.position), ally.direction)),
				fireTimer: ally.fireTimer,
				globalReady: true,
				evading: false,
				playerStraight: false,
				minRange: 300,
				maxRange: 1800,
				aimThreshold: 0.9,
				straightRelax: 0,
			})
		) {
			const position = ally.position.add(ally.direction.mul(18));
			session.projectiles.push({
				part: JetFactory.CreateMissile(session.folder, position, ally.direction, false),
				position,
				direction: ally.direction,
				target,
				hostile: false,
				allied: true,
				age: 0,
				ace: false,
				damage: math.random() < AlliedRules.HitChance ? AlliedRules.Damage : 0,
				speed: WeaponRules.MissileSpeed,
			});
			ally.alliedAmmo = (ally.alliedAmmo ?? 0) - 1;
			ally.fireTimer = AlliedRules.Reload;
			session.alliedFireAt = session.elapsed;
			inFlight += 1;
		}
	}
}
