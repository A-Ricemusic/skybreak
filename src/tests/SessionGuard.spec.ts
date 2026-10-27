import { describe, expect, it } from "@rbxts/jest-globals";
import { PauseRules, Settlement, SettlementHooks, StepGuard } from "../shared/SessionGuard";

// Pure session-loop contracts; also run in the offline Luau VM (toBe/toBeUndefined only).
describe("Step guard (internal_error isolation)", () => {
	it("runs a healthy step and reports success", () => {
		const guard = StepGuard.New();
		let steps = 0;
		expect(StepGuard.Run(guard, () => { steps += 1; }, () => undefined)).toBe(true);
		expect(StepGuard.Run(guard, () => { steps += 1; }, () => undefined)).toBe(true);
		expect(steps).toBe(2);
		expect(guard.failed).toBe(false);
	});
	it("isolates a throwing step: one failure callback, then the session never steps again", () => {
		const guard = StepGuard.New();
		let failures = 0, steps = 0;
		let message = "";
		const throwing = () => { steps += 1; error("enemy warning was destroyed"); };
		expect(StepGuard.Run(guard, throwing, (text) => { failures += 1; message = text; })).toBe(false);
		expect(failures).toBe(1);
		expect(message.find("enemy warning was destroyed")[0] !== undefined).toBe(true);
		expect(guard.failed).toBe(true);
		// Every later frame is refused without running the step or calling back again.
		for (let frame = 0; frame < 30; frame++) StepGuard.Run(guard, throwing, () => { failures += 1; });
		expect(steps).toBe(1);
		expect(failures).toBe(1);
		expect(guard.running).toBe(false);
	});
	it("survives a failure callback that itself throws", () => {
		const guard = StepGuard.New();
		const ok = StepGuard.Run(guard, () => error("step"), () => error("cleanup"));
		expect(ok).toBe(false);
		expect(guard.failed).toBe(true);
	});
	it("refuses re-entry while a step is still running (a yield inside a Heartbeat step)", () => {
		const guard = StepGuard.New();
		let inner: boolean | undefined;
		let outerSteps = 0;
		StepGuard.Run(guard, () => {
			outerSteps += 1;
			inner = StepGuard.Run(guard, () => { outerSteps += 100; }, () => undefined);
		}, () => undefined);
		expect(inner).toBe(false);
		expect(outerSteps).toBe(1);
		expect(guard.running).toBe(false);
		expect(StepGuard.Run(guard, () => undefined, () => undefined)).toBe(true);
	});
});
describe("Pause budget", () => {
	it("reports a nonnegative countdown across pauses, warning boundary, and exhaustion", () => {
		const pause = PauseRules.New();
		expect(PauseRules.Remaining(pause, 0)).toBe(300);
		PauseRules.Pause(pause, 10);
		expect(PauseRules.Remaining(pause, 110)).toBe(200);
		PauseRules.Resume(pause, 110);
		expect(PauseRules.Remaining(pause, 900)).toBe(200);
		PauseRules.Pause(pause, 900);
		expect(PauseRules.Remaining(pause, 1090)).toBe(10);
		expect(PauseRules.Remaining(pause, 1101)).toBe(0);
		PauseRules.Resume(pause, 1101);
		expect(PauseRules.Remaining(pause, 1200)).toBe(0);
		expect(PauseRules.Pause(pause, 1200)).toBe(false);
	});
	it("shifts the mission clock by the paused span", () => {
		const pause = PauseRules.New();
		expect(PauseRules.Pause(pause, 100)).toBe(true);
		expect(PauseRules.Paused(pause)).toBe(true);
		expect(PauseRules.Pause(pause, 101)).toBe(false);
		expect(PauseRules.Resume(pause, 130)).toBe(30);
		expect(PauseRules.Paused(pause)).toBe(false);
		expect(pause.used).toBe(30);
		expect(PauseRules.Resume(pause, 140)).toBe(0);
	});
	it("caps the total pause at five minutes; time past the cap counts", () => {
		const pause = PauseRules.New();
		PauseRules.Pause(pause, 0);
		expect(PauseRules.Expired(pause, 299)).toBe(false);
		expect(PauseRules.Expired(pause, 300)).toBe(true);
		expect(PauseRules.Resume(pause, 420)).toBe(PauseRules.Budget);
		expect(PauseRules.Pause(pause, 500)).toBe(false);
	});
	it("spends the budget across several pauses", () => {
		const pause = PauseRules.New();
		PauseRules.Pause(pause, 0); PauseRules.Resume(pause, 200);
		PauseRules.Pause(pause, 300);
		expect(PauseRules.Expired(pause, 399)).toBe(false);
		expect(PauseRules.Expired(pause, 400)).toBe(true);
		expect(PauseRules.Resume(pause, 450)).toBe(100);
		expect(pause.used).toBe(PauseRules.Budget);
		expect(PauseRules.Pause(pause, 0 / 0)).toBe(false);
	});
});

/**
 * A model of one sortie's settlement as CombatService wires it: `blocked` is the `completing` set
 * StartMission checks, `world` is the session folder, `deferred` the task.defer queue. Any hook
 * can be made to throw.
 */
function sortie(throwing: { [hook: string]: boolean } = {}) {
	const log = { blocked: true, world: true, saved: 0, unsaved: 0, teardowns: 0, releases: 0, warnings: 0, deferred: [] as (() => void)[] };
	const fail = (hook: string) => { if (throwing[hook]) error(`${hook} exploded`); };
	const hooks: SettlementHooks = {
		announce: () => fail("announce"),
		schedule: (complete) => { fail("schedule"); log.deferred.push(complete); },
		save: () => { fail("save"); log.saved += 1; },
		unsaved: () => { fail("unsaved"); log.unsaved += 1; },
		teardown: () => { log.teardowns += 1; fail("teardown"); log.world = false; },
		release: () => { log.releases += 1; log.blocked = false; },
		warn: () => { log.warnings += 1; },
	};
	const runDeferred = () => { const jobs = [...log.deferred]; log.deferred.clear(); for (const job of jobs) job(); };
	return { log, hooks, runDeferred, state: Settlement.New() };
}
describe("Settlement (a finished sortie never blocks the next one)", () => {
	it("saves, then tears down and releases the player once the deferred task runs", () => {
		const { log, hooks, runDeferred, state } = sortie();
		Settlement.Begin(state, hooks);
		expect(log.blocked).toBe(true);
		expect(log.deferred.size()).toBe(1);
		runDeferred();
		expect(log.saved).toBe(1);
		expect(log.unsaved).toBe(0);
		expect(log.world).toBe(false);
		expect(log.blocked).toBe(false);
		// A second finish cause (duplicate kill, abort) changes nothing.
		Settlement.Begin(state, hooks);
		expect(Settlement.Abandon(state, hooks)).toBe(false);
		expect(log.teardowns).toBe(1);
		expect(log.releases).toBe(1);
	});
	it("still saves and releases when the result announcement (telemetry) throws", () => {
		const { log, hooks, runDeferred, state } = sortie({ announce: true });
		Settlement.Begin(state, hooks);
		expect(log.warnings).toBe(1);
		runDeferred();
		expect(log.saved).toBe(1);
		expect(log.world).toBe(false);
		expect(log.blocked).toBe(false);
	});
	it("tears down and releases at once when the save cannot be scheduled", () => {
		const { log, hooks, state } = sortie({ schedule: true });
		Settlement.Begin(state, hooks);
		expect(log.deferred.size()).toBe(0);
		expect(log.unsaved).toBe(1);
		expect(log.world).toBe(false);
		expect(log.blocked).toBe(false);
	});
	it("reports a failed save, then tears down and releases", () => {
		const { log, hooks, runDeferred, state } = sortie({ save: true });
		Settlement.Begin(state, hooks);
		runDeferred();
		expect(log.saved).toBe(0);
		expect(log.unsaved).toBe(1);
		expect(log.world).toBe(false);
		expect(log.blocked).toBe(false);
	});
	it("releases the player even when teardown and the unsaved report both throw", () => {
		const { log, hooks, state } = sortie({ schedule: true, unsaved: true, teardown: true });
		Settlement.Begin(state, hooks);
		expect(log.teardowns).toBe(1);
		expect(log.releases).toBe(1);
		expect(log.blocked).toBe(false);
	});
	it("an error during a step whose settlement then throws: the guard's abort still releases", () => {
		// The review's second path: a step throws, the guard aborts, and settling that abort throws too.
		const { log, hooks, state } = sortie({ announce: true, schedule: true });
		const guard = StepGuard.New();
		StepGuard.Run(guard, () => error("enemy warning was destroyed"), () => {
			Settlement.Begin(state, hooks);
			Settlement.Abandon(state, hooks);
		});
		expect(guard.failed).toBe(true);
		expect(log.world).toBe(false);
		expect(log.blocked).toBe(false);
		expect(log.teardowns).toBe(1);
		expect(log.releases).toBe(1);
	});
	it("an abort while the save is pending leaves teardown to the completion task", () => {
		const { log, hooks, runDeferred, state } = sortie();
		Settlement.Begin(state, hooks);
		expect(Settlement.Abandon(state, hooks)).toBe(false);
		expect(log.world).toBe(true);
		expect(log.blocked).toBe(true);
		runDeferred();
		expect(log.saved).toBe(1);
		expect(log.blocked).toBe(false);
		expect(log.releases).toBe(1);
	});
	it("an abort of a sortie that never settled tears it down without releasing anyone", () => {
		const { log, hooks, state } = sortie();
		expect(Settlement.Abandon(state, hooks)).toBe(true);
		expect(log.world).toBe(false);
		expect(log.releases).toBe(0);
	});
});
