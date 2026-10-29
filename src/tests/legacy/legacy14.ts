import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 14,
	act: 2,
	codename: "Antenna Row",
	title: "ANTENNA ROW",
	region: "plateau_relay",
	environment: "relay_night",
	primary: "Blind the long-range antenna row at night",
	briefing: "Cross the saddle beacons and strike the three antennas. Locate the replacement dish on the saddle road before destroying it, clear the perimeter flight, and listen until the whole chain is silent.",
	debrief: "The replacement mast falls with the fixed row. A final listening check confirms the coup has switched to courier runs.",
	failure: "The antenna row stays lit. The coup's chain of command stays intact.",
	phases: [
			fly("route", "Cross the four saddle beacons", [[-500,320,-100],[-1000,450,-700],[0,550,-1200],[1000,430,-1500]], 0, 0, undefined,
				{ beat: "SERA: Saddle beacons lead to the arrays. Climb.", chatter: [{ at: 0.5, text: "SERA: All three arrays can hear you now." }, { at: 0.75, text: "BROADCAST: Unknown aircraft on the saddle. Intercept." }] }),
			ground("Destroy three plateau antennas", 3, "SERA: Three dishes on the ridge. Blind them.", { optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }],
				twist: { at: 0.3, text: "SERA: Replacement mast on the saddle road. Cut that one too.", insert: [
					fly("recon", "Find the saddle-road replacement mast", [[-250,300,-450]], 8, 0, 450,
				{ beat: "SERA: Scan the saddle road. They have raised a replacement dish.", chatter: [{ at: 0.5, text: "SERA: Dish truck on the saddle road. Civilian vans are clear." }] }),
			ground("Destroy the mobile mast", 1, "SERA: Mast located on the saddle road. Hit the dish."),
				] } }),
			air("Clear the perimeter CAP", 4, "SERA: Perimeter CAP turning in. Four, in pairs, with raiders.", { groups: 2, stagger: 18, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Hold the saddle: confirm the row is dark", [[0,450,-1200]], 60, 4, undefined,
				{ beat: "SERA: Hold the saddle. I'm listening for anything left alive.", chatter: [{ at: 0.4, text: "SERA: More off the dark end of the row. Hold the orbit." }, { at: 0.8, text: "SERA: Nothing on the chain. Almost there." }], reinforce: [{ at: 0.4, count: 2 }] }),
		],
	ground: [
			{ asset: "comms_relay", name: "ANTENNA ONE", x: -600, z: -1100 },
			{ asset: "comms_relay", name: "ANTENNA TWO", x: 0, z: -1340 },
			{ asset: "comms_relay", name: "ANTENNA THREE", x: 600, z: -1100 },
			{ asset: "comms_relay", name: "MOBILE MAST", x: -250, z: -450 },
		],
};
