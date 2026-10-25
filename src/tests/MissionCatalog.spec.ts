import { describe, expect, it } from "@rbxts/jest-globals";
import { CUTSCENES, getCutscene } from "../shared/CutsceneCatalog";
import { getMission, MISSION_COUNT, MISSIONS, requiredAir, requiredGround } from "../shared/MissionCatalog";

describe("Last Tide authored campaign catalog", () => {
	it("contains 27 ordered, named, playable mission definitions", () => {
		expect(MISSION_COUNT).toBe(27);
		expect(MISSIONS).toHaveLength(27);
		const names = new Set<string>();
		const regions = new Set<string>();
		const environments = new Set<string>();
		for (let index = 0; index < MISSIONS.size(); index++) {
			const mission = MISSIONS[index];
			expect(mission.id).toBe(index + 1);
			expect(mission.codename.size()).toBeGreaterThan(3);
			expect(mission.synopsis.size()).toBeGreaterThan(45);
			expect(mission.islands.size()).toBeGreaterThanOrEqual(4);
			expect(mission.phases.size()).toBeGreaterThan(0);
			expect(names.has(mission.codename)).toBe(false);
			names.add(mission.codename);
			regions.add(mission.region);
			environments.add(mission.environment);
			expect(mission.targets.size()).toBeGreaterThanOrEqual(requiredGround(mission));
			expect(requiredAir(mission) + requiredGround(mission) + mission.phases.filter((phase) => phase.kind === "nav" || phase.kind === "hold").size()).toBeGreaterThan(0);
		}
		expect(names.size()).toBe(27);
		expect(regions.size()).toBe(27);
		expect(environments.size()).toBeGreaterThanOrEqual(10);
	});

	it("preserves the exact first-flight and Reefbreak Harbor contracts", () => {
		const first = getMission(1);
		expect(first.phases.map((phase) => phase.kind)).toEqual(["tutorial", "ground", "air"]);
		expect(first.phases.map((phase) => phase.required)).toEqual([0, 1, 3]);
		expect(first.targets).toHaveLength(1);
		expect(first.targets[0].kind).toBe("radar");
		const second = getMission(2);
		expect(second.phases.map((phase) => phase.kind)).toEqual(["air", "ground", "ace"]);
		expect(second.phases.map((phase) => phase.required)).toEqual([3, 5, 1]);
		expect(second.phases[1].optional).toBe(5);
		expect(second.phases[2].health).toBe(165);
		expect(second.targets).toHaveLength(5);
	});

	it("uses air, ground, ace, navigation, and timed-defense pacing", () => {
		const kinds = new Set<string>();
		const targetKinds = new Set<string>();
		let routeMissions = 0;
		let holdMissions = 0;
		for (const mission of MISSIONS) {
			let hasRoute = false;
			let hasHold = false;
			for (const phase of mission.phases) {
				kinds.add(phase.kind);
				if (phase.kind === "nav") {
					hasRoute = true;
					expect(phase.route).toHaveLength(phase.required);
				}
				if (phase.kind === "hold") {
					hasHold = true;
					expect(phase.required).toBeGreaterThanOrEqual(25);
				}
			}
			if (hasRoute) routeMissions++;
			if (hasHold) holdMissions++;
			for (const target of mission.targets) targetKinds.add(target.kind);
		}
		for (const kind of ["tutorial", "air", "ground", "ace", "nav", "hold"]) expect(kinds.has(kind)).toBe(true);
		for (const kind of ["warehouse", "radar", "corvette", "sam"]) expect(targetKinds.has(kind)).toBe(true);
		expect(routeMissions).toBeGreaterThanOrEqual(8);
		expect(holdMissions).toBeGreaterThanOrEqual(6);
	});

	it("provides an opening, every transition, and a captioned finale", () => {
		expect(CUTSCENES).toHaveLength(28);
		for (let index = 0; index <= MISSION_COUNT; index++) {
			const cinematic = getCutscene(index);
			expect(cinematic.afterMission).toBe(index);
			expect(cinematic.beats.size()).toBeGreaterThanOrEqual(3);
			for (const beat of cinematic.beats) {
				expect(beat.speaker.size()).toBeGreaterThan(0);
				expect(beat.text.size()).toBeGreaterThan(20);
				expect(beat.duration).toBeGreaterThanOrEqual(3.5);
			}
		}
		expect(getCutscene(27).title).toBe("THE LAST TIDE");
	});
});
