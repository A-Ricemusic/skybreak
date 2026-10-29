import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 19,
	act: 3,
	codename: "Harbor Run",
	title: "HARBOR RUN",
	region: "coastal_city",
	environment: "harbor_fog",
	primary: "First strike on the coup's harbor logistics",
	briefing: "Scan the military quays, burn the stores and break the early intercept. Trace a safe lane for the workers' launch, escort it clear, defeat the remaining flight and open the rescue channel.",
	debrief: "The military stores burn while harbor workers reach safety. Their rescue channel stays open as Rusk moves into the city.",
	failure: "The harbor reserves survive. The coup keeps its coastal logistics.",
	phases: [
			fly("recon", "Scan the quays; spare the city", [[-500,270,-900],[500,270,-900]], 6, 1, 420,
				{ beat: "SERA: Watch what the cranes unload. Mark the quays.", chatter: [{ at: 0.5, text: "SERA: Those crates are munitions. The quays are military." }] }),
			ground("Destroy three harbor warehouses", 3, "SERA: Three military quays. Hit the warehouses.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }],
				twist: { at: 0.66, text: "SERA: Early CAP pair launching. Finish the quay, then turn in.", insert: [
					air("Break the early CAP", 2, "SERA: Early pair off the apron. Clear them.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			fly("route", "Trace the workers' escape lane", [[-700,300,-1300],[0,320,-1700],[700,320,-1400]], 0, 2, undefined,
				{ beat: "HARBOR: Follow the three quay beacons. Our launch needs a clear way out.", chatter: [{ at: 0.5, text: "HARBOR: First bend clear. Last beacon marks the open channel." }] }),
			fly("escort", "Escort the harbor workers", [[-600,40,-1300],[700,40,-1500]], 40, 2, undefined,
				{ beat: "HARBOR: Workers aboard. Cover our launch clear of the burning quays.", chatter: [{ at: 0.5, text: "HARBOR: All workers counted. Past the worst of the smoke." }] }),
			air("Clear the harbor CAP", 4, "SERA: Main CAP off the apron. Four, in two groups.", { groups: 2, stagger: 20, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Open the harbor rescue frequency", [[0,500,-1100]], 20, 1, undefined,
				{ beat: "HARBOR: Quays clear. Hold the channel while we count our people.", chatter: [{ at: 0.5, text: "HARBOR: First crew answering. Still calling the eastern quay." }] }),
		],
	ground: [
			{ asset: "warehouse", name: "QUAY 1", x: -500, z: -900 },
			{ asset: "warehouse", name: "QUAY 2", x: 0, z: -1150 },
			{ asset: "warehouse", name: "QUAY 3", x: 500, z: -900 },
		],
};
