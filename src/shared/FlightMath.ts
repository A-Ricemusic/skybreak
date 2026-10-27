import { WorldAirspace } from "./WorldAirspace";
import { FlightInput } from "./Types";

/**
 * One aircraft's flight state. The orientation is the quaternion (qw, qx, qy, qz)
 * in Roblox CFrame axes: body right +X, up +Y, nose -Z. It is the only attitude
 * that is integrated, so pitching straight up, over the top and down the back of
 * a loop has no gimbal lock. `yaw`, `pitch` and `roll` are derived from it after
 * every change (FlightMath.Sync) for the HUD, radar, AI and telemetry; never
 * write them to steer.
 */
export interface FlightState {
	x: number;
	y: number;
	z: number;
	qw: number;
	qx: number;
	qy: number;
	qz: number;
	/** Cosmetic bank into the current turn (radians about the nose); eases out when the stick centres. */
	lean: number;
	/** Derived: heading of the nose (forward = (-sin yaw, ., -cos yaw)). */
	yaw: number;
	/** Derived: nose angle above the horizon, -pi/2..pi/2. */
	pitch: number;
	/** Derived: bank including `lean`; pi when flying inverted. */
	roll: number;
	speed: number;
}

/** Signed stick shaping: half-linear, half-quadratic, so small corrections are fine and full stick is full rate. */
function shape(value: number): number {
	return value * (0.5 + 0.5 * math.abs(value));
}
function normalize(state: FlightState): void {
	const { qw, qx, qy, qz } = state;
	const length = math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz);
	if (length > 1e-6 && length === length && length < math.huge) {
		state.qw = qw / length; state.qx = qx / length; state.qy = qy / length; state.qz = qz / length;
	} else {
		state.qw = 1; state.qx = 0; state.qy = 0; state.qz = 0;
	}
}
/** q = rotation(axis, angle) * q: turn about a world axis (unit). */
function rotateWorld(state: FlightState, ax: number, ay: number, az: number, angle: number): void {
	if (angle === 0) return;
	const half = angle / 2, s = math.sin(half);
	const bw = math.cos(half), bx = ax * s, by = ay * s, bz = az * s;
	const { qw, qx, qy, qz } = state;
	state.qw = bw * qw - bx * qx - by * qy - bz * qz;
	state.qx = bw * qx + bx * qw + by * qz - bz * qy;
	state.qy = bw * qy - bx * qz + by * qw + bz * qx;
	state.qz = bw * qz + bx * qy - by * qx + bz * qw;
}
/** q = q * rotation(axis, angle): turn about an axis fixed to the jet (unit, body coordinates). */
function rotateBody(state: FlightState, ax: number, ay: number, az: number, angle: number): void {
	if (angle === 0) return;
	const half = angle / 2, s = math.sin(half);
	const bw = math.cos(half), bx = ax * s, by = ay * s, bz = az * s;
	const { qw, qx, qy, qz } = state;
	state.qw = qw * bw - qx * bx - qy * by - qz * bz;
	state.qx = qw * bx + qx * bw + qy * bz - qz * by;
	state.qy = qw * by - qx * bz + qy * bw + qz * bx;
	state.qz = qw * bz + qx * by - qy * bx + qz * bw;
}
/**
 * Swings the nose toward the ground (sign 1) or the sky (sign -1) by at most
 * `angle`, about the horizontal axis that gets there the short way, so the
 * jet's upright/inverted attitude is kept. Straight up or down, it uses the
 * wings instead (the push-over a pilot would fly).
 */
function pitchTowardGround(state: FlightState, sign: number, angle: number): void {
	if (sign === 0 || angle <= 0) return;
	const [fx, fy, fz] = FlightMath.ForwardOf(state);
	// forward x down (scaled by the nose's horizontal length): rotating about it lowers the nose.
	let ax = fz * sign, az = -fx * sign, ay = 0;
	const length = math.sqrt(ax * ax + az * az);
	if (length < 1e-3) {
		const [rx, ry, rz] = FlightMath.RightOf(state);
		ax = -rx * sign; ay = -ry * sign; az = -rz * sign;
	} else { ax /= length; az /= length; }
	// Never overshoot straight down (or up).
	const remaining = math.acos(math.clamp(-fy * sign, -1, 1));
	rotateWorld(state, ax, ay, az, math.min(angle, remaining));
}

// Pure numeric flight rules shared by the authoritative server, the client
// predictor, the QA pilot and offline simulations (no Roblox types).
export const FlightMath = {
	MinSpeed: 70,
	MaxSpeed: 320,
	SoftBoundary: WorldAirspace.soft,
	HardBoundary: WorldAirspace.hard,
	StallSpeed: 140,
	WarningSpeed: 165,
	MaxAltitude: 3600,
	SoftAltitude: 3000,
	CruiseSpeed: 300,
	CruiseThrottle: 0.65,
	/** Full-stick pitch rate (rad/s): a full loop at cruise takes about 5 s and spans about 400 studs. */
	PitchRate: 1.25,
	/** Full-stick heading rate (rad/s) when upright or inverted. */
	TurnRate: 1.15,
	/** Cosmetic bank (rad) at full turn stick. */
	LeanMax: 0.85,
	/** Engine acceleration limits (studs/s²) toward the throttle's target speed. */
	EngineAccel: 120,
	EngineBrake: 100,
	/** Nose-drop rate (rad/s) at full stall. */
	StallNoseDrop: 0.6,
	/** Optional level-out assist: pitch and roll rates (rad/s) back to wings-level flight. */
	AssistPitch: 0.5,
	AssistRoll: 1.2,
	IsFinite(value: unknown): value is number {
		return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
	},
	ClampInput(value: unknown, fallback = 0): number {
		return FlightMath.IsFinite(value) ? math.clamp(value, -1, 1) : fallback;
	},
	DampAlpha(rate: number, dt: number): number {
		return 1 - math.exp(-rate * math.max(dt, 0));
	},
	WrapAngle(angle: number): number {
		return (angle + math.pi) % (2 * math.pi) - math.pi;
	},
	ApproachAngle(angle: number, target: number, maxStep: number): number {
		return FlightMath.WrapAngle(angle + math.clamp(FlightMath.WrapAngle(target - angle), -maxStep, maxStep));
	},
	/** Unit nose vector for a heading and climb angle (the derived yaw/pitch of any state). */
	Forward(yaw: number, pitch: number): LuaTuple<[number, number, number]> {
		const horizontal = math.cos(pitch);
		return $tuple(-math.sin(yaw) * horizontal, math.sin(pitch), -math.cos(yaw) * horizontal);
	},
	/** Nose (world unit vector) of the jet's attitude. */
	ForwardOf(state: FlightState): LuaTuple<[number, number, number]> {
		const { qw, qx, qy, qz } = state;
		return $tuple(-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy)));
	},
	/** Canopy direction (world unit vector), without the cosmetic lean. */
	UpOf(state: FlightState): LuaTuple<[number, number, number]> {
		const { qw, qx, qy, qz } = state;
		return $tuple(2 * (qx * qy - qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qw * qx));
	},
	/** Right wing (world unit vector), without the cosmetic lean. */
	RightOf(state: FlightState): LuaTuple<[number, number, number]> {
		const { qw, qx, qy, qz } = state;
		return $tuple(1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qw * qz), 2 * (qx * qz - qw * qy));
	},
	/** Drawn orientation (attitude plus lean) as CFrame quaternion components: qx, qy, qz, qw. */
	Visual(state: FlightState): LuaTuple<[number, number, number, number]> {
		const half = state.lean / 2, s = math.sin(half), c = math.cos(half);
		const { qw, qx, qy, qz } = state;
		// q * rotation about body +Z by lean (CFrame.Angles(0, 0, lean)).
		return $tuple(qx * c + qy * s, qy * c - qx * s, qz * c + qw * s, qw * c - qz * s);
	},
	/** Re-derives yaw, pitch and roll from the quaternion and lean (no other change). */
	Sync(state: FlightState): FlightState {
		const [fx, fy, fz] = FlightMath.ForwardOf(state);
		const [ux, uy, uz] = FlightMath.UpOf(state);
		const [, ry] = FlightMath.RightOf(state);
		state.pitch = math.asin(math.clamp(fy, -1, 1));
		// Straight up or down the nose has no heading: use the direction of travel over the top.
		state.yaw = fx * fx + fz * fz > 1e-10 ? math.atan2(-fx, -fz) : math.atan2(ux * fy, uz * fy);
		state.roll = FlightMath.WrapAngle(math.atan2(ry, uy) + state.lean);
		return state;
	},
	/** Sets the attitude from a heading, climb angle and bank (YXZ, as CFrame.fromEulerAnglesYXZ). */
	SetAttitude(state: FlightState, yaw: number, pitch: number, roll = 0): FlightState {
		state.qw = 1; state.qx = 0; state.qy = 0; state.qz = 0;
		rotateBody(state, 0, 1, 0, yaw);
		rotateBody(state, 1, 0, 0, pitch);
		rotateBody(state, 0, 0, 1, roll);
		normalize(state);
		return FlightMath.Sync(state);
	},
	/**
	 * Sets the attitude from an orthonormal basis (a CFrame's RightVector,
	 * UpVector and -LookVector, i.e. its rotation matrix columns).
	 */
	SetBasis(state: FlightState, rx: number, ry: number, rz: number, ux: number, uy: number, uz: number, bx: number, by: number, bz: number): FlightState {
		const trace = rx + uy + bz;
		if (trace > 0) {
			const s = math.sqrt(trace + 1) * 2;
			state.qw = s / 4; state.qx = (uz - by) / s; state.qy = (bx - rz) / s; state.qz = (ry - ux) / s;
		} else if (rx > uy && rx > bz) {
			const s = math.sqrt(1 + rx - uy - bz) * 2;
			state.qw = (uz - by) / s; state.qx = s / 4; state.qy = (ux + ry) / s; state.qz = (bx + rz) / s;
		} else if (uy > bz) {
			const s = math.sqrt(1 + uy - rx - bz) * 2;
			state.qw = (bx - rz) / s; state.qx = (ux + ry) / s; state.qy = s / 4; state.qz = (by + uz) / s;
		} else {
			const s = math.sqrt(1 + bz - rx - uy) * 2;
			state.qw = (ry - ux) / s; state.qx = (bx + rz) / s; state.qy = (by + uz) / s; state.qz = s / 4;
		}
		normalize(state);
		return FlightMath.Sync(state);
	},
	NewState(): FlightState {
		return FlightMath.Sync({ x: 0, y: 250, z: 500, qw: 1, qx: 0, qy: 0, qz: 0, lean: 0, yaw: 0, pitch: 0, roll: 0, speed: 300 });
	},
	/** A state at a position flying a heading and climb angle at `speed` (simulations and tests). */
	FromPose(x: number, y: number, z: number, yaw: number, pitch: number, speed: number, roll = 0): FlightState {
		const state = FlightMath.NewState();
		state.x = x; state.y = y; state.z = z; state.speed = speed;
		return FlightMath.SetAttitude(state, yaw, pitch, roll);
	},
	/** Normalizes the quaternion (after blending corrections into it) and re-derives the angles. */
	Normalize(state: FlightState): FlightState {
		normalize(state);
		return FlightMath.Sync(state);
	},
	StallSeverity(speed: number): number {
		return math.clamp((FlightMath.StallSpeed - speed) / 70, 0, 1);
	},
	ThrottleAxis(value: number): number {
		const axis = FlightMath.ClampInput(value);
		return math.abs(axis) <= 0.18 ? 0 : math.sign(axis) * (math.abs(axis) - 0.18) / 0.82;
	},
	/** Released controls command cruise immediately; airspeed supplies the smooth response. */
	CommandThrottle(axis: number): number {
		const command = FlightMath.ThrottleAxis(axis);
		return math.clamp(FlightMath.CruiseThrottle + command * (command < 0 ? FlightMath.CruiseThrottle : 1 - FlightMath.CruiseThrottle), 0, 1);
	},
	/**
	 * How much of the turn stick becomes heading change, signed so the nose
	 * always moves toward the pilot's left/right on screen: 1 upright, -1
	 * inverted, fading to 0 within about 17° of straight up or down (where a
	 * heading turn would only spin the jet about its nose).
	 */
	TurnFactor(state: FlightState): number {
		const [, uy] = FlightMath.UpOf(state);
		return math.clamp(uy / 0.3, -1, 1);
	},
	/**
	 * Rate-commanded attitude with attitude hold. Stick Y pitches about the
	 * wings (through the vertical, over the top and inverted: a loop); stick X
	 * turns the heading about world up (screen-consistent when inverted) and
	 * leans the jet into the turn. A centred stick holds heading, pitch and
	 * upright/inverted attitude; only a stall, the airspace edge or
	 * the opt-in level assist (`input.assist`) move the nose by themselves.
	 */
	Step(state: FlightState, input: FlightInput, dt: number): FlightState {
		dt = math.clamp(dt, 0, 0.1);
		const x = FlightMath.ClampInput(input.x);
		const y = FlightMath.ClampInput(input.y);
		const throttle = FlightMath.IsFinite(input.throttle) ? math.clamp(input.throttle, 0, 1) : FlightMath.CruiseThrottle;
		const targetSpeed = throttle <= FlightMath.CruiseThrottle
			? FlightMath.MinSpeed + (FlightMath.CruiseSpeed - FlightMath.MinSpeed) * throttle / FlightMath.CruiseThrottle
			: FlightMath.CruiseSpeed + (FlightMath.MaxSpeed - FlightMath.CruiseSpeed) * (throttle - FlightMath.CruiseThrottle) / (1 - FlightMath.CruiseThrottle);
		// Arcade speed command: climb and turn alone cannot cause a stall.
		const engine = math.clamp((targetSpeed - state.speed) * 2.5, -FlightMath.EngineBrake, FlightMath.EngineAccel);
		state.speed = math.clamp(state.speed + engine * dt, FlightMath.MinSpeed, FlightMath.MaxSpeed);
		const stall = FlightMath.StallSeverity(state.speed);
		const authority = 1 - stall * 0.7;
		const turnFactor = FlightMath.TurnFactor(state);
		rotateBody(state, 1, 0, 0, shape(y) * FlightMath.PitchRate * authority * dt);
		rotateWorld(state, 0, 1, 0, -shape(x) * FlightMath.TurnRate * authority * turnFactor * dt);
		if (stall > 0) pitchTowardGround(state, 1, stall * FlightMath.StallNoseDrop * dt);
		if (input.assist === true && math.abs(x) < 0.05 && math.abs(y) < 0.05 && stall === 0) {
			const [, fy] = FlightMath.ForwardOf(state);
			const climb = math.asin(math.clamp(fy, -1, 1));
			pitchTowardGround(state, math.sign(climb), math.min(math.abs(climb) * 0.8, FlightMath.AssistPitch) * dt);
			if (math.abs(fy) < 0.8) {
				const [, ry] = FlightMath.RightOf(state);
				const [, uy] = FlightMath.UpOf(state);
				const bank = math.atan2(ry, uy);
				rotateBody(state, 0, 0, -1, math.clamp(bank, -FlightMath.AssistRoll * dt, FlightMath.AssistRoll * dt));
			}
		}
		const edge = math.max(math.abs(state.x), math.abs(state.z));
		if (edge > FlightMath.SoftBoundary) {
			const [fx, , fz] = FlightMath.ForwardOf(state);
			if (fx * fx + fz * fz > 1e-4) {
				const recovery = math.clamp((edge - FlightMath.SoftBoundary) / 250, 0, 1);
				const heading = math.atan2(-fx, -fz);
				rotateWorld(state, 0, 1, 0, math.clamp(FlightMath.WrapAngle(math.atan2(state.x, state.z) - heading), -recovery * 2.4 * dt, recovery * 2.4 * dt));
			}
		}
		normalize(state);
		state.lean += (-x * FlightMath.LeanMax * math.abs(turnFactor) - state.lean) * FlightMath.DampAlpha(5, dt);
		const [dx, dy, dz] = FlightMath.ForwardOf(state);
		state.x = math.clamp(state.x + dx * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		// Ease outward vertical travel to zero over 600 studs. Never rotate the pilot's
		// attitude; a loop or dive immediately travels back into the airspace.
		const ceilingScale = dy > 0 ? math.clamp((FlightMath.MaxAltitude - state.y) / (FlightMath.MaxAltitude - FlightMath.SoftAltitude), 0, 1) : 1;
		state.y += (dy * state.speed * ceilingScale - stall * 65) * dt;
		state.z = math.clamp(state.z + dz * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		return FlightMath.Sync(state);
	},
};
