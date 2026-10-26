import { GameConfig } from "../shared/GameConfig";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import { MissionRank, MissionScore, RANK_ORDER } from "../shared/MissionScore";
import { MissionFinished, MissionRecord, MissionStats, Persistence, SaveSlot } from "../shared/Types";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty } from "../shared/Difficulty";

export interface StoredMissionRecord {
	completed?: unknown;
	bestTime?: unknown;
	firstCompletedAt?: unknown;
	bestScore?: unknown;
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
	defer?: (callback: () => void) => void;
	now?: () => number;
	maxAttempts?: number;
	retryWait?: (attempt: number) => void;
	warn?: (message: string) => void;
}

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
	score: number;
	rank: MissionRank;
}

const SLOT_COUNT = GameConfig.Campaign.SlotCount;
const MISSION_KILLS = GameConfig.Campaign.MaxRecordedKills;
const SAVE_VERSION = GameConfig.Campaign.SaveVersion;

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge;
}

function slotAt(rawSlots: Map<string, StoredSlot> | StoredSlot[], index: number): unknown {
	if (typeIs(rawSlots, "table")) {
		return (rawSlots as unknown as Record<number, unknown>)[index] ?? (rawSlots as unknown as Record<string, unknown>)[tostring(index)];
	}
	return undefined;
}

export function blankSlot(index: number): SaveSlot {
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

export function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

/** Resume at the lowest-numbered unfinished mission, or 1 for a fresh slot. */
export function resumeMission(slot: SaveSlot): number {
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (!(slot.missions?.[id]?.completed === true)) return id;
	}
	return MISSION_COUNT;
}

export function highestUnlocked(slot: SaveSlot): number {
	// Mission N is unlocked when mission N-1 is complete, or N === 1.
	let unlocked = 1;
	for (let id = 1; id < MISSION_COUNT; id++) {
		if (slot.missions?.[id]?.completed === true) unlocked = id + 1;
		else break;
	}
	return unlocked;
}

export function resolveMissionRequest(
	slot: SaveSlot,
	requested: unknown,
): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, "Choose a valid mission (1-27).");
	const unlocked = highestUnlocked(slot);
	if (requested > unlocked) {
		return $tuple(
			undefined,
			`Mission ${string.format("%02d", requested)} is locked until Mission ${string.format("%02d", unlocked)} is complete.`,
		);
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
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const entry = (map as Record<string, unknown>)[tostring(id)] ?? (map as Record<number, unknown>)[id];
		if (!typeIs(entry, "table")) continue;
		const stored = entry as StoredMissionRecord;
		const record: MissionRecord = { completed: stored.completed === true };
		const best = positiveTime(stored.bestTime);
		if (best !== undefined) record.bestTime = best;
		const first = positiveTime(stored.firstCompletedAt);
		if (first !== undefined) record.firstCompletedAt = first;
		copyBests(record, readScore(stored.bestScore), MissionScore.IsRank(stored.bestRank) ? stored.bestRank : undefined);
		if (record.completed || record.bestTime !== undefined) result[id] = record;
	}
	return result;
}

function readCutsceneSet(raw: unknown): number[] {
	const seen = new Set<number>();
	if (typeIs(raw, "table")) {
		for (const [, value] of pairs(raw as unknown as Record<string, unknown>)) {
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
	// v2 best times feed into v3 per-mission records when the new record is absent.
	const legacyBest = legacyV1 ? positiveTime(source.bestTime) : undefined;
	const mission1Best = positiveTime(source.mission1BestTime) ?? legacyBest;
	const mission2Best = positiveTime(source.mission2BestTime);
	if (mission1Best !== undefined) {
		missions[1] = copyBests({ completed: missions[1]?.completed === true, bestTime: fastest(missions[1]?.bestTime, mission1Best), firstCompletedAt: missions[1]?.firstCompletedAt }, missions[1]?.bestScore, missions[1]?.bestRank);
	}
	if (mission2Best !== undefined) {
		missions[2] = copyBests({ completed: missions[2]?.completed === true, bestTime: fastest(missions[2]?.bestTime, mission2Best), firstCompletedAt: missions[2]?.firstCompletedAt }, missions[2]?.bestScore, missions[2]?.bestRank);
	}
	// Preserve M2 prerequisite from v2 semantics.
	if (missions[2]?.completed) missions[1] = copyBests({ completed: true, bestTime: missions[1]?.bestTime, firstCompletedAt: missions[1]?.firstCompletedAt }, missions[1]?.bestScore, missions[1]?.bestRank);

	slot.missions = missions;
	slot.mission1Completed = missions[1]?.completed === true;
	slot.mission2Completed = missions[2]?.completed === true;
	slot.mission1BestTime = missions[1]?.bestTime;
	slot.mission2BestTime = missions[2]?.bestTime;

	let allComplete = true;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (missions[id]?.completed !== true) { allComplete = false; break; }
	}
	slot.completed = allComplete;
	slot.currentMission = resumeMission(slot);
	// Keep the summary field useful: latest completed mission's best time, or earliest.
	let latestBest: number | undefined;
	for (let id = MISSION_COUNT; id >= 1; id--) {
		if (missions[id]?.bestTime !== undefined) { latestBest = missions[id]!.bestTime; break; }
	}
	slot.bestTime = latestBest;
	slot.occupied = source.occupied === true || slot.kills > 0 || slot.mission1Completed || slot.mission2Completed;
	for (let id = 1; id <= MISSION_COUNT; id++) if (missions[id] !== undefined) slot.occupied = true;
	if (isFiniteNumber(source.updatedAt) && source.updatedAt > 0) {
		slot.updatedAt = math.floor(source.updatedAt);
		slot.occupied = true;
	}
	slot.introSeen = source.introSeen === true;
	slot.cutscenesSeen = readCutsceneSet(source.cutscenesSeen);
	slot.generation = isFiniteNumber(source.generation) && source.generation > 0 ? math.floor(source.generation) : 0;
	if (SpecialWeapons.IsKind(source.special)) slot.special = source.special;
	if (Difficulty.IsKind(source.difficulty)) slot.difficulty = source.difficulty;
	return slot;
}

export function blankProfile(): CampaignProfile {
	const slots = new Array<SaveSlot>();
	for (let index = 1; index <= SLOT_COUNT; index++) slots.push(blankSlot(index));
	return { version: SAVE_VERSION, slots };
}

export function normalizeProfile(raw: unknown): CampaignProfile {
	const profile = blankProfile();
	if (!typeIs(raw, "table")) return profile;
	const stored = raw as StoredProfile;
	const rawSlots = stored.slots;
	if (!typeIs(rawSlots, "table")) return profile;
	const storedVersion = isFiniteNumber(stored.version) ? stored.version : 1;
	const legacyV1 = storedVersion < 2;
	for (let index = 1; index <= SLOT_COUNT; index++) profile.slots[index - 1] = normalizeSlot(slotAt(rawSlots, index), index, legacyV1);
	return profile;
}

function rankOf(value: unknown): MissionRank | undefined {
	return MissionScore.IsRank(value) ? value : undefined;
}

export function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	// A deleted slot starts a new generation; never merge progress back in from an older one.
	if (stored.generation !== desired.generation) return (stored.generation ?? 0) > (desired.generation ?? 0) ? stored : desired;
	const merged = blankSlot(index);
	merged.generation = stored.generation;
	merged.occupied = stored.occupied || desired.occupied;
	const missions: { [missionId: number]: MissionRecord } = {};
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const a = stored.missions?.[id];
		const b = desired.missions?.[id];
		if (a === undefined && b === undefined) continue;
		const completed = (a?.completed === true) || (b?.completed === true);
		const best = fastest(a?.bestTime, b?.bestTime);
		const first = fastest(a?.firstCompletedAt, b?.firstCompletedAt);
		const record: MissionRecord = { completed };
		if (best !== undefined) record.bestTime = best;
		if (first !== undefined) record.firstCompletedAt = first;
		// Score bests only ever rise, like bestTime only ever falls.
		copyBests(record, highest(a?.bestScore, b?.bestScore), MissionScore.BetterRank(rankOf(a?.bestRank), rankOf(b?.bestRank)));
		missions[id] = record;
	}
	// Preserve the v2 Mission 2 prerequisite in merged profiles as well.
	if (missions[2]?.completed) {
		const existing = missions[1];
		missions[1] = copyBests({ completed: true, bestTime: existing?.bestTime, firstCompletedAt: existing?.firstCompletedAt }, existing?.bestScore, existing?.bestRank);
	}
	merged.missions = missions;
	merged.mission1Completed = missions[1]?.completed === true;
	merged.mission2Completed = missions[2]?.completed === true;
	merged.mission1BestTime = missions[1]?.bestTime;
	merged.mission2BestTime = missions[2]?.bestTime;
	let allComplete = true;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (missions[id]?.completed !== true) { allComplete = false; break; }
	}
	merged.completed = allComplete;
	merged.currentMission = resumeMission(merged);
	merged.kills = math.max(stored.kills, desired.kills);
	let latestBest: number | undefined;
	for (let id = MISSION_COUNT; id >= 1; id--) {
		if (missions[id]?.bestTime !== undefined) { latestBest = missions[id]!.bestTime; break; }
	}
	merged.bestTime = latestBest;
	if (stored.updatedAt !== undefined || desired.updatedAt !== undefined) {
		merged.updatedAt = math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0);
	}
	merged.introSeen = (stored.introSeen === true) || (desired.introSeen === true);
	const seen = new Set<number>();
	for (const id of stored.cutscenesSeen ?? []) seen.add(id);
	for (const id of desired.cutscenesSeen ?? []) seen.add(id);
	const seenList: number[] = [];
	for (const id of seen) seenList.push(id);
	table.sort(seenList);
	merged.cutscenesSeen = seenList;
	// The loadout is a preference, not progress: the more recently updated side wins.
	const desiredNewer = (desired.updatedAt ?? 0) >= (stored.updatedAt ?? 0);
	const special = desiredNewer ? desired.special ?? stored.special : stored.special ?? desired.special;
	if (special !== undefined) merged.special = special;
	const difficulty = desiredNewer ? desired.difficulty ?? stored.difficulty : stored.difficulty ?? desired.difficulty;
	if (difficulty !== undefined) merged.difficulty = difficulty;
	return merged;
}

export function mergeProfiles(storedRaw: unknown, desiredRaw: unknown): CampaignProfile {
	const stored = normalizeProfile(storedRaw);
	const desired = normalizeProfile(desiredRaw);
	const merged = blankProfile();
	for (let index = 1; index <= SLOT_COUNT; index++) merged.slots[index - 1] = mergeSlot(stored.slots[index - 1], desired.slots[index - 1], index);
	return merged;
}

export function serializeProfile(profile: CampaignProfile): StoredProfile {
	const slots = new Map<string, StoredSlot>();
	for (let index = 1; index <= SLOT_COUNT; index++) {
		const source = normalizeSlot(profile.slots[index - 1], index);
		const missions = new Map<string, StoredMissionRecord>();
		for (let id = 1; id <= MISSION_COUNT; id++) {
			const record = source.missions?.[id];
			if (record === undefined) continue;
			const payload: StoredMissionRecord = { completed: record.completed };
			if (record.bestTime !== undefined) payload.bestTime = record.bestTime;
			if (record.firstCompletedAt !== undefined) payload.firstCompletedAt = record.firstCompletedAt;
			if (record.bestScore !== undefined) payload.bestScore = record.bestScore;
			if (record.bestRank !== undefined) payload.bestRank = record.bestRank;
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
		slots.set(tostring(index), stored);
	}
	return { version: SAVE_VERSION, slots };
}

export function clientSlots(profile: CampaignProfile): SaveSlot[] {
	return profile.slots.map((slot, offset) => normalizeSlot(slot, offset + 1));
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
		missionId !== activeMission
	) return false;
	const groundKills = isFiniteNumber(stats.groundKills) ? math.max(0, math.floor(stats.groundKills)) : 0;
	const elapsed = isFiniteNumber(stats.elapsed) ? stats.elapsed : 0;

	// Required air/ground kills come from the blueprint, except that the legacy
	// callbacks for the first two missions preserve their original enforcement.
	let requiredAirKills: number;
	let requiredGroundKills: number;
	if (missionId === 1) {
		requiredAirKills = GameConfig.Campaign.Missions[1].RequiredAirKills;
		requiredGroundKills = GameConfig.Campaign.Missions[1].RequiredGroundKills;
	} else if (missionId === 2) {
		requiredAirKills = GameConfig.Campaign.Missions[2].RequiredAirKills;
		requiredGroundKills = GameConfig.Campaign.Missions[2].RequiredGroundKills;
	} else {
		const blueprint = MissionCatalog.Get(missionId);
		requiredAirKills = MissionCatalog.RequiredAirKills(blueprint);
		requiredGroundKills = MissionCatalog.RequiredGroundKills(blueprint);
	}
	// Old combat callbacks did not carry missionId/groundKills. They remain valid
	// only as Mission 1 results; all new callbacks must prove every objective.
	const legacyMission1 = stats.missionId === undefined;
	const objectivesMet = stats.kills >= requiredAirKills && (legacyMission1 || groundKills >= requiredGroundKills);
	const flightObjectivesMet = missionId <= 2 || stats.completedPhases === MissionCatalog.TotalPhases(MissionCatalog.Get(missionId));
	const qualifiedWin = won && flightObjectivesMet && objectivesMet && elapsed > 0 && elapsed < GameConfig.Campaign.MissionTimeLimit;
	const kills = isFiniteNumber(stats.kills) ? math.max(0, math.floor(stats.kills)) : 0;
	const par = MissionScore.ParSeconds(MissionCatalog.Get(missionId));
	const scored = MissionScore.Compute({
		won: qualifiedWin,
		airKills: math.max(0, kills - groundKills),
		groundKills,
		elapsed,
		par,
		missilesFired: counter(stats.missilesFired),
		missileHits: counter(stats.missileHits),
		damageTaken: counter(stats.damageTaken),
		difficulty: Difficulty.Coerce(stats.difficulty),
	});
	const result = coordinator.recordMissionResult(activeSlot, missionId, qualifiedWin, stats.kills, elapsed, { score: scored.score, rank: scored.rank });
	// Give the cloud write a short window so the result screen can confirm the save.
	if (flushSeconds > 0) coordinator.flush(flushSeconds);
	notify({
		kind: result.completed ? "Completed" : "Failed",
		missionId,
		slot: activeSlot,
		kills: result.kills,
		groundKills,
		elapsed: result.elapsed,
		reason: result.completed ? undefined : stats.reason ?? (elapsed >= GameConfig.Campaign.MissionTimeLimit ? "timeout" : undefined),
		saved: !coordinator.hasPendingSave(),
		persistence: coordinator.getPersistence(),
		optionalKills: counter(stats.optionalKills),
		completedPhases: isFiniteNumber(stats.completedPhases) ? math.max(0, math.floor(stats.completedPhases)) : undefined,
		missilesFired: counter(stats.missilesFired),
		missileHits: counter(stats.missileHits),
		damageTaken: counter(stats.damageTaken),
		lowestHealth: isFiniteNumber(stats.lowestHealth) ? math.clamp(stats.lowestHealth, 0, 100) : undefined,
		evades: counter(stats.evades),
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
export class CampaignCoordinator {
	private profile = blankProfile();
	private persistence: Persistence;
	private cloudLoaded = false;
	private dirty = false;
	private writeRunning = false;
	private writeScheduled = false;
	private readonly defer: (callback: () => void) => void;
	private readonly now: () => number;
	private readonly maxAttempts: number;
	private readonly retryWait: (attempt: number) => void;
	private readonly logWarning: (message: string) => void;

	public constructor(private readonly key: string, private readonly store?: CampaignStore, options: CoordinatorOptions = {}) {
		this.persistence = store ? "unavailable" : "session";
		this.defer = options.defer ?? task.defer;
		this.now = options.now ?? os.time;
		this.maxAttempts = options.maxAttempts ?? 3;
		this.retryWait = options.retryWait ?? ((attempt) => task.wait(attempt));
		this.logWarning = options.warn ?? warn;
	}

	public load(): boolean {
		if (!this.store) {
			this.persistence = "session";
			return true;
		}
		const [success, stored] = this.tryOperation("profile load", () => this.store!.load(this.key));
		if (!success) {
			this.persistence = "unavailable";
			return false;
		}
		this.profile = mergeProfiles(stored, this.profile);
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
		slot.currentMission = math.max(slot.currentMission ?? 1, missionId);
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
		const completed = won && elapsed > 0 && elapsed < GameConfig.Campaign.MissionTimeLimit;
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
				firstCompletedAt: existing?.firstCompletedAt ?? this.now(),
			};
			const score = debrief && isFiniteNumber(debrief.score) ? math.max(0, math.floor(debrief.score)) : undefined;
			const rank = debrief && MissionScore.IsRank(debrief.rank) ? debrief.rank : undefined;
			const previousRank = rankOf(existing?.bestRank);
			copyBests(record, highest(existing?.bestScore, score), MissionScore.BetterRank(previousRank, rank));
			missions[missionId] = record;
			slot.missions = missions;
			result.newBestScore = score !== undefined && (existing?.bestScore === undefined || score > existing.bestScore);
			result.newBestRank = rank !== undefined && (previousRank === undefined || RANK_ORDER.indexOf(rank) < RANK_ORDER.indexOf(previousRank));
		}
		result.bestScore = slot.missions?.[missionId]?.bestScore;
		result.bestRank = rankOf(slot.missions?.[missionId]?.bestRank);
		// Rebuild derived legacy flags.
		slot.mission1Completed = slot.missions?.[1]?.completed === true;
		slot.mission2Completed = slot.missions?.[2]?.completed === true;
		if (slot.mission2Completed) slot.mission1Completed = true;
		slot.mission1BestTime = slot.missions?.[1]?.bestTime;
		slot.mission2BestTime = slot.missions?.[2]?.bestTime;
		let allComplete = true;
		for (let id = 1; id <= MISSION_COUNT; id++) {
			if (slot.missions?.[id]?.completed !== true) { allComplete = false; break; }
		}
		slot.completed = allComplete;
		slot.currentMission = resumeMission(slot);
		let latestBest: number | undefined;
		for (let id = MISSION_COUNT; id >= 1; id--) {
			if (slot.missions?.[id]?.bestTime !== undefined) { latestBest = slot.missions![id]!.bestTime; break; }
		}
		slot.bestTime = latestBest;
		this.markDirty();
		return result;
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

	/** Wipes a slot back to empty. The bumped generation keeps the old progress from merging back in on save. */
	public deleteSlot(slotIndex: number): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		const generation = (this.profile.slots[slotIndex - 1].generation ?? 0) + 1;
		const slot = blankSlot(slotIndex);
		slot.generation = generation;
		this.profile.slots[slotIndex - 1] = slot;
		this.markDirty();
	}

	public getSlots(): SaveSlot[] {
		return clientSlots(this.profile);
	}

	public getPersistence(): Persistence {
		return this.persistence;
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
		const deadline = os.clock() + math.max(0, timeoutSeconds);
		if (this.dirty && !this.writeRunning && !this.writeScheduled) this.queueSave();
		while (this.hasPendingSave() && os.clock() < deadline) {
			task.wait(0.05);
			if (this.dirty && !this.writeRunning && !this.writeScheduled) this.queueSave();
		}
		return !this.hasPendingSave();
	}

	private markDirty(): void {
		if (!this.store) return;
		this.dirty = true;
		if (this.cloudLoaded) this.queueSave();
	}

	private queueSave(): void {
		if (this.writeRunning || this.writeScheduled || !this.dirty) return;
		this.writeScheduled = true;
		this.defer(() => {
			this.writeScheduled = false;
			this.drain();
		});
	}

	private drain(): void {
		if (this.writeRunning || !this.store || !this.cloudLoaded) return;
		this.writeRunning = true;
		while (this.dirty) {
			this.dirty = false;
			const desired = normalizeProfile(this.profile);
			const [success, stored] = this.tryOperation("profile save", () =>
				this.store!.update(this.key, (current) => serializeProfile(mergeProfiles(current, desired))),
			);
			if (!success) {
				this.dirty = true;
				this.persistence = "unavailable";
				break;
			}
			this.profile = mergeProfiles(stored, this.profile);
			this.persistence = "cloud";
		}
		this.writeRunning = false;
	}

	private tryOperation(name: string, callback: () => unknown): LuaTuple<[boolean, unknown]> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			const [success, result] = pcall(callback);
			if (success) return $tuple(true, result);
			lastError = result;
			this.logWarning(`SKYBREAK ${name} attempt ${attempt} failed: ${tostring(result)}`);
			if (attempt < this.maxAttempts) this.retryWait(attempt);
		}
		return $tuple(false, lastError);
	}
}
