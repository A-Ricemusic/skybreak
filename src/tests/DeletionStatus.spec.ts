import { describe, expect, it } from "@rbxts/jest-globals";
import {
	CampaignCoordinator,
	CampaignStore,
	blankProfile,
	serializeProfile,
	normalizeProfile,
} from "../server/CampaignRepository";

// All data is synthetic and all writes stay inside this fake; no DataStore access.
function fixture(fail = false, writeSpacing = 0) {
	let stored: unknown = serializeProfile(blankProfile());
	let queued: (() => void) | undefined;
	let delayed: { at: number; callback: () => void } | undefined;
	let duringWrite: (() => void) | undefined;
	let clock = 0;
	let updates = 0;
	const store: CampaignStore = {
		load() {
			return stored;
		},
		update(_key, transform) {
			updates++;
			duringWrite?.();
			if (fail) error("synthetic write failure");
			stored = transform(stored);
			return stored;
		},
	};
	const coordinator = new CampaignCoordinator("synthetic-deletion-only", store, {
		defer: (callback) => {
			queued = callback;
		},
		delay: (seconds, callback) => {
			delayed = { at: clock + seconds, callback };
		},
		writeSpacing,
		maxAttempts: 1,
		warn: () => undefined,
		now: () => 100,
		clock: () => clock,
		wait: () => {
			clock += 1;
		},
	});
	coordinator.load();
	return {
		coordinator,
		run: () => {
			const callback = queued;
			queued = undefined;
			callback?.();
		},
		/** Advance the fake clock to the spaced write and run it. */
		runDelayed: () => {
			const entry = delayed;
			delayed = undefined;
			if (!entry) return;
			clock = math.max(clock, entry.at);
			entry.callback();
		},
		delayedAt: () => delayed?.at,
		updates: () => updates,
		setFail: (value: boolean) => {
			fail = value;
		},
		setDuringWrite: (callback: () => void) => {
			duringWrite = callback;
		},
		stored: () => normalizeProfile(stored),
	};
}

describe("deletion durability receipts", () => {
	it("keeps overlapping slot deletes and repeated generations distinct", () => {
		const f = fixture();
		f.coordinator.deleteSlot(1);
		f.coordinator.deleteSlot(2);
		f.coordinator.deleteSlot(1);
		expect(f.coordinator.getDeletions().size()).toBe(2);
		f.run();
		for (const receipt of f.coordinator.getDeletions()) {
			expect(receipt.status).toBe("confirmed");
			expect(f.stored().slots[receipt.slot - 1].generation).toBe(receipt.generation);
		}
	});
	it("does not confirm a conflicting returned generation or occupied slot", () => {
		for (const occupied of [true, false]) {
			const stored = blankProfile();
			let queued: (() => void) | undefined;
			const c = new CampaignCoordinator(
				"synthetic-conflicting-receipt",
				{
					load() {
						return serializeProfile(stored);
					},
					update(_key, transform) {
						const returned = normalizeProfile(transform(serializeProfile(stored)));
						returned.slots[0].occupied = occupied;
						if (!occupied) returned.slots[0].generation = (returned.slots[0].generation ?? 0) + 1;
						return serializeProfile(returned);
					},
				},
				{
					defer: (callback) => {
						queued = callback;
					},
					maxAttempts: 1,
					warn: () => undefined,
				},
			);
			c.load();
			c.deleteSlot(1);
			queued?.();
			expect(c.getDeletions()[0].status).toBe("failed");
		}
	});

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
		f.coordinator.deleteSlot(1);
		f.run();
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
		const c = new CampaignCoordinator("synthetic-session-only", undefined, {
			defer: () => undefined,
			warn: () => undefined,
		});
		c.load();
		c.deleteSlot(2);
		expect(c.flush()).toBe(true);
		expect(c.getDeletions()[0].status).toBe("session-only");
	});
	it("late completion and status checks preserve a newly recreated slot", () => {
		const f = fixture();
		f.coordinator.deleteSlot(1);
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
		f.coordinator.getDeletions();
		f.coordinator.recover();
		expect(f.stored().slots[0].occupied).toBe(true);
	});
	it("confirms a failed deletion after a successful recovery write", () => {
		const f = fixture(true);
		f.coordinator.deleteSlot(1);
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("failed");
		f.setFail(false);
		expect(f.coordinator.recover()).toBe(true);
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
	});
	it("reports late failure after an inflight timeout", () => {
		const f = fixture(true);
		f.coordinator.deleteSlot(1);
		f.setDuringWrite(() => {
			expect(f.coordinator.flush(1)).toBe(false);
			expect(f.coordinator.getDeletions()[0].status).toBe("pending");
		});
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("failed");
	});
	it("recovery retries current progress without deleting a recreated slot", () => {
		const f = fixture(true);
		f.coordinator.deleteSlot(1);
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("failed");
		f.coordinator.recordMissionStarted(1);
		f.setFail(false);
		f.run();
		expect(f.stored().slots[0].occupied).toBe(true);
		expect(f.stored().slots[0].generation).toBe(1);
		// The blank tombstone was never acknowledged, so do not claim it was.
		expect(f.coordinator.getDeletions()[0].status).toBe("failed");
	});
	it("reports a write-spaced deletion as pending, not failed, until its window opens", () => {
		const f = fixture(false, 6);
		f.coordinator.deleteSlot(1);
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
		expect(f.updates()).toBe(1);
		// The second delete lands inside the spacing window: deferred, not written, not failed.
		f.coordinator.deleteSlot(2);
		expect(f.updates()).toBe(1);
		expect(f.delayedAt()).toBe(6);
		expect(f.coordinator.hasPendingSave()).toBe(true);
		expect(f.coordinator.getPersistence()).toBe("cloud");
		for (const receipt of f.coordinator.getDeletions())
			expect(receipt.status).toBe(receipt.slot === 1 ? "confirmed" : "pending");
		f.runDelayed();
		expect(f.updates()).toBe(2);
		expect(f.coordinator.getDeletions().every((receipt) => receipt.status === "confirmed")).toBe(true);
		expect(f.stored().slots[1].generation).toBe(1);
	});
	it("a queued write is still pending when its flush deadline expires", () => {
		const f = fixture();
		f.coordinator.deleteSlot(1);
		expect(f.coordinator.flush(1)).toBe(false);
		expect(f.coordinator.getDeletions()[0].status).toBe("pending");
		f.run();
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
	});
});
