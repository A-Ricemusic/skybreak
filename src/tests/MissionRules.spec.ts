import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionRules, MissionRuleState } from "../shared/MissionRules";

function teachMovement(state: MissionRuleState, now = 1): void {
	for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 0.7, -0.7, 0.1, now);
}
function clearIntercept(state: MissionRuleState): void {
	for (let index = 0; index < 3; index++) expect(MissionRules.RecordKill(state, `required_${index}`, "air", true, 10 + index)).toBe(true);
}
function clearWarehouses(state: MissionRuleState): void {
	for (let index = 0; index < 5; index++) expect(MissionRules.RecordKill(state, `warehouse_${index}`, "ground", true, 20 + index)).toBe(true);
}

describe("authoritative two-mission rules", () => {
	it("requires observed turn AND pitch before a real targeting event and practice missile kill", () => {
		const state = MissionRules.NewState(1, 0);
		MissionRules.CycleTarget(state, 1);
		expect(state.phase).toBe("tutorial_move");
		for (let index = 0; index < 12; index++) MissionRules.ObserveControls(state, 0, 0, 0.1, 1);
		expect(state.phase).toBe("tutorial_move");
		for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 1, 0, 0.1, 2);
		expect(state.phase).toBe("tutorial_move");
		expect(MissionRules.RecordKill(state, "radar", "ground", true, 2)).toBe(false);
		for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 0, -1, 0.1, 3);
		expect(state.phase).toBe("tutorial_target");
		expect(MissionRules.CanDamage(state, "ground", true)).toBe(false);
		MissionRules.CycleTarget(state, 4);
		expect(state.phase).toBe("tutorial_missile");
		expect(MissionRules.CanDamage(state, "ground", true)).toBe(true);
		expect(MissionRules.RecordKill(state, "early_bandit", "air", true, 5)).toBe(false);
		expect(MissionRules.RecordKill(state, "radar", "ground", true, 5)).toBe(true);
		expect(state.phase).toBe("tutorial_bandits");
		expect(state.outcome).toBeUndefined();
		expect(MissionRules.RecordKill(state, "second_radar", "ground", true, 6)).toBe(false);
		clearIntercept(state);
		expect(state.outcome).toBe("won");
		expect(state.requiredAirKills).toBe(3);
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
	it("times out at exactly 600 wall seconds, including tutorial time and unsimulated stalls", () => {
		const state = MissionRules.NewState(1, 500);
		MissionRules.Tick(state, 1099.999);
		expect(state.outcome).toBeUndefined();
		expect(MissionRules.TimeRemaining(state)).toBeCloseTo(0.001, 6);
		MissionRules.Tick(state, 1100);
		expect(state.phase).toBe("tutorial_move");
		expect(state.outcome).toBe("failed");
		expect(state.reason).toBe("timeout");
		expect(MissionRules.TimeRemaining(state)).toBe(0);
		const stalled = MissionRules.NewState(2, 100);
		MissionRules.Tick(stalled, 750);
		expect(stalled.elapsed).toBe(650);
		expect(stalled.outcome).toBe("failed");
	});
	it("rejects a final kill at the timeout boundary but accepts one just before it", () => {
		for (const time of [599.999, 600]) {
			const state = MissionRules.NewState(2, 0);
			clearIntercept(state); clearWarehouses(state);
			expect(MissionRules.RecordKill(state, "ace", "ace", true, time)).toBe(time < 600);
			expect(state.outcome).toBe(time < 600 ? "won" : "failed");
			expect(state.reason).toBe(time < 600 ? "complete" : "timeout");
		}
	});
	it("settles once and freezes terminal stats across duplicate finish causes", () => {
		const won = MissionRules.NewState(2, 0);
		clearIntercept(won); clearWarehouses(won);
		MissionRules.RecordKill(won, "ace", "ace", true, 50);
		MissionRules.Tick(won, 700, 0);
		expect(won.outcome).toBe("won");
		expect(won.reason).toBe("complete");
		expect(won.elapsed).toBe(50);
		expect(MissionRules.RecordKill(won, "late_kill", "air", false, 800)).toBe(false);
		const failed = MissionRules.NewState(2, 0);
		MissionRules.Tick(failed, 15, 0);
		MissionRules.Tick(failed, 700, 100);
		expect(failed.outcome).toBe("failed");
		expect(failed.reason).toBe("destroyed");
		expect(failed.elapsed).toBe(15);
	});
	it("fails a rescue when a server-owned protected objective is destroyed", () => {
		const state = MissionRules.NewState(3, 0);
		MissionRules.Fail(state, "protected", 42);
		expect(state.outcome).toBe("failed");
		expect(state.reason).toBe("protected");
		expect(state.elapsed).toBe(42);
		expect(MissionRules.RecordKill(state, "late", "air", true, 43)).toBe(false);
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
		MissionRules.CycleTarget(state, 112);
		expect(MissionRules.Objective(state).tutorialStep).toBe("missile");
		MissionRules.RecordKill(state, "radar", "ground", true, 113);
		expect(MissionRules.Objective(state).tutorialStep).toBe("");
		expect(MissionRules.Objective(state).objectiveTotal).toBe(3);
	});
});
