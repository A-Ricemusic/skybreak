import { MissionCatalog } from "../shared/MissionCatalog";
import { GameConfig } from "../shared/GameConfig";
import { MissionFinished, MissionStats, Persistence, SaveSlot } from "../shared/Types";

export interface StoredSlot {
	completedMissions?: unknown;
	missionBestTimes?: unknown;
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
		completedMissions: 0,
		missionBestTimes: new Map<string, number>(),
	};
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

export function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

export function resumeMission(slot: SaveSlot): number {
	return math.min(MISSION_COUNT, (slot.completedMissions ?? (slot.mission2Completed ? 2 : slot.mission1Completed ? 1 : 0)) + 1);
}

export function resolveMissionRequest(slot: SaveSlot, requested: unknown): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, "Choose a valid mission (1-27).");
	if (requested > resumeMission(slot)) return $tuple(undefined, "Complete the preceding mission to unlock this sortie.");
	return $tuple(requested, undefined);
}

export function normalizeSlot(raw: unknown, index: number, legacyV1 = false): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;
	const source = raw as StoredSlot;
	slot.kills = isFiniteNumber(source.kills) ? math.clamp(math.floor(source.kills), 0, MISSION_KILLS) : 0;
	const legacyCount = source.mission2Completed === true ? 2 : source.mission1Completed === true || (legacyV1 && source.completed === true) ? 1 : 0;
	slot.completedMissions = math.max(legacyCount, isFiniteNumber(source.completedMissions) ? math.clamp(math.floor(source.completedMissions), 0, MISSION_COUNT) : 0);
	slot.mission1Completed = slot.completedMissions >= 1;
	slot.mission2Completed = slot.completedMissions >= 2;
	slot.completed = slot.completedMissions === MISSION_COUNT;
	const times = slot.missionBestTimes!;
	if (typeIs(source.missionBestTimes, "table")) {
		const rawTimes = source.missionBestTimes as Map<string, unknown>;
		for (let id = 1; id <= slot.completedMissions; id++) {
			const value = positiveTime(rawTimes.get(tostring(id)));
			if (value !== undefined && value < 600) times.set(tostring(id), value);
		}
	}
	const first = positiveTime(source.mission1BestTime) ?? (legacyV1 ? positiveTime(source.bestTime) : undefined);
	const second = positiveTime(source.mission2BestTime);
	if (first !== undefined) times.set("1", fastest(times.get("1"), first)!);
	if (second !== undefined) times.set("2", fastest(times.get("2"), second)!);
	slot.mission1BestTime = times.get("1"); slot.mission2BestTime = times.get("2");
	slot.bestTime = times.get(tostring(math.max(1, slot.completedMissions)));
	slot.currentMission = resumeMission(slot);
	slot.occupied = source.occupied === true || slot.completedMissions > 0 || slot.kills > 0 || times.size() > 0;
	if (isFiniteNumber(source.updatedAt) && source.updatedAt > 0) { slot.updatedAt = math.floor(source.updatedAt); slot.occupied = true; }
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
	const stored = normalizeSlot(storedRaw, index), desired = normalizeSlot(desiredRaw, index);
	const times = new Map<string, number>();
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const best = fastest(stored.missionBestTimes!.get(tostring(id)), desired.missionBestTimes!.get(tostring(id)));
		if (best !== undefined) times.set(tostring(id), best);
	}
	return normalizeSlot({ occupied: stored.occupied || desired.occupied,
		completedMissions: math.max(stored.completedMissions ?? 0, desired.completedMissions ?? 0),
		missionBestTimes: times, kills: math.max(stored.kills, desired.kills),
		updatedAt: math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0) }, index);
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
			completedMissions: source.completedMissions,
			missionBestTimes: source.missionBestTimes,
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
	const definition = MissionCatalog.Get(missionId);
	const legacyMission1 = stats.missionId === undefined;
	const objectivesMet = stats.kills >= MissionCatalog.RequiredAirKills(definition)
		&& (legacyMission1 || groundKills >= MissionCatalog.RequiredGroundKills(definition))
		&& (missionId <= 2 || stats.objectivesComplete === true);
	const qualifiedWin = won && objectivesMet && elapsed > 0 && elapsed < GameConfig.Campaign.MissionTimeLimit;
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
		slot.currentMission = resumeMission(slot);
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public recordMissionResult(slotIndex: number, missionId: number, won: boolean, killsRaw: unknown, elapsedRaw: unknown): MissionResult {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const kills = isFiniteNumber(killsRaw) ? math.clamp(math.floor(killsRaw), 0, MISSION_KILLS) : 0;
		const elapsed = isFiniteNumber(elapsedRaw) && elapsedRaw > 0 ? elapsedRaw : 0;
		const completed = won && elapsed > 0 && elapsed < GameConfig.Campaign.MissionTimeLimit;
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.kills = math.max(slot.kills, kills);
		slot.updatedAt = this.now();
		// Only the next unlocked sortie or a replay may advance this prefix.
		const qualified = completed && missionId <= resumeMission(slot);
		if (qualified) {
			slot.completedMissions = math.max(slot.completedMissions ?? 0, missionId);
			const times = slot.missionBestTimes!;
			times.set(tostring(missionId), fastest(times.get(tostring(missionId)), elapsed)!);
		}
		this.profile.slots[slotIndex - 1] = normalizeSlot(slot, slotIndex);
		this.markDirty();
		return { completed: qualified, missionId, kills, elapsed };
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
