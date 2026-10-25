// Aurora Line campaign manifest.
//
// A courier squadron maintains a humanitarian corridor through a polar war and
// exposes a false ceasefire. Snow coast, aurora nights, volcanic refuges,
// glaciers and ports. Mission 01 (FIRST FLIGHT) and Mission 02 (IRON COAST) are
// retained bit-identical to the previous two-mission campaign; every objective
// gate, enemy count, ace health and win condition for those two sorties stays
// server-authoritative and is covered by the preserved MissionRules tests.
//
// This file is pure static data. Validation lives in `src/shared/MissionRules.ts`
// and the asset budget is enforced by the ObjectiveChain contract.

export type MissionTheme =
	| "training_coast" // Mission 01 preserved
	| "iron_coast" // Mission 02 preserved
	| "snow_coast"
	| "aurora_night"
	| "volcanic_refuge"
	| "glacier"
	| "port"
	| "polar_sea"
	| "evacuation_run"
	| "ceasefire_truth";

export type ObjectiveKind =
	| "tutorial_move" // Mission 01 only: observe pitch+turn via controls.
	| "tutorial_target" // Mission 01 only: a real CycleTarget event with lock available.
	| "tutorial_missile" // Mission 01 only: destroy one Blender radar with a missile.
	| "intercept" // Destroy N required bandits.
	| "strike" // Destroy N required ground targets.
	| "escort" // Keep a friendly convoy alive to its waypoint while clearing escorts.
	| "protect" // Defend a static site: destroy incoming required bandit waves.
	| "ace"; // Boss encounter: destroy one accelerated enemy.

export interface ObjectiveStep {
	readonly kind: ObjectiveKind;
	readonly required: number; // 1 for tutorial/ace, N for the others.
	readonly label: string; // Short HUD line, server-authoritative.
}

export interface MissionEnvironment {
	readonly theme: MissionTheme;
	readonly clockTime: number; // 0..24
	readonly fogColor: [number, number, number];
	readonly fogDecay: [number, number, number];
	readonly fogDensity: number;
	readonly cloudCover: number;
	readonly cloudColor: [number, number, number];
	readonly oceanColor: [number, number, number];
	readonly oceanReflectance: number;
	readonly outdoorAmbient: [number, number, number];
	readonly ambient: [number, number, number];
	readonly auroraBand?: readonly [number, number, number];
	readonly volcanicGlow?: readonly [number, number, number];
}

export interface MissionPlan {
	readonly id: number;
	readonly codename: string;
	readonly operation: string;
	readonly summary: string;
	readonly environment: MissionEnvironment;
	readonly steps: readonly ObjectiveStep[];
	readonly groundTargets: {
		readonly asset: "Radar" | "Warehouse" | "AuroraBeacon" | "SupplyConvoy";
		readonly count: number;
	};
	readonly aceHealth: number; // Only applied when the mission ends with an ace step.
	readonly aceDesignation: string;
	readonly briefing: string; // Shown on the mission select / briefing screen.
	readonly debrief: {
		readonly victory: string;
		readonly defeat: string;
	};
}

export interface CutsceneBeat {
	readonly duration: number;
	readonly cameraKeyframes: readonly {
		readonly position: readonly [number, number, number];
		readonly lookAt: readonly [number, number, number];
	}[];
	readonly subtitle: string;
	readonly speaker: string;
	readonly actorTint?: readonly [number, number, number];
}

export interface Cutscene {
	readonly id: string;
	readonly kind: "opening" | "interstitial" | "finale";
	readonly actOf: number | "prologue" | "epilogue";
	readonly environmentPreview: MissionEnvironment;
	readonly beats: readonly CutsceneBeat[];
	/** When true, this cutscene plays only the very first time the next mission is launched. */
	readonly firstTimeOnly: boolean;
}

const BASE_DAY: MissionEnvironment = {
	theme: "training_coast",
	clockTime: 10.5,
	fogColor: [0.72, 0.86, 0.92],
	fogDecay: [0.43, 0.56, 0.64],
	fogDensity: 0.23,
	cloudCover: 0.22,
	cloudColor: [0.93, 0.95, 0.95],
	oceanColor: [0.14, 0.45, 0.57],
	oceanReflectance: 0.14,
	outdoorAmbient: [0.55, 0.59, 0.62],
	ambient: [0.41, 0.46, 0.52],
};
const IRON_COAST_DUSK: MissionEnvironment = {
	...BASE_DAY,
	theme: "iron_coast",
	clockTime: 17.1,
	fogColor: [0.89, 0.79, 0.67],
	fogDecay: [0.43, 0.56, 0.64],
	fogDensity: 0.27,
	cloudCover: 0.38,
	cloudColor: [0.93, 0.95, 0.95],
	oceanColor: [0.16, 0.33, 0.43],
	oceanReflectance: 0.1,
};
const SNOW_MORNING: MissionEnvironment = {
	theme: "snow_coast",
	clockTime: 8.4,
	fogColor: [0.84, 0.9, 0.94],
	fogDecay: [0.5, 0.59, 0.68],
	fogDensity: 0.3,
	cloudCover: 0.45,
	cloudColor: [0.95, 0.97, 1],
	oceanColor: [0.09, 0.3, 0.38],
	oceanReflectance: 0.08,
	outdoorAmbient: [0.6, 0.65, 0.69],
	ambient: [0.43, 0.49, 0.56],
};
const SNOW_STORM: MissionEnvironment = {
	...SNOW_MORNING,
	clockTime: 11.2,
	fogDensity: 0.42,
	cloudCover: 0.72,
	fogColor: [0.74, 0.78, 0.82],
	oceanColor: [0.08, 0.21, 0.3],
};
const AURORA_NIGHT: MissionEnvironment = {
	theme: "aurora_night",
	clockTime: 22.5,
	fogColor: [0.08, 0.19, 0.33],
	fogDecay: [0.14, 0.2, 0.35],
	fogDensity: 0.3,
	cloudCover: 0.15,
	cloudColor: [0.26, 0.33, 0.46],
	oceanColor: [0.04, 0.09, 0.18],
	oceanReflectance: 0.26,
	outdoorAmbient: [0.21, 0.26, 0.38],
	ambient: [0.1, 0.15, 0.28],
	auroraBand: [0.37, 0.98, 0.69],
};
const AURORA_LATE: MissionEnvironment = {
	...AURORA_NIGHT,
	clockTime: 2.6,
	auroraBand: [0.45, 0.6, 1],
	cloudCover: 0.08,
};
const VOLCANIC_REFUGE: MissionEnvironment = {
	theme: "volcanic_refuge",
	clockTime: 19.3,
	fogColor: [0.5, 0.3, 0.22],
	fogDecay: [0.26, 0.16, 0.1],
	fogDensity: 0.3,
	cloudCover: 0.55,
	cloudColor: [0.42, 0.35, 0.37],
	oceanColor: [0.11, 0.08, 0.1],
	oceanReflectance: 0.26,
	outdoorAmbient: [0.4, 0.28, 0.26],
	ambient: [0.28, 0.17, 0.17],
	volcanicGlow: [1, 0.52, 0.24],
};
const GLACIER: MissionEnvironment = {
	theme: "glacier",
	clockTime: 14.1,
	fogColor: [0.75, 0.86, 0.96],
	fogDecay: [0.55, 0.68, 0.84],
	fogDensity: 0.26,
	cloudCover: 0.3,
	cloudColor: [0.95, 0.97, 1],
	oceanColor: [0.19, 0.42, 0.58],
	oceanReflectance: 0.18,
	outdoorAmbient: [0.6, 0.68, 0.74],
	ambient: [0.4, 0.5, 0.58],
};
const PORT_DAY: MissionEnvironment = {
	theme: "port",
	clockTime: 9.5,
	fogColor: [0.74, 0.81, 0.85],
	fogDecay: [0.4, 0.5, 0.56],
	fogDensity: 0.22,
	cloudCover: 0.34,
	cloudColor: [0.88, 0.9, 0.92],
	oceanColor: [0.16, 0.37, 0.46],
	oceanReflectance: 0.13,
	outdoorAmbient: [0.55, 0.58, 0.6],
	ambient: [0.4, 0.44, 0.49],
};
const POLAR_SEA: MissionEnvironment = {
	theme: "polar_sea",
	clockTime: 12.6,
	fogColor: [0.68, 0.76, 0.84],
	fogDecay: [0.4, 0.48, 0.6],
	fogDensity: 0.3,
	cloudCover: 0.55,
	cloudColor: [0.82, 0.86, 0.9],
	oceanColor: [0.08, 0.22, 0.31],
	oceanReflectance: 0.22,
	outdoorAmbient: [0.5, 0.56, 0.63],
	ambient: [0.35, 0.4, 0.47],
};
const EVACUATION_RUN: MissionEnvironment = {
	...SNOW_MORNING,
	theme: "evacuation_run",
	clockTime: 7.2,
	fogDensity: 0.33,
	cloudCover: 0.38,
};
const CEASEFIRE_TRUTH: MissionEnvironment = {
	theme: "ceasefire_truth",
	clockTime: 5.4,
	fogColor: [0.6, 0.47, 0.52],
	fogDecay: [0.25, 0.21, 0.3],
	fogDensity: 0.3,
	cloudCover: 0.4,
	cloudColor: [0.72, 0.66, 0.68],
	oceanColor: [0.14, 0.18, 0.28],
	oceanReflectance: 0.2,
	outdoorAmbient: [0.49, 0.42, 0.48],
	ambient: [0.3, 0.26, 0.34],
	auroraBand: [0.9, 0.5, 0.78],
};

// Preserved mission plans. Changing step shape or counts here breaks preserved tests.
const MISSION_01: MissionPlan = {
	id: 1,
	codename: "FIRST FLIGHT",
	operation: "Operation Aurora Line — Prologue",
	summary: "Pitch, turn, and run a practice intercept at Lantern Reef.",
	environment: { ...BASE_DAY },
	steps: [
		{ kind: "tutorial_move", required: 1, label: "Turn and pitch using the flight controls" },
		{ kind: "tutorial_target", required: 1, label: "Cycle target to select the practice target" },
		{ kind: "tutorial_missile", required: 1, label: "Aim at the practice target, wait for lock, then fire a missile" },
		{ kind: "intercept", required: 3, label: "Destroy all three required bandits" },
	],
	groundTargets: { asset: "Radar", count: 1 },
	aceHealth: 0,
	aceDesignation: "",
	briefing: "Qualify as a Line pilot. Prove pitch and turn, select the practice radar, destroy it with a missile, then repel the three bandits probing the training coast.",
	debrief: {
		victory: "Signed off by the airbase. Lantern Reef is clear. The Line extends north.",
		defeat: "Training washout. The instructors will ground any pilot who fails Lantern Reef.",
	},
};
const MISSION_02: MissionPlan = {
	id: 2,
	codename: "IRON COAST",
	operation: "Operation Aurora Line — Opening Push",
	summary: "Break the coastal strike force protecting a Volkov supply depot.",
	environment: IRON_COAST_DUSK,
	steps: [
		{ kind: "intercept", required: 3, label: "Destroy all three required bandits" },
		{ kind: "strike", required: 5, label: "Destroy all five warehouses; fighters are optional threats" },
		{ kind: "ace", required: 1, label: "Destroy the ace; surviving fighters remain dangerous" },
	],
	groundTargets: { asset: "Warehouse", count: 5 },
	aceHealth: 165,
	aceDesignation: "VANTA ACE",
	briefing: "Intercept three required bandits, destroy five coastal warehouses while optional attackers pursue, then defeat the faster armored ace. Optional attackers may remain in the fight.",
	debrief: {
		victory: "Depot gone. Civilian trucks cross the coast road at dawn.",
		defeat: "The depot held. The Line falls back and the trucks stay south.",
	},
};

const planFor = (
	id: number,
	codename: string,
	operation: string,
	theme: MissionEnvironment,
	steps: readonly ObjectiveStep[],
	ground: MissionPlan["groundTargets"],
	ace: { health: number; designation: string },
	story: { summary: string; briefing: string; victory: string; defeat: string },
): MissionPlan => ({
	id,
	codename,
	operation,
	summary: story.summary,
	environment: theme,
	steps,
	groundTargets: ground,
	aceHealth: ace.health,
	aceDesignation: ace.designation,
	briefing: story.briefing,
	debrief: { victory: story.victory, defeat: story.defeat },
});

// Mission 03..27. Each adds one Aurora Line act, mixing escort/protect/intercept/strike
// variety; the ace designations build a recurring antagonist stack that pays off at the
// finale. Enemy counts, required ground, and ace health escalate but stay well within
// the 600-second budget established by Mission 02.
const AURORA_PLANS: readonly MissionPlan[] = [
	planFor(3, "WHITE HARBOR", "Act I — Snow Coast",
		SNOW_MORNING,
		[
			{ kind: "intercept", required: 2, label: "Clear the two scouts over White Harbor" },
			{ kind: "escort", required: 3, label: "Keep the aid trucks moving: destroy three strafing fighters" },
			{ kind: "strike", required: 2, label: "Silence the two shore batteries" },
		],
		{ asset: "AuroraBeacon", count: 2 },
		{ health: 0, designation: "" },
		{
			summary: "A relief column needs air cover across the frozen harbor.",
			briefing: "The first Aurora Line column reaches White Harbor at first light. Clear the scouts, keep the trucks alive on the ice road, and silence two shore batteries before Volkov redirects artillery.",
			victory: "Food reaches the inland camp. White Harbor celebrates with lamps along the ice road.",
			defeat: "The trucks turn back. The inland camp will not eat tonight.",
		}),
	planFor(4, "GLASS BLUFF", "Act I — Snow Coast",
		SNOW_STORM,
		[
			{ kind: "intercept", required: 3, label: "Intercept the three storm-cloaked bandits" },
			{ kind: "strike", required: 3, label: "Destroy the fuel depots feeding the raiders" },
		],
		{ asset: "Warehouse", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Blizzard raid breaks the sightlines; the Line pushes through anyway.",
			briefing: "A storm has grounded Volkov radar. Punch through the whiteout, down the three bandits waiting to ambush aid flights, then wreck the three forward depots keeping their raiders fueled.",
			victory: "Volkov loses a quarter of its coastal fuel. Aurora Line convoys gain two uncontested nights.",
			defeat: "Volkov keeps fuel. The storm becomes their shield for another week.",
		}),
	planFor(5, "LANTERN RUN", "Act I — Snow Coast",
		AURORA_NIGHT,
		[
			{ kind: "escort", required: 4, label: "Clear four strafing bandits off the lantern convoy" },
			{ kind: "intercept", required: 1, label: "Shoot down the rear-guard interceptor" },
		],
		{ asset: "AuroraBeacon", count: 2 },
		{ health: 0, designation: "" },
		{
			summary: "A night escort for the lantern convoy under the first aurora.",
			briefing: "Civilians run supplies by lantern. Keep four strafing bandits off them, then nail the lone interceptor coming in behind the formation.",
			victory: "The lantern convoy reaches the fishing town. Children sleep behind a wall of warm windows.",
			defeat: "The convoy scatters. The lanterns go out one by one along the fjord.",
		}),
	planFor(6, "COLD CATHEDRAL", "Act I — Snow Coast",
		AURORA_NIGHT,
		[
			{ kind: "intercept", required: 3, label: "Intercept the three bandits circling the cathedral" },
			{ kind: "protect", required: 3, label: "Defend the refuge: destroy three attackers before they reach it" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign KITE" },
		],
		{ asset: "AuroraBeacon", count: 3 },
		{ health: 150, designation: "KITE" },
		{
			summary: "A medic post inside the ruined cathedral is under aerial attack.",
			briefing: "A cathedral-turned-field-hospital broadcast an open channel plea. Clear the three circling bandits, hold off three attack passes, and down the Volkov hunter KITE before he burns the cathedral.",
			victory: "KITE goes down over the ice. The cathedral keeps its lights on until dawn.",
			defeat: "KITE breaks the roof. The field hospital evacuates into a storm.",
		}),
	planFor(7, "ICEBREAKER", "Act I — Snow Coast",
		POLAR_SEA,
		[
			{ kind: "escort", required: 2, label: "Clear two spotter planes above the icebreaker" },
			{ kind: "strike", required: 4, label: "Destroy the four hostile icebreaker tenders" },
			{ kind: "intercept", required: 2, label: "Intercept the retaliation flight" },
		],
		{ asset: "Warehouse", count: 4 },
		{ health: 0, designation: "" },
		{
			summary: "Clear the channel so the humanitarian icebreaker can pass.",
			briefing: "The civilian icebreaker PETREL must reach the northern coast. Clear two Volkov spotters, destroy the four armed tenders blocking the channel, then intercept the two retaliation fighters.",
			victory: "PETREL punches through. Three fishing villages come back onto the Line.",
			defeat: "PETREL turns around. The villages stay dark.",
		}),
	planFor(8, "AURORA FENCE", "Act II — Aurora Nights",
		AURORA_LATE,
		[
			{ kind: "intercept", required: 4, label: "Shoot down four Volkov scouts on the aurora corridor" },
			{ kind: "strike", required: 3, label: "Destroy three jamming beacons under the aurora" },
		],
		{ asset: "AuroraBeacon", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Night fighters are using the aurora as a visual fence.",
			briefing: "Volkov is using jamming beacons under the aurora to break the Line's night radios. Clear the four scouts guarding them, then destroy all three beacons.",
			victory: "The Aurora Fence falls. Open channels return across half the pole.",
			defeat: "The fence stays up. Aurora Line pilots fly blind on their own channels.",
		}),
	planFor(9, "CORRIDOR WATCH", "Act II — Aurora Nights",
		AURORA_NIGHT,
		[
			{ kind: "protect", required: 4, label: "Hold the corridor: destroy four waves of two bandits" },
			{ kind: "intercept", required: 2, label: "Hunt the two long-range marauders" },
		],
		{ asset: "AuroraBeacon", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Static corridor defense against repeated waves.",
			briefing: "The aid corridor is a straight line; the enemy walks waves across it. Destroy four attacking bandits before any pass completes, then run down the two marauders attempting a late sweep.",
			victory: "The corridor stays open for forty-eight hours.",
			defeat: "The corridor collapses. Aurora Line replots everything through the sea.",
		}),
	planFor(10, "FLARE WATCH", "Act II — Aurora Nights",
		AURORA_LATE,
		[
			{ kind: "escort", required: 3, label: "Clear three strafers off the hospital flight" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign EMBER" },
		],
		{ asset: "AuroraBeacon", count: 2 },
		{ health: 155, designation: "EMBER" },
		{
			summary: "Night escort for a hospital flight tagged by a Volkov ace.",
			briefing: "A hospital transport takes off at 02:00. Clear three strafers off its back, then down EMBER before he catches the transport over open water.",
			victory: "The transport lands and the burn unit opens an hour later.",
			defeat: "EMBER walks away. The burn unit never opens.",
		}),
	planFor(11, "FALSE PEACE", "Act II — Aurora Nights",
		CEASEFIRE_TRUTH,
		[
			{ kind: "intercept", required: 4, label: "Shoot down four bandits violating the ceasefire" },
			{ kind: "strike", required: 2, label: "Destroy the two illegal radar sites" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign CROWN" },
		],
		{ asset: "Radar", count: 2 },
		{ health: 160, designation: "CROWN" },
		{
			summary: "The ceasefire is a lie. Prove it.",
			briefing: "Volkov claims a ceasefire while launching flights at dawn. Shoot down the four violating bandits, destroy two illegal radars, and bring down the ace CROWN. Aurora Line will publish gun camera footage.",
			victory: "The false peace collapses. The Line's politicians stop pretending.",
			defeat: "The lie survives. Aid flights are grounded for a week.",
		}),
	planFor(12, "VOLCANIC WATCH", "Act III — Volcanic Refuges",
		VOLCANIC_REFUGE,
		[
			{ kind: "escort", required: 3, label: "Clear three attackers off the volcanic refuge convoy" },
			{ kind: "strike", required: 3, label: "Destroy three Volkov forward supply dumps" },
		],
		{ asset: "SupplyConvoy", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Refugees are living inside a volcanic caldera. Supply them.",
			briefing: "The Line parks a convoy inside a volcanic caldera for warmth. Clear three attackers above the ash field, then destroy three Volkov forward supply dumps on the ridgeline.",
			victory: "The caldera camp eats and sleeps for a week.",
			defeat: "The caldera camp loses two trucks. The commander resigns.",
		}),
	planFor(13, "ASH VEIL", "Act III — Volcanic Refuges",
		VOLCANIC_REFUGE,
		[
			{ kind: "intercept", required: 3, label: "Intercept three bandits using the ash plume as cover" },
			{ kind: "protect", required: 2, label: "Protect the refuge: destroy two attack runs" },
		],
		{ asset: "SupplyConvoy", count: 2 },
		{ health: 0, designation: "" },
		{
			summary: "Enemy fighters hide inside the ash plume.",
			briefing: "Volkov is launching inside the ash plume. Clear three bandits in the veil, then stop two attack passes on the volcanic refuge camp.",
			victory: "The ash plume stops being cover. Aurora Line can read it clean.",
			defeat: "Volkov keeps the plume. Flights route around for weeks.",
		}),
	planFor(14, "VENT RUN", "Act III — Volcanic Refuges",
		VOLCANIC_REFUGE,
		[
			{ kind: "escort", required: 4, label: "Clear four attackers off the vent-run truck column" },
			{ kind: "strike", required: 3, label: "Destroy three steam-well pumping stations" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign CINDER" },
		],
		{ asset: "SupplyConvoy", count: 3 },
		{ health: 158, designation: "CINDER" },
		{
			summary: "Night escort across the geothermal vents.",
			briefing: "A truck column has to cross the vents at night. Clear four attackers, destroy three Volkov steam-well stations, then shoot down CINDER before he catches the trucks on the open vent plain.",
			victory: "The column reaches the next camp. CINDER goes down into the vents.",
			defeat: "The column loses half its trucks. CINDER escapes to the next mission.",
		}),
	planFor(15, "FORGE LIGHT", "Act III — Volcanic Refuges",
		VOLCANIC_REFUGE,
		[
			{ kind: "intercept", required: 4, label: "Clear four bandits from the forge airspace" },
			{ kind: "strike", required: 4, label: "Destroy four weapon forges" },
		],
		{ asset: "Warehouse", count: 4 },
		{ health: 0, designation: "" },
		{
			summary: "Volkov is forging weapons inside a volcanic refuge.",
			briefing: "Volkov has turned a volcanic refuge into a weapons forge. Clear four bandits over the mouth of the caldera, then destroy four weapon forges inside it.",
			victory: "The forge is cold. Volkov's next quarter of weapons never ships.",
			defeat: "The forge keeps running. The next three missions will be harder.",
		}),
	planFor(16, "GLACIER MARCH", "Act IV — Glacier Front",
		GLACIER,
		[
			{ kind: "escort", required: 3, label: "Clear three attackers off the glacier march" },
			{ kind: "intercept", required: 3, label: "Intercept three high-altitude bandits" },
		],
		{ asset: "SupplyConvoy", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "A civilian march crosses the glacier under threat.",
			briefing: "Three thousand civilians march across the glacier for the aid camp on the far ridge. Clear three attackers on the deck, intercept three bandits on the high line.",
			victory: "The march completes. The ridge camp doubles in size.",
			defeat: "The march scatters on the glacier. Hundreds of names enter the Line's missing book.",
		}),
	planFor(17, "WHITE WALL", "Act IV — Glacier Front",
		GLACIER,
		[
			{ kind: "intercept", required: 3, label: "Clear three ice-wall scouts" },
			{ kind: "strike", required: 4, label: "Destroy four reinforced ice-wall batteries" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign KITE RETURN" },
		],
		{ asset: "Warehouse", count: 4 },
		{ health: 162, designation: "KITE RETURN" },
		{
			summary: "Volkov carved batteries into the glacier wall.",
			briefing: "Volkov cut gun emplacements into the glacier wall. Clear three scouts, destroy four reinforced batteries, then bring down KITE's return flight. His call sign was retired. He came back.",
			victory: "The ice wall opens. The glacier front becomes a corridor.",
			defeat: "The ice wall holds. The glacier front stays closed.",
		}),
	planFor(18, "CROSSING", "Act IV — Glacier Front",
		GLACIER,
		[
			{ kind: "escort", required: 4, label: "Clear four hostile fighters off the glacier crossing" },
			{ kind: "protect", required: 3, label: "Protect the beacon field: destroy three attack passes" },
		],
		{ asset: "AuroraBeacon", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Field hospital crosses the glacier.",
			briefing: "A field hospital is driving onto the glacier. Clear four attackers from the crossing, hold three attack passes on the beacon field marking the safe route.",
			victory: "The field hospital crosses and sets up. The ridge gets its surgeons.",
			defeat: "The hospital stalls. Volkov will reach the ridge first.",
		}),
	planFor(19, "SILENCE LINE", "Act IV — Glacier Front",
		GLACIER,
		[
			{ kind: "strike", required: 4, label: "Destroy four Volkov deep-ice listening posts" },
			{ kind: "intercept", required: 3, label: "Intercept three fast interceptors" },
		],
		{ asset: "Warehouse", count: 4 },
		{ health: 0, designation: "" },
		{
			summary: "Deep-ice listening posts track every Aurora Line flight.",
			briefing: "Deep-ice listening posts have been tracking every Line flight for three months. Destroy four of them under cover of the glacier, then intercept three fast fighters sent to defend them.",
			victory: "The silence line falls. Volkov loses its map of our flights.",
			defeat: "The silence line holds. Flights get ambushed inside their own corridor.",
		}),
	planFor(20, "COLD CROWN", "Act IV — Glacier Front",
		GLACIER,
		[
			{ kind: "intercept", required: 4, label: "Clear four high-altitude escorts" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign CROWN RETURN" },
		],
		{ asset: "AuroraBeacon", count: 2 },
		{ health: 170, designation: "CROWN RETURN" },
		{
			summary: "The ace CROWN returns, this time with escorts.",
			briefing: "CROWN was reported killed. He's back with four escorts over the glacier. Clear the escorts, then take CROWN out again before Aurora Line's politicians see him flying over the capital.",
			victory: "CROWN never flies again.",
			defeat: "CROWN disappears. Volkov state TV runs the footage for a week.",
		}),
	planFor(21, "PORT NIGHT", "Act V — Northern Port",
		PORT_DAY,
		[
			{ kind: "intercept", required: 3, label: "Clear three bandits over the port" },
			{ kind: "strike", required: 5, label: "Destroy five Volkov warehouses on the pier" },
		],
		{ asset: "Warehouse", count: 5 },
		{ health: 0, designation: "" },
		{
			summary: "The northern port is choking on Volkov inventory.",
			briefing: "The northern port holds half the fish the pole eats. Clear three bandits, then destroy five Volkov warehouses on the pier so the fish boats can dock.",
			victory: "The pier opens. The port runs again.",
			defeat: "The pier stays closed. The pole runs short on fish for a month.",
		}),
	planFor(22, "BLACK WATER", "Act V — Northern Port",
		PORT_DAY,
		[
			{ kind: "escort", required: 3, label: "Clear three attackers off the hospital ship" },
			{ kind: "strike", required: 3, label: "Destroy three dockside flak emplacements" },
			{ kind: "intercept", required: 2, label: "Shoot down two late interceptors" },
		],
		{ asset: "Warehouse", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "Hospital ship AURORA LINE 1 docks under fire.",
			briefing: "The hospital ship AURORA LINE 1 docks today. Clear three attackers above it, destroy three flak emplacements on the dock, then intercept two late interceptors.",
			victory: "AURORA LINE 1 docks. Three thousand people get real surgery.",
			defeat: "AURORA LINE 1 pulls back out to sea. The pole hates the Line for a decade.",
		}),
	planFor(23, "GOLD HOUR", "Act V — Northern Port",
		PORT_DAY,
		[
			{ kind: "protect", required: 4, label: "Hold the port: destroy four attack passes" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign EMBER RETURN" },
		],
		{ asset: "AuroraBeacon", count: 3 },
		{ health: 168, designation: "EMBER RETURN" },
		{
			summary: "EMBER is back for the port. Deny him.",
			briefing: "EMBER walked away over the aurora. He's back for the northern port. Hold the port against four attack passes, then take him down before the sun sets on the pier.",
			victory: "EMBER goes down into the port water. The pier watches it happen.",
			defeat: "EMBER escapes the port, again.",
		}),
	planFor(24, "LAST CORRIDOR", "Act VI — Humanitarian Finale",
		EVACUATION_RUN,
		[
			{ kind: "escort", required: 5, label: "Clear five attackers off the evacuation convoy" },
			{ kind: "protect", required: 3, label: "Hold the corridor: destroy three attack passes" },
		],
		{ asset: "SupplyConvoy", count: 4 },
		{ health: 0, designation: "" },
		{
			summary: "The last Aurora Line evacuation convoy forms up.",
			briefing: "The Line is evacuating the last civilian camp. Clear five attackers off the convoy, then hold the corridor against three attack passes before Volkov cuts the only road.",
			victory: "The last convoy clears. The camp evacuates clean.",
			defeat: "The convoy is cut. Three hundred names enter the missing book.",
		}),
	planFor(25, "SKY TRIAL", "Act VI — Humanitarian Finale",
		EVACUATION_RUN,
		[
			{ kind: "intercept", required: 5, label: "Shoot down five war-crimes trial escorts" },
			{ kind: "strike", required: 3, label: "Destroy three Volkov propaganda transmitters" },
		],
		{ asset: "Radar", count: 3 },
		{ health: 0, designation: "" },
		{
			summary: "A trial convoy carries evidence south. Protect it in the air.",
			briefing: "A convoy carrying the war-crimes evidence drives south. Clear five escorts in the air, destroy three Volkov propaganda transmitters, and the evidence reaches the court.",
			victory: "The evidence reaches the court. The trial opens on schedule.",
			defeat: "The evidence is lost. The war-crimes trial is postponed indefinitely.",
		}),
	planFor(26, "AURORA GATE", "Act VI — Humanitarian Finale",
		CEASEFIRE_TRUTH,
		[
			{ kind: "intercept", required: 4, label: "Clear four high-altitude bandits above Aurora Gate" },
			{ kind: "strike", required: 4, label: "Destroy the four reactor-shed sites" },
			{ kind: "ace", required: 1, label: "Down the Volkov hunter — Call sign CINDER RETURN" },
		],
		{ asset: "Warehouse", count: 4 },
		{ health: 172, designation: "CINDER RETURN" },
		{
			summary: "Aurora Gate: the central Volkov forward base.",
			briefing: "Aurora Gate is Volkov's central forward base. Clear four high-altitude bandits, destroy four reactor-shed sites, then down CINDER one more time. The Line will not have to fly here again.",
			victory: "Aurora Gate burns. CINDER goes down with it. The Line can see the finale.",
			defeat: "Aurora Gate holds. The Line's reserves start to crack.",
		}),
	planFor(27, "AURORA LINE", "Act VI — Finale",
		CEASEFIRE_TRUTH,
		[
			{ kind: "intercept", required: 5, label: "Clear five Volkov elites over the Line" },
			{ kind: "escort", required: 3, label: "Keep the ceasefire convoy alive: destroy three attackers" },
			{ kind: "strike", required: 3, label: "Destroy the three Volkov signal radars broadcasting the lie" },
			{ kind: "ace", required: 1, label: "Down the Volkov Marshal — Call sign AURORA ZERO" },
		],
		{ asset: "Warehouse", count: 3 },
		{ health: 185, designation: "AURORA ZERO" },
		{
			summary: "The ceasefire's architect reveals himself and takes to the sky.",
			briefing: "The Volkov Marshal who authored the false ceasefire is in the air today, personally. Clear five elites, keep the ceasefire-breaker convoy alive against three attackers, destroy three signal radars broadcasting the lie, and down AURORA ZERO. The Line ends here.",
			victory: "AURORA ZERO goes down over his own line. The Aurora Line closes. The truth broadcasts clean.",
			defeat: "The Marshal escapes. The Aurora Line is retired without a conclusion.",
		}),
];

export const AuroraLineManifest = {
	MissionCount: 27,
	SaveVersion: 3,
	Plans: [MISSION_01, MISSION_02, ...AURORA_PLANS] as readonly MissionPlan[],
	GetPlan(id: number): MissionPlan {
		const plan = AuroraLineManifest.Plans[id - 1];
		assert(plan !== undefined && plan.id === id, `Unknown mission id ${id}`);
		return plan;
	},
};

// A compact table of story-complete cutscenes between every mission.
// Each cutscene is one or more beats; a beat is a camera arc and a subtitle.
// Positions are in studs, matched to the cutscene stage built in the menu world.
const beat = (
	duration: number,
	position: readonly [number, number, number],
	lookAt: readonly [number, number, number],
	speaker: string,
	subtitle: string,
	actorTint?: readonly [number, number, number],
): CutsceneBeat => ({
	duration,
	cameraKeyframes: [
		{ position, lookAt },
		{
			position: [position[0] + 8, position[1] + 2, position[2] + 8],
			lookAt: [lookAt[0], lookAt[1], lookAt[2]],
		},
	],
	subtitle,
	speaker,
	actorTint,
});

const CUTSCENES_LIST: readonly Cutscene[] = [
	// Prologue: before Mission 01
	{
		id: "cs_prologue",
		kind: "opening",
		actOf: "prologue",
		environmentPreview: BASE_DAY,
		firstTimeOnly: true,
		beats: [
			beat(4, [60, 50, 60], [0, 25, 0], "LINE OPERATIONS", "The courier squadron Aurora Line keeps a humanitarian corridor open across a polar war."),
			beat(4, [40, 40, -40], [0, 25, 0], "INSTRUCTOR MIRA", "You are the newest Line pilot. The training coast is quiet. Hopefully."),
			beat(3, [-50, 60, 20], [0, 25, 0], "LINE OPERATIONS", "Qualify at Lantern Reef. Then the Line goes north."),
		],
	},
	// After each mission: one interstitial. Also plays again if the next mission is replayed first time only.
	{
		id: "cs_after_01", kind: "interstitial", actOf: 1, environmentPreview: BASE_DAY, firstTimeOnly: true,
		beats: [
			beat(3, [40, 45, -40], [0, 20, 0], "INSTRUCTOR MIRA", "Signed off. You fly the Line now."),
			beat(3, [-40, 50, 40], [0, 20, 0], "LINE OPERATIONS", "Iron Coast is a Volkov supply depot. Break it."),
		],
	},
	{
		id: "cs_after_02", kind: "interstitial", actOf: 2, environmentPreview: IRON_COAST_DUSK, firstTimeOnly: true,
		beats: [
			beat(3, [50, 60, 70], [0, 20, 0], "LINE OPERATIONS", "The Volkov coast is bleeding. The pole hears the Line is real."),
			beat(3, [-60, 55, -40], [0, 20, 0], "AURORA LINE 1", "Dock at White Harbor next. The relief column is already moving."),
		],
	},
	{
		id: "cs_after_03", kind: "interstitial", actOf: 3, environmentPreview: SNOW_STORM, firstTimeOnly: true,
		beats: [
			beat(3, [55, 55, 55], [0, 20, 0], "LINE OPERATIONS", "A storm swallowed Glass Bluff. Volkov will raid under it."),
			beat(3, [-45, 50, 50], [0, 20, 0], "INSTRUCTOR MIRA", "You cannot see them. Fly it anyway."),
		],
	},
	{
		id: "cs_after_04", kind: "interstitial", actOf: 4, environmentPreview: AURORA_NIGHT, firstTimeOnly: true,
		beats: [
			beat(3, [60, 60, 60], [0, 20, 0], "LINE OPERATIONS", "The aurora broke tonight. The lantern convoy is already moving."),
			beat(3, [-30, 45, 55], [0, 20, 0], "AURORA LINE 1", "They are children, mostly. Don't lose any of them."),
		],
	},
	{
		id: "cs_after_05", kind: "interstitial", actOf: 5, environmentPreview: AURORA_NIGHT, firstTimeOnly: true,
		beats: [
			beat(3, [60, 55, 60], [0, 20, 0], "FIELD MEDIC KOA", "The cathedral is a hospital now. Keep the roof on it."),
			beat(3, [-40, 50, -40], [0, 20, 0], "LINE OPERATIONS", "A Volkov hunter is on the way. Codename KITE."),
		],
	},
	{
		id: "cs_after_06", kind: "interstitial", actOf: 6, environmentPreview: POLAR_SEA, firstTimeOnly: true,
		beats: [
			beat(3, [50, 60, 50], [0, 20, 0], "ICEBREAKER CAPTAIN", "PETREL is late. The channel is not clear."),
			beat(3, [-50, 55, 50], [0, 20, 0], "AURORA LINE 1", "Clear the channel. Fish towns are waiting on us."),
		],
	},
	{
		id: "cs_after_07", kind: "interstitial", actOf: 7, environmentPreview: AURORA_LATE, firstTimeOnly: true,
		beats: [
			beat(3, [45, 60, 45], [0, 25, 0], "LINE OPERATIONS", "Volkov set up a jamming fence under the aurora. Burn it."),
			beat(3, [-50, 55, 50], [0, 25, 0], "AURORA LINE 1", "If the fence stays up, our pilots fly blind."),
		],
	},
	{
		id: "cs_after_08", kind: "interstitial", actOf: 8, environmentPreview: AURORA_NIGHT, firstTimeOnly: true,
		beats: [
			beat(3, [40, 50, -40], [0, 20, 0], "LINE OPERATIONS", "The corridor is on repeat tonight. Hold it four passes deep."),
		],
	},
	{
		id: "cs_after_09", kind: "interstitial", actOf: 9, environmentPreview: AURORA_LATE, firstTimeOnly: true,
		beats: [
			beat(3, [55, 55, 55], [0, 20, 0], "AURORA LINE 1", "A burn unit opens at dawn — if the hospital flight lands."),
			beat(3, [-45, 45, -40], [0, 20, 0], "LINE OPERATIONS", "A Volkov ace is on them. Codename EMBER."),
		],
	},
	{
		id: "cs_after_10", kind: "interstitial", actOf: 10, environmentPreview: CEASEFIRE_TRUTH, firstTimeOnly: true,
		beats: [
			beat(4, [40, 50, 60], [0, 25, 0], "ANALYST SIX", "The ceasefire is a lie. We can prove it before dawn."),
			beat(4, [-40, 45, 50], [0, 25, 0], "LINE OPERATIONS", "A new Volkov ace: Codename CROWN."),
		],
	},
	{
		id: "cs_after_11", kind: "interstitial", actOf: 11, environmentPreview: VOLCANIC_REFUGE, firstTimeOnly: true,
		beats: [
			beat(4, [60, 50, 55], [0, 25, 0], "FIELD MEDIC KOA", "A caldera camp. We put refugees inside a volcano for warmth."),
			beat(3, [-50, 45, 55], [0, 25, 0], "LINE OPERATIONS", "Supply it. Volkov knows it's there."),
		],
	},
	{
		id: "cs_after_12", kind: "interstitial", actOf: 12, environmentPreview: VOLCANIC_REFUGE, firstTimeOnly: true,
		beats: [
			beat(3, [50, 50, 60], [0, 25, 0], "LINE OPERATIONS", "Volkov is using the ash plume as cover. Peel it."),
		],
	},
	{
		id: "cs_after_13", kind: "interstitial", actOf: 13, environmentPreview: VOLCANIC_REFUGE, firstTimeOnly: true,
		beats: [
			beat(3, [55, 50, -45], [0, 25, 0], "AURORA LINE 1", "A truck column at the vents. CINDER is on them."),
		],
	},
	{
		id: "cs_after_14", kind: "interstitial", actOf: 14, environmentPreview: VOLCANIC_REFUGE, firstTimeOnly: true,
		beats: [
			beat(3, [40, 55, 50], [0, 25, 0], "ANALYST SIX", "Volkov is forging weapons inside a refuge. End the forge."),
		],
	},
	{
		id: "cs_after_15", kind: "interstitial", actOf: 15, environmentPreview: GLACIER, firstTimeOnly: true,
		beats: [
			beat(4, [60, 60, 60], [0, 25, 0], "LINE OPERATIONS", "Three thousand civilians are marching on a glacier."),
			beat(3, [-40, 55, 55], [0, 25, 0], "AURORA LINE 1", "Fly over them. Low. Keep them lit."),
		],
	},
	{
		id: "cs_after_16", kind: "interstitial", actOf: 16, environmentPreview: GLACIER, firstTimeOnly: true,
		beats: [
			beat(3, [50, 55, 60], [0, 25, 0], "LINE OPERATIONS", "Volkov cut batteries into the ice. And KITE came back."),
		],
	},
	{
		id: "cs_after_17", kind: "interstitial", actOf: 17, environmentPreview: GLACIER, firstTimeOnly: true,
		beats: [
			beat(3, [45, 55, 55], [0, 25, 0], "FIELD MEDIC KOA", "The field hospital is crossing the glacier today."),
		],
	},
	{
		id: "cs_after_18", kind: "interstitial", actOf: 18, environmentPreview: GLACIER, firstTimeOnly: true,
		beats: [
			beat(3, [50, 55, 60], [0, 25, 0], "ANALYST SIX", "Deep-ice listening posts. They watched the Line for three months."),
		],
	},
	{
		id: "cs_after_19", kind: "interstitial", actOf: 19, environmentPreview: GLACIER, firstTimeOnly: true,
		beats: [
			beat(4, [50, 55, 50], [0, 25, 0], "LINE OPERATIONS", "CROWN is back. He got political."),
			beat(3, [-55, 60, -55], [0, 25, 0], "AURORA LINE 1", "Finish it this time."),
		],
	},
	{
		id: "cs_after_20", kind: "interstitial", actOf: 20, environmentPreview: PORT_DAY, firstTimeOnly: true,
		beats: [
			beat(3, [55, 55, 60], [0, 25, 0], "LINE OPERATIONS", "The northern port. Half the pole eats what docks there."),
		],
	},
	{
		id: "cs_after_21", kind: "interstitial", actOf: 21, environmentPreview: PORT_DAY, firstTimeOnly: true,
		beats: [
			beat(3, [55, 50, 50], [0, 25, 0], "AURORA LINE 1 CAPTAIN", "I am docking under fire today. Keep the sky empty."),
		],
	},
	{
		id: "cs_after_22", kind: "interstitial", actOf: 22, environmentPreview: PORT_DAY, firstTimeOnly: true,
		beats: [
			beat(4, [50, 50, 60], [0, 25, 0], "LINE OPERATIONS", "EMBER came back. The port is his target."),
			beat(3, [-55, 55, 50], [0, 25, 0], "AURORA LINE 1 CAPTAIN", "The pier is watching."),
		],
	},
	{
		id: "cs_after_23", kind: "interstitial", actOf: 23, environmentPreview: EVACUATION_RUN, firstTimeOnly: true,
		beats: [
			beat(4, [55, 55, 55], [0, 25, 0], "LINE OPERATIONS", "The last civilian camp is evacuating today."),
			beat(3, [-50, 50, 55], [0, 25, 0], "AURORA LINE 1", "This is the last Aurora Line convoy."),
		],
	},
	{
		id: "cs_after_24", kind: "interstitial", actOf: 24, environmentPreview: EVACUATION_RUN, firstTimeOnly: true,
		beats: [
			beat(3, [55, 55, 55], [0, 25, 0], "ANALYST SIX", "The war-crimes evidence rides a truck south."),
			beat(3, [-50, 55, 50], [0, 25, 0], "LINE OPERATIONS", "Keep it in the air; keep it on the road."),
		],
	},
	{
		id: "cs_after_25", kind: "interstitial", actOf: 25, environmentPreview: CEASEFIRE_TRUTH, firstTimeOnly: true,
		beats: [
			beat(3, [55, 60, 55], [0, 25, 0], "LINE OPERATIONS", "Aurora Gate. Volkov's forward base. CINDER came back for it."),
		],
	},
	{
		id: "cs_after_26", kind: "interstitial", actOf: 26, environmentPreview: CEASEFIRE_TRUTH, firstTimeOnly: true,
		beats: [
			beat(4, [50, 60, 55], [0, 25, 0], "AURORA LINE 1", "The Marshal is in the air today. He signed the lie."),
			beat(3, [-55, 55, -55], [0, 25, 0], "ANALYST SIX", "Codename AURORA ZERO. He is good."),
			beat(3, [55, 50, -55], [0, 25, 0], "LINE OPERATIONS", "The Aurora Line ends here. One way or the other."),
		],
	},
	{
		id: "cs_finale", kind: "finale", actOf: "epilogue", environmentPreview: CEASEFIRE_TRUTH, firstTimeOnly: true,
		beats: [
			beat(4, [60, 55, 60], [0, 25, 0], "LINE OPERATIONS", "The Aurora Line is closed. The courier squadron is retired."),
			beat(4, [-55, 50, 55], [0, 25, 0], "AURORA LINE 1 CAPTAIN", "The ceasefire holds, because the lie did not."),
			beat(4, [55, 50, -55], [0, 25, 0], "INSTRUCTOR MIRA", "Fly south. The war is somebody else's now."),
		],
	},
];

export const AuroraLineCutscenes = {
	List: CUTSCENES_LIST,
	Opening: CUTSCENES_LIST.find((c) => c.kind === "opening")!,
	Finale: CUTSCENES_LIST.find((c) => c.kind === "finale")!,
	ByActOf(actOf: Cutscene["actOf"]): Cutscene | undefined {
		return CUTSCENES_LIST.find((c) => c.actOf === actOf);
	},
};
