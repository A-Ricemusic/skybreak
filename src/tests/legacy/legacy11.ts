import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 11,
	act: 2,
	codename: "Signal Harvest",
	title: "SIGNAL HARVEST",
	region: "upland_farm",
	environment: "farm_sunset",
	primary: "Harvest the relays flanking the farm belt",
	briefing: "Take Lira and Merel on opposite ridges while clearing their alert flights. Follow the farm-road beacons to the unlisted third dish, then relay Teal's packet from the west ridge.",
	debrief: "Lira, Merel and the unlisted Sable fall. The west-ridge handoff reaches a loyalist cell with coordinates for a staging farm.",
	failure: "Lira, Merel and Sable keep the farm belt deaf. Teal's packet never reaches the loyalists.",
	phases: [
			ground("Destroy relay Node Lira", 1, "SERA: Lira first. West ridge dish.", { optionalRaiders: 1 }),
			air("Clear the alert flight", 3, "SERA: Alert flight airborne. Three. Clear them.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			ground("Destroy relay Node Merel", 1, "SERA: Merel next. East ridge.", {
				twist: { at: 1, text: "SERA: Third dish lit north of the belt. Node Sable. Not on the tin.", insert: [
					fly("route", "Follow the farm road north to Sable", [[300,280,-1200],[-100,300,-1650]], 0, 0, undefined,
						{ beat: "SERA: Farm road north. Two beacons to Sable.", chatter: [{ at: 0.5, text: "FARMER: That dish went up last week. Nobody asked us." }] }),
					ground("Destroy relay Node Sable", 1, "SERA: Sable. Dish only. The barn beside it is ours."),
					air("Clear Sable's guard flight", 3, "SERA: Guard flight off Sable. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			fly("signal", "Relay Teal's packet from the west ridge", [[-820,400,-780]], 90, 4, undefined,
				{ beat: "SERA: Relaying Teal's packet. Ninety seconds. Hold the ridge orbit.", chatter: [{ at: 0.5, text: "FARMER: We're hearing it. Keep it coming." }, { at: 0.8, text: "SERA: Last of the packet. Don't drift off the ridge." }], reinforce: [{ at: 0.5, count: 2 }] }),
		],
	ground: [
			{ asset: "comms_relay", name: "NODE LIRA", x: -820, z: -780 },
			{ asset: "comms_relay", name: "NODE MEREL", x: 820, z: -780 },
			{ asset: "comms_relay", name: "NODE SABLE", x: 0, z: -1650 },
		],
};
