import { describe, expect, it } from "@rbxts/jest-globals";
import { cutsceneForMissionLaunch } from "../shared/CampaignPresentation";
import { CUTSCENE_SKIP_SIZE, CUTSCENE_STAGE_ORIGIN, offsetCutscenePoint } from "../shared/CutscenePresentation";

describe("campaign presentation transitions", () => {
	it("gates every first sequential launch through opening or an inter-mission scene", () => {
		const ids = new Array<string>();
		for (let missionId = 1; missionId <= 27; missionId++) {
			const reason = missionId === 1 ? "briefing" : "next";
			const scene = cutsceneForMissionLaunch(missionId, [], reason);
			expect(scene).toBeDefined();
			ids.push(scene!.id);
			expect(scene!.id).toBe(missionId === 1 ? "cs_prologue" : `cs_after_${string.format("%02d", missionId - 1)}`);
		}
		expect(new Set(ids).size()).toBe(27);
	});

	it("skips a first-time-only scene after it is recorded", () => {
		expect(cutsceneForMissionLaunch(2, [], "next")?.id).toBe("cs_after_01");
		expect(cutsceneForMissionLaunch(2, ["cs_after_01"], "next")).toBeUndefined();
	});

	it("never inserts a cinematic into retry recovery", () => {
		for (let missionId = 1; missionId <= 27; missionId++) {
			expect(cutsceneForMissionLaunch(missionId, [], "retry")).toBeUndefined();
		}
	});

	it("rejects invalid transition targets without indexing the manifest", () => {
		for (const missionId of [0, 1.5, 28, math.huge, 0 / 0]) {
			expect(cutsceneForMissionLaunch(missionId, [], "next")).toBeUndefined();
		}
	});
});

describe("cutscene stage isolation", () => {
	it("translates actors and camera points far above menu and mission worlds", () => {
		expect(CUTSCENE_STAGE_ORIGIN.Y).toBeGreaterThanOrEqual(5000);
		const point = offsetCutscenePoint([10, -2, -20]);
		expect(point.X).toBe(10);
		expect(point.Y).toBe(4998);
		expect(point.Z).toBe(-20);
	});

	it("keeps the Skip action at least 44 pixels in both dimensions", () => {
		expect(CUTSCENE_SKIP_SIZE.X).toBeGreaterThanOrEqual(44);
		expect(CUTSCENE_SKIP_SIZE.Y).toBeGreaterThanOrEqual(44);
	});
});
