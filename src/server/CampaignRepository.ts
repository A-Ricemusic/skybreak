import { GameConfig } from "../shared/GameConfig";
import { MissionCatalog } from "../shared/MissionCatalog";
import { MissionFinished, MissionStats, MissionProgress, Persistence, SaveSlot } from "../shared/Types";

/** Per-mission record stored by v3 saves and shipped to the client. */
export interface StoredMission {
	completed?: unknown;
	bestTime?: unknown;
}

export interface StoredSlot {
	occupied?: unknown;
	completed?: unknown;
	kills?: unknown;
	bestTime?: unknown;
	updatedAt?: unknown;
	currentMission?: unknown;
	/** Legacy fields; still read for migration from v1/v2 saves. */
	mission1Completed?: unknown;
	mission2Completed?: unknown;
	mission1BestTime?: unknown;
	mission2BestTime?: unknown;
	/** v3 field: per-mission completion and best time keyed by mission number. */
	missions?: Map<string, StoredMission> | StoredMission[] | undefined;
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
const MAX_KILLS = GameConfig.Campaign.MaxRecordedKills;
const MISSION_COUNT = MissionCatalog.Count();

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge;
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

function slotAt(rawSlots: Map<string, StoredSlot> | StoredSlot[], index: number): unknown {
	if (typeIs(rawSlots, "table")) {
		return (rawSlots as unknown as Record<number, unknown>)[index] ?? (rawSlots as unknown as Record<string, unknown>)[tostring(index)];
	}
	return undefined;
}

function missionAt(rawMissions: Map<string, StoredMission> | StoredMission[] | undefined, missionId: number): unknown {
	if (rawMissions === undefined) return undefined;
	if (typeIs(rawMissions, "table")) {
		return (rawMissions as unknown as Record<number, unknown>)[missionId] ?? (rawMissions as unknown as Record<string, unknown>)[tostring(missionId)];
	}
	return undefined;
}

function fastest(left?: number, right?: number): number | undefined {
	if (left !== undefined && right !== undefined) return math.min(left, right);
	return left ?? right;
}

function blankMissions(): MissionProgress[] {
	const out: MissionProgress[] = [];
	for (let index = 0; index < MISSION_COUNT; index++) out.push({ completed: false });
	return out;
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
		missionsCompleted: 0,
		missions: blankMissions(),
	};
}

export function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

/** The next mission the player should attempt (the first incomplete mission). */
export function resumeMission(slot: SaveSlot): number {
	const missions = slot.missions ?? blankMissions();
	for (let index = 0; index < math.min(missions.size(), MISSION_COUNT); index++) {
		if (missions[index].completed !== true) return index + 1;
	}
	return MISSION_COUNT;
}

/** Returns the mission a Launch call should execute, or an error string. */
export function resolveMissionRequest(slot: SaveSlot, requested: unknown): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, `Choose a valid mission (1-${MISSION_COUNT}).`);
	if (requested === 1) return $tuple(1, undefined);
	const missions = slot.missions ?? blankMissions();
	const previous = missions[requested - 2];
	if (!previous || previous.completed !== true) {
		return $tuple(undefined, string.format("Mission %02d is locked until the previous mission is complete.", requested));
	}
	return $tuple(requested, undefined);
}

function normalizeMissions(raw: StoredSlot, legacyV1 = false): MissionProgress[] {
	const out = blankMissions();
	const rawMissions = raw.missions;
	// Pull v3 per-mission entries if present.
	if (rawMissions !== undefined) {
		for (let index = 1; index <= MISSION_COUNT; index++) {
			const source = missionAt(rawMissions, index);
			if (!typeIs(source, "table")) continue;
			const entry = source as StoredMission;
			if (entry.completed === true) {
				out[index - 1] = { completed: true, bestTime: positiveTime(entry.bestTime) };
			}
		}
	}
	// Overlay legacy v1/v2 fields: Mission 1 and Mission 2 completion/best time.
	const legacyMission1 = legacyV1 && raw.completed === true;
	if (raw.mission1Completed === true || legacyMission1) {
		const legacyBest = legacyV1 ? positiveTime(raw.bestTime) : undefined;
		const existing = out[0];
		out[0] = {
			completed: true,
			bestTime: fastest(existing.bestTime, positiveTime(raw.mission1BestTime) ?? legacyBest),
		};
	}
	if (raw.mission2Completed === true) {
		const existing = out[1];
		out[1] = {
			completed: true,
			bestTime: fastest(existing.bestTime, positiveTime(raw.mission2BestTime)),
		};
	}
	return out;
}

function slotFromMissions(index: number, raw: StoredSlot, missions: MissionProgress[]): SaveSlot {
	const slot = blankSlot(index);
	slot.missions = missions;
	let highestCompleted = 0;
	for (let missionIndex = 0; missionIndex < MISSION_COUNT; missionIndex++) {
		if (missions[missionIndex].completed === true) highestCompleted = missionIndex + 1;
	}
	let count = 0;
	for (const mission of missions) if (mission.completed === true) count += 1;
	slot.missionsCompleted = count;
	slot.completed = count === MISSION_COUNT;
	slot.mission1Completed = missions[0].completed === true;
	slot.mission2Completed = missions[1].completed === true;
	slot.mission1BestTime = missions[0].bestTime;
	slot.mission2BestTime = missions[1].bestTime;
	slot.bestTime = missions[1].bestTime ?? missions[0].bestTime;
	const kills = isFiniteNumber(raw.kills) ? math.floor(raw.kills) : 0;
	slot.kills = math.clamp(kills, 0, MAX_KILLS);
	const occupiedByCompletion = count > 0 || highestCompleted > 0;
	slot.occupied = raw.occupied === true || occupiedByCompletion || slot.kills > 0;
	if (missions.some((mission) => mission.bestTime !== undefined)) slot.occupied = true;
	if (isFiniteNumber(raw.updatedAt) && raw.updatedAt > 0) {
		slot.updatedAt = math.floor(raw.updatedAt);
		slot.occupied = true;
	}
	// The next uncompleted mission, clamped to the last mission for a complete slot.
	slot.currentMission = resumeMission(slot);
	return slot;
}

export function normalizeSlot(raw: unknown, index: number, legacyV1 = false): SaveSlot {
	if (!typeIs(raw, "table")) return blankSlot(index);
	const source = raw as StoredSlot;
	const missions = normalizeMissions(source, legacyV1);
	return slotFromMissions(index, source, missions);
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

function mergeMissions(left: MissionProgress[], right: MissionProgress[]): MissionProgress[] {
	const out = blankMissions();
	for (let index = 0; index < MISSION_COUNT; index++) {
		const a = left[index] ?? { completed: false };
		const b = right[index] ?? { completed: false };
		const completed = a.completed === true || b.completed === true;
		out[index] = {
			completed,
			bestTime: completed ? fastest(a.bestTime, b.bestTime) : undefined,
		};
	}
	return out;
}

export function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	const missions = mergeMissions(stored.missions ?? blankMissions(), desired.missions ?? blankMissions());
	const occupied = stored.occupied || desired.occupied;
	const kills = math.max(stored.kills, desired.kills);
	const updatedAt = stored.updatedAt !== undefined || desired.updatedAt !== undefined
		? math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0)
		: undefined;
	const merged = slotFromMissions(index, { occupied, kills, updatedAt }, missions);
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
		const missions = source.missions ?? blankMissions();
		const missionMap = new Map<string, StoredMission>();
		for (let missionIndex = 1; missionIndex <= MISSION_COUNT; missionIndex++) {
			const entry = missions[missionIndex - 1];
			const serialized: StoredMission = { completed: entry.completed === true };
			if (entry.bestTime !== undefined) serialized.bestTime = entry.bestTime;
			missionMap.set(tostring(missionIndex), serialized);
		}
		const stored: StoredSlot = {
			occupied: source.occupied,
			completed: source.completed,
			kills: source.kills,
			currentMission: source.currentMission,
			mission1Completed: source.mission1Completed,
			mission2Completed: source.mission2Completed,
			missions: missionMap,
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
	const requiredAir = MissionCatalog.TotalRequiredAirKills(missionId);
	const requiredGround = MissionCatalog.TotalRequiredGroundKills(missionId);
	// Legacy combat callbacks did not carry missionId or groundKills. They
	// remain valid only for Mission 1 completion; all new callbacks must prove
	// every objective was met before credit is granted.
	const legacyMission1 = stats.missionId === undefined;
	const objectivesMet = stats.kills >= requiredAir && (legacyMission1 || groundKills >= requiredGround);
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
		slot.currentMission = missionId;
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public recordMissionResult(slotIndex: number, missionId: number, won: boolean, killsRaw: unknown, elapsedRaw: unknown): MissionResult {
		assert(isValidSlot(slotIndex), "invalid campaign slot");
		assert(isValidMission(missionId), "invalid campaign mission");
		const kills = isFiniteNumber(killsRaw) ? math.clamp(math.floor(killsRaw), 0, MAX_KILLS) : 0;
		const elapsed = isFiniteNumber(elapsedRaw) && elapsedRaw > 0 ? elapsedRaw : 0;
		const completed = won && elapsed > 0 && elapsed <= GameConfig.Campaign.MissionTimeLimit;
		const slot = this.profile.slots[slotIndex - 1];
		slot.occupied = true;
		slot.kills = math.max(slot.kills, kills);
		slot.updatedAt = this.now();
		const missions = slot.missions ?? blankMissions();
		if (completed) {
			const existing = missions[missionId - 1];
			missions[missionId - 1] = {
				completed: true,
				bestTime: fastest(existing.bestTime, elapsed),
			};
			slot.missions = missions;
		}
		// Mirror legacy mission1/mission2 fields so older presentation code stays accurate.
		slot.mission1Completed = missions[0].completed === true;
		slot.mission2Completed = missions[1].completed === true;
		slot.mission1BestTime = missions[0].bestTime;
		slot.mission2BestTime = missions[1].bestTime;
		let count = 0;
		for (const mission of missions) if (mission.completed === true) count += 1;
		slot.missionsCompleted = count;
		slot.completed = count === MISSION_COUNT;
		slot.bestTime = missions[1].bestTime ?? missions[0].bestTime;
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
