import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air, chase } from "./Phases";

export const mission: MissionBlueprint = {
	id: 7,
	act: 1,
	codename: "Dust Weather",
	title: "DUST WEATHER",
	region: "canyon_pass",
	environment: "canyon_dusk",
	primary: "Intercept a storm-day messenger crossing the canyon pass",
	briefing: "Run the dust-pass gates and scan the clearings for the courier's trail. Strip his escort, catch him before the plateau, then head toward Varda while reading his packet over the radio.",
	debrief: "Varda copies tomorrow's coup orders and the first relay's name from the courier packet: Node Kiro.",
	failure: "The courier reaches the plateau. Tomorrow's coup orders go out on time.",
	phases: [
			fly("route", "Run the dust pass under 400", [[-450,240,-200],[-900,300,-1000],[-200,300,-1850],[500,300,-1400]], 0, 0, 400,
				{ beat: "SERA: The courier runs under the dust. Stay in it.", chatter: [{ at: 0.66, text: "SERA: Five escorts ahead of him. Dust is thinning." }] }),
			fly("recon", "Find the courier's trail in the dust", [[-700,280,-1100],[-100,280,-1700]], 8, 0, 400,
				{ beat: "SERA: Scan both clearings for his engine trail.", chatter: [{ at: 0.5, text: "SERA: Engine trail at the second clearing. Keep low." }] }),
			air("Strip the courier's escort", 5, "SERA: Five escorts in the dust, in two groups. Strip them off him.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			chase("Catch the courier before the plateau", 90, [-300,320,-2250], "SERA: There's the courier, running north. Ninety seconds. Catch him.",
				[{ at: 0.5, text: "SERA: He's halfway to the plateau. Close on him." }, { at: 0.8, text: "SERA: Twenty seconds and he's over the edge!" }]),
			fly("route", "Carry the courier packet toward Varda", [[0,440,-1200],[-700,400,-400]], 0, 0, undefined,
				{ beat: "SERA: Packet recovered. Head for Varda while I read the orders.", chatter: [{ at: 0.5, text: "SERA: Tomorrow's orders copied. Reading the signatures next." }] }),
		],
	ground: [],
};
