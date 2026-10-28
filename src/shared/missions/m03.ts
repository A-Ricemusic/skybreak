import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air } from "./Phases";

export const mission: MissionBlueprint = {
	id: 3,
	act: 1,
	codename: "Fox Trail",
	title: "FOX TRAIL",
	region: "canyon_airfield",
	environment: "canyon_dawn",
	primary: "Follow Teal's final flight path along the rim",
	briefing: "Follow Teal's beacons, mark his receiver on a low scan, and clear the scouts between his two canyon routes. Keep a recovery link open until the receiver is reached.",
	debrief: "Recovery reaches the marked receiver with your radio guidance. Its memory points back at our own training grounds.",
	failure: "The scouts close the ridge. Teal's last flight path goes cold.",
	phases: [
			fly("route", "Follow Teal's beacons", [[-280,240,-150],[-850,280,-900],[-400,350,-1700]], 0, 0, undefined,
				{ beat: "TEAL (tape): Stay low on the switchback.", chatter: [{ at: 0.66, text: "TEAL (tape): Third beacon's the one I nearly missed." }] }),
			fly("recon", "Locate Teal's receiver below the rim", [[-400,260,-1700],[-650,260,-1100]], 8, 0, 380,
				{ beat: "SERA: Scan below the beacons. Recovery needs the receiver marked.", chatter: [{ at: 0.5, text: "SERA: Receiver echo below the second beacon. Keep scanning." }] }),
			air("Clear scout flight alpha", 2, "SERA: Two scouts shadowing the rim. Clear the pair.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("route", "Teal's river run: stay under 320", [[-550,240,-650],[-150,250,-250],[350,260,-800]], 0, 0, 320,
				{ beat: "TEAL (tape): Under three-twenty along the river. Stay out of sight.", chatter: [{ at: 0.66, text: "SERA: Bravo flight is hunting the river. Last gate, then turn." }] }),
			air("Clear scout flight bravo", 3, "SERA: Bravo flight breaking cover. Three, in two groups. Clear them.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Guide recovery onto the receiver", [[-400,420,-1200]], 20, 0, undefined,
				{ beat: "RECOVERY: We have your mark. Keep the link open while we reach it.", chatter: [{ at: 0.5, text: "RECOVERY: Receiver in sight. We are climbing down now." }] }),
		],
	ground: [],
};
