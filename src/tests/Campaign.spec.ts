import { describe, expect, it } from "@rbxts/jest-globals";
import {
	CampaignCoordinator,
	CampaignStore,
	canAttemptRecovery,
	completeMission,
	isValidSlot,
	mergeProfiles,
	normalizeProfile,
	serializeProfile,
	StoredProfile,
} from "../server/CampaignRepository";

class FakeStore implements CampaignStore {
	public data: unknown;
	public loadFailures = 0;
	public updateFailures = 0;
	public loads = 0;
	public updates = 0;

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
		if (this.updateFailures > 0) {
			this.updateFailures--;
			error("injected update failure");
		}
		this.data = transform(this.data);
		return this.data;
	}
}

function profileWith(slot: number, kills: number, completed = false, bestTime?: number): StoredProfile {
	const slots = new Map<string, object>();
	slots.set(tostring(slot), { occupied: true, kills, completed, bestTime });
	return { version: 1, slots };
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
	it("normalizes corrupt values and keeps all four slots isolated", () => {
		const raw = profileWith(2, 99, true, 51);
		const profile = normalizeProfile(raw);
		expect(profile.slots).toHaveLength(4);
		expect(profile.slots[0].occupied).toBe(false);
		expect(profile.slots[1].kills).toBe(3);
		expect(profile.slots[1].completed).toBe(true);
		expect(profile.slots[1].bestTime).toBe(51);
		expect(profile.slots[2].occupied).toBe(false);
		expect(profile.slots[3].occupied).toBe(false);
	});

	it("merges completion monotonically and preserves the fastest time", () => {
		const merged = mergeProfiles(profileWith(1, 3, true, 53.33), profileWith(1, 3, true, 70));
		expect(merged.slots[0].completed).toBe(true);
		expect(merged.slots[0].bestTime).toBe(53.33);
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

		coordinator.recordMissionStarted(1);
		expect(deferred).toHaveLength(1);
		let finalKind: string | undefined;
		const recorded = completeMission(coordinator, 1, true, { slot: 1, kills: 3, elapsed: 53.33 }, (message) => {
			finalKind = message.kind;
			expect(message.saved).toBe(false);
		});
		expect(recorded).toBe(true);
		expect(finalKind).toBe("Completed");
		expect(coordinator.getSlots()[0].completed).toBe(true);
		expect(coordinator.hasPendingSave()).toBe(true);
		expect(store.updates).toBe(0);

		deferred.shift()!();
		const stored = normalizeProfile(store.data);
		expect(store.updates).toBe(1);
		expect(stored.slots[0].completed).toBe(true);
		expect(stored.slots[0].bestTime).toBe(53.33);
		expect(coordinator.hasPendingSave()).toBe(false);
	});

	it("recovers an initial load failure and merges retained local progress", () => {
		const store = new FakeStore(profileWith(1, 1));
		store.loadFailures = 1;
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(false);
		expect(coordinator.hasCloudLoaded()).toBe(false);
		expect(coordinator.getPersistence()).toBe("unavailable");

		coordinator.recordMissionResult(1, true, 3, 64);
		expect(coordinator.recover()).toBe(true);
		expect(coordinator.hasCloudLoaded()).toBe(true);
		expect(coordinator.getSlots()[0].completed).toBe(true);
		expect(deferred).toHaveLength(1);
		deferred.shift()!();
		expect(normalizeProfile(store.data).slots[0].bestTime).toBe(64);
	});

	it("retains a failed result save and writes it on recovery", () => {
		const store = new FakeStore();
		const { coordinator, deferred } = harness(store);
		expect(coordinator.load()).toBe(true);
		store.updateFailures = 1;
		coordinator.recordMissionResult(3, true, 3, 72);
		deferred.shift()!();

		expect(coordinator.getPersistence()).toBe("unavailable");
		expect(coordinator.hasPendingSave()).toBe(true);
		expect(coordinator.getSlots()[2].completed).toBe(true);
		expect(coordinator.recover()).toBe(true);
		expect(normalizeProfile(store.data).slots[2].bestTime).toBe(72);
		expect(coordinator.hasPendingSave()).toBe(false);
	});

	it("preserves completion and best time across replays without touching other slots", () => {
		const store = new FakeStore(profileWith(2, 2));
		const { coordinator, deferred } = harness(store, 200);
		coordinator.load();
		coordinator.recordMissionResult(1, true, 3, 80);
		coordinator.recordMissionResult(1, true, 3, 95);
		coordinator.recordMissionResult(1, true, 3, 65);
		deferred.shift()!();

		const profile = normalizeProfile(store.data);
		expect(profile.slots[0].completed).toBe(true);
		expect(profile.slots[0].bestTime).toBe(65);
		expect(profile.slots[1].kills).toBe(2);
		expect(profile.slots[2].occupied).toBe(false);
		expect(profile.slots[3].occupied).toBe(false);
		expect(serializeProfile(profile).version).toBe(1);
	});
});
