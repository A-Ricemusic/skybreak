import { describe, expect, it } from "@rbxts/jest-globals";
import { buildOutcome, outcomeMissionId } from "../shared/OutcomeModel";
import { initialTelemetry } from "../shared/InitialTelemetry";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import { MissionScore } from "../shared/MissionScore";
import type { MissionFinished, Telemetry } from "../shared/Types";

// Also runs in the offline Luau VM (tools/test-relay-offline.ts), whose assertions
// are limited to toBe and toBeUndefined.

const palette = { accent: "accent", muted: "muted", orange: "orange" };

/** HUD telemetry at the moment the sortie ended: the fallbacks for missing payload fields. */
function telemetryAtEnd(missionId: number, overrides: Partial<Telemetry> = {}): Telemetry {
	return { ...initialTelemetry(missionId), health: 40, kills: 3, groundKills: 1, elapsed: 150, ...overrides };
}

/** The ids of one points-basis and one time-basis mission so both targetScore branches are covered. */
function missionIdsByBasis(): { points: number; time: number } {
	let points = 0;
	let time = 0;
	for (let id = 1; id <= MISSION_COUNT; id++) {
		if (MissionCatalog.Scoring(id).basis === "points") points = points === 0 ? id : points;
		else time = time === 0 ? id : time;
	}
	return { points, time };
}

const snapshot = { total: 1800, kills: { fighter: 2 }, points: { fighter: 1800 } };

function wellFormed(missionId: number): MissionFinished {
	return {
		kind: "Completed",
		slot: 1,
		missionId,
		kills: 5,
		groundKills: 2,
		optionalKills: 1,
		elapsed: 200,
		par: 240,
		completedPhases: 2,
		missilesFired: 6,
		missileHits: 4,
		damageTaken: 35,
		lowestHealth: 65,
		evades: 2,
		score: 7250.7,
		rank: "A",
		newBestScore: true,
		newBestRank: false,
		bestScore: 7250.2,
		bestRank: "A",
		reason: "complete",
		difficulty: "ace",
		saved: true,
		persistence: "cloud",
		targetScore: snapshot,
	};
}

describe("outcomeMissionId", () => {
	it("prefers a valid payload id, then the HUD's mission, then Practice", () => {
		const current = telemetryAtEnd(3);
		expect(outcomeMissionId(wellFormed(5), current)).toBe(5);
		expect(outcomeMissionId({ ...wellFormed(5), missionId: 99 }, current)).toBe(3);
		expect(outcomeMissionId({ ...wellFormed(5), missionId: undefined }, current)).toBe(3);
		expect(outcomeMissionId({ ...wellFormed(5), missionId: 99 }, { ...current, missionId: undefined })).toBe(1);
	});
});

describe("buildOutcome with a well-formed payload", () => {
	const { points, time } = missionIdsByBasis();
	it("copies the server's debrief and marks a cloud save in the accent colour", () => {
		const model = buildOutcome(wellFormed(points), telemetryAtEnd(points), "cloud", palette);
		expect(model.won).toBe(true);
		expect(model.missionId).toBe(points);
		expect(model.airKills).toBe(3);
		expect(model.groundKills).toBe(2);
		expect(model.optionalKills).toBe(1);
		expect(model.elapsed).toBe(200);
		expect(model.par).toBe(240);
		expect(model.completedPhases).toBe(2);
		expect(model.missilesFired).toBe(6);
		expect(model.missileHits).toBe(4);
		expect(model.damageTaken).toBe(35);
		expect(model.lowestHealth).toBe(65);
		expect(model.evades).toBe(2);
		expect(model.score).toBe(7250);
		expect(model.rank).toBe("A");
		expect(model.newBestScore).toBe(true);
		expect(model.newBestRank).toBe(false);
		expect(model.bestScore).toBe(7250);
		expect(model.bestRank).toBe("A");
		expect(model.reason).toBe("complete");
		expect(model.difficulty).toBe("ace");
		expect(model.saveText).toBe("FLIGHT RECORD SAVED TO CLOUD");
		expect(model.saveColor).toBe("accent");
	});
	it("keeps the target ledger only for points-basis missions", () => {
		expect(buildOutcome(wellFormed(points), telemetryAtEnd(points), "cloud", palette).targetScore).toBe(snapshot);
		if (time > 0) {
			expect(buildOutcome(wellFormed(time), telemetryAtEnd(time), "cloud", palette).targetScore).toBeUndefined();
		}
	});
	it("explains the save status for each persistence level", () => {
		const won = wellFormed(points);
		const lost: MissionFinished = { ...won, kind: "Failed", saved: undefined };
		const current = telemetryAtEnd(points);
		const unconfirmed = buildOutcome({ ...won, saved: false }, current, "cloud", palette);
		expect(unconfirmed.saveText).toBe("RESULT RECEIVED — SAVE NOT CONFIRMED");
		expect(unconfirmed.saveColor).toBe("muted");
		const session = buildOutcome(won, current, "session", palette);
		expect(session.saveText).toBe("RESULT HELD FOR THIS SESSION ONLY");
		expect(session.saveColor).toBe("orange");
		const unavailable = buildOutcome(won, current, "unavailable", palette);
		expect(unavailable.saveText).toBe("SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST");
		expect(unavailable.saveColor).toBe("orange");
		const failedCloud = buildOutcome(lost, current, "cloud", palette);
		expect(failedCloud.won).toBe(false);
		expect(failedCloud.saveText).toBe("");
		expect(failedCloud.saveColor).toBe("muted");
	});
});

describe("buildOutcome with missing payload fields", () => {
	const { points } = missionIdsByBasis();
	const minimal: MissionFinished = { kind: "Completed", slot: 1, kills: 4, elapsed: 90 };
	it("falls back to the HUD telemetry and the catalog", () => {
		const current = telemetryAtEnd(points);
		const model = buildOutcome(minimal, current, "unavailable", palette);
		expect(model.missionId).toBe(points);
		expect(model.airKills).toBe(3);
		expect(model.groundKills).toBe(1);
		expect(model.optionalKills).toBe(0);
		expect(model.elapsed).toBe(90);
		expect(model.par).toBe(MissionScore.ParSeconds(MissionCatalog.Get(points)));
		expect(model.completedPhases).toBe(MissionCatalog.TotalPhases(MissionCatalog.Get(points)));
		expect(model.missilesFired).toBe(0);
		expect(model.missileHits).toBe(0);
		expect(model.damageTaken).toBe(60);
		expect(model.lowestHealth).toBe(40);
		expect(model.evades).toBe(0);
		expect(model.newBestScore).toBe(false);
		expect(model.newBestRank).toBe(false);
		expect(model.bestScore).toBeUndefined();
		expect(model.bestRank).toBeUndefined();
		expect(model.reason).toBeUndefined();
		expect(model.difficulty).toBeUndefined();
		expect(model.targetScore).toBeUndefined();
	});
	it("scores the run locally when the server sent no score or rank", () => {
		const current = telemetryAtEnd(points);
		const model = buildOutcome(minimal, current, "unavailable", palette);
		const expected = MissionScore.Compute(
			{
				won: true,
				airKills: 3,
				groundKills: 1,
				elapsed: 90,
				par: model.par,
				missilesFired: 0,
				missileHits: 0,
				damageTaken: 60,
			},
			MissionCatalog.Scoring(points),
		);
		expect(model.score).toBe(expected.score);
		expect(model.rank).toBe(expected.rank);
	});
	it("gives a failed run zero completed phases by default", () => {
		const model = buildOutcome({ ...minimal, kind: "Failed" }, telemetryAtEnd(points), "unavailable", palette);
		expect(model.won).toBe(false);
		expect(model.completedPhases).toBe(0);
	});
});

describe("buildOutcome with malformed payload fields", () => {
	const { points } = missionIdsByBasis();
	it("ignores non-finite numbers, bad ranks, reasons, levels and ledgers", () => {
		const bad = {
			...wellFormed(points),
			kills: math.huge,
			groundKills: -3,
			optionalKills: "two",
			elapsed: 0 / 0,
			par: -5,
			completedPhases: -1,
			missilesFired: 2.9,
			missileHits: 7,
			damageTaken: 250,
			lowestHealth: -20,
			evades: -math.huge,
			score: -1,
			rank: "Z",
			bestScore: 0 / 0,
			bestRank: 7,
			reason: "lag",
			difficulty: "nightmare",
			newBestScore: "yes",
			newBestRank: 1,
			targetScore: { total: "lots" },
		} as unknown as MissionFinished;
		const current = telemetryAtEnd(points);
		const model = buildOutcome(bad, current, "cloud", palette);
		expect(model.airKills).toBe(3);
		expect(model.groundKills).toBe(0);
		expect(model.optionalKills).toBe(0);
		expect(model.elapsed).toBe(150);
		expect(model.par).toBe(MissionScore.ParSeconds(MissionCatalog.Get(points)));
		expect(model.completedPhases).toBe(0);
		expect(model.missilesFired).toBe(2);
		expect(model.missileHits).toBe(2);
		expect(model.damageTaken).toBe(100);
		expect(model.lowestHealth).toBe(0);
		expect(model.evades).toBe(0);
		expect(model.rank).toBe(
			MissionScore.Compute(
				{
					won: true,
					airKills: 3,
					groundKills: 0,
					elapsed: 150,
					par: model.par,
					missilesFired: 2,
					missileHits: 2,
					damageTaken: 100,
				},
				MissionCatalog.Scoring(points),
			).rank,
		);
		expect(model.bestScore).toBeUndefined();
		expect(model.bestRank).toBeUndefined();
		expect(model.reason).toBeUndefined();
		expect(model.difficulty).toBeUndefined();
		expect(model.newBestScore).toBe(false);
		expect(model.newBestRank).toBe(false);
		expect(model.targetScore).toBeUndefined();
	});
	it("clamps a negative elapsed to zero and floors a fractional score", () => {
		const model = buildOutcome(
			{ ...wellFormed(points), elapsed: -12, score: 0.9 },
			telemetryAtEnd(points),
			"cloud",
			palette,
		);
		expect(model.elapsed).toBe(0);
		expect(model.score).toBe(0);
	});
});
