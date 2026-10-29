import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 13,
	act: 2,
	codename: "Staging Farm",
	title: "STAGING FARM",
	region: "upland_farm",
	environment: "farm_overcast",
	primary: "Dismantle the coup's upland staging farm",
	briefing: "Follow the rail spur and scan the military stores among civilian roofs. Destroy four silos, clear the responding flights and cut the relay, then send the rail crew's ledger to the cells.",
	debrief: "The staging farm is dark. Its copied ledger reaches the cells and points to the plateau antenna chain.",
	failure: "The staging farm keeps feeding the coup's fuel chain.",
	phases: [
			fly("route", "Follow the rail spur to the staging farm", [[-500,270,-350],[-250,300,-850]], 0, 0, undefined,
				{ beat: "SERA: Rail spur runs straight to their stores. Follow it.", chatter: [{ at: 0.5, text: "SERA: Spur ends at the silos. Low and quiet now." }] }),
			fly("recon", "Scan the staging farm low", [[0,300,-1000]], 10, 2, 420,
				{ beat: "SERA: Mark the stores. Civilian roofs stay standing.", chatter: [{ at: 0.5, text: "SERA: Fuel ledger confirmed. Those silos are military." }], reinforce: [{ at: 0.5, count: 1 }] }),
			ground("Destroy four fuel silos", 4, "SERA: Four silos. Marked only.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }],
				twist: { at: 0.5, text: "SERA: Four off the plateau. Finish the silos, then turn into them.", insert: [
					air("Break the plateau reinforcements", 4, "SERA: Silos burning. Now the four, in pairs. Turn in.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			ground("Destroy the farm relay", 1, "SERA: The relay's still calling for help. Cut it."),
			air("Hold off the raiders", 3, "SERA: Raiders off the plateau. Three more, with hangers-on.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			fly("signal", "Send the staging ledger to the cells", [[0,450,-1000]], 20, 1, undefined,
				{ beat: "SERA: Rail crew has the ledger. Hold the link to the cells.", chatter: [{ at: 0.5, text: "LOYALIST: Rail ledger copied. Matching it against Kiro's orders." }] }),
		],
	ground: [
			{ asset: "grain_silo", name: "SILO 1", x: -560, z: -900 },
			{ asset: "grain_silo", name: "SILO 2", x: -160, z: -1140 },
			{ asset: "grain_silo", name: "SILO 3", x: 300, z: -1120 },
			{ asset: "grain_silo", name: "SILO 4", x: 640, z: -840 },
			{ asset: "comms_relay", name: "FARM RELAY", x: 60, z: -1500 },
		],
};
