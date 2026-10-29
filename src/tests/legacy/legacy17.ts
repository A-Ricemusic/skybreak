import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 17,
	act: 2,
	codename: "Aurora Relay",
	title: "AURORA RELAY",
	region: "plateau_relay",
	environment: "relay_aurora",
	primary: "Hunt the last plateau relay under the aurora",
	briefing: "Cut the crown relay and clear its intercepts, then receive the archive. If the signal breaks, scan beneath the array, kill the jammer and its escort, and return to finish receiving the signature.",
	debrief: "The resumed receive orbit brings the complete signed order home: Air Marshal Rusk. Vulture Two challenges your call sign.",
	failure: "The aurora relay stays hot. The Marshal's signature stays hidden.",
	phases: [
			ground("Destroy the plateau relay", 1, "SERA: One dish under the aurora. Cut it.", { optionalRaiders: 1 }),
			air("Clear the aurora intercept", 4, "SERA: Four intercepts lit by the aurora, in pairs.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Orbit to receive the archive", [[-100,500,-1400]], 90, 2, undefined,
				{ beat: "TEAL (tape): If you hear this up here, read the signature.", chatter: [{ at: 0.3, text: "SERA: The archive is speaking. Signature decoding." }],
					twist: { at: 0.5, mode: "now", text: "SERA: Archive lost. Jammer under the array. Find it, low.", insert: [
						fly("recon", "Find the jammer under the array", [[500,300,-1150]], 6, 0, 450,
							{ beat: "SERA: Get under the aurora glow. It'll show on the scan.", chatter: [{ at: 0.5, text: "SERA: There. A dish truck in the array's shadow." }] }),
						ground("Destroy the aurora jammer", 1, "SERA: Jammer marked. Cut it."),
						air("Clear the jammer's escort", 2, "SERA: Its escort is up. Two.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
						fly("signal", "Resume the receive orbit", [[-100,500,-1400]], 50, 2, undefined,
							{ beat: "SERA: Archive's back. Hold the orbit. Read the signature.", chatter: [{ at: 0.5, text: "SERA: Signature decoding. Hold. It carries a Marshal's seal." }], reinforce: [{ at: 0.4, count: 1 }] }),
					] } }),
		],
	ground: [
			{ asset: "comms_relay", name: "AURORA RELAY", x: -100, z: -1400 },
			{ asset: "comms_relay", name: "AURORA JAMMER", x: 500, z: -1150 },
		],
};
