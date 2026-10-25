import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog } from "../shared/MissionCatalog";
import { MissionRules } from "../shared/MissionRules";

describe("Embers of Home mission catalog", () => {
	it("contains 27 ordered authored missions with opening and debrief cinematics", () => {
		expect(MissionCatalog.Count()).toBe(27);
		const names = new Set<string>();
		const cutscenes = new Set<string>();
		for (let index = 0; index < MissionCatalog.Count(); index++) {
			const mission = MissionCatalog.All()[index];
			expect(mission.id).toBe(index + 1);
			expect(names.has(mission.codename)).toBe(false);
			names.add(mission.codename);
			for (const id of [mission.openingCutsceneId, mission.debriefCutsceneId]) {
				const cinematic = MissionCatalog.Cutscene(id);
				expect(cinematic).toBeDefined();
				expect(cinematic!.beats.size()).toBeGreaterThan(0);
				cutscenes.add(id);
			}
			expect(mission.phases.size()).toBeGreaterThan(0);
			const requiredGround = MissionCatalog.TotalRequiredGroundKills(mission.id);
			const targetCount = (mission.targets ?? MissionCatalog.Layout(mission.layoutId).targets)
				.filter((target) => target.kind !== "lifeboat").size();
			expect(targetCount).toBeGreaterThanOrEqual(requiredGround);
		}
		expect(cutscenes.size()).toBe(54);
	});

	it("preserves the exact first two mission contracts", () => {
		const first = MissionCatalog.Require(1);
		expect(first.phases.map((phase) => phase.kind)).toEqual([
			"tutorial_move", "tutorial_target", "tutorial_missile", "tutorial_bandits",
		]);
		expect(MissionCatalog.TotalRequiredAirKills(1)).toBe(3);
		expect(MissionCatalog.TotalRequiredGroundKills(1)).toBe(1);
		const second = MissionCatalog.Require(2);
		expect(second.phases.map((phase) => phase.kind)).toEqual(["intercept", "warehouses", "ace"]);
		expect(second.phases[0].requiredAir).toBe(3);
		expect(second.phases[1].requiredGround).toBe(5);
		expect(second.phases[1].optionalAirCap).toBe(5);
		expect(second.phases[2].spawn?.airWave?.aceHealth).toBe(165);
	});

	it("allows every declared objective path to finish through real rule events", () => {
		for (const mission of MissionCatalog.All()) {
			const state = MissionRules.NewState(mission.id, 0);
			let serial = 0;
			while (state.outcome === undefined && serial < 200) {
				const phase = MissionRules.CurrentPhase(state)!;
				if (phase.kind === "tutorial_move") {
					for (let index = 0; index < 7; index++) MissionRules.ObserveControls(state, 0.8, -0.8, 0.1, 1);
				} else if (phase.kind === "tutorial_target") {
					MissionRules.CycleTarget(state, state.elapsed + 1);
				} else if (phase.requiresAce === true) {
					expect(MissionRules.RecordKill(state, `m${mission.id}_ace_${serial}`, "ace", true, state.elapsed + 1)).toBe(true);
				} else if (phase.requiredGround !== undefined) {
					for (let index = 0; index < phase.requiredGround; index++) {
						expect(MissionRules.RecordKill(state, `m${mission.id}_ground_${serial}_${index}`, "ground", true, state.elapsed + 1 + index * 0.01)).toBe(true);
					}
				} else if (phase.requiredAir !== undefined) {
					for (let index = 0; index < phase.requiredAir; index++) {
						expect(MissionRules.RecordKill(state, `m${mission.id}_air_${serial}_${index}`, "air", true, state.elapsed + 1 + index * 0.01)).toBe(true);
					}
				} else if (phase.surviveSeconds !== undefined) {
					MissionRules.Tick(state, state.phaseStartedAt + phase.surviveSeconds + 0.01);
				}
				serial += 1;
			}
			expect(state.outcome).toBe("won");
			expect(state.elapsed).toBeLessThan(600);
		}
	});
});
