import type { MissionBlueprint } from "../MissionCatalog";
import { fly, air, ground } from "./Phases";

export const mission: MissionBlueprint = {
	id: 27,
	act: 3,
	codename: "Broken Relay",
	title: "BROKEN RELAY",
	region: "coastal_city",
	environment: "city_dawn",
	primary: "Confront the Air Marshal and finish the broadcast",
	briefing: "Clear Rusk's wing, cut his relay and defeat his last escort. Mark a safe landing strip, bring him down through three stages, climb Teal's beacon line and broadcast the evidence to the coast.",
	debrief: "Rusk is in custody on the marked road. The coast hears Teal's evidence in your voice: 'For Teal. For the rim.'",
	failure: "Rusk escapes. The coup survives, and Teal's evidence is never heard.",
	phases: [
			air("Clear the Marshal's wingmen", 2, "His wingmen first. Then him.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			ground("Destroy the final broadcast relay", 1, "SERA: His relay is still broadcasting. Cut it.", { optionalRaiders: 1,
				twist: { at: 1, text: "RUSK: You cut one relay. Every loyal pilot still hears me. On me, now.", insert: [
					air("Break the Marshal's personal escort", 2, "SERA: His last escort pair is forming on him. Clear them.", { flank: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			fly("recon", "Mark Rusk's emergency landing strip", [[500,300,-1200]], 9, 0, 450,
				{ beat: "MARINE: Mark the clear road below him. We need Rusk alive to answer.", chatter: [{ at: 0.5, text: "MARINE: Clear road marked. We are ready to take him into custody." }] }),
			{ kind: "ace", label: "Defeat the Air Marshal", optionalRaiders: 4, beat: "That's his jet. Teal's voice on his tapes. Bring him down." },
			fly("route", "Climb to Teal's clear broadcast line", [[-500,350,-800],[-400,420,-1000],[0,500,-1350]], 0, 0, undefined,
				{ beat: "SERA: Rusk is down. Follow three lights to Teal's broadcast line.", chatter: [{ at: 0.5, text: "SERA: One more light. Above it, the whole coast can hear you." }] }),
			fly("signal", "Broadcast Teal's evidence coastwide", [[0,500,-1350]], 60, 2, undefined,
				{ beat: "SERA: You're on every frequency. Say it your way.", chatter: [{ at: 0.3, text: "SERA: Last of his diehards. Keep them off the signal." }, { at: 0.6, text: "HARBOR: Loyalist pilots answering. Every harbor." }], reinforce: [{ at: 0.3, count: 2 }] }),
		],
	ground: [{ asset: "comms_relay", name: "MARSHAL RELAY", x: 0, z: -1350 }],
	aceHealth: 320,
	aceName: "AIR MARSHAL RUSK",
	aceStages: ["RUSK: Every relay says I am the law. Yours is a child's radio. Wing!", "RUSK: Teal obeyed until the one order that mattered. Wing, finish him."],
	aceReturns: ["SERA: Rusk is turning back in. Here he comes.", "RUSK: Then hear it from me. Head on."],
};
