import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath, type FlightState } from "../shared/FlightMath";
import { FlightPrediction } from "../shared/FlightPrediction";
import { MissionCatalog } from "./LegacyCatalog";
import { M01_AIRSPACE } from "../shared/M01Limits";
import { M01 } from "../shared/M01WorldPlan";
import { airspaceWarning, clampAirSpawn, resolveAirspace } from "../shared/WorldAirspace";
import { radarProject, radarRange } from "../shared/RadarMath";
import type { MissionStarted } from "../shared/Types";
import { LEGACY_AIRSPACE_CAPTURE, LEGACY_SPAWN_CAPTURE, LEGACY_RADAR_CAPTURE, LEGACY_BLIP_CAPTURE } from "./LegacyAirspaceCapture";

const poses = [[0, 500, 0], [3700, 3700, -2.4], [-3799, -3799, 0.8], [3900, -3900, 1.2]];
const input = { x: 0.3, y: -0.1, throttle: 1 };
const neutral = { x: 0, y: 0, throttle: 1 };
function sameState(actual: FlightState, expected: FlightState): void {
	for (const key of ["x", "y", "z", "qw", "qx", "qy", "qz", "lean", "yaw", "pitch", "roll", "speed"] as const) {
		expect(actual[key]).toBe(expected[key]);
	}
}

describe("per-session mission airspace", () => {
	for (const id of [1, 2, 3, 26]) {
		it(`mission ${id} matches pre-change main flight, prediction, recovery, spawning and radar`, () => {
			const limits = MissionCatalog.Airspace(MissionCatalog.Get(id));
			for (let i = 0; i < poses.size(); i++) {
				const pose = poses[i];
				const state = FlightMath.FromPose(pose[0], 500, pose[1], pose[2], 0.15, 600);
				const predictor = FlightPrediction.New({ ...state }, limits);
				for (let step = 1; step <= 120; step++) {
					FlightMath.Step(state, input, 1 / 30, limits);
					FlightPrediction.Step(predictor, input, 1 / 30, step / 30);
				}
				sameState(state, LEGACY_AIRSPACE_CAPTURE[i].flight);
				sameState(predictor.state, LEGACY_AIRSPACE_CAPTURE[i].prediction);
			}
			const spawns = [-20000, -3501, -3500, 0, 3500, 3501, 20000];
			for (let i = 0; i < spawns.size(); i++) expect(clampAirSpawn(spawns[i], limits)).toBe(LEGACY_SPAWN_CAPTURE[i]);
			expect(radarRange(0, 0, [], limits)).toBe(LEGACY_RADAR_CAPTURE[0]);
			expect(radarRange(0, 0, [{ kind: "required", x: 800, z: 0 }], limits)).toBe(LEGACY_RADAR_CAPTURE[1]);
			expect(radarRange(0, 0, [{ kind: "required", x: 5000, z: 0 }], limits)).toBe(LEGACY_RADAR_CAPTURE[2]);
			const blip = radarProject(5000, -1000, 0.4, radarRange(0, 0, [], limits), 55);
			expect(blip.x).toBeCloseTo(LEGACY_BLIP_CAPTURE.x, 9);
			expect(blip.y).toBeCloseTo(LEGACY_BLIP_CAPTURE.y, 9);
			expect(blip.edge).toBe(LEGACY_BLIP_CAPTURE.edge);
			for (const edge of [3599, 3600, 3601, 3800]) expect(airspaceWarning(edge, 0, limits)).toBe(edge > 3600);
		});
	}
	it("reliable Started limits initialize prediction before its first step and reset each session", () => {
		const message: Pick<MissionStarted, "kind" | "airspace"> = { kind: "Started", airspace: M01_AIRSPACE };
		const server = FlightMath.FromPose(0, 622, -5000, 0, 0, 600);
		const client = FlightPrediction.New({ ...server }, message.airspace);
		expect(client.airspace).toEqual(M01_AIRSPACE);
		for (let step = 1; step <= 90; step++) {
			FlightMath.Step(server, neutral, 1 / 30, M01_AIRSPACE);
			FlightPrediction.Step(client, neutral, 1 / 30, step / 30);
			sameState(client.state, server);
			expect(airspaceWarning(server.x, server.z, client.airspace, 100)).toBe(false);
		}
		expect(math.abs(server.z)).toBeGreaterThan(3800);
		expect(FlightPrediction.New(FlightMath.NewState()).airspace).toEqual(MissionCatalog.Airspace(MissionCatalog.Get(1)));
	});
	it("missing or invalid handoff falls back safely to legacy limits", () => {
		const message: Pick<MissionStarted, "kind" | "airspace"> = { kind: "Started" };
		expect(resolveAirspace(message.airspace)).toEqual(MissionCatalog.Airspace(MissionCatalog.Get(1)));
		expect(resolveAirspace({ ...M01_AIRSPACE, hardHalfWidth: 0 / 0 })).toEqual(MissionCatalog.Airspace(MissionCatalog.Get(1)));
		expect(resolveAirspace({ ...M01_AIRSPACE, spawnLimit: math.huge })).toEqual(MissionCatalog.Airspace(MissionCatalog.Get(1)));
	});
	it("large-session hard edge clamps then recovers inward using its own limits", () => {
		const state = FlightMath.FromPose(0, 622, -M01_AIRSPACE.hardHalfWidth, 0, 0, 600);
		let returned = false;
		for (let step = 0; step < 600; step++) {
			FlightMath.Step(state, neutral, 1 / 30, M01_AIRSPACE);
			expect(math.abs(state.x)).toBeLessThanOrEqual(M01_AIRSPACE.hardHalfWidth);
			expect(math.abs(state.z)).toBeLessThanOrEqual(M01_AIRSPACE.hardHalfWidth);
			if (state.z > -M01_AIRSPACE.softHalfWidth) returned = true;
		}
		expect(returned).toBe(true);
		expect(clampAirSpawn(20000, M01_AIRSPACE)).toBe(13500);
		expect(radarRange(0, 0, [], M01_AIRSPACE)).toBe(18000);
	});
	it("600 studs/s traversals in both axes and signs stay within M01 coverage", () => {
		expect(M01_AIRSPACE.spawnLimit).toBeLessThan(M01_AIRSPACE.softHalfWidth);
		expect(M01_AIRSPACE.softHalfWidth).toBeLessThan(M01_AIRSPACE.hardHalfWidth);
		expect(M01_AIRSPACE.hardHalfWidth + 600 / 30).toBeLessThan(M01.half);
		for (const yaw of [0, math.pi / 2, math.pi, -math.pi / 2]) {
			const state = FlightMath.FromPose(0, 622, 0, yaw, 0, 600);
			let crossedLegacy = false;
			for (let step = 0; step < 3600; step++) {
				FlightMath.Step(state, neutral, 1 / 30, M01_AIRSPACE);
				const edge = math.max(math.abs(state.x), math.abs(state.z));
				expect(edge).toBeLessThan(M01.half);
				expect(state.speed).toBeCloseTo(600, 8);
				if (edge > 3800) crossedLegacy = true;
			}
			expect(crossedLegacy).toBe(true);
		}
	});
});
