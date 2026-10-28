import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air, ground } from "./Phases";

export const mission: MissionBlueprint = {
	id: 4,
	act: 1,
	codename: "Static Quarters",
	title: "STATIC QUARTERS",
	region: "canyon_airfield",
	environment: "canyon_noon",
	primary: "Silence an unlisted radar hidden inside the training grounds",
	briefing: "Scan the rogue training radar for proof, destroy it, and follow the service-road beacons clear. Defeat its response flight, then send the staff list to Varda.",
	debrief: "Varda records all three names before anyone can erase them. The list leads to the orchard witnesses.",
	failure: "The rogue radar keeps watching Varda. The officers behind it stay hidden.",
	phases: [
			fly("recon", "Scan the quarters: stay under 380", [[-400,260,-600],[-750,260,-300],[-150,260,-250]], 7, 0, 380,
				{ beat: "BROADCAST: All Varda units stand down. Authority: Air Marshal.", chatter: [{ at: 0.5, text: "SERA: Stand down? Nobody at Varda issued that." }] }),
			ground("Destroy the hidden rim radar", 1, "SERA: Proof's recorded. Now kill the radar.", { optionalRaiders: 1 }),
			fly("route", "Follow the quarters service road", [[-700,260,-400],[0,300,-200],[600,330,-900]], 0, 0, undefined,
				{ beat: "SERA: Evidence copied. Follow the service road clear.", chatter: [{ at: 0.5, text: "SERA: Road is clear ahead. Keep to the beacon line." }] }),
			air("Fend off the response flight", 5, "SERA: They scrambled a flight. Five, in two groups. Hold the line.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Send the staff list to Varda", [[-200,420,-800]], 20, 1, undefined,
				{ beat: "SERA: Varda is copying the names. Hold the link.", chatter: [{ at: 0.5, text: "TOWER: First two names copied. Send the third." }] }),
		],
	ground: [{ asset: "radar", name: "RIM RADAR", x: -400, z: -600 }],
};
