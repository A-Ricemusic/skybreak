import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air, ground } from "./Phases";

export const mission: MissionBlueprint = {
	id: 10,
	act: 2,
	codename: "Plateau Cold",
	title: "PLATEAU COLD",
	region: "plateau_relay",
	environment: "farm_overcast",
	primary: "Scout and silence the first plateau relay",
	briefing: "Scan Node Kiro's archive; if intercepted, clear the camp flight and finish copying. Cut the transmitter, trace the command channel to its hidden radar, destroy it, then clear the blind response.",
	debrief: "Kiro's archive is safe and its directing radar is dark. Loyalist traffic returns with evidence linking the next two relays.",
	failure: "Node Kiro keeps transmitting. Loyalist traffic stays jammed.",
	phases: [
			fly("recon", "Scan Node Kiro (hold fire)", [[180,300,-1100]], 12, 0, 450,
				{ beat: "SERA: Scan the archive first. The dish can wait.", chatter: [{ at: 0.3, text: "SERA: Signatures copying. Stay low. Hold fire." }],
					twist: { at: 0.6, mode: "now", text: "SERA: They've seen you. Four climbing off the camp. Scan's on hold.", insert: [
						air("Break the camp's intercept", 4, "SERA: Four off the camp, in pairs. Clear them, then we finish the scan.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
						fly("recon", "Finish the archive scan", [[180,300,-1100]], 8, 2, 450,
							{ beat: "SERA: Back on the archive. Eight seconds of clean copy.", chatter: [{ at: 0.5, text: "SERA: Copy complete in four. Hold your line." }], reinforce: [{ at: 0.4, count: 1 }] }),
					] } }),
			ground("Cut Node Kiro's transmitter", 1, "SERA: Archive copied. Cut the transmitter.", {
				twist: { at: 1, text: "SERA: Radar is directing them. Hold the channel; we will trace it.", insert: [
					fly("signal", "Trace the camp radar's command channel", [[400,480,-1000]], 20, 2, undefined,
				{ directed: true, reinforce: [{ at: 0.5, count: 1 }], beat: "SERA: Hold the channel while we trace the camp radar.", chatter: [{ at: 0.5, text: "SERA: The radar is still directing them. Trace is closing." }] }),
			ground("Kill the camp radar", 1, "SERA: Radar on the camp roof. Its raiders fire twice as fast. Kill it.", { hidden: true, directed: true, optionalRaiders: 3 }),
				] } }),
			air("Intercept the blind response", 3, "SERA: Radar's dead. The response is flying blind. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
		],
	ground: [
			{ asset: "comms_relay", name: "NODE KIRO", x: 180, z: -1100 },
			{ asset: "radar", name: "CAMP RADAR", x: 560, z: -820 },
		],
};
