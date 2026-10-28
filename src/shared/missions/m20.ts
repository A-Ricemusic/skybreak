import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air } from "./Phases";

export const mission: MissionBlueprint = {
	id: 20,
	act: 3,
	codename: "Fracture Line",
	title: "FRACTURE LINE",
	region: "coastal_city",
	environment: "city_evening",
	primary: "Split the Air Marshal's air cover in half",
	briefing: "Break the eastern wing and scan the launch's exit. Cover Teal's paper evidence through the harbor, silence the bank guns, mark the patrol boat's approach and confirm the handoff over the radio.",
	debrief: "The launch clears the guns and transfers Teal's evidence at sea. Marines confirm the archive and tapes are safely aboard.",
	failure: "The Marshal's air cover holds together. The evidence never leaves the harbor.",
	phases: [
			air("Shatter the eastern wing", 9, "SERA: Full wing on the east line. Nine, in three groups.", { groups: 3, stagger: 18 }),
			fly("recon", "Scan the launch's exit", [[700,280,-1400]], 6, 1, 420,
				{ beat: "MARINE: Paper is aboard. Scan the harbor exit before we move.", chatter: [{ at: 0.5, text: "MARINE: Exit marked. We will move as soon as your scan is clear." }] }),
			fly("escort", "Cover the evidence launch", [[-1400,40,-1150],[0,40,-1450],[1400,40,-1150]], 110, 4, undefined,
				{ beat: "MARINE: Launch moving. Keep the sky quiet.", chatter: [{ at: 0.5, text: "SERA: Western wing reacting. Launch is halfway out." }], reinforce: [{ at: 0.5, count: 2 }],
					hazard: { at: 0.15, count: 2, effect: "guns", text: "MARINE: Guns on both banks, firing on the launch! Silence them!" } }),
			fly("route", "Mark the open-water rendezvous", [[900,340,-1300],[1400,350,-600]], 0, 0, undefined,
				{ parkedEscort: { x: 1400, y: 40, z: -1150 }, beat: "MARINE: Holding at the exit. Mark the patrol boat's approach beacons.", chatter: [{ at: 0.5, text: "MARINE: Patrol boat sees your mark. One more beacon." }] }),
			fly("signal", "Confirm the evidence handoff at sea", [[900,500,-900]], 20, 0, undefined,
				{ parkedEscort: { x: 1400, y: 40, z: -1150 }, beat: "MARINE: Patrol boat alongside. Hold until the paper changes hands.", chatter: [{ at: 0.5, text: "MARINE: Archive case passed. Tapes are next." }] }),
		],
	ground: [
			{ asset: "radar", name: "WEST BANK GUN", x: -720, z: -930 },
			{ asset: "radar", name: "EAST BANK GUN", x: 720, z: -930 },
		],
};
