import { FlightMath, FlightState } from "./FlightMath";
import { FlightInput } from "./Types";

// Client-side prediction for the player's own jet.
//
// The client runs the same pure FlightMath.Step the server runs, every render
// frame (in the server's fixed 1/30 s steps plus a draw-only partial step),
// with its own input, so the jet responds with zero network delay. The server
// stays authoritative: about 20 times a second it sends its state, and the
// predictor compares it with what the client itself predicted for the same
// point in the flight. The server applies each input one upstream delay late
// and its state arrives one downstream delay later, so that point is a full
// round trip back. It is known exactly: every input is stamped with the
// predicted time at which the client starts applying it, and the server echoes
// the newest stamp plus how long (in fixed steps) it has flown on it, so the
// matching prediction is at stamp + hold in a ring buffer of past predictions. The difference is the real divergence; it is applied to
// the current state gradually (or ignored when tiny, or snapped when huge).
//
// History entries are stored "raw" (state minus every correction applied so
// far) and sampled back by adding the running correction total, which is the
// same as shifting the whole history by each correction without touching it.
// That way a correction already applied is never counted twice.
//
// Attitude is reconciled on the orientation quaternion (componentwise, on the
// same hemisphere, renormalized), never on yaw/pitch/roll: those are derived and
// jump by pi when a loop passes the vertical, which is not a real error.

/** Same fixed step as CombatService, so client and server integrate identically. */
const FIXED_STEP = 1 / 30;
/** After a long hitch, simulate at most this much at once (reconciliation covers the rest). */
const MAX_CATCH_UP = 0.25;
const HISTORY = 96; // 3.2 s of fixed steps; longer than any latency we reconcile against
/** Integrated fields: the only ones corrected, recorded and sent. */
const KEYS = ["x", "y", "z", "qw", "qx", "qy", "qz", "lean", "speed"] as const;
const QUATERNION = ["qw", "qx", "qy", "qz"] as const;
/** Every field, including the derived angles, for plain copies. */
const ALL = ["x", "y", "z", "qw", "qx", "qy", "qz", "lean", "yaw", "pitch", "roll", "speed"] as const;
/** Required legacy packet fields (the M1 recovery epoch is optional). */
const PACKET_FIELDS = 13;

export interface Predictor {
	/** Simulated state at the last fixed step (what history and reconciliation use). */
	state: FlightState;
	/** One M1 recovery epoch per sortie; discard pre-recovery predicted motion. */
	recoverySeen?: boolean;
	blocked?: boolean;
	/** Terminal within this sortie: delayed practice packets cannot re-arm combat. */
	recoveryExited?: boolean;
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

function zero(): FlightState { return { x: 0, y: 0, z: 0, qw: 0, qx: 0, qy: 0, qz: 0, lean: 0, yaw: 0, pitch: 0, roll: 0, speed: 0 }; }
// Scratch tables reused by Reconcile so a server packet allocates nothing.
const scratchMatch = zero();
const scratchError = zero();
function copyInto(target: FlightState, source: FlightState): void {
	for (const key of ALL) target[key] = source[key];
}
/** Angle (radians) between two orientations, from their quaternions (either sign). */
function attitudeError(a: FlightState, b: FlightState): number {
	const dot = a.qw * b.qw + a.qx * b.qx + a.qy * b.qy + a.qz * b.qz;
	const la = math.sqrt(a.qw * a.qw + a.qx * a.qx + a.qy * a.qy + a.qz * a.qz);
	const lb = math.sqrt(b.qw * b.qw + b.qx * b.qx + b.qy * b.qy + b.qz * b.qz);
	if (la < 1e-9 || lb < 1e-9) return math.pi;
	return 2 * math.acos(math.min(1, math.abs(dot) / (la * lb)));
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

	/** Shared by the production HUD handler and ordering regressions. Movement HUD may
	 * predate the unreliable recovery packet; only leaving all lessons is terminal. */
	ObservePhase(predictor: Predictor, phase: string): void {
		if (phase === "tutorial_move" || phase === "tutorial_target" || phase === "tutorial_missile") return;
		predictor.recoveryExited = true; predictor.blocked = false;
	},

	New(initial: FlightState): Predictor {
		const raw: FlightState[] = [];
		const times: number[] = [];
		for (let index = 0; index < HISTORY; index++) { raw.push(zero()); times.push(0); }
		const state = zero();
		copyInto(state, initial);
		FlightMath.Sync(state);
		return { state, display: zero(), accumulator: 0, pending: zero(), applied: zero(), times, raw, head: 0, count: 0, sequence: -1, last: "none" };
	},

	/** Blend `from` toward `to` by `alpha`, always across the short side of the ±pi seam (HUD angles). */
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
		if (predictor.blocked) {
			// Neutral still travels upstream. Wait for marker 2 before predicting fresh
			// steering: the neutral packet may be lost or not yet reach the server.
			input = { ...input, x: 0, y: 0 };
		}
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
		if (corrected) FlightMath.Normalize(predictor.state);
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

	/**
	 * Stamp for input sampled this frame: the predicted time of the last fixed-step
	 * boundary, which is where the next fixed step (the first to use it) begins.
	 * Call before Step. The server echoes it back with the time flown on it.
	 */
	InputStamp(predictor: Predictor, now: number): number {
		return predictor.count > 0 ? predictor.times[predictor.head] : now;
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
		// The two neighbours are 1/30 s apart, so their quaternions share a hemisphere.
		for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * f + predictor.applied[key];
		FlightMath.Sync(out);
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
	 * `matchTime` is the predicted time that state corresponds to (echoed stamp + hold).
	 * Returns which branch ran: "ignore" (< IgnoreDistance and tiny angles),
	 * "blend" (corrected over the next frames) or "snap" (applied at once).
	 */
	Reconcile(predictor: Predictor, server: FlightState, now: number, sequence: number, matchTime?: number, recovery = 0): Predictor["last"] {
		if (sequence <= predictor.sequence) return "none"; // stale or duplicate unreliable packet
		predictor.sequence = sequence;
		if (predictor.recoveryExited) recovery = 0;
		if (recovery > 0 && !predictor.recoverySeen) {
			predictor.recoverySeen = true; predictor.blocked = recovery === 1;
			copyInto(predictor.state, server); copyInto(predictor.display, server);
			for (const key of KEYS) { predictor.pending[key] = 0; predictor.applied[key] = 0; }
			predictor.count = 0; predictor.head = 0; predictor.accumulator = 0;
			predictor.last = "snap";
			return "snap";
		}
		if (recovery === 2) predictor.blocked = false;
		const match = scratchMatch;
		// Exact when the server echoed an input (stamp + hold); otherwise a full round trip ago.
		const at = matchTime ?? now - (predictor.rtt ?? FlightPrediction.DefaultRtt);
		if (!FlightPrediction.Sample(predictor, at, match)) {
			copyInto(predictor.state, server);
			FlightMath.Sync(predictor.state);
			for (const key of KEYS) predictor.pending[key] = 0;
			predictor.last = "snap";
			return "snap";
		}
		const diff = scratchError;
		// q and -q are the same attitude: correct toward whichever is nearer.
		const hemisphere = server.qw * match.qw + server.qx * match.qx + server.qy * match.qy + server.qz * match.qz < 0 ? -1 : 1;
		for (const key of KEYS) diff[key] = server[key] - match[key];
		for (const key of QUATERNION) diff[key] = server[key] * hemisphere - match[key];
		const distance = math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
		if (distance >= FlightPrediction.SnapDistance) {
			// Shift by the whole error: keeps the motion predicted since the server sample.
			for (const key of KEYS) {
				predictor.state[key] += diff[key];
				predictor.applied[key] += diff[key];
				predictor.pending[key] = 0;
			}
			FlightMath.Normalize(predictor.state);
			predictor.last = "snap";
			return "snap";
		}
		const ignorePosition = distance < FlightPrediction.IgnoreDistance;
		const angles = math.max(attitudeError(server, match), math.abs(diff.lean));
		const ignoreAngles = angles < FlightPrediction.IgnoreAngle;
		// Replace (not add to) the pending correction: the newest measurement already
		// includes everything applied since, because samples carry `applied`.
		for (const key of KEYS) {
			const position = key === "x" || key === "y" || key === "z";
			const angle = !position && key !== "speed";
			predictor.pending[key] = (position && ignorePosition) || (angle && ignoreAngles) ? 0 : diff[key];
		}
		predictor.last = ignorePosition && ignoreAngles ? "ignore" : "blend";
		return predictor.last;
	},

	/** Server packet layout shared by both ends of the FlightState remote. */
	Encode(sequence: number, state: FlightState, evadeRemaining: number, echoedClientTime: number, hold: number, recovery = 0): FlightStatePacket {
		const packet: FlightStatePacket = [sequence, state.x, state.y, state.z, state.qw, state.qx, state.qy, state.qz, state.lean, state.speed, evadeRemaining, echoedClientTime, hold];
		if (recovery > 0) packet[13] = recovery;
		return packet;
	},
	/** Validates a received packet; returns undefined for anything malformed. */
	Decode(packet: unknown): DecodedFlightState | undefined {
		if (!typeIs(packet, "table")) return undefined;
		const values = packet as unknown[];
		for (let index = 0; index < PACKET_FIELDS; index++) if (!FlightMath.IsFinite(values[index])) return undefined;
		const n = values as number[];
		if (n[13] !== undefined && n[13] !== 1 && n[13] !== 2) return undefined;
		// A zero-length quaternion is not an attitude.
		if (n[4] * n[4] + n[5] * n[5] + n[6] * n[6] + n[7] * n[7] < 0.5) return undefined;
		const state = FlightMath.Sync({ x: n[1], y: n[2], z: n[3], qw: n[4], qx: n[5], qy: n[6], qz: n[7], lean: n[8], yaw: 0, pitch: 0, roll: 0, speed: n[9] });
		return { sequence: n[0], state, evadeRemaining: n[10], echoedClientTime: n[11], hold: n[12], recovery: n[13] ?? 0 };
	},
};

/** [sequence, x, y, z, qw, qx, qy, qz, lean, speed, evadeRemaining, echoedClientTime, hold, recovery?] — ~120 bytes; recovery 1 = release latch, 2 = released. */
export type FlightStatePacket = [number, number, number, number, number, number, number, number, number, number, number, number, number, number?];
export interface DecodedFlightState {
	recovery: number;
	sequence: number;
	state: FlightState;
	evadeRemaining: number;
	echoedClientTime: number;
	hold: number;
}
