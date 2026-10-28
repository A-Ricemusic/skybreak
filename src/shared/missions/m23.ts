import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air } from "./Phases";

export const mission: MissionBlueprint = {
	id: 23,
	act: 3,
	codename: "Ocean Clear",
	title: "OCEAN CLEAR",
	region: "ocean_platform",
	environment: "ocean_clear",
	primary: "Hold the frigate ring around the Marshal's platform",
	briefing: "Defend the command frigate, scan the last gap and clear the platform flight. Sweep the outer beacons, cover the inspection launch across the gap and send the closed-ring report to the landing force.",
	debrief: "The inspected blockade is closed. The landing force receives confirmation that no fuel ship can reach the platform.",
	failure: "The ring breaks. Fuel ships slip through to the platform.",
	phases: [
			// The command frigate holds the ring's south-east station, clear of the platform deck (world: frigate ring).
			fly("defend", "Defend the command frigate", [[650,300,-1550]], 90, 6, undefined,
				{ beat: "FRIGATE: Ring closing. Raiders on the bow.", chatter: [{ at: 0.35, text: "FRIGATE: Second group off the platform. Hold them." }, { at: 0.7, text: "FRIGATE: Third group, low on the water. Two left in the ring." }], reinforce: [{ at: 0.35, count: 2 }, { at: 0.7, count: 2 }] }),
			fly("recon", "Check the gap between the frigates", [[300,300,-1700]], 7, 1, 450,
				{ beat: "FRIGATE: One gap open. Scan the water before we close the ring.", chatter: [{ at: 0.5, text: "FRIGATE: No wake in the gap. Finish the sweep." }] }),
			air("Clear the platform command flight", 4, "FRIGATE: Ring closed. Command flight launching. Four, from both sides.", { groups: 2, stagger: 18, flank: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("route", "Fly the blockade's outer beacons", [[-800,350,-1800],[800,350,-1800]], 0, 1, undefined,
				{ beat: "FRIGATE: Follow the outer beacons. Check the whole sea lane is in sight.", chatter: [{ at: 0.5, text: "FRIGATE: Western lane visible. Sweep to the eastern beacon." }] }),
			fly("escort", "Cover the blockade inspection launch", [[0,40,-1800],[800,40,-1600]], 50, 2, undefined,
				{ beat: "FRIGATE: Inspection launch crossing. Cover it until it docks.", chatter: [{ at: 0.5, text: "FRIGATE: Inspection launch halfway across. Gap remains clear." }] }),
			fly("signal", "Report the blockade is closed", [[500,500,-1500]], 20, 0, undefined,
				{ beat: "FRIGATE: No ships through. Hold the command link for the landing force.", chatter: [{ at: 0.5, text: "LANDING FORCE: Ring report received. Bringing our boats forward." }] }),
		],
	ground: [],
};
