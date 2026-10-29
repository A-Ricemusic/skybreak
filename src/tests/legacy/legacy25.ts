import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 25,
	act: 3,
	codename: "City Dawn",
	title: "CITY DAWN",
	region: "coastal_city",
	environment: "city_dawn",
	primary: "Cover the loyalist landing at the city dawn",
	briefing: "Escort the landing craft to the beach and defeat the first intercept. Scan both beach exits, stop the rear attack, cut the directing relay and hold the link until both landing squads answer.",
	debrief: "Both squads confirm the beach exits are held. The loyalists advance into the city as Rusk brings his personal flight airborne.",
	failure: "The landing is pushed back into the sea. The city stays in coup hands.",
	phases: [
			fly("escort", "Cover the landing craft to the beach", [[-900,40,-1750],[-450,40,-1400],[50,40,-1000]], 80, 4, undefined,
				{ beat: "LANDING CRAFT: Beach in eighty seconds. Keep them off us.", chatter: [{ at: 0.5, text: "SERA: Second intercept launching. Stay on the craft." }, { at: 0.85, text: "LANDING CRAFT: Surf line. Ramps going down." }], reinforce: [{ at: 0.5, count: 2 }] }),
			air("Hold the first intercept", 3, "SERA: First intercept off the apron. Three, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Mark the safe route off the beach", [[-300,280,-1100],[300,280,-1000]], 12, 2, 420,
				{ beat: "LANDING CRAFT: Ramps down. Scan both exits so we can leave the sand.", chatter: [{ at: 0.5, text: "LANDING CRAFT: West exit clear. Check the eastern street." }] }),
			air("Hold the second intercept", 3, "SERA: Second wave with raiders, coming round behind. Hold the beach.",
				{ groups: 2, stagger: 18, flank: true, optionalRaiders: 3, reinforce: [{ at: 0.5, count: 2 }] }),
			ground("Destroy the beach relay", 1, "SERA: Beach relay is still directing fire. Cut it."),
			fly("signal", "Confirm both beach exits are held", [[0,480,-1100]], 20, 1, undefined,
				{ beat: "LANDING CRAFT: Streets reached. Hold for both beach exits to answer.", chatter: [{ at: 0.5, text: "LANDING CRAFT: West exit answering. Waiting for the eastern squad." }] }),
		],
	ground: [{ asset: "comms_relay", name: "BEACH RELAY", x: 0, z: -1250 }],
};
