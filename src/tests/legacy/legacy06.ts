import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 6,
	act: 1,
	codename: "Grain Shadow",
	title: "GRAIN SHADOW",
	region: "upland_farm",
	environment: "farm_overcast",
	primary: "Destroy fuel grain silos stockpiling for the coup",
	briefing: "Follow the irrigation channel and scan the marked fuel silos without touching the farm roofs. Burn the stores, clear the patrol, and copy the fuel ledger from the farm crew.",
	debrief: "The silos are gone and the ledger is copied. A farmer identifies the courier who carries the next set of orders.",
	failure: "The fuel grain ships north. The coup's patrols stay supplied.",
	phases: [
			fly("route", "Follow the farm irrigation channel", [[500,230,0],[850,250,-700],[250,240,-1550]], 0, 0, undefined,
				{ beat: "SERA: Follow the channel. The marked tanks sit at its end.", chatter: [{ at: 0.5, text: "FARMER: The unmarked roofs are ours. Please." }] }),
			fly("recon", "Mark fuel silos below 400", [[-520,260,-720],[540,260,-680]], 6, 0, 400,
				{ beat: "SERA: Low pass first. Mark the military silos, not the farmhouses.", chatter: [{ at: 0.5, text: "SERA: Fuel-grade grain in all three. The roofs are clean." }] }),
			ground("Destroy three fuel silos", 3, "SERA: Marked silos only. That grain is fuel.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			air("Clear the orchard patrol", 5, "SERA: Five answering the smoke, in two groups. Turn into them.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Copy the fuel ledger before leaving", [[0,430,-1000]], 20, 1, undefined,
				{ beat: "SERA: The farm crew found the ledger. Hold the link while they read it.", chatter: [{ at: 0.5, text: "FARMER: Three fuel shipments. All signed by the same officer." }] }),
		],
	ground: [
			{ asset: "grain_silo", name: "SILO ALPHA", x: -520, z: -720 },
			{ asset: "grain_silo", name: "SILO BRAVO", x: 60, z: -1080 },
			{ asset: "grain_silo", name: "SILO CHARLIE", x: 540, z: -680 },
		],
};
