import { describe, expect, it } from "@rbxts/jest-globals";
import { PauseRules, StepGuard } from "../shared/SessionGuard";

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
