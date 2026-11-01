// Server-side targeting for one sortie: which contacts are candidates, whether
// terrain or flight-solid scenery blocks the line of sight (cached per enemy),
// automatic acquisition and re-acquisition. Explicit selection and the TGT cycle
// stay in CombatService because they notify the phase director.
import { positionFor, point, ownsEnemy, targetMetrics, sessionCanDamage } from "./SessionQueries";
import { ventObstructed } from "../shared/FinaleDuelRules";
import { TargetPriority, type TargetCandidate, type ViewFrustum } from "../shared/TargetPriority";
import * as RearmRuntime from "./RearmRuntime";
import { CombatSession, Enemy } from "./CombatSession";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { WeaponRules } from "../shared/WeaponRules";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { AceRules } from "../shared/AceRules";

/** Longest line-of-sight ray; anything farther is out of every envelope and is never checked. */
const LOS_MAX_RANGE = 5000;
/** The ray stops just short of the aim point; a ground target is aimed at the top of its bounding box and hits inside its footprint are ignored. */
const LOS_MARGIN = 5;
const LOS_FOOTPRINT_PAD = 10;
/** Where the line-of-sight ray aims and the horizontal radius inside which a hit is the target's own ground, not cover. */
export function losAim(enemy: Enemy): LuaTuple<[Vector3, number]> {
	if (enemy.kind !== "ground") return $tuple(enemy.position, 0);
	const [frame, size] = enemy.model.GetBoundingBox();
	return $tuple(frame.Position.add(new Vector3(0, size.Y / 2, 0)), math.max(size.X, size.Z) / 2 + LOS_FOOTPRINT_PAD);
}
/** Terrain and flight-solid scenery block the view; aircraft and targets (enemy or friendly models) do not. */
export function occludes(hit: RaycastResult): boolean {
	let node: Instance | undefined = hit.Instance;
	while (node !== undefined) {
		if (node.IsA("Model") && (node.GetAttribute("SkybreakEnemy") !== undefined || node.GetAttribute("SkybreakFriendly") !== undefined)) return false;
		node = node.Parent;
	}
	return true;
}
/** Cached per enemy and refreshed at most every TargetPriority.LosInterval, so a TGT burst or a kill chain never fans out into raycasts every frame. */
export function enclosedPhase(session:CombatSession):boolean {
 const d=session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.finale;
 return d?.vent!==undefined || d?.enclosed===true;
}
export function lineOfSightBlocked(session: CombatSession, enemy: Enemy): boolean {
 if(session.blueprintState && enclosedPhase(session)) {
  return ventObstructed(session.state,point(enemy.position),(o,d)=>{
   const hit=Workspace.Raycast(new Vector3(o.x,o.y,o.z),new Vector3(d.x,d.y,d.z),session.collisionParams);
   return hit && !hit.Instance.IsDescendantOf(enemy.model) && occludes(hit) ? hit.Distance : undefined;
  });
 }

	if (enemy.losAt !== undefined && session.elapsed - enemy.losAt < TargetPriority.LosInterval) return enemy.losBlocked === true;
	enemy.losAt = session.elapsed;
	const origin = positionFor(session.state);
	const [aim, footprint] = losAim(enemy);
	const delta = aim.sub(origin);
	const length = math.min(delta.Magnitude, LOS_MAX_RANGE) - LOS_MARGIN;
	let blocked = false;
	if (length > 0 && session.collisionParams !== undefined) {
		const hit = Workspace.Raycast(origin, delta.Unit.mul(length), session.collisionParams);
		if (hit !== undefined && occludes(hit)) {
			const dx = hit.Position.X - aim.X, dz = hit.Position.Z - aim.Z;
			blocked = footprint <= 0 || dx * dx + dz * dz > footprint * footprint;
		}
	}
	enemy.losBlocked = blocked;
	return blocked;
}
/**
 * Every targetable contact as the shared priority sees it. With a `view` (a TGT press) each contact also
 * learns whether the player sees its box: inside the camera frustum and, under jamming, within visual
 * range. Line of sight is checked for the leading few only: nose-leading for acquisition, nearest on
 * screen for a press.
 */
export function targetCandidates(session: CombatSession, view?: ViewFrustum): TargetCandidate[] {
	const candidates: TargetCandidate[] = [];
	const lockRange = SpecialWeapons.LockRange(session.special);
	const jamming = session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.jamming;
	const visualRange = view !== undefined && jamming && RearmRuntime.liveJammers(session) > 0 ? jamming.visualLockRange : undefined;
	const camera = view === undefined ? undefined : new Vector3(view.position.x, view.position.y, view.position.z);
	for (let id = 0; id < session.enemies.size(); id++) {
		const enemy = session.enemies[id];
		if (!ownsEnemy(session, enemy)) continue;
		const [distance, dot] = targetMetrics(session, enemy);
		// An ace that has broken off to call its wing is neither required nor worth the nose until it turns back in;
		// anything this phase protects (a raider over the kill cap, a ground target during an air phase) is held too.
		const retreatingAce = enemy.aceState !== undefined && !AceRules.Fights(enemy.aceState);
		const candidate: TargetCandidate = {
			id, distance, dot,
			required: enemy.required && !retreatingAce,
			held: retreatingAce || !sessionCanDamage(session, enemy.kind, enemy.required),
			inRange: distance <= WeaponRules.EnvelopeRange(lockRange, enemy.kind === "ground"),
		};
		if (view !== undefined && camera !== undefined) {
			const withinVisual = visualRange === undefined || enemy.position.sub(camera).Magnitude <= visualRange;
			candidate.onScreen = withinVisual && TargetPriority.InView(view, point(enemy.position));
		}
		candidates.push(candidate);
	}
	if(session.blueprintState && enclosedPhase(session)) {
		for(let i=candidates.size()-1;i>=0;i--) if(lineOfSightBlocked(session,session.enemies[candidates[i].id])) candidates.remove(i);
	}
	const checks = view === undefined ? TargetPriority.LosChecks(candidates) : TargetPriority.PressLosChecks(candidates);
	for (const candidate of checks) candidate.blocked = lineOfSightBlocked(session, session.enemies[candidate.id]);
	return candidates;
}
/** Automatic acquisition: the nose-best contact. The lock survives when that is still the current target. */
export function acquireTarget(session: CombatSession): void {
	const bestId = TargetPriority.Best(targetCandidates(session));
	const best = bestId === undefined ? undefined : session.enemies[bestId];
	if (session.target !== best) { session.target = best; session.lockProgress = 0; }
}
/** Phase entries and spawns keep a still-valid target; only a lost one is replaced. */
export function retargetIfLost(session: CombatSession): void {
	if (!ownsEnemy(session, session.target)) acquireTarget(session);
}
