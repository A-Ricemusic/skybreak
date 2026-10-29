import { describe, expect, it } from "@rbxts/jest-globals";
import { fixedRaiders } from "../server/PhaseDirectorRules";
import { MissionCatalog } from "../shared/MissionCatalog";

describe("PhaseDirector mission-wide raider policy", () => {
	it("preserves the phase-zero result for all current missions", () => {
		for (let id = 1; id <= 27; id++) {
			const blueprint = MissionCatalog.Get(id);
			expect(fixedRaiders(blueprint)).toBe(blueprint.phases[0].execution?.fixedRaiders === true);
		}
	});
	it("keeps Mission 2 fixed when an ordinary phase precedes its flagged phase", () => {
		const mission = MissionCatalog.Get(2);
		const ordinary = MissionCatalog.Get(3).phases[0];
		expect(fixedRaiders({ ...mission, phases: [ordinary, ...mission.phases] })).toBe(true);
	});
	it("defaults absent blueprints and unflagged phases to scalable waves", () => {
		expect(fixedRaiders(undefined)).toBe(false);
		expect(fixedRaiders({ ...MissionCatalog.Get(2), phases: MissionCatalog.Get(3).phases })).toBe(false);
	});
});
