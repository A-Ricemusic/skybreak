import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, normalizeProfile } from "../server/CampaignRepository";
import { CampaignShutdown } from "../server/CampaignShutdown";

function fixture(writeAt: number) {
	let clock = 0;
	let stored: unknown;
	const deferred: (() => void)[] = [];
	const wait = () => {
		clock += 1;
		if (clock >= writeAt) {
			const write = deferred.shift();
			if (write) write();
		}
	};
	const coordinator = new CampaignCoordinator(
		"slow",
		{
			load: () => undefined,
			update: (_key, transform) => {
				stored = transform(stored);
				return stored;
			},
		},
		{
			clock: () => clock,
			wait,
			defer: (fn) => {
				deferred.push(fn);
			},
			now: () => 1000,
		},
	);
	coordinator.load();
	coordinator.recordMissionResult(1, 1, true, 6, 100);
	const shutdown = new CampaignShutdown(() => clock, wait);
	shutdown.track(coordinator, () => true);
	return { coordinator, shutdown, clock: () => clock, stored: () => stored };
}

describe("Campaign shutdown shared deadline", () => {
	it("waits beyond the five-second removal flush for an already-closing player's earned win", () => {
		const f = fixture(12);
		expect(f.shutdown.flushPlayer(f.coordinator)).toBe(false);
		expect(f.clock()).toBe(5);
		expect(f.shutdown.pending()).toBe(1);
		expect(f.shutdown.awaitDeadline(f.clock() + 28)).toBe(true);
		expect(f.clock()).toBe(12);
		expect(f.shutdown.pending()).toBe(0);
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
	});

	it("retains unresolved state until the shared deadline and reports failure", () => {
		const f = fixture(40);
		expect(f.shutdown.awaitDeadline(28)).toBe(false);
		expect(f.clock()).toBe(28);
		expect(f.shutdown.pending()).toBe(1);
		expect(f.coordinator.hasPendingSave()).toBe(true);
	});

	it("also waits for a profile load still running during removal", () => {
		let clock = 0;
		const coordinator = new CampaignCoordinator("loading");
		const shutdown = new CampaignShutdown(
			() => clock,
			() => {
				clock++;
			},
		);
		shutdown.track(coordinator, () => clock >= 9);
		expect(shutdown.flushPlayer(coordinator)).toBe(false);
		expect(shutdown.awaitDeadline(28)).toBe(true);
		expect(clock).toBe(9);
	});
});
