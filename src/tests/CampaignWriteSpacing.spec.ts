import { describe, expect, it } from "@rbxts/jest-globals";
import {
	CAMPAIGN_WRITE_SPACING,
	CampaignCoordinator,
	CampaignStore,
	blankProfile,
	normalizeProfile,
	serializeProfile,
} from "../server/CampaignRepository";

// Synthetic store and fake scheduler only; no DataStore access and no engine clock.
function fixture(writeSpacing = CAMPAIGN_WRITE_SPACING) {
	let stored: unknown = serializeProfile(blankProfile());
	let clock = 0;
	let updates = 0;
	let duringWrite: (() => void) | undefined;
	const deferred: (() => void)[] = [];
	const delayed: { at: number; callback: () => void }[] = [];
	const store: CampaignStore = {
		load() {
			return stored;
		},
		update(_key, transform) {
			updates++;
			duringWrite?.();
			stored = transform(stored);
			return stored;
		},
	};
	const runDue = () => {
		while (deferred.size() > 0) deferred.shift()!();
		let index = 0;
		while (index < delayed.size()) {
			if (delayed[index].at <= clock) {
				const entry = delayed[index];
				delayed.remove(index);
				entry.callback();
				index = 0;
			} else index++;
		}
	};
	const coordinator = new CampaignCoordinator("spacing", store, {
		clock: () => clock,
		wait: () => {
			clock += 1;
			runDue();
		},
		defer: (callback) => {
			deferred.push(callback);
		},
		delay: (seconds, callback) => {
			delayed.push({ at: clock + seconds, callback });
		},
		writeSpacing,
		now: () => 1000,
		maxAttempts: 1,
		warn: () => undefined,
	});
	coordinator.load();
	return {
		coordinator,
		runDue,
		/** Step the fake clock one second at a time, firing whatever became due. */
		advance: (seconds: number) => {
			for (let i = 0; i < seconds; i++) {
				clock += 1;
				runDue();
			}
		},
		setDuringWrite: (callback: (() => void) | undefined) => {
			duringWrite = callback;
		},
		clock: () => clock,
		updates: () => updates,
		pendingDelayed: () => delayed.size(),
		stored: () => normalizeProfile(stored),
	};
}

/** The unspaced baseline: every operation written as soon as it is deferred. */
function reference(apply: (c: CampaignCoordinator) => void) {
	const f = fixture(0);
	apply(f.coordinator);
	f.runDue();
	expect(f.coordinator.hasPendingSave()).toBe(false);
	return f.stored();
}

describe("Campaign write spacing", () => {
	it("coalesces a same-frame burst of twenty deletes into one write with the same final profile", () => {
		const f = fixture();
		for (let i = 0; i < 20; i++) f.coordinator.deleteSlot((i % 4) + 1);
		f.runDue();
		expect(f.updates()).toBe(1);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		expect(f.coordinator.getDeletions().size()).toBe(4);
		for (const receipt of f.coordinator.getDeletions()) expect(receipt.status).toBe("confirmed");
		for (const slot of f.stored().slots) {
			expect(slot.occupied).toBe(false);
			expect(slot.generation).toBe(5);
		}
		expect(f.stored()).toEqual(
			reference((c) => {
				for (let i = 0; i < 20; i++) c.deleteSlot((i % 4) + 1);
			}),
		);
	});

	it("bounds a sustained delete burst to one write per spacing window and converges on the same profile", () => {
		const f = fixture();
		for (let i = 0; i < 20; i++) {
			f.coordinator.deleteSlot((i % 4) + 1);
			f.advance(1);
		}
		// Twenty seconds of one-per-second deletes: the first write is immediate, then one per six seconds.
		expect(f.updates()).toBeLessThanOrEqual(1 + math.ceil(20 / CAMPAIGN_WRITE_SPACING));
		expect(f.updates()).toBeGreaterThanOrEqual(2);
		f.advance(CAMPAIGN_WRITE_SPACING + 1);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		expect(f.updates()).toBeLessThanOrEqual(2 + math.ceil(20 / CAMPAIGN_WRITE_SPACING));
		for (const receipt of f.coordinator.getDeletions()) expect(receipt.status).toBe("confirmed");
		expect(f.stored()).toEqual(
			reference((c) => {
				for (let i = 0; i < 20; i++) c.deleteSlot((i % 4) + 1);
			}),
		);
	});

	it("never writes twice inside one window from deferred saves alone", () => {
		const f = fixture();
		const writeTimes: number[] = [];
		f.setDuringWrite(() => writeTimes.push(f.clock()));
		for (let i = 0; i < 40; i++) {
			f.coordinator.recordMissionStarted((i % 4) + 1, 1);
			f.coordinator.recordCutsceneSeen((i % 4) + 1, 0);
			f.advance(1);
		}
		f.advance(CAMPAIGN_WRITE_SPACING + 1);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		for (let i = 1; i < writeTimes.size(); i++)
			expect(writeTimes[i] - writeTimes[i - 1]).toBeGreaterThanOrEqual(CAMPAIGN_WRITE_SPACING);
		for (const slot of f.stored().slots) {
			expect(slot.occupied).toBe(true);
			expect(slot.introSeen).toBe(true);
		}
	});

	it("lets flush bypass the window and promote a delayed write; the stale timer then does nothing", () => {
		const f = fixture();
		f.coordinator.recordMissionStarted(1, 1);
		f.runDue();
		expect(f.updates()).toBe(1);
		f.advance(1);
		f.coordinator.recordMissionStarted(2, 1);
		expect(f.pendingDelayed()).toBe(1);
		expect(f.updates()).toBe(1);
		expect(f.coordinator.flush(2)).toBe(true);
		expect(f.updates()).toBe(2);
		expect(f.clock()).toBe(2);
		expect(f.stored().slots[1].occupied).toBe(true);
		// The superseded timer fires inside the original window without a third write.
		f.advance(CAMPAIGN_WRITE_SPACING);
		expect(f.pendingDelayed()).toBe(0);
		expect(f.updates()).toBe(2);
		expect(f.coordinator.hasPendingSave()).toBe(false);
	});

	it("defers progress recorded during a deferred write to the next window instead of writing back-to-back", () => {
		const f = fixture();
		let once = false;
		f.setDuringWrite(() => {
			if (once) return;
			once = true;
			f.coordinator.recordMissionStarted(2, 1);
		});
		f.coordinator.deleteSlot(1);
		f.runDue();
		expect(f.updates()).toBe(1);
		expect(f.coordinator.getDeletions()[0].status).toBe("confirmed");
		expect(f.coordinator.hasPendingSave()).toBe(true);
		expect(f.pendingDelayed()).toBe(1);
		f.advance(CAMPAIGN_WRITE_SPACING - 1);
		expect(f.updates()).toBe(1);
		f.advance(1);
		expect(f.updates()).toBe(2);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		expect(f.stored().slots[1].occupied).toBe(true);
		expect(f.stored().slots[0].occupied).toBe(false);
	});

	it("recover writes immediately even inside the window", () => {
		const f = fixture();
		f.coordinator.recordMissionStarted(1, 1);
		f.runDue();
		f.advance(1);
		f.coordinator.recordMissionStarted(3, 1);
		expect(f.updates()).toBe(1);
		expect(f.coordinator.recover()).toBe(true);
		expect(f.updates()).toBe(2);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		f.advance(CAMPAIGN_WRITE_SPACING);
		expect(f.updates()).toBe(2);
	});
});
