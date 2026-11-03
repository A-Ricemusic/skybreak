import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, normalizeProfile } from "../server/CampaignRepository";

function fixture(initial?: unknown, maxAttempts = 1) {
	let stored = initial;
	let writes = 0;
	let attempts = 0;
	let failLoads = 0;
	let beforeUpdate: (() => void) | undefined;
	const deferred: (() => void)[] = [];
	const coordinator = new CampaignCoordinator(
		"schema",
		{
			load() {
				if (failLoads > 0) {
					failLoads -= 1;
					error("transient load failure");
				}
				return stored;
			},
			update(_key, transform) {
				attempts++;
				beforeUpdate?.();
				const updated = transform(stored);
				writes++;
				stored = updated;
				return stored;
			},
		},
		{
			defer: (fn) => {
				deferred.push(fn);
			},
			maxAttempts,
			retryWait: () => undefined,
			warn: () => undefined,
			now: () => 1000,
		},
	);
	return {
		coordinator,
		attempts: () => attempts,
		failNextLoads: (count: number) => {
			failLoads = count;
		},
		onBeforeUpdate: (hook: (() => void) | undefined) => {
			beforeUpdate = hook;
		},
		writes: () => writes,
		stored: () => stored,
		replace: (value: unknown) => {
			stored = value;
		},
		drain: () => {
			deferred.shift()?.();
		},
	};
}

describe("Campaign fail-closed schema", () => {
	for (const raw of [
		{ version: 4, slots: {}, futureProgress: "preserve" },
		"broken",
		42,
		{},
		{ version: 3 },
		{ version: 3, slots: "broken" },
		{ version: 3, slots: { "1": "broken" } },
		{ version: 3, slots: { unexpected: {} } },
		{ version: 1.5, slots: {} },
		{ slots: {} },
		// A present mission container or a mission record the reader would consume must be a table.
		{ version: 3, slots: { "1": { occupied: true, missions: "damaged-export" } } },
		{
			version: 3,
			slots: { "1": { occupied: true, missions: { "1": "damaged-record", "2": { completed: true } } } },
		},
		{ version: 3, slots: { "2": { occupied: true, missions: [{ completed: true }, 7] } } },
		{ version: 2, slots: { "1": { mission1Completed: true, missions: false } } },
	]) {
		it(`protects an unreadable existing profile (${tostring(raw)}) from load and save`, () => {
			const f = fixture(raw);
			expect(f.coordinator.load()).toBe(false);
			expect(f.coordinator.hasCloudLoaded()).toBe(false);
			expect(f.coordinator.getPersistence()).toBe("unavailable");
			expect(f.coordinator.getLoadError()).toBeDefined();
			f.coordinator.recordMissionStarted(1);
			f.drain();
			expect(f.coordinator.flush(0)).toBe(false);
			expect(f.coordinator.recover()).toBe(false);
			expect(f.writes()).toBe(0);
			expect(f.stored()).toBe(raw);
		});
	}

	it("creates a writable fresh profile only for an absent key", () => {
		const f = fixture();
		expect(f.coordinator.load()).toBe(true);
		f.coordinator.recordMissionStarted(1);
		f.drain();
		expect(f.writes()).toBe(1);
		expect(f.coordinator.flush(0)).toBe(true);
		expect(normalizeProfile(f.stored()).slots[0].occupied).toBe(true);
	});

	for (const replacement of [
		{ version: 4, slots: {}, future: true },
		{ version: 3, slots: false },
		{ version: 3, slots: { "1": { occupied: true, kills: 9, missions: "damaged-export" } } },
		{ version: 3, slots: { "1": { occupied: true, missions: { "0": { completed: true }, "3": 12 } } } },
	])
		it("protects an unreadable record appearing inside UpdateAsync after load", () => {
			const f = fixture();
			f.coordinator.load();
			f.replace(replacement);
			f.coordinator.recordMissionResult(1, 1, true, 6, 100);
			f.drain();
			expect(f.writes()).toBe(0);
			expect(f.stored()).toBe(replacement);
			expect(f.coordinator.hasCloudLoaded()).toBe(false);
			expect(f.coordinator.getLoadError()).toBeDefined();
			expect(f.coordinator.flush(0)).toBe(false);
			expect(f.coordinator.getSlots()[0].missions?.[1]?.completed).toBe(true);
		});

	it("stops automatic write retries on schema refusal and requires a readable recovery load", () => {
		const f = fixture(undefined, 3);
		f.coordinator.load();
		const unsupported = { version: 4, slots: {} };
		f.replace(unsupported);
		f.coordinator.recordMissionResult(1, 1, true, 6, 100);
		f.drain();
		expect(f.attempts()).toBe(1);
		expect(f.writes()).toBe(0);
		expect(f.stored()).toBe(unsupported);
		expect(f.coordinator.hasCloudLoaded()).toBe(false);
		f.replace({ version: 3, slots: {} });
		expect(f.coordinator.recover()).toBe(true);
		f.drain();
		expect(f.coordinator.hasCloudLoaded()).toBe(true);
		expect(f.coordinator.getLoadError()).toBeUndefined();
		expect(f.writes()).toBe(1);
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
	});

	it("still retries transient recovery errors after an earlier schema refusal", () => {
		const f = fixture(undefined, 3);
		f.coordinator.load();
		const unsupported = { version: 4, slots: {} };
		f.replace(unsupported);
		f.coordinator.recordMissionResult(1, 1, true, 6, 100);
		f.drain();
		expect(f.attempts()).toBe(1);
		expect(f.coordinator.getLoadError()).toBeDefined();
		f.replace({ version: 3, slots: {} });
		f.failNextLoads(1);
		expect(f.coordinator.recover()).toBe(true);
		f.drain();
		expect(f.coordinator.hasCloudLoaded()).toBe(true);
		expect(f.coordinator.getLoadError()).toBeUndefined();
		expect(f.writes()).toBe(1);
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
	});

	it("keeps retrying a transient write error when another thread raised a refusal mid-operation", () => {
		const f = fixture({ version: 3, slots: {} }, 3);
		expect(f.coordinator.load()).toBe(true);
		let interleaved = false;
		f.onBeforeUpdate(() => {
			if (interleaved) return;
			interleaved = true;
			// While this write is "yielding" in UpdateAsync, a concurrent load on another thread refuses a v4 record.
			const valid = f.stored();
			f.replace({ version: 4, slots: {} });
			coroutine.wrap(() => f.coordinator.load())();
			f.replace(valid);
			error("transient update failure");
		});
		f.coordinator.recordMissionResult(1, 1, true, 6, 100);
		f.drain();
		expect(interleaved).toBe(true);
		expect(f.attempts()).toBe(2);
		expect(f.writes()).toBe(1);
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
	});

	it("keeps loading legitimate mission shapes: absent, empty, and retired-campaign keys it does not read", () => {
		for (const slot of [
			{ occupied: true },
			{ occupied: true, missions: {} },
			{ occupied: true, missions: { "27": "retired-campaign-noise", "4": { completed: true } } },
		]) {
			const f = fixture({ version: 3, slots: { "1": slot } });
			expect(f.coordinator.load()).toBe(true);
			expect(f.coordinator.getLoadError()).toBeUndefined();
			f.coordinator.recordMissionStarted(1);
			f.drain();
			expect(f.writes()).toBe(1);
			expect(normalizeProfile(f.stored()).slots[0].occupied).toBe(true);
		}
	});

	for (const version of [1, 2, 3])
		it(`explicitly migrates supported schema v${version}`, () => {
			const f = fixture({ version, slots: { "1": { completed: true, mission2Completed: true, bestTime: 50 } } });
			expect(f.coordinator.load()).toBe(true);
			expect(f.coordinator.getSlots()[0].mission1Completed).toBe(true);
			expect(f.coordinator.getSlots()[0].mission2Completed).toBe(true);
			f.coordinator.recordMissionStarted(1);
			f.drain();
			expect(normalizeProfile(f.stored()).version).toBe(3);
		});
});
