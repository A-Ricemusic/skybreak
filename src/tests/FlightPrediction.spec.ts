import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { FlightPrediction } from "../shared/FlightPrediction";
import { TELEMETRY_FIELDS, TelemetryCodec } from "../shared/TelemetryCodec";
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
	it("predicts selected speeds throughout the full range after accelerator release", () => {
		for (const mph of [75, 800, 1700, 3000]) {
			const initial = FlightMath.FromPose(0, 1500, 0, 0, 0, FlightMath.FromMph(mph));
			const server = copy(initial), predictor = FlightPrediction.New(initial);
			const input = {x: 0, y: 0, throttle: FlightMath.ThrottleForSpeed(initial.speed)};
			let now = 0;
			for (let i = 0; i < 60; i++) {
				FlightMath.Step(server, input, 1 / 30);
				for (let j = 0; j < 2; j++) { now += 1 / 60; FlightPrediction.Step(predictor, input, 1 / 60, now); }
			}
			expect(predictor.state).toEqual(server);
			expect(FlightPrediction.Decode(FlightPrediction.Encode(1, server, 0, now, 0))?.state.speed).toBe(server.speed);
		}
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
	it("blends attitude across the heading seam the short way, on the quaternion", () => {
		expect(FlightPrediction.BlendAngle(math.pi - 0.1, -math.pi + 0.1, 0.5)).toBeCloseTo(-math.pi, 5);
		expect(math.abs(FlightPrediction.BlendAngle(math.pi - 0.05, -math.pi + 0.05, 0.5))).toBeCloseTo(math.pi, 5);
		const start = FlightMath.SetAttitude(FlightMath.NewState(), math.pi - 0.02, 0);
		const predictor = FlightPrediction.New(start);
		predictor.rtt = 0;
		FlightPrediction.Record(predictor, 0);
		// 0.04 rad away across the seam, not 6.24 rad.
		const server = FlightMath.SetAttitude(copy(start), -math.pi + 0.02, 0);
		expect(FlightPrediction.Reconcile(predictor, server, 0, 1)).toBe("blend");
		for (let frame = 1; frame <= 120; frame++) FlightPrediction.Step(predictor, { x: 0, y: 0, throttle: 0.65 }, 1 / 60, frame / 60);
		expect(math.abs(FlightMath.WrapAngle(predictor.state.yaw - server.yaw))).toBeLessThan(0.002);
		expect(predictor.state.yaw).toBeGreaterThanOrEqual(-math.pi);
		expect(predictor.state.yaw).toBeLessThan(math.pi);
	});
	it("treats q and -q as the same attitude and ignores the yaw flip at the top of a loop", () => {
		const [predictor, now] = flown(0.5);
		const server = copy(predictor.state);
		server.qw = -server.qw; server.qx = -server.qx; server.qy = -server.qy; server.qz = -server.qz;
		expect(FlightPrediction.Reconcile(predictor, server, now, 1)).toBe("ignore");
		// Straight up, a hair either side of the vertical, the derived yaw differs by pi but the jet does not.
		const before = FlightMath.FromPose(0, 400, 0, 0, math.pi / 2 - 1e-4, 230);
		const after = FlightMath.FromPose(0, 400, 0, math.pi, math.pi / 2 - 1e-4, 230, math.pi);
		expect(math.abs(FlightMath.WrapAngle(before.yaw - after.yaw))).toBeCloseTo(math.pi, 3);
		const looping = FlightPrediction.New(before);
		looping.rtt = 0;
		FlightPrediction.Record(looping, 0);
		expect(FlightPrediction.Reconcile(looping, after, 0, 1)).toBe("ignore");
	});
	it("predicts a full loop with the same attitude the server flies", () => {
		const server = FlightMath.NewState();
		server.y = 400;
		const predictor = FlightPrediction.New(server);
		predictor.rtt = 0;
		const input = { x: 0.2, y: 1, throttle: 0.65 };
		let now = 0;
		for (let step = 1; step <= 180; step++) {
			FlightMath.Step(server, input, 1 / 30);
			for (let half = 0; half < 2; half++) { now += 1 / 60; FlightPrediction.Step(predictor, input, 1 / 60, now); }
			if (step % 3 === 0) expect(FlightPrediction.Reconcile(predictor, server, now, step)).toBe("ignore");
		}
	});
	it("drops stale or duplicate unreliable packets", () => {
		const [predictor, now] = flown(0.25);
		const server = copy(predictor.state);
		server.x += 30;
		expect(FlightPrediction.Reconcile(predictor, server, now, 5)).toBe("blend");
		expect(FlightPrediction.Reconcile(predictor, server, now, 5)).toBe("none");
		expect(FlightPrediction.Reconcile(predictor, server, now, 4)).toBe("none");
	});
	it("matches the server sample at the echoed stamp + hold, or a full round trip ago without one", () => {
		const [predictor, now] = flown(1);
		predictor.rtt = 0.2;
		// A server state equal to what we predicted 200 ms ago (a full round trip:
		// input travels up, state travels back) is no error at all, even though the
		// jet has flown ~50 studs since.
		const past = FlightMath.NewState();
		expect(FlightPrediction.Sample(predictor, now - 0.2, past)).toBe(true);
		expect(math.abs(predictor.state.z - past.z)).toBeCloseTo(FlightMath.CruiseSpeed * .2, 5);
		expect(FlightPrediction.Reconcile(predictor, past, now, 1)).toBe("ignore");
		// With an echo the packet names the exact predicted time instead.
		const exact = FlightMath.NewState();
		expect(FlightPrediction.Sample(predictor, now - 0.3, exact)).toBe(true);
		expect(FlightPrediction.Reconcile(predictor, exact, now, 2, now - 0.3)).toBe("ignore");
		expect(FlightPrediction.Reconcile(predictor, exact, now, 3)).never.toBe("ignore");
	});
	it("stays in the ignore band through a full-stick turn with upstream and downstream delay", () => {
		// Lockstep model on the shared 1/30 s grid. Client frame i applies input i
		// starting at its last step boundary (the stamp) and sends it; the server sees
		// it UP steps later, flies on it, and its state reaches the client DOWN steps
		// after that. The server started flying UP + DOWN steps before the client did
		// (it sends "Started" and its clock runs while that travels), so the first
		// packets correct that one-time along-track offset; after that, and through
		// the whole turn, every correction must stay inside the deadzone.
		for (const [UP, DOWN] of [[2, 3], [4, 1], [6, 6]]) {
			const dt = 1 / 30;
			const predictor = FlightPrediction.New(FlightMath.NewState());
			const server = FlightMath.NewState();
			const serverInput = { x: 0, y: 0, throttle: 0.65 };
			let serverStamp = 0, serverSteps = 0, fresh = false, sequence = 0;
			const inputs: Array<{ x: number; y: number; throttle: number; t: number }> = [];
			const inFlight: Array<{ arrive: number; state: FlightState; stamp: number; hold: number; sequence: number }> = [];
			// Server lead: it has already flown UP + DOWN steps when the client starts.
			for (let lead = 0; lead < UP + DOWN; lead++) FlightMath.Step(server, serverInput, dt);
			const outcomes: string[] = [];
			for (let frame = 1; frame <= 150; frame++) {
				const now = frame * dt;
				// Straight for 2 s, full right stick with climb for 1.5 s, full left, then straight.
				const input = frame <= 60 ? { x: 0, y: 0, throttle: 0.65 } : frame <= 105 ? { x: 1, y: 0.6, throttle: 1 } : frame <= 130 ? { x: -1, y: -0.3, throttle: 0.4 } : { x: 0, y: 0, throttle: 0.65 };
				const stamp = FlightPrediction.InputStamp(predictor, now - dt);
				FlightPrediction.Step(predictor, input, dt, now);
				inputs.push({ ...input, t: stamp });
				// Server step for the same tick: newest input that has arrived (UP steps late).
				const arrived = inputs[frame - 1 - UP];
				if (arrived) { serverInput.x = arrived.x; serverInput.y = arrived.y; serverInput.throttle = arrived.throttle; serverStamp = arrived.t; fresh = true; }
				if (fresh) { fresh = false; serverSteps = 0; }
				FlightMath.Step(server, serverInput, dt);
				serverSteps += 1;
				sequence += 1;
				inFlight.push({ arrive: frame + DOWN, state: { ...server }, stamp: serverStamp, hold: serverSteps * dt, sequence });
				for (const packet of inFlight) {
					if (packet.arrive !== frame || packet.stamp <= 0) continue;
					const result = FlightPrediction.Reconcile(predictor, packet.state, now, packet.sequence, packet.stamp + packet.hold);
					if (frame > 45) outcomes.push(result);
				}
			}
			expect(outcomes.size()).toBeGreaterThan(90);
			for (const result of outcomes) expect(result).toBe("ignore");
		}
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
		// Upright, inverted at the top of a loop, and leaning into a turn.
		for (const state of [FlightMath.FromPose(0, 1000, 0, 0, 0, FlightMath.MinSpeed), FlightMath.FromPose(0, 1000, 0, 0, 0, FlightMath.MaxSpeed), FlightMath.SetAttitude(FlightMath.NewState(), 1.25, 0), FlightMath.FromPose(30, 640, -90, math.pi, 0, 190, math.pi), FlightMath.FromPose(0, 300, 0, -0.6, 0.3, 250)]) {
			state.lean = -0.4;
			FlightMath.Sync(state);
			const packet = FlightPrediction.Encode(7, state, 0.4, 12.5, 0.02);
			expect(packet.size()).toBe(13);
			const decoded = FlightPrediction.Decode(packet);
			expect(decoded?.sequence).toBe(7);
			expect(decoded?.state).toEqual(state);
			expect(decoded?.evadeRemaining).toBe(0.4);
			expect(decoded?.echoedClientTime).toBe(12.5);
			expect(decoded?.hold).toBe(0.02);
		}
		expect(FlightPrediction.Decode([1, 2, 3])).toBeUndefined();
		expect(FlightPrediction.Decode([1, 0 / 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0])).toBeUndefined();
		// A zero quaternion is not an attitude.
		expect(FlightPrediction.Decode([1, 0, 0, 0, 0, 0, 0, 0, 0, 200, 0, 0, 0])).toBeUndefined();
		expect(FlightPrediction.Decode("state")).toBeUndefined();
	});
	it("packs HUD numbers into a compact array and decodes them in place", () => {
		const into = { kind: "Telemetry", health: 0, speed: 0, altitude: 0, kills: 0, total: 0, missiles: 0, missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false, elapsed: 0 } as Telemetry;
		const packet = TelemetryCodec.Encode(3, {
			health: 80, speed: 255, altitude: 300, kills: 2, total: 4, missiles: 6, missileCooldown: 0.5, evadeCooldown: 0,
			lockProgress: 0.4, incoming: true, lockWarning: false, boundaryWarning: true, elapsed: 12, timeRemaining: 500,
			objectiveProgress: 1, objectiveTotal: 3, groundKills: 1, targetDistance: 900, targetHealth: undefined, protectedHealth: 70,
			specialCharges: 2, specialCooldown: 1.5, specialActive: 12,
			evadeCharges: 2, optionalKills: 3, incomingDistance: 420,
		});
		expect(packet.size()).toBe(TELEMETRY_FIELDS);
		expect(TelemetryCodec.Decode(packet, into)).toBe(3);
		expect(into.health).toBe(80);
		// Round 2: evade charges, raider kills kept apart from the required tally, nearest missile range.
		expect(into.evadeCharges).toBe(2);
		expect(into.optionalKills).toBe(3);
		expect(into.incomingDistance).toBe(420);
		expect(into.specialCharges).toBe(2);
		expect(into.specialCooldown).toBe(1.5);
		expect(into.specialActive).toBe(12);
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
			// Special fields default to zero when the server omits them; no missile in the air reads as undefined.
			expect(into.specialCharges).toBe(0);
			expect(into.specialActive).toBe(0);
			expect(into.evadeCharges).toBe(0);
			expect(into.incomingDistance).toBeUndefined();
		}
		expect(TelemetryCodec.Decode([1, 2], into)).toBeUndefined();
	});
	it("carries the ace-killed flag without disturbing the other flags", () => {
		const into = { kind: "Telemetry", health: 0, speed: 0, altitude: 0, kills: 0, total: 0, missiles: 0, missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false, elapsed: 0 } as Telemetry;
		for (const aceKilled of [true, false]) for (const damageable of [true, false, undefined]) {
			const packet = TelemetryCodec.Encode(5, {
				health: 60, speed: 240, altitude: 300, kills: 5, total: 5, missiles: 3, missileCooldown: 0, evadeCooldown: 0,
				lockProgress: 0, incoming: true, lockWarning: true, boundaryWarning: true, elapsed: 30, timeRemaining: 400,
				objectiveProgress: 1, objectiveTotal: 1, groundKills: 0, targetDistance: 0, targetDamageable: damageable, aceKilled,
			});
			expect(TelemetryCodec.Decode(packet, into)).toBe(5);
			expect(into.aceKilled).toBe(aceKilled);
			expect(into.targetDamageable).toBe(damageable);
			expect(into.incoming).toBe(true);
			expect(into.lockWarning).toBe(true);
			expect(into.boundaryWarning).toBe(true);
		}
	});
	it("carries the server's pause state and the acknowledged pause serial", () => {
		const into = { kind: "Telemetry", health: 0, speed: 0, altitude: 0, kills: 0, total: 0, missiles: 0, missileCooldown: 0, evadeCooldown: 0, targetName: "", lockProgress: 0, incoming: false, elapsed: 0 } as Telemetry;
		for (const paused of [true, false]) for (const aceKilled of [true, false]) {
			const packet = TelemetryCodec.Encode(6, {
				health: 60, speed: 240, altitude: 300, kills: 5, total: 5, missiles: 3, missileCooldown: 0, evadeCooldown: 0,
				lockProgress: 0, incoming: true, lockWarning: false, boundaryWarning: false, elapsed: 30, timeRemaining: 400,
				objectiveProgress: 1, objectiveTotal: 1, groundKills: 0, targetDistance: 0, aceKilled, paused, pauseAck: 7,
			});
			expect(packet.size()).toBe(TELEMETRY_FIELDS);
			expect(TelemetryCodec.Decode(packet, into)).toBe(6);
			expect(into.paused).toBe(paused);
			expect(into.aceKilled).toBe(aceKilled);
			expect(into.incoming).toBe(true);
			expect(into.pauseAck).toBe(7);
		}
	});
});
