/**
 * Read-only selectors over authoritative AC04 flight records for the interface. They never alter
 * progress: unlock rules come from ac04Unlocked and the aircraft milestones, exactly as the server
 * enforces them. Story selectors reproduce the campaign's mandatory-chapter sequencing.
 */
import { AC04Aircraft, type AC04AircraftSpec } from "../../AC04Aircraft";
import { AC04MissionData } from "../../AC04MissionData";
import { AC04_MISSION_COUNT, AC04_RELEASE_MISSION_CEILING, type AC04Slot, ac04InitialReleaseComplete, ac04ReleaseDestination, ac04Unlocked } from "../../AC04Progress";
import { AC04Story, type AC04StoryChapter, ac04ChaptersFor } from "../AC04Story";

export interface AC04RecordSummary {
	index: number;
	/** Next mission the record may fly (the first incomplete one, or 18 once all are complete). */
	nextMission: number;
	nextTitle: string;
	completed: number;
	aircraft: string;
	chaptersSeen: number;
	/** No mission completed and no chapter acknowledged. */
	empty: boolean;
	campaignComplete: boolean;
	initialReleaseComplete: boolean;
}

export function ac04CompletedCount(slot: AC04Slot): number {
	let count = 0;
	for (let id = 1; id <= AC04_MISSION_COUNT; id++) if (slot.missions[id]?.completed === true) count++;
	return count;
}

export function ac04RecordSummary(slot: AC04Slot): AC04RecordSummary {
	const completed = ac04CompletedCount(slot), destination = ac04ReleaseDestination(slot);
	return {
		index: slot.index, nextMission: destination, nextTitle: AC04MissionData.Get(destination).title, completed,
		aircraft: slot.aircraft, chaptersSeen: slot.seen.size(),
		empty: completed === 0 && slot.seen.size() === 0, campaignComplete: completed === AC04_MISSION_COUNT,
		initialReleaseComplete: ac04InitialReleaseComplete(slot),
	};
}

/** Record CONTINUE resumes: the most recently updated record, else record 1. `fresh` when none has activity. */
export function ac04ContinueRecord(slots: readonly AC04Slot[]): { index: number; fresh: boolean } {
	let best: AC04Slot | undefined;
	for (const slot of slots) {
		if (slot.updatedAt <= 0 && ac04CompletedCount(slot) === 0 && slot.seen.size() === 0) continue;
		if (best === undefined || slot.updatedAt > best.updatedAt) best = slot;
	}
	return best === undefined ? { index: 1, fresh: true } : { index: best.index, fresh: false };
}

export interface AC04MissionRow {
	id: number; title: string; completed: boolean; locked: boolean; preparing: boolean;
	bestScore?: number; bestTime?: number;
}

/** All 18 missions in order with authoritative lock state and saved bests. */
export function ac04MissionRows(slot: AC04Slot): AC04MissionRow[] {
	const unlocked = ac04Unlocked(slot);
	return AC04MissionData.All().map((mission) => {
		const record = slot.missions[mission.id];
		const completed = record?.completed === true;
		const preparing = mission.id > AC04_RELEASE_MISSION_CEILING;
		return {
			id: mission.id, title: mission.title, completed, preparing, locked: preparing || mission.id > unlocked,
			bestScore: completed ? record.bestScore : undefined, bestTime: completed ? record.bestTime : undefined,
		};
	});
}

/** A chapter is unlocked when it precedes the campaign or its triggering mission is complete. */
export function ac04ChapterUnlocked(slot: AC04Slot, chapter: AC04StoryChapter): boolean {
	return chapter.trigger.event === "beforeCampaign" || slot.missions[chapter.trigger.missionId ?? 18]?.completed === true;
}

/** Story archive entries: unlocked chapters in campaign order. */
export function ac04StoryArchive(slot: AC04Slot): AC04StoryChapter[] {
	return AC04Story.filter((chapter) => ac04ChapterUnlocked(slot, chapter));
}

/** Unlocked chapters the record has not acknowledged. These must play before the destination launch. */
export function ac04PendingChapters(slot: AC04Slot): string[] {
	return AC04Story.filter((chapter) => !slot.seen.includes(chapter.id) && ac04ChapterUnlocked(slot, chapter)).map((chapter) => chapter.id);
}

/** Chapters that follow a successful mission (plus the epilogue after 18), minus those already seen. */
export function ac04ChaptersAfterSuccess(missionId: number, seen: readonly string[]): string[] {
	const chapters = [...ac04ChaptersFor("afterMissionSuccess", missionId), ...(missionId === AC04_MISSION_COUNT ? ac04ChaptersFor("epilogue", AC04_MISSION_COUNT) : [])];
	return chapters.filter((chapter) => !seen.includes(chapter.id)).map((chapter) => chapter.id);
}

export interface AC04AircraftRow {
	spec: AC04AircraftSpec;
	available: boolean;
	/** Why a locked aircraft cannot be chosen; undefined when available. */
	lockedReason?: string;
}

/** Whether the record may fly this aircraft (the same milestone rule the server checks). */
export function ac04AircraftAvailable(slot: AC04Slot, spec: AC04AircraftSpec): boolean {
	return spec.afterMission === 0 || (spec.afterMission <= AC04_MISSION_COUNT && slot.missions[spec.afterMission]?.completed === true);
}

/** Every catalog aircraft with its availability. Prices are deliberately not exposed: no shop exists. */
export function ac04AircraftRows(slot: AC04Slot): AC04AircraftRow[] {
	return AC04Aircraft.map((spec) => {
		const available = ac04AircraftAvailable(slot, spec);
		return {
			spec, available,
			lockedReason: available ? undefined : spec.afterMission > AC04_MISSION_COUNT ? "Not available in this campaign" : `Available after Mission ${spec.afterMission < 10 ? "0" : ""}${spec.afterMission}`,
		};
	});
}

/** Index of the aircraft `delta` steps away among available rows only, wrapping. */
export function ac04CycleAircraft(rows: readonly AC04AircraftRow[], current: string, delta: number): string {
	const available = rows.filter((row) => row.available);
	if (available.size() === 0) return current;
	const index = available.findIndex((row) => row.spec.id === current);
	const step = delta < 0 ? -1 : 1;
	const destination = index < 0 ? 0 : (index + step + available.size()) % available.size();
	return available[destination].spec.id;
}
