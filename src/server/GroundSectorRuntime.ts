// Server adapters for GroundSectorRules: ground director actors and beach attackers.
import { closedBridgeRoute } from "./LeaderWithdrawalRuntime";
import { releaseZoneReserves } from "./RepairReserveRuntime";
import { surfacePose } from "../shared/SurfaceTargetRules";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import {
	SquadAttackRules,
	squadStrikeReachable,
	attackSectorIndex,
	damageSector,
	groundProgressPose,
	newGroundProgress,
	SectorState,
	stepGroundProgress,
} from "../shared/GroundSectorRules";
import { finiteNumber } from "../shared/LandingRules";
import { PauseRules } from "../shared/SessionGuard";
import type { CombatSession, Enemy } from "./CombatSession";
export interface GroundDirectorRuntime {
	phase: number;
	states: SectorState[];
	folder: Folder;
	actors: BasePart[];
}
export function clearGroundDirector(session: CombatSession): void {
	session.groundDirector?.folder.Destroy();
	session.groundDirector = undefined;
}
function running(session: CombatSession): boolean {
	return (
		session.active &&
		!session.cleaned &&
		!session.loading &&
		!session.launch &&
		session.rearmElapsed === undefined &&
		session.cutInElapsed === undefined &&
		!PauseRules.Paused(session.pause) &&
		session.blueprintState?.outcome === undefined &&
		session.blueprintState?.landingElapsed === undefined
	);
}
/** Owned below the session folder; creation only from the live simulation after the world/launch gate. */
export function stepGroundDirector(session: CombatSession, dt: number, say: (line: string) => void): void {
	const blueprintState = session.blueprintState;
	const plan = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.groundProgress;
	if (
		!plan ||
		!blueprintState ||
		(session.groundDirector && session.groundDirector.phase !== blueprintState.phaseIndex)
	)
		clearGroundDirector(session);
	if (!plan || !blueprintState || !running(session) || !finiteNumber(dt) || dt <= 0) return;
	if (!session.groundDirector) {
		const folder = new Instance("Folder");
		folder.Name = "Friendly ground force";
		folder.Parent = session.folder;
		const actors = plan.sectors.map((sector) => {
			const part = new Instance("Part");
			part.Name = sector.id;
			part.Size =
				sector.kind === "landing_craft"
					? new Vector3(24, 8, 55)
					: sector.kind === "column"
						? new Vector3(12, 8, 25)
						: new Vector3(10, 5, 12);
			part.Color = Color3.fromRGB(75, 160, 130);
			part.Anchored = true;
			part.CanCollide = false;
			part.CanTouch = false;
			part.CanQuery = false;
			part.SetAttribute("Friendly", true);
			part.SetAttribute("SectorId", sector.id);
			part.Parent = folder;
			return part;
		});
		session.groundDirector = { phase: blueprintState.phaseIndex, states: newGroundProgress(plan), folder, actors };
	}
	const runtime = session.groundDirector;
	const cleared = new Set<string>();
	for (const id of blueprintState.killedIds) cleared.add(id);
	if (session.retiredGroundIds) for (const id of session.retiredGroundIds) cleared.add(id);
	const closed = new Set<string>();
	for (const sector of plan.sectors) if (closedBridgeRoute(session, sector.id, "sector")) closed.add(sector.id);
	for (const line of stepGroundProgress(plan, runtime.states, cleared, dt, closed)) say(line);
	releaseZoneReserves(session);
	for (let i = 0; i < plan.sectors.size(); i++) {
		const sector = plan.sectors[i];
		const state = runtime.states[i];
		const pose = groundProgressPose(sector, state);
		const actor = runtime.actors[i];
		actor.CFrame = new CFrame(pose.x, pose.y, pose.z).mul(
			CFrame.Angles(0, math.rad(surfacePose(sector.route, state.elapsed).yaw), 0),
		);
		actor.SetAttribute("Health", state.health);
		actor.SetAttribute("Secured", state.secured);
		actor.SetAttribute("Progress", state.elapsed / sector.seconds);
		if (state.health <= 0) {
			blueprintState.outcome = "failed";
			blueprintState.reason = "protected_lost";
		}
	}
}
/** Returns true for an opted-in attacker, even if its sector is no longer available. No player fallback.
 * A visible two-second attack warning precedes one server LOS strike, then an eight-second reload.
 * Aircraft continue using the normal player weapon/once-only kill ledger; friendlies never award score.
 */
export function stepBeachAttacker(
	session: CombatSession,
	enemy: Enemy,
	dt: number,
	say: (line: string) => void,
): boolean {
	if (enemy.attackSector === undefined) return false;
	if (!running(session) || !finiteNumber(dt) || dt <= 0) return true;
	const plan = session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.groundProgress;
	const runtime = session.groundDirector;
	const index =
		plan && runtime && enemy.phaseOwner === runtime.phase
			? attackSectorIndex(plan, runtime.states, enemy.attackSector)
			: undefined;
	if (index === undefined || !plan || !runtime) {
		enemy.windup = 0;
		enemy.model.SetAttribute("AttackWarning", false);
		if (enemy.warning) enemy.warning.Enabled = false;
		return true;
	}
	const sector = plan.sectors[index];
	const state = runtime.states[index];
	const pose = groundProgressPose(sector, state);
	const target = new Vector3(pose.x, pose.y, pose.z);
	const station = target.add(new Vector3(0, 240, 0));
	const delta = station.sub(enemy.position);
	const distance = target.sub(enemy.position).Magnitude;
	// Fly repeated passes over the force at a safe band; existing terrain probes keep scenery ahead clear.
	let desired = delta.Magnitude > 1 ? delta.Unit : enemy.direction;
	if (distance < 400) desired = enemy.direction.add(new Vector3(0, 0.3, 0)).Unit;
	if (session.collisionParams && Workspace.Raycast(enemy.position, enemy.direction.mul(250), session.collisionParams))
		desired = new Vector3(desired.X, 1, desired.Z).Unit;
	enemy.direction = enemy.direction.Lerp(desired, math.clamp(dt * 1.5, 0, 1)).Unit;
	enemy.velocity = enemy.direction.mul(SquadAttackRules.speed);
	enemy.position = enemy.position.add(enemy.velocity.mul(dt));
	enemy.position = new Vector3(
		math.clamp(enemy.position.X, -session.airspace.spawnLimit, session.airspace.spawnLimit),
		math.clamp(enemy.position.Y, 170, 2000),
		math.clamp(enemy.position.Z, -session.airspace.spawnLimit, session.airspace.spawnLimit),
	);
	enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction));
	enemy.fireTimer = math.max(0, enemy.fireTimer - dt);
	if (enemy.windup > 0) {
		enemy.windup = math.max(0, enemy.windup - dt);
		if (enemy.windup <= 0) {
			enemy.model.SetAttribute("AttackWarning", false);
			if (enemy.warning) enemy.warning.Enabled = false;
			enemy.fireTimer = SquadAttackRules.reload;
			if (
				session.collisionParams &&
				squadStrikeReachable(
					distance,
					Workspace.Raycast(enemy.position, target.sub(enemy.position), session.collisionParams) !==
						undefined,
				)
			) {
				if (damageSector(state, SquadAttackRules.damage)) say(sector.hitCall);
				if (state.health <= 0 && session.blueprintState) {
					session.blueprintState.outcome = "failed";
					session.blueprintState.reason = "protected_lost";
				}
			}
		}
	} else if (enemy.fireTimer <= 0 && distance <= SquadAttackRules.range) {
		enemy.windup = SquadAttackRules.warning;
		enemy.model.SetAttribute("AttackWarning", true);
		if (enemy.warning) enemy.warning.Enabled = true;
	}
	return true;
}
