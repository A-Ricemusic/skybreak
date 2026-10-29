import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 26,
	act: 3,
	codename: "Fracture Last",
	title: "FRACTURE LAST",
	region: "coastal_city",
	environment: "city_night",
	primary: "Trap the Marshal's wing between you and the city",
	briefing: "Break the split wing, watching for the rear flight at halfway. Map the rooftop echoes, fix Rusk's transmission, follow the loyalist corridor and protect the quay and witness launch.",
	debrief: "Rusk's wing is broken and his position confirmed. The witnesses reach parliament under your cover.",
	failure: "The Marshal's wing escapes the city. His last flight stays protected.",
	phases: [
			air("Break the Marshal's wing", 8, "SERA: Wing splits. Four ahead; the rest will come round behind.",
				{ groups: 2, flank: true, groupAt: [0.5], groupCalls: ["SERA: Second flight on your six! Turn!"], optionalRaiders: 2, reinforce: [{ at: 0.6, count: 2 }] }),
			fly("recon", "Scan the signal below the skyline", [[0,300,-1200]], 6, 0, 430,
				{ beat: "SERA: Signal bouncing between roofs. Scan low to narrow it down.", chatter: [{ at: 0.5, text: "SERA: Rooftop echoes mapped. We still need the name of the mast." }] }),
			fly("signal", "Triangulate Rusk's transmission", [[0,600,-1200]], 40, 4, undefined,
				{ beat: "TEAL (tape): He'll be where he can hear himself. The parliament mast.", chatter: [{ at: 0.5, text: "SERA: Triangulating. He's above the parliament transmitter." }, { at: 0.8, text: "SERA: Fix is closing. Stay in the volume." }], reinforce: [{ at: 0.4, count: 2 }] }),
			fly("route", "Follow the loyalists' city corridor", [[-600,320,-700],[400,350,-1300]], 0, 0, undefined,
				{ beat: "SERA: Loyalists marked a corridor. Follow two lights into the city.", chatter: [{ at: 0.5, text: "SERA: Loyalists see your lights. Follow the last city beacon." }] }),
			fly("defend", "Protect the parliament quay launch", [[500,40,-1400]], 45, 2, undefined,
				{ beat: "MARINE: Secure the quay while witnesses board. Cover the marked site.", chatter: [{ at: 0.5, text: "MARINE: Witnesses boarding. Quay remains secure." }] }),
			fly("escort", "Cover the witness launch to parliament", [[500,40,-1400],[1100,40,-1000]], 30, 2, undefined,
				{ beat: "MARINE: Witnesses aboard. Keep us covered until parliament is in sight.", chatter: [{ at: 0.5, text: "MARINE: Parliament in sight. Witnesses still aboard." }] }),
		],
	ground: [],
};
