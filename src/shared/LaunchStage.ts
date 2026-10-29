import { FlightMath, FlightState } from "./FlightMath";
import { MissionStartPolicy } from "./MissionPolicy";

/** Fixed-step launch stage: loading and paused time never enter this clock. */
export interface LaunchStageState { elapsed: number; }
export interface LaunchCameraPose {
	position: { x: number; y: number; z: number };
	target: { x: number; y: number; z: number };
	up: { x: number; y: number; z: number };
}
export const LaunchStage = {
	Seconds: 3,
	CanControl(loading: boolean, launch: LaunchStageState | undefined, paused: boolean): boolean {
		return !loading && launch === undefined && !paused;
	},
	New(start: MissionStartPolicy): LaunchStageState | undefined {
		return start.kind === "carrier_flyoff" ? { elapsed: 0 } : undefined;
	},
	Pose(start: MissionStartPolicy): FlightState {
		return FlightMath.FromPose(start.x, start.y, start.z, math.rad(start.headingDegrees), 0, start.speed ?? FlightMath.CruiseSpeed);
	},
	/** Constant heading/altitude/speed; never accepts player input or applies throttle acceleration. */
	Step(state: FlightState, dt: number): void {
		const [x, y, z] = FlightMath.ForwardOf(state);
		state.x += x * state.speed * dt; state.y += y * state.speed * dt; state.z += z * state.speed * dt;
	},
	Advance(stage: LaunchStageState, state: FlightState, dt: number, paused = false): boolean {
		if (paused) return false;
		const span = math.min(math.max(0, dt), LaunchStage.Seconds - stage.elapsed);
		LaunchStage.Step(state, span); stage.elapsed += span;
		return stage.elapsed >= LaunchStage.Seconds - 0.000001;
	},
	/** Heading-relative launch view: port, above and behind the jet, looking aft toward the carrier. */
	Camera(state: FlightState): LaunchCameraPose {
		const [fx, fy, fz] = FlightMath.ForwardOf(state);
		const [rx, ry, rz] = FlightMath.RightOf(state);
		const [ux, uy, uz] = FlightMath.UpOf(state);
		const port = -80;
		return {
			position: { x: state.x + rx * port + ux * 45 - fx * 110, y: state.y + ry * port + uy * 45 - fy * 110, z: state.z + rz * port + uz * 45 - fz * 110 },
			target: { x: state.x - fx * 260, y: state.y - fy * 260, z: state.z - fz * 260 },
			up: { x: ux, y: uy, z: uz },
		};
	},
};
