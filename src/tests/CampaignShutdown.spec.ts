import { describe, expect, it } from "@rbxts/jest-globals";
import { CampaignCoordinator, normalizeProfile } from "../server/CampaignRepository";
import {
	CampaignShutdown,
	SHUTDOWN_RETRY_CAP,
	SHUTDOWN_RETRY_GIVE_UP,
	SHUTDOWN_RETRY_INITIAL,
} from "../server/CampaignShutdown";

function fixture(writeAt: number, duringWait?: () => void) {
	let clock = 0;
	let stored: unknown;
	const deferred: (() => void)[] = [];
	const wait = () => {
		clock += 1;
		duringWait?.();
		if (clock >= writeAt) {
			const write = deferred.shift();
			if (write) write();
		}
	};
	const coordinator = new CampaignCoordinator(
		"slow",
		{
			load() {
				return undefined;
			},
			update(_key, transform) {
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

	it("joins a PlayerRemoving flush that is still running when BindToClose starts", () => {
		let joined = false;
		let waitedUntil = 0;
		const f = fixture(12, () => {
			if (joined) return;
			joined = true;
			expect(f.shutdown.awaitDeadline(f.clock() + 28)).toBe(true);
			waitedUntil = f.clock();
		});
		expect(f.shutdown.flushPlayer(f.coordinator)).toBe(true);
		expect(joined).toBe(true);
		expect(waitedUntil).toBe(12);
		expect(f.shutdown.pending()).toBe(0);
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
		const coordinator = new CampaignCoordinator("loading", undefined, { defer: (fn) => fn() });
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

// Background retry after PlayerRemoving: a failing store, a fake clock and an explicit deferred queue.
function retryFixture(failures: number) {
	let clock = 0;
	let stored: unknown;
	let updates = 0;
	let warnings = 0;
	const deferred: (() => void)[] = [];
	const runDeferred = () => {
		while (deferred.size() > 0) deferred.shift()!();
	};
	const wait = () => {
		clock += 1;
		runDeferred();
	};
	const coordinator = new CampaignCoordinator(
		"departed",
		{
			load() {
				return undefined;
			},
			update(_key, transform) {
				updates++;
				if (failures > 0) {
					failures -= 1;
					error("synthetic outage");
				}
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
			maxAttempts: 1,
			retryWait: () => undefined,
			warn: () => undefined,
		},
	);
	coordinator.load();
	coordinator.recordMissionResult(1, 1, true, 6, 100);
	const shutdown = new CampaignShutdown(
		() => clock,
		wait,
		() => {
			warnings++;
		},
	);
	shutdown.track(coordinator, () => true);
	const attempts: number[] = [];
	// One driver tick per second: writes land, then the background pass runs (production ticks every 5 s).
	const tick = () => {
		clock += 1;
		runDeferred();
		if (shutdown.retry(clock) > 0) attempts.push(clock);
	};
	return {
		coordinator,
		shutdown,
		tick,
		attempts,
		clock: () => clock,
		stored: () => stored,
		updates: () => updates,
		warnings: () => warnings,
		recover: () => {
			failures = 0;
		},
	};
}

describe("Campaign shutdown background retry", () => {
	it("retries a departed player's failed save with backoff until it lands, without BindToClose", () => {
		// Five failures inside the removal flush, two more across retries, then the store recovers.
		const f = retryFixture(7);
		expect(f.shutdown.flushPlayer(f.coordinator)).toBe(false);
		expect(f.clock()).toBe(5);
		expect(f.updates()).toBe(5);
		while (f.shutdown.pending() > 0 && f.clock() < SHUTDOWN_RETRY_GIVE_UP) f.tick();
		expect(f.shutdown.pending()).toBe(0);
		// The flush leaves one deferred write (failure 6). Retries follow 15 s and 30 s later (failure 7, then the
		// landing write); the pass 60 s after that only observes the landed write and untracks the profile.
		expect(f.attempts).toEqual([
			5 + SHUTDOWN_RETRY_INITIAL,
			5 + SHUTDOWN_RETRY_INITIAL * 3,
			5 + SHUTDOWN_RETRY_INITIAL * 7,
		]);
		expect(f.updates()).toBe(8);
		expect(f.coordinator.hasPendingSave()).toBe(false);
		expect(f.coordinator.getPersistence()).toBe("cloud");
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
		expect(f.warnings()).toBe(0);
	});

	it("stops retrying after the cap with one warning and stays tracked for BindToClose", () => {
		const f = retryFixture(math.huge);
		expect(f.shutdown.flushPlayer(f.coordinator)).toBe(false);
		while (f.clock() < SHUTDOWN_RETRY_GIVE_UP * 2 + 400) f.tick();
		expect(f.shutdown.pending()).toBe(1);
		expect(f.coordinator.hasPendingSave()).toBe(true);
		expect(f.coordinator.getPersistence()).toBe("unavailable");
		expect(f.warnings()).toBe(1);
		// Doubling from 15 s to the 120 s cap, abandoned on the first failure at or past 30 min.
		const last = f.attempts[f.attempts.size() - 1];
		expect(last).toBeGreaterThanOrEqual(5 + SHUTDOWN_RETRY_GIVE_UP);
		expect(last).toBeLessThan(5 + SHUTDOWN_RETRY_GIVE_UP + SHUTDOWN_RETRY_CAP);
		for (let i = 1; i < f.attempts.size(); i++) {
			const gap = f.attempts[i] - f.attempts[i - 1];
			expect(gap).toBeGreaterThanOrEqual(SHUTDOWN_RETRY_INITIAL);
			expect(gap).toBeLessThanOrEqual(SHUTDOWN_RETRY_CAP);
		}
		expect(f.attempts.size()).toBeLessThanOrEqual(20);
		const updatesBefore = f.updates();
		f.recover();
		expect(f.shutdown.awaitDeadline(f.clock() + 28)).toBe(true);
		expect(f.shutdown.pending()).toBe(0);
		expect(f.updates()).toBe(updatesBefore + 1);
		expect(normalizeProfile(f.stored()).slots[0].missions?.[1]?.completed).toBe(true);
	});
});
