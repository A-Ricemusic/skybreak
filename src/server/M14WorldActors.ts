import type { CombatSession } from "./CombatSession";
/** Claim the authored inventory model, never leave a second frozen missile/fighter in the sky. */
export function claimM14WorldActor(session: CombatSession, id: string): Model | undefined {
	if (session.missionId !== 14) return undefined;
	const actor = session.folder.FindFirstChild(id, true);
	if (!actor?.IsA("Model")) return undefined;
	actor.ClearAllChildren();
	actor.Parent = session.folder;
	return actor;
}
