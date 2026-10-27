import { describe, expect, it } from "@rbxts/jest-globals";
import { TutorialHandoff } from "../shared/TutorialHandoff";
import { FlightPrediction } from "../shared/FlightPrediction";
import { FlightMath } from "../shared/FlightMath";
import { MissionRules } from "../shared/MissionRules";

describe("M1 movement handoff simulation", () => {
	it("reproduces the old transition flying an inverted descent into the ground", () => {
		const rules = MissionRules.NewState(1, 0), flight = FlightMath.NewState();
		// Full cumulative keyboard onboarding from the real spawn and default speed:
		// three seconds of turn, then three of pitch. Observe before stepping, as on server.
		for (let step = 1; step <= 182; step++) {
			const input = { x: step <= 91 ? 1 : 0, y: step > 91 ? 1 : 0, throttle: 0.65 };
			MissionRules.ObserveControls(rules, input.x, input.y, 1 / 30, step / 30);
			FlightMath.Step(flight, input, 1 / 30);
		}
		expect(rules.phase).toBe("tutorial_target");
		expect(math.abs(flight.roll)).toBeGreaterThan(2);
		expect(flight.pitch).toBeLessThan(-0.5);
		// Releasing holds preserves the inverted dive in the old flight path.
		for (let step = 0; step < 300 && flight.y > 12; step++) FlightMath.Step(flight, { x: 0, y: 0, throttle: 0.65 }, 1 / 30);
		expect(flight.y).toBeLessThan(12);
	});
});


describe("protected movement -> targeting integration", () => {
	it("completes cumulative keyboard onboarding from spawn with one protected handoff", () => {
		const rules = MissionRules.NewState(1, 0), flight = FlightMath.NewState(), gate = TutorialHandoff.New();
		let recoveries = 0;
		for (let step = 1; step <= 242; step++) {
			const input = { x: step <= 91 ? 1 : 0, y: step > 91 ? 1 : 0, throttle: 0.65 };
			MissionRules.ObserveControls(rules, input.x, input.y, 1 / 30, step / 30);
			if (TutorialHandoff.Begin(gate, rules, flight)) recoveries++;
			FlightMath.Step(flight, TutorialHandoff.Filter(gate, input), 1 / 30);
		}
		expect(recoveries).toBe(1); expect(rules.phase).toBe("tutorial_target");
		expect(rules.turnObserved).toBe(3); expect(rules.pitchObserved).toBe(3);
		expect(flight.y).toBeCloseTo(800, 5); expect(flight.pitch).toBeCloseTo(0, 5);
		expect(gate.blocked).toBe(true); expect(rules.elapsed).toBeCloseTo(242 / 30, 5);
	});
	for (const [name, altitude, pitch, bank] of [
		["inverted", 180, -0.6, math.pi], ["steep climb", 650, 1.2, 0],
		["steep dive", 650, -1.2, 0], ["low level", 80, 0, 0],
		["descending without headroom", 220, -0.25, 0],
	] as Array<[string, number, number, number]>) {
		it(`recovers ${name} once, retaining progress, clock and selected speed through held input`, () => {
			const rules = MissionRules.NewState(1, 100);
			const flight = FlightMath.FromPose(400, altitude, -500, 0.4, pitch, 230, bank);
			const handoff = TutorialHandoff.New();
			const raw = { x: 0.8, y: -1, throttle: 0.8 };
			rules.turnObserved = 2.99; rules.pitchObserved = 2.99;
			MissionRules.ObserveControls(rules, raw.x, raw.y, 1 / 30, 106);
			expect(TutorialHandoff.Begin(handoff, rules, flight)).toBe(true);
			expect(flight.speed).toBe(230);
			expect(rules.turnObserved).toBe(3); expect(rules.pitchObserved).toBe(3);
			expect(rules.elapsed).toBe(6); expect(rules.stepSince).toBe(6);
			for (let step = 0; step < 180; step++) {
				MissionRules.ObserveControls(rules, raw.x, raw.y, 1 / 30, 106 + step / 30);
				expect(TutorialHandoff.Begin(handoff, rules, flight)).toBe(false);
				FlightMath.Step(flight, TutorialHandoff.Filter(handoff, raw), 1 / 30);
			}
			expect(flight.y).toBeCloseTo(800, 5); expect(flight.pitch).toBeCloseTo(0, 5);
			expect(flight.roll).toBeCloseTo(0, 5); expect(raw.throttle).toBe(0.8);
			expect(raw.y).toBe(-1); expect(handoff.blocked).toBe(true);
			// Releasing only one axis is insufficient; a centered sample unlocks both.
			TutorialHandoff.Filter(handoff, { ...raw, x: 0 });
			expect(handoff.blocked).toBe(true);
			TutorialHandoff.Filter(handoff, { x: 0.1, y: -0.1, throttle: raw.throttle });
			expect(handoff.blocked).toBe(false);
			FlightMath.Step(flight, TutorialHandoff.Filter(handoff, raw), 1 / 30);
			expect(flight.pitch).toBeLessThan(-0.01);
			expect(rules.phase).toBe("tutorial_target");
		});
	}
	it("keeps gentle safe completion on the identical continuous flight path", () => {
		const rules = MissionRules.NewState(1, 0), handoff = TutorialHandoff.New();
		const flight = FlightMath.FromPose(50, 250, 500, 0.2, 0.05, 160, 0.2);
		const baseline = { ...flight }, raw = { x: 0, y: 0, throttle: 0.65 };
		rules.turnObserved = 3; rules.pitchObserved = 3; MissionRules.Tick(rules, 6);
		expect(TutorialHandoff.Begin(handoff, rules, flight)).toBe(false);
		expect(flight).toEqual(baseline);
		for (let step = 0; step < 90; step++) {
			FlightMath.Step(flight, TutorialHandoff.Filter(handoff, raw), 1 / 30);
			FlightMath.Step(baseline, raw, 1 / 30);
		}
		expect(flight).toEqual(baseline); expect(handoff.blocked).toBe(false);
		// A later dive in targeting must not trigger a second decision.
		flight.y = 30; expect(TutorialHandoff.Begin(handoff, rules, flight)).toBe(false);
		expect(flight.y).toBe(30);
	});
	it("drops the latch at the bandit beat and never recovers live combat or other missions", () => {
		const rules = MissionRules.NewState(1, 0), flight = FlightMath.NewState();
		rules.turnObserved = 3; rules.pitchObserved = 3; MissionRules.Tick(rules, 6);
		const gate = TutorialHandoff.New(); flight.y = 30; TutorialHandoff.Begin(gate, rules, flight);
		MissionRules.CycleTarget(rules, 9); expect(TutorialHandoff.Practice(rules)).toBe(true);
		MissionRules.RecordKill(rules, "radar", "ground", true, 12);
		expect(rules.groundKills).toBe(1); expect(rules.phase).toBe("tutorial_bandits");
		expect(rules.banditsDueAt).toBe(16); expect(TutorialHandoff.Practice(rules)).toBe(false);
		if (!TutorialHandoff.Practice(rules)) gate.blocked = false;
		expect(TutorialHandoff.Filter(gate, { x: 0, y: -1, throttle: 0.65 }).y).toBe(-1);
		MissionRules.Tick(rules, 16); flight.y = 10;
		expect(TutorialHandoff.Begin(TutorialHandoff.New(), rules, flight)).toBe(false);
		expect(MissionRules.RecoverPractice(rules, flight)).toBe(false);
		expect(TutorialHandoff.Begin(TutorialHandoff.New(), MissionRules.NewState(2, 0), flight)).toBe(false);
		expect(flight.y).toBe(10);
	});
	it("discards pre-recovery prediction and ignores held sticks until neutral without replaying recovery packets", () => {
		const predictor = FlightPrediction.New(FlightMath.FromPose(100, 180, 500, 0, -0.6, 230, math.pi));
		const raw = { x: 0.8, y: -1, throttle: 0.8 };
		for (let frame = 1; frame <= 30; frame++) FlightPrediction.Step(predictor, raw, 1 / 60, frame / 60);
		predictor.pending.y = -100;
		const truth = FlightMath.FromPose(0, 800, 500, 0, 0, 230);
		const packet = FlightPrediction.Decode(FlightPrediction.Encode(10, truth, 0, 0.2, 0.03, 1))!;
		expect(packet.recovery).toBe(1);
		expect(FlightPrediction.Reconcile(predictor, packet.state, 0.6, packet.sequence, 0.23, packet.recovery)).toBe("snap");
		expect(predictor.state).toEqual(truth); expect(predictor.count).toBe(0); expect(predictor.pending.y).toBe(0);
		for (let frame = 1; frame <= 120; frame++) FlightPrediction.Step(predictor, raw, 1 / 60, 0.6 + frame / 60);
		expect(predictor.state.y).toBeCloseTo(800, 5); expect(predictor.state.pitch).toBeCloseTo(0, 5);
		// Stale pre-recovery packet can't undo the reset.
		expect(FlightPrediction.Reconcile(predictor, truth, 3, 9)).toBe("none");
		FlightPrediction.Step(predictor, { x: 0, y: 0, throttle: 0.8 }, 1 / 30, 3);
		expect(predictor.blocked).toBe(true);
		FlightPrediction.Reconcile(predictor, { ...predictor.state }, 3, 11, 3, 1);
		expect(predictor.blocked).toBe(true); // local neutral is not a server acknowledgement
		FlightPrediction.Reconcile(predictor, { ...predictor.state }, 3, 12, 3, 2);
		expect(predictor.blocked).toBe(false);
		FlightPrediction.Step(predictor, raw, 1 / 30, 3.04);
		expect(predictor.state.pitch).toBeLessThan(-0.01);
	});
	it("handles a lost blocked packet by snapping once to the released recovery epoch", () => {
		const predictor = FlightPrediction.New(FlightMath.NewState());
		const truth = FlightMath.FromPose(0, 800, 400, 0, 0, 180);
		expect(FlightPrediction.Reconcile(predictor, truth, 1, 10, undefined, 2)).toBe("snap");
		expect(predictor.blocked).toBe(false); expect(predictor.state).toEqual(truth);
		expect(FlightPrediction.Decode([...FlightPrediction.Encode(1, truth, 0, 0, 0), 7])).toBeUndefined();
	});
});

// These are the same helpers called by FlightController's HUD and packet handlers.
describe("production recovery handler ordering", () => {
	it("keeps a stale movement HUD from releasing held steering, waits for server neutral acknowledgement", () => {
		const p = FlightPrediction.New(FlightMath.NewState());
		const truth = FlightMath.FromPose(0, 800, 500, 0, 0, 160);
		const held = { x: 1, y: 1, throttle: 0.65 };
		FlightPrediction.Reconcile(p, truth, 1, 10, undefined, 1);
		FlightPrediction.ObservePhase(p, "tutorial_move"); // delayed reliable HUD
		FlightPrediction.Step(p, held, 1 / 30, 1.1);
		expect(p.blocked).toBe(true); expect(p.state.pitch).toBeCloseTo(0, 6);
		FlightPrediction.ObservePhase(p, "tutorial_target");
		FlightPrediction.Step(p, { ...held, x: 0, y: 0 }, 1 / 30, 1.2);
		// Neutral upstream is lost / late; newer marker 1 still says server is blocked.
		const current = { ...p.state };
		FlightPrediction.Reconcile(p, current, 1.2, 11, 1.2, 1);
		expect(p.state).toEqual(current); // no replay of the recovery teleport
		FlightPrediction.Step(p, held, 1 / 30, 1.3);
		expect(p.blocked).toBe(true); expect(p.state.pitch).toBeCloseTo(0, 6);
		FlightPrediction.Reconcile(p, { ...p.state }, 1.3, 13, 1.3, 2);
		expect(FlightPrediction.Reconcile(p, truth, 1.3, 12, undefined, 1)).toBe("none");
		FlightPrediction.Reconcile(p, { ...p.state }, 1.3, 14, 1.3, 1);
		FlightPrediction.Reconcile(p, { ...p.state }, 1.3, 15, 1.3, 2);
		expect(p.blocked).toBe(false);
		FlightPrediction.Step(p, held, 1 / 30, 1.4);
		expect(math.abs(p.state.pitch)).toBeGreaterThan(0.01);
	});
	it("makes phase exit terminal even when release packets are lost and old lesson HUD arrives later", () => {
		for (const first of [0, 1, 2]) {
			const p = FlightPrediction.New(FlightMath.NewState());
			const truth = FlightMath.FromPose(0, 800, 500, 0, 0, 160);
			if (first > 0) FlightPrediction.Reconcile(p, truth, 1, 1, undefined, first);
			FlightPrediction.ObservePhase(p, "tutorial_bandits");
			FlightPrediction.ObservePhase(p, "tutorial_move");
			FlightPrediction.ObservePhase(p, "tutorial_missile");
			FlightPrediction.Reconcile(p, { ...p.state }, 2, 2, undefined, 1);
			expect(p.blocked).toBe(false);
			FlightPrediction.Step(p, { x: 0, y: 1, throttle: 0.65 }, 1 / 30, 2.1);
			expect(math.abs(p.state.pitch)).toBeGreaterThan(0.01);
		}
	});
});
