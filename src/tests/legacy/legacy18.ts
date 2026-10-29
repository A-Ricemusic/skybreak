import type { MissionBlueprint } from "../../shared/MissionCatalog";
import { fly, air } from "../../shared/missions/Phases";

export const mission: MissionBlueprint = {
	id: 18,
	act: 2,
	codename: "Ridge Ace",
	title: "RIDGE ACE",
	region: "plateau_relay",
	environment: "relay_night",
	primary: "Close act two against the plateau ace",
	briefing: "Climb into Vulture Two's lights and mark a safe pickup site before clearing his wingmen. Defeat him through three stages, protect the marines' recovery, and relay his testimony to the coast.",
	debrief: "The marines recover Vulture Two alive from the ridge. His recorded testimony reaches the coast before the next strike.",
	failure: "Vulture Two holds the plateau. The road to the coast stays shut.",
	phases: [
			fly("route", "Climb into Vulture Two's searchlights", [[-500,350,-250],[0,600,-1100],[600,650,-1550]], 0, 0, undefined,
				{ beat: "VULTURE TWO: Climb into my lights, trainee.", chatter: [{ at: 0.66, text: "VULTURE TWO: Teal climbed faster. Show me more." }] }),
			fly("recon", "Mark a safe ridge pickup site", [[400,300,-1400]], 7, 0, 450,
				{ beat: "MARINE: Mark a clear pickup site. We need his answers alive.", chatter: [{ at: 0.5, text: "MARINE: Ridge landing zone clear. We can bring a helo there." }] }),
			air("Clear his wingmen", 4, "SERA: His wingmen first. Four, in pairs.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			{ kind: "ace", label: "Defeat Vulture Two", optionalRaiders: 2, beat: "He flies like Teal. Teal learned it from him.",
				twist: { at: 1, text: "SERA: Chute open. His wing is turning back. Cover the marines' pickup.", insert: [
					fly("defend", "Protect the marines' pickup on the ridge", [[400,320,-1400]], 45, 4, undefined,
						{ beat: "MARINE: We have him. Forty-five seconds to get him off the ridge.", chatter: [{ at: 0.5, text: "SERA: His second pair is diving on the pickup. Hold them." }, { at: 0.85, text: "MARINE: Helo's spinning up. Almost out." }], reinforce: [{ at: 0.5, count: 2 }] }),
				] } },
			fly("signal", "Relay Vulture Two's testimony", [[0,500,-1100]], 20, 0, undefined,
				{ beat: "MARINE: He is talking. Coast is recording. Hold the link.", chatter: [{ at: 0.5, text: "MARINE: He admits the handwriting. Coast is recording every word." }] }),
		],
	ground: [],
	aceHealth: 260,
	aceName: "VULTURE TWO",
	aceStages: ["VULTURE TWO: I taught him that turn. Wing, show the trainee the answer.", "VULTURE TWO: Last lesson. Wing, keep him busy."],
	aceReturns: ["VULTURE TWO: Now. Again, trainee. From the top.", "VULTURE TWO: Head on. The way Teal never would."],
};
