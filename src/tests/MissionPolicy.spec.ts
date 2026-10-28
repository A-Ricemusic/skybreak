import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath } from "../shared/FlightMath";
import { GameConfig } from "../shared/GameConfig";
import { MissionBlueprint, MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { WorldAirspace } from "../shared/WorldAirspace";

function withPolicy(fields: Partial<MissionBlueprint>): MissionBlueprint {
	return { ...MissionCatalog.Get(1), id: 99, ...fields };
}

function rejects(fields: Partial<MissionBlueprint>): boolean {
	const [accepted] = pcall(() => MissionCatalog.ValidatePolicy(withPolicy(fields)));
	return !accepted;
}

describe("Mission policy schema", () => {
	it("defaults every existing mission to today's exact values without opting the catalog in", () => {
		const state = FlightMath.NewState();
		for (const blueprint of MISSIONS) {
			expect(blueprint.countdownSeconds).toBeUndefined();
			expect(blueprint.airspace).toBeUndefined();
			expect(blueprint.start).toBeUndefined();
			expect(blueprint.scoring).toBeUndefined();
			expect(blueprint.worldKey).toBeUndefined();
			expect(blueprint.available).toBeUndefined();
			expect(MissionCatalog.CountdownSeconds(blueprint.id)).toBe(GameConfig.Campaign.MissionTimeLimit);
			expect(MissionCatalog.Airspace(blueprint.id)).toEqual({
				softHalfWidth: WorldAirspace.soft,
				hardHalfWidth: WorldAirspace.hard,
				spawnLimit: WorldAirspace.spawnLimit,
				radarRange: WorldAirspace.radarRange,
			});
			expect(MissionCatalog.Start(blueprint.id)).toEqual({
				kind: "airborne", x: state.x, y: state.y, z: state.z, headingDegrees: 0, speed: state.speed,
			});
			expect(MissionCatalog.Scoring(blueprint.id)).toEqual({
				points: { bandit: 100, raider: 100, courier: 100, ace: 100, ground: 150 },
				rank: { S: 90, A: 75, B: 55, C: 35 },
			});
			expect(MissionCatalog.WorldKey(blueprint.id)).toBe(blueprint.region);
			expect(MissionCatalog.Available(blueprint.id)).toBe(true);
		}
	});

	it("rejects nonfinite, nonpositive, inconsistent and out-of-bounds policy values", () => {
		const airspace = { softHalfWidth: 1000, hardHalfWidth: 1200, spawnLimit: 900, radarRange: 1500 };
		const start = { kind: "airborne" as const, x: 0, y: 250, z: 0, headingDegrees: 0 };
		const scoring = { points: { bomber: 100 }, rank: { S: 600, A: 500, B: 400, C: 300 } };
		const cases: Partial<MissionBlueprint>[] = [
			{ countdownSeconds: 0 },
			{ countdownSeconds: 0 / 0 },
			{ airspace: { ...airspace, softHalfWidth: -1 } },
			{ airspace: { ...airspace, radarRange: math.huge } },
			{ airspace: { ...airspace, softHalfWidth: 1300 } },
			{ airspace: { ...airspace, spawnLimit: 1300 } },
			{ start: { ...start, x: 0 / 0 } },
			{ start: { ...start, speed: 0 } },
			{ airspace, start: { ...start, z: 1201 } },
			{ scoring: { ...scoring, points: {} } },
			{ scoring: { ...scoring, points: { bomber: math.huge } } },
			{ scoring: { ...scoring, points: { bomber: -1 } } },
			{ scoring: { ...scoring, rank: { S: 500, A: 500, B: 400, C: 300 } } },
			{ scoring: { ...scoring, rank: { S: 600, A: 500, B: 400, C: -1 } } },
			{ worldKey: "" },
			{ available: 1 as unknown as boolean },
		];
		for (const invalid of cases) expect(rejects(invalid)).toBe(true);
	});

	it("round-trips a complete sample policy through the effective-value accessors", () => {
		const blueprint = withPolicy({
			countdownSeconds: 600,
			airspace: { softHalfWidth: 15000, hardHalfWidth: 17500, spawnLimit: 14500, radarRange: 20000 },
			start: { kind: "carrier_flyoff", x: 100, y: 590, z: -6000, headingDegrees: 0, speed: 160 },
			scoring: { points: { bomber: 100, escort: 60, ace: 240 }, rank: { S: 1000, A: 800, B: 600, C: 400 } },
			worldKey: "m01_sea_island",
			available: false,
		});
		MissionCatalog.ValidatePolicy(blueprint);
		expect(MissionCatalog.CountdownSeconds(blueprint)).toBe(blueprint.countdownSeconds!);
		expect(MissionCatalog.Airspace(blueprint)).toBe(blueprint.airspace!);
		expect(MissionCatalog.Start(blueprint)).toBe(blueprint.start!);
		expect(MissionCatalog.Scoring(blueprint)).toBe(blueprint.scoring!);
		expect(MissionCatalog.WorldKey(blueprint)).toBe(blueprint.worldKey!);
		expect(MissionCatalog.Available(blueprint)).toBe(false);
	});
});
