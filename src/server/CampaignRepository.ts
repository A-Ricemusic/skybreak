import { chapterBeforeMission } from "../shared/RelayStory";
import { readTargetScore, TargetScoreSnapshot } from "../shared/TargetScore";
import { GameConfig } from "../shared/GameConfig";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import { MissionRank, MissionScore, RANK_ORDER } from "../shared/MissionScore";
import { MissionFinished, MissionRecord, MissionStats, Persistence, SaveSlot, SlotDeletion } from "../shared/Types";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty } from "../shared/Difficulty";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";

export interface StoredMissionRecord {
	timeVersion?: unknown;
	completed?: unknown;
	bestTime?: unknown;
	firstCompletedAt?: unknown;
	bestScore?: unknown;
	bestTargetScore?: unknown;
	bestRank?: unknown;
}

export interface StoredSlot {
	occupied?: unknown;
	completed?: unknown;
	kills?: unknown;
	bestTime?: unknown;
	updatedAt?: unknown;
	currentMission?: unknown;
	mission1Completed?: unknown;
	mission2Completed?: unknown;
	mission1BestTime?: unknown;
	mission2BestTime?: unknown;
	/** v3 per-mission records keyed by stringified mission id. */
	missions?: Map<string, StoredMissionRecord> | Record<string, StoredMissionRecord>;
	introSeen?: unknown;
	cutscenesSeen?: unknown;
	generation?: unknown;
	/** Unique id of the deletion that started this generation (absent before any deletion and in legacy saves). */
	epoch?: unknown;
	/** Last special weapon equipped from this slot's briefing. */
	special?: unknown;
	/** Last difficulty chosen from this slot's briefing. */
	difficulty?: unknown;
}

export interface StoredProfile {
	version?: unknown;
	slots?: Map<string, StoredSlot> | StoredSlot[];
}

export interface CampaignProfile {
	version: number;
	slots: SaveSlot[];
}

export interface CampaignStore {
	load(key: string): unknown;
	update(key: string, transform: (current: unknown) => StoredProfile): unknown;
}

export interface CoordinatorOptions {
	clock?: () => number;
	wait?: () => void;
	defer?: (callback: () => void) => void;
	now?: () => number;
	maxAttempts?: number;
	retryWait?: (attempt: number) => void;
	warn?: (message: string) => void;
	/** Issues a unique deletion epoch id; defaults to HttpService:GenerateGUID. Injectable for deterministic specs. */
	newEpoch?: () => string;
	/** Phase-2 epoch conflict rules; defaults to DELETION_EPOCH_CONFLICTS (off). Specs exercise both phases. */
	epochConflicts?: boolean;
	/** Minimum seconds between deferred (non-flush) writes, measured from the last successful write. */
	writeSpacing?: number;
	/** Schedules a spaced write; flush/recover promote it to an immediate one. */
	delay?: (seconds: number, callback: () => void) => void;
}

/** Roblox throttles per-key writes at roughly one per six seconds; deferred saves coalesce up to that cadence. */
export const CAMPAIGN_WRITE_SPACING = 6;

export interface MissionResult {
	completed: boolean;
	missionId: number;
	kills: number;
	elapsed: number;
	/** Saved bests after this result, and whether this run raised them. */
	bestScore?: number;
	bestRank?: MissionRank;
	newBestScore?: boolean;
	newBestRank?: boolean;
}

/** Debrief score of a run, recorded into the mission's saved bests when the run completes. */
export interface MissionDebriefScore {
	targetScore?: TargetScoreSnapshot;
	score: number;
	rank: MissionRank;
}

const SLOT_COUNT = GameConfig.Campaign.SlotCount;
const MISSION_KILLS = GameConfig.Campaign.MaxRecordedKills;
const SAVE_VERSION = GameConfig.Campaign.SaveVersion;

/** A GUID is 36 characters; anything longer than this bound is not an epoch this game wrote. */
const MAX_EPOCH_LENGTH = 64;

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge;
}

function slotAt(rawSlots: Map<string, StoredSlot> | StoredSlot[], index: number): unknown {
	if (typeIs(rawSlots, "table")) {
		return (
			(rawSlots as unknown as Record<number, unknown>)[index] ??
			(rawSlots as unknown as Record<string, unknown>)[tostring(index)]
		);
	}
	return undefined;
}

function blankSlot(index: number): SaveSlot {
	return {
		index,
		occupied: false,
		completed: false,
		kills: 0,
		currentMission: 1,
		mission1Completed: false,
		mission2Completed: false,
		missions: {},
		introSeen: false,
		cutscenesSeen: [],
		generation: 0,
	};
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 0 && value <= MISSION_COUNT;
}

/** Resume at the lowest-numbered unfinished mission, or 1 for a fresh slot. */
function resumeMission(slot: SaveSlot): number {
	return highestUnlocked(slot);
}

export { highestUnlocked };

export function resolveMissionRequest(
	slot: SaveSlot,
	requested: unknown,
): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) requested = resumeMission(slot);
	if (!isValidMission(requested)) return $tuple(undefined, "Choose Practice or a mission (1-18).");

	if (!canLaunchMission(requested, slot)) {
		return $tuple(undefined, `Mission ${string.format("%02d", requested)} is locked or in development.`);
	}
	return $tuple(requested, undefined);
}

function fastest(left?: number, right?: number): number | undefined {
	if (left !== undefined && right !== undefined) return math.min(left, right);
	return left ?? right;
}

function highest(left?: number, right?: number): number | undefined {
	if (left !== undefined && right !== undefined) return math.max(left, right);
	return left ?? right;
}

function readScore(value: unknown): number | undefined {
	return isFiniteNumber(value) && value >= 0 ? math.floor(value) : undefined;
}

/** Sets the score bests on `record`, leaving absent ones absent. */
function copyBests(record: MissionRecord, bestScore?: number, bestRank?: string): MissionRecord {
	if (bestScore !== undefined) record.bestScore = bestScore;
	if (bestRank !== undefined && MissionScore.IsRank(bestRank)) record.bestRank = bestRank;
	return record;
}

function readMissionsMap(raw: unknown): { [missionId: number]: MissionRecord } {
	const result: { [missionId: number]: MissionRecord } = {};
	if (!typeIs(raw, "table")) return result;
	const map = raw as Record<string, unknown> & Map<string, unknown>;
	for (let id = 0; id <= MISSION_COUNT; id++) {
		const entry = (map as Record<string, unknown>)[tostring(id)] ?? (map as Record<number, unknown>)[id];
		if (!typeIs(entry, "table")) continue;
		const stored = entry as StoredMissionRecord;
		const record: MissionRecord = { completed: stored.completed === true };
		const timeVersion = MissionCatalog.TimeVersion(id);
		const best = id <= 2 || stored.timeVersion === timeVersion ? positiveTime(stored.bestTime) : undefined;
		record.timeVersion = timeVersion;
		if (best !== undefined) record.bestTime = best;
		const first = positiveTime(stored.firstCompletedAt);
		if (first !== undefined) record.firstCompletedAt = first;
		copyBests(
			record,
			readScore(stored.bestScore),
			MissionScore.IsRank(stored.bestRank) ? stored.bestRank : undefined,
		);
		const breakdown = readTargetScore(stored.bestTargetScore, record.bestScore);
		if (record.bestScore !== undefined && breakdown !== undefined) record.bestTargetScore = breakdown;
		if (record.completed || record.bestTime !== undefined) result[id] = record;
	}
	return result;
}

function readCutsceneSet(raw: unknown): number[] {
	const seen = new Set<number>();
	if (typeIs(raw, "table")) {
		let entries = 0;
		for (const [, value] of pairs(raw as unknown as Record<string, unknown>)) {
			// There are only 19 possible chapters. Allow compatibility noise, but bound traversal.
			entries++;
			if (entries > (MISSION_COUNT + 1) * 2) return [];
			if (isFiniteNumber(value) && value % 1 === 0 && value >= 0 && value <= MISSION_COUNT) {
				seen.add(value);
			}
		}
	}
	const list: number[] = [];
	for (const value of seen) list.push(value);
	table.sort(list);
	return list;
}

/** Rebuilds every field derived from `slot.missions`. Idempotent. */
function refreshDerived(slot: SaveSlot): void {
	const missions = slot.missions ?? {};
	// Preserve the v2 Mission 2 prerequisite: a completed Mission 2 implies a completed Mission 1 record.
	if (missions[2]?.completed) {
		const existing = missions[1];
		// Repair only the flag so score breakdowns and any other saved fields survive.
		if (existing !== undefined) existing.completed = true;
		else missions[1] = { completed: true };
	}
	slot.missions = missions;
	slot.mission1Completed = missions[1]?.completed === true;
	slot.mission2Completed = missions[2]?.completed === true;
	slot.mission1BestTime = missions[1]?.bestTime;
	slot.mission2BestTime = missions[2]?.bestTime;
	let allComplete = true;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (missions[id]?.completed !== true) {
			allComplete = false;
			break;
		}
	}
	slot.completed = allComplete;
	slot.currentMission = resumeMission(slot);
	// Keep the summary field useful: latest completed mission's best time, or earliest.
	let latestBest: number | undefined;
	for (let id = MISSION_COUNT; id >= 1; id--) {
		if (missions[id]?.bestTime !== undefined) {
			latestBest = missions[id]!.bestTime;
			break;
		}
	}
	slot.bestTime = latestBest;
}

export function normalizeSlot(raw: unknown, index: number, legacyV1 = false): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;

	const source = raw as StoredSlot;
	const kills = isFiniteNumber(source.kills) ? math.floor(source.kills) : 0;
	slot.kills = math.clamp(kills, 0, MISSION_KILLS);
	const missions = readMissionsMap(source.missions);

	// v1 and v2 legacy fields. v1 `completed` means mission 1 completed only.
	const legacyMission1 = legacyV1 && source.completed === true;
	const mission1Flag = source.mission1Completed === true || legacyMission1;
	const mission2Flag = source.mission2Completed === true;
	if (mission1Flag && missions[1] === undefined) {
		missions[1] = { completed: true };
	}
	if (mission2Flag && missions[2] === undefined) {
		missions[2] = { completed: true };
	}
	// Merge v2 best times without replacing any other fields of an existing v3 record.
	const legacyBest = legacyV1 ? positiveTime(source.bestTime) : undefined;
	const mission1Best = positiveTime(source.mission1BestTime) ?? legacyBest;
	const mission2Best = positiveTime(source.mission2BestTime);
	if (mission1Best !== undefined) {
		const current = missions[1];
		if (current !== undefined) current.bestTime = fastest(current.bestTime, mission1Best);
		else missions[1] = { completed: false, bestTime: mission1Best };
	}
	if (mission2Best !== undefined) {
		const current = missions[2];
		if (current !== undefined) current.bestTime = fastest(current.bestTime, mission2Best);
		else missions[2] = { completed: false, bestTime: mission2Best };
	}

	slot.missions = missions;
	refreshDerived(slot);
	slot.occupied =
		source.occupied === true ||
		slot.kills > 0 ||
		slot.mission1Completed === true ||
		slot.mission2Completed === true;
	for (let id = 0; id <= MISSION_COUNT; id++) if (missions[id] !== undefined) slot.occupied = true;
	if (isFiniteNumber(source.updatedAt) && source.updatedAt > 0) {
		slot.updatedAt = math.floor(source.updatedAt);
		slot.occupied = true;
	}
	slot.introSeen = source.introSeen === true;
	slot.cutscenesSeen = readCutsceneSet(source.cutscenesSeen);
	slot.generation = isFiniteNumber(source.generation) && source.generation > 0 ? math.floor(source.generation) : 0;
	if (typeIs(source.epoch, "string") && source.epoch.size() > 0 && source.epoch.size() <= MAX_EPOCH_LENGTH)
		slot.epoch = source.epoch;
	if (SpecialWeapons.IsKind(source.special)) slot.special = source.special;
	if (Difficulty.IsKind(source.difficulty)) slot.difficulty = source.difficulty;
	return slot;
}

export function blankProfile(): CampaignProfile {
	const slots = new Array<SaveSlot>();
	for (let index = 1; index <= SLOT_COUNT; index++) slots.push(blankSlot(index));
	return { version: SAVE_VERSION, slots };
}

/**
 * A present mission container must be a table, and every record readMissionsMap would read (ids 0..MISSION_COUNT,
 * string or numeric key) must be a table; otherwise normalization would silently drop it and the next save would
 * overwrite it. Absence stays legitimate (v1/v2 slots, fresh slots). Keys outside the current campaign are not read
 * and are tolerated, so saves carrying retired-campaign records keep loading exactly as before. Scalar fields inside
 * a record keep their intentional sanitization.
 */
function missionsReadError(raw: unknown): string | undefined {
	if (raw === undefined) return undefined;
	if (!typeIs(raw, "table"))
		return "Campaign save has an invalid mission container; saving is disabled to protect it.";
	for (let id = 0; id <= MISSION_COUNT; id++) {
		const byString = (raw as Record<string, unknown>)[tostring(id)];
		const byNumber = (raw as Record<number, unknown>)[id];
		if (
			(byString !== undefined && !typeIs(byString, "table")) ||
			(byNumber !== undefined && !typeIs(byNumber, "table"))
		)
			return "Campaign save has invalid mission records; saving is disabled to protect it.";
	}
	return undefined;
}

/** Only a missing key is fresh. Existing unreadable data must never become a writable blank. */
export function profileReadError(raw: unknown): string | undefined {
	if (raw === undefined) return undefined;
	if (!typeIs(raw, "table"))
		return "Campaign save has an invalid profile structure; saving is disabled to protect it.";
	const stored = raw as StoredProfile;
	if (stored.version !== 1 && stored.version !== 2 && stored.version !== SAVE_VERSION)
		return "Campaign save uses an unsupported schema version; saving is disabled. Please rejoin an updated server.";
	if (!typeIs(stored.slots, "table"))
		return "Campaign save has an invalid slot container; saving is disabled to protect it.";
	let entries = 0;
	for (const [key, slot] of pairs(stored.slots as unknown as Record<string, unknown>)) {
		entries++;
		// At most four numeric and four string compatibility keys. Bound even malformed containers.
		if (entries > SLOT_COUNT * 2 || !typeIs(slot, "table"))
			return "Campaign save has invalid slot entries; saving is disabled to protect it.";
		let validKey = false;
		for (let id = 1; id <= SLOT_COUNT; id++) if (key === tostring(id) || (key as unknown) === id) validKey = true;
		if (!validKey) return "Campaign save has invalid slot keys; saving is disabled to protect it.";
		const missionIssue = missionsReadError((slot as StoredSlot).missions);
		if (missionIssue !== undefined) return missionIssue;
	}
	return undefined;
}

export function normalizeProfile(raw: unknown): CampaignProfile {
	const issue = profileReadError(raw);
	assert(issue === undefined, issue);
	const profile = blankProfile();
	if (raw === undefined) return profile;
	const stored = raw as StoredProfile;
	// Explicit supported migrations: v1 completion belongs to M1; v2 legacy mission fields
	// become v3 records in normalizeSlot. v3 keeps its per-mission records.
	const legacyV1 = stored.version === 1;
	for (let index = 1; index <= SLOT_COUNT; index++)
		profile.slots[index - 1] = normalizeSlot(slotAt(stored.slots!, index), index, legacyV1);
	return profile;
}

function rankOf(value: unknown): MissionRank | undefined {
	return MissionScore.IsRank(value) ? value : undefined;
}

/**
 * Phase 2 of the deletion-epoch rollout, deliberately OFF. Phase 1 (this deploy) only writes and preserves each slot's
 * `epoch`; every merge decision stays on the pre-epoch generation rules, so servers that drop the field (every server
 * running before this change) coexist exactly as before. Enable only in a later deploy, once no server that drops
 * `epoch` can still write campaign records; then competing deletions stop merging (see resolveSlot).
 */
export const DELETION_EPOCH_CONFLICTS = false;

/** A slot's exact deletion identity: its generation plus the epoch of the deletion that started it (if known). */
export interface SlotLineage {
	generation?: number;
	epoch?: string;
}

/** Exact identity. An absent epoch matches only an absent epoch; it is never a wildcard. */
function sameIdentity(left: SlotLineage, right: SlotLineage): boolean {
	return (left.generation ?? 0) === (right.generation ?? 0) && left.epoch === right.epoch;
}

/** What a coordinator knows when it writes. Pure merges pass none and keep the pre-epoch rules. */
export interface LineageContext {
	/** Phase-2 conflict rules; false keeps the pre-epoch generation rules. */
	conflicts: boolean;
	/**
	 * Per slot index, the exact identities a still-pending local deletion chain was built on (oldest first). A slot
	 * with no pending deletion has no entry: having issued an epoch in the past never authorises a replacement.
	 */
	pending: ReadonlyMap<number, readonly SlotLineage[]>;
}

type Resolution = "merge" | "stored" | "desired";

/**
 * Phase 1 / pure merges: the higher generation replaces, equal generations merge (pre-epoch behaviour).
 * Phase 2: progress merges are lossless, so only whole-slot replacement needs proof.
 * - Exact same identity: merge.
 * - Desired replaces stored only when desired holds a pending deletion whose chain was built on exactly the stored
 *   identity: a causally newer deletion of that slot.
 * - Otherwise a different generation keeps stored: either a deletion committed elsewhere, or a desired deletion that
 *   did not start from what is in the cloud (refused, never merged, receipt not confirmed).
 * - Equal generation with two different known epochs keeps stored. A defined epoch is written only by the deletion
 *   that created its generation (merges keep the stored epoch and never assign one to an epoch-less record), so the
 *   desired lineage was never committed and only its unsaved local progress is dropped.
 * - Equal generation with an epoch missing on either side (legacy, or rewritten by a server that drops the field)
 *   merges, exactly as before epochs existed.
 */
function resolveSlot(stored: SaveSlot, desired: SaveSlot, index: number, lineage?: LineageContext): Resolution {
	const storedGeneration = stored.generation ?? 0;
	const desiredGeneration = desired.generation ?? 0;
	if (lineage === undefined || !lineage.conflicts) {
		if (storedGeneration !== desiredGeneration) return storedGeneration > desiredGeneration ? "stored" : "desired";
		return "merge";
	}
	if (sameIdentity(stored, desired)) return "merge";
	const chain = lineage.pending.get(index);
	if (chain !== undefined && chain.some((ancestor) => sameIdentity(stored, ancestor))) return "desired";
	if (storedGeneration !== desiredGeneration) return "stored";
	if (stored.epoch !== undefined && desired.epoch !== undefined) return "stored";
	return "merge";
}

function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number, lineage?: LineageContext): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	const resolution = resolveSlot(stored, desired, index, lineage);
	if (resolution === "stored") return stored;
	if (resolution === "desired") return desired;
	const merged = blankSlot(index);
	merged.generation = stored.generation;
	// Keep the stored epoch exactly: a merge never assigns an epoch to an epoch-less cloud record.
	if (stored.epoch !== undefined) merged.epoch = stored.epoch;
	merged.occupied = stored.occupied || desired.occupied;
	const missions: { [missionId: number]: MissionRecord } = {};
	for (let id = 0; id <= MISSION_COUNT; id++) {
		const a = stored.missions?.[id];
		const b = desired.missions?.[id];
		if (a === undefined && b === undefined) continue;
		const completed = a?.completed === true || b?.completed === true;
		const best = fastest(a?.bestTime, b?.bestTime);
		const first = fastest(a?.firstCompletedAt, b?.firstCompletedAt);
		const record: MissionRecord = { completed, timeVersion: MissionCatalog.TimeVersion(id) };
		if (best !== undefined) record.bestTime = best;
		if (first !== undefined) record.firstCompletedAt = first;
		// Score bests only ever rise, like bestTime only ever falls.
		copyBests(
			record,
			highest(a?.bestScore, b?.bestScore),
			MissionScore.BetterRank(rankOf(a?.bestRank), rankOf(b?.bestRank)),
		);
		const scoreSource = (b?.bestScore ?? -1) > (a?.bestScore ?? -1) ? b : a;
		const breakdown =
			scoreSource?.bestTargetScore ?? (a?.bestScore === b?.bestScore ? b?.bestTargetScore : undefined);
		if (breakdown !== undefined) record.bestTargetScore = breakdown;
		missions[id] = record;
	}
	merged.missions = missions;
	refreshDerived(merged);
	merged.kills = math.max(stored.kills, desired.kills);
	if (stored.updatedAt !== undefined || desired.updatedAt !== undefined) {
		merged.updatedAt = math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0);
	}
	merged.introSeen = stored.introSeen === true || desired.introSeen === true;
	const seen = new Set<number>();
	for (const id of stored.cutscenesSeen ?? []) seen.add(id);
	for (const id of desired.cutscenesSeen ?? []) seen.add(id);
	const seenList: number[] = [];
	for (const id of seen) seenList.push(id);
	table.sort(seenList);
	merged.cutscenesSeen = seenList;
	// The loadout is a preference, not progress: the more recently updated side wins.
	const desiredNewer = (desired.updatedAt ?? 0) >= (stored.updatedAt ?? 0);
	const special = desiredNewer ? (desired.special ?? stored.special) : (stored.special ?? desired.special);
	if (special !== undefined) merged.special = special;
	const difficulty = desiredNewer
		? (desired.difficulty ?? stored.difficulty)
		: (stored.difficulty ?? desired.difficulty);
	if (difficulty !== undefined) merged.difficulty = difficulty;
	return merged;
}

export function mergeProfiles(storedRaw: unknown, desiredRaw: unknown, lineage?: LineageContext): CampaignProfile {
	const stored = normalizeProfile(storedRaw);
	const desired = normalizeProfile(desiredRaw);
	const merged = blankProfile();
	for (let index = 1; index <= SLOT_COUNT; index++)
		merged.slots[index - 1] = mergeSlot(stored.slots[index - 1], desired.slots[index - 1], index, lineage);
	return merged;
}

export function serializeProfile(profile: CampaignProfile): StoredProfile {
	const slots = new Map<string, StoredSlot>();
	for (let index = 1; index <= SLOT_COUNT; index++) {
		const source = normalizeSlot(profile.slots[index - 1], index);
		const missions = new Map<string, StoredMissionRecord>();
		for (let id = 0; id <= MISSION_COUNT; id++) {
			const record = source.missions?.[id];
			if (record === undefined) continue;
			const payload: StoredMissionRecord = { completed: record.completed, timeVersion: record.timeVersion };
			if (record.bestTime !== undefined) payload.bestTime = record.bestTime;
			if (record.firstCompletedAt !== undefined) payload.firstCompletedAt = record.firstCompletedAt;
			if (record.bestScore !== undefined) payload.bestScore = record.bestScore;
			if (record.bestRank !== undefined) payload.bestRank = record.bestRank;
			if (record.bestTargetScore !== undefined) payload.bestTargetScore = record.bestTargetScore;
			missions.set(tostring(id), payload);
		}
		const stored: StoredSlot = {
			occupied: source.occupied,
			completed: source.completed,
			kills: source.kills,
			currentMission: source.currentMission,
			mission1Completed: source.mission1Completed,
			mission2Completed: source.mission2Completed,
			missions,
			introSeen: source.introSeen === true,
			cutscenesSeen: source.cutscenesSeen ?? [],
			generation: source.generation ?? 0,
		};
		if (source.bestTime !== undefined) stored.bestTime = source.bestTime;
		if (source.mission1BestTime !== undefined) stored.mission1BestTime = source.mission1BestTime;
		if (source.mission2BestTime !== undefined) stored.mission2BestTime = source.mission2BestTime;
		if (source.updatedAt !== undefined) stored.updatedAt = source.updatedAt;
		if (source.special !== undefined) stored.special = source.special;
		if (source.difficulty !== undefined) stored.difficulty = source.difficulty;
		if (source.epoch !== undefined) stored.epoch = source.epoch;
		slots.set(tostring(index), stored);
	}
	return { version: SAVE_VERSION, slots };
}

function clientSlots(profile: CampaignProfile): SaveSlot[] {
	return profile.slots.map((slot, offset) => {
		const copy = normalizeSlot(slot, offset + 1);
		// The deletion epoch is server-side merge bookkeeping; the client wire keeps its pre-epoch shape.
		copy.epoch = undefined;
		return copy;
	});
}

export function isValidSlot(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= SLOT_COUNT;
}

export function canAttemptRecovery(lastAttempt: number, now: number, interval: number): boolean {
	return now - lastAttempt >= interval;
}

export function completeMission(
	coordinator: CampaignCoordinator,
	activeSlot: number | undefined,
	activeMission: number | undefined,
	won: boolean,
	stats: MissionStats,
	notify: (message: MissionFinished) => void,
	flushSeconds = 3,
): boolean {
	const missionId = stats.missionId ?? 1;
	if (
		activeSlot === undefined ||
		activeMission === undefined ||
		!isValidSlot(stats.slot) ||
		stats.slot !== activeSlot ||
		!isValidMission(missionId) ||
		!MissionCatalog.Available(missionId) ||
		missionId !== activeMission ||
		// Defence in depth: a result for a mission this slot has not unlocked is never recorded.
		!canLaunchMission(missionId, coordinator.getSlots()[activeSlot - 1])
	)
		return false;
	const groundKills = isFiniteNumber(stats.groundKills) ? math.max(0, math.floor(stats.groundKills)) : 0;
	const kills = isFiniteNumber(stats.kills) ? math.max(0, math.floor(stats.kills)) : 0;
	// Combat's kill tally includes ground targets; only the remainder can satisfy air objectives.
	const airKills = math.max(0, kills - groundKills);
	const elapsed = isFiniteNumber(stats.elapsed) ? stats.elapsed : 0;

	const blueprint = MissionCatalog.Get(missionId);
	const requiredAirKills = MissionCatalog.RequiredAirKills(blueprint);
	const requiredGroundKills = MissionCatalog.RequiredGroundKills(blueprint);
	const objectivesMet =
		isFiniteNumber(stats.kills) &&
		groundKills <= kills &&
		airKills >= requiredAirKills &&
		groundKills >= requiredGroundKills;
	const flightObjectivesMet = stats.completedPhases === MissionCatalog.TotalPhases(blueprint);
	const qualifiedWin =
		won &&
		flightObjectivesMet &&
		objectivesMet &&
		elapsed > 0 &&
		elapsed < MissionCatalog.MaxMissionSeconds(missionId);
	const par = MissionScore.ParSeconds(MissionCatalog.Get(missionId));
	const policy = MissionCatalog.Scoring(missionId);
	const scored = MissionScore.Compute(
		{
			won: qualifiedWin,
			airKills,
			groundKills,
			elapsed,
			par,
			missilesFired: counter(stats.missilesFired),
			missileHits: counter(stats.missileHits),
			damageTaken: counter(stats.damageTaken),
			difficulty: Difficulty.Coerce(stats.difficulty),
			targetPoints: policy.basis === "points" ? stats.targetScore?.total : undefined,
		},
		policy,
	);
	const result = coordinator.recordMissionResult(activeSlot, missionId, qualifiedWin, stats.kills, elapsed, {
		score: scored.score,
		rank: scored.rank,
		targetScore: policy.basis === "points" ? stats.targetScore : undefined,
	});
	// Give the cloud write a short window so the result screen can confirm the save.
	if (flushSeconds > 0) coordinator.flush(flushSeconds);
	notify({
		kind: result.completed ? "Completed" : "Failed",
		missionId,
		slot: activeSlot,
		kills: result.kills,
		groundKills,
		elapsed: result.elapsed,
		reason: result.completed
			? undefined
			: (stats.reason ?? (elapsed >= MissionCatalog.MaxMissionSeconds(missionId) ? "timeout" : undefined)),
		saved: !coordinator.hasPendingSave(),
		persistence: coordinator.getPersistence(),
		optionalKills: counter(stats.optionalKills),
		completedPhases: isFiniteNumber(stats.completedPhases)
			? math.max(0, math.floor(stats.completedPhases))
			: undefined,
		missilesFired: counter(stats.missilesFired),
		missileHits: counter(stats.missileHits),
		damageTaken: counter(stats.damageTaken),
		lowestHealth: isFiniteNumber(stats.lowestHealth) ? math.clamp(stats.lowestHealth, 0, 100) : undefined,
		evades: counter(stats.evades),
		...(policy.basis === "points" && stats.targetScore !== undefined ? { targetScore: stats.targetScore } : {}),
		score: scored.score,
		rank: scored.rank,
		par,
		newBestScore: result.newBestScore,
		newBestRank: result.newBestRank,
		bestScore: result.bestScore,
		bestRank: result.bestRank,
		difficulty: Difficulty.Coerce(stats.difficulty),
	});
	return true;
}

function counter(value: unknown): number {
	return isFiniteNumber(value) ? math.max(0, math.floor(value)) : 0;
}

/** Owns one player's locally authoritative profile and its serialized cloud writes. */
/** Per-attempt-loop state so a schema refusal is attributed to the operation that raised it. */
interface OperationScope {
	refused: boolean;
}

/** A deletion receipt plus the epoch that identifies its tombstone; the epoch never leaves the server. */
interface DeletionReceipt extends SlotDeletion {
	epoch: string;
}

let fallbackEpochs = 0;

/** A GUID per deletion. Pure Luau (offline specs) has no HttpService, so it falls back to a process-local id. */
function generateEpoch(): string {
	const [ok, guid] = pcall(() => game.GetService("HttpService").GenerateGUID(false));
	if (ok && typeIs(guid, "string") && guid.size() > 0) return guid;
	fallbackEpochs++;
	return `local-${fallbackEpochs}-${math.floor(os.clock() * 1000000)}-${math.random(0, 1000000000)}`;
}

function identityOf(slot: SaveSlot): SlotLineage {
	return { generation: slot.generation ?? 0, epoch: slot.epoch };
}

/** A pending chain keeps its oldest ancestor (normally the cloud base) plus the most recent local deletions. */
const MAX_PENDING_CHAIN = 16;

export class CampaignCoordinator {
	private profile = blankProfile();
	private readonly deletions = new Map<number, DeletionReceipt>();
	/**
	 * Per slot, the exact identities a still-pending local deletion chain was built on. Cleared as soon as the local
	 * slot settles on the committed cloud identity (its tombstone landed, or it adopted another record).
	 */
	private readonly pendingChains = new Map<number, SlotLineage[]>();
	private readonly newEpoch: () => string;
	private readonly epochConflicts: boolean;
	private readonly clock: () => number;
	private readonly wait: () => void;
	private persistence: Persistence;
	private cloudLoaded = false;
	private loadError?: string;
	private dirty = false;
	private writeRunning = false;
	private writeScheduled = false;
	/** True when the scheduled write runs on the next defer rather than after the spacing window. */
	private scheduledUrgent = false;
	/** A promoted write supersedes its delayed predecessor, which then no-ops when it fires. */
	private scheduleId = 0;
	private lastWriteAt = -math.huge;
	private readonly defer: (callback: () => void) => void;
	private readonly delay: (seconds: number, callback: () => void) => void;
	private readonly writeSpacing: number;
	private readonly now: () => number;
	private readonly maxAttempts: number;
	private readonly retryWait: (attempt: number) => void;
	private readonly logWarning: (message: string) => void;

	public constructor(
		private readonly key: string,
		private readonly store?: CampaignStore,
		options: CoordinatorOptions = {},
	) {
		this.clock = options.clock ?? os.clock;
		this.wait =
			options.wait ??
			(() => {
				task.wait(0.05);
			});
		this.persistence = store ? "unavailable" : "session";
		this.defer = options.defer ?? task.defer;
		this.delay =
			options.delay ??
			((seconds, callback) => {
				task.delay(seconds, callback);
			});
		this.writeSpacing = math.max(0, options.writeSpacing ?? CAMPAIGN_WRITE_SPACING);
		this.now = options.now ?? os.time;
		this.maxAttempts = options.maxAttempts ?? 3;
		this.retryWait = options.retryWait ?? ((attempt) => task.wait(attempt));
		this.logWarning = options.warn ?? warn;
		this.newEpoch = options.newEpoch ?? generateEpoch;
		this.epochConflicts = options.epochConflicts ?? DELETION_EPOCH_CONFLICTS;
	}

	public load(): boolean {
		if (!this.store) {
			this.persistence = "session";
			return true;
		}
		const [success, stored] = this.tryOperation("profile load", (scope) => {
			const raw = this.store!.load(this.key);
			this.checkReadable(raw, scope);
			return normalizeProfile(raw);
		});
		if (!success) {
			this.persistence = "unavailable";
			return false;
		}
		this.profile = mergeProfiles(stored, this.profile, this.lineage());
		this.settlePending(stored as CampaignProfile);
		this.loadError = undefined;
		this.cloudLoaded = true;
		this.persistence = "cloud";
		if (this.dirty) this.queueSave();
		return true;
	}

	public recover(): boolean {
		if (!this.store) return true;
		if (!this.cloudLoaded) return this.load();
		if (!this.dirty) {
			this.persistence = "cloud";
			return true;
		}
		this.drain();
		return this.persistence === "cloud" && !this.dirty;
	}

	public recordMissionStarted(slotIndex: number, missionId = 1, special?: unknown, difficulty?: unknown): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		if (SpecialWeapons.IsKind(special)) slot.special = special;
		if (Difficulty.IsKind(difficulty)) slot.difficulty = difficulty;
		slot.currentMission = highestUnlocked(slot);
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public recordMissionResult(
		slotIndex: number,
		missionId: number,
		won: boolean,
		killsRaw: unknown,
		elapsedRaw: unknown,
		debrief?: MissionDebriefScore,
	): MissionResult {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const kills = isFiniteNumber(killsRaw) ? math.clamp(math.floor(killsRaw), 0, MISSION_KILLS) : 0;
		const elapsed = isFiniteNumber(elapsedRaw) && elapsedRaw > 0 ? elapsedRaw : 0;
		const completed = won && elapsed > 0 && elapsed < MissionCatalog.MaxMissionSeconds(missionId);
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.kills = math.max(slot.kills, kills);
		slot.updatedAt = this.now();
		const result: MissionResult = { completed, missionId, kills, elapsed };
		const existing = slot.missions?.[missionId];
		if (completed) {
			const missions = slot.missions ?? {};
			const record: MissionRecord = {
				completed: true,
				bestTime: fastest(existing?.bestTime, elapsed),
				timeVersion: MissionCatalog.TimeVersion(missionId),
				firstCompletedAt: existing?.firstCompletedAt ?? this.now(),
			};
			const score = debrief && isFiniteNumber(debrief.score) ? math.max(0, math.floor(debrief.score)) : undefined;
			const rank = debrief && MissionScore.IsRank(debrief.rank) ? debrief.rank : undefined;
			const previousRank = rankOf(existing?.bestRank);
			copyBests(record, highest(existing?.bestScore, score), MissionScore.BetterRank(previousRank, rank));
			const improvesScore =
				score !== undefined && (existing?.bestScore === undefined || score > existing.bestScore);
			const breakdown = improvesScore ? readTargetScore(debrief?.targetScore, score) : existing?.bestTargetScore;
			if (breakdown !== undefined) record.bestTargetScore = breakdown;
			missions[missionId] = record;
			slot.missions = missions;
			result.newBestScore =
				score !== undefined && (existing?.bestScore === undefined || score > existing.bestScore);
			result.newBestRank =
				rank !== undefined &&
				(previousRank === undefined || RANK_ORDER.indexOf(rank) < RANK_ORDER.indexOf(previousRank));
		}
		result.bestScore = slot.missions?.[missionId]?.bestScore;
		result.bestRank = rankOf(slot.missions?.[missionId]?.bestRank);
		refreshDerived(slot);
		this.markDirty();
		return result;
	}

	/** A client acknowledgement may record only the chapter for an unlocked mission (or a won finale). */
	public acknowledgeChapter(slotIndex: number, missionId: number, playedChapter: unknown): boolean {
		if (!isValidSlot(slotIndex)) return false;
		const slot = this.getSlots()[slotIndex - 1];
		const finale = missionId === MISSION_COUNT && playedChapter === MISSION_COUNT;
		if (
			finale
				? slot.missions?.[MISSION_COUNT]?.completed !== true
				: !canLaunchMission(missionId, slot) || playedChapter !== chapterBeforeMission(missionId)
		)
			return false;
		this.recordCutsceneSeen(slotIndex, playedChapter as number);
		return true;
	}

	public recordCutsceneSeen(slotIndex: number, cutsceneId: number): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isFiniteNumber(cutsceneId) && cutsceneId >= 0 && cutsceneId <= MISSION_COUNT, "invalid cutscene id");
		const slot = this.profile.slots[slotIndex - 1];
		const seen = new Set<number>();
		for (const id of slot.cutscenesSeen ?? []) seen.add(id);
		const integer = math.floor(cutsceneId);
		if (seen.has(integer)) return;
		seen.add(integer);
		const list: number[] = [];
		for (const id of seen) list.push(id);
		table.sort(list);
		slot.cutscenesSeen = list;
		if (integer === 0) slot.introSeen = true;
		slot.updatedAt = this.now();
		slot.occupied = true;
		this.markDirty();
	}

	/**
	 * Wipes a slot back to empty under a new generation and a fresh unique epoch, issued once here and never on a
	 * write retry or transform re-run; later progress belongs to that epoch. The bumped generation keeps the old
	 * progress from merging back in. In phase 2 the pending chain is the only proof that lets this tombstone replace
	 * the cloud slot, and only if the cloud still holds exactly what the deletion was applied over.
	 */
	public deleteSlot(slotIndex: number): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		const generation = (this.profile.slots[slotIndex - 1].generation ?? 0) + 1;
		const epoch = this.newEpoch();
		// The chain records exactly what this deletion was applied over; only those identities may be replaced.
		const chain = [...(this.pendingChains.get(slotIndex) ?? []), identityOf(this.profile.slots[slotIndex - 1])];
		if (chain.size() > MAX_PENDING_CHAIN) chain.remove(1);
		this.pendingChains.set(slotIndex, chain);
		const slot = blankSlot(slotIndex);
		slot.generation = generation;
		slot.epoch = epoch;
		this.profile.slots[slotIndex - 1] = slot;
		this.deletions.set(slotIndex, {
			slot: slotIndex,
			generation,
			epoch,
			status: this.store ? "pending" : "session-only",
		});
		this.markDirty();
	}

	public getDeletions(): SlotDeletion[] {
		const result: SlotDeletion[] = [];
		for (const [, deletion] of this.deletions) {
			let status = deletion.status;
			if (status !== "confirmed" && status !== "session-only") {
				status = this.writeRunning || this.writeScheduled ? "pending" : "failed";
			}
			result.push({ slot: deletion.slot, generation: deletion.generation, status });
		}
		return result;
	}

	public getSlots(): SaveSlot[] {
		return clientSlots(this.profile);
	}

	public getPersistence(): Persistence {
		return this.persistence;
	}

	public getLoadError(): string | undefined {
		return this.loadError;
	}

	private checkReadable(raw: unknown, scope: OperationScope): void {
		const issue = profileReadError(raw);
		if (issue !== undefined) {
			this.loadError = issue;
			scope.refused = true;
			this.cloudLoaded = false;
			error(issue);
		}
	}

	public hasCloudLoaded(): boolean {
		return this.cloudLoaded;
	}

	public hasPendingSave(): boolean {
		return this.dirty || this.writeRunning || this.writeScheduled;
	}

	public flush(timeoutSeconds = 5): boolean {
		if (!this.store) return true;
		if (!this.cloudLoaded) return false;
		const deadline = this.clock() + math.max(0, timeoutSeconds);
		// A flush owns its own deadline, so it bypasses write spacing and promotes any delayed write.
		this.queueSave(true);
		while (this.hasPendingSave() && this.clock() < deadline) {
			this.wait();
			this.queueSave(true);
		}
		return !this.hasPendingSave();
	}

	private markDirty(): void {
		if (!this.store) return;
		this.dirty = true;
		if (this.cloudLoaded) this.queueSave();
	}

	private queueSave(urgent = false): void {
		if (this.writeRunning || !this.dirty) return;
		if (this.writeScheduled && (!urgent || this.scheduledUrgent)) return;
		const spacing = urgent ? 0 : this.lastWriteAt + this.writeSpacing - this.clock();
		this.writeScheduled = true;
		this.scheduledUrgent = spacing <= 0;
		const id = ++this.scheduleId;
		const run = () => {
			if (id !== this.scheduleId) return;
			this.writeScheduled = false;
			this.drain(urgent);
		};
		if (spacing <= 0) this.defer(run);
		else this.delay(spacing, run);
	}

	private drain(urgent = true): void {
		if (this.writeRunning || !this.store || !this.cloudLoaded) return;
		this.writeRunning = true;
		// This pass owns all current dirt; a timer still queued for it (e.g. under recover) must not count as pending.
		this.scheduleId++;
		this.writeScheduled = false;
		let failed = false;
		while (this.dirty) {
			// A deferred save writes once per spacing window; later dirt waits for the next window.
			if (!urgent && this.clock() < this.lastWriteAt + this.writeSpacing) break;
			this.dirty = false;
			const desired = normalizeProfile(this.profile);
			// Snapshot, like `desired`: every retry and transform re-run resolves against the same lineage.
			const lineage = this.lineage();
			const [success, stored] = this.tryOperation("profile save", (scope) => {
				const saved = this.store!.update(this.key, (current) => {
					// UpdateAsync can observe a newer deployment's record after our successful load.
					this.checkReadable(current, scope);
					return serializeProfile(mergeProfiles(current, desired, lineage));
				});
				this.checkReadable(saved, scope);
				return normalizeProfile(saved);
			});
			if (!success) {
				this.dirty = true;
				this.persistence = "unavailable";
				failed = true;
				break;
			}
			this.lastWriteAt = this.clock();
			// Only a successful write carrying this tombstone confirms the deletion: its generation, and in phase 2 its
			// epoch too. Later progress reuses both; never replay deleteSlot on retry.
			const persisted = normalizeProfile(stored);
			for (const [, deletion] of this.deletions) {
				const sent = desired.slots[deletion.slot - 1];
				const saved = persisted.slots[deletion.slot - 1];
				if (
					sent.generation === deletion.generation &&
					(!this.epochConflicts || sent.epoch === deletion.epoch) &&
					!sent.occupied &&
					saved.generation === deletion.generation &&
					(!this.epochConflicts || saved.epoch === deletion.epoch) &&
					!saved.occupied
				)
					deletion.status = "confirmed";
			}
			// Resolve local changes made during the write (including a newer pending deletion), then drop the
			// chains of slots that now carry the committed identity.
			this.profile = mergeProfiles(stored, this.profile, this.lineage());
			this.settlePending(persisted);
			this.persistence = "cloud";
		}
		this.writeRunning = false;
		// A failed write is retried only by flush/recover, exactly as before; spaced-out dirt is rescheduled.
		if (!failed && this.dirty) this.queueSave();
	}

	/** A true snapshot: the transform and every retry resolve against the chains as they were when the write began. */
	private lineage(): LineageContext {
		const pending = new Map<number, readonly SlotLineage[]>();
		for (const [slot, chain] of this.pendingChains) pending.set(slot, [...chain]);
		return { conflicts: this.epochConflicts, pending };
	}

	/** A local slot that now carries the committed identity has no pending deletion left to prove. */
	private settlePending(committed: CampaignProfile): void {
		for (const [slot] of this.pendingChains) {
			if (sameIdentity(identityOf(this.profile.slots[slot - 1]), identityOf(committed.slots[slot - 1])))
				this.pendingChains.delete(slot);
		}
	}

	private tryOperation(name: string, callback: (scope: OperationScope) => unknown): LuaTuple<[boolean, unknown]> {
		let lastError: unknown;
		// Operation-local refusal flag: the callback's closure captures it, so the attribution does not depend on
		// which thread the engine uses to run a DataStore transform, and a concurrent operation cannot set it.
		const scope: OperationScope = { refused: false };
		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			const [success, result] = pcall(() => callback(scope));
			if (success) return $tuple(true, result);
			lastError = result;
			this.logWarning(`SKYBREAK ${name} attempt ${attempt} failed: ${tostring(result)}`);
			// A schema/structure refusal raised by this operation needs a fresh explicit load, never an automatic
			// retry. Transient errors keep retrying even if another operation refused a record meanwhile.
			if (scope.refused) break;
			if (attempt < this.maxAttempts) this.retryWait(attempt);
		}
		return $tuple(false, lastError);
	}
}
