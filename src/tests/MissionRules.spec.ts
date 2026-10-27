import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionRules, MissionRuleState } from "../shared/MissionRules";

/** Three-plus seconds of real turning and pitching, with the clock running so the prompt has been up long enough. */
function teachMovement(state: MissionRuleState, now = 3): void {
	for (let index = 0; index < 31; index++) MissionRules.ObserveControls(state, 0.7, -0.7, 0.1, now + index * 0.1);
}
function clearIntercept(state: MissionRuleState): void {
	for (let index = 0; index < 3; index++) expect(MissionRules.RecordKill(state, `required_${index}`, "air", true, 10 + index)).toBe(true);
}
function clearWarehouses(state: MissionRuleState): void {
	for (let index = 0; index < 5; index++) expect(MissionRules.RecordKill(state, `warehouse_${index}`, "ground", true, 20 + index)).toBe(true);
}

describe("authoritative two-mission rules", () => {
	it("holds each teaching step until the player really turns and pitches for 3 s, presses TGT and scores the hit", () => {
		const state = MissionRules.NewState(1, 0);
		MissionRules.CycleTarget(state, 1);
		expect(state.phase).toBe("tutorial_move");
		for (let index = 0; index < 12; index++) MissionRules.ObserveControls(state, 0, 0, 0.1, 1 + index * 0.1);
		expect(state.phase).toBe("tutorial_move");
		// A quick wiggle no longer passes: 0.7 s of each axis was enough before round 2.
		for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 1, -1, 0.1, 2.3 + index * 0.1);
		expect(state.phase).toBe("tutorial_move");
		expect(MissionRules.Objective(state).objectiveTotal).toBe(6);
		for (let index = 0; index < 24; index++) MissionRules.ObserveControls(state, 1, 0, 0.1, 3 + index * 0.1);
		expect(state.phase).toBe("tutorial_move");
		expect(MissionRules.RecordKill(state, "radar", "ground", true, 5.4)).toBe(false);
		for (let index = 0; index < 24; index++) MissionRules.ObserveControls(state, 0, -1, 0.1, 5.5 + index * 0.1);
		expect(state.phase).toBe("tutorial_target");
		expect(MissionRules.CanDamage(state, "ground", true)).toBe(false);
		// The TGT press counts, but the prompt stays up for 2.5 s before the next step.
		const entered = state.elapsed;
		MissionRules.CycleTarget(state, entered + 1);
		expect(state.phase).toBe("tutorial_target");
		expect(MissionRules.Objective(state).objectiveProgress).toBe(1);
		const missileAt = entered + MissionRules.TeachMinimum;
		MissionRules.Tick(state, missileAt);
		expect(state.phase).toBe("tutorial_missile");
		expect(MissionRules.CanDamage(state, "ground", true)).toBe(true);
		const killAt = entered + 4;
		expect(MissionRules.RecordKill(state, "early_bandit", "air", true, killAt)).toBe(false);
		expect(MissionRules.RecordKill(state, "radar", "ground", true, killAt)).toBe(true);
		// The hit is latched, but the missile prompt stays up for its own 2.5 s.
		expect(state.phase).toBe("tutorial_missile");
		expect(MissionRules.Objective(state).objectiveProgress).toBe(1);
		expect(MissionRules.CanDamage(state, "ground", true)).toBe(false);
		const bandits = missileAt + MissionRules.TeachMinimum;
		MissionRules.Tick(state, bandits);
		expect(state.phase).toBe("tutorial_bandits");
		expect(state.outcome).toBeUndefined();
		// The bandits launch only after SERA's 4 s beat, counted from the step change.
		expect(MissionRules.BanditsDue(state)).toBe(false);
		MissionRules.Tick(state, bandits + MissionRules.BanditBeat - 0.1);
		expect(MissionRules.BanditsDue(state)).toBe(false);
		MissionRules.Tick(state, bandits + MissionRules.BanditBeat);
		expect(MissionRules.BanditsDue(state)).toBe(true);
		expect(MissionRules.RecordKill(state, "second_radar", "ground", true, bandits + 5)).toBe(false);
		clearIntercept(state);
		expect(state.outcome).toBe("won");
		expect(state.requiredAirKills).toBe(3);
		expect(state.groundKills).toBe(1);
	});
	it("keeps the missile prompt up 2.5 s even when a lock built during the target step fires at once", () => {
		const state = MissionRules.NewState(1, 0);
		teachMovement(state);
		expect(state.phase).toBe("tutorial_target");
		const entered = state.elapsed;
		MissionRules.CycleTarget(state, entered + 0.2);
		const missileAt = entered + MissionRules.TeachMinimum;
		MissionRules.Tick(state, missileAt);
		expect(state.phase).toBe("tutorial_missile");
		// The review's runner probe: the radar dies 0.1 s after the missile prompt appears.
		expect(MissionRules.RecordKill(state, "radar", "ground", true, missileAt + 0.1)).toBe(true);
		expect(MissionRules.RecordKill(state, "radar", "ground", true, missileAt + 0.2)).toBe(false);
		expect(state.groundKills).toBe(1);
		MissionRules.Tick(state, missileAt + MissionRules.TeachMinimum - 0.05);
		expect(state.phase).toBe("tutorial_missile");
		expect(MissionRules.BanditsDue(state)).toBe(false);
		MissionRules.Tick(state, missileAt + MissionRules.TeachMinimum);
		expect(state.phase).toBe("tutorial_bandits");
		expect(state.banditsDueAt).toBe(missileAt + MissionRules.TeachMinimum + MissionRules.BanditBeat);
		expect(state.groundKills).toBe(1);
	});
	it("rejects invalid observation samples and caps a stalled observation step", () => {
		const state = MissionRules.NewState(1, 0);
		for (const invalid of [0 / 0, math.huge, -math.huge]) {
			MissionRules.ObserveControls(state, invalid, 1, 0.1, 1);
			MissionRules.ObserveControls(state, 1, invalid, 0.1, 1);
			MissionRules.ObserveControls(state, 1, 1, invalid, 1);
		}
		MissionRules.ObserveControls(state, 1, 1, -1, 1);
		expect(state.turnObserved).toBe(0);
		expect(state.pitchObserved).toBe(0);
		MissionRules.ObserveControls(state, 1, 1, 600, 1);
		expect(state.turnObserved).toBe(0.1);
		expect(state.phase).toBe("tutorial_move");
	});
	it("gates warehouses and the ace behind the three required intercept kills", () => {
		const state = MissionRules.NewState(2, 0);
		expect(state.phase).toBe("intercept");
		for (const kind of ["ground", "ace"] as const) expect(MissionRules.RecordKill(state, kind, kind, true, 1)).toBe(false);
		expect(MissionRules.RecordKill(state, "optional_early", "air", false, 1)).toBe(false);
		clearIntercept(state);
		expect(state.phase).toBe("warehouses");
		expect(state.outcome).toBeUndefined();
		expect(MissionRules.RecordKill(state, "extra_required", "air", true, 14)).toBe(false);
		expect(MissionRules.RecordKill(state, "early_ace", "ace", true, 14)).toBe(false);
		for (let index = 0; index < 4; index++) MissionRules.RecordKill(state, `warehouse_${index}`, "ground", true, 20 + index);
		expect(state.phase).toBe("warehouses");
		expect(MissionRules.RecordKill(state, "warehouse_4", "ground", true, 24)).toBe(true);
		expect(state.phase).toBe("ace");
		expect(state.outcome).toBeUndefined();
		expect(MissionRules.RecordKill(state, "sixth_warehouse", "ground", true, 25)).toBe(false);
		expect(MissionRules.RecordKill(state, "ace", "ace", true, 30)).toBe(true);
		expect(state.outcome).toBe("won");
	});
	it("allows victory with all five optional fighters alive and keeps them killable during the ace", () => {
		const state = MissionRules.NewState(2, 0);
		clearIntercept(state);
		clearWarehouses(state);
		expect(MissionRules.CanDamage(state, "air", false)).toBe(true);
		expect(state.optionalAirKills).toBe(0);
		expect(MissionRules.RecordKill(state, "ace", "ace", true, 40)).toBe(true);
		expect(state.outcome).toBe("won");
		expect(state.optionalAirKills).toBe(0);
	});
	it("optional kills do not advance either objective and duplicate kills do not count", () => {
		const state = MissionRules.NewState(2, 0);
		expect(MissionRules.RecordKill(state, "bandit", "air", true, 1)).toBe(true);
		expect(MissionRules.RecordKill(state, "bandit", "air", true, 2)).toBe(false);
		expect(state.requiredAirKills).toBe(1);
		MissionRules.RecordKill(state, "bandit_2", "air", true, 3);
		MissionRules.RecordKill(state, "bandit_3", "air", true, 4);
		for (let index = 0; index < 4; index++) MissionRules.RecordKill(state, `optional_${index}`, "air", false, 10);
		expect(state.phase).toBe("warehouses");
		expect(state.optionalAirKills).toBe(4);
		expect(state.groundKills).toBe(0);
		expect(MissionRules.Objective(state).objectiveProgress).toBe(0);
		clearWarehouses(state);
		expect(MissionRules.RecordKill(state, "late_optional", "air", false, 26)).toBe(true);
		expect(state.optionalAirKills).toBe(5);
		expect(MissionRules.RecordKill(state, "sixth_optional", "air", false, 27)).toBe(false);
		expect(state.phase).toBe("ace");
		expect(state.outcome).toBeUndefined();
		expect(MissionRules.Objective(state).objectiveProgress).toBe(0);
		expect(MissionRules.RecordKill(state, "ace", "ace", true, 30)).toBe(true);
		expect(MissionRules.RecordKill(state, "ace", "ace", true, 31)).toBe(false);
	});
	it("times out at exactly the configured deadline, including tutorial time and unsimulated stalls", () => {
		const limit = MissionRules.Duration;
		const state = MissionRules.NewState(1, 500);
		MissionRules.Tick(state, 500 + limit - 0.001);
		expect(state.outcome).toBeUndefined();
		expect(math.abs(MissionRules.TimeRemaining(state) - 0.001) < 1e-6).toBe(true);
		MissionRules.Tick(state, 500 + limit);
		expect(state.phase).toBe("tutorial_move");
		expect(state.outcome).toBe("failed");
		expect(state.reason).toBe("timeout");
		expect(MissionRules.TimeRemaining(state)).toBe(0);
		const stalled = MissionRules.NewState(2, 100);
		MissionRules.Tick(stalled, 150 + limit);
		expect(stalled.elapsed).toBe(50 + limit);
		expect(stalled.outcome).toBe("failed");
	});
	it("rejects a final kill at the timeout boundary but accepts one just before it", () => {
		const limit = MissionRules.Duration;
		for (const time of [limit - 0.001, limit]) {
			const state = MissionRules.NewState(2, 0);
			clearIntercept(state); clearWarehouses(state);
			expect(MissionRules.RecordKill(state, "ace", "ace", true, time)).toBe(time < limit);
			expect(state.outcome).toBe(time < limit ? "won" : "failed");
			expect(state.reason).toBe(time < limit ? "complete" : "timeout");
		}
	});
	it("settles once and freezes terminal stats across duplicate finish causes", () => {
		const won = MissionRules.NewState(2, 0);
		clearIntercept(won); clearWarehouses(won);
		MissionRules.RecordKill(won, "ace", "ace", true, 50);
		MissionRules.Tick(won, MissionRules.Duration + 100, 0);
		expect(won.outcome).toBe("won");
		expect(won.reason).toBe("complete");
		expect(won.elapsed).toBe(50);
		expect(MissionRules.RecordKill(won, "late_kill", "air", false, 800)).toBe(false);
		const failed = MissionRules.NewState(2, 0);
		MissionRules.Tick(failed, 15, 0);
		MissionRules.Tick(failed, MissionRules.Duration + 100, 100);
		expect(failed.outcome).toBe("failed");
		expect(failed.reason).toBe("destroyed");
		expect(failed.elapsed).toBe(15);
	});
	it("keeps clocks monotonic and publishes scalar tutorial defaults", () => {
		const state = MissionRules.NewState(1, 100);
		MissionRules.Tick(state, 90);
		expect(state.elapsed).toBe(0);
		MissionRules.Tick(state, 110);
		MissionRules.Tick(state, 105);
		MissionRules.Tick(state, 0 / 0);
		expect(state.elapsed).toBe(10);
		expect(MissionRules.Objective(state).tutorialStep).toBe("move");
		teachMovement(state, 111);
		expect(MissionRules.Objective(state).tutorialStep).toBe("target");
		MissionRules.CycleTarget(state, 118);
		expect(MissionRules.Objective(state).tutorialStep).toBe("missile");
		MissionRules.RecordKill(state, "radar", "ground", true, 119);
		expect(MissionRules.Objective(state).tutorialStep).toBe("missile");
		MissionRules.Tick(state, 118 + MissionRules.TeachMinimum);
		expect(MissionRules.Objective(state).tutorialStep).toBe("");
		expect(MissionRules.Objective(state).objectiveTotal).toBe(3);
	});
});


describe("M1 independent movement progress", () => {
	it("keeps a completed axis while the other is untouched, waits for dwell, and resets on retry", () => {
		for (const turnFirst of [true, false]) {
			const state = MissionRules.NewState(1, 0);
			for (let i = 0; i < 31; i++) MissionRules.ObserveControls(state, turnFirst ? 0.2 : 0, turnFirst ? 0 : -0.2, 0.1, 1);
			expect(state.turnObserved).toBe(turnFirst ? 3 : 0);
			expect(state.pitchObserved).toBe(turnFirst ? 0 : 3);
			expect(state.phase).toBe("tutorial_move");
			for (let i = 0; i < 31; i++) MissionRules.ObserveControls(state, turnFirst ? 0 : -0.2, turnFirst ? 0.2 : 0, 0.1, 1);
			expect(state.turnObserved).toBe(3);
			expect(state.pitchObserved).toBe(3);
			expect(state.phase).toBe("tutorial_move");
			MissionRules.Tick(state, MissionRules.TeachMinimum);
			expect(state.phase).toBe("tutorial_target");
			const retry = MissionRules.NewState(1, 10);
			expect(retry.turnObserved).toBe(0);
			expect(retry.pitchObserved).toBe(0);
		}
	});
});
