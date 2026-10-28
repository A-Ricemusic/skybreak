import { MISSION_COUNT } from "./MissionCatalog";
import { SaveSlot } from "./Types";

/** Missions unlock in order: mission N is unlocked when mission N-1 is complete, or N === 1. */
export function highestUnlocked(slot?: SaveSlot): number {
	let unlocked = 1;
	for (let id = 1; id < MISSION_COUNT; id++) {
		if (slot?.missions?.[id]?.completed === true) unlocked = id + 1;
		else break;
	}
	return unlocked;
}
