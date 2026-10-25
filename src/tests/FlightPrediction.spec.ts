import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TelemetryCodec } from "../shared/TelemetryCodec";
import { Telemetry } from "../shared/Types";

const CRUISE = { x: 0, y: 0, throttle: 0.65 };
function copy(state: FlightState): FlightState { return { ...state }; }
/** Predictor with `seconds` of 60 Hz history ending at t = seconds. */
function flown(seconds: number, input = CRUISE) {
	const predictor = FlightPrediction.New(FlightMath.NewState());
	predictor.rtt = 0; // reconcile against "now" so tests control the matching time exactly
	let now = 0;
	for (let frame = 0; frame < seconds * 60; frame++) { now += 1 / 60; FlightPrediction.Step(predictor, input, 1 / 60, now); }
	return $tuple(predictor, now);
}

describe("client flight prediction and reconciliation", () => {
	it("is deterministic: the predictor and the server step are the same pure function", () => {
		const server = FlightMath.NewState();
		const predictor = FlightPrediction.New(FlightMath.NewState());
		const inputs = [{ x: 0.6, y: 0.3, throttle: 1 }, { x: -1, y: -0.2, throttle: 0.2 }, { x: 0, y: 1, throttle: 0.65 }];
		let now = 0;
		for (let step = 0; step < 90; step++) {
			const input = inputs[math.floor(step / 30)];
			FlightMath.Step(server, input, 1 / 30);
			now += 1 / 30;
			FlightPrediction.Step(predictor, input, 1 / 30, now);
		}
		expect(predictor.state).toEqual(server);
	});
	it("stays inside the ignore deadzone when a 60 fps client tracks the 30 Hz server", () => {
		const server = FlightMath.NewState();
		const predictor = FlightPrediction.New(FlightMath.NewState());
		predictor.rtt = 0;
		const input = { x: 0.8, y: 0.2, throttle: 0.9 };
		let now = 0;
		let sequence = 0;
		let worst = 0;
		for (let step = 0; step < 60; step++) {
			FlightMath.Step(server, input, 1 / 30);
			for (let half = 0; half < 2; half++) { now += 1 / 60; FlightPrediction.Step(predictor, input, 1 / 60, now); }
			if (step % 2 === 1) {
				sequence += 1;
				const before = copy(predictor.state);
				FlightPrediction.Reconcile(predictor, server, now, sequence);
				const dx = server.x - before.x, dy = server.y - before.y, dz = server.z - before.z;
				worst = math.max(worst, math.sqrt(dx * dx + dy * dy + dz * dz));
			}
		}
		// Frame-rate integration differences never accumulate past the deadzone between packets.
		expect(worst).toBeLessThan(FlightPrediction.IgnoreDistance);
	});
	it("ignores sub-2-stud position error", () => {
		const [predictor, now] = flown(0.5);
		const server = copy(predictor.state);
		server.x += 1.5;
		expect(FlightPrediction.Reconcile(predictor, server, now, 1)).toBe("ignore");
		expect(predictor.pending.x).toBe(0);
		const reference = FlightPrediction.New(copy(predictor.state));
		FlightPrediction.Step(predictor, CRUISE, 1 / 60, now + 1 / 60);
		FlightPrediction.Step(reference, CRUISE, 1 / 60, now + 1 / 60);
		// Only the flight model moved it: no correction leaked in.
		expect(predictor.state.x).toBeCloseTo(reference.state.x, 6);
	});
	it("blends medium errors exponentially without overshoot", () => {
		const [predictor, start] = flown(0.5);
		const server = copy(predictor.state);
		server.x += 30;
		expect(FlightPrediction.Reconcile(predictor, server, start, 1)).toBe("blend");
		const reference = FlightPrediction.New(copy(predictor.state));
		let now = start;
		let previousGap = 30;
		for (let frame = 0; frame < 60; frame++) {
			now += 1 / 60;
			FlightPrediction.Step(predictor, CRUISE, 1 / 60, now);
			FlightPrediction.Step(reference, CRUISE, 1 / 60, now);
			const gap = 30 - (predictor.state.x - reference.state.x);
			expect(gap).toBeLessThanOrEqual(previousGap);
			expect(gap).toBeGreaterThanOrEqual(0);
			previousGap = gap;
		}
		// One second at BlendRate 5 leaves e^-5 (< 1%) of the correction.
		expect(previousGap).toBeLessThan(30 * 0.01);
		// A single frame moves only a small fraction: no visible pop.
		const [fresh, t] = flown(0.5);
		const target = copy(fresh.state); target.x += 30;
		FlightPrediction.Reconcile(fresh, target, t, 1);
		const x0 = fresh.state.x;
		const ref = FlightPrediction.New(copy(fresh.state));
		FlightPrediction.Step(fresh, CRUISE, 1 / 60, t + 1 / 60);
		FlightPrediction.Step(ref, CRUISE, 1 / 60, t + 1 / 60);
		expect(fresh.state.x - ref.state.x).toBeLessThan(3);
		expect(fresh.state.x).never.toBe(x0);
	});
	it("snaps errors of 60 studs or more at once", () => {
		const [predictor, now] = flown(0.5);
		const server = copy(predictor.state);
		server.z -= 75;
		expect(FlightPrediction.Reconcile(predictor, server, now, 1)).toBe("snap");
		expect(predictor.state.z).toBeCloseTo(server.z, 6);
		expect(predictor.pending.z).toBe(0);
	});
	it("snaps straight to the server state when it has no history yet", () => {
		const predictor = FlightPrediction.New(FlightMath.NewState());
		const server = FlightMath.NewState();
		server.x = 400; server.speed = 300;
		expect(FlightPrediction.Reconcile(predictor, server, 1, 1)).toBe("snap");
		expect(predictor.state).toEqual(server);
	});
	it("does not count a correction twice when the next packet arrives mid-blend", () => {
		const [predictor, start] = flown(0.5);
		const server = copy(predictor.state);
		server.x += 30;
		FlightPrediction.Reconcile(predictor, server, start, 1);
		// The authoritative jet keeps flying 30 studs to +X of the uncorrected prediction.
		const truth = FlightPrediction.New(server);
		const uncorrected = FlightPrediction.New(copy(predictor.state));
		let now = start;
		for (let frame = 0; frame < 6; frame++) {
			now += 1 / 60;
			FlightPrediction.Step(predictor, CRUISE, 1 / 60, now);
			FlightPrediction.Step(truth, CRUISE, 1 / 60, now);
			FlightPrediction.Step(uncorrected, CRUISE, 1 / 60, now);
		}
		const applied = predictor.state.x - uncorrected.state.x;
		expect(applied).toBeGreaterThan(1);
		FlightPrediction.Reconcile(predictor, truth.state, now, 2);
		// Only what is still missing is pending, not another full 30 studs.
		expect(predictor.pending.x).toBeCloseTo(30 - applied, 3);
	});
	it("blends yaw across the ±pi seam the short way", () => {
		expect(FlightPrediction.BlendAngle(math.pi - 0.1, -math.pi + 0.1, 0.5)).toBeCloseTo(-math.pi, 5);
		expect(math.abs(FlightPrediction.BlendAngle(math.pi - 0.05, -math.pi + 0.05, 0.5))).toBeCloseTo(math.pi, 5);
		const start = FlightMath.NewState();
		start.yaw = math.pi - 0.02;
		const predictor = FlightPrediction.New(start);
		predictor.rtt = 0;
		FlightPrediction.Record(predictor, 0);
		const server = copy(start);
		server.yaw = -math.pi + 0.02; // 0.04 rad away across the seam, not 6.24 rad
		expect(FlightPrediction.Reconcile(predictor, server, 0, 1)).toBe("blend");
		expect(predictor.pending.yaw).toBeCloseTo(0.04, 6);
		for (let frame = 1; frame <= 120; frame++) FlightPrediction.Step(predictor, { x: 0, y: 0, throttle: 0.65 }, 1 / 60, frame / 60);
		expect(math.abs(FlightMath.WrapAngle(predictor.state.yaw - server.yaw))).toBeLessThan(0.002);
		expect(predictor.state.yaw).toBeGreaterThanOrEqual(-math.pi);
		expect(predictor.state.yaw).toBeLessThan(math.pi);
	});
	it("drops stale or duplicate unreliable packets", () => {
		const [predictor, now] = flown(0.25);
		const server = copy(predictor.state);
		server.x += 30;
		expect(FlightPrediction.Reconcile(predictor, server, now, 5)).toBe("blend");
		expect(FlightPrediction.Reconcile(predictor, server, now, 5)).toBe("none");
		expect(FlightPrediction.Reconcile(predictor, server, now, 4)).toBe("none");
	});
	it("matches the server sample against history one-way latency ago", () => {
		const [predictor, now] = flown(1);
		predictor.rtt = 0.2;
		// A server state equal to what we predicted 100 ms ago is no error at all,
		// even though the jet has flown ~25 studs since.
		const past = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0 };
		expect(FlightPrediction.Sample(predictor, now - 0.1, past)).toBe(true);
		expect(math.abs(predictor.state.z - past.z)).toBeGreaterThan(20);
		expect(FlightPrediction.Reconcile(predictor, past, now, 1)).toBe("ignore");
	});
	it("estimates round trip from echoed input stamps minus server hold time", () => {
		const predictor = FlightPrediction.New(FlightMath.NewState());
		FlightPrediction.ObserveRoundTrip(predictor, 10.2, 10, 0.05);
		expect(predictor.rtt).toBeCloseTo(0.15, 6);
		FlightPrediction.ObserveRoundTrip(predictor, 11, 0, 0); // no input echoed yet
		FlightPrediction.ObserveRoundTrip(predictor, 11, 12, 0); // impossible negative sample
		expect(predictor.rtt).toBeCloseTo(0.15, 6);
	});
	it("round-trips the flight state packet and rejects malformed ones", () => {
		const state = FlightMath.NewState();
		state.yaw = 1.25;
		const decoded = FlightPrediction.Decode(FlightPrediction.Encode(7, state, 0.4, 12.5, 0.02));
		expect(decoded?.sequence).toBe(7);
		expect(decoded?.state).toEqual(state);
		expect(decoded?.evadeRemaining).toBe(0.4);
		expect(FlightPrediction.Decode([1, 2, 3])).toBeUndefined();
		expect(FlightPrediction.Decode([1, 0 / 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeUndefined();
		expect(FlightPrediction.Decode("state")).toBeUndefined();
	});
	it("packs HUD numbers into a compact array and decodes them in place", () => {
		const into = { kind: "Telemetry", health: 0, speed: 0, altitude: 0, kills: 0, total: 0, missiles: 0, missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false, elapsed: 0 } as Telemetry;
		const packet = TelemetryCodec.Encode(3, {
			health: 80, speed: 255, altitude: 300, kills: 2, total: 4, missiles: 6, missileCooldown: 0.5, evadeCooldown: 0,
			lockProgress: 0.4, incoming: true, lockWarning: false, boundaryWarning: true, elapsed: 12, timeRemaining: 500,
			objectiveProgress: 1, objectiveTotal: 3, groundKills: 1, targetDistance: 900, targetHealth: undefined, protectedHealth: 70,
		});
		expect(packet.size()).toBe(19);
		expect(TelemetryCodec.Decode(packet, into)).toBe(3);
		expect(into.health).toBe(80);
		expect(into.incoming).toBe(true);
		expect(into.lockWarning).toBe(false);
		expect(into.boundaryWarning).toBe(true);
		expect(into.targetHealth).toBeUndefined();
		expect(into.protectedHealth).toBe(70);
		expect(into.targetDamageable).toBeUndefined();
		for (const damageable of [true, false]) {
			const flagged = TelemetryCodec.Encode(4, {
				health: 80, speed: 255, altitude: 300, kills: 2, total: 4, missiles: 6, missileCooldown: 0, evadeCooldown: 0,
				lockProgress: 0, incoming: false, lockWarning: true, boundaryWarning: false, elapsed: 12, timeRemaining: 500,
				objectiveProgress: 1, objectiveTotal: 3, groundKills: 1, targetDistance: 900, targetHealth: 0.5, targetDamageable: damageable,
			});
			expect(TelemetryCodec.Decode(flagged, into)).toBe(4);
			expect(into.targetDamageable).toBe(damageable);
			expect(into.lockWarning).toBe(true);
			expect(into.incoming).toBe(false);
		}
		expect(TelemetryCodec.Decode([1, 2], into)).toBeUndefined();
	});
});
