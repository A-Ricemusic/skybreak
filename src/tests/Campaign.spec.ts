import { describe, expect, it } from "@rbxts/jest-globals";
import {
	CampaignCoordinator,
	CampaignStore,
	canAttemptRecovery,
	completeMission,
	isValidSlot,
	mergeProfiles,
	normalizeProfile,
	resolveMissionRequest,
	serializeProfile,
	StoredProfile,
} from "../server/CampaignRepository";
import { MissionCatalog } from "../shared/MissionCatalog";

class FakeStore implements CampaignStore {
	public data: unknown;
	public loadFailures = 0;
	public updateFailures = 0;
	public loads = 0;
	public updates = 0;
	public blockNextUpdate = false;
	public updateEntered = false;
	public releaseUpdate = false;

	public constructor(initial?: unknown) {
		this.data = initial;
	}

	public load(_key: string): unknown {
		this.loads++;
		if (this.loadFailures > 0) {
			this.loadFailures--;
			error("injected load failure");
		}
		return this.data;
	}

	public update(_key: string, transform: (current: unknown) => StoredProfile): unknown {
		this.updates++;
		if (this.blockNextUpdate) {
			this.blockNextUpdate = false;
			this.updateEntered = true;
			while (!this.releaseUpdate) task.wait();
		}
		if (this.updateFailures > 0) {
			this.updateFailures--;
			error("injected update failure");
		}
		this.data = transform(this.data);
		return this.data;
	}
}

function legacyProfileWith(slot: number, kills: number, completed = false, bestTime?: number): StoredProfile {
	const slots = new Map<string, object>();
	slots.set(tostring(slot), { occupied: true, kills, completed, bestTime });
	return { version: 1, slots };
}

function profileWith(
	slot: number,
	data: {
		kills?: number;
		mission1Completed?: boolean;
		mission2Completed?: boolean;
		mission1BestTime?: number;
		mission2BestTime?: number;
	},
): StoredProfile {
	const slots = new Map<string, object>();
	slots.set(tostring(slot), { occupied: true, ...data });
	return { version: 2, slots };
}

function harness(store: FakeStore, now = 100) {
	const deferred = new Array<() => void>();
	const coordinator = new CampaignCoordinator("player_42", store, {
		defer: (callback) => deferred.push(callback),
		now: () => now,
		maxAttempts: 1,
		retryWait: () => undefined,
		warn: () => undefined,
	});
	return { coordinator, deferred };
}

describe("Campaign domain unit tests", () => {
	it("migrates a completed v1 slot to Mission 1 only and keeps all four slots isolated", () => {
		const raw = legacyProfileWith(2, 99, true, 51);
		const profile = normalizeProfile(raw);
		expect(profile.slots).toHaveLength(4);
		expect(profile.slots[0].occupied).toBe(false);
		expect(profile.slots[1].kills).toBe(99);
		expect(profile.slots[1].mission1Completed).toBe(true);
		expect(profile.slots[1].mission2Completed).toBe(false);
		expect(profile.slots[1].completed).toBe(false);
		// Mission 1 complete unlocks mission 2 (sequential unlock).
		expect(profile.slots[1].currentMission).toBe(2);
		expect(profile.slots[1].mission1BestTime).toBe(51);
		expect(profile.slots[2].occupied).toBe(false);
		expect(profile.slots[3].occupied).toBe(false);
	});

	it("merges mission records monotonically and preserves each fastest time", () => {
		const stored = profileWith(1, { mission1Completed: true, mission1BestTime: 53.33 });
		const desired = profileWith(1, { mission1Completed: true, mission2Completed: true, mission1BestTime: 70, mission2BestTime: 91 });
		const merged = mergeProfiles(stored, desired);
		expect(merged.slots[0].completed).toBe(false);
		expect(merged.slots[0].mission1BestTime).toBe(53.33);
		expect(merged.slots[0].mission2BestTime).toBe(91);
		// Missions unlock in order: with mission 2 complete, mission 3 is the furthest open mission.
		expect(merged.slots[0].currentMission).toBe(3);
	});

	it("defaults to the unfinished mission, locks Mission 2 until Mission 1 is done, and permits Mission 1 replay", () => {
		const fresh = normalizeProfile(undefined).slots[0];
		expect(resolveMissionRequest(fresh, undefined)[0]).toBe(1);
		expect(resolveMissionRequest(fresh, 2)[0]).toBeUndefined();
		const progressed = normalizeProfile(profileWith(1, { mission1Completed: true })).slots[0];
		expect(resolveMissionRequest(progressed, undefined)[0]).toBe(2);
		expect(resolveMissionRequest(progressed, 1)[0]).toBe(1);
		expect(resolveMissionRequest(progressed, 2)[0]).toBe(2);
		expect(resolveMissionRequest(progressed, 3)[0]).toBeUndefined();
		// Mission 3 opens only after mission 2; mission 4 stays in development.
		const second = normalizeProfile(profileWith(1, { mission1Completed: true, mission2Completed: true })).slots[0];
		expect(resolveMissionRequest(second, undefined)[0]).toBe(3);
		expect(resolveMissionRequest(second, 3)[0]).toBe(3);
		expect(resolveMissionRequest(second, 4)[0]).toBeUndefined();
	});

	it("rejects fractional, out-of-range, and non-number slots", () => {
		expect(isValidSlot(1)).toBe(true);
		expect(isValidSlot(4)).toBe(true);
		expect(isValidSlot(0)).toBe(false);
		expect(isValidSlot(5)).toBe(false);
		expect(isValidSlot(1.5)).toBe(false);
		expect(isValidSlot("1")).toBe(false);
	});

	it("rate-limits recovery attempts", () => {
		expect(canAttemptRecovery(-math.huge, 10, 3)).toBe(true);
		expect(canAttemptRecovery(10, 12.99, 3)).toBe(false);
		expect(canAttemptRecovery(10, 13, 3)).toBe(true);
	});
});

describe("CampaignCoordinator datastore integration", () => {
	it("records completion while the startup save is delayed, then drains it", () => {
		const store = new FakeStore();
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(true);

		coordinator.recordMissionStarted(1, 1);
		expect(deferred).toHaveLength(1);
		let finalKind: string | undefined;
		// The harness never runs deferred writes, so the save stays pending; skip the flush wait (0) rather than time out.
		const recorded = completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 6, groundKills: 0, completedPhases: 1, elapsed: 53.33 }, (message) => {
			finalKind = message.kind;
			expect(message.saved).toBe(false);
		}, 0);
		expect(recorded).toBe(true);
		expect(finalKind).toBe("Completed");
		expect(coordinator.getSlots()[0].mission1Completed).toBe(true);
		expect(coordinator.getSlots()[0].completed).toBe(false);
		expect(coordinator.hasPendingSave()).toBe(true);
		expect(store.updates).toBe(0);

		deferred.shift()!();
		const stored = normalizeProfile(store.data);
		expect(store.updates).toBe(1);
		expect(stored.slots[0].mission1Completed).toBe(true);
		expect(stored.slots[0].mission1BestTime).toBe(53.33);
		expect(coordinator.hasPendingSave()).toBe(false);
	});

	it("confirms the save when the cloud write completes before the result is sent", () => {
		const store = new FakeStore();
		const coordinator = new CampaignCoordinator("player_42", store, {
			defer: (callback) => callback(),
			now: () => 100,
			maxAttempts: 1,
			retryWait: () => undefined,
			warn: () => undefined,
		});
		expect(coordinator.load()).toBe(true);
		coordinator.recordMissionStarted(1, 1);
		let saved: boolean | undefined;
		expect(completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 6, groundKills: 0, completedPhases: 1, elapsed: 53.33 }, (message) => {
			saved = message.saved;
		})).toBe(true);
		expect(saved).toBe(true);
		expect(coordinator.hasPendingSave()).toBe(false);
		expect(normalizeProfile(store.data).slots[0].mission1Completed).toBe(true);
	});

	it("recovers an initial load failure and merges retained local progress", () => {
		const store = new FakeStore(profileWith(1, { kills: 1 }));
		store.loadFailures = 1;
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(false);
		expect(coordinator.hasCloudLoaded()).toBe(false);
		expect(coordinator.getPersistence()).toBe("unavailable");

		coordinator.recordMissionResult(1, 1, true, 6, 64);
		expect(coordinator.recover()).toBe(true);
		expect(coordinator.hasCloudLoaded()).toBe(true);
		expect(coordinator.getSlots()[0].mission1Completed).toBe(true);
		expect(deferred).toHaveLength(1);
		deferred.shift()!();
		expect(normalizeProfile(store.data).slots[0].mission1BestTime).toBe(64);
	});

	it("retains a failed result save and writes it on recovery", () => {
		const store = new FakeStore();
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(true);
		store.updateFailures = 1;
		coordinator.recordMissionResult(3, 1, true, 6, 72);
		deferred.shift()!();

		expect(coordinator.getPersistence()).toBe("unavailable");
		expect(coordinator.hasPendingSave()).toBe(true);
		expect(coordinator.getSlots()[2].mission1Completed).toBe(true);
		expect(coordinator.recover()).toBe(true);
		expect(normalizeProfile(store.data).slots[2].mission1BestTime).toBe(72);
		expect(coordinator.hasPendingSave()).toBe(false);
	});

	it("preserves completion and best time across replays without touching other slots", () => {
		const store = new FakeStore(profileWith(2, { kills: 2 }));
		const { coordinator, deferred } = harness(store, 200);
		coordinator.load();
		coordinator.recordMissionResult(1, 1, true, 6, 80);
		coordinator.recordMissionResult(1, 1, true, 6, 95);
		coordinator.recordMissionResult(1, 1, true, 6, 65);
		deferred.shift()!();

		const profile = normalizeProfile(store.data);
		expect(profile.slots[0].mission1Completed).toBe(true);
		expect(profile.slots[0].completed).toBe(false);
		expect(profile.slots[0].mission1BestTime).toBe(65);
		expect(profile.slots[1].kills).toBe(2);
		expect(profile.slots[2].occupied).toBe(false);
		expect(profile.slots[3].occupied).toBe(false);
		expect(serializeProfile(profile).version).toBe(3);
	});

	it("does not record or notify a forged locked Mission 2 completion", () => {
 const { coordinator } = harness(new FakeStore()); coordinator.load();
 let notified=false;
 expect(completeMission(coordinator,1,2,true,{slot:1,missionId:2,kills:100,groundKills:100,completedPhases:1,elapsed:88},()=>{notified=true;})).toBe(false);
 expect(notified).toBe(false);expect(coordinator.getSlots()[0].mission2Completed).toBe(false);
 });

	it("ignores a result whose mission does not match the active server mission", () => {
		const { coordinator } = harness(new FakeStore());
		coordinator.load();
		let notified = false;
		expect(completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 2, kills: 4, groundKills: 5, elapsed: 50 }, () => {
			notified = true;
		})).toBe(false);
		expect(notified).toBe(false);
		expect(coordinator.getSlots()[0].occupied).toBe(false);
	});

	it("enforces required objectives and the mission time limit", () => {
		const coordinator = new CampaignCoordinator("session_player");
		coordinator.load();
		let firstKind: string | undefined;
		completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 5, groundKills: 0, completedPhases: 1, elapsed: 40 }, (message) => {
			firstKind = message.kind;
		});
		expect(firstKind).toBe("Failed");
		expect(coordinator.getSlots()[0].mission1Completed).toBe(false);

		let timeoutReason: string | undefined;
		completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 6, groundKills: 0, completedPhases: 1, elapsed: MissionCatalog.CountdownSeconds(1) + 1 }, (message) => {
			timeoutReason = message.reason;
		});
		expect(timeoutReason).toBe("timeout");
		expect(coordinator.getSlots()[0].mission1Completed).toBe(false);
	});

	it("waits for an outstanding write and drains a result recorded during shutdown", () => {
		const store = new FakeStore();
		store.blockNextUpdate = true;
		const coordinator = new CampaignCoordinator("player_42", store, {
			maxAttempts: 1,
			retryWait: () => undefined,
			warn: () => undefined,
		});
		expect(coordinator.load()).toBe(true);
		coordinator.recordMissionStarted(4, 1);

		const enteredDeadline = os.clock() + 1;
		while (!store.updateEntered && os.clock() < enteredDeadline) task.wait();
		expect(store.updateEntered).toBe(true);
		coordinator.recordMissionResult(4, 1, true, 6, 48);

		let flushReturned = false;
		let observedFlushWaiting = false;
		task.delay(0.05, () => {
			observedFlushWaiting = !flushReturned;
			store.releaseUpdate = true;
		});
		// Match the production shutdown budget; Studio may throttle background frames.
		expect(coordinator.flush(5)).toBe(true);
		flushReturned = true;

		expect(observedFlushWaiting).toBe(true);
		expect(store.updates).toBe(2);
		expect(coordinator.hasPendingSave()).toBe(false);
		const stored = normalizeProfile(store.data);
		expect(stored.slots[3].mission1Completed).toBe(true);
		expect(stored.slots[3].mission1BestTime).toBe(48);
	});

	it("deletes a slot in the cloud without merging the old progress back in", () => {
		const store = new FakeStore(profileWith(2, { kills: 4, mission1Completed: true, mission1BestTime: 70 }));
		const { coordinator, deferred } = harness(store, 300);
		coordinator.load();
		coordinator.recordMissionResult(1, 1, true, 6, 90);
		deferred.shift()!();

		coordinator.deleteSlot(2);
		expect(coordinator.getSlots()[1].occupied).toBe(false);
		deferred.shift()!();

		const stored = normalizeProfile(store.data);
		expect(stored.slots[1].occupied).toBe(false);
		expect(stored.slots[1].mission1Completed).toBe(false);
		expect(stored.slots[1].kills).toBe(0);
		expect(stored.slots[1].generation).toBe(1);
		expect(stored.slots[0].mission1BestTime).toBe(90);
		expect(coordinator.getSlots()[1].occupied).toBe(false);
	});

	it("keeps a deleted slot empty when merged with an older copy, then records fresh progress", () => {
		const old = profileWith(1, { kills: 5, mission1Completed: true, mission2Completed: true });
		const store = new FakeStore(old);
		const { coordinator, deferred } = harness(store, 400);
		coordinator.load();
		coordinator.deleteSlot(1);
		deferred.shift()!();

		const merged = mergeProfiles(old, store.data);
		expect(merged.slots[0].occupied).toBe(false);
		expect(merged.slots[0].mission2Completed).toBe(false);

		coordinator.recordMissionStarted(1, 1);
		coordinator.recordMissionResult(1, 1, true, 6, 120);
		deferred.shift()!();
		const fresh = normalizeProfile(store.data).slots[0];
		expect(fresh.occupied).toBe(true);
		expect(fresh.generation).toBe(1);
		expect(fresh.mission1BestTime).toBe(120);
		expect(fresh.mission2Completed).toBe(false);
		expect(fresh.currentMission).toBe(2);
	});

	it("remembers the slot's last special weapon, drops unknown ones, and keeps the newer choice on merge", () => {
		const store = new FakeStore();
		const { coordinator, deferred } = harness(store);
		coordinator.load();
		coordinator.recordMissionStarted(2, 1, "flares");
		coordinator.recordMissionStarted(3, 1, "bombs");
		deferred.shift()!();
		const profile = normalizeProfile(store.data);
		expect(profile.slots[1].special).toBe("flares");
		expect(profile.slots[2].special).toBeUndefined();
		expect(profile.slots[0].special).toBeUndefined();
		expect(coordinator.getSlots()[1].special).toBe("flares");
		const serialized = serializeProfile(profile);
		expect(normalizeProfile(serialized).slots[1].special).toBe("flares");

		const older = new Map<string, object>();
		older.set("1", { occupied: true, special: "uav", updatedAt: 100 });
		const newer = new Map<string, object>();
		newer.set("1", { occupied: true, special: "salvo", updatedAt: 200 });
		expect(mergeProfiles({ version: 3, slots: older }, { version: 3, slots: newer }).slots[0].special).toBe("salvo");
		expect(mergeProfiles({ version: 3, slots: newer }, { version: 3, slots: older }).slots[0].special).toBe("salvo");
		const blank = new Map<string, object>();
		blank.set("1", { occupied: true, updatedAt: 300 });
		expect(mergeProfiles({ version: 3, slots: older }, { version: 3, slots: blank }).slots[0].special).toBe("uav");
	});

	it("remembers the slot's last difficulty, drops unknown ones, and keeps the newer choice on merge", () => {
		const store = new FakeStore();
		const { coordinator, deferred } = harness(store);
		coordinator.load();
		coordinator.recordMissionStarted(2, 1, "uav", "ace");
		coordinator.recordMissionStarted(3, 1, "uav", "brutal");
		coordinator.recordMissionStarted(4, 1);
		deferred.shift()!();
		const profile = normalizeProfile(store.data);
		expect(profile.slots[1].difficulty).toBe("ace");
		expect(profile.slots[2].difficulty).toBeUndefined();
		expect(profile.slots[3].difficulty).toBeUndefined();
		expect(coordinator.getSlots()[1].difficulty).toBe("ace");
		const serialized = serializeProfile(profile);
		expect(normalizeProfile(serialized).slots[1].difficulty).toBe("ace");

		const older = new Map<string, object>();
		older.set("1", { occupied: true, difficulty: "easy", updatedAt: 100 });
		const newer = new Map<string, object>();
		newer.set("1", { occupied: true, difficulty: "ace", updatedAt: 200 });
		expect(mergeProfiles({ version: 3, slots: older }, { version: 3, slots: newer }).slots[0].difficulty).toBe("ace");
		expect(mergeProfiles({ version: 3, slots: newer }, { version: 3, slots: older }).slots[0].difficulty).toBe("ace");
		const blank = new Map<string, object>();
		blank.set("1", { occupied: true, updatedAt: 300 });
		expect(mergeProfiles({ version: 3, slots: older }, { version: 3, slots: blank }).slots[0].difficulty).toBe("easy");
	});
});
