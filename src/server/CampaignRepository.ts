import { AuroraLineManifest } from "../shared/AuroraLineManifest";
import { GameConfig } from "../shared/GameConfig";
import { MissionFinished, MissionRecord, MissionStats, Persistence, SaveSlot } from "../shared/Types";

// Aurora Line save model.
//
// v1 (legacy): `completed: boolean` on a slot meant "Mission 1 complete" and the
//              old mission was the only one. Legacy wins unlock Mission 2.
// v2 (previous): `mission1Completed`, `mission2Completed`, `mission1BestTime`,
//              `mission2BestTime`. Two missions total.
// v3 (Aurora Line): a dense per-mission completion/best-time list for all 27 missions.
//              v1 and v2 saves migrate without loss and keep playing.

export interface StoredMissionRecord {
	id?: unknown;
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
	// Legacy v2 fields are retained for monotonic forward migration.
	mission1Completed?: unknown;
	mission2Completed?: unknown;
	mission1BestTime?: unknown;
	mission2BestTime?: unknown;
	// v3 fields:
	missions?: Map<string, StoredMissionRecord> | StoredMissionRecord[];
	highestUnlocked?: unknown;
	seenCutscenes?: string[];
	reducedMotion?: unknown;
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

export function blankMissionRecords(): MissionRecord[] {
	const list = new Array<MissionRecord>();
	for (let index = 1; index <= MISSION_COUNT; index++) list.push({ id: index, completed: false });
	return list;
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
		missions: blankMissionRecords(),
		highestUnlocked: 1,
		seenCutscenes: [],
		reducedMotion: false,
	};
}

function positiveTime(value: unknown): number | undefined {
	return isFiniteNumber(value) && value > 0 ? value : undefined;
}

export function isValidMission(value: unknown): value is number {
	return isFiniteNumber(value) && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
}

/** Highest mission id that has already been completed, or 0 if nothing done yet. */
function highestCompleted(records: MissionRecord[]): number {
	let highest = 0;
	for (const record of records) if (record.completed && record.id > highest) highest = record.id;
	return highest;
}

export function resumeMission(slot: SaveSlot): number {
	const records = slot.missions ?? blankMissionRecords();
	const highest = highestCompleted(records);
	return math.min(MISSION_COUNT, highest + 1);
}

export function resolveMissionRequest(slot: SaveSlot, requested: unknown): LuaTuple<[number | undefined, string | undefined]> {
	if (requested === undefined) return $tuple(resumeMission(slot), undefined);
	if (!isValidMission(requested)) return $tuple(undefined, "Choose a valid mission (1-27).");
	const records = slot.missions ?? blankMissionRecords();
	if (requested === 1) return $tuple(1, undefined);
	const previous = records[requested - 2];
	if (previous === undefined || previous.completed !== true) {
		return $tuple(undefined, `Mission ${string.format("%02d", requested)} is locked until Mission ${string.format("%02d", requested - 1)} is complete.`);
	}
	return $tuple(requested, undefined);
}

function readMissionRecords(raw: unknown): MissionRecord[] {
	const records = blankMissionRecords();
	if (!typeIs(raw, "table")) return records;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const entry = (raw as unknown as Record<string, unknown>)[tostring(id)] ?? (raw as unknown as Record<number, unknown>)[id];
		if (!typeIs(entry, "table")) continue;
		const entryTable = entry as StoredMissionRecord;
		records[id - 1].completed = entryTable.completed === true;
		const best = positiveTime(entryTable.bestTime);
		if (best !== undefined) records[id - 1].bestTime = best;
	}
	return records;
}

function cascadeCompletion(records: MissionRecord[]): void {
	// A completed mission N implies that all earlier missions were legally cleared;
	// we never retroactively hide an older record. We only harmonize the view.
	// Nothing to do here: completion of M+1 does not force M. If a mission is marked
	// completed without the previous, we trust it: the player cannot have reached
	// it without server-side validation.
	void records;
}

export function normalizeSlot(raw: unknown, index: number, legacyV1 = false): SaveSlot {
	const slot = blankSlot(index);
	if (!typeIs(raw, "table")) return slot;

	const source = raw as StoredSlot;
	const kills = isFiniteNumber(source.kills) ? math.floor(source.kills) : 0;
	slot.kills = math.clamp(kills, 0, MISSION_KILLS);
	// Legacy v2 absorption into v3 mission records.
	const legacyMission1 = legacyV1 && source.completed === true;
	const v2Mission1Completed = source.mission1Completed === true || legacyMission1;
	const v2Mission2Completed = source.mission2Completed === true;
	const legacyBest = legacyV1 ? positiveTime(source.bestTime) : undefined;
	const v2Mission1BestTime = positiveTime(source.mission1BestTime) ?? legacyBest;
	const v2Mission2BestTime = positiveTime(source.mission2BestTime);
	const v3Records = readMissionRecords(source.missions);
	if (v2Mission1Completed) v3Records[0].completed = true;
	if (v2Mission2Completed) {
		v3Records[1].completed = true;
		// Mission 02 could not have been reached without Mission 01.
		v3Records[0].completed = true;
	}
	if (v2Mission1BestTime !== undefined) {
		v3Records[0].bestTime = v3Records[0].bestTime !== undefined ? math.min(v3Records[0].bestTime, v2Mission1BestTime) : v2Mission1BestTime;
	}
	if (v2Mission2BestTime !== undefined) {
		v3Records[1].bestTime = v3Records[1].bestTime !== undefined ? math.min(v3Records[1].bestTime, v2Mission2BestTime) : v2Mission2BestTime;
	}
	cascadeCompletion(v3Records);
	slot.missions = v3Records;
	slot.mission1Completed = v3Records[0].completed;
	slot.mission2Completed = v3Records[1].completed;
	slot.mission1BestTime = v3Records[0].bestTime;
	slot.mission2BestTime = v3Records[1].bestTime;
	// A "fully completed" campaign requires all 27 missions.
	let allCompleted = true;
	for (const record of v3Records) if (!record.completed) { allCompleted = false; break; }
	slot.completed = allCompleted;
	// bestTime remains the newest completed mission's record for the legacy summary.
	let latestBest: number | undefined;
	for (const record of v3Records) if (record.bestTime !== undefined) latestBest = record.bestTime;
	slot.bestTime = latestBest;
	slot.currentMission = resumeMission(slot);
	slot.highestUnlocked = math.max(1, highestCompleted(v3Records) + 1);
	const occupiedByProgress = v3Records.some((record) => record.completed || record.bestTime !== undefined);
	slot.occupied = source.occupied === true || occupiedByProgress || slot.kills > 0;
	if (isFiniteNumber(source.updatedAt) && source.updatedAt > 0) {
		slot.updatedAt = math.floor(source.updatedAt);
		slot.occupied = true;
	}
	const cutscenes = new Array<string>();
	if (typeIs(source.seenCutscenes, "table")) {
		for (const entry of source.seenCutscenes as unknown[]) if (typeIs(entry, "string")) cutscenes.push(entry);
	}
	slot.seenCutscenes = cutscenes;
	slot.reducedMotion = source.reducedMotion === true;
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

function mergeMissionRecords(left: MissionRecord[], right: MissionRecord[]): MissionRecord[] {
	const merged = blankMissionRecords();
	for (let index = 0; index < MISSION_COUNT; index++) {
		merged[index].completed = left[index].completed === true || right[index].completed === true;
		merged[index].bestTime = fastest(left[index].bestTime, right[index].bestTime);
	}
	return merged;
}

export function mergeSlot(storedRaw: unknown, desiredRaw: unknown, index: number): SaveSlot {
	const stored = normalizeSlot(storedRaw, index);
	const desired = normalizeSlot(desiredRaw, index);
	const merged = blankSlot(index);
	merged.occupied = stored.occupied || desired.occupied;
	const mergedRecords = mergeMissionRecords(stored.missions ?? blankMissionRecords(), desired.missions ?? blankMissionRecords());
	merged.missions = mergedRecords;
	merged.mission1Completed = mergedRecords[0].completed;
	merged.mission2Completed = mergedRecords[1].completed;
	merged.mission1BestTime = mergedRecords[0].bestTime;
	merged.mission2BestTime = mergedRecords[1].bestTime;
	let allCompleted = true;
	for (const record of mergedRecords) if (!record.completed) { allCompleted = false; break; }
	merged.completed = allCompleted;
	let latestBest: number | undefined;
	for (const record of mergedRecords) if (record.bestTime !== undefined) latestBest = record.bestTime;
	merged.bestTime = latestBest;
	merged.currentMission = resumeMission(merged);
	merged.kills = math.max(stored.kills, desired.kills);
	merged.highestUnlocked = math.max(stored.highestUnlocked ?? 1, desired.highestUnlocked ?? 1, highestCompleted(mergedRecords) + 1);
	if (stored.updatedAt !== undefined || desired.updatedAt !== undefined) merged.updatedAt = math.max(stored.updatedAt ?? 0, desired.updatedAt ?? 0);
	const cutscenes = new Set<string>();
	for (const entry of stored.seenCutscenes ?? []) cutscenes.add(entry);
	for (const entry of desired.seenCutscenes ?? []) cutscenes.add(entry);
	merged.seenCutscenes = [];
	for (const entry of cutscenes) merged.seenCutscenes.push(entry);
	merged.reducedMotion = stored.reducedMotion === true || desired.reducedMotion === true;
	return merged;
}

export function mergeProfiles(storedRaw: unknown, desiredRaw: unknown): CampaignProfile {
	const stored = normalizeProfile(storedRaw);
	const desired = normalizeProfile(desiredRaw);
	const merged = blankProfile();
	for (let index = 1; index <= SLOT_COUNT; index++) merged.slots[index - 1] = mergeSlot(stored.slots[index - 1], desired.slots[index - 1], index);
	return merged;
}

function serializeMissionRecords(records: MissionRecord[]): Map<string, StoredMissionRecord> {
	const map = new Map<string, StoredMissionRecord>();
	for (let id = 1; id <= MISSION_COUNT; id++) {
		const record = records[id - 1];
		const entry: StoredMissionRecord = { id, completed: record.completed === true };
		if (record.bestTime !== undefined) entry.bestTime = record.bestTime;
		map.set(tostring(id), entry);
	}
	return map;
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
			missions: serializeMissionRecords(source.missions ?? blankMissionRecords()),
			highestUnlocked: source.highestUnlocked,
			reducedMotion: source.reducedMotion,
		};
		if (source.bestTime !== undefined) stored.bestTime = source.bestTime;
		if (source.mission1BestTime !== undefined) stored.mission1BestTime = source.mission1BestTime;
		if (source.mission2BestTime !== undefined) stored.mission2BestTime = source.mission2BestTime;
		if (source.updatedAt !== undefined) stored.updatedAt = source.updatedAt;
		if (source.seenCutscenes && source.seenCutscenes.size() > 0) stored.seenCutscenes = source.seenCutscenes;
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
	const plan = AuroraLineManifest.GetPlan(missionId);
	let requiredAirKills = 0;
	let requiredGroundKills = 0;
	for (const step of plan.steps) {
		if (step.kind === "intercept" || step.kind === "escort" || step.kind === "protect") requiredAirKills += step.required;
		else if (step.kind === "ace") requiredAirKills += 1;
		else if (step.kind === "strike") requiredGroundKills += step.required;
		else if (step.kind === "tutorial_missile") requiredGroundKills += 1;
	}
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
		const records = slot.missions ?? blankMissionRecords();
		const highest = highestCompleted(records);
		if (missionId > highest + 1) {
			// Should be impossible: resolveMissionRequest guards against this. Clamp safely.
			slot.currentMission = highest + 1;
		} else {
			slot.currentMission = missionId;
		}
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
		const records = slot.missions ?? blankMissionRecords();
		if (completed) {
			const record = records[missionId - 1];
			record.completed = true;
			record.bestTime = fastest(record.bestTime, elapsed);
		}
		slot.missions = records;
		slot.mission1Completed = records[0].completed;
		slot.mission2Completed = records[1].completed;
		slot.mission1BestTime = records[0].bestTime;
		slot.mission2BestTime = records[1].bestTime;
		let allCompleted = true;
		for (const record of records) if (!record.completed) { allCompleted = false; break; }
		slot.completed = allCompleted;
		slot.currentMission = resumeMission(slot);
		slot.highestUnlocked = math.max(slot.highestUnlocked ?? 1, highestCompleted(records) + 1);
		let latestBest: number | undefined;
		for (const record of records) if (record.bestTime !== undefined) latestBest = record.bestTime;
		slot.bestTime = latestBest;
		this.markDirty();
		return { completed, missionId, kills, elapsed };
	}

	public recordSeenCutscene(slotIndex: number, cutsceneId: string): void {
		if (!isValidSlot(slotIndex) || cutsceneId === "") return;
		const slot = this.profile.slots[slotIndex - 1];
		const seen = slot.seenCutscenes ?? [];
		if (seen.includes(cutsceneId)) return;
		seen.push(cutsceneId);
		slot.seenCutscenes = seen;
		slot.updatedAt = this.now();
		this.markDirty();
	}

	public setReducedMotion(slotIndex: number, enabled: boolean): void {
		if (!isValidSlot(slotIndex)) return;
		const slot = this.profile.slots[slotIndex - 1];
		if (slot.reducedMotion === enabled) return;
		slot.reducedMotion = enabled;
		slot.updatedAt = this.now();
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
