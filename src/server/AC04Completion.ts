import { AC04MissionData } from "../shared/AC04MissionData";
import { ac04Finite } from "../shared/AC04Progress";
import { MissionStats } from "../shared/Types";
import { AC04PersistenceState } from "./AC04Persistence";
export interface AC04CompletionState extends AC04PersistenceState { active?: { slot: number; mission: number } }
/** Synchronous, server-owned settlement capture. No datastore call or scheduling may precede this. */
export function ac04CaptureCompletion(state: AC04CompletionState, won: boolean, stats: MissionStats, timestamp: number): boolean | undefined {
	const active = state.active;
	if (!active) return undefined;
	const definition = AC04MissionData.Get(active.mission);
	let maxSeconds = 0; for (const phase of definition.phases) maxSeconds += phase.seconds;
	const valid = stats.campaignId === "ac04" && stats.slot === active.slot && stats.missionId === active.mission
		&& ac04Finite(stats.elapsed) && stats.elapsed > 0 && stats.elapsed <= maxSeconds + 2
		&& ac04Finite(stats.score) && stats.score >= 0 && stats.score < 1000000;
	// Consume exactly once before any persistence operation can yield.
	state.active = undefined;
	if (won && valid) {
		const slot = state.profile.slots[active.slot - 1], prior = slot.missions[active.mission];
		slot.missions[active.mission] = { completed: true, bestScore: math.max(prior?.bestScore ?? 0, stats.score!), bestTime: math.min(prior?.bestTime ?? math.huge, stats.elapsed) };
		slot.updatedAt = timestamp; state.dirty = true;
	}
	return valid;
}
