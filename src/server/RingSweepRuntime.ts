// Server adapters for RingSweepRules: ring sweep steps and elite retreat.
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { artilleryMasked, newArtillery, stepArtillery } from "../shared/ArtilleryRules";
import { inRingSweep } from "../shared/RingSweepRules";
import type { CombatSession } from "./CombatSession";
/** Studs per foot for the CLIMB ABOVE call-out, which reports the ring-battery ceiling in feet rather than studs. */
const STUDS_PER_FOOT = 0.292608;
/** Called in the active combat step only, after pause/cut-in/rearm gates. No world-owned instances. */
export function stepRingSweep(session: CombatSession, dt: number, say: (line: string) => void): void {
	const blueprintState = session.blueprintState;
	const sweep = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.ringSweep;
	if (!blueprintState || !sweep) {
		session.ringArtillery = undefined;
		return;
	}
	if (session.ringArtillery?.phase !== blueprintState.phaseIndex)
		session.ringArtillery = { phase: blueprintState.phaseIndex, state: newArtillery() };
	const state = session.ringArtillery!.state;
	// Reuse the canyon artillery timing and segmented masking (<=1,000 studs, never a >15,000-stud ray).
	const clock = { ...sweep, ceiling: sweep.ceiling ?? 2000, source: sweep.guns[0].source, channel: [], clearance: 1 };
	const event = stepArtillery(state, clock, dt);
	if (event.warning)
		say(
			sweep.ceiling !== undefined
				? `RING BATTERY · CLIMB ABOVE ${math.ceil(sweep.ceiling / STUDS_PER_FOOT)} FT`
				: "RING BATTERY · CLEAR THE FIRING LINE",
		);
	if (event.countdown) say(`RING SWEEP IN ${sweep.countdownSeconds} SECONDS`);
	if (!event.impact) return;
	for (const gun of sweep.guns) {
		const live = session.enemies.some(
			(enemy) =>
				enemy.id === gun.targetId &&
				enemy.enabled &&
				enemy.health > 0 &&
				enemy.phaseOwner === blueprintState.phaseIndex,
		);
		if (!live || !inRingSweep(sweep, gun, session.state)) continue;
		const masked =
			session.collisionParams !== undefined &&
			artilleryMasked(
				{ ...clock, source: gun.source },
				session.state,
				(origin, direction) =>
					Workspace.Raycast(
						new Vector3(origin.x, origin.y, origin.z),
						new Vector3(direction.x, direction.y, direction.z),
						session.collisionParams,
					)?.Distance,
			);
		if (masked) continue;
		const lost = math.min(session.health, sweep.damage);
		session.health -= lost;
		session.damageTaken += lost;
		session.lowestHealth = math.min(session.lowestHealth, session.health);
		break; // Overlapping gun lines never multiply one salvo's damage.
	}
}

/** Accepted elite defeat only. Surviving fighters depart without kill/score credit. */
export function completeEliteRetreat(session: CombatSession, withdraw: () => void, say: (line: string) => void): void {
	if (session.folder.GetAttribute("EliteRecoveryAnnounced") === true) return;
	session.folder.SetAttribute("EliteRecoveryAnnounced", true);
	session.folder.SetAttribute("VultureTwoRecovered", true);
	session.airQueue.clear();
	withdraw();
	for (let i = session.projectiles.size() - 1; i >= 0; i--)
		if (session.projectiles[i].hostile) {
			session.projectiles[i].part.Destroy();
			session.projectiles.remove(i);
		}
	say(
		session.missionId === 12
			? MISSION_STORY_TEXT[12].radio[2]
			: "VULTURE TWO EJECTED · RECOVERY DISPATCHED. ELITE FLIGHT WITHDRAWING.",
	);
}
