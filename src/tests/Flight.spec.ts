import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath, FlightState } from "../shared/FlightMath";

describe("numeric arcade flight rules", () => {
	it("rejects NaN, infinities and nonnumeric controls", () => {
		for (const value of [0 / 0, math.huge, -math.huge, "1", false, {}]) expect(FlightMath.IsFinite(value)).toBe(false);
		expect(FlightMath.IsFinite(undefined)).toBe(false);
		for (const value of [-100, 0, 0.5, 100]) expect(FlightMath.IsFinite(value)).toBe(true);
	});
	it("clamps input and preserves explicit invalid-input fallbacks", () => {
		expect(FlightMath.ClampInput(4)).toBe(1);
		expect(FlightMath.ClampInput(-4)).toBe(-1);
		expect(FlightMath.ClampInput(0.25)).toBe(0.25);
		expect(FlightMath.ClampInput(0 / 0)).toBe(0);
		expect(FlightMath.ClampInput(math.huge, 0.4)).toBe(0.4);
	});
	it("starts independent states in safe forward flight", () => {
		const first = FlightMath.NewState();
		const second = FlightMath.NewState();
		FlightMath.Step(first, { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, 1 / 30);
		expect(first.z).toBeLessThan(500);
		expect(first.x).toBeCloseTo(0);
		expect(first.y).toBeCloseTo(250);
		expect(second.z).toBe(500);
	});
	it("returns normalized forward vectors with the correct axis signs", () => {
		const [x, y, z] = FlightMath.Forward(0, 0);
		expect(x).toBeCloseTo(0); expect(y).toBeCloseTo(0); expect(z).toBeCloseTo(-1);
		const [a, b, c] = FlightMath.Forward(-0.8, 0.4);
		expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(0);
		expect(a * a + b * b + c * c).toBeCloseTo(1, 6);
	});
	it("turns right and banks on positive horizontal input", () => {
		const state = FlightMath.NewState();
		FlightMath.Step(state, { x: 1, y: 1, throttle: FlightMath.CruiseThrottle }, 0.1);
		expect(state.yaw).toBeLessThan(0);
		expect(state.roll).toBeLessThan(0);
		expect(state.x).toBeGreaterThan(0);
		expect(state.y).toBeGreaterThan(250);
	});
	it("keeps throttle speed between the arcade limits", () => {
		for (const throttle of [-50, 50, 0 / 0, math.huge, -math.huge]) {
			const state = FlightMath.NewState();
			for (let step = 0; step < 300; step++) FlightMath.Step(state, { x: 0, y: 0, throttle }, 1 / 30);
			expect(FlightMath.IsFinite(state.speed)).toBe(true);
			expect(state.speed).toBeGreaterThanOrEqual(FlightMath.MinSpeed);
			expect(state.speed).toBeLessThanOrEqual(FlightMath.MaxSpeed);
		}
	});
	it("falls back to neutral steering and cruise throttle for invalid controls", () => {
		const state = FlightMath.NewState();
		const expected = FlightMath.NewState();
		FlightMath.Step(state, { x: 0 / 0, y: math.huge, throttle: -math.huge }, 0.1);
		FlightMath.Step(expected, { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, 0.1);
		expect(state).toEqual(expected);
	});
	it("uses time based damping with no reverse-time interpolation", () => {
		expect(FlightMath.DampAlpha(8, -1)).toBe(0);
		expect(FlightMath.DampAlpha(8, 0)).toBe(0);
		const half = FlightMath.DampAlpha(8, 0.05);
		expect(1 - (1 - half) * (1 - half)).toBeCloseTo(FlightMath.DampAlpha(8, 0.1), 6);
	});
	it("wraps angles and approaches across the shortest seam", () => {
		expect(FlightMath.WrapAngle(3 * math.pi)).toBeCloseTo(-math.pi);
		expect(FlightMath.WrapAngle(-3 * math.pi)).toBeCloseTo(-math.pi);
		const result = FlightMath.ApproachAngle(math.pi - 0.1, -math.pi + 0.1, 0.05);
		expect(FlightMath.WrapAngle(result - (math.pi - 0.1))).toBeCloseTo(0.05);
	});
	it("caps stalled simulation steps and ignores negative elapsed time", () => {
		const capped = FlightMath.NewState();
		const normal = FlightMath.NewState();
		const input = { x: 0.4, y: 0.2, throttle: 1 };
		FlightMath.Step(capped, input, 10);
		FlightMath.Step(normal, input, 0.1);
		expect(capped).toEqual(normal);
		const stationary = FlightMath.NewState();
		FlightMath.Step(stationary, input, -1);
		expect(stationary).toEqual(FlightMath.NewState());
	});
	it("recovers at world edges and the ceiling without protecting the ground", () => {
		const edge = FlightMath.NewState();
		edge.x = FlightMath.SoftBoundary + 100;
		FlightMath.Step(edge, { x: 0, y: 0, throttle: 1 }, 0.1);
		expect(edge.yaw).toBeGreaterThan(0);
		for (const sign of [-1, 1]) {
			const state = FlightMath.NewState();
			state.x = sign * 4000; state.z = sign * 4000; state.y = sign > 0 ? 2000 : 0;
			FlightMath.Step(state, { x: sign, y: sign, throttle: 1 }, 0.1);
			expect(math.abs(state.x)).toBeLessThanOrEqual(FlightMath.HardBoundary);
			expect(math.abs(state.z)).toBeLessThanOrEqual(FlightMath.HardBoundary);
			if (sign < 0) expect(state.y).toBeLessThan(0);
			expect(state.y).toBeLessThanOrEqual(FlightMath.MaxAltitude);
			if (sign > 0) expect(state.pitch).toBeGreaterThan(0);
		}
	});
	it("permits a sustained dive through the old floor", () => {
		const state = FlightMath.NewState();
		// Push for half a second, then let go: the dive angle holds all the way down.
		for (let i = 0; i < 15; i++) FlightMath.Step(state, { x: 0, y: -1, throttle: FlightMath.CruiseThrottle }, 1 / 30);
		for (let i = 0; i < 150; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, 1 / 30);
		expect(state.y).toBeLessThan(0);
		expect(state.pitch).toBeLessThan(-0.5);
	});
	it("decelerates gradually into lost lift and recovers with engine and nose down", () => {
		const state = FlightMath.NewState(); state.y = 1000;
		FlightMath.Step(state, { x: 0, y: 0, throttle: 0 }, 1 / 30);
		expect(state.speed).toBeGreaterThan(150);
		for (let i = 0; i < 150; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: 0 }, 1 / 30);
		expect(state.speed).toBeLessThan(140);
		expect(state.y).toBeLessThan(950);
		// The stalled nose sags by itself.
		expect(state.pitch).toBeLessThan(0);
		const low = state.speed;
		for (let i = 0; i < 20; i++) FlightMath.Step(state, { x: 0, y: -0.5, throttle: 1 }, 1 / 30);
		for (let i = 0; i < 160; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: 1 }, 1 / 30);
		expect(state.speed).toBeGreaterThan(low + 100);
		expect(FlightMath.StallSeverity(state.speed)).toBe(0);
	});
	it("loses turn authority and lift at low speed even with pull-up input", () => {
		const fast = FlightMath.NewState(); fast.speed = 240;
		const slow = FlightMath.NewState(); slow.speed = 15;
		const input = { x: 1, y: 1, throttle: 0 };
		FlightMath.Step(fast, input, 0.1); FlightMath.Step(slow, input, 0.1);
		expect(math.abs(slow.yaw)).toBeLessThan(math.abs(fast.yaw) * 0.75);
		expect(slow.y).toBeLessThan(250);
		expect(fast.y).toBeGreaterThan(250);
	});
	it("holds selection on release, deadzone, invalid input and interruption", () => {
		for (const mph of [75, 150, 800, 1250, 2200, 3000]) {
			const chosen = FlightMath.ThrottleForSpeed(FlightMath.FromMph(mph));
			for (const axis of [0, .17, -.17, 0 / 0]) expect(FlightMath.AdjustThrottle(chosen, axis, .1)).toBe(chosen);
			const state = FlightMath.FromPose(0, 1500, 0, 0, 0, FlightMath.SpeedForThrottle(chosen));
			for (let i = 0; i < 90; i++) FlightMath.Step(state, {x: 0, y: 0, throttle: chosen}, 1 / 30);
			if (mph >= 150) expect(FlightMath.ToMph(state.speed)).toBeCloseTo(mph, 5);
			else expect(state.speed).toBeGreaterThanOrEqual(FlightMath.MinSpeed);
		}
	});
	it("integrates held acceleration and braking consistently across frame rates and caps", () => {
		for (const dt of [1 / 144, 1 / 60, 1 / 30, .1]) {
			let chosen = FlightMath.CruiseThrottle;
			for (let i = 0; i < math.round(5 / dt); i++) chosen = FlightMath.AdjustThrottle(chosen, 1, dt);
			expect(FlightMath.ToMph(FlightMath.SpeedForThrottle(chosen))).toBeCloseTo(1700, 5);
			for (let i = 0; i < math.round(30 / dt); i++) chosen = FlightMath.AdjustThrottle(chosen, 1, dt);
			expect(chosen).toBe(1);
			for (let i = 0; i < math.round(30 / dt); i++) chosen = FlightMath.AdjustThrottle(chosen, -1, dt);
			expect(chosen).toBe(0);
		}
	});
	it("stalls at the 75 mph floor without freezing in air and recovers under acceleration", () => {
		for (const dt of [1 / 60, 1 / 30, .1]) {
			const state = FlightMath.FromPose(0, 1500, 0, 0, 0, FlightMath.MinSpeed);
			const start = {...state};
			expect(FlightMath.StallSeverity(state.speed)).toBe(1);
			for (let i = 0; i < math.round(2 / dt); i++) FlightMath.Step(state, {x: 0, y: 0, throttle: 0}, dt);
			expect(state.y).toBeLessThan(start.y - 50);
			expect(state.z).toBeLessThan(start.z);
			expect(state.speed).toBeGreaterThanOrEqual(FlightMath.MinSpeed);
			for (let i = 0; i < math.round(4 / dt); i++) FlightMath.Step(state, {x: 0, y: 0, throttle: FlightMath.CruiseThrottle}, dt);
			expect(FlightMath.StallSeverity(state.speed)).toBe(0);
			expect(state.speed).toBeGreaterThan(FlightMath.CruiseSpeed - 3);
		}
	});
	it("completes loops at cruise and cap across timestep sizes without ceiling push-over", () => {
		for (const speed of [FlightMath.CruiseSpeed, FlightMath.MaxSpeed]) for (const step of [1 / 60, 1 / 30, .1]) {
			const count = math.ceil(2 * math.pi / FlightMath.PitchRate / step);
			const dt = 2 * math.pi / FlightMath.PitchRate / count;
			const state = FlightMath.FromPose(0, 1200, 0, 0, 0, speed);
			for (let i = 0; i < count; i++) FlightMath.Step(state, {x: 0, y: 1, throttle: FlightMath.ThrottleForSpeed(speed)}, dt);
			const [, canopyY] = FlightMath.UpOf(state);
			expect(canopyY).toBeGreaterThan(.999);
			expect(math.abs(state.y - 1200)).toBeLessThan(10);
			expect(FlightMath.StallSeverity(state.speed)).toBe(0);
		}
	});
	it("spawns at 800 mph with explicit reversible units", () => {
		expect(FlightMath.ToMph(FlightMath.NewState().speed)).toBe(800);
		expect(FlightMath.ToMph(FlightMath.MaxSpeed)).toBe(3000);
		expect(FlightMath.ToMph(FlightMath.MinSpeed)).toBe(75);
	});

});

const STEP = 1 / 30;
const CRUISE = { x: 0, y: 0, throttle: FlightMath.CruiseThrottle };
function up(state: FlightState): number { const [, y] = FlightMath.UpOf(state); return y; }

describe("rate-commanded attitude with attitude hold", () => {
	it("flies a full vertical loop at normal throttle: inverted over the top, upright and level at the end", () => {
		const state = FlightMath.NewState();
		state.y = 400;
		const start = { ...state };
		let topY = -math.huge, topUp = 1, slowest = math.huge, steps = 0, wasDiving = false;
		// Hold full back stick until the nose comes back up through the horizon after the dive.
		while (steps < 300) {
			FlightMath.Step(state, { x: 0, y: 1, throttle: FlightMath.CruiseThrottle }, STEP);
			steps += 1;
			slowest = math.min(slowest, state.speed);
			if (state.y > topY) { topY = state.y; topUp = up(state); }
			if (state.pitch < -1) wasDiving = true;
			if (wasDiving && state.pitch >= 0) break;
		}
		const seconds = steps * STEP;
		expect(wasDiving).toBe(true);
		expect(seconds).toBeLessThan(6.5);
		// Over the top the jet is upside down, as on a roller coaster.
		expect(topUp).toBeLessThan(-0.95);
		expect(topY - start.y).toBeGreaterThan(220);
		// Back where it started: level, upright, same heading, almost the same altitude.
		expect(math.abs(state.y - start.y)).toBeLessThan(40);
		expect(up(state)).toBeGreaterThan(0.99);
		expect(math.abs(FlightMath.WrapAngle(state.yaw - start.yaw))).toBeLessThan(0.01);
		expect(math.abs(state.roll)).toBeLessThan(0.01);
		// Never near a stall on the way round.
		expect(slowest).toBeGreaterThan(FlightMath.WarningSpeed);
	});
	it("passes straight up without gimbal lock: the attitude moves smoothly every step", () => {
		const state = FlightMath.NewState();
		state.y = 400;
		let worst = 0;
		for (let i = 0; i < 90; i++) {
			const [ax, ay, az] = FlightMath.ForwardOf(state);
			const [bx, by, bz] = FlightMath.UpOf(state);
			FlightMath.Step(state, { x: 0.4, y: 1, throttle: FlightMath.CruiseThrottle }, STEP);
			const [cx, cy, cz] = FlightMath.ForwardOf(state);
			const [dx, dy, dz] = FlightMath.UpOf(state);
			worst = math.max(worst, math.acos(math.clamp(ax * cx + ay * cy + az * cz, -1, 1)), math.acos(math.clamp(bx * dx + by * dy + bz * dz, -1, 1)));
			expect(FlightMath.IsFinite(state.yaw) && FlightMath.IsFinite(state.pitch) && FlightMath.IsFinite(state.roll)).toBe(true);
		}
		// Full stick is 1.25 rad/s: about 0.042 rad per step, never a flip.
		expect(worst).toBeLessThan(0.06);
		expect(math.abs(state.qw * state.qw + state.qx * state.qx + state.qy * state.qy + state.qz * state.qz - 1)).toBeLessThan(1e-9);
	});
	it("holds heading, pitch and bank for 3 s after the stick is released", () => {
		for (const pull of [1, -1]) {
			// Low enough that the climb stays under the 950-stud ceiling, high enough for the dive.
			const state = FlightMath.NewState();
			state.y = pull > 0 ? 300 : 800;
			for (let i = 0; i < 12; i++) FlightMath.Step(state, { x: 0.8, y: 0.8 * pull, throttle: 0.8 }, STEP);
			// Let the cosmetic turn lean ease out, then measure.
			for (let i = 0; i < 30; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: 0.8 }, STEP);
			const held = { ...state };
			expect(math.abs(held.pitch)).toBeGreaterThan(0.3);
			for (let i = 0; i < 90; i++) FlightMath.Step(state, { x: 0, y: 0, throttle: 0.8 }, STEP);
			expect(math.abs(FlightMath.WrapAngle(state.yaw - held.yaw))).toBeLessThan(1e-6);
			expect(math.abs(state.pitch - held.pitch)).toBeLessThan(1e-6);
			expect(math.abs(FlightMath.WrapAngle(state.roll - held.roll))).toBeLessThan(0.01);
			if (pull > 0) expect(state.y).toBeGreaterThan(held.y + 150);
			else expect(state.y).toBeLessThan(held.y - 150);
		}
	});
	it("keeps climbing in a held 30-degree climb at normal throttle", () => {
		const state = FlightMath.FromPose(0, 100, 0, 0, math.rad(30), 233);
		let previous = state.y;
		// Six seconds is about 650 studs of climb, still below the 950-stud ceiling.
		for (let second = 1; second <= 6; second++) {
			for (let i = 0; i < 30; i++) FlightMath.Step(state, CRUISE, STEP);
			// Every second still gains real altitude: no sag, no need to dive back down.
			expect(state.y).toBeGreaterThan(previous + 70);
			previous = state.y;
		}
		expect(state.pitch).toBeCloseTo(math.rad(30), 5);
		expect(state.speed).toBeGreaterThan(FlightMath.WarningSpeed);
	});
	it("gently loses speed climbing and gains speed diving without changing selection", () => {
		for (const sign of [-1, 1]) {
			const state = FlightMath.FromPose(0, 1500, 0, 0, sign * math.rad(30), FlightMath.CruiseSpeed);
			for (let i = 0; i < 90; i++) FlightMath.Step(state, CRUISE, STEP);
			expect((state.speed - FlightMath.CruiseSpeed) * sign).toBeLessThan(0);
			expect(math.abs(FlightMath.ToMph(state.speed) - 800)).toBeLessThan(5);
			expect(FlightMath.StallSeverity(state.speed)).toBe(0);
		}
	});

	it("flies inverted, stable and level, and turns toward the pilot's own right", () => {
		const state = FlightMath.FromPose(0, 500, 0, 0, 0, 240, math.pi);
		expect(up(state)).toBeLessThan(-0.99);
		for (let i = 0; i < 150; i++) FlightMath.Step(state, CRUISE, STEP);
		expect(up(state)).toBeLessThan(-0.99);
		expect(math.abs(state.pitch)).toBeLessThan(1e-6);
		expect(math.abs(state.y - 500)).toBeLessThan(1);
		// Pilot's right wing points at world -X while inverted heading north; right stick swings the nose there.
		const [rx] = FlightMath.RightOf(state);
		expect(rx).toBeLessThan(-0.99);
		const x0 = state.x;
		for (let i = 0; i < 30; i++) FlightMath.Step(state, { x: 1, y: 0, throttle: FlightMath.CruiseThrottle }, STEP);
		expect(state.x).toBeLessThan(x0 - 20);
		expect(up(state)).toBeLessThan(-0.95);
	});
	it("turns upright with right stick to the right and leans into the turn", () => {
		const state = FlightMath.FromPose(0, 500, 0, 0, 0, 240);
		for (let i = 0; i < 30; i++) FlightMath.Step(state, { x: 1, y: 0, throttle: FlightMath.CruiseThrottle }, STEP);
		expect(state.x).toBeGreaterThan(20);
		expect(state.roll).toBeLessThan(-0.5);
		expect(math.abs(state.y - 500)).toBeLessThan(1);
		// The lean is cosmetic: centred, it eases out and the wings are level again.
		for (let i = 0; i < 60; i++) FlightMath.Step(state, CRUISE, STEP);
		expect(math.abs(state.roll)).toBeLessThan(0.05);
	});
	it("stalls only at genuinely low speed and the nose falls through to recover", () => {
		const cruise = FlightMath.NewState();
		for (let i = 0; i < 300; i++) FlightMath.Step(cruise, { x: 0.3, y: 0, throttle: FlightMath.CruiseThrottle }, STEP);
		expect(FlightMath.StallSeverity(cruise.speed)).toBe(0);
		// Hanging straight up at idle runs out of energy; the nose then drops by itself.
		const vertical = FlightMath.FromPose(0, 300, 0, 0, math.rad(85), 230);
		let stalled = false;
		for (let i = 0; i < 360; i++) {
			FlightMath.Step(vertical, { x: 0, y: 0, throttle: 0 }, STEP);
			if (FlightMath.StallSeverity(vertical.speed) > 0) stalled = true;
		}
		expect(stalled).toBe(true);
		expect(vertical.pitch).toBeLessThan(0);
	});
	it("levels out only with the opt-in assist", () => {
		for (const roll of [0, math.pi]) {
			const held = FlightMath.FromPose(0, 300, 0, 0.4, math.rad(25), 240, roll);
			const assisted = FlightMath.FromPose(0, 300, 0, 0.4, math.rad(25), 240, roll);
			for (let i = 0; i < 180; i++) {
				FlightMath.Step(held, CRUISE, STEP);
				FlightMath.Step(assisted, { x: 0, y: 0, throttle: FlightMath.CruiseThrottle, assist: true }, STEP);
			}
			expect(math.abs(held.pitch - math.rad(25))).toBeLessThan(1e-6);
			expect(math.abs(assisted.pitch)).toBeLessThan(0.05);
			expect(up(assisted)).toBeGreaterThan(0.99);
			if (roll !== 0) expect(up(held)).toBeLessThan(-0.9);
			// Any stick input switches the assist off at once.
			const pitched = FlightMath.FromPose(0, 300, 0, 0, 0, 240);
			for (let i = 0; i < 30; i++) FlightMath.Step(pitched, { x: 0, y: 0.5, throttle: FlightMath.CruiseThrottle, assist: true }, STEP);
			expect(pitched.pitch).toBeGreaterThan(0.2);
		}
	});
	it("round-trips attitude through angles, a basis and the drawn quaternion", () => {
		const state = FlightMath.FromPose(10, 300, -40, 2.4, -0.7, 210, 0.5);
		expect(state.yaw).toBeCloseTo(2.4, 6);
		expect(state.pitch).toBeCloseTo(-0.7, 6);
		expect(state.roll).toBeCloseTo(0.5, 6);
		const [rx, ry, rz] = FlightMath.RightOf(state);
		const [ux, uy, uz] = FlightMath.UpOf(state);
		const [fx, fy, fz] = FlightMath.ForwardOf(state);
		const copy = FlightMath.SetBasis(FlightMath.NewState(), rx, ry, rz, ux, uy, uz, -fx, -fy, -fz);
		expect(copy.yaw).toBeCloseTo(2.4, 6);
		expect(copy.pitch).toBeCloseTo(-0.7, 6);
		expect(copy.roll).toBeCloseTo(0.5, 6);
		const [a, b, c] = FlightMath.Forward(state.yaw, state.pitch);
		expect(a).toBeCloseTo(fx, 6); expect(b).toBeCloseTo(fy, 6); expect(c).toBeCloseTo(fz, 6);
		// Lean is drawn about the nose: it changes the drawn roll only.
		state.lean = -0.3;
		FlightMath.Sync(state);
		expect(state.roll).toBeCloseTo(0.2, 6);
		const [vx, vy, vz, vw] = FlightMath.Visual(state);
		expect(vx * vx + vy * vy + vz * vz + vw * vw).toBeCloseTo(1, 9);
	});
	it("flies three continuous loops at safe altitude and across the former ceiling", () => {
		for (const altitude of [500, 950]) {
			const state = FlightMath.FromPose(0, altitude, 0, 0, 0, FlightMath.CruiseSpeed);
			const steps = math.ceil(6 * math.pi / FlightMath.PitchRate / STEP);
			const dt = 6 * math.pi / FlightMath.PitchRate / steps;
			for (let i = 0; i < steps; i++) {
				const previous = {...state};
				FlightMath.Step(state, {x: 0, y: 1, throttle: FlightMath.CruiseThrottle}, dt);
				const dot = math.abs(previous.qw * state.qw + previous.qx * state.qx + previous.qy * state.qy + previous.qz * state.qz);
				expect(dot).toBeGreaterThan(0.999);
				expect(state.speed).toBeGreaterThan(FlightMath.WarningSpeed);
			}
			expect(up(state)).toBeGreaterThan(0.999);
			expect(math.abs(state.y - altitude)).toBeLessThan(10);
		}
	});
	it("eases upward travel at the high world limit without changing attitude, then allows a dive", () => {
		const state = FlightMath.FromPose(0, 3200, 0, 0, math.pi / 2, 300);
		for (let i = 0; i < 600; i++) FlightMath.Step(state, CRUISE, STEP);
		expect(state.y).toBeLessThanOrEqual(FlightMath.MaxAltitude);
		expect(state.y).toBeGreaterThan(3450);
		expect(state.pitch).toBeCloseTo(math.pi / 2);
		FlightMath.SetAttitude(state, 0, -math.pi / 2);
		const top = state.y;
		for (let i = 0; i < 30; i++) FlightMath.Step(state, CRUISE, STEP);
		expect(state.y).toBeLessThan(top - 150);
	});
});
