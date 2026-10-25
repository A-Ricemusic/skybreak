import { GameConfig } from "../shared/GameConfig";
import { MissionFinished, MissionStats, Persistence, SaveSlot } from "../shared/Types";

export interface StoredSlot {
	occupied?: unknown;
	completed?: unknown;
	kills?: unknown;
	bestTime?: unknown;
	updatedAt?: unknown;
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
	kills: number;
	elapsed: number;
}

const SLOT_COUNT = GameConfig.Campaign.SlotCount;
const MISSION_KILLS = GameConfig.Campaign.MissionKills;

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
	return { index, occupied: false, completed: false, kills: 0 };
}

export function normalizeSlot(raw: unknown, index: number): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;

	const source = raw as StoredSlot;
	const kills = isFiniteNumber(source.kills) ? math.floor(source.kills) : 0;
	slot.kills = math.clamp(kills, 0, MISSION_KILLS);
	slot.completed = source.completed === true;
	slot.occupied = source.occupied === true || slot.completed || slot.kills > 0;
	if (isFiniteNumber(source.bestTime) && source.bestTime > 0) {
		slot.bestTime = source.bestTime;
		slot.occupied = true;
	}
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
	const rawSlots = (raw as StoredProfile).slots;
	if (!typeIs(rawSlots, "table")) return profile;
	for (let index = 1; index <= SLOT_COUNT; index++) profile.slots[index - 1] = normalizeSlot(slotAt(rawSlots, index), index);
	return profile;
}

export function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	const merged = blankSlot(index);
	merged.occupied = stored.occupied || desired.occupied;
	merged.completed = stored.completed || desired.completed;
	merged.kills = math.max(stored.kills, desired.kills);
	if (stored.bestTime !== undefined && desired.bestTime !== undefined) merged.bestTime = math.min(stored.bestTime, desired.bestTime);
	else merged.bestTime = stored.bestTime ?? desired.bestTime;
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
		const stored: StoredSlot = { occupied: source.occupied, completed: source.completed, kills: source.kills };
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
	won: boolean,
	stats: MissionStats,
	notify: (message: MissionFinished) => void,
): boolean {
	if (activeSlot === undefined || !isValidSlot(stats.slot) || stats.slot !== activeSlot) return false;
	const result = coordinator.recordMissionResult(activeSlot, won, stats.kills, stats.elapsed);
	notify({
		kind: result.completed ? "Completed" : "Failed",
		slot: activeSlot,
		kills: result.kills,
		elapsed: result.elapsed,
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

	public recordMissionStarted(slotIndex: number): void {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public recordMissionResult(slotIndex: number, won: boolean, killsRaw: unknown, elapsedRaw: unknown): MissionResult {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		const kills = isFiniteNumber(killsRaw) ? math.clamp(math.floor(killsRaw), 0, MISSION_KILLS) : 0;
		const elapsed = isFiniteNumber(elapsedRaw) && elapsedRaw > 0 ? elapsedRaw : 0;
		const completed = won && kills >= MISSION_KILLS && elapsed > 0;
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.kills = math.max(slot.kills, kills);
		slot.updatedAt = this.now();
		if (completed) {
			slot.completed = true;
			slot.bestTime = slot.bestTime !== undefined ? math.min(slot.bestTime, elapsed) : elapsed;
		}
		this.markDirty();
		return { completed, kills, elapsed };
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

	public flush(): boolean {
		if (!this.store) return true;
		if (!this.cloudLoaded) return false;
		this.drain();
		return !this.dirty;
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
