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
	MinSpeed: 165,
	MaxSpeed: 320,
	SoftBoundary: 2400,
	HardBoundary: 2800,
	MinAltitude: 130,
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
	Step(state: FlightState, input: FlightInput, dt: number): FlightState {
		dt = math.clamp(dt, 0, 0.1);
		const x = FlightMath.ClampInput(input.x);
		const y = FlightMath.ClampInput(input.y);
		const throttle = FlightMath.IsFinite(input.throttle) ? math.clamp(input.throttle, 0, 1) : 0.65;
		const targetSpeed = FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * throttle;
		state.speed += (targetSpeed - state.speed) * FlightMath.DampAlpha(2, dt);
		state.yaw = FlightMath.WrapAngle(state.yaw - x * 1.12 * dt);
		let targetPitch = y * 0.62;
		if (state.y < 190) targetPitch = math.max(targetPitch, (190 - state.y) / 130);
		else if (state.y > 950) targetPitch = math.min(targetPitch, -(state.y - 950) / 160);
		state.pitch += (targetPitch - state.pitch) * FlightMath.DampAlpha(3.2, dt);
		const edge = math.max(math.abs(state.x), math.abs(state.z));
		if (edge > FlightMath.SoftBoundary) {
			const recovery = math.clamp((edge - FlightMath.SoftBoundary) / 250, 0, 1);
			state.yaw = FlightMath.ApproachAngle(state.yaw, math.atan2(state.x, state.z), recovery * 2.4 * dt);
		}
		state.roll += (-x * 0.85 - state.roll) * FlightMath.DampAlpha(5, dt);
		const [dx, dy, dz] = FlightMath.Forward(state.yaw, state.pitch);
		state.x = math.clamp(state.x + dx * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		state.y = math.clamp(state.y + dy * state.speed * dt, FlightMath.MinAltitude, FlightMath.MaxAltitude);
		state.z = math.clamp(state.z + dz * state.speed * dt, -FlightMath.HardBoundary, FlightMath.HardBoundary);
		return state;
	},
};
