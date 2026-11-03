import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, normalizeProfile } from "../server/CampaignRepository";

function fixture(initial?: unknown) {
	let stored = initial;
	let writes = 0;
	const deferred: (() => void)[] = [];
	const coordinator = new CampaignCoordinator(
		"schema",
		{
			load() {
				return stored;
			},
			update(_key, transform) {
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
			maxAttempts: 1,
			warn: () => undefined,
			now: () => 1000,
		},
	);
	return {
		coordinator,
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
