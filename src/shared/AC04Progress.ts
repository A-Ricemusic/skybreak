import { AC04Aircraft } from "./AC04Aircraft";
import { AC04MissionData } from "./AC04MissionData";
// Fresh AC04 records only; no earlier save store is read or migrated.
export const AC04_CAMPAIGN_ID = "ac04";
export const AC04_MISSION_COUNT = 18;
/** Initial owner-test release. Raising this later does not change the save schema or erase records. */
export const AC04_RELEASE_MISSION_CEILING = 5;
export interface AC04Record { completed: boolean; bestScore: number; bestTime: number }
export interface AC04Slot {
	index: number; missions: { [id: number]: AC04Record }; seen: string[];
	aircraft: string; updatedAt: number;
}
export interface AC04Profile { version: number; slots: AC04Slot[] }
export interface AC04Response {
	ok: boolean; error?: string; slots?: AC04Slot[];
	persistence?: "cloud" | "session" | "unavailable";
}
export const AC04_AIRCRAFT = AC04Aircraft.map((a) => a.id);
export function ac04Finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge;
}
export function ac04ValidMission(value: unknown): value is number {
	return ac04Finite(value) && value % 1 === 0 && value >= 1 && value <= AC04_MISSION_COUNT;
}
export function ac04MissionAvailable(value: unknown): value is number {
	return ac04ValidMission(value) && value <= AC04_RELEASE_MISSION_CEILING;
}
export function ac04InitialReleaseComplete(slot: AC04Slot): boolean {
	for (let id = 1; id <= AC04_RELEASE_MISSION_CEILING; id++) if (!slot.missions[id]?.completed) return false;
	return true;
}
/** Destination for the current release: sequential progress through M5, then replay M5. */
export function ac04ReleaseDestination(slot: AC04Slot): number {
	return math.min(AC04_RELEASE_MISSION_CEILING, ac04Unlocked(slot));
}
function onlyFields(raw: object, allowed: string[]): boolean {
	for (const [key] of pairs(raw)) if (!typeIs(key, "string") || !allowed.includes(key)) return false;
	return true;
}
/** Persistence accepts absence, or a complete losslessly normalizable v1 record. */
export function ac04Readable(raw: unknown): boolean {
	if (raw === undefined) return true;
	if (!typeIs(raw, "table")) return false;
	const profile = raw as AC04Profile;
	if (!onlyFields(profile, ["version", "slots"]) || profile.version !== 1 || !typeIs(profile.slots, "table")) return false;
	let count = 0;
	for (const [key, value] of pairs(profile.slots)) {
		if (!typeIs(key, "number") || key % 1 !== 0 || key < 1 || key > 4 || !typeIs(value, "table")) return false;
		count++;
	}
	if (count !== 4) return false;
	for (let i = 0; i < 4; i++) {
		const slot = profile.slots[i];
		if (!onlyFields(slot, ["index", "missions", "seen", "aircraft", "updatedAt"]) || slot.index !== i + 1 || !typeIs(slot.missions, "table") || !typeIs(slot.seen, "table")
			|| !typeIs(slot.aircraft, "string") || !AC04_AIRCRAFT.includes(slot.aircraft)
			|| !ac04Finite(slot.updatedAt) || slot.updatedAt < 0) return false;
		const ids = new Set<number>();
		for (const [key, value] of pairs(slot.missions)) {
			const id = typeIs(key, "string") ? tonumber(key) : key;
			if (!ac04ValidMission(id) || (typeIs(key, "string") && key !== tostring(id)) || ids.has(id) || !typeIs(value, "table")) return false;
			ids.add(id);
			const record = value as AC04Record;
			if (!onlyFields(record, ["completed", "bestScore", "bestTime"]) || record.completed !== true || !ac04Finite(record.bestScore) || record.bestScore < 0 || record.bestScore % 1 !== 0 || record.bestScore > 1000000
				|| !ac04Finite(record.bestTime) || record.bestTime <= 0 || record.bestTime > AC04MissionData.MaximumSeconds(id) + 2) return false;
		}
		let seenCount = 0;
		const seen = new Set<string>();
		for (const [key, chapter] of pairs(slot.seen)) {
			if (!typeIs(key, "number") || key % 1 !== 0 || key < 1 || key > 12 || !typeIs(chapter, "string")
				|| chapter.match("^ac04%-i%d%d$")[0] === undefined || (tonumber(chapter.sub(7)) ?? 0) < 1
				|| (tonumber(chapter.sub(7)) ?? 99) > 12 || seen.has(chapter)) return false;
			seen.add(chapter); seenCount++;
		}
		// Reject holes and extra dictionary keys instead of truncating the array.
		for (let j = 0; j < seenCount; j++) if (slot.seen[j] === undefined) return false;
	}
	return true;
}
export function ac04BlankSlot(index: number): AC04Slot { return { index, missions: {}, seen: [], aircraft: "F-4E", updatedAt: 0 }; }
export function ac04BlankProfile(): AC04Profile { return { version: 1, slots: [1, 2, 3, 4].map(ac04BlankSlot) }; }
export function ac04Unlocked(slot: AC04Slot): number {
	for (let id = 1; id <= AC04_MISSION_COUNT; id++) if (!slot.missions[id]?.completed) return id;
	return AC04_MISSION_COUNT;
}
export function ac04Normalize(raw: unknown): AC04Profile {
	const profile = ac04BlankProfile();
	if (!typeIs(raw, "table")) return profile;
	const source = raw as { slots?: unknown };
	if (!typeIs(source.slots, "table")) return profile;
	const slots = source.slots as unknown[];
	for (let index = 0; index < 4; index++) {
		const input = slots[index]; if (!typeIs(input, "table")) continue;
		const entry = input as { missions?: unknown; seen?: unknown; aircraft?: unknown; updatedAt?: unknown };
		const slot = profile.slots[index];
		if (typeIs(entry.missions, "table")) for (let id = 1; id <= 18; id++) {
			const m = (entry.missions as { [key: number]: unknown })[id] ?? (entry.missions as { [key: string]: unknown })[tostring(id)];
			if (!typeIs(m, "table")) continue;
			const r = m as { completed?: unknown; bestScore?: unknown; bestTime?: unknown };
			if (r.completed === true && ac04Finite(r.bestTime) && r.bestTime > 0 && r.bestTime <= AC04MissionData.MaximumSeconds(id) + 2 && ac04Finite(r.bestScore) && r.bestScore >= 0 && r.bestScore <= 1000000)
				slot.missions[id] = { completed: true, bestScore: math.floor(r.bestScore), bestTime: r.bestTime };
		}
		if (typeIs(entry.seen, "table")) for (const item of entry.seen as unknown[]) {
			if (typeIs(item, "string") && item.match("^ac04%-i%d%d$")[0] !== undefined && (tonumber(item.sub(7)) ?? 0) >= 1 && (tonumber(item.sub(7)) ?? 99) <= 12 && !slot.seen.includes(item) && slot.seen.size() < 12) slot.seen.push(item);
		}
		if (typeIs(entry.aircraft, "string") && AC04_AIRCRAFT.includes(entry.aircraft)) slot.aircraft = entry.aircraft;
		if (ac04Finite(entry.updatedAt)) slot.updatedAt = math.max(0, entry.updatedAt);
	}
	return profile;
}
/** Monotonic merge preserves another server's progress. No destructive slot operation is exposed. */
export function ac04Merge(remote: unknown, localProfile: AC04Profile): AC04Profile {
	assert(ac04Readable(remote), "Unsupported AC04 save schema; refusing to overwrite it");
	const out = ac04Normalize(remote);
	for (let i = 0; i < 4; i++) {
		const a = out.slots[i], b = localProfile.slots[i];
		for (let id = 1; id <= 18; id++) {
			const r = b.missions[id]; if (!r?.completed) continue;
			const old = a.missions[id];
			a.missions[id] = { completed: true, bestScore: math.max(old?.bestScore ?? 0, r.bestScore), bestTime: math.min(old?.bestTime ?? math.huge, r.bestTime) };
		}
		for (const id of b.seen) if (!a.seen.includes(id)) a.seen.push(id);
		if (b.updatedAt >= a.updatedAt) { a.aircraft = b.aircraft; a.updatedAt = b.updatedAt; }
	}
	return out;
}
