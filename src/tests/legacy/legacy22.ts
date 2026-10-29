import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air, ground } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 22,
	act: 3,
	codename: "Harbor Fog",
	title: "HARBOR FOG",
	region: "coastal_harbor",
	environment: "harbor_fog",
	primary: "Finish the harbor in the fog",
	briefing: "Scan and destroy the five fuel depots, follow the empty piers and clear the fog patrol. Escort the inspection launch, verify the last two hoses are dry and report to the frigates.",
	debrief: "Inspectors verify every fuel hose is dry. The frigates receive proof that Rusk's escape fleet cannot refuel.",
	failure: "The fuel depots survive the fog. The Marshal's convoy sails.",
	phases: [
			fly("recon", "Find the depots through the fog", [[-520,250,-850],[520,250,-850]], 6, 2, 400,
				{ beat: "SERA: The fog depots carry his signature. Find them.", chatter: [{ at: 0.5, text: "SERA: Permits match. Every depot is fuel." }] }),
			ground("Destroy five fuel depots", 5, "SERA: Five depots in the fog. All marked.", { optionalRaiders: 2, reinforce: [{ at: 0.4, count: 2 }] }),
			fly("route", "Follow the empty fuel piers", [[-600,300,-1100],[600,320,-1300]], 0, 2, undefined,
				{ beat: "SERA: Follow the pier beacons. Check the whole fuel line is cut.", chatter: [{ at: 0.5, text: "SERA: West pier empty. Follow the lights to the east." }] }),
			air("Clear the fog patrol", 4, "SERA: Patrol riding the fog. Four, in two pairs.", { groups: 2, stagger: 18, flank: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("escort", "Cover the harbor inspection launch", [[-700,40,-1500],[600,40,-1600]], 40, 2, undefined,
				{ beat: "HARBOR: Cannot see the piers. Cover us while we check the hoses.", chatter: [{ at: 0.5, text: "HARBOR: Inspectors at the central pier. Fuel line looks dry." }] }),
			fly("recon", "Verify the last two fuel hoses are dry", [[-900,280,-1700],[1000,280,-1600]], 8, 2, 420,
				{ beat: "HARBOR: Scan the last two piers. We need proof every hose is dry.", chatter: [{ at: 0.5, text: "HARBOR: First hose disconnected. Check the eastern pier too." }] }),
			fly("signal", "Report the escape fleet is out of fuel", [[0,500,-1200]], 20, 1, undefined,
				{ beat: "HARBOR: Hoses dry. Hold the link for the frigates to copy.", chatter: [{ at: 0.5, text: "FRIGATE: Report copied. The escape fleet cannot refuel." }] }),
		],
	ground: [
			{ asset: "grain_silo", name: "FOG DEPOT 1", x: -520, z: -850 },
			{ asset: "grain_silo", name: "FOG DEPOT 2", x: -180, z: -1120 },
			{ asset: "grain_silo", name: "FOG DEPOT 3", x: 180, z: -1120 },
			{ asset: "grain_silo", name: "FOG DEPOT 4", x: 520, z: -850 },
			{ asset: "grain_silo", name: "FOG DEPOT 5", x: 0, z: -1480 },
		],
};
