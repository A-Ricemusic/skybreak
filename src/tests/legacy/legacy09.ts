import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 9,
	act: 1,
	codename: "Static Horizon",
	title: "STATIC HORIZON",
	region: "canyon_pass",
	environment: "canyon_night",
	primary: "Night sweep over the pass; Vulture Lead is waiting",
	briefing: "Follow the night lights and locate Vulture Lead's guard-channel source. Clear his patrol, draw him onto the open channel, defeat him, then mark his recorder for recovery.",
	debrief: "Recovery reaches Vulture Lead's recorder. Teal's cut-off transmission links the farms to the coastal harbors.",
	failure: "Vulture Lead holds the pass. Teal's final transmission stays buried with the witness.",
	phases: [
			fly("route", "Follow the night approach lights", [[500,350,-100],[900,420,-850],[0,450,-1700]], 0, 0, undefined,
				{ beat: "SERA: The approach lights are his bait. Fly them anyway.", chatter: [{ at: 0.66, text: "VULTURE LEAD: Teal flew this line too. Keep coming." }] }),
			fly("recon", "Find Vulture Lead's guard-channel source", [[0,340,-1500]], 8, 0, 480,
				{ beat: "SERA: His voice is bouncing off the pass. Scan low to mark the source.", chatter: [{ at: 0.5, text: "SERA: Guard-channel source above the pass. That is him." }] }),
			air("Clear the night patrol", 3, "SERA: Three on night vision, in two groups. Watch your horizon.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Draw Vulture Lead onto the open channel", [[0,500,-1200]], 20, 1, undefined,
				{ beat: "SERA: Patrol is gone. Hold the channel open. He will come to answer.", chatter: [{ at: 0.5, text: "VULTURE LEAD: You have my attention, trainee. Stay there." }] }),
			{ kind: "ace", label: "Defeat Vulture Lead", optionalRaiders: 2, beat: "Vulture Lead. He erased the witness. Not you." },
			fly("recon", "Mark Vulture Lead's recorder", [[400,300,-1200],[-200,300,-1600]], 5, 0, 450,
				{ beat: "RECOVERY: Recorder still transmitting. Mark it before the signal dies.", chatter: [{ at: 0.5, text: "RECOVERY: Recorder ping steady. Mark the second slope." }] }),
		],
	ground: [],
	aceHealth: 200,
	aceName: "VULTURE LEAD",
	aceStages: ["VULTURE LEAD: You fly like him. He died anyway. Wing, cut him off.", "VULTURE LEAD: Enough. Wing, on me!"],
	aceReturns: ["SERA: Vulture Lead's turning back in. Nose on him.", "VULTURE LEAD: Head on, trainee. Like he did."],
};
