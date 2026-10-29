import type { MissionBlueprint } from "../../shared/MissionCatalog";

export const mission: MissionBlueprint = {
	id: 1,
	act: 1,
	codename: "Rim Static",
	title: "FIRST FLIGHT",
	region: "canyon_airfield",
	environment: "canyon_noon",
	primary: "Complete flight training and repel a probing attack",
	briefing: "Trainee pilot checkout at Varda Rim. Turn and pitch, cycle to the training radar, lock and hit it, then intercept three bandits probing the rim.",
	debrief: "Varda Rim held. The quartermaster hands you a sealed case of your missing mentor's radio recordings.",
	failure: "The bandits reach the field. Varda Rim is grounded and Teal's recordings stay locked away.",
	phases: [
			{ execution: { minimumDwell: 2.5, movementDuration: 3, practice: true, hudPhase: "tutorial_move", objective: "Tap turn and pitch; release to hold, opposite input to level" }, kind: "tutorial_move", label: "Practice short turn and pitch taps", tutorialStep: "move", beat: "Tap turn and pitch briefly. Three seconds TOTAL each; impacts reset you." },
			{ execution: { minimumDwell: 2.5, practice: true, activatePracticeTarget: true, hudPhase: "tutorial_target", objective: "Press TGT to select the practice target" }, kind: "tutorial_target", label: "Cycle to the training target", tutorialStep: "target", beat: "Select radar: TGT / Tab / Y. Follow marker; turn back if you pass it." },
			{ execution: { minimumDwell: 2.5, practice: true, hudPhase: "tutorial_missile", objective: "Aim at the practice target, wait for lock, then fire a missile" }, kind: "tutorial_missile", label: "Lock and hit the training radar", tutorialStep: "missile", count: 1, beat: "Aim for LOCK, then FIRE / Space / RT. Pull up after firing." },
			{ execution: { launchDelay: 4, directSpawn: true, hudPhase: "tutorial_bandits", objective: "Live flight: select a bandit, aim for LOCK, fire; EVADE incoming missiles" }, kind: "required_air", label: "Intercept three bandits", count: 3, beat: "Bandits in 4s. Protection ends on arrival; impacts then fatal." },
		],
	ground: [{ asset: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
	legacy: 1,
};
