import { FlightMath, FlightState } from "./FlightMath";
import { FlightInput } from "./Types";

// Client-side prediction for the player's own jet.
//
// The client runs the same pure FlightMath.Step the server runs, every render
// frame (in the server's fixed 1/30 s steps plus a draw-only partial step),
// with its own input, so the jet responds with zero network delay. The server
// stays authoritative: about 20 times a second it sends its state, and the
// predictor compares it with what the client itself predicted *at the moment
// that server state was taken* (now - one-way latency, from a ring buffer of
// past predictions). The difference is the real divergence; it is applied to
// the current state gradually (or ignored when tiny, or snapped when huge).
//
// History entries are stored "raw" (state minus every correction applied so
// far) and sampled back by adding the running correction total, which is the
// same as shifting the whole history by each correction without touching it.
// That way a correction already applied is never counted twice.

/** Same fixed step as CombatService, so client and server integrate identically. */
const FIXED_STEP = 1 / 30;
/** After a long hitch, simulate at most this much at once (reconciliation covers the rest). */
const MAX_CATCH_UP = 0.25;
const HISTORY = 96; // 3.2 s of fixed steps; longer than any latency we reconcile against
const KEYS = ["x", "y", "z", "yaw", "pitch", "roll", "speed"] as const;
const ANGLES = ["yaw", "pitch", "roll"] as const;

export interface Predictor {
	/** Simulated state at the last fixed step (what history and reconciliation use). */
	state: FlightState;
	/** `state` advanced by the leftover partial step; what the client draws. */
	display: FlightState;
	/** Unsimulated time carried to the next frame (< FIXED_STEP). */
	accumulator: number;
	/** Correction still to blend in (server minus prediction at the matching time). */
	pending: FlightState;
	/** Sum of every correction applied so far. */
	applied: FlightState;
	times: number[];
	raw: FlightState[];
	head: number;
	count: number;
	/** Smoothed round trip (seconds); undefined until the first echoed input. */
	rtt?: number;
	/** Last accepted server packet sequence (unreliable packets can arrive out of order). */
	sequence: number;
	/** Outcome of the latest reconciliation, for tests and Studio diagnostics. */
	last: "none" | "ignore" | "blend" | "snap";
}

function zero(): FlightState { return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0 }; }
// Scratch tables reused by Reconcile so a server packet allocates nothing.
const scratchMatch = zero();
const scratchError = zero();
function copyInto(target: FlightState, source: FlightState): void {
	for (const key of KEYS) target[key] = source[key];
}

export const FlightPrediction = {
	/** Position errors below this many studs are noise from frame-rate integration; leave them. */
	IgnoreDistance: 2,
	/** Position errors at or above this are a real disagreement; jump instead of sliding. */
	SnapDistance: 60,
	/** Exponential blend rate (1/s) for corrections between the two thresholds. */
	BlendRate: 5,
	/** Angle errors below this (radians) are ignored, matching the position deadzone. */
	IgnoreAngle: 0.004,
	/** Seconds of the evade barrel roll; the server uses the same value for invulnerability. */
	EvadeRollSeconds: 1.6,
	/** Round trip assumed until the first echoed input arrives. */
	DefaultRtt: 0.15,

	New(initial: FlightState): Predictor {
		const raw: FlightState[] = [];
		const times: number[] = [];
		for (let index = 0; index < HISTORY; index++) { raw.push(zero()); times.push(0); }
		const state = zero();
		copyInto(state, initial);
		return { state, display: zero(), accumulator: 0, pending: zero(), applied: zero(), times, raw, head: 0, count: 0, sequence: -1, last: "none" };
	},

	/** Blend `from` toward `to` by `alpha`, always across the short side of the ±pi seam. */
	BlendAngle(from: number, to: number, alpha: number): number {
		return FlightMath.WrapAngle(from + FlightMath.WrapAngle(to - from) * alpha);
	},

	/**
	 * Advances the prediction by one render frame and returns the state to draw.
	 * Blends in part of any pending correction, then runs as many fixed 1/30 s
	 * FlightMath steps as the frame covers (exactly the server's integration, so
	 * frame rate never becomes divergence), then draws a copy advanced by the
	 * leftover fraction of a step, so there is no added visual latency.
	 */
	Step(predictor: Predictor, input: FlightInput, dt: number, now: number): FlightState {
		dt = math.max(0, dt);
		const pending = predictor.pending;
		const alpha = FlightMath.DampAlpha(FlightPrediction.BlendRate, dt);
		let corrected = false;
		for (const key of KEYS) {
			const delta = pending[key] * alpha;
			if (delta === 0) continue;
			predictor.state[key] += delta;
			predictor.applied[key] += delta;
			pending[key] -= delta;
			corrected = true;
		}
		if (corrected) predictor.state.yaw = FlightMath.WrapAngle(predictor.state.yaw);
		predictor.accumulator = math.min(predictor.accumulator + dt, MAX_CATCH_UP);
		while (predictor.accumulator >= FIXED_STEP - 1e-9) {
			FlightMath.Step(predictor.state, input, FIXED_STEP);
			predictor.accumulator = math.max(0, predictor.accumulator - FIXED_STEP);
			FlightPrediction.Record(predictor, now - predictor.accumulator);
		}
		copyInto(predictor.display, predictor.state);
		if (predictor.accumulator > 0) FlightMath.Step(predictor.display, input, predictor.accumulator);
		return predictor.display;
	},

	/** Stores the current state (minus corrections so far) at time `now`. */
	Record(predictor: Predictor, now: number): void {
		predictor.head = (predictor.head + 1) % HISTORY;
		predictor.count = math.min(HISTORY, predictor.count + 1);
		predictor.times[predictor.head] = now;
		const entry = predictor.raw[predictor.head];
		for (const key of KEYS) entry[key] = predictor.state[key] - predictor.applied[key];
	},

	/** Predicted state at time `t` (with every correction since applied), or false with no history. */
	Sample(predictor: Predictor, t: number, out: FlightState): boolean {
		if (predictor.count === 0) return false;
		// Walk back from the newest entry to the first one at or before t.
		let newer = predictor.head;
		let older = predictor.head;
		for (let step = 0; step < predictor.count; step++) {
			const index = (predictor.head - step + HISTORY) % HISTORY;
			older = index;
			if (predictor.times[index] <= t) break;
			newer = index;
		}
		const a = predictor.raw[older], b = predictor.raw[newer];
		const ta = predictor.times[older], tb = predictor.times[newer];
		const f = tb > ta ? math.clamp((t - ta) / (tb - ta), 0, 1) : 0;
		for (const key of KEYS) {
			const value = key === "yaw" ? a.yaw + FlightMath.WrapAngle(b.yaw - a.yaw) * f : a[key] + (b[key] - a[key]) * f;
			out[key] = value + predictor.applied[key];
		}
		return true;
	},

	/** Folds an echoed input time into the round-trip estimate. `hold` is how long the server sat on that input. */
	ObserveRoundTrip(predictor: Predictor, now: number, echoedClientTime: number, hold: number): void {
		if (!FlightMath.IsFinite(echoedClientTime) || !FlightMath.IsFinite(hold) || echoedClientTime <= 0) return;
		const sample = now - echoedClientTime - math.max(0, hold);
		if (sample < 0 || sample > 1.5) return;
		predictor.rtt = predictor.rtt === undefined ? sample : predictor.rtt + (sample - predictor.rtt) * 0.1;
	},

	/**
	 * Reconciles against an authoritative server state received at `now`.
	 * Returns which branch ran: "ignore" (< IgnoreDistance and tiny angles),
	 * "blend" (corrected over the next frames) or "snap" (applied at once).
	 */
	Reconcile(predictor: Predictor, server: FlightState, now: number, sequence: number): Predictor["last"] {
		if (sequence <= predictor.sequence) return "none"; // stale or duplicate unreliable packet
		predictor.sequence = sequence;
		const match = scratchMatch;
		const latency = (predictor.rtt ?? FlightPrediction.DefaultRtt) / 2;
		if (!FlightPrediction.Sample(predictor, now - latency, match)) {
			copyInto(predictor.state, server);
			for (const key of KEYS) predictor.pending[key] = 0;
			predictor.last = "snap";
			return "snap";
		}
		const diff = scratchError;
		for (const key of KEYS) diff[key] = server[key] - match[key];
		diff.yaw = FlightMath.WrapAngle(server.yaw - match.yaw);
		const distance = math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
		if (distance >= FlightPrediction.SnapDistance) {
			// Shift by the whole error: keeps the motion predicted since the server sample.
			for (const key of KEYS) {
				predictor.state[key] += diff[key];
				predictor.applied[key] += diff[key];
				predictor.pending[key] = 0;
			}
			predictor.state.yaw = FlightMath.WrapAngle(predictor.state.yaw);
			predictor.last = "snap";
			return "snap";
		}
		const ignorePosition = distance < FlightPrediction.IgnoreDistance;
		let angles = 0;
		for (const key of ANGLES) angles = math.max(angles, math.abs(diff[key]));
		const ignoreAngles = angles < FlightPrediction.IgnoreAngle;
		// Replace (not add to) the pending correction: the newest measurement already
		// includes everything applied since, because samples carry `applied`.
		for (const key of KEYS) {
			const position = key === "x" || key === "y" || key === "z";
			const angle = key === "yaw" || key === "pitch" || key === "roll";
			predictor.pending[key] = (position && ignorePosition) || (angle && ignoreAngles) ? 0 : diff[key];
		}
		predictor.last = ignorePosition && ignoreAngles ? "ignore" : "blend";
		return predictor.last;
	},

	/** Server packet layout shared by both ends of the FlightState remote. */
	Encode(sequence: number, state: FlightState, evadeRemaining: number, echoedClientTime: number, hold: number): FlightStatePacket {
		return [sequence, state.x, state.y, state.z, state.yaw, state.pitch, state.roll, state.speed, evadeRemaining, echoedClientTime, hold];
	},
	/** Validates a received packet; returns undefined for anything malformed. */
	Decode(packet: unknown): DecodedFlightState | undefined {
		if (!typeIs(packet, "table")) return undefined;
		const values = packet as unknown[];
		for (let index = 0; index < 11; index++) if (!FlightMath.IsFinite(values[index])) return undefined;
		const n = values as number[];
		return {
			sequence: n[0],
			state: { x: n[1], y: n[2], z: n[3], yaw: n[4], pitch: n[5], roll: n[6], speed: n[7] },
			evadeRemaining: n[8], echoedClientTime: n[9], hold: n[10],
		};
	},
};

/** [sequence, x, y, z, yaw, pitch, roll, speed, evadeRemaining, echoedClientTime, hold] — ~100 bytes. */
export type FlightStatePacket = [number, number, number, number, number, number, number, number, number, number, number];
export interface DecodedFlightState {
	sequence: number;
	state: FlightState;
	evadeRemaining: number;
	echoedClientTime: number;
	hold: number;
}
