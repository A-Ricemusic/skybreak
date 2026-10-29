import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 15,
	act: 2,
	codename: "Loyalist Window",
	title: "LOYALIST WINDOW",
	region: "upland_farm",
	environment: "farm_morning",
	primary: "Buy the loyalist broadcast its one clear window",
	briefing: "Hold the loyalist broadcast link and destroy any jammers that block it. Clear the second intruders, follow the garrisons' reply beacons, and scan both compounds to confirm they stood down.",
	debrief: "The broadcast lands and the reply is verified from the air. Loyalist garrisons park their aircraft instead of following the forged orders.",
	failure: "The broadcast is jammed. The garrisons stay with the coup.",
	phases: [
			fly("signal", "Hold the broadcast link", [[0,420,-900]], 90, 4, undefined,
				{ beat: "LOYALIST: Transmitting. Every second is a garrison.", chatter: [{ at: 0.3, text: "SERA: Raiders inbound. Stay inside the volume." }, { at: 0.75, text: "LOYALIST: Garrisons answering. Keep the volume." }], reinforce: [{ at: 0.3, count: 2 }],
					hazard: { at: 0.4, count: 2, effect: "jam", text: "LOYALIST: Link lost! Kill the two jammer trucks on the farm road." } }),
			air("Hold the second intruders", 7, "SERA: Second wave, riding harder. Seven, in two groups. Raiders in tow.",
				{ groups: 2, stagger: 18, optionalRaiders: 3, reinforce: [{ at: 0.3, count: 1 }, { at: 0.6, count: 2 }] }),
			fly("route", "Follow the garrisons' reply beacons", [[-500,300,-400],[600,330,-1100]], 0, 0, undefined,
				{ beat: "LOYALIST: Two reply beacons lit. Follow them to check the garrisons.", chatter: [{ at: 0.5, text: "LOYALIST: West garrison beacon confirmed. East is ahead." }] }),
			fly("recon", "Confirm the garrisons have stood down", [[-1000,280,-900],[950,280,-1600]], 7, 1, 420,
				{ beat: "SERA: Scan both compounds for parked aircraft. Verify they stood down.", chatter: [{ at: 0.5, text: "SERA: Engines cold at the first compound. Check the second." }] }),
		],
	ground: [
			{ asset: "comms_relay", name: "JAMMER TRUCK 1", x: -620, z: -640 },
			{ asset: "comms_relay", name: "JAMMER TRUCK 2", x: 560, z: -1260 },
		],
};
