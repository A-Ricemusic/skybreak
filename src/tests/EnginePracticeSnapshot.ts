// Frozen origin/main catalog entry before engine batch A.
import type { MissionBlueprint } from "../shared/MissionCatalog";

export const mission: MissionBlueprint = {
	id: 0,
	act: 1,
	codename: "Rim Static",
	title: "Practice",
	region: "canyon_airfield",
	environment: "canyon_noon",
	primary: "Complete Teal's unsigned checkout",
	briefing: "Teal never signed your checkout. Fly the training pattern, practice the controls, then select and hit the training radar. No enemies.",
	debrief: "Checkout interrupted: six bombers are crossing the islands. Mission 1 is ready when you are.",
	failure: "The checkout can be flown again.",
	phases: [
			{ execution: { minimumDwell: 2.5, movementDuration: 3, practice: true, hudPhase: "tutorial_move", objective: "Tap turn and pitch; release to hold, opposite input to level" }, kind: "tutorial_move", label: "Practice short turn and pitch taps", tutorialStep: "move", beat: "Tap turn and pitch briefly. Three seconds TOTAL each; impacts reset you." },
			{ execution: { minimumDwell: 2.5, practice: true, activatePracticeTarget: true, hudPhase: "tutorial_target", objective: "Press TGT to select the practice target" }, kind: "tutorial_target", label: "Cycle to the training target", tutorialStep: "target", beat: "Select radar: TGT / Tab / Y. Follow marker; turn back if you pass it." },
			{ execution: { minimumDwell: 2.5, practice: true, hudPhase: "tutorial_missile", objective: "Aim at the practice target, wait for lock, then fire a missile" }, kind: "tutorial_missile", label: "Lock and hit the training radar", tutorialStep: "missile", count: 1, beat: "Aim for LOCK, then FIRE / Space / RT. Pull up after firing." },
		],
	ground: [{ asset: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
	legacy: 1,
};
