// Last Tide: a 27-mission campaign save, v3.
//
// A slot stores completion plus a best time for every mission the player has
// cleared. Missions unlock sequentially (mission N requires N-1 complete).
// Legacy v1 (one-mission "completed=true") and v2 (two-mission with
// mission1Completed/mission2Completed) saves migrate forward on first load.

import { GameConfig } from "../shared/GameConfig";
import { getMission, isValidMissionId, MISSION_COUNT, requiredAir, requiredGround } from "../shared/MissionCatalog";
import { MissionFinished, MissionStats, Persistence, SaveSlot } from "../shared/Types";

export interface StoredSlot {
	occupied?: unknown;
	completed?: unknown;
	kills?: unknown;
	bestTime?: unknown;
	updatedAt?: unknown;
	currentMission?: unknown;
	highestUnlocked?: unknown;
	/** Per-mission completion flags, keyed by mission id as string ("1".."27"). */
	missionCompleted?: Map<string, unknown> | Record<string, unknown>;
	/** Per-mission best times in seconds, keyed by mission id as string. */
	missionBestTime?: Map<string, unknown> | Record<string, unknown>;
	// Legacy v2 fields; migrated on load.
	mission1Completed?: unknown;
	mission2Completed?: unknown;
	mission1BestTime?: unknown;
	mission2BestTime?: unknown;
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
}

const SLOT_COUNT = GameConfig.Campaign.SlotCount;
const MISSION_KILLS = GameConfig.Campaign.MaxRecordedKills;

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge;
}

function slotAt(rawSlots: Map<string, StoredSlot> | StoredSlot[], index: number): unknown {
	if (typeIs(rawSlots, "table")) {
		return (rawSlots as unknown as Record<number, unknown>)[index] ?? (rawSlots as unknown as Record<string, unknown>)[tostring(index)];
	}
	return undefined;
}

function readMapValue(container: unknown, key: string): unknown {
	if (!typeIs(container, "table")) return undefined;
	const asMap = container as Map<string, unknown>;
	if ((asMap as unknown as { get?: (k: string) => unknown }).get !== undefined) {
		const value = asMap.get(key);
		if (value !== undefined) return value;
	}
	return (container as unknown as Record<string, unknown>)[key];
}

export function blankSlot(index: number): SaveSlot {
	return {
		index,
		occupied: false,
		completed: false,
		kills: 0,
		currentMission: 1,
		highestUnlocked: 1,
		missionCompleted: new Map<number, boolean>(),
		missionBestTime: new Map<number, number>(),
		mission1Completed: false,
		mission2Completed: false,
	};
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

export function isValidMission(value: unknown): value is number {
	return isValidMissionId(value);
}

function highestCompleted(slot: SaveSlot): number {
	let highest = 0;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (slot.missionCompleted?.get(id) === true) highest = id;
	}
	return highest;
}

export function resumeMission(slot: SaveSlot): number {
	const unlocked = math.min(MISSION_COUNT, highestCompleted(slot) + 1);
	return math.max(1, unlocked);
}

export function resolveMissionRequest(slot: SaveSlot, requested: unknown): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, `Choose a valid mission (1-${MISSION_COUNT}).`);
	if (requested > 1) {
		const previous = requested - 1;
		if (slot.missionCompleted?.get(previous) !== true) {
			return $tuple(undefined, `Mission ${string.format("%02d", requested)} is locked until Mission ${string.format("%02d", previous)} is complete.`);
		}
	}
	return $tuple(requested, undefined);
}

/** Normalizes a single stored slot into a fully-populated SaveSlot. */
export function normalizeSlot(raw: unknown, index: number, legacyVersion = 3): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;
	const source = raw as StoredSlot;

	const completed = new Map<number, boolean>();
	const bestTimes = new Map<number, number>();

	// v3 fields are authoritative.
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const key = tostring(id);
		if (readMapValue(source.missionCompleted, key) === true) completed.set(id, true);
		const time = positiveTime(readMapValue(source.missionBestTime, key));
		if (time !== undefined) bestTimes.set(id, time);
	}

	// v2 forward-migration.
	if (legacyVersion < 3) {
		if (source.mission1Completed === true) completed.set(1, true);
		if (source.mission2Completed === true) completed.set(2, true);
		const t1 = positiveTime(source.mission1BestTime);
		if (t1 !== undefined) bestTimes.set(1, t1);
		const t2 = positiveTime(source.mission2BestTime);
		if (t2 !== undefined) bestTimes.set(2, t2);
	}

	// v1 forward-migration: a completed flag means Mission 1 complete; bestTime is Mission 1's time.
	if (legacyVersion < 2) {
		if (source.completed === true) completed.set(1, true);
		const t1 = positiveTime(source.bestTime);
		if (t1 !== undefined && bestTimes.get(1) === undefined) bestTimes.set(1, t1);
	}

	// Preserve sequential-unlock invariant: a later mission's completion implies all earlier ones.
	let seenCompleted = false;
	for (let id = MISSION_COUNT; id >= 1; id--) {
		if (completed.get(id) === true) seenCompleted = true;
		else if (seenCompleted) completed.set(id, true);
	}

	slot.missionCompleted = completed;
	slot.missionBestTime = bestTimes;

	const kills = isFiniteNumber(source.kills) ? math.floor(source.kills) : 0;
	slot.kills = math.clamp(kills, 0, MISSION_KILLS);
	slot.mission1Completed = completed.get(1) === true;
	slot.mission2Completed = completed.get(2) === true;
	slot.mission1BestTime = bestTimes.get(1);
	slot.mission2BestTime = bestTimes.get(2);
	const highest = highestCompleted(slot);
	slot.highestUnlocked = math.min(MISSION_COUNT, highest + 1);
	slot.completed = highest === MISSION_COUNT;
	let fastest: number | undefined;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const time = bestTimes.get(id);
		if (time !== undefined && (fastest === undefined || time < fastest)) fastest = time;
	}
	slot.bestTime = fastest;
	slot.currentMission = resumeMission(slot);
	slot.occupied = source.occupied === true || highest > 0 || slot.kills > 0 || bestTimes.size() > 0;
	if (isFiniteNumber(source.updatedAt) && source.updatedAt > 0) {
		slot.updatedAt = math.floor(source.updatedAt);
		slot.occupied = true;
	}
	return slot;
}

export function blankProfile(): CampaignProfile {
	const slots = new Array<SaveSlot>();
	for (let index = 1; index <= SLOT_COUNT; index++) slots.push(blankSlot(index));
	return { version: GameConfig.Campaign.SaveVersion, slots };
}

export function normalizeProfile(raw: unknown): CampaignProfile {
	const profile = blankProfile();
	if (!typeIs(raw, "table")) return profile;
	const stored = raw as StoredProfile;
	const rawSlots = stored.slots;
	if (!typeIs(rawSlots, "table")) return profile;
	const legacyVersion = isFiniteNumber(stored.version) ? math.floor(stored.version) : 1;
	for (let index = 1; index <= SLOT_COUNT; index++) {
		profile.slots[index - 1] = normalizeSlot(slotAt(rawSlots, index), index, legacyVersion);
	}
	return profile;
}

function fastest(left?: number, right?: number): number | undefined {
	if (left !== undefined && right !== undefined) return math.min(left, right);
	return left ?? right;
}

export function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	const merged = blankSlot(index);
	merged.occupied = stored.occupied || desired.occupied;
	const completed = merged.missionCompleted!;
	const bestTimes = merged.missionBestTime!;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const flag = (stored.missionCompleted?.get(id) === true) || (desired.missionCompleted?.get(id) === true);
		if (flag) completed.set(id, true);
		const best = fastest(stored.missionBestTime?.get(id), desired.missionBestTime?.get(id));
		if (best !== undefined) bestTimes.set(id, best);
	}
	// Enforce sequential-unlock invariant on the merged slot too.
	let seenCompleted = false;
	for (let id = MISSION_COUNT; id >= 1; id--) {
		if (completed.get(id) === true) seenCompleted = true;
		else if (seenCompleted) completed.set(id, true);
	}
	merged.kills = math.max(stored.kills, desired.kills);
	merged.mission1Completed = completed.get(1) === true;
	merged.mission2Completed = completed.get(2) === true;
	merged.mission1BestTime = bestTimes.get(1);
	merged.mission2BestTime = bestTimes.get(2);
	const highest = highestCompleted(merged);
	merged.highestUnlocked = math.min(MISSION_COUNT, highest + 1);
	merged.completed = highest === MISSION_COUNT;
	let fastestOverall: number | undefined;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const time = bestTimes.get(id);
		if (time !== undefined && (fastestOverall === undefined || time < fastestOverall)) fastestOverall = time;
	}
	merged.bestTime = fastestOverall;
	merged.currentMission = resumeMission(merged);
	if (stored.updatedAt !== undefined || desired.updatedAt !== undefined) {
		merged.updatedAt = math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0);
	}
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
		const stored: StoredSlot = {
			occupied: source.occupied,
			completed: source.completed,
			kills: source.kills,
			currentMission: source.currentMission,
			highestUnlocked: source.highestUnlocked,
		};
		// Export per-mission completion and best time maps.
		const completed = new Map<string, boolean>();
		const bestTimes = new Map<string, number>();
		for (let id = 1; id <= MISSION_COUNT; id++) {
			if (source.missionCompleted?.get(id) === true) completed.set(tostring(id), true);
			const time = source.missionBestTime?.get(id);
			if (time !== undefined) bestTimes.set(tostring(id), time);
		}
		if (completed.size() > 0) stored.missionCompleted = completed;
		if (bestTimes.size() > 0) stored.missionBestTime = bestTimes;
		// Retain v2 shaped fields so a rollback to v2 code can still read Missions 1 and 2.
		stored.mission1Completed = source.mission1Completed === true;
		stored.mission2Completed = source.mission2Completed === true;
		if (source.mission1BestTime !== undefined) stored.mission1BestTime = source.mission1BestTime;
		if (source.mission2BestTime !== undefined) stored.mission2BestTime = source.mission2BestTime;
		if (source.bestTime !== undefined) stored.bestTime = source.bestTime;
		if (source.updatedAt !== undefined) stored.updatedAt = source.updatedAt;
		slots.set(tostring(index), stored);
	}
	return { version: GameConfig.Campaign.SaveVersion, slots };
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
	const mission = getMission(missionId);
	const requiredAirKills = requiredAir(mission);
	const requiredGroundKills = requiredGround(mission);
	// Old M1 callbacks (pre-v3) did not carry missionId; keep them accepted as M1 wins only.
	const legacyMission1 = stats.missionId === undefined;
	const objectivesMet = stats.kills >= requiredAirKills && (legacyMission1 || groundKills >= requiredGroundKills);
	const qualifiedWin = won && objectivesMet && elapsed > 0 && elapsed <= GameConfig.Campaign.MissionTimeLimit;
	const result = coordinator.recordMissionResult(activeSlot, missionId, qualifiedWin, stats.kills, elapsed);
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
	});
	return true;
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

	public recordMissionStarted(slotIndex: number, missionId = 1): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.currentMission = missionId;
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public recordMissionResult(slotIndex: number, missionId: number, won: boolean, killsRaw: unknown, elapsedRaw: unknown): MissionResult {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const kills = isFiniteNumber(killsRaw) ? math.clamp(math.floor(killsRaw), 0, MISSION_KILLS) : 0;
		const elapsed = isFiniteNumber(elapsedRaw) && elapsedRaw > 0 ? elapsedRaw : 0;
		const completed = won && elapsed > 0 && elapsed <= GameConfig.Campaign.MissionTimeLimit;
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.kills = math.max(slot.kills, kills);
		slot.updatedAt = this.now();
		if (completed) {
			slot.missionCompleted?.set(missionId, true);
			const prior = slot.missionBestTime?.get(missionId);
			slot.missionBestTime?.set(missionId, prior === undefined ? elapsed : math.min(prior, elapsed));
			// Preserve the invariant: completing a later mission implies all prior ones.
			for (let id = missionId - 1; id >= 1; id--) slot.missionCompleted?.set(id, true);
		}
		// Rebuild derived scalar fields.
		const highest = highestCompleted(slot);
		slot.highestUnlocked = math.min(MISSION_COUNT, highest + 1);
		slot.completed = highest === MISSION_COUNT;
		slot.mission1Completed = slot.missionCompleted?.get(1) === true;
		slot.mission2Completed = slot.missionCompleted?.get(2) === true;
		slot.mission1BestTime = slot.missionBestTime?.get(1);
		slot.mission2BestTime = slot.missionBestTime?.get(2);
		let fastestOverall: number | undefined;
		for (let id = 1; id <= MISSION_COUNT; id++) {
			const time = slot.missionBestTime?.get(id);
			if (time !== undefined && (fastestOverall === undefined || time < fastestOverall)) fastestOverall = time;
		}
		slot.bestTime = fastestOverall;
		slot.currentMission = resumeMission(slot);
		this.markDirty();
		return { completed, missionId, kills, elapsed };
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
			this.logWarning(`LAST TIDE ${name} attempt ${attempt} failed: ${tostring(result)}`);
			if (attempt < this.maxAttempts) this.retryWait(attempt);
		}
		return $tuple(false, lastError);
	}
}
