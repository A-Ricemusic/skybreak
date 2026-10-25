import { FlightInput } from "./Types";

export interface FlightState {
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
	roll: number;
	speed: number;
}

// Pure numeric flight rules shared by authoritative simulation and chase camera.
export const FlightMath = {
	MinSpeed: 70,
	MaxSpeed: 320,
	SoftBoundary: 2400,
	HardBoundary: 2800,
	StallSpeed: 140,
	WarningSpeed: 165,
	MaxAltitude: 1050,
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
	Forward(yaw: number, pitch: number): LuaTuple<[number, number, number]> {
		const horizontal = math.cos(pitch);
		return $tuple(-math.sin(yaw) * horizontal, math.sin(pitch), -math.cos(yaw) * horizontal);
	},
	NewState(): FlightState {
		return { x: 0, y: 250, z: 500, yaw: 0, pitch: 0, roll: 0, speed: 255 };
	},
	StallSeverity(speed: number): number {
		return math.clamp((FlightMath.StallSpeed - speed) / 70, 0, 1);
	},
	ThrottleAxis(value: number): number {
		const axis = FlightMath.ClampInput(value);
		return math.abs(axis) <= 0.18 ? 0 : math.sign(axis) * (math.abs(axis) - 0.18) / 0.82;
	},
	AdjustThrottle(throttle: number, axis: number, dt: number): number {
		return math.clamp(throttle + FlightMath.ThrottleAxis(axis) * math.clamp(dt, 0, 0.1) * 0.4, 0, 1);
	},
	Step(state: FlightState, input: FlightInput, dt: number): FlightState {
		dt = math.clamp(dt, 0, 0.1);
		const x = FlightMath.ClampInput(input.x);
		const y = FlightMath.ClampInput(input.y);
		const throttle = FlightMath.IsFinite(input.throttle) ? math.clamp(input.throttle, 0, 1) : 0.65;
		const targetSpeed = FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * throttle;
		// Engine response takes seconds; climbing bleeds energy and diving restores it.
		const acceleration = math.clamp((targetSpeed - state.speed) * 0.7 - math.sin(state.pitch) * 35, -32, 26);
		state.speed = math.clamp(state.speed + acceleration * dt, FlightMath.MinSpeed, FlightMath.MaxSpeed);
		const stall = FlightMath.StallSeverity(state.speed);
		const authority = 1 - stall * 0.7;
		state.yaw = FlightMath.WrapAngle(state.yaw - x * 1.12 * authority * dt);
		let targetPitch = y * 0.62 * authority - stall * 0.28;
		if (state.y > 950) targetPitch = math.min(targetPitch, -(state.y - 950) / 160);
		state.pitch += (targetPitch - state.pitch) * FlightMath.DampAlpha(3.2 * authority, dt);
		const edge = math.max(math.abs(state.x), math.abs(state.z));
		if (edge > FlightMath.SoftBoundary) {
			const recovery = math.clamp((edge - FlightMath.SoftBoundary) / 250, 0, 1);
			state.yaw = FlightMath.ApproachAngle(state.yaw, math.atan2(state.x, state.z), recovery * 2.4 * dt);
		}
		state.roll += (-x * 0.85 - state.roll) * FlightMath.DampAlpha(5, dt);
		const [dx, dy, dz] = FlightMath.Forward(state.yaw, state.pitch);
		state.x = math.clamp(state.x + dx * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		state.y = math.min(state.y + (dy * state.speed - stall * 65) * dt, FlightMath.MaxAltitude);
		state.z = math.clamp(state.z + dz * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		return state;
	},
};
