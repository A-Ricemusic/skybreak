import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 12,
	act: 2,
	codename: "Open Field",
	title: "OPEN FIELD",
	region: "upland_farm",
	environment: "farm_morning",
	primary: "Escort the loyalist transmitter truck across the orchards",
	briefing: "Escort the transmitter through the refugee corridor. When false orders divert it, stop at the fork and scan the mill road before covering the new leg; clear the patrol, test the link, and lead in relief.",
	debrief: "The truck reaches the mill road safely, its new link answers, and relief takes over. The farms now have a working relay net.",
	failure: "The transmitter truck is lost. The loyalist cells have no relay net.",
	phases: [
			fly("escort", "Escort the loyalist transmitter truck", [[-1200,65,100],[-500,65,-900],[900,65,-1300]], 90, 4, undefined,
				{ beat: "TRUCK: Transmitter rolling. The corridor is full of refugees.", chatter: [{ at: 0.3, text: "SERA: Second flight coming for the truck." }], reinforce: [{ at: 0.3, count: 2 }],
					twist: { at: 0.5, mode: "now", text: "BROADCAST: Convoy, the north corridor is clear. Proceed north at speed.", insert: [
						fly("recon", "Check the mill road for refugees", [[300,280,-1500]], 8, 0, 420,
				{ parkedEscort: { x: -500, y: 65, z: -900 }, beat: "SERA: Ignore him. North is mined. Truck, stop. Scan the mill road.", chatter: [{ at: 0.5, text: "SERA: Refugees clear of the bend. One more look at the road." }] }),
			fly("escort", "Cover the reroute along the mill road", [[-500,65,-900],[300,65,-1500],[1300,65,-700]], 65, 4, undefined,
							{ beat: "SERA: Mill road is clear. Truck, swing east. We will cover you.", chatter: [{ at: 0.5, text: "TRUCK: Mill road's rough but we're moving. Stay with us." }], reinforce: [{ at: 0.5, count: 2 }] }),
					] } }),
			air("Occupy the orchard airspace", 6, "SERA: Truck's clear. Patrol escalating. Six, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 2 }] }),
			fly("signal", "Test the truck's new relay link", [[800,430,-900]], 20, 1, undefined,
				{ parkedEscort: { x: 1300, y: 65, z: -700 }, beat: "TRUCK: Parked and transmitting. Hold for our first reply.", chatter: [{ at: 0.5, text: "TRUCK: First loyalist cell answering. Holding for the second." }] }),
			fly("route", "Lead the relief crew to the truck", [[300,320,-700],[1300,330,-700]], 0, 0, undefined,
				{ parkedEscort: { x: 1300, y: 65, z: -700 }, beat: "SERA: Relief crew following your beacons. Bring them to the truck.", chatter: [{ at: 0.5, text: "SERA: Relief crew sees the transmitter. Last beacon ahead." }] }),
		],
	ground: [],
};
