import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air, ground, chase } from "./Phases";

export const mission: MissionBlueprint = {
	id: 24,
	act: 3,
	codename: "Platform Fire",
	title: "PLATFORM FIRE",
	region: "ocean_platform",
	environment: "ocean_storm",
	primary: "Strike the offshore platform through the storm",
	briefing: "Fly the low sea gates, burn the platform stores and break the storm patrol. Find and stop the escaping tanker, cover the deck crew's rescue launch and confirm nothing else has lifted.",
	debrief: "The tanker is stopped and the deck crew rescued. The frigate confirms the platform's fuel chain is broken.",
	failure: "The platform reserves survive. The Marshal can wait out the blockade.",
	phases: [
			fly("route", "Low sea approach: under 360", [[-700,220,-100],[-1000,240,-750],[0,260,-1700]], 0, 1, 360,
				{ beat: "SERA: Under the storm. Three gates to the platform.", chatter: [{ at: 0.66, text: "SERA: Last gate. The deck stores are ahead." }] }),
			ground("Destroy three platform warehouses", 3, "SERA: Three stores on the deck. Burn them.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			air("Clear the storm patrol", 5, "SERA: Patrol in the storm shadow. Five, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Find the tanker in the storm shadow", [[200,300,-1500]], 7, 1, 420,
				{ beat: "SERA: Scan below the cloud. The tanker is hiding behind the deck smoke.", chatter: [{ at: 0.5, text: "SERA: Engine heat below the cloud. It is running for the coast." }] }),
			chase("Stop the escaping fuel tanker", 90, [200,350,2100], "SERA: Tanker jet lifting off, running for the coast. Stop it.",
				[{ at: 0.5, text: "SERA: Tanker's halfway to the coast. Close on it." }, { at: 0.8, text: "SERA: He's almost over the city. Now!" }], 2),
			fly("escort", "Escort the deck crew's rescue launch", [[-700,40,-1400],[700,40,-1700]], 50, 2, undefined,
				{ beat: "FRIGATE: Deck crew aboard. Cover them clear of the burning stores.", chatter: [{ at: 0.5, text: "FRIGATE: Launch halfway clear. Deck crew accounted for." }] }),
			fly("signal", "Report the platform fuel chain is broken", [[0,500,-1100]], 20, 1, undefined,
				{ beat: "FRIGATE: Tanker down. Hold while we check for other launches.", chatter: [{ at: 0.5, text: "FRIGATE: No second tanker on radar. Checking the last deck returns." }] }),
		],
	ground: [
			{ asset: "warehouse", name: "DECK ALPHA", x: -480, z: -900 },
			{ asset: "warehouse", name: "DECK BRAVO", x: 0, z: -1150 },
			{ asset: "warehouse", name: "DECK CHARLIE", x: 480, z: -900 },
		],
};
