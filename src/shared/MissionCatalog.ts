// Embers of Home campaign — authored catalog of 27 story missions.
//
// Mission 1 preserves the exact tutorial contract from the two-mission build
// (observe pitch/turn, cycle target, destroy radar, down three bandits).
// Mission 2 preserves the Iron Coast contract (three required bandits, five
// warehouses with five optional raiders, then a tougher ace). Missions 3-27
// extend the campaign with distinct biomes, phase sequences and story beats.
//
// This file is pure data and types; it must not import engine services so
// Jest can validate every mission definition inside Luau without a game loop.

export type ChapterId = 1 | 2 | 3;
export type BiomeId =
	| "warm_coast"
	| "burning_coast"
	| "harbor_dusk"
	| "storm_sea"
	| "cold_overcast"
	| "iron_north"
	| "home_renewed";
export type LayoutId =
	| "home_archipelago"
	| "scattered_shoals"
	| "warehouse_coast"
	| "radar_belt"
	| "rescue_waters"
	| "ridge_passage"
	| "harbor_strike"
	| "open_sea";
export type GroundKind = "radar" | "warehouse" | "lifeboat";

/** The engine-visible phase name for a mission step. */
export type PhaseKind =
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	| "tutorial_bandits"
	| "intercept"
	| "warehouses"
	| "strike"
	| "elite"
	| "rescue"
	| "survive"
	| "escort"
	| "ace";

export interface PhaseSpawn {
	activateGround?: boolean;
	airWave?: { count: number; required: boolean; aceHealth?: number };
}

export interface PhaseDef {
	kind: PhaseKind;
	objective: string;
	tutorialStep?: "move" | "target" | "missile" | "";
	/** Required air kills to complete this phase (0 ignored). */
	requiredAir?: number;
	/** Required ground kills to complete this phase (0 ignored). */
	requiredGround?: number;
	/** Maximum optional air kills to track during this phase. */
	optionalAirCap?: number;
	/** Required destruction of the ace spawned by this phase. */
	requiresAce?: boolean;
	/** Required survival duration, in seconds, to complete this phase. */
	surviveSeconds?: number;
	/** Spawns executed exactly once when this phase becomes active. */
	spawn?: PhaseSpawn;
}

export interface StoryBeat {
	/** Short speaker tag (uppercase) or empty for ambient subtitle. */
	speaker: string;
	/** Subtitle text; wrapped and auto-sized. Keep under 180 characters per beat. */
	text: string;
	/** Camera shot preset the CutscenePlayer interprets. */
	shot: "approach" | "home_wide" | "home_tight" | "ocean_low" | "harbor" | "cold_horizon" | "storm" | "ridge" | "foundry" | "aurora" | "finale";
	/** Beat duration in seconds (actual duration is clamped by the player). */
	seconds: number;
}

export interface CutsceneDef {
	id: string;
	title: string;
	/** Narrator tint; used by the client for subtitle color. */
	tone: "warm" | "ash" | "cold" | "iron" | "hope";
	beats: StoryBeat[];
}

export interface GroundTargetSpec {
	kind: GroundKind;
	/** Target name shown in the HUD bracket. */
	name: string;
	/** XZ position (world studs). Y is placed on terrain by the world builder. */
	x: number;
	z: number;
	/** Yaw rotation around Y axis, in radians. */
	yaw?: number;
}

export interface LayoutDef {
	id: LayoutId;
	/** Ground target spawn positions and kinds, in order. */
	targets: GroundTargetSpec[];
	/** Island placement hints: center XZ, radius, peak height. */
	islands: { x: number; z: number; radius: number; height: number }[];
	/** Optional airbase apron coordinates and footprint for grounded jets. */
	apron?: { x: number; z: number; width: number; depth: number };
}

export interface MissionDef {
	id: number;
	chapter: ChapterId;
	codename: string;
	title: string;
	briefingEyebrow: string;
	briefingObjective: string;
	briefingStory: string;
	biome: BiomeId;
	layoutId: LayoutId;
	/** Optional per-mission override to the layout's default targets. */
	targets?: GroundTargetSpec[];
	phases: PhaseDef[];
	openingCutsceneId: string;
	debriefCutsceneId: string;
	/** True when this mission is a chapter finale. */
	chapterFinale?: boolean;
}

// ---------------------------------------------------------------------------
// Shared layout templates. Every mission picks exactly one layout; targets can
// still be overridden per mission to keep every world visually distinct.
// ---------------------------------------------------------------------------

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
	home_archipelago: {
		id: "home_archipelago",
		targets: [{ kind: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
		islands: [
			{ x: 0, z: -850, radius: 440, height: 70 },
			{ x: -1000, z: -1450, radius: 460, height: 125 },
			{ x: 1200, z: -1350, radius: 510, height: 135 },
			{ x: -1450, z: 650, radius: 350, height: 95 },
			{ x: 1600, z: 350, radius: 400, height: 110 },
			{ x: -650, z: 450, radius: 510, height: 48 },
		],
		apron: { x: 0, z: -850, width: 210, depth: 240 },
	},
	warehouse_coast: {
		id: "warehouse_coast",
		targets: [
			{ kind: "warehouse", name: "WAREHOUSE 1", x: -550, z: -900 },
			{ kind: "warehouse", name: "WAREHOUSE 2", x: 0, z: -1100, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "WAREHOUSE 3", x: 550, z: -900 },
			{ kind: "warehouse", name: "WAREHOUSE 4", x: -350, z: -1550, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "WAREHOUSE 5", x: 350, z: -1550 },
		],
		islands: [
			{ x: -550, z: -900, radius: 390, height: 62 },
			{ x: 0, z: -1100, radius: 390, height: 62 },
			{ x: 550, z: -900, radius: 390, height: 62 },
			{ x: -350, z: -1550, radius: 390, height: 62 },
			{ x: 350, z: -1550, radius: 390, height: 62 },
			{ x: -1500, z: -1500, radius: 570, height: 180 },
			{ x: 1450, z: -1600, radius: 600, height: 185 },
			{ x: 1600, z: 500, radius: 450, height: 125 },
			{ x: -1450, z: 500, radius: 490, height: 135 },
		],
	},
	scattered_shoals: {
		id: "scattered_shoals",
		targets: [],
		islands: [
			{ x: -1500, z: -1300, radius: 320, height: 52 },
			{ x: 1200, z: -1600, radius: 300, height: 58 },
			{ x: -400, z: -1900, radius: 280, height: 48 },
			{ x: 1700, z: 400, radius: 360, height: 68 },
			{ x: -1700, z: 700, radius: 340, height: 60 },
			{ x: 300, z: 1200, radius: 280, height: 44 },
		],
	},
	radar_belt: {
		id: "radar_belt",
		targets: [
			{ kind: "radar", name: "HOLLOW EYE 1", x: -900, z: -1200 },
			{ kind: "radar", name: "HOLLOW EYE 2", x: 0, z: -1400, yaw: math.pi / 4 },
			{ kind: "radar", name: "HOLLOW EYE 3", x: 900, z: -1200 },
		],
		islands: [
			{ x: -900, z: -1200, radius: 350, height: 60 },
			{ x: 0, z: -1400, radius: 380, height: 72 },
			{ x: 900, z: -1200, radius: 350, height: 60 },
			{ x: -1600, z: 400, radius: 420, height: 110 },
			{ x: 1600, z: 500, radius: 430, height: 120 },
		],
	},
	rescue_waters: {
		id: "rescue_waters",
		targets: [
			{ kind: "lifeboat", name: "LIFEBOAT ALMA", x: -700, z: -1000 },
			{ kind: "lifeboat", name: "LIFEBOAT GULL", x: 500, z: -1200, yaw: math.pi / 6 },
			{ kind: "lifeboat", name: "LIFEBOAT RUSH", x: -100, z: -1500, yaw: -math.pi / 8 },
		],
		islands: [
			{ x: -1700, z: -1400, radius: 420, height: 85 },
			{ x: 1500, z: -1500, radius: 420, height: 90 },
			{ x: 0, z: 1200, radius: 360, height: 70 },
		],
	},
	ridge_passage: {
		id: "ridge_passage",
		targets: [],
		islands: [
			{ x: -2000, z: 0, radius: 600, height: 220 },
			{ x: 2000, z: 0, radius: 600, height: 220 },
			{ x: 0, z: -2200, radius: 460, height: 160 },
			{ x: 0, z: 1600, radius: 420, height: 140 },
		],
	},
	harbor_strike: {
		id: "harbor_strike",
		targets: [
			{ kind: "warehouse", name: "DRYDOCK A", x: -500, z: -1300 },
			{ kind: "warehouse", name: "DRYDOCK B", x: 0, z: -1500, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "DRYDOCK C", x: 500, z: -1300 },
			{ kind: "radar", name: "HARBOR WATCH", x: 0, z: -950, yaw: math.pi / 2 },
		],
		islands: [
			{ x: 0, z: -1300, radius: 820, height: 55 },
			{ x: -1600, z: 500, radius: 420, height: 130 },
			{ x: 1600, z: 500, radius: 420, height: 130 },
		],
		apron: { x: 0, z: -950, width: 300, depth: 300 },
	},
	open_sea: {
		id: "open_sea",
		targets: [],
		islands: [
			{ x: -2200, z: -1800, radius: 420, height: 120 },
			{ x: 2200, z: -1800, radius: 420, height: 120 },
		],
	},
};

// ---------------------------------------------------------------------------
// Cutscene library. Each mission briefing opens with a short original cinematic
// and each mission ends with a short debrief beat. The opening and finale
// cutscenes bookend the campaign.
// ---------------------------------------------------------------------------

export const CUTSCENES: Record<string, CutsceneDef> = {
	intro_opening: {
		id: "intro_opening",
		title: "Embers of Home",
		tone: "warm",
		beats: [
			{ speaker: "", text: "Caldera Isles. A dawn like any other. A chain of fishing islands holds a quiet morning.", shot: "home_wide", seconds: 4.2 },
			{ speaker: "COMMAND", text: "Ember, you have a rescue sortie. Trainer loadout. We just want you current on the controls.", shot: "approach", seconds: 4.0 },
			{ speaker: "EMBER", text: "Copy, Caldera. I always loved this time of morning.", shot: "home_tight", seconds: 3.6 },
			{ speaker: "", text: "She would not love it again for a long time.", shot: "ocean_low", seconds: 3.4 },
		],
	},
	m1_debrief: {
		id: "m1_debrief",
		title: "Pattern Clear",
		tone: "warm",
		beats: [
			{ speaker: "COMMAND", text: "Pattern clear. Nice flying, Ember. Head home and we'll have you off the duty roster by lunch.", shot: "home_wide", seconds: 4.6 },
		],
	},
	m2_opening: {
		id: "m2_opening",
		title: "Smoke Over Caldera",
		tone: "ash",
		beats: [
			{ speaker: "COMMAND", text: "Ember, we have inbound bogies — a lot of them. They are hitting Caldera harbor directly.", shot: "harbor", seconds: 4.5 },
			{ speaker: "EMBER", text: "My family lives on that harbor.", shot: "home_tight", seconds: 3.2 },
			{ speaker: "COMMAND", text: "Three raiders ahead. Five warehouses are already burning. Then a lead ace will come for you. Fly, Ember.", shot: "approach", seconds: 5.0 },
		],
	},
	m2_debrief: {
		id: "m2_debrief",
		title: "Still Standing",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "The warehouses are gone. The ace is down. The village is still standing. Barely.", shot: "harbor", seconds: 4.6 },
			{ speaker: "COMMAND", text: "Welcome to the war, pilot. You picked a hard day to join.", shot: "home_wide", seconds: 3.6 },
		],
	},
	m3_opening: {
		id: "m3_opening",
		title: "Open Water Rescue",
		tone: "warm",
		beats: [
			{ speaker: "ROOK", text: "Fishing fleet got caught between us and the Hollow raiders. Three lifeboats drifting.", shot: "ocean_low", seconds: 4.0 },
			{ speaker: "EMBER", text: "Then we keep the raiders off them. Lifeboats are not targets.", shot: "approach", seconds: 3.8 },
		],
	},
	m3_debrief: {
		id: "m3_debrief",
		title: "They Can Still Row",
		tone: "warm",
		beats: [
			{ speaker: "ROOK", text: "All three boats intact. They can still row home from here.", shot: "ocean_low", seconds: 3.6 },
		],
	},
	m4_opening: {
		id: "m4_opening",
		title: "Lighthouse Watch",
		tone: "warm",
		beats: [
			{ speaker: "COMMAND", text: "If they take the Harbor Watch radar, we are blind for a hundred miles.", shot: "harbor", seconds: 4.0 },
			{ speaker: "EMBER", text: "Nothing gets past the lighthouse while I am up here.", shot: "home_tight", seconds: 3.4 },
		],
	},
	m4_debrief: {
		id: "m4_debrief",
		title: "Beam Still Turning",
		tone: "warm",
		beats: [
			{ speaker: "COMMAND", text: "Beam is still turning. Good flying, Ember.", shot: "harbor", seconds: 3.4 },
		],
	},
	m5_opening: {
		id: "m5_opening",
		title: "Shrike Hunt",
		tone: "cold",
		beats: [
			{ speaker: "ROOK", text: "Four Hollow Shrikes probing the north channel. Make them regret it.", shot: "cold_horizon", seconds: 3.8 },
		],
	},
	m5_debrief: {
		id: "m5_debrief",
		title: "Clean Sky",
		tone: "warm",
		beats: [
			{ speaker: "EMBER", text: "Clean sky again. For a few hours anyway.", shot: "approach", seconds: 3.2 },
		],
	},
	m6_opening: {
		id: "m6_opening",
		title: "Thunderhead",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Munitions depot hiding inside the thunderhead. Punch through and strike it before the weather closes.", shot: "storm", seconds: 4.6 },
			{ speaker: "EMBER", text: "Try not to lose me in there.", shot: "storm", seconds: 2.8 },
		],
	},
	m6_debrief: {
		id: "m6_debrief",
		title: "Lightning Cleared",
		tone: "cold",
		beats: [
			{ speaker: "EMBER", text: "Depot is slag. I can see sky through the storm again.", shot: "storm", seconds: 3.4 },
		],
	},
	m7_opening: {
		id: "m7_opening",
		title: "Reef Pursuit",
		tone: "ash",
		beats: [
			{ speaker: "COMMAND", text: "The Grey Albatross is in the air. Spotted him dropping ordnance on the reef village. Chase him down.", shot: "ridge", seconds: 4.6 },
			{ speaker: "EMBER", text: "He killed Doc Vann's whole clinic last month. He will not fly out of this.", shot: "approach", seconds: 4.2 },
		],
	},
	m7_debrief: {
		id: "m7_debrief",
		title: "He Got Away",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "He broke off into cloud. I had him. I had him and he still got away.", shot: "ridge", seconds: 4.6 },
			{ speaker: "ROOK", text: "You will get another chance, Ember. We always do.", shot: "cold_horizon", seconds: 3.2 },
		],
	},
	m8_opening: {
		id: "m8_opening",
		title: "Harvest",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "They captured our granary on Terrace Island and converted it to a supply depot. Burn it to the deck.", shot: "approach", seconds: 4.0 },
			{ speaker: "EMBER", text: "Those were our fields.", shot: "home_tight", seconds: 2.6 },
		],
	},
	m8_debrief: {
		id: "m8_debrief",
		title: "Nothing Grows In Ash",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "Nothing grows in ash. We will have to plant again.", shot: "home_wide", seconds: 3.6 },
		],
	},
	m9_opening: {
		id: "m9_opening",
		title: "Burning Harbor",
		tone: "ash",
		beats: [
			{ speaker: "COMMAND", text: "Full assault on Caldera harbor. Evacuation ships are casting off. If you let the raiders through, those ships die.", shot: "harbor", seconds: 5.0 },
			{ speaker: "ROOK", text: "I am behind you, Ember. We hold this harbor or there is no home left.", shot: "approach", seconds: 4.2 },
			{ speaker: "EMBER", text: "Then we hold.", shot: "home_tight", seconds: 2.4 },
		],
	},
	m9_debrief: {
		id: "m9_debrief",
		title: "The Fleet Casts Off",
		tone: "warm",
		beats: [
			{ speaker: "EMBER", text: "The evacuation fleet is away. Caldera is lost. The people are not.", shot: "harbor", seconds: 4.6 },
			{ speaker: "COMMAND", text: "End of Chapter One. Stand down and sleep, pilot. Chapter Two begins tomorrow.", shot: "home_wide", seconds: 4.0 },
		],
	},
	m10_opening: {
		id: "m10_opening",
		title: "Cold Launch",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Hollow Fleet launched four interceptors from the Grey Crossing. Send them home in pieces.", shot: "cold_horizon", seconds: 4.0 },
		],
	},
	m10_debrief: {
		id: "m10_debrief",
		title: "First Push North",
		tone: "cold",
		beats: [
			{ speaker: "EMBER", text: "They felt me coming. Good.", shot: "cold_horizon", seconds: 3.0 },
		],
	},
	m11_opening: {
		id: "m11_opening",
		title: "Hollow Markers",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Three Hollow radar towers map our runs. Knock them off the chart.", shot: "ridge", seconds: 3.8 },
			{ speaker: "EMBER", text: "They are not watching tomorrow.", shot: "approach", seconds: 2.8 },
		],
	},
	m11_debrief: {
		id: "m11_debrief",
		title: "Blind North",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Towers down. The north is blind for the next week.", shot: "cold_horizon", seconds: 3.4 },
		],
	},
	m12_opening: {
		id: "m12_opening",
		title: "Silent Evacuation",
		tone: "warm",
		beats: [
			{ speaker: "DOC VANN", text: "The convoy will not fire. Keep the raiders off us until the ferry clears the strait.", shot: "ocean_low", seconds: 4.4 },
			{ speaker: "EMBER", text: "Civilian bellies. I know.", shot: "home_tight", seconds: 2.4 },
		],
	},
	m12_debrief: {
		id: "m12_debrief",
		title: "They Made It",
		tone: "warm",
		beats: [
			{ speaker: "DOC VANN", text: "Four hundred people on that ferry. They made it. Because of you.", shot: "harbor", seconds: 4.4 },
		],
	},
	m13_opening: {
		id: "m13_opening",
		title: "Fisher's Dawn",
		tone: "warm",
		beats: [
			{ speaker: "ROOK", text: "Fisher fleet got pinned at dawn. Three lifeboats, pirates circling.", shot: "ocean_low", seconds: 4.0 },
			{ speaker: "EMBER", text: "Then they picked the wrong dawn.", shot: "approach", seconds: 2.8 },
		],
	},
	m13_debrief: {
		id: "m13_debrief",
		title: "Nets Mended",
		tone: "warm",
		beats: [
			{ speaker: "EMBER", text: "They will mend their nets tonight. That is what we fight for.", shot: "ocean_low", seconds: 3.8 },
		],
	},
	m14_opening: {
		id: "m14_opening",
		title: "Shear Line",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Four raiders in a thick cloud bank. You will not see them until they are on you.", shot: "storm", seconds: 4.2 },
			{ speaker: "EMBER", text: "Then I will listen for them.", shot: "storm", seconds: 2.8 },
		],
	},
	m14_debrief: {
		id: "m14_debrief",
		title: "Through The Shear",
		tone: "cold",
		beats: [
			{ speaker: "EMBER", text: "Four kills in the cloud. I could not see them. I could hear them.", shot: "storm", seconds: 4.2 },
		],
	},
	m15_opening: {
		id: "m15_opening",
		title: "The Grey Albatross",
		tone: "ash",
		beats: [
			{ speaker: "COMMAND", text: "The Albatross is airborne. He wants a rematch over the Grey Crossing.", shot: "ridge", seconds: 4.0 },
			{ speaker: "EMBER", text: "He gets it. This time he does not fly home.", shot: "approach", seconds: 3.4 },
		],
	},
	m15_debrief: {
		id: "m15_debrief",
		title: "Albatross Falls",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "He is down. I thought that would feel like something.", shot: "ridge", seconds: 4.0 },
			{ speaker: "DOC VANN", text: "Revenge seldom does, Ember.", shot: "cold_horizon", seconds: 3.0 },
		],
	},
	m16_opening: {
		id: "m16_opening",
		title: "Mother's Keep",
		tone: "warm",
		beats: [
			{ speaker: "COMMAND", text: "Hollow strike coming for the island where we are rebuilding. Hold it.", shot: "home_wide", seconds: 4.0 },
			{ speaker: "EMBER", text: "Nobody burns our home twice.", shot: "home_tight", seconds: 3.0 },
		],
	},
	m16_debrief: {
		id: "m16_debrief",
		title: "Rebuilding",
		tone: "warm",
		beats: [
			{ speaker: "COMMAND", text: "They turned back. The new roofs will stand.", shot: "home_wide", seconds: 3.8 },
		],
	},
	m17_opening: {
		id: "m17_opening",
		title: "Breaking Weather",
		tone: "cold",
		beats: [
			{ speaker: "ROOK", text: "Hollow convoy slipping between gale fronts. Hit them before the storm hides them.", shot: "storm", seconds: 4.2 },
		],
	},
	m17_debrief: {
		id: "m17_debrief",
		title: "Wind At Our Back",
		tone: "cold",
		beats: [
			{ speaker: "EMBER", text: "Convoy burning. The wind is at our back now.", shot: "storm", seconds: 3.4 },
		],
	},
	m18_opening: {
		id: "m18_opening",
		title: "Red Horizon",
		tone: "ash",
		beats: [
			{ speaker: "DOC VANN", text: "Ember. Before you launch. The Hollow Fleet. Their crews are civilians too. Conscripts. I just need you to know.", shot: "harbor", seconds: 5.4 },
			{ speaker: "COMMAND", text: "Mixed strike. Three raiders inbound. Five supply depots. Then their lead ace.", shot: "approach", seconds: 4.4 },
			{ speaker: "EMBER", text: "Noted, Doc. We fly anyway.", shot: "home_tight", seconds: 3.0 },
		],
	},
	m18_debrief: {
		id: "m18_debrief",
		title: "Something To Carry",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "Ace down. Depots burning. I will carry what Doc said for a while.", shot: "harbor", seconds: 4.6 },
			{ speaker: "COMMAND", text: "End of Chapter Two. Chapter Three is their coast now.", shot: "cold_horizon", seconds: 3.6 },
		],
	},
	m19_opening: {
		id: "m19_opening",
		title: "Iron Gale",
		tone: "iron",
		beats: [
			{ speaker: "COMMAND", text: "Welcome to the Iron North, Ember. First target: coastal battery that shells our forward tenders.", shot: "foundry", seconds: 4.4 },
		],
	},
	m19_debrief: {
		id: "m19_debrief",
		title: "Foot In The Door",
		tone: "iron",
		beats: [
			{ speaker: "EMBER", text: "Battery is slag. We have a foot in their door.", shot: "foundry", seconds: 3.6 },
		],
	},
	m20_opening: {
		id: "m20_opening",
		title: "Smokestacks",
		tone: "iron",
		beats: [
			{ speaker: "COMMAND", text: "The foundry feeds every Hollow Fleet ship. Shut it down.", shot: "foundry", seconds: 3.8 },
			{ speaker: "EMBER", text: "They will not forge another missile today.", shot: "foundry", seconds: 3.2 },
		],
	},
	m20_debrief: {
		id: "m20_debrief",
		title: "Cold Furnaces",
		tone: "iron",
		beats: [
			{ speaker: "COMMAND", text: "Furnaces cold. First time in forty years.", shot: "foundry", seconds: 3.8 },
		],
	},
	m21_opening: {
		id: "m21_opening",
		title: "The Narrow Sea",
		tone: "cold",
		beats: [
			{ speaker: "ROOK", text: "Carrier escort flight breaking through the Narrow Sea. We cut it short here.", shot: "cold_horizon", seconds: 4.2 },
		],
	},
	m21_debrief: {
		id: "m21_debrief",
		title: "Escort Wiped",
		tone: "cold",
		beats: [
			{ speaker: "EMBER", text: "Escort wiped. The carrier is naked for whoever gets here next.", shot: "cold_horizon", seconds: 3.8 },
		],
	},
	m22_opening: {
		id: "m22_opening",
		title: "Grim Weather",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Hollow Fleet trying to overwhelm you with waves. Just stay alive until our relief flight arrives.", shot: "storm", seconds: 4.4 },
			{ speaker: "EMBER", text: "Define 'alive'.", shot: "storm", seconds: 2.6 },
		],
	},
	m22_debrief: {
		id: "m22_debrief",
		title: "Relief Arrives",
		tone: "cold",
		beats: [
			{ speaker: "COMMAND", text: "Relief flight on station. You are a credit to the coast, Ember.", shot: "storm", seconds: 3.6 },
		],
	},
	m23_opening: {
		id: "m23_opening",
		title: "Rook's Last Flight",
		tone: "ash",
		beats: [
			{ speaker: "ROOK", text: "I took a hit over the strait. Lifeboats behind me, raiders chasing. Stay with me, Ember.", shot: "ocean_low", seconds: 4.6 },
			{ speaker: "EMBER", text: "I am on your wing, Rook. I am right here.", shot: "approach", seconds: 3.6 },
		],
	},
	m23_debrief: {
		id: "m23_debrief",
		title: "He Did Not Make It",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "The lifeboats got home. Rook did not. He never left anyone behind.", shot: "ocean_low", seconds: 5.0 },
			{ speaker: "DOC VANN", text: "Neither do you, Ember.", shot: "home_tight", seconds: 3.0 },
		],
	},
	m24_opening: {
		id: "m24_opening",
		title: "Shadowline",
		tone: "iron",
		beats: [
			{ speaker: "COMMAND", text: "Hollow command bunker is lightly guarded this hour. If we can decapitate the field officers, the fleet stalls.", shot: "foundry", seconds: 4.8 },
		],
	},
	m24_debrief: {
		id: "m24_debrief",
		title: "Shadow Cut",
		tone: "iron",
		beats: [
			{ speaker: "EMBER", text: "Shadow cut. They will take weeks to recoordinate.", shot: "foundry", seconds: 3.6 },
		],
	},
	m25_opening: {
		id: "m25_opening",
		title: "Albatross Rising",
		tone: "ash",
		beats: [
			{ speaker: "COMMAND", text: "Three aces of the Hollow Fleet are up at once, Albatross colors. Koran wants to send a message.", shot: "ridge", seconds: 4.8 },
			{ speaker: "EMBER", text: "Then I will send one back.", shot: "approach", seconds: 2.8 },
		],
	},
	m25_debrief: {
		id: "m25_debrief",
		title: "Message Received",
		tone: "ash",
		beats: [
			{ speaker: "EMBER", text: "Three Albatrosses. Three parachutes. Koran heard me.", shot: "ridge", seconds: 4.0 },
		],
	},
	m26_opening: {
		id: "m26_opening",
		title: "Harbor Of Hollow Stars",
		tone: "iron",
		beats: [
			{ speaker: "COMMAND", text: "Hollow flagship anchored. Sink the escort, burn the depots, take the escort ace. Then home base.", shot: "harbor", seconds: 5.0 },
			{ speaker: "DOC VANN", text: "Civilians still work that harbor, Ember. Mind your missiles.", shot: "harbor", seconds: 4.0 },
			{ speaker: "EMBER", text: "I always do, Doc.", shot: "home_tight", seconds: 2.8 },
		],
	},
	m26_debrief: {
		id: "m26_debrief",
		title: "Flagship Burning",
		tone: "iron",
		beats: [
			{ speaker: "EMBER", text: "Flagship burning at anchor. The dockworkers made it clear. Koran is on open sea somewhere.", shot: "harbor", seconds: 4.6 },
		],
	},
	m27_opening: {
		id: "m27_opening",
		title: "Embers Of Home",
		tone: "hope",
		beats: [
			{ speaker: "COMMAND", text: "Koran is on his personal gunship. He is launching cruise missiles at our evacuation ships. You can chase him down for revenge, or you can intercept his missiles. You cannot do both.", shot: "finale", seconds: 7.0 },
			{ speaker: "DOC VANN", text: "Choose who you are, Ember.", shot: "home_tight", seconds: 3.2 },
			{ speaker: "EMBER", text: "I am the pilot who went up at dawn to help people. That is the only pilot I have ever been.", shot: "approach", seconds: 5.0 },
		],
	},
	m27_debrief: {
		id: "m27_debrief",
		title: "Dawn Again",
		tone: "hope",
		beats: [
			{ speaker: "EMBER", text: "Every missile intercepted. The ships are safe. Koran will be hunted by someone else.", shot: "finale", seconds: 5.2 },
			{ speaker: "DOC VANN", text: "The embers of home still burn, Ember. Because of you.", shot: "home_wide", seconds: 4.4 },
			{ speaker: "COMMAND", text: "Welcome home, pilot. The dawn is yours.", shot: "home_wide", seconds: 3.8 },
		],
	},
};

// ---------------------------------------------------------------------------
// Mission catalog. Twenty-seven authored missions arranged into three chapters.
// Each mission has a distinct biome, layout, phase sequence and story beats.
// ---------------------------------------------------------------------------

function tutorialPhases(): PhaseDef[] {
	return [
		{ kind: "tutorial_move", objective: "Turn and pitch using the flight controls", tutorialStep: "move" },
		{ kind: "tutorial_target", objective: "Cycle target to select the practice target", tutorialStep: "target", spawn: { activateGround: true } },
		{ kind: "tutorial_missile", objective: "Aim at the practice target, wait for lock, then fire a missile", tutorialStep: "missile", requiredGround: 1 },
		{ kind: "tutorial_bandits", objective: "Destroy all three required bandits", requiredAir: 3, spawn: { airWave: { count: 3, required: true } } },
	];
}

function m2Phases(): PhaseDef[] {
	// Preserves the Iron Coast contract (3 intercept, 5 warehouses with up to 5
	// optional raiders, then a tougher ace). Optional cap stays open through the
	// ace phase so surviving raiders remain killable (and threatening).
	return [
		{ kind: "intercept", objective: "Destroy all three required bandits", requiredAir: 3, spawn: { airWave: { count: 3, required: true } } },
		{ kind: "warehouses", objective: "Destroy all five warehouses; fighters are optional threats", requiredGround: 5, optionalAirCap: 5, spawn: { activateGround: true, airWave: { count: 5, required: false } } },
		{ kind: "ace", objective: "Destroy the ace; surviving fighters remain dangerous", requiresAce: true, optionalAirCap: 5, spawn: { airWave: { count: 1, required: true, aceHealth: 165 } } },
	];
}

/** Simple strike pattern: destroy ground targets with optional pursuers. */
function strikePhases(groundCount: number, optionalRaiders: number, objective: string): PhaseDef[] {
	return [
		{
			kind: "strike",
			objective,
			requiredGround: groundCount,
			optionalAirCap: optionalRaiders,
			spawn: { activateGround: true, airWave: optionalRaiders > 0 ? { count: optionalRaiders, required: false } : undefined },
		},
	];
}

/** Pure intercept pattern: destroy required bandits. */
function interceptPhases(airCount: number, objective: string): PhaseDef[] {
	return [{ kind: "intercept", objective, requiredAir: airCount, spawn: { airWave: { count: airCount, required: true } } }];
}

/** Rescue pattern: lifeboats are decorative; destroy raiders attacking them. */
function rescuePhases(raiderCount: number, objective: string): PhaseDef[] {
	return [{ kind: "rescue", objective, requiredAir: raiderCount, spawn: { airWave: { count: raiderCount, required: true } } }];
}

/** Lone-ace boss pattern. */
function acePhases(aceHealth: number, objective: string): PhaseDef[] {
	return [{ kind: "ace", objective, requiresAce: true, spawn: { airWave: { count: 1, required: true, aceHealth } } }];
}

/** Air-only wave with higher count ("ace-adjacent"). */
function elitePhases(airCount: number, objective: string): PhaseDef[] {
	return [{ kind: "elite", objective, requiredAir: airCount, spawn: { airWave: { count: airCount, required: true } } }];
}

/** Classic Iron-Coast structure variant: N intercept, then N strike, then ace. */
function chapterFinalePhases(interceptors: number, groundTargets: number, aceHealth: number, strikeObjective: string): PhaseDef[] {
	return [
		{ kind: "intercept", objective: "Clear the pursuing bandits", requiredAir: interceptors, spawn: { airWave: { count: interceptors, required: true } } },
		{ kind: "strike", objective: strikeObjective, requiredGround: groundTargets, optionalAirCap: 5, spawn: { activateGround: true, airWave: { count: 5, required: false } } },
		{ kind: "ace", objective: "Destroy the enemy ace; surviving pursuers remain dangerous", requiresAce: true, optionalAirCap: 5, spawn: { airWave: { count: 1, required: true, aceHealth } } },
	];
}

/** Escort / defense: destroy incoming attackers before the convoy clears. */
function escortPhases(raiderCount: number, objective: string): PhaseDef[] {
	return [{ kind: "escort", objective, requiredAir: raiderCount, spawn: { airWave: { count: raiderCount, required: true } } }];
}

/** Survive pattern: last a specific duration while waves attack. */
function survivePhases(airCount: number, seconds: number, objective: string): PhaseDef[] {
	return [{ kind: "survive", objective, surviveSeconds: seconds, optionalAirCap: airCount, spawn: { airWave: { count: airCount, required: false } } }];
}

/** Lifeboat strike: pirates must be downed; lifeboats never damaged. */
function lifeboatTargets(names: readonly string[], positions: readonly { x: number; z: number; yaw?: number }[]): GroundTargetSpec[] {
	const out: GroundTargetSpec[] = [];
	for (let index = 0; index < names.size(); index++) {
		out.push({ kind: "lifeboat", name: names[index], x: positions[index].x, z: positions[index].z, yaw: positions[index].yaw });
	}
	return out;
}

const MISSION_LIST: MissionDef[] = [
	{
		id: 1,
		chapter: 1,
		codename: "LAST SUNRISE",
		title: "Last Sunrise",
		briefingEyebrow: "RESCUE TRAINING SORTIE",
		briefingObjective: "Complete flight training and down the opening raiders",
		briefingStory:
			"A quiet dawn over Caldera Isles. Learn pitch and turn, cycle to the training radar, fire a missile, then intercept the three bandits that will not stay quiet.",
		biome: "warm_coast",
		layoutId: "home_archipelago",
		phases: tutorialPhases(),
		openingCutsceneId: "intro_opening",
		debriefCutsceneId: "m1_debrief",
	},
	{
		id: 2,
		chapter: 1,
		codename: "SMOKE OVER CALDERA",
		title: "Smoke Over Caldera",
		briefingEyebrow: "DEFEND THE HARBOR",
		briefingObjective: "Break the coastal strike force",
		briefingStory:
			"Three raiders ahead. Five harbor warehouses are burning while raiders circle. Then the Hollow lead ace will come looking for you.",
		biome: "burning_coast",
		layoutId: "warehouse_coast",
		phases: m2Phases(),
		openingCutsceneId: "m2_opening",
		debriefCutsceneId: "m2_debrief",
	},
	{
		id: 3,
		chapter: 1,
		codename: "OPEN WATER RESCUE",
		title: "Open Water Rescue",
		briefingEyebrow: "PROTECT CIVILIAN LIFEBOATS",
		briefingObjective: "Down three raiders without a civilian loss",
		briefingStory:
			"Three fishing lifeboats drift between you and the raiders. Keep them in sight; keep the pirates off them.",
		biome: "warm_coast",
		layoutId: "rescue_waters",
		targets: lifeboatTargets(
			["LIFEBOAT ALMA", "LIFEBOAT GULL", "LIFEBOAT RUSH"],
			[{ x: -700, z: -1000 }, { x: 500, z: -1200, yaw: math.pi / 6 }, { x: -100, z: -1500, yaw: -math.pi / 8 }],
		),
		phases: rescuePhases(3, "Destroy three raiders without hitting the lifeboats"),
		openingCutsceneId: "m3_opening",
		debriefCutsceneId: "m3_debrief",
	},
	{
		id: 4,
		chapter: 1,
		codename: "LIGHTHOUSE WATCH",
		title: "Lighthouse Watch",
		briefingEyebrow: "DEFEND HARBOR WATCH",
		briefingObjective: "Intercept the strike flight before they reach the lighthouse",
		briefingStory:
			"Four raiders inbound on the harbor radar tower. Hold them in open sky; the lighthouse keeper is still ringing the alarm.",
		biome: "harbor_dusk",
		layoutId: "home_archipelago",
		phases: escortPhases(4, "Shoot down all four incoming raiders"),
		openingCutsceneId: "m4_opening",
		debriefCutsceneId: "m4_debrief",
	},
	{
		id: 5,
		chapter: 1,
		codename: "SHRIKE HUNT",
		title: "Shrike Hunt",
		briefingEyebrow: "AIR SUPERIORITY",
		briefingObjective: "Clear the north channel",
		briefingStory:
			"Four Hollow Shrikes probing the north channel at speed. Make the probe expensive.",
		biome: "cold_overcast",
		layoutId: "open_sea",
		phases: interceptPhases(4, "Destroy all four Hollow Shrikes"),
		openingCutsceneId: "m5_opening",
		debriefCutsceneId: "m5_debrief",
	},
	{
		id: 6,
		chapter: 1,
		codename: "THUNDERHEAD",
		title: "Thunderhead",
		briefingEyebrow: "DEEP STRIKE",
		briefingObjective: "Destroy the hidden munitions depot",
		briefingStory:
			"Hollow Fleet hid a munitions depot inside the thunderhead. Punch through the storm and burn it to the deck before the weather closes.",
		biome: "storm_sea",
		layoutId: "warehouse_coast",
		targets: [
			{ kind: "warehouse", name: "MUNITIONS A", x: -400, z: -1300 },
			{ kind: "warehouse", name: "MUNITIONS B", x: 0, z: -1500, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "MUNITIONS C", x: 400, z: -1300 },
		],
		phases: strikePhases(3, 3, "Destroy all three munitions warehouses while raiders probe"),
		openingCutsceneId: "m6_opening",
		debriefCutsceneId: "m6_debrief",
	},
	{
		id: 7,
		chapter: 1,
		codename: "REEF PURSUIT",
		title: "Reef Pursuit",
		briefingEyebrow: "FIRST ALBATROSS CONTACT",
		briefingObjective: "Catch the Grey Albatross",
		briefingStory:
			"The Grey Albatross is working the reef village. Catch him before he reaches cloud cover. A lone ace, no wingmen.",
		biome: "warm_coast",
		layoutId: "ridge_passage",
		phases: acePhases(140, "Catch and destroy the Grey Albatross"),
		openingCutsceneId: "m7_opening",
		debriefCutsceneId: "m7_debrief",
	},
	{
		id: 8,
		chapter: 1,
		codename: "HARVEST",
		title: "Harvest",
		briefingEyebrow: "STRIKE CAPTURED GRANARY",
		briefingObjective: "Destroy the captured depots on Terrace Island",
		briefingStory:
			"Four captured granary buildings have been converted into Hollow supply depots. Four raiders patrol the field.",
		biome: "warm_coast",
		layoutId: "warehouse_coast",
		targets: [
			{ kind: "warehouse", name: "GRANARY NORTH", x: -500, z: -900 },
			{ kind: "warehouse", name: "GRANARY EAST", x: 450, z: -1050, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "GRANARY WEST", x: -350, z: -1450 },
			{ kind: "warehouse", name: "GRANARY SOUTH", x: 500, z: -1500, yaw: math.pi / 2 },
		],
		phases: strikePhases(4, 4, "Destroy all four captured granary depots"),
		openingCutsceneId: "m8_opening",
		debriefCutsceneId: "m8_debrief",
	},
	{
		id: 9,
		chapter: 1,
		codename: "BURNING HARBOR",
		title: "Burning Harbor",
		briefingEyebrow: "CHAPTER ONE FINALE",
		briefingObjective: "Hold Caldera harbor while evacuation ships cast off",
		briefingStory:
			"Full assault on Caldera harbor. Three raiders inbound. Five harbor warehouses are burning with five pursuers around them. Then their lead ace comes for you.",
		biome: "burning_coast",
		layoutId: "warehouse_coast",
		phases: chapterFinalePhases(3, 5, 170, "Destroy all five harbor warehouses"),
		openingCutsceneId: "m9_opening",
		debriefCutsceneId: "m9_debrief",
		chapterFinale: true,
	},
	{
		id: 10,
		chapter: 2,
		codename: "COLD LAUNCH",
		title: "Cold Launch",
		briefingEyebrow: "INTERCEPT",
		briefingObjective: "Destroy the four Hollow interceptors",
		briefingStory:
			"Hollow Fleet launched four interceptors from the Grey Crossing. Send them home in pieces.",
		biome: "cold_overcast",
		layoutId: "open_sea",
		phases: interceptPhases(4, "Destroy all four Hollow interceptors"),
		openingCutsceneId: "m10_opening",
		debriefCutsceneId: "m10_debrief",
	},
	{
		id: 11,
		chapter: 2,
		codename: "HOLLOW MARKERS",
		title: "Hollow Markers",
		briefingEyebrow: "STRIKE RADAR NETWORK",
		briefingObjective: "Destroy all three Hollow Eye radar towers",
		briefingStory:
			"Three Hollow Eye radar towers map every one of our runs. Knock them off the chart with three raiders overhead.",
		biome: "cold_overcast",
		layoutId: "radar_belt",
		phases: strikePhases(3, 3, "Destroy all three Hollow Eye radar towers"),
		openingCutsceneId: "m11_opening",
		debriefCutsceneId: "m11_debrief",
	},
	{
		id: 12,
		chapter: 2,
		codename: "SILENT EVACUATION",
		title: "Silent Evacuation",
		briefingEyebrow: "DEFEND CIVILIAN FERRY",
		briefingObjective: "Keep raiders off the ferry convoy",
		briefingStory:
			"The civilian ferry convoy will not return fire. Hold off five Hollow raiders while they clear the strait.",
		biome: "cold_overcast",
		layoutId: "scattered_shoals",
		phases: escortPhases(5, "Destroy all five pursuing raiders before they reach the ferry"),
		openingCutsceneId: "m12_opening",
		debriefCutsceneId: "m12_debrief",
	},
	{
		id: 13,
		chapter: 2,
		codename: "FISHER'S DAWN",
		title: "Fisher's Dawn",
		briefingEyebrow: "RESCUE OPERATION",
		briefingObjective: "Clear pirates circling the fishing lifeboats",
		briefingStory:
			"Fisher fleet pinned at dawn. Three lifeboats, four pirates circling.",
		biome: "warm_coast",
		layoutId: "rescue_waters",
		targets: lifeboatTargets(
			["LIFEBOAT WREN", "LIFEBOAT NET", "LIFEBOAT OAR"],
			[{ x: -800, z: -950 }, { x: 350, z: -1150, yaw: -math.pi / 7 }, { x: -200, z: -1400, yaw: math.pi / 9 }],
		),
		phases: rescuePhases(4, "Destroy the four pirates before the lifeboats scatter"),
		openingCutsceneId: "m13_opening",
		debriefCutsceneId: "m13_debrief",
	},
	{
		id: 14,
		chapter: 2,
		codename: "SHEAR LINE",
		title: "Shear Line",
		briefingEyebrow: "LOW VISIBILITY INTERCEPT",
		briefingObjective: "Destroy four raiders inside the cloud bank",
		briefingStory:
			"Four raiders are flying blind inside a thick cloud bank. So are you.",
		biome: "storm_sea",
		layoutId: "open_sea",
		phases: interceptPhases(4, "Destroy all four raiders inside the cloud bank"),
		openingCutsceneId: "m14_opening",
		debriefCutsceneId: "m14_debrief",
	},
	{
		id: 15,
		chapter: 2,
		codename: "GREY ALBATROSS",
		title: "The Grey Albatross",
		briefingEyebrow: "REMATCH",
		briefingObjective: "Destroy the Grey Albatross",
		briefingStory:
			"The Albatross is airborne. He wants a rematch over the Grey Crossing. This time he does not fly home.",
		biome: "cold_overcast",
		layoutId: "ridge_passage",
		phases: acePhases(185, "Destroy the Grey Albatross"),
		openingCutsceneId: "m15_opening",
		debriefCutsceneId: "m15_debrief",
	},
	{
		id: 16,
		chapter: 2,
		codename: "MOTHER'S KEEP",
		title: "Mother's Keep",
		briefingEyebrow: "DEFENSE OF HOME",
		briefingObjective: "Repel the strike on the rebuilding island",
		briefingStory:
			"A Hollow strike flight is coming for the island where we are rebuilding Caldera. Five raiders. Hold them.",
		biome: "home_renewed",
		layoutId: "home_archipelago",
		phases: escortPhases(5, "Shoot down all five raiders before they reach the island"),
		openingCutsceneId: "m16_opening",
		debriefCutsceneId: "m16_debrief",
	},
	{
		id: 17,
		chapter: 2,
		codename: "BREAKING WEATHER",
		title: "Breaking Weather",
		briefingEyebrow: "STRIKE CONVOY",
		briefingObjective: "Destroy the Hollow convoy in the gale",
		briefingStory:
			"Hollow convoy slipping between gale fronts. Hit the four cargo warehouses on their escort ship before the storm hides them.",
		biome: "storm_sea",
		layoutId: "warehouse_coast",
		targets: [
			{ kind: "warehouse", name: "CONVOY HOLD A", x: -400, z: -1200 },
			{ kind: "warehouse", name: "CONVOY HOLD B", x: 0, z: -1400, yaw: math.pi / 2 },
			{ kind: "warehouse", name: "CONVOY HOLD C", x: 400, z: -1200 },
			{ kind: "warehouse", name: "CONVOY HOLD D", x: 0, z: -1700, yaw: math.pi / 2 },
		],
		phases: strikePhases(4, 4, "Destroy all four convoy holds through the storm"),
		openingCutsceneId: "m17_opening",
		debriefCutsceneId: "m17_debrief",
	},
	{
		id: 18,
		chapter: 2,
		codename: "RED HORIZON",
		title: "Red Horizon",
		briefingEyebrow: "CHAPTER TWO FINALE",
		briefingObjective: "Clear raiders, strike supply depots, down the Hollow Ace",
		briefingStory:
			"Three raiders inbound. Five supply depots on the next island. Up to five optional pursuers. Then the Hollow lead ace comes for you.",
		biome: "burning_coast",
		layoutId: "warehouse_coast",
		phases: chapterFinalePhases(3, 5, 180, "Destroy all five Hollow supply depots"),
		openingCutsceneId: "m18_opening",
		debriefCutsceneId: "m18_debrief",
		chapterFinale: true,
	},
	{
		id: 19,
		chapter: 3,
		codename: "IRON GALE",
		title: "Iron Gale",
		briefingEyebrow: "STRIKE COASTAL BATTERY",
		briefingObjective: "Destroy three Hollow coastal battery emplacements",
		briefingStory:
			"Welcome to the Iron North. Three coastal battery radars shell our forward tenders. Three raiders patrol them.",
		biome: "iron_north",
		layoutId: "radar_belt",
		phases: strikePhases(3, 3, "Destroy the three coastal battery radars"),
		openingCutsceneId: "m19_opening",
		debriefCutsceneId: "m19_debrief",
	},
	{
		id: 20,
		chapter: 3,
		codename: "SMOKESTACKS",
		title: "Smokestacks",
		briefingEyebrow: "STRIKE FOUNDRY",
		briefingObjective: "Shut down the Hollow foundry district",
		briefingStory:
			"The Hollow foundry feeds every Hollow Fleet ship. Burn its five smokestack halls under four raider pursuers.",
		biome: "iron_north",
		layoutId: "warehouse_coast",
		phases: strikePhases(5, 4, "Destroy all five foundry halls"),
		openingCutsceneId: "m20_opening",
		debriefCutsceneId: "m20_debrief",
	},
	{
		id: 21,
		chapter: 3,
		codename: "NARROW SEA",
		title: "The Narrow Sea",
		briefingEyebrow: "INTERCEPT ESCORT FLIGHT",
		briefingObjective: "Wipe the carrier's escort flight",
		briefingStory:
			"Carrier escort flight breaking through the Narrow Sea. Five Hollow fighters. Cut them short here.",
		biome: "cold_overcast",
		layoutId: "scattered_shoals",
		phases: interceptPhases(5, "Destroy all five carrier escort fighters"),
		openingCutsceneId: "m21_opening",
		debriefCutsceneId: "m21_debrief",
	},
	{
		id: 22,
		chapter: 3,
		codename: "GRIM WEATHER",
		title: "Grim Weather",
		briefingEyebrow: "SURVIVE WAVES",
		briefingObjective: "Stay alive for 240 seconds while relief flight scrambles",
		briefingStory:
			"Hollow Fleet trying to overwhelm you with waves. Just stay alive until our relief flight arrives.",
		biome: "storm_sea",
		layoutId: "open_sea",
		phases: survivePhases(5, 240, "Survive 240 seconds under constant pressure"),
		openingCutsceneId: "m22_opening",
		debriefCutsceneId: "m22_debrief",
	},
	{
		id: 23,
		chapter: 3,
		codename: "ROOK'S LAST FLIGHT",
		title: "Rook's Last Flight",
		briefingEyebrow: "RESCUE AND ESCORT",
		briefingObjective: "Keep lifeboats alive while four raiders chase Rook home",
		briefingStory:
			"Rook took a hit over the strait. Lifeboats behind him. Four raiders chasing. Stay on his wing.",
		biome: "burning_coast",
		layoutId: "rescue_waters",
		targets: lifeboatTargets(
			["LIFEBOAT TERN", "LIFEBOAT HOOK", "LIFEBOAT KEEL"],
			[{ x: -600, z: -1200, yaw: math.pi / 10 }, { x: 400, z: -1400, yaw: -math.pi / 10 }, { x: -150, z: -1700, yaw: math.pi / 7 }],
		),
		phases: escortPhases(4, "Shoot down all four raiders chasing Rook and the lifeboats"),
		openingCutsceneId: "m23_opening",
		debriefCutsceneId: "m23_debrief",
	},
	{
		id: 24,
		chapter: 3,
		codename: "SHADOWLINE",
		title: "Shadowline",
		briefingEyebrow: "DECAPITATION STRIKE",
		briefingObjective: "Destroy the Hollow command bunker complex",
		briefingStory:
			"Hollow command bunker is lightly guarded this hour. Three command structures. Three raiders overhead.",
		biome: "iron_north",
		layoutId: "radar_belt",
		phases: strikePhases(3, 3, "Destroy all three Hollow command structures"),
		openingCutsceneId: "m24_opening",
		debriefCutsceneId: "m24_debrief",
	},
	{
		id: 25,
		chapter: 3,
		codename: "ALBATROSS RISING",
		title: "Albatross Rising",
		briefingEyebrow: "ELITE ENCOUNTER",
		briefingObjective: "Destroy all three Hollow Aces",
		briefingStory:
			"Three aces of the Hollow Fleet in Albatross colors. All up at once. Koran is sending a message.",
		biome: "iron_north",
		layoutId: "ridge_passage",
		phases: elitePhases(3, "Destroy all three Hollow Ace fighters"),
		openingCutsceneId: "m25_opening",
		debriefCutsceneId: "m25_debrief",
	},
	{
		id: 26,
		chapter: 3,
		codename: "HARBOR OF HOLLOW STARS",
		title: "Harbor of Hollow Stars",
		briefingEyebrow: "FLAGSHIP STRIKE",
		briefingObjective: "Clear escort, burn depots, down the escort ace",
		briefingStory:
			"Hollow flagship anchored. Sink the escort, burn four depots with up to five pursuers, then take out the escort ace.",
		biome: "iron_north",
		layoutId: "harbor_strike",
		phases: chapterFinalePhases(3, 4, 190, "Destroy all four harbor depots"),
		openingCutsceneId: "m26_opening",
		debriefCutsceneId: "m26_debrief",
	},
	{
		id: 27,
		chapter: 3,
		codename: "EMBERS OF HOME",
		title: "Embers of Home",
		briefingEyebrow: "FINALE — PROTECT CIVILIANS",
		briefingObjective: "Intercept five cruise missiles threatening evacuation ships",
		briefingStory:
			"Koran launched five cruise missiles at our evacuation ships. You can chase him for revenge, or you can intercept the missiles. You cannot do both.",
		biome: "home_renewed",
		layoutId: "home_archipelago",
		targets: lifeboatTargets(
			["EVAC SHIP ALDER", "EVAC SHIP BRIAR", "EVAC SHIP CEDAR"],
			[{ x: -700, z: -950 }, { x: 0, z: -1150, yaw: math.pi / 2 }, { x: 700, z: -950, yaw: -math.pi / 4 }],
		),
		phases: escortPhases(5, "Intercept and destroy all five cruise missile carriers"),
		openingCutsceneId: "m27_opening",
		debriefCutsceneId: "m27_debrief",
		chapterFinale: true,
	},
];

/** Total mission count. The engine reads this everywhere, not a hardcoded 27. */
export const MISSION_COUNT = MISSION_LIST.size();

/** Map keyed by missionId for direct lookup. */
const MISSION_BY_ID = new Map<number, MissionDef>();
for (const mission of MISSION_LIST) MISSION_BY_ID.set(mission.id, mission);

export const MissionCatalog = {
	Count(): number {
		return MISSION_COUNT;
	},
	All(): readonly MissionDef[] {
		return MISSION_LIST;
	},
	Get(missionId: number): MissionDef | undefined {
		return MISSION_BY_ID.get(missionId);
	},
	Require(missionId: number): MissionDef {
		const mission = MISSION_BY_ID.get(missionId);
		assert(mission !== undefined, `Unknown mission ${missionId}`);
		return mission;
	},
	Layout(id: LayoutId): LayoutDef {
		const layout = LAYOUTS[id];
		assert(layout !== undefined, `Unknown layout ${id}`);
		return layout;
	},
	Cutscene(id: string): CutsceneDef | undefined {
		return CUTSCENES[id];
	},
	ChapterOf(missionId: number): ChapterId {
		return MissionCatalog.Require(missionId).chapter;
	},
	/** Convenience for the required air kills across all phases of a mission. */
	TotalRequiredAirKills(missionId: number): number {
		const mission = MissionCatalog.Require(missionId);
		let total = 0;
		for (const phase of mission.phases) {
			if (phase.requiredAir !== undefined) total += phase.requiredAir;
			if (phase.requiresAce === true) total += 1;
		}
		return total;
	},
	TotalRequiredGroundKills(missionId: number): number {
		const mission = MissionCatalog.Require(missionId);
		let total = 0;
		for (const phase of mission.phases) if (phase.requiredGround !== undefined) total += phase.requiredGround;
		return total;
	},
};
