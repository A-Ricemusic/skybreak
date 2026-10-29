import { MissionCatalog, MISSION_COUNT } from "./MissionCatalog";
import { SaveSlot } from "./Types";

/** Missions unlock in order: mission N is unlocked when mission N-1 is complete, or N === 1. */
export function highestUnlocked(slot?: SaveSlot): number {
	let unlocked = 1;
	for (let id = 1; id < MISSION_COUNT; id++) {
		if (MissionCatalog.Available(id + 1) && slot?.missions?.[id]?.completed === true) unlocked = id + 1;
		else break;
	}
	return unlocked;
}

/** Shared release/progression guard, including the optional always-open practice. */
export function canLaunchMission(id: unknown, slot?: SaveSlot): boolean {
 return MissionCatalog.IsValidId(id) && MissionCatalog.Available(id) && (id === 0 || id <= highestUnlocked(slot));
}
