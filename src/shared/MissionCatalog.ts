// Pure authoritative mission data shared by the server runner, UI, and tests.
// Mission 1 and 2 keep their legacy hardcoded paths (see MissionRules); their
// catalog entries describe the same objectives for the UI and story only.
//
// All 27 missions preserve the 600 s wall-clock deadline from GameConfig and
// contribute to the four-slot save profile. Missions 3-27 are driven by their
// blueprint phase sequence in BlueprintRunner.

export type Act = 1 | 2 | 3;

export type MissionRegion =
	| "canyon_airfield"
	| "canyon_pass"
	| "upland_farm"
	| "plateau_relay"
	| "coastal_city"
	| "coastal_harbor"
	| "ocean_platform";

export type GroundAsset = "radar" | "warehouse" | "comms_relay" | "grain_silo";

export type EnvironmentPreset =
	| "canyon_dawn"
	| "canyon_noon"
	| "canyon_dusk"
	| "canyon_night"
	| "farm_morning"
	| "farm_overcast"
	| "farm_storm"
	| "farm_sunset"
	| "relay_night"
	| "relay_aurora"
	| "city_evening"
	| "city_night"
	| "city_dawn"
	| "harbor_fog"
	| "harbor_sunset"
	| "ocean_storm"
	| "ocean_clear"
	| "ocean_night";

export type PhaseKind =
	// Legacy mission 1 only
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	// Generic:
	| "required_air"
	| "required_ground"
	| "ace";

export interface MissionPhaseBlueprint {
	kind: PhaseKind;
	count?: number;
	label: string;
	tutorialStep?: "move" | "target" | "missile" | "";
	/** How many optional raiders may spawn during this phase (visible in briefing). */
	optionalRaiders?: number;
	/** Human-readable "beat" shown on the HUD when this phase begins. */
	beat?: string;
}

export interface GroundTargetSpec {
	asset: GroundAsset;
	name: string;
	/** World-space XZ placement (studs). Y is grounded by the world builder. */
	x: number;
	z: number;
	yaw?: number;
}

export interface MissionBlueprint {
	id: number;
	act: Act;
	codename: string;
	title: string;
	region: MissionRegion;
	environment: EnvironmentPreset;
	/** One-line objective headline for the briefing screen. */
	primary: string;
	/** 1-2 sentence briefing synopsis shown before launch. */
	briefing: string;
	/** 1 sentence debrief shown after a successful mission. */
	debrief: string;
	/** Ordered phase sequence. The mission completes when the final phase does. */
	phases: MissionPhaseBlueprint[];
	/** Ground targets placed into the mission world. */
	ground: GroundTargetSpec[];
	/**
	 * Optional raider count the mission world may spawn alongside required bandits.
	 * Reflects the sum of optionalRaiders across phases; convenience for displays.
	 */
	optionalRaiderMax?: number;
	/** Ace health (if the mission has an ace phase). Default is 165. */
	aceHealth?: number;
	/** Legacy-hardcoded missions use their original CombatService code path. */
	legacy?: 1 | 2;
}

// ---------------------------------------------------------------------------
// Helpers for authoring succinct blueprints
// ---------------------------------------------------------------------------

function M(
	id: number,
	act: Act,
	codename: string,
	title: string,
	region: MissionRegion,
	environment: EnvironmentPreset,
	primary: string,
	briefing: string,
	debrief: string,
	phases: MissionPhaseBlueprint[],
	ground: GroundTargetSpec[],
	extra: { optionalRaiderMax?: number; aceHealth?: number; legacy?: 1 | 2 } = {},
): MissionBlueprint {
	return {
		id,
		act,
		codename,
		title,
		region,
		environment,
		primary,
		briefing,
		debrief,
		phases,
		ground,
		...extra,
	};
}

// ---------------------------------------------------------------------------
// 27 campaign missions - "Broken Relay"
// ---------------------------------------------------------------------------
//
// Story: An isolated trainee at the canyon rim airfield inherits his missing
// mentor Teal's radio recordings. The leads expose a coup brewing within the
// Mountain Alliance's own command structure. The trainee broadcasts evidence
// to loyalist cells and dismantles the coup across three acts.
//
// Act I  — Rim Static       (Missions 1-9):  canyon rim, static-cracked recordings.
// Act II — Plateau Signal   (Missions 10-18): upland farms, relay staging ground.
// Act III — Coastal Fracture (Missions 19-27): coastal cities, air marshal confrontation.

export const MISSIONS: MissionBlueprint[] = [
	// ----- Act I: Rim Static -----
	M(
		1, 1, "Rim Static", "FIRST FLIGHT", "canyon_airfield", "canyon_noon",
		"Complete flight training and repel a probing attack",
		"Trainee pilot checkout at Varda Rim. Learn to pitch and turn, cycle to the training radar, fire a practice missile, then intercept three bandits probing the rim.",
		"Varda Rim held. The quartermaster hands you a sealed case of your missing mentor's radio recordings.",
		[
			{ kind: "tutorial_move", label: "Observe pitch and turn", tutorialStep: "move", beat: "Fox One. Remember your training." },
			{ kind: "tutorial_target", label: "Cycle to the training target", tutorialStep: "target", beat: "Mark the practice radar." },
			{ kind: "tutorial_missile", label: "Lock and fire a missile at the training radar", tutorialStep: "missile", count: 1, beat: "Trust the lock. Hold your line." },
			{ kind: "required_air", label: "Intercept three bandits", count: 3, beat: "Three bandits inbound. Keep them off the field." },
		],
		[{ asset: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
		{ legacy: 1 },
	),
	M(
		2, 1, "Iron Coast", "IRON COAST", "coastal_city", "harbor_sunset",
		"Break the coastal strike force staging against Varda Rim",
		"Intercept three required bandits, destroy five coastal warehouses while raiders pursue, then down the faster armored ace.",
		"The coast is quiet for now. One recording from Teal keeps looping: 'They moved the convoy north. Follow the relays.'",
		[
			{ kind: "required_air", label: "Intercept three required bandits", count: 3, beat: "Fox team is clear. Required bandits closing." },
			{ kind: "required_ground", label: "Destroy five warehouses", count: 5, optionalRaiders: 5, beat: "Warehouses are the raid's logistics. Hit all five." },
			{ kind: "ace", label: "Destroy the ace", beat: "The ace is faster and armored. Make every shot count." },
		],
		[
			{ asset: "warehouse", name: "WAREHOUSE 1", x: -550, z: -900 },
			{ asset: "warehouse", name: "WAREHOUSE 2", x: 0, z: -1100 },
			{ asset: "warehouse", name: "WAREHOUSE 3", x: 550, z: -900 },
			{ asset: "warehouse", name: "WAREHOUSE 4", x: -350, z: -1550 },
			{ asset: "warehouse", name: "WAREHOUSE 5", x: 350, z: -1550 },
		],
		{ legacy: 2, optionalRaiderMax: 5 },
	),
	M(
		3, 1, "Fox Trail", "FOX TRAIL", "canyon_airfield", "canyon_dawn",
		"Follow Teal's final flight path along the rim",
		"The recording names a canyon approach Teal used before he disappeared. Clear two scout flights so recovery can walk the ridge.",
		"Recovery finds Teal's wrecked receiver. Its tape log hints at a hidden relay 'past the orchard line'.",
		[
			{ kind: "required_air", label: "Clear scout flight alpha", count: 2, beat: "Two scouts shadowing the rim." },
			{ kind: "required_air", label: "Clear scout flight bravo", count: 2, beat: "Second pair breaking cover." },
		],
		[],
	),
	M(
		4, 1, "Static Quarters", "STATIC QUARTERS", "canyon_airfield", "canyon_noon",
		"Silence an unlisted canyon relay quartered inside the training grounds",
		"The receiver's log points at a rogue radar inside the training perimeter. Destroy it before its handlers roll back the lie.",
		"The radar is gone, but a staff list on the console names three officers who should not have been there.",
		[
			{ kind: "required_ground", label: "Destroy the hidden rim radar", count: 1, beat: "An unlisted radar at the training grounds." },
			{ kind: "required_air", label: "Fend off the response flight", count: 3, beat: "They scrambled a flight. Hold the line." },
		],
		[{ asset: "radar", name: "RIM RADAR", x: -400, z: -600 }],
	),
	M(
		5, 1, "Orchard Line", "ORCHARD LINE", "upland_farm", "farm_morning",
		"Protect the orchard farmers who sheltered Teal's recordings",
		"Loyalist farmers at the Teklan orchard are being overflown by a coup patrol. Deny them their sweep.",
		"The farmers hand you a cache tin: more tapes, this time with map coordinates for a lifted comms relay.",
		[
			{ kind: "required_air", label: "Drive off the patrol flight", count: 4, beat: "Patrol over the orchard. Keep them off the civilians." },
		],
		[],
	),
	M(
		6, 1, "Grain Shadow", "GRAIN SHADOW", "upland_farm", "farm_overcast",
		"Destroy fuel grain silos stockpiling for the coup",
		"The patrol's fuel-grade grain is held in three silos above the orchards. Burn the stockpile before the next convoy leaves.",
		"The silos are collapsed. A loyalist farmer whispers the next relay is 'where the storm walks'.",
		[
			{ kind: "required_ground", label: "Destroy three fuel silos", count: 3, beat: "Silos are not civilian stock. They are fuel." },
			{ kind: "required_air", label: "Clear the orchard patrol", count: 2, beat: "A pair of raiders answering the smoke." },
		],
		[
			{ asset: "grain_silo", name: "SILO ALPHA", x: -520, z: -720 },
			{ asset: "grain_silo", name: "SILO BRAVO", x: 60, z: -1080 },
			{ asset: "grain_silo", name: "SILO CHARLIE", x: 540, z: -680 },
		],
	),
	M(
		7, 1, "Dust Weather", "DUST WEATHER", "canyon_pass", "canyon_dusk",
		"Intercept a storm-day messenger crossing the canyon pass",
		"The next pickup slips through the canyon pass under cover of a dust front. Catch the courier before he reaches the plateau.",
		"The courier's packet names the first high-value relay node: Node Kiro, on the plateau's edge.",
		[
			{ kind: "required_air", label: "Catch the four-ship messenger flight", count: 4, beat: "Four bandits running the pass." },
		],
		[],
	),
	M(
		8, 1, "Rim Switch", "RIM SWITCH", "canyon_airfield", "canyon_dusk",
		"Hold Varda Rim through a coordinated counter-strike",
		"Varda's own control tower is suddenly listed as compromised. Hold the airfield while loyalist ground crews reclaim the tower.",
		"Varda is loyal. The relieved tower chief confirms the plateau is wide open for a reconnaissance run.",
		[
			{ kind: "required_air", label: "Break the first assault wave", count: 3, beat: "Wave one is in the open." },
			{ kind: "required_air", label: "Break the second assault wave", count: 3, optionalRaiders: 2, beat: "Second wave with trailing raiders." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		9, 1, "Static Horizon", "STATIC HORIZON", "canyon_pass", "canyon_night",
		"Night sweep over the pass; act one ace confronts you",
		"The last recording ends in a shouted call sign — Vulture Lead — that is now flying tonight over the pass. Finish Teal's last fight.",
		"Vulture Lead is down. Teal's final tape is clear now: 'The relays run from the farms to the harbors. Follow the chain.'",
		[
			{ kind: "required_air", label: "Clear the night patrol", count: 3, beat: "Three on NVG. Watch your horizon." },
			{ kind: "ace", label: "Defeat Vulture Lead", beat: "Vulture Lead has the plateau on his wing. End this." },
		],
		[],
		{ aceHealth: 155 },
	),

	// ----- Act II: Plateau Signal -----
	M(
		10, 2, "Plateau Cold", "PLATEAU COLD", "plateau_relay", "farm_overcast",
		"Scout and silence the first plateau relay",
		"Node Kiro sits above an abandoned mining camp. Reduce it to scrap so the farms can broadcast loyalist traffic again.",
		"Node Kiro falls. Loyalist traffic bleeds back onto the air. Two more relays listed on the farmer's tin.",
		[
			{ kind: "required_ground", label: "Destroy relay Node Kiro", count: 1, beat: "Node Kiro is live. Take the dish out." },
			{ kind: "required_air", label: "Intercept the plateau response", count: 2, beat: "Response flight from the ridge." },
		],
		[{ asset: "comms_relay", name: "NODE KIRO", x: 180, z: -1100 }],
	),
	M(
		11, 2, "Signal Harvest", "SIGNAL HARVEST", "upland_farm", "farm_sunset",
		"Harvest two more relays flanking the farm belt",
		"Nodes Lira and Merel sit on opposing ridges. Burn both before the handlers can rotate frequencies.",
		"Two relays silenced in one sortie. A loyalist cell replies for the first time, offering coordinates for a staging comms farm.",
		[
			{ kind: "required_ground", label: "Destroy relay Node Lira", count: 1, beat: "Lira is the west ridge dish." },
			{ kind: "required_ground", label: "Destroy relay Node Merel", count: 1, beat: "Merel is the east ridge dish." },
			{ kind: "required_air", label: "Clear the alert pair", count: 2, beat: "Pair of raiders answering." },
		],
		[
			{ asset: "comms_relay", name: "NODE LIRA", x: -820, z: -780 },
			{ asset: "comms_relay", name: "NODE MEREL", x: 820, z: -780 },
		],
	),
	M(
		12, 2, "Open Field", "OPEN FIELD", "upland_farm", "farm_morning",
		"Fend off a four-ship sweep over the orchards",
		"Coup patrols are retaliating against the civilians. Occupy the airspace until the loyalists finish their broadcast window.",
		"Loyalist cells now have a working relay net. The next piece is their staging farm.",
		[
			{ kind: "required_air", label: "Occupy the orchard airspace", count: 4, optionalRaiders: 2, beat: "Patrol escalating. Trailers possible." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		13, 2, "Staging Farm", "STAGING FARM", "upland_farm", "farm_overcast",
		"Dismantle the coup's upland staging farm",
		"Four silos, one relay, the whole farm belt turned into a staging ground. Erase it in one sortie.",
		"The staging farm is scorched. Resistance cells report the chain feeds into a plateau antenna array.",
		[
			{ kind: "required_ground", label: "Destroy four fuel silos and the relay", count: 5, beat: "Four silos plus a relay on the hill." },
			{ kind: "required_air", label: "Hold off two raiders", count: 2, beat: "Raiders scrambling from the plateau." },
		],
		[
			{ asset: "grain_silo", name: "SILO 1", x: -560, z: -900 },
			{ asset: "grain_silo", name: "SILO 2", x: -160, z: -1140 },
			{ asset: "grain_silo", name: "SILO 3", x: 300, z: -1120 },
			{ asset: "grain_silo", name: "SILO 4", x: 640, z: -840 },
			{ asset: "comms_relay", name: "FARM RELAY", x: 60, z: -1500 },
		],
	),
	M(
		14, 2, "Antenna Row", "ANTENNA ROW", "plateau_relay", "relay_night",
		"Blind the long-range antenna row at night",
		"Three plateau antennas feed the coup's chain of command. The night window closes in ten minutes.",
		"The chain is blind. The coup's inner planners switch to broken-up courier runs.",
		[
			{ kind: "required_ground", label: "Destroy three plateau antennas", count: 3, beat: "Three dishes on the ridge." },
			{ kind: "required_air", label: "Clear the perimeter CAP", count: 3, beat: "Combat air patrol responding." },
		],
		[
			{ asset: "comms_relay", name: "ANTENNA ONE", x: -600, z: -1100 },
			{ asset: "comms_relay", name: "ANTENNA TWO", x: 0, z: -1340 },
			{ asset: "comms_relay", name: "ANTENNA THREE", x: 600, z: -1100 },
		],
	),
	M(
		15, 2, "Loyalist Window", "LOYALIST WINDOW", "upland_farm", "farm_morning",
		"Buy the loyalist broadcast its one clear window",
		"Loyalist cells are about to broadcast their proof. You buy them one uninterrupted window over the farm belt.",
		"The broadcast lands. Three loyalist garrisons swap allegiance within the hour.",
		[
			{ kind: "required_air", label: "Hold the first intruders", count: 3, beat: "Intruders inbound at the start of the window." },
			{ kind: "required_air", label: "Hold the second intruders", count: 3, optionalRaiders: 3, beat: "Second wave riding harder. Raiders in tow." },
		],
		[],
		{ optionalRaiderMax: 3 },
	),
	M(
		16, 2, "Storm Walk", "STORM WALK", "upland_farm", "farm_storm",
		"Finish the staging ground while the storm covers you",
		"A thunderstorm masks the farm belt. Use the window to burn the last fuel staging site.",
		"The site is black. Beyond the storm, the coup pulls back to the coast.",
		[
			{ kind: "required_ground", label: "Destroy three remaining silos", count: 3, beat: "Three silos still intact in the storm." },
			{ kind: "required_ground", label: "Destroy the forward relay", count: 1, beat: "A forward relay on the staging path." },
			{ kind: "required_air", label: "Catch the storm patrol", count: 2, beat: "Patrol riding the thunder." },
		],
		[
			{ asset: "grain_silo", name: "STAGING SILO 1", x: -520, z: -820 },
			{ asset: "grain_silo", name: "STAGING SILO 2", x: 0, z: -1050 },
			{ asset: "grain_silo", name: "STAGING SILO 3", x: 540, z: -820 },
			{ asset: "comms_relay", name: "FORWARD RELAY", x: 0, z: -1600 },
		],
	),
	M(
		17, 2, "Aurora Relay", "AURORA RELAY", "plateau_relay", "relay_aurora",
		"Hunt the last plateau relay under the aurora",
		"One relay remains hot. The aurora lights the plateau for your approach — and theirs.",
		"The plateau is dark. The coup's broadcasts collapse to a single coastal transmitter.",
		[
			{ kind: "required_ground", label: "Destroy the plateau relay", count: 1, beat: "One dish on the ridge." },
			{ kind: "required_air", label: "Clear the aurora intercept", count: 4, beat: "Four intercepts under the aurora." },
		],
		[{ asset: "comms_relay", name: "AURORA RELAY", x: -100, z: -1400 }],
	),
	M(
		18, 2, "Ridge Ace", "RIDGE ACE", "plateau_relay", "relay_night",
		"Close act two against the plateau ace",
		"Vulture Two commands the plateau. He is faster, cleaner, and knows your rim call signs.",
		"Vulture Two is down. The next intercept names the Air Marshal — the coup's face on the coast.",
		[
			{ kind: "required_air", label: "Clear his wingmen", count: 3, beat: "Clear his wingmen before he engages." },
			{ kind: "ace", label: "Defeat Vulture Two", beat: "Vulture Two now. Make the pass count." },
		],
		[],
		{ aceHealth: 170 },
	),

	// ----- Act III: Coastal Fracture -----
	M(
		19, 3, "Harbor Run", "HARBOR RUN", "coastal_city", "harbor_fog",
		"First strike on the coup's harbor logistics",
		"The coup moved to the coast. Hit the harbor warehouses holding their last reserves.",
		"The harbor burns. The Air Marshal moves his flag deeper into the coastal city.",
		[
			{ kind: "required_ground", label: "Destroy three harbor warehouses", count: 3, beat: "Three warehouses on the quay." },
			{ kind: "required_air", label: "Clear the harbor CAP", count: 2, beat: "CAP coming off the apron." },
		],
		[
			{ asset: "warehouse", name: "QUAY 1", x: -500, z: -900 },
			{ asset: "warehouse", name: "QUAY 2", x: 0, z: -1150 },
			{ asset: "warehouse", name: "QUAY 3", x: 500, z: -900 },
		],
	),
	M(
		20, 3, "Fracture Line", "FRACTURE LINE", "coastal_city", "city_evening",
		"Split the Air Marshal's air cover in half",
		"Two defensive wings share the coast. Break the eastern wing's intercept before the western wing can reinforce.",
		"The eastern wing is scattered. The Marshal rotates his personal escort to the open city.",
		[
			{ kind: "required_air", label: "Shatter the eastern wing", count: 5, beat: "Full wing on the east line." },
		],
		[],
	),
	M(
		21, 3, "City Night", "CITY NIGHT", "coastal_city", "city_night",
		"Night strike on the Marshal's broadcast tower",
		"The Marshal's broadcast tower overlooks the city. Reduce it to silence.",
		"The city falls dark. Loyalist marines land at dawn.",
		[
			{ kind: "required_ground", label: "Destroy the broadcast relay", count: 1, beat: "Broadcast relay above the city." },
			{ kind: "required_air", label: "Hold off the escort flight", count: 4, optionalRaiders: 2, beat: "Escort flight scrambling with raiders." },
		],
		[{ asset: "comms_relay", name: "BROADCAST RELAY", x: 0, z: -1300 }],
		{ optionalRaiderMax: 2 },
	),
	M(
		22, 3, "Harbor Fog", "HARBOR FOG", "coastal_harbor", "harbor_fog",
		"Finish the harbor in the fog",
		"Dense fog hides the last fuel depots. Burn them before the Marshal's convoy sails.",
		"The convoy is destroyed. Two coastal cities declare loyalty by nightfall.",
		[
			{ kind: "required_ground", label: "Destroy five fuel silos", count: 5, beat: "Five silos packed into the fog." },
			{ kind: "required_air", label: "Clear the fog patrol", count: 3, beat: "Patrol riding the fog." },
		],
		[
			{ asset: "grain_silo", name: "FOG DEPOT 1", x: -520, z: -850 },
			{ asset: "grain_silo", name: "FOG DEPOT 2", x: -180, z: -1120 },
			{ asset: "grain_silo", name: "FOG DEPOT 3", x: 180, z: -1120 },
			{ asset: "grain_silo", name: "FOG DEPOT 4", x: 520, z: -850 },
			{ asset: "grain_silo", name: "FOG DEPOT 5", x: 0, z: -1480 },
		],
	),
	M(
		23, 3, "Ocean Clear", "OCEAN CLEAR", "ocean_platform", "ocean_clear",
		"Intercept the Marshal's naval air cover over open water",
		"The Marshal shelters on an offshore platform. Clear its air cover first.",
		"The platform is undefended. Loyalist frigates ring it at dawn.",
		[
			{ kind: "required_air", label: "Clear the platform CAP", count: 5, optionalRaiders: 3, beat: "CAP five, trailing raiders." },
		],
		[],
		{ optionalRaiderMax: 3 },
	),
	M(
		24, 3, "Platform Fire", "PLATFORM FIRE", "ocean_platform", "ocean_storm",
		"Strike the offshore platform through the storm",
		"Weather closed. Push through anyway. Three platform warehouses hold the Marshal's reserves.",
		"The platform is burning. The Marshal retreats to the city for his last stand.",
		[
			{ kind: "required_ground", label: "Destroy three platform warehouses", count: 3, beat: "Three warehouses on the deck." },
			{ kind: "required_air", label: "Clear the storm patrol", count: 3, beat: "Patrol riding the storm shadow." },
		],
		[
			{ asset: "warehouse", name: "DECK ALPHA", x: -480, z: -900 },
			{ asset: "warehouse", name: "DECK BRAVO", x: 0, z: -1150 },
			{ asset: "warehouse", name: "DECK CHARLIE", x: 480, z: -900 },
		],
	),
	M(
		25, 3, "City Dawn", "CITY DAWN", "coastal_city", "city_dawn",
		"Cover the loyalist landing at the city dawn",
		"Dawn landings begin. Keep the Marshal's intercepts off the beaches.",
		"The beaches hold. The Marshal pulls his personal flight airborne.",
		[
			{ kind: "required_air", label: "Hold the first intercept", count: 3, beat: "First intercept wave off the apron." },
			{ kind: "required_air", label: "Hold the second intercept", count: 3, optionalRaiders: 3, beat: "Second wave with raiders in tow." },
			{ kind: "required_ground", label: "Destroy the beach relay", count: 1, beat: "Beach relay still directing them." },
		],
		[{ asset: "comms_relay", name: "BEACH RELAY", x: 0, z: -1250 }],
		{ optionalRaiderMax: 3 },
	),
	M(
		26, 3, "Fracture Last", "FRACTURE LAST", "coastal_city", "city_night",
		"Trap the Marshal's wing between you and the city",
		"The Marshal's wing is airborne. Pin them against the city.",
		"The wing is broken. Only the Marshal's own flight remains.",
		[
			{ kind: "required_air", label: "Break the Marshal's first flight", count: 4, beat: "His flight splits into two groups." },
			{ kind: "required_air", label: "Break the second flight", count: 4, optionalRaiders: 2, beat: "Second group covering his approach." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		27, 3, "Broken Relay", "BROKEN RELAY", "coastal_city", "city_dawn",
		"Confront the Air Marshal and finish the broadcast",
		"The Marshal is airborne over the city. Finish the fight Teal started, then broadcast your own clear signal.",
		"The coup is broken. Loyalist pilots take the air. Your broadcast closes with: 'For Teal. For the rim.'",
		[
			{ kind: "required_air", label: "Clear the Marshal's wingmen", count: 3, beat: "Clear his wingmen before he engages." },
			{ kind: "required_ground", label: "Destroy the final broadcast relay", count: 1, beat: "His relay is still broadcasting." },
			{ kind: "ace", label: "Defeat the Air Marshal", beat: "Air Marshal. Your training. Your rim." },
		],
		[{ asset: "comms_relay", name: "MARSHAL RELAY", x: 0, z: -1350 }],
		{ aceHealth: 195 },
	),
];

export const MISSION_COUNT = MISSIONS.size();

// Validate at module load so a bad authoring edit fails the server immediately.
assert(MISSION_COUNT === 27, "Broken Relay must ship 27 missions");
for (let index = 0; index < MISSIONS.size(); index++) {
	const blueprint = MISSIONS[index];
	assert(blueprint.id === index + 1, `Mission ${index + 1} must have id ${index + 1}`);
	assert(blueprint.phases.size() >= 1, `Mission ${blueprint.id} must have at least one phase`);
	let requiredAce = 0;
	for (const phase of blueprint.phases) {
		if (phase.kind === "ace") requiredAce += 1;
		if (phase.kind === "required_air" || phase.kind === "required_ground") {
			assert((phase.count ?? 0) >= 1, `Mission ${blueprint.id} phase ${phase.kind} needs count >= 1`);
		}
	}
	assert(requiredAce <= 1, `Mission ${blueprint.id} can have at most one ace phase`);
}

export const MissionCatalog = {
	Get(id: number): MissionBlueprint {
		assert(id >= 1 && id <= MISSION_COUNT && id % 1 === 0, `Unknown mission id: ${tostring(id)}`);
		return MISSIONS[id - 1];
	},
	All(): MissionBlueprint[] {
		return MISSIONS;
	},
	ByAct(act: Act): MissionBlueprint[] {
		return MISSIONS.filter((blueprint) => blueprint.act === act);
	},
	IsValidId(value: unknown): value is number {
		return typeIs(value, "number") && value === value && value % 1 === 0 && value >= 1 && value <= MISSION_COUNT;
	},
	/** Required air kills across all `required_air` phases plus 1 for an ace phase. */
	RequiredAirKills(blueprint: MissionBlueprint): number {
		let total = 0;
		for (const phase of blueprint.phases) {
			if (phase.kind === "required_air") total += phase.count ?? 0;
			else if (phase.kind === "ace") total += 1;
		}
		return total;
	},
	/** Required ground kills across all `required_ground` phases, plus the tutorial radar. */
	RequiredGroundKills(blueprint: MissionBlueprint): number {
		let total = 0;
		for (const phase of blueprint.phases) {
			if (phase.kind === "required_ground") total += phase.count ?? 0;
			else if (phase.kind === "tutorial_missile") total += phase.count ?? 0;
		}
		return total;
	},
	/** Max optional raider spawns, summed across phases that permit them. */
	MaxOptionalRaiders(blueprint: MissionBlueprint): number {
		if (blueprint.optionalRaiderMax !== undefined) return blueprint.optionalRaiderMax;
		let total = 0;
		for (const phase of blueprint.phases) total += phase.optionalRaiders ?? 0;
		return total;
	},
};
