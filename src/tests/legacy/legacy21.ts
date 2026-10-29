import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 21,
	act: 3,
	codename: "City Night",
	title: "CITY NIGHT",
	region: "coastal_city",
	environment: "city_night",
	primary: "Night strike on the Marshal's broadcast tower",
	briefing: "Follow the dark canal and mark the dish above the apartments before firing. Clear the escort, confirm the tower is silent, cover the repair launch and guide its crew to the dark district.",
	debrief: "Rusk's tower stays silent. Repair crews reach the district while its residents open their windows to the quiet.",
	failure: "The broadcast tower keeps talking. The city hears only Rusk.",
	phases: [
			fly("route", "Follow the dark canal through the city", [[-400,250,-100],[-900,300,-700],[0,320,-1500]], 0, 1, 430,
				{ beat: "SERA: The dark canal keeps you off his radar. Follow it.", chatter: [{ at: 0.66, text: "SERA: Relay above the apartments. Hit only the dish." }] }),
			fly("recon", "Mark the dish above the apartments", [[0,300,-1300]], 8, 1, 430,
				{ beat: "SERA: Low scan over the canal. Mark the dish above the roofs.", chatter: [{ at: 0.5, text: "SERA: Dish marked. Apartment roofs stay standing." }] }),
			ground("Destroy the broadcast relay", 1, "SERA: Broadcast relay above the city. Dish only.", { optionalRaiders: 2 }),
			air("Hold off the escort flight", 4, "SERA: Escort flight scrambling. Four, in two pairs.", { groups: 2, stagger: 35, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Confirm the dark tower is silent", [[0,520,-1300]], 60, 4, undefined,
				{ beat: "SERA: Hold over the tower. I want to hear nothing from it.", chatter: [{ at: 0.4, text: "SERA: Pair off the dark side of the city. Hold the orbit." }, { at: 0.8, text: "SERA: Still silent. Hold it." }], reinforce: [{ at: 0.4, count: 2 }] }),
			fly("escort", "Cover the repair launch", [[-600,40,-1500],[400,40,-900]], 45, 2, undefined,
				{ beat: "HARBOR: Repair crew moving. Cover us to the dark district.", chatter: [{ at: 0.5, text: "HARBOR: Crew passing the canal bend. Keep the approach clear." }] }),
			fly("route", "Mark the repair crew's district route", [[-600,320,-800],[0,350,-300],[600,350,-900]], 0, 1, undefined,
				{ parkedEscort: { x: 400, y: 40, z: -900 }, beat: "HARBOR: Launch moored. Follow district lights to guide the shore crew.", chatter: [{ at: 0.5, text: "HARBOR: Shore crew sees your mark. Moving to the next street." }] }),
		],
	ground: [{ asset: "comms_relay", name: "BROADCAST RELAY", x: 0, z: -1300 }],
};
