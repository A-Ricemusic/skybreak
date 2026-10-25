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
		expect(merged.slots[0].currentMission).toBe(3);
	});

	it("defaults to the unfinished mission, locks Mission 2, and permits Mission 1 replay", () => {
		const fresh = normalizeProfile(undefined).slots[0];
		expect(resolveMissionRequest(fresh, undefined)[0]).toBe(1);
		expect(resolveMissionRequest(fresh, 2)[0]).toBeUndefined();
		const progressed = normalizeProfile(profileWith(1, { mission1Completed: true })).slots[0];
		expect(resolveMissionRequest(progressed, undefined)[0]).toBe(2);
		expect(resolveMissionRequest(progressed, 1)[0]).toBe(1);
		expect(resolveMissionRequest(progressed, 2)[0]).toBe(2);
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
		const recorded = completeMission(coordinator, 1, 1, true, { slot: 1, kills: 3, elapsed: 53.33 }, (message) => {
			finalKind = message.kind;
			expect(message.saved).toBe(false);
		});
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

	it("recovers an initial load failure and merges retained local progress", () => {
		const store = new FakeStore(profileWith(1, { kills: 1 }));
		store.loadFailures = 1;
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(false);
		expect(coordinator.hasCloudLoaded()).toBe(false);
		expect(coordinator.getPersistence()).toBe("unavailable");

		coordinator.recordMissionResult(1, 1, true, 3, 64);
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
		coordinator.recordMissionResult(3, 1, true, 3, 72);
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
		coordinator.recordMissionResult(1, 1, true, 3, 80);
		coordinator.recordMissionResult(1, 1, true, 3, 95);
		coordinator.recordMissionResult(1, 1, true, 3, 65);
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

	it("records Mission 2 independently and unlocks M3 without completing the 27-mission campaign", () => {
		const store = new FakeStore(profileWith(1, { mission1Completed: true, mission1BestTime: 70 }));
		const { coordinator, deferred } = harness(store);
		coordinator.load();
		let finishedMission: number | undefined;
		expect(completeMission(coordinator, 1, 2, true, { slot: 1, missionId: 2, kills: 4, groundKills: 5, elapsed: 88 }, (message) => {
			finishedMission = message.missionId;
		})).toBe(true);
		expect(finishedMission).toBe(2);
		deferred.shift()!();
		const slot = normalizeProfile(store.data).slots[0];
		expect(slot.completed).toBe(false);
		expect(slot.currentMission).toBe(3);
		expect(slot.mission1BestTime).toBe(70);
		expect(slot.mission2BestTime).toBe(88);
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

	it("enforces required objectives and the 600-second mission limit", () => {
		const coordinator = new CampaignCoordinator("session_player");
		coordinator.load();
		let firstKind: string | undefined;
		completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 3, groundKills: 0, elapsed: 40 }, (message) => {
			firstKind = message.kind;
		});
		expect(firstKind).toBe("Failed");
		expect(coordinator.getSlots()[0].mission1Completed).toBe(false);

		let timeoutReason: string | undefined;
		completeMission(coordinator, 1, 1, true, { slot: 1, missionId: 1, kills: 3, groundKills: 1, elapsed: 601 }, (message) => {
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
		coordinator.recordMissionResult(4, 1, true, 3, 48);

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
});
