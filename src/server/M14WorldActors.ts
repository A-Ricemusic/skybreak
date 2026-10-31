import type { CombatSession } from "./CombatSession";
/** Claim the authored inventory model, never leave a second frozen missile/fighter in the sky. */
export function claimM14WorldActor(s:CombatSession,id:string):Model|undefined {
 if(s.missionId!==14) return undefined;
 const actor=s.folder.FindFirstChild(id,true);
 if(!actor?.IsA("Model")) return undefined;
 actor.ClearAllChildren();actor.Parent=s.folder;return actor;
}
