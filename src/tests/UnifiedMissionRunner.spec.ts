import { describe, expect, it } from "@rbxts/jest-globals";
import { RadioQueue } from "../shared/RadioQueue";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { BlueprintRunner, BlueprintState } from "../shared/BlueprintRunner";

/** Three-plus seconds of real turning and pitching, with the clock running so the prompt has been up long enough. */
function teachMovement(state: BlueprintState, now = 3): void {
	for (let index = 0; index < 31; index++) BlueprintRunner.ObserveControls(state, 0.7, -0.7, 0.1, now + index * 0.1);
}
function clearIntercept(state: BlueprintState): void {
	for (let index = 0; index < 3; index++) expect(BlueprintRunner.RecordKill(state, `required_${index}`, "air", true, 10 + index)).toBe(true);
}
function clearWarehouses(state: BlueprintState): void {
	for (let index = 0; index < 5; index++) expect(BlueprintRunner.RecordKill(state, `warehouse_${index}`, "ground", true, 20 + index)).toBe(true);
}

describe("unified blueprint runner: original M1/M2 contracts", () => {
	it("holds each teaching step until the player really turns and pitches for 3 s, presses TGT and scores the hit", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
		BlueprintRunner.CycleTarget(state, 1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
		for (let index = 0; index < 12; index++) BlueprintRunner.ObserveControls(state, 0, 0, 0.1, 1 + index * 0.1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
		// A quick wiggle no longer passes: 0.7 s of each axis was enough before round 2.
		for (let index = 0; index < 7; index++) BlueprintRunner.ObserveControls(state, 1, -1, 0.1, 2.3 + index * 0.1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
		expect(BlueprintRunner.Objective(state).objectiveTotal).toBe(6);
		for (let index = 0; index < 24; index++) BlueprintRunner.ObserveControls(state, 1, 0, 0.1, 3 + index * 0.1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
		expect(BlueprintRunner.RecordKill(state, "radar", "ground", true, 5.4)).toBe(false);
		for (let index = 0; index < 24; index++) BlueprintRunner.ObserveControls(state, 0, -1, 0.1, 5.5 + index * 0.1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_target");
		expect(BlueprintRunner.CanDamage(state, "ground", true)).toBe(false);
		// The TGT press counts, but the prompt stays up for 2.5 s before the next step.
		const entered = state.elapsed;
		BlueprintRunner.CycleTarget(state, entered + 1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_target");
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(1);
		const missileAt = entered + BlueprintRunner.TeachMinimum;
		BlueprintRunner.Tick(state, missileAt);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_missile");
		expect(BlueprintRunner.CanDamage(state, "ground", true)).toBe(true);
		const killAt = entered + 4;
		expect(BlueprintRunner.RecordKill(state, "early_bandit", "air", true, killAt)).toBe(false);
		expect(BlueprintRunner.RecordKill(state, "radar", "ground", true, killAt)).toBe(true);
		// The hit is latched, but the missile prompt stays up for its own 2.5 s.
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_missile");
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(1);
		expect(BlueprintRunner.CanDamage(state, "ground", true)).toBe(false);
		const bandits = missileAt + BlueprintRunner.TeachMinimum;
		BlueprintRunner.Tick(state, bandits);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_bandits");
		expect(state.outcome).toBeUndefined();
		// The bandits launch only after SERA's 4 s beat, counted from the step change.
		expect(BlueprintRunner.BanditsDue(state)).toBe(false);
		BlueprintRunner.Tick(state, bandits + BlueprintRunner.BanditBeat - 0.1);
		expect(BlueprintRunner.BanditsDue(state)).toBe(false);
		BlueprintRunner.Tick(state, bandits + BlueprintRunner.BanditBeat);
		expect(BlueprintRunner.BanditsDue(state)).toBe(true);
		expect(BlueprintRunner.RecordKill(state, "second_radar", "ground", true, bandits + 5)).toBe(false);
		clearIntercept(state);
		expect(state.outcome).toBe("won");
		expect(state.requiredAirKills).toBe(3);
		expect(state.requiredGroundKills).toBe(1);
	});
	it("keeps the missile prompt up 2.5 s even when a lock built during the target step fires at once", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
		teachMovement(state);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_target");
		const entered = state.elapsed;
		BlueprintRunner.CycleTarget(state, entered + 0.2);
		const missileAt = entered + BlueprintRunner.TeachMinimum;
		BlueprintRunner.Tick(state, missileAt);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_missile");
		// The review's runner probe: the radar dies 0.1 s after the missile prompt appears.
		expect(BlueprintRunner.RecordKill(state, "radar", "ground", true, missileAt + 0.1)).toBe(true);
		expect(BlueprintRunner.RecordKill(state, "radar", "ground", true, missileAt + 0.2)).toBe(false);
		expect(state.requiredGroundKills).toBe(1);
		BlueprintRunner.Tick(state, missileAt + BlueprintRunner.TeachMinimum - 0.05);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_missile");
		expect(BlueprintRunner.BanditsDue(state)).toBe(false);
		BlueprintRunner.Tick(state, missileAt + BlueprintRunner.TeachMinimum);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_bandits");
		expect(state.banditsDueAt).toBe(missileAt + BlueprintRunner.TeachMinimum + BlueprintRunner.BanditBeat);
		expect(state.requiredGroundKills).toBe(1);
	});
	it("rejects invalid observation samples and caps a stalled observation step", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
		for (const invalid of [0 / 0, math.huge, -math.huge]) {
			BlueprintRunner.ObserveControls(state, invalid, 1, 0.1, 1);
			BlueprintRunner.ObserveControls(state, 1, invalid, 0.1, 1);
			BlueprintRunner.ObserveControls(state, 1, 1, invalid, 1);
		}
		BlueprintRunner.ObserveControls(state, 1, 1, -1, 1);
		expect(state.turnObserved).toBe(0);
		expect(state.pitchObserved).toBe(0);
		BlueprintRunner.ObserveControls(state, 1, 1, 600, 1);
		expect(state.turnObserved).toBe(0.1);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
	});
	it("gates warehouses and the ace behind the three required intercept kills", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		expect(BlueprintRunner.Objective(state).phase).toBe("intercept");
		for (const kind of ["ground", "ace"] as const) expect(BlueprintRunner.RecordKill(state, kind, kind, true, 1)).toBe(false);
		expect(BlueprintRunner.RecordKill(state, "optional_early", "air", false, 1)).toBe(false);
		clearIntercept(state);
		expect(BlueprintRunner.Objective(state).phase).toBe("warehouses");
		expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.RecordKill(state, "extra_required", "air", true, 14)).toBe(false);
		expect(BlueprintRunner.RecordKill(state, "early_ace", "ace", true, 14)).toBe(false);
		for (let index = 0; index < 4; index++) BlueprintRunner.RecordKill(state, `warehouse_${index}`, "ground", true, 20 + index);
		expect(BlueprintRunner.Objective(state).phase).toBe("warehouses");
		expect(BlueprintRunner.RecordKill(state, "warehouse_4", "ground", true, 24)).toBe(true);
		expect(BlueprintRunner.Objective(state).phase).toBe("ace");
		expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.RecordKill(state, "sixth_warehouse", "ground", true, 25)).toBe(false);
		expect(BlueprintRunner.RecordKill(state, "ace", "ace", true, 30)).toBe(true);
		expect(state.outcome).toBe("won");
	});
	it("allows victory with all five optional fighters alive and keeps them killable during the ace", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		clearIntercept(state);
		clearWarehouses(state);
		expect(BlueprintRunner.CanDamage(state, "air", false)).toBe(true);
		expect(state.optionalAirKills).toBe(0);
		expect(BlueprintRunner.RecordKill(state, "ace", "ace", true, 40)).toBe(true);
		expect(state.outcome).toBe("won");
		expect(state.optionalAirKills).toBe(0);
	});
	it("optional kills do not advance either objective and duplicate kills do not count", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		expect(BlueprintRunner.RecordKill(state, "bandit", "air", true, 1)).toBe(true);
		expect(BlueprintRunner.RecordKill(state, "bandit", "air", true, 2)).toBe(false);
		expect(state.requiredAirKills).toBe(1);
		BlueprintRunner.RecordKill(state, "bandit_2", "air", true, 3);
		BlueprintRunner.RecordKill(state, "bandit_3", "air", true, 4);
		for (let index = 0; index < 4; index++) BlueprintRunner.RecordKill(state, `optional_${index}`, "air", false, 10);
		expect(BlueprintRunner.Objective(state).phase).toBe("warehouses");
		expect(state.optionalAirKills).toBe(4);
		expect(state.requiredGroundKills).toBe(0);
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(0);
		clearWarehouses(state);
		expect(BlueprintRunner.RecordKill(state, "late_optional", "air", false, 26)).toBe(true);
		expect(state.optionalAirKills).toBe(5);
		expect(BlueprintRunner.RecordKill(state, "sixth_optional", "air", false, 27)).toBe(false);
		expect(BlueprintRunner.Objective(state).phase).toBe("ace");
		expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.Objective(state).objectiveProgress).toBe(0);
		expect(BlueprintRunner.RecordKill(state, "ace", "ace", true, 30)).toBe(true);
		expect(BlueprintRunner.RecordKill(state, "ace", "ace", true, 31)).toBe(false);
	});
	it("times out at exactly the configured deadline, including tutorial time and unsimulated stalls", () => {
		const limit = BlueprintRunner.Duration;
		const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 500);
		BlueprintRunner.Tick(state, 500 + limit - 0.001);
		expect(state.outcome).toBeUndefined();
		expect(math.abs(BlueprintRunner.TimeRemaining(state) - 0.001) < 1e-6).toBe(true);
		BlueprintRunner.Tick(state, 500 + limit);
		expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
		expect(state.outcome).toBe("failed");
		expect(state.reason).toBe("timeout");
		expect(BlueprintRunner.TimeRemaining(state)).toBe(0);
		const stalled = BlueprintRunner.NewState(MissionCatalog.Get(2), 100);
		BlueprintRunner.Tick(stalled, 150 + limit);
		expect(stalled.elapsed).toBe(50 + limit);
		expect(stalled.outcome).toBe("failed");
	});
	it("rejects a final kill at the timeout boundary but accepts one just before it", () => {
		const limit = BlueprintRunner.Duration;
		for (const time of [limit - 0.001, limit]) {
			const state = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
			clearIntercept(state); clearWarehouses(state);
			expect(BlueprintRunner.RecordKill(state, "ace", "ace", true, time)).toBe(time < limit);
			expect(state.outcome).toBe(time < limit ? "won" : "failed");
			expect(state.reason).toBe(time < limit ? "complete" : "timeout");
		}
	});
	it("settles once and freezes terminal stats across duplicate finish causes", () => {
		const won = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		clearIntercept(won); clearWarehouses(won);
		BlueprintRunner.RecordKill(won, "ace", "ace", true, 50);
		BlueprintRunner.Tick(won, BlueprintRunner.Duration + 100, 0);
		expect(won.outcome).toBe("won");
		expect(won.reason).toBe("complete");
		expect(won.elapsed).toBe(50);
		expect(BlueprintRunner.RecordKill(won, "late_kill", "air", false, 800)).toBe(false);
		const failed = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		BlueprintRunner.Tick(failed, 15, 0);
		BlueprintRunner.Tick(failed, BlueprintRunner.Duration + 100, 100);
		expect(failed.outcome).toBe("failed");
		expect(failed.reason).toBe("destroyed");
		expect(failed.elapsed).toBe(15);
	});
	it("keeps clocks monotonic and publishes scalar tutorial defaults", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 100);
		BlueprintRunner.Tick(state, 90);
		expect(state.elapsed).toBe(0);
		BlueprintRunner.Tick(state, 110);
		BlueprintRunner.Tick(state, 105);
		BlueprintRunner.Tick(state, 0 / 0);
		expect(state.elapsed).toBe(10);
		expect(BlueprintRunner.Objective(state).tutorialStep).toBe("move");
		teachMovement(state, 111);
		expect(BlueprintRunner.Objective(state).tutorialStep).toBe("target");
		BlueprintRunner.CycleTarget(state, 118);
		expect(BlueprintRunner.Objective(state).tutorialStep).toBe("missile");
		BlueprintRunner.RecordKill(state, "radar", "ground", true, 119);
		expect(BlueprintRunner.Objective(state).tutorialStep).toBe("missile");
		BlueprintRunner.Tick(state, 118 + BlueprintRunner.TeachMinimum);
		expect(BlueprintRunner.Objective(state).tutorialStep).toBe("");
		expect(BlueprintRunner.Objective(state).objectiveTotal).toBe(3);
	});
});


describe("M1 independent movement progress", () => {
	it("keeps a completed axis while the other is untouched, waits for dwell, and resets on retry", () => {
		for (const turnFirst of [true, false]) {
			const state = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
			for (let i = 0; i < 31; i++) BlueprintRunner.ObserveControls(state, turnFirst ? 0.2 : 0, turnFirst ? 0 : -0.2, 0.1, 1);
			expect(state.turnObserved).toBe(turnFirst ? 3 : 0);
			expect(state.pitchObserved).toBe(turnFirst ? 0 : 3);
			expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
			for (let i = 0; i < 31; i++) BlueprintRunner.ObserveControls(state, turnFirst ? 0 : -0.2, turnFirst ? 0.2 : 0, 0.1, 1);
			expect(state.turnObserved).toBe(3);
			expect(state.pitchObserved).toBe(3);
			expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_move");
			BlueprintRunner.Tick(state, BlueprintRunner.TeachMinimum);
			expect(BlueprintRunner.Objective(state).phase).toBe("tutorial_target");
			const retry = BlueprintRunner.NewState(MissionCatalog.Get(1), 10);
			expect(retry.turnObserved).toBe(0);
			expect(retry.pitchObserved).toBe(0);
		}
	});
});


describe("M1 practice safety with current flight parameters (numeric simulation)", () => {
	it("reproduces the unsafe three-second downward hold at the real default 800 mph", () => {
		const flight = FlightMath.NewState();
		expect(FlightMath.ToMph(flight.speed)).toBe(800);
		let lowest = flight.y;
		for (let i = 0; i < 180; i++) {
			FlightMath.Step(flight, { x: 0, y: -1, throttle: FlightMath.CruiseThrottle }, 1 / 60);
			lowest = math.min(lowest, flight.y);
		}
		expect(lowest).toBeLessThan(0);
	});
	it("completes turn/pitch with short opposite taps at 800 and 3000 mph, then completes the gated sortie", () => {
		for (const speed of [FlightMath.CruiseSpeed, FlightMath.MaxSpeed]) {
			const flight = FlightMath.NewState(), rules = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
			flight.speed = speed;
			let now = 0, lowest = flight.y;
			for (const axis of ["turn", "pitch"]) for (let pair = 0; pair < 11; pair++) {
				for (const direction of [1, -1]) for (let frame = 0; frame < 5; frame++) {
					const input = { x: axis === "turn" && frame < 3 ? direction : 0, y: axis === "pitch" && frame < 3 ? direction : 0, throttle: FlightMath.ThrottleForSpeed(speed) };
					now += 0.05;
					FlightMath.Step(flight, input, 0.05);
					BlueprintRunner.ObserveControls(rules, input.x, input.y, 0.05, now);
					lowest = math.min(lowest, flight.y);
				}
			}
			expect(lowest).toBeGreaterThan(240);
			expect(math.abs(flight.pitch)).toBeLessThan(0.001);
			expect(BlueprintRunner.Objective(rules).phase).toBe("tutorial_target");
			BlueprintRunner.CycleTarget(rules, now);
			now += BlueprintRunner.TeachMinimum;
			BlueprintRunner.Tick(rules, now);
			expect(BlueprintRunner.Objective(rules).phase).toBe("tutorial_missile");
			expect(BlueprintRunner.RecordKill(rules, "radar", "ground", true, now)).toBe(true);
			now += BlueprintRunner.TeachMinimum + BlueprintRunner.BanditBeat;
			BlueprintRunner.Tick(rules, now);
			BlueprintRunner.Tick(rules, now + BlueprintRunner.BanditBeat);
			expect(BlueprintRunner.BanditsDue(rules)).toBe(true);
			for (let i = 0; i < 3; i++) BlueprintRunner.RecordKill(rules, `bandit${i}`, "air", true, now + BlueprintRunner.BanditBeat + i);
			expect(rules.outcome).toBe("won");
		}
	});
	it("recovers only practice impacts, retaining progress and speed without protecting the live fight", () => {
		const rules = BlueprintRunner.NewState(MissionCatalog.Get(1), 0);
		for (const phase of ["tutorial_move", "tutorial_target", "tutorial_missile"] as const) {
			rules.phaseIndex = ["tutorial_move", "tutorial_target", "tutorial_missile"].indexOf(phase); rules.turnObserved = 2;
			const flight = FlightMath.FromPose(300, 0, -900, 2, -1, 600, 2);
			expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(true);
			expect([flight.x, flight.y, flight.z, flight.speed]).toEqual([0, 800, 500, 600]);
			expect(math.abs(flight.pitch)).toBe(0);
			expect(rules.turnObserved).toBe(2);
		}
		const flight = FlightMath.NewState();
		// A hit latched during the minimum prompt dwell remains practice until the warning.
		rules.requiredGroundKills = 1;
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(true);
		rules.requiredGroundKills = 0; rules.phaseIndex = 3;
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(false);
		rules.phaseIndex = 0; rules.outcome = "failed";
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(false);
		expect(BlueprintRunner.RecoverPractice(BlueprintRunner.NewState(MissionCatalog.Get(2), 0), flight)).toBe(false);
	});
});


describe("tutorial safety delivery through the HUD radio queue", () => {
	for (const voice of [undefined, 12]) it(`interrupts reset and backlog with voice=${voice}, protecting until arrival`, () => {
		const rules = BlueprintRunner.NewState(MissionCatalog.Get(1), 0), queue = new RadioQueue();
		teachMovement(rules);
		BlueprintRunner.CycleTarget(rules, rules.elapsed);
		BlueprintRunner.Tick(rules, rules.elapsed + BlueprintRunner.TeachMinimum);
		expect(BlueprintRunner.Objective(rules).phase).toBe("tutorial_missile");
		const start = rules.elapsed;
		const flight = FlightMath.FromPose(300, 0, -900, 2, -1, 600, 2);
		BlueprintRunner.Tick(rules, start + 2.40);
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(true);
		queue.Push(BlueprintRunner.PracticeReset, 4.5, rules.elapsed, voice);
		queue.Push("old chatter", 6, rules.elapsed, 15);
		expect(BlueprintRunner.RecordKill(rules, "radar", "ground", true, start + 2.41)).toBe(true);
		BlueprintRunner.Tick(rules, start + 2.50);
		expect(BlueprintRunner.Objective(rules).phase).toBe("tutorial_bandits");
		const warning = MissionCatalog.Get(1).phases[3].beat!;
		queue.Push(warning, BlueprintRunner.BanditBeat, rules.elapsed, undefined, true);
		expect(queue.Current(rules.elapsed)?.text).toBe(warning);
		expect(queue.Waiting()).toBe(0);
		// Normal chatter cannot displace a safety notice after the usual 2.5 s minimum.
		queue.Push("ordinary chatter", 4.5, rules.elapsed + 0.1);
		BlueprintRunner.Tick(rules, start + 6.49);
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(true);
		expect(queue.Current(rules.elapsed)?.text).toBe(warning);
		expect(BlueprintRunner.BanditsDue(rules)).toBe(false);
		expect(flight.speed).toBe(600);
		expect(rules.requiredGroundKills).toBe(1);
		BlueprintRunner.Tick(rules, start + 6.50);
		expect(BlueprintRunner.BanditsDue(rules)).toBe(true);
		queue.Push(BlueprintRunner.LiveWarning, 6, rules.elapsed, undefined, true);
		expect(queue.Current(rules.elapsed)?.text).toBe(BlueprintRunner.LiveWarning);
		expect(queue.Waiting()).toBe(0);
		// This is the collision branch used by stepSession: the first live hit must fail.
		expect(BlueprintRunner.RecoverPractice(rules, flight)).toBe(false);
		BlueprintRunner.Tick(rules, rules.elapsed, 0);
		expect(rules.reason).toBe("destroyed");
	});
});

// The former runner retained its last objective after victory. The generic completion
// objective would otherwise change M1/M2's final reliable HUD packet during settlement.
describe("original sortie HUD at settlement", () => {
	it("retains the completed harbor ace objective and freezes its kill counters", () => {
		const state = BlueprintRunner.NewState(MissionCatalog.Get(2), 0);
		clearIntercept(state); clearWarehouses(state);
		BlueprintRunner.RecordKill(state, "ace", "ace", true, 30);
		const objective = BlueprintRunner.Objective(state);
		expect(objective.phase).toBe("ace");
		expect(objective.objective).toBe("Destroy the ace; his raiders are still dangerous");
		expect(objective.objectiveProgress).toBe(1);
		expect(objective.objectiveTotal).toBe(1);
		expect(state.requiredAirKills).toBe(3);
		expect(state.requiredGroundKills).toBe(5);
		expect(state.aceKilled).toBe(true);
	});
});
