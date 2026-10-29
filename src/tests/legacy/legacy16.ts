import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 16,
	act: 2,
	codename: "Storm Walk",
	title: "STORM WALK",
	region: "upland_farm",
	environment: "farm_storm",
	primary: "Finish the staging ground while the storm covers you",
	briefing: "Run the river gates under the storm and identify the last fuel stores in the rain. Burn them, clear the diving patrol, cut the forward relay, and copy its final traffic.",
	debrief: "The stores and relay are dark. Their copied traffic identifies the crown station carrying the Marshal's real signature.",
	failure: "The last staging site survives the storm and the fuel keeps moving.",
	phases: [
			fly("route", "River gates: stay under 400", [[400,220,0],[800,240,-750],[0,280,-1450]], 0, 0, 400,
				{ beat: "SERA: River gates keep you under the storm. Stay low.", chatter: [{ at: 0.66, text: "SERA: Last gate. The marked tanks are just past it." }] }),
			fly("recon", "Identify fuel stores in the rain", [[-520,280,-820],[540,280,-820]], 7, 0, 400,
				{ beat: "SERA: Rain hides the markings. Scan both ends before you fire.", chatter: [{ at: 0.5, text: "SERA: Fuel markings visible. Keep the farm roofs out of the strike." }] }),
			ground("Destroy three remaining silos", 3, "SERA: Three silos under the storm. Burn them.", { optionalRaiders: 1, reinforce: [{ at: 0.34, count: 1 }],
				twist: { at: 0.66, text: "SERA: Five diving through the cloud. Finish the tanks and turn.", insert: [
					air("Catch the storm patrol", 5, "SERA: Patrol riding the thunder. Five, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			ground("Destroy the forward relay", 1, "SERA: Forward relay on the staging path. Cut it."),
			fly("signal", "Read the dead relay's last traffic", [[0,420,-1600]], 80, 4, undefined,
				{ beat: "SERA: Hold over the relay. Its last traffic is still in the air.", chatter: [{ at: 0.35, text: "SERA: Pair off the plateau, using the storm. Hold the orbit." }, { at: 0.7, text: "SERA: Second pair, coming out of the rain." }], reinforce: [{ at: 0.35, count: 2 }, { at: 0.7, count: 2 }] }),
		],
	ground: [
			{ asset: "grain_silo", name: "STAGING SILO 1", x: -520, z: -820 },
			{ asset: "grain_silo", name: "STAGING SILO 2", x: 0, z: -1050 },
			{ asset: "grain_silo", name: "STAGING SILO 3", x: 540, z: -820 },
			{ asset: "comms_relay", name: "FORWARD RELAY", x: 0, z: -1600 },
		],
};
