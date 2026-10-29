import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 8,
	act: 1,
	codename: "Rim Switch",
	title: "RIM SWITCH",
	region: "canyon_airfield",
	environment: "canyon_dusk",
	primary: "Hold Varda Rim through a coordinated counter-strike",
	briefing: "Protect Varda's tower while crews restore its code. Scan the smoke for spotters before striking, clear the retreating flight, and stay until loyal pilots acknowledge the restored code.",
	debrief: "The restored code reaches every loyal flight. Varda holds, but Vulture Lead is still hunting the night approach.",
	failure: "Varda's tower stays in coup hands, and the rim airfield goes with it.",
	phases: [
			fly("defend", "Protect Varda's control tower", [[-430,240,250]], 110, 5, undefined,
				{ beat: "SERA: Tower crew resetting the code. Keep the raiders off them.", chatter: [{ at: 0.5, text: "BROADCAST: Varda tower is in rebel hands. Fire on it." }, { at: 0.55, text: "SERA: Ignore that. It's him." }, { at: 0.7, text: "SERA: Second wave's dropping smoke on the apron. Spotters." }],
					reinforce: [{ at: 0.35, count: 1 }, { at: 0.65, count: 2 }] }),
			fly("recon", "Mark the apron spotters", [[-1050,280,-250],[-150,280,-450]], 6, 0, 400,
				{ beat: "SERA: Smoke on the apron. Scan for the two spotter dishes first.", chatter: [{ at: 0.5, text: "SERA: Two dishes in the smoke. Keep the parked trainers clear." }] }),
			ground("Counter-attack the spotter radars", 2, "SERA: Code is ours. Two spotter radars on the apron. Hit them.", { hidden: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			air("Catch the retreating flight", 3, "SERA: Spotters down. Their flight is running. Catch three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Send the restored tower code", [[-430,420,250]], 15, 0, undefined,
				{ beat: "TOWER: Code restored. Stay on the link until every loyal flight answers.", chatter: [{ at: 0.5, text: "TOWER: Loyal flight answering. Waiting on the last one." }] }),
		],
	ground: [
			{ asset: "radar", name: "SPOTTER RADAR 1", x: -1050, z: -250 },
			{ asset: "radar", name: "SPOTTER RADAR 2", x: -150, z: -450 },
		],
};
