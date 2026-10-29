import { describe, expect, it } from "@rbxts/jest-globals";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionBlueprint, MissionCatalog, MISSIONS } from "./LegacyCatalog";
import { FlightMath } from "../shared/FlightMath";
import { FlightPrediction } from "../shared/FlightPrediction";
import { LaunchStage } from "../shared/LaunchStage";
import { PauseRules } from "../shared/SessionGuard";
import { clockLines } from "../shared/HudInstruments";
import { initialTelemetry } from "../shared/InitialTelemetry";
import { failureCause } from "../shared/OutcomeReason";
import { m01CarrierFlyoffStart, M01_CARRIER_MODEL, m01CarrierPoint } from "../shared/M01CarrierPlan";
import { M01_AIRSPACE } from "../shared/M01Limits";
import { m01Height, M01 } from "../shared/M01WorldPlan";
import { CountdownDisplay } from "../shared/CountdownDisplay";

function policy(): MissionBlueprint {
	return { ...MissionCatalog.Get(2), countdownSeconds: 600, start: m01CarrierFlyoffStart(), airspace: M01_AIRSPACE,
		phases: [{ kind: "required_air", label: "Intercept", count: 1 }] };
}

describe("countdown/fly-off legacy parity (origin/main values)", () => {
	it("keeps all 27 missions dormant, the exact old airborne state and 900-second deadline", () => {
		expect(MISSIONS.size()).toBe(27);
		for (const mission of MISSIONS) {
			expect(mission.start).toBeUndefined(); expect(mission.countdownSeconds).toBeUndefined();
			expect(LaunchStage.New(MissionCatalog.Start(mission))).toBeUndefined();
			expect(LaunchStage.Pose(MissionCatalog.Start(mission))).toEqual(FlightMath.NewState());
			const flight = FlightMath.NewState();
			expect([flight.x, flight.y, flight.z, flight.yaw, flight.speed]).toEqual([0, 250, 500, 0, 160]);
			const state = BlueprintRunner.NewState(mission, 100);
			expect(BlueprintRunner.TimeRemaining(state)).toBe(900);
			BlueprintRunner.Tick(state, 999.99); expect(state.outcome).toBeUndefined();
			BlueprintRunner.Tick(state, 1000); expect(state.reason).toBe("timeout");
		}
	});
	it("keeps the timer text and legacy debrief unchanged", () => {
		expect(clockLines(CountdownDisplay.Value(0, 900), 0, 3, 0, 3)).toEqual(["TIME 15:00", "TGT 0/3"]);
		expect(clockLines(CountdownDisplay.Value(0, 899.5), 1, 3, 0, 3)).toEqual(["TIME 14:59", "TGT 1/3"]);
		expect(clockLines(CountdownDisplay.Value(0, -1), undefined, undefined, 2, 3)).toEqual(["TIME 00:00", "KILL 2/3"]);
		expect(initialTelemetry(0).timeRemaining).toBe(900);

		expect(failureCause("timeout")).toBe("The 15-minute operation window closed.");
	});
});

describe("opt-in mission countdown and launch stage", () => {
	it("holds the clock through load and intro, then starts at control without charging either twice", () => {
		const mission = policy(), state = BlueprintRunner.NewState(mission, 0);
		const stage = LaunchStage.New(mission.start!)!;
		const flight = LaunchStage.Pose(mission.start!);
		expect(LaunchStage.CanControl(true, undefined, false)).toBe(false);
		expect(LaunchStage.CanControl(false, stage, false)).toBe(false);
		expect(BlueprintRunner.TimeRemaining(state)).toBe(600);
		for (let i = 0; i < 90; i++) LaunchStage.Advance(stage, flight, 1 / 30);
		// CombatService resets the clock to wall time at this transition, after loading and intro.
		BlueprintRunner.BeginControl(state, 103);
		expect(LaunchStage.CanControl(false, undefined, false)).toBe(true);
		BlueprintRunner.Tick(state, 103); expect(BlueprintRunner.TimeRemaining(state)).toBe(600);
		BlueprintRunner.Tick(state, 104.25); expect(BlueprintRunner.TimeRemaining(state)).toBe(598.75);
		expect(clockLines(BlueprintRunner.TimeRemaining(state), 0, 1, 0, 1)[0]).toBe("TIME 09:58");
	});
	it("gates controls and weapons during intro and pause, releasing only at the handoff", () => {
		const stage = LaunchStage.New(m01CarrierFlyoffStart())!, state = LaunchStage.Pose(m01CarrierFlyoffStart());
		for (let i = 0; i < 89; i++) expect(LaunchStage.Advance(stage, state, 1 / 30)).toBe(false);
		expect(LaunchStage.CanControl(false, stage, false)).toBe(false);
		expect(LaunchStage.Advance(stage, state, 1 / 30)).toBe(true);
		expect(LaunchStage.CanControl(false, undefined, true)).toBe(false);
		expect(LaunchStage.CanControl(false, undefined, false)).toBe(true);
	});
	it("subtracts pause time once, preserving the existing five-minute pause budget", () => {
		const state = BlueprintRunner.NewState(policy(), 100), pause = PauseRules.New();
		BlueprintRunner.Tick(state, 110); expect(BlueprintRunner.TimeRemaining(state)).toBe(590);
		expect(PauseRules.Pause(pause, 110)).toBe(true);
		expect(LaunchStage.CanControl(false, undefined, PauseRules.Paused(pause))).toBe(false);
		state.startedAt += PauseRules.Resume(pause, 140);
		BlueprintRunner.Tick(state, 141); expect(BlueprintRunner.TimeRemaining(state)).toBe(589);
		expect(PauseRules.Resume(pause, 142)).toBe(0);
	});
	it("does not advance a paused intro, and starts a fresh stage for every retry or replay", () => {
		const first = LaunchStage.New(m01CarrierFlyoffStart())!, flight = LaunchStage.Pose(m01CarrierFlyoffStart());
		LaunchStage.Advance(first, flight, 1);
		const held = { ...flight };
		expect(LaunchStage.Advance(first, flight, 30, true)).toBe(false);
		expect(first.elapsed).toBe(1);
		expect(flight).toEqual(held);
		const retry = LaunchStage.New(m01CarrierFlyoffStart())!;
		expect(retry.elapsed).toBe(0); expect(first.elapsed).toBe(1);
		expect(LaunchStage.Pose(m01CarrierFlyoffStart()).z).toBe(m01CarrierFlyoffStart().z);
	});
	it("uses an authored deadline longer than the legacy limit", () => {
		const mission = { ...policy(), countdownSeconds: 1200 }, state = BlueprintRunner.NewState(mission, 100);
		expect(CountdownDisplay.Value(mission, undefined)).toBe(1200);
		expect(CountdownDisplay.Value(mission, 1100)).toBe(1100);
		expect(CountdownDisplay.Value(mission, 1300)).toBe(1200);
		BlueprintRunner.Tick(state, 1000); expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.TimeRemaining(state)).toBe(300);
		BlueprintRunner.Tick(state, 1300); expect(state.reason).toBe("timeout");
	});
	it("rejects a delayed intro packet with an older sequence after the reliable handoff", () => {
		const state = LaunchStage.Pose(m01CarrierFlyoffStart()), client = FlightPrediction.New(state, M01_AIRSPACE);
		FlightPrediction.Handoff(client, state, 8);
		expect(FlightPrediction.Reconcile(client, FlightMath.NewState(), 100, 7)).toBe("none");
		expect(client.state).toEqual(state);
	});
	it("fails at deadline equality with the existing timeout reason and correct debrief", () => {
		const state = BlueprintRunner.NewState(policy(), 100);
		BlueprintRunner.Tick(state, 699.999); expect(state.outcome).toBeUndefined();
		expect(BlueprintRunner.RecordKill(state, "late", "air", true, 700)).toBe(false);
		expect(state.outcome).toBe("failed"); expect(state.reason).toBe("timeout");
		expect(BlueprintRunner.TimeRemaining(state)).toBe(0);
		expect(failureCause(state.reason, 600)).toBe("The 10-minute operation window closed.");
	});
	it("freezes the remaining display on success", () => {
		const state = BlueprintRunner.NewState(policy(), 100);
		expect(BlueprintRunner.RecordKill(state, "bomber", "air", true, 331.19)).toBe(true);
		expect(state.outcome).toBe("won");
		const remaining = BlueprintRunner.TimeRemaining(state);
		expect(remaining).toBeCloseTo(368.81);
		BlueprintRunner.Tick(state, 900); expect(BlueprintRunner.TimeRemaining(state)).toBe(remaining);
	});
	it("caps the client stage at three seconds and blends a delayed handoff without a backward jump", () => {
		const mission = policy(), server = LaunchStage.Pose(mission.start!);
		const client = FlightPrediction.New(server, mission.airspace), clientStage = LaunchStage.New(mission.start!)!;
		expect(client.state).toEqual(server); expect(server.speed).toBe(180);
		for (let i = 0; i < 90; i++) { LaunchStage.Step(server, 1 / 30); LaunchStage.Advance(clientStage, client.state, 1 / 30); }
		expect(client.state).toEqual(server);
		const stopped = { ...client.state };
		for (let i = 0; i < 60; i++) LaunchStage.Advance(clientStage, client.state, 1 / 30);
		expect(clientStage.elapsed).toBeCloseTo(LaunchStage.Seconds, 6);
		expect(client.state).toEqual(stopped);
		const [fx, fy, fz] = FlightMath.ForwardOf(client.state);
		const handoff = FlightMath.SetAttitude({ ...server }, server.yaw + 0.04, server.pitch);
		handoff.x -= fx * 10; handoff.y -= fy * 10; handoff.z -= fz * 10;
		FlightPrediction.Handoff(client, handoff, 8);
		const before = { ...client.state };
		const after = FlightPrediction.Step(client, { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, 1 / 60, 5);
		const forwardStep = (after.x - before.x) * fx + (after.y - before.y) * fy + (after.z - before.z) * fz;
		expect(client.last).toBe("blend");
		expect(forwardStep).toBeGreaterThan(-0.25);
	});
	it("keeps the intro camera on port and rotates its offset with heading", () => {
		const north = FlightMath.FromPose(30, 400, -70, 0, 0, 180), northCamera = LaunchStage.Camera(north);
		// Compare per component: the forward vector can carry negative zeros, which are the same direction.
		const [nfx, nfy, nfz] = FlightMath.ForwardOf(north);
		expect(nfx).toBeCloseTo(0, 5);
		expect(nfy).toBeCloseTo(0, 5);
		expect(nfz).toBeCloseTo(-1, 5);
		expect(northCamera.position.x).toBeLessThan(north.x);
		// In this yaw convention -90 degrees points east (+X); port is north (-Z).
		const east = FlightMath.FromPose(30, 400, -70, -math.pi / 2, 0, 180), eastCamera = LaunchStage.Camera(east);
		expect(FlightMath.ForwardOf(east)[0]).toBeCloseTo(1, 5);
		expect(eastCamera.position.z).toBeLessThan(east.z);
		for (const heading of [0, math.pi / 2, math.pi]) {
			const state = FlightMath.FromPose(30, 400, -70, heading, 0, 180), camera = LaunchStage.Camera(state);
			const [fx, fy, fz] = FlightMath.ForwardOf(state), [rx, ry, rz] = FlightMath.RightOf(state), [ux, uy, uz] = FlightMath.UpOf(state);
			const ox = camera.position.x - state.x, oy = camera.position.y - state.y, oz = camera.position.z - state.z;
			expect(ox * rx + oy * ry + oz * rz).toBeCloseTo(-80, 5);
			expect(ox * ux + oy * uy + oz * uz).toBeCloseTo(45, 5);
			expect(ox * fx + oy * fy + oz * fz).toBeCloseTo(-110, 5);
			const lx = camera.target.x - camera.position.x, ly = camera.target.y - camera.position.y, lz = camera.target.z - camera.position.z;
			expect(lx * fx + ly * fy + lz * fz).toBeLessThan(0);
		}
	});
	it("keeps the full three-second swept fuselage path ahead of the carrier and above clear water", () => {
		const start = m01CarrierFlyoffStart(), state = LaunchStage.Pose(start), stage = LaunchStage.New(start)!;
		const bow = m01CarrierPoint({ x: 0, y: 0, z: -M01_CARRIER_MODEL.size.z / 2 });
		for (let i = 0; i <= 90; i++) {
			expect(state.z + 4).toBeLessThan(bow.z);
			expect(state.y - 4).toBeGreaterThan(M01.waterY);
			expect(m01Height(state.x, state.z) + 4).toBeLessThan(state.y);
			LaunchStage.Advance(stage, state, 1 / 30);
		}
	});
});
