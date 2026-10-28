import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air } from "./Phases";

export const mission: MissionBlueprint = {
	id: 5,
	act: 1,
	codename: "Orchard Line",
	title: "ORCHARD LINE",
	region: "upland_farm",
	environment: "farm_morning",
	primary: "Cover the orchard evacuation convoy",
	briefing: "Cover the orchard trucks to the upland road and drive off the patrol leads. Check both bends for stragglers, report the families' names, and guide the seed tin toward the rim.",
	debrief: "Every family is accounted for at Varda. The seed tin and its map of military silos leave the orchard safely.",
	failure: "The convoy is caught on the open road. The orchard families never reach the uplands.",
	phases: [
			fly("escort", "Cover the orchard evacuation trucks", [[-1000,70,-300],[0,70,-850],[1200,70,-300]], 100, 4, undefined,
				{ beat: "FARMER: Trucks rolling. Please stay with us.", chatter: [{ at: 0.5, text: "SERA: Second flight off the ridge. Turn back now." }, { at: 0.85, text: "FARMER: The road's in sight. Don't leave us yet." }], reinforce: [{ at: 0.5, count: 2 }] }),
			air("Drive off the patrol leads", 3, "SERA: Trucks are clear. Their patrol leads are turning in. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Check the evacuation road is empty", [[900,280,-300],[300,280,-700]], 6, 0, 400,
				{ beat: "FARMER: One truck lost its radio. Check both bends for stragglers.", chatter: [{ at: 0.5, text: "FARMER: One bend clear. Check behind the orchard wall too." }] }),
			fly("signal", "Pass the families' names to Varda", [[200,420,-700]], 20, 0, undefined,
				{ beat: "SERA: All trucks counted. Hold the link for the families' names.", chatter: [{ at: 0.5, text: "TOWER: Names copied. Finding beds for the children now." }] }),
			fly("route", "Bring the seed tin toward the rim", [[0,320,-300],[-600,340,100]], 0, 0, undefined,
				{ beat: "FARMER: Seed tin is aboard. Follow our homeward beacons.", chatter: [{ at: 0.5, text: "FARMER: The lead truck sees your lights. Keep leading." }] }),
		],
	ground: [],
};
