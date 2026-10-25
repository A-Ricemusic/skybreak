import { GameConfig } from "../shared/GameConfig";
import { MissionFinished, MissionStats, Persistence, SaveSlot } from "../shared/Types";

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
const MISSION_COUNT = GameConfig.Campaign.MissionCount;

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
	};
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

export function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

export function resumeMission(slot: SaveSlot): number {
	return slot.mission1Completed === true ? 2 : 1;
}

export function resolveMissionRequest(slot: SaveSlot, requested: unknown): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, "Choose a valid mission (1-2).");
	if (requested === 2 && slot.mission1Completed !== true) return $tuple(undefined, "Mission 02 is locked until Mission 01 is complete.");
	return $tuple(requested, undefined);
}

export function normalizeSlot(raw: unknown, index: number, legacyV1 = false): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;

	const source = raw as StoredSlot;
	const kills = isFiniteNumber(source.kills) ? math.floor(source.kills) : 0;
	slot.kills = math.clamp(kills, 0, MISSION_KILLS);
	const legacyMission1 = legacyV1 && source.completed === true;
	slot.mission1Completed = source.mission1Completed === true || legacyMission1;
	slot.mission2Completed = source.mission2Completed === true;
	// Mission 2 cannot exist without its server-validated prerequisite.
	if (slot.mission2Completed) slot.mission1Completed = true;
	slot.completed = slot.mission1Completed && slot.mission2Completed;
	const legacyBest = legacyV1 ? positiveTime(source.bestTime) : undefined;
	slot.mission1BestTime = positiveTime(source.mission1BestTime) ?? legacyBest;
	slot.mission2BestTime = positiveTime(source.mission2BestTime);
	// Keep the old summary field useful to older presentation code while v2 stores
	// authoritative per-mission records.
	slot.bestTime = slot.mission2BestTime ?? slot.mission1BestTime;
	slot.currentMission = resumeMission(slot);
	slot.occupied = source.occupied === true || slot.mission1Completed || slot.mission2Completed || slot.kills > 0;
	if (slot.mission1BestTime !== undefined || slot.mission2BestTime !== undefined) slot.occupied = true;
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
	const legacyV1 = !isFiniteNumber(stored.version) || stored.version < 2;
	for (let index = 1; index <= SLOT_COUNT; index++) profile.slots[index - 1] = normalizeSlot(slotAt(rawSlots, index), index, legacyV1);
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
	merged.mission1Completed = stored.mission1Completed === true || desired.mission1Completed === true;
	merged.mission2Completed = stored.mission2Completed === true || desired.mission2Completed === true;
	if (merged.mission2Completed) merged.mission1Completed = true;
	merged.completed = merged.mission1Completed && merged.mission2Completed;
	merged.currentMission = resumeMission(merged);
	merged.kills = math.max(stored.kills, desired.kills);
	merged.mission1BestTime = fastest(stored.mission1BestTime, desired.mission1BestTime);
	merged.mission2BestTime = fastest(stored.mission2BestTime, desired.mission2BestTime);
	merged.bestTime = merged.mission2BestTime ?? merged.mission1BestTime;
	if (stored.updatedAt !== undefined || desired.updatedAt !== undefined) merged.updatedAt = math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0);
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
			mission1Completed: source.mission1Completed,
			mission2Completed: source.mission2Completed,
		};
		if (source.bestTime !== undefined) stored.bestTime = source.bestTime;
		if (source.mission1BestTime !== undefined) stored.mission1BestTime = source.mission1BestTime;
		if (source.mission2BestTime !== undefined) stored.mission2BestTime = source.mission2BestTime;
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
	const requiredAirKills = missionId === 1
		? GameConfig.Campaign.Missions[1].RequiredAirKills
		: GameConfig.Campaign.Missions[2].RequiredAirKills;
	const requiredGroundKills = missionId === 1
		? GameConfig.Campaign.Missions[1].RequiredGroundKills
		: GameConfig.Campaign.Missions[2].RequiredGroundKills;
	// Old combat callbacks did not carry missionId/groundKills. They remain valid
	// only as Mission 1 results; all new callbacks must prove every objective.
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
		// Merge even on recovery: local unsaved progress is never replaced by a later read.
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
		if (missionId === 2 || slot.mission1Completed !== true) slot.currentMission = missionId;
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
			if (missionId === 1) {
				slot.mission1Completed = true;
				slot.mission1BestTime = fastest(slot.mission1BestTime, elapsed);
			} else {
				slot.mission2Completed = true;
				slot.mission2BestTime = fastest(slot.mission2BestTime, elapsed);
			}
		}
		if (slot.mission2Completed) slot.mission1Completed = true;
		slot.completed = slot.mission1Completed === true && slot.mission2Completed === true;
		slot.currentMission = resumeMission(slot);
		slot.bestTime = slot.mission2BestTime ?? slot.mission1BestTime;
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

		// Never call drain directly here: an UpdateAsync may already own the key,
		// and datastore calls can yield. Ensure one worker exists, then wait only
		// up to the shutdown budget for it to serialize every retained mutation.
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
			// A mission can finish while update yields. Merge the returned cloud value
			// into the current profile so that newer local progress remains authoritative.
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
