import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, CampaignStore, blankProfile, serializeProfile, normalizeProfile } from "../server/CampaignRepository";

// All data is synthetic and all writes stay inside this fake; no DataStore access.
function fixture(fail = false) {
	let stored: unknown = serializeProfile(blankProfile());
	let queued: (() => void) | undefined;
	let duringWrite: (() => void) | undefined;
	let clock = 0;
	const store: CampaignStore = {
		load: () => stored,
		update: (_key, transform) => {
			duringWrite?.();
			if (fail) error("synthetic write failure");
			stored = transform(stored);
			return stored;
		},
	};
	const coordinator = new CampaignCoordinator("synthetic-deletion-only", store, {
		defer: (callback) => { queued = callback; },
		maxAttempts: 1, warn: () => undefined, now: () => 100,
		clock: () => clock, wait: () => { clock += 1; },
	});
	coordinator.load();
	return {
		coordinator,
		run: () => { const callback = queued; queued = undefined; callback?.(); },
		setDuringWrite: (callback: () => void) => { duringWrite = callback; },
		stored: () => normalizeProfile(stored),
	};
}

describe("deletion durability receipts", () => {
	it("confirms only after a successful tombstone write", () => {
		const f = fixture();
		f.coordinator.deleteSlot(1);
		expect(f.coordinator.getDeletions()[0].status).toBe("pending");
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
		expect(f.stored().slots[0].generation).toBe(1);
	});
	it("reports exhausted writes as failed and retains the tombstone for recovery", () => {
		const f = fixture(true);
		f.coordinator.deleteSlot(1); f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("failed");
		expect(f.coordinator.hasPendingSave()).toBe(true);
		expect(f.stored().slots[0].generation).toBe(0);
	});
	it("keeps a deadline-exceeded inflight write pending, then confirms late", () => {
		const f = fixture();
		f.coordinator.deleteSlot(1);
		f.setDuringWrite(() => {
			expect(f.coordinator.flush(1)).toBe(false);
			expect(f.coordinator.getPersistence()).toBe("cloud");
			expect(f.coordinator.getDeletions()[0].status).toBe("pending");
		});
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
	});
	it("does not claim cloud confirmation in a session-only coordinator", () => {
		const c = new CampaignCoordinator("synthetic-session-only"); c.load(); c.deleteSlot(2);
		expect(c.flush()).toBe(true);
		expect(c.getDeletions()[0].status).toBe("session-only");
	});
	it("late completion and status checks preserve a newly recreated slot", () => {
		const f = fixture(); f.coordinator.deleteSlot(1);
		let recreated = false;
		f.setDuringWrite(() => {
			if (recreated) return;
			recreated = true;
			f.coordinator.recordMissionStarted(1);
		});
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
		expect(f.coordinator.getSlots()[0].occupied).toBe(true);
		expect(f.stored().slots[0].occupied).toBe(true);
		expect(f.stored().slots[0].generation).toBe(1);
		f.coordinator.getDeletions(); f.coordinator.recover();
		expect(f.stored().slots[0].occupied).toBe(true);
	});
	it("a queued write is still pending when its flush deadline expires", () => {
		const f = fixture(); f.coordinator.deleteSlot(1);
		expect(f.coordinator.flush(1)).toBe(false);
		expect(f.coordinator.getDeletions()[0].status).toBe("pending");
		f.run(); expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
	});
});
