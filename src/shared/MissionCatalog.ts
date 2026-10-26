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
	| "ace"
	| "route"
	| "recon"
	| "signal"
	| "escort"
	| "defend";

/** A radio line fired once when the phase progress fraction crosses `at` (0-1). */
export interface PhaseChatter { at: number; text: string }
/** Optional raiders spawned mid-phase when the progress fraction crosses `at`. */
export interface PhaseReinforcement { at: number; count: number }

export interface MissionPhaseBlueprint {
	kind: PhaseKind;
	/** Authored flight volume centers. Only server-observed aircraft positions count. */
	points?: FlightPoint[];
	radius?: number;
	seconds?: number;
	ceiling?: number;
	count?: number;
	label: string;
	tutorialStep?: "move" | "target" | "missile" | "";
	/**
	 * Total optional raiders that may spawn during this phase (visible in briefing).
	 * When `reinforce` is set, `optionalRaiders - reinforce.count` spawn at phase start.
	 */
	optionalRaiders?: number;
	/** Radio line sent to the HUD when this phase begins. */
	beat?: string;
	/** Radio lines fired as the phase progresses. */
	chatter?: PhaseChatter[];
	/** Mid-phase raider reinforcement; counts toward `optionalRaiders`. */
	reinforce?: PhaseReinforcement;
}

export interface FlightPoint { x: number; y: number; z: number }

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
	/** 1 short sentence: the story consequence shown on the debrief when the mission fails. */
	failure: string;
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
	/** Ace call sign shown on the HUD and used as the ace model name. */
	aceName?: string;
	/** Radio lines when the ace drops below 2/3 and 1/3 health. */
	aceStages?: string[];
	/** Legacy-hardcoded missions use their original CombatService code path. */
	legacy?: 1 | 2;
}

// ---------------------------------------------------------------------------
// Helpers for authoring succinct blueprints
// ---------------------------------------------------------------------------

interface MissionExtra { optionalRaiderMax?: number; aceHealth?: number; aceName?: string; aceStages?: string[]; legacy?: 1 | 2 }

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
	extra: MissionExtra = {},
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
		failure: "", // filled from FAILURE_OUTCOMES below
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
			{ kind: "tutorial_move", label: "Observe pitch and turn", tutorialStep: "move", beat: "Pitch and turn. Feel how she answers." },
			{ kind: "tutorial_target", label: "Cycle to the training target", tutorialStep: "target", beat: "Cycle targets. Mark the practice radar." },
			{ kind: "tutorial_missile", label: "Lock and fire a missile at the training radar", tutorialStep: "missile", count: 1, beat: "Hold the lock. Then fire." },
			{ kind: "required_air", label: "Intercept three bandits", count: 3, beat: "SERA: Three bandits inbound. Keep them off the field." },
		],
		[{ asset: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
		{ legacy: 1 },
	),
	M(
		2, 1, "Iron Coast", "IRON COAST", "coastal_city", "harbor_sunset",
		"Break the coastal strike force staging against Varda Rim",
		"Intercept three required bandits, destroy five coastal warehouses while raiders pursue, then down the faster armored ace.",
		"The coast is quiet. One tape keeps looping: 'They moved the fuel north. Follow the relays.'",
		[
			{ kind: "required_air", label: "Intercept three required bandits", count: 3, beat: "SERA: Three bandits over the harbor. Take them." },
			{ kind: "required_ground", label: "Destroy five warehouses", count: 5, optionalRaiders: 5, beat: "SERA: Five warehouses feed the raid. Burn them all." },
			{ kind: "ace", label: "Destroy the ace", beat: "SERA: Their lead is armored. Make every shot count." },
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
		"Recovery finds Teal's wrecked receiver. Its memory points back at our own training grounds.",
		[
			{ kind: "required_air", label: "Clear scout flight alpha", count: 2, beat: "SERA: Two scouts shadowing the rim. Clear them." },
			{ kind: "required_air", label: "Clear scout flight bravo", count: 2, beat: "SERA: Second pair breaking cover. Finish it." },
		],
		[],
	),
	M(
		4, 1, "Static Quarters", "STATIC QUARTERS", "canyon_airfield", "canyon_noon",
		"Silence an unlisted radar hidden inside the training grounds",
		"The receiver's log points at a rogue radar inside the training perimeter. Scan the compound for proof, then destroy it.",
		"The radar is gone, but a staff list on the console names three officers who should not have been there.",
		[
			{ kind: "required_ground", label: "Destroy the hidden rim radar", count: 1, beat: "SERA: Proof's recorded. Now kill the radar." },
			{ kind: "required_air", label: "Fend off the response flight", count: 3, beat: "SERA: They scrambled a flight. Hold the line." },
		],
		[{ asset: "radar", name: "RIM RADAR", x: -400, z: -600 }],
	),
	M(
		5, 1, "Orchard Line", "ORCHARD LINE", "upland_farm", "farm_morning",
		"Cover the orchard evacuation convoy",
		"Coup patrols are firing on the Teklan orchard evacuation. Stay with the trucks until they reach the upland road.",
		"The trucks make the road. A farmer hands you a seed tin: more tapes, and a map of the military silos.",
		[
			{ kind: "required_air", label: "Drive off the patrol flight", count: 4, beat: "SERA: Patrol over the orchard. Keep them off the trucks." },
		],
		[],
	),
	M(
		6, 1, "Grain Shadow", "GRAIN SHADOW", "upland_farm", "farm_overcast",
		"Destroy fuel grain silos stockpiling for the coup",
		"The patrol's fuel-grade grain is held in three silos above the orchards. Burn the stockpile before the next convoy leaves.",
		"The silos are collapsed. A farmer whispers that a courier runs the dust pass every evening.",
		[
			{ kind: "required_ground", label: "Destroy three fuel silos", count: 3, beat: "SERA: Marked silos only. That grain is fuel." },
			{ kind: "required_air", label: "Clear the orchard patrol", count: 2, beat: "SERA: A pair answering the smoke. Turn into them." },
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
		"The courier's packet holds tomorrow's coup orders and names the first relay: Node Kiro, on the plateau's edge.",
		[
			{ kind: "required_air", label: "Catch the four-ship messenger flight", count: 4, beat: "SERA: Courier flight in the dust. Four of them." },
		],
		[],
	),
	M(
		8, 1, "Rim Switch", "RIM SWITCH", "canyon_airfield", "canyon_dusk",
		"Hold Varda Rim through a coordinated counter-strike",
		"Varda's own control tower is suddenly listed as compromised. Hold the airfield while loyalist ground crews reclaim the tower.",
		"Varda is loyal again. The tower chief has one more thing: Vulture Lead is hunting the night approach for your aircraft.",
		[
			{ kind: "required_air", label: "Break the first assault wave", count: 3, beat: "SERA: Wave one in the open. Break it." },
			{ kind: "required_air", label: "Break the second assault wave", count: 3, optionalRaiders: 2, beat: "SERA: Second wave, raiders trailing. Hold Varda." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		9, 1, "Static Horizon", "STATIC HORIZON", "canyon_pass", "canyon_night",
		"Night sweep over the pass; Vulture Lead is waiting",
		"The recording ends in a shouted call sign: Vulture Lead. He is flying tonight over the pass, hunting the witness Teal left behind.",
		"Vulture Lead is down. His recorder holds Teal's transmission, cut off mid-word: 'The relays run from the farms to the harbors.'",
		[
			{ kind: "required_air", label: "Clear the night patrol", count: 3, beat: "SERA: Three on night vision. Watch your horizon." },
			{ kind: "ace", label: "Defeat Vulture Lead", optionalRaiders: 2, beat: "Vulture Lead. He erased the witness. Not you." },
		],
		[],
		{
			aceHealth: 220, aceName: "VULTURE LEAD",
			aceStages: ["VULTURE LEAD: You fly like him. He died anyway.", "VULTURE LEAD: Enough. Wing, on me!"],
		},
	),

	// ----- Act II: Plateau Signal -----
	M(
		10, 2, "Plateau Cold", "PLATEAU COLD", "plateau_relay", "farm_overcast",
		"Scout and silence the first plateau relay",
		"Node Kiro sits above an abandoned mining camp. Scan its archive from low altitude, then cut the transmitter.",
		"Node Kiro falls. Loyalist traffic bleeds back onto the air. Two more relays listed on the farmer's tin.",
		[
			{ kind: "required_ground", label: "Cut Node Kiro's transmitter", count: 1, beat: "SERA: Archive copied. Cut the transmitter." },
			{ kind: "required_air", label: "Intercept the plateau response", count: 2, beat: "SERA: Response flight off the ridge. Two." },
		],
		[{ asset: "comms_relay", name: "NODE KIRO", x: 180, z: -1100 }],
	),
	M(
		11, 2, "Signal Harvest", "SIGNAL HARVEST", "upland_farm", "farm_sunset",
		"Harvest two more relays flanking the farm belt",
		"Nodes Lira and Merel sit on opposing ridges. Take both, then orbit the west ridge to relay Teal's packet to the farms.",
		"Two relays silenced in one sortie. A loyalist cell replies for the first time, offering coordinates for a staging comms farm.",
		[
			{ kind: "required_ground", label: "Destroy relay Node Lira", count: 1, beat: "SERA: Lira first. West ridge dish." },
			{ kind: "required_ground", label: "Destroy relay Node Merel", count: 1, beat: "SERA: Merel next. East ridge." },
			{ kind: "required_air", label: "Clear the alert pair", count: 2, beat: "SERA: Alert pair airborne. Clear them." },
		],
		[
			{ asset: "comms_relay", name: "NODE LIRA", x: -820, z: -780 },
			{ asset: "comms_relay", name: "NODE MEREL", x: 820, z: -780 },
		],
	),
	M(
		12, 2, "Open Field", "OPEN FIELD", "upland_farm", "farm_morning",
		"Escort the loyalist transmitter truck across the orchards",
		"Coup patrols are hunting the farms' only mobile transmitter. Stay with the truck until it clears the refugee corridor.",
		"Loyalist cells now have a working relay net. The next piece is their staging farm.",
		[
			{ kind: "required_air", label: "Occupy the orchard airspace", count: 4, optionalRaiders: 2, beat: "SERA: Patrol escalating. Own the airspace." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		13, 2, "Staging Farm", "STAGING FARM", "upland_farm", "farm_overcast",
		"Dismantle the coup's upland staging farm",
		"Four silos and a relay turned the farm belt into a staging ground. Scan it, then erase the marked stores.",
		"The staging farm is scorched. Resistance cells report the chain feeds into a plateau antenna array.",
		[
			{ kind: "required_ground", label: "Destroy four fuel silos and the relay", count: 5, beat: "SERA: Four silos and the relay. Marked only." },
			{ kind: "required_air", label: "Hold off two raiders", count: 2, beat: "SERA: Raiders off the plateau. Two." },
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
		"Three plateau antennas feed the coup's chain of command. Cross the saddle and blind them before the night ends.",
		"The chain is blind. The coup's inner planners switch to broken-up courier runs.",
		[
			{ kind: "required_ground", label: "Destroy three plateau antennas", count: 3, beat: "SERA: Three dishes on the ridge. Blind them." },
			{ kind: "required_air", label: "Clear the perimeter CAP", count: 3, beat: "SERA: Perimeter CAP turning in. Three." },
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
			{ kind: "required_air", label: "Hold the first intruders", count: 3, beat: "SERA: Intruders at the start of the window." },
			{ kind: "required_air", label: "Hold the second intruders", count: 3, optionalRaiders: 3, beat: "SERA: Second wave, riding harder. Raiders in tow." },
		],
		[],
		{ optionalRaiderMax: 3 },
	),
	M(
		16, 2, "Storm Walk", "STORM WALK", "upland_farm", "farm_storm",
		"Finish the staging ground while the storm covers you",
		"A thunderstorm masks the farm belt. Use the window to burn the last fuel staging site.",
		"The site is black. Two relays still talk on the plateau, and one of them carries the Marshal's real signature.",
		[
			{ kind: "required_ground", label: "Destroy three remaining silos", count: 3, beat: "SERA: Three silos under the storm. Burn them." },
			{ kind: "required_ground", label: "Destroy the forward relay", count: 1, beat: "SERA: Forward relay on the staging path. Cut it." },
			{ kind: "required_air", label: "Catch the storm patrol", count: 2, beat: "SERA: Patrol riding the thunder. Two." },
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
		"One relay remains hot under the aurora. Cut its dish, then hold the receive orbit while the archive speaks.",
		"The plateau is dark. The archive is signed: Air Marshal Rusk. Vulture Two is already challenging your call sign.",
		[
			{ kind: "required_ground", label: "Destroy the plateau relay", count: 1, beat: "SERA: One dish under the aurora. Cut it." },
			{ kind: "required_air", label: "Clear the aurora intercept", count: 4, beat: "SERA: Four intercepts lit by the aurora." },
		],
		[{ asset: "comms_relay", name: "AURORA RELAY", x: -100, z: -1400 }],
	),
	M(
		18, 2, "Ridge Ace", "RIDGE ACE", "plateau_relay", "relay_night",
		"Close act two against the plateau ace",
		"Vulture Two commands the plateau. He taught Teal to fly, and he knows your rim call signs.",
		"Vulture Two is down and alive. Marines have him. The coast is next.",
		[
			{ kind: "required_air", label: "Clear his wingmen", count: 3, beat: "SERA: His wingmen first. Three." },
			{ kind: "ace", label: "Defeat Vulture Two", optionalRaiders: 2, beat: "He flies like Teal. Teal learned it from him." },
		],
		[],
		{
			aceHealth: 260, aceName: "VULTURE TWO",
			aceStages: ["VULTURE TWO: I taught him that turn. Show me the answer.", "VULTURE TWO: Last lesson, trainee. Head on."],
		},
	),

	// ----- Act III: Coastal Fracture -----
	M(
		19, 3, "Harbor Run", "HARBOR RUN", "coastal_city", "harbor_fog",
		"First strike on the coup's harbor logistics",
		"The coup moved to the coast. Hit the harbor warehouses holding their last reserves.",
		"The harbor burns. The Air Marshal moves his flag deeper into the coastal city.",
		[
			{ kind: "required_ground", label: "Destroy three harbor warehouses", count: 3, beat: "SERA: Three military quays. Hit the warehouses." },
			{ kind: "required_air", label: "Clear the harbor CAP", count: 2, beat: "SERA: CAP off the apron. Two." },
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
		"Two wings share the coast. Shatter the eastern wing, then cover the evidence launch out through the harbor.",
		"The eastern wing is scattered. The Marshal rotates his personal escort to the open city.",
		[
			{ kind: "required_air", label: "Shatter the eastern wing", count: 5, beat: "SERA: Full wing on the east line. Five." },
		],
		[],
	),
	M(
		21, 3, "City Night", "CITY NIGHT", "coastal_city", "city_night",
		"Night strike on the Marshal's broadcast tower",
		"The Marshal's broadcast tower overlooks the city. Reduce it to silence.",
		"The city falls dark. For the first time in days, it hears nothing from Rusk.",
		[
			{ kind: "required_ground", label: "Destroy the broadcast relay", count: 1, beat: "SERA: Broadcast relay above the city. Dish only." },
			{ kind: "required_air", label: "Hold off the escort flight", count: 4, optionalRaiders: 2, beat: "SERA: Escort flight scrambling with raiders." },
		],
		[{ asset: "comms_relay", name: "BROADCAST RELAY", x: 0, z: -1300 }],
		{ optionalRaiderMax: 2 },
	),
	M(
		22, 3, "Harbor Fog", "HARBOR FOG", "coastal_harbor", "harbor_fog",
		"Finish the harbor in the fog",
		"Dense fog hides the last fuel depots. Burn them before the Marshal's convoy sails.",
		"The depots are burning. Without fuel, his escape fleet is stuck at the platform.",
		[
			{ kind: "required_ground", label: "Destroy five fuel depots", count: 5, beat: "SERA: Five depots in the fog. All marked." },
			{ kind: "required_air", label: "Clear the fog patrol", count: 3, beat: "SERA: Patrol riding the fog. Three." },
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
		"Hold the frigate ring around the Marshal's platform",
		"Loyalist frigates have ringed the offshore platform. Keep raiders off the command frigate until the blockade closes, then clear the platform's command flight.",
		"The ring held. The command frigate signals: no fuel ships in or out.",
		[
			{ kind: "required_air", label: "Clear the platform CAP", count: 5, optionalRaiders: 3, beat: "SERA: Platform CAP, five, raiders trailing." },
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
			{ kind: "required_ground", label: "Destroy three platform warehouses", count: 3, beat: "SERA: Three stores on the deck. Burn them." },
			{ kind: "required_air", label: "Clear the storm patrol", count: 3, beat: "SERA: Patrol in the storm shadow. Three." },
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
			{ kind: "required_air", label: "Hold the first intercept", count: 3, beat: "SERA: First intercept off the apron. Three." },
			{ kind: "required_air", label: "Hold the second intercept", count: 3, optionalRaiders: 3, beat: "SERA: Second wave with raiders. Hold the beach." },
			{ kind: "required_ground", label: "Destroy the beach relay", count: 1, beat: "SERA: Beach relay is still directing fire. Cut it." },
		],
		[{ asset: "comms_relay", name: "BEACH RELAY", x: 0, z: -1250 }],
		{ optionalRaiderMax: 3 },
	),
	M(
		26, 3, "Fracture Last", "FRACTURE LAST", "coastal_city", "city_night",
		"Trap the Marshal's wing between you and the city",
		"The Marshal's wing is airborne over the civic plaza. Pin it against the city, then triangulate his last transmission.",
		"The wing is broken. Only the Marshal's own flight remains.",
		[
			{ kind: "required_air", label: "Break the Marshal's first flight", count: 4, beat: "SERA: His wing splits. First group, four." },
			{ kind: "required_air", label: "Break the second flight", count: 4, optionalRaiders: 2, beat: "SERA: Second group covering his approach." },
		],
		[],
		{ optionalRaiderMax: 2 },
	),
	M(
		27, 3, "Broken Relay", "BROKEN RELAY", "coastal_city", "city_dawn",
		"Confront the Air Marshal and finish the broadcast",
		"The Marshal is airborne over the city. Finish the fight Teal started, then broadcast your own clear signal.",
		"The coup is broken. Rusk is in custody. Loyalist pilots take the air, and your broadcast closes: 'For Teal. For the rim.'",
		[
			{ kind: "required_air", label: "Clear the Marshal's wingmen", count: 3, beat: "His wingmen first. Then him." },
			{ kind: "required_ground", label: "Destroy the final broadcast relay", count: 1, beat: "SERA: His relay is still broadcasting. Cut it." },
			{ kind: "ace", label: "Defeat the Air Marshal", optionalRaiders: 3, beat: "That's his jet. Teal's voice on his tapes. Bring him down." },
		],
		[{ asset: "comms_relay", name: "MARSHAL RELAY", x: 0, z: -1350 }],
		{
			aceHealth: 320, aceName: "AIR MARSHAL RUSK",
			aceStages: ["RUSK: Every relay says I am the law. Yours is a child's radio.", "RUSK: Teal obeyed until the one order that mattered. Turn back."],
		},
	),
];


// These are flying objectives, not narrative gates: the server checks swept
// checkpoint crossings, altitude, time on station, and the protected vehicle.
interface FlyExtra { beat?: string; chatter?: PhaseChatter[]; reinforce?: PhaseReinforcement }
function fly(kind: "route" | "recon" | "signal" | "escort" | "defend", label: string, points: number[][], seconds = 0, optionalRaiders = 0, ceiling?: number, extra: FlyExtra = {}): MissionPhaseBlueprint {
	return { kind, label, points: points.map((p) => ({ x: p[0], y: p[1], z: p[2] })),
		radius: kind === "route" ? 210 : kind === "recon" ? 420 : 1000,
		seconds, optionalRaiders, ceiling, beat: extra.beat, chatter: extra.chatter, reinforce: extra.reinforce };
}
function before(id: number, phase: MissionPhaseBlueprint): void { MISSIONS[id - 1].phases.unshift(phase); }
function after(id: number, phase: MissionPhaseBlueprint): void { MISSIONS[id - 1].phases.push(phase); }
before(3, fly("route", "Follow Teal's beacons", [[-280,240,-150],[-850,280,-900],[-400,350,-1700]], 0, 0, undefined,
	{ beat: "TEAL (tape): Stay low on the switchback.", chatter: [{ at: 0.66, text: "TEAL (tape): Third beacon's the one I nearly missed." }] }));
before(4, fly("recon", "Scan the quarters: stay low", [[-400,260,-600]], 7, 0, 380,
	{ beat: "BROADCAST: All Varda units stand down. Authority: Air Marshal.", chatter: [{ at: 0.5, text: "SERA: Stand down? Nobody at Varda issued that." }] }));
MISSIONS[4].phases = [fly("escort", "Cover the orchard evacuation trucks", [[-1000,70,-300],[0,70,-850],[1200,70,-300]], 55, 4, undefined,
	{ beat: "FARMER: Trucks rolling. Please stay with us.", chatter: [{ at: 0.5, text: "SERA: Second flight off the ridge. Turn back now." }], reinforce: { at: 0.5, count: 2 } })];
before(6, fly("route", "Follow the farm irrigation channel", [[500,230,0],[850,250,-700],[250,240,-1550]], 0, 0, undefined,
	{ beat: "SERA: Follow the channel. The marked tanks sit at its end.", chatter: [{ at: 0.5, text: "FARMER: The unmarked roofs are ours. Please." }] }));
before(7, fly("route", "Run the dust pass low", [[-450,240,-200],[-900,300,-1000],[-200,300,-1850]], 0, 0, 400,
	{ beat: "SERA: The courier runs under the dust. Stay in it.", chatter: [{ at: 0.66, text: "SERA: Four escorts ahead of him. Dust is thinning." }] }));
MISSIONS[7].phases = [fly("defend", "Protect Varda's control tower for 50 seconds", [[-650,240,300]], 50, 4, undefined,
	{ beat: "SERA: Tower crew resetting the code. Fifty seconds.", chatter: [{ at: 0.5, text: "BROADCAST: Varda tower is in rebel hands. Fire on it." }, { at: 0.55, text: "SERA: Ignore that. It's him." }], reinforce: { at: 0.45, count: 2 } }),
	{ kind:"required_air", label:"Clear the retreating pair", count:2, beat: "SERA: Code is ours. Catch the pair running." }];
before(9, fly("route", "Follow the night approach lights", [[500,350,-100],[900,420,-850],[0,450,-1700]], 0, 0, undefined,
	{ beat: "SERA: The approach lights are his bait. Fly them anyway.", chatter: [{ at: 0.66, text: "VULTURE LEAD: Teal flew this line too. Keep coming." }] }));
before(10, fly("recon", "Scan Node Kiro (hold fire)", [[180,300,-1100]], 9, 2, 450,
	{ beat: "SERA: Scan the archive first. The dish can wait.", chatter: [{ at: 0.5, text: "SERA: Signatures copying. Stay low. Hold fire." }] }));
after(11, fly("signal", "Orbit the west ridge to relay Teal's packet", [[-820,400,-780]], 18, 2, undefined,
	{ beat: "SERA: Relaying Teal's packet. Hold the ridge orbit.", chatter: [{ at: 0.5, text: "FARMER: We're hearing it. Keep it coming." }] }));
MISSIONS[11].phases = [fly("escort", "Escort the loyalist transmitter truck", [[-1200,65,100],[-500,65,-900],[900,65,-1300]], 65, 4, undefined,
	{ beat: "TRUCK: Transmitter rolling. The corridor is full of refugees.", chatter: [{ at: 0.5, text: "SERA: Second flight coming for the truck." }], reinforce: { at: 0.5, count: 2 } })];
before(13, fly("recon", "Scan the staging farm low", [[0,300,-1000]], 10, 2, 420,
	{ beat: "SERA: Mark the stores. Civilian roofs stay standing.", chatter: [{ at: 0.5, text: "SERA: Fuel ledger confirmed. Those silos are military." }] }));
before(14, fly("route", "Cross the relay saddle through four beacons", [[-500,320,-100],[-1000,450,-700],[0,550,-1200],[1000,430,-1500]], 0, 0, undefined,
	{ beat: "SERA: Saddle beacons lead to the arrays. Climb.", chatter: [{ at: 0.5, text: "SERA: All three arrays can hear you now." }, { at: 0.75, text: "BROADCAST: Unknown aircraft on the saddle. Intercept." }] }));
MISSIONS[14].phases = [fly("signal", "Hold the broadcast link", [[0,420,-900]], 35, 4, undefined,
	{ beat: "LOYALIST: Transmitting. Every second is a garrison.", chatter: [{ at: 0.5, text: "SERA: Jammers inbound. Stay inside the volume." }] }),
	{kind:"required_air",label:"Intercept the jamming flight",count:3, beat: "SERA: Broadcast landed. Now the jammers. Three."}];
before(16, fly("route", "River gates: stay low", [[400,220,0],[800,240,-750],[0,280,-1450]],0,0,400,
	{ beat: "SERA: River gates keep you under the storm. Stay low.", chatter: [{ at: 0.66, text: "SERA: Last gate. The marked tanks are just past it." }] }));
after(17, fly("signal", "Orbit to receive the archive", [[-100,500,-1400]], 22, 2, undefined,
	{ beat: "TEAL (tape): If you hear this up here, read the signature.", chatter: [{ at: 0.5, text: "SERA: The archive is speaking. Signature decoding." }] }));
before(18, fly("route", "Climb into Vulture Two's searchlights", [[-500,350,-250],[0,600,-1100],[600,650,-1550]], 0, 0, undefined,
	{ beat: "VULTURE TWO: Climb into my lights, trainee.", chatter: [{ at: 0.66, text: "VULTURE TWO: Teal climbed faster. Show me more." }] }));
before(19, fly("recon", "Scan the quays; spare the city", [[-500,270,-900],[500,270,-900]], 6, 1, 420,
	{ beat: "SERA: Watch what the cranes unload. Mark the quays.", chatter: [{ at: 0.5, text: "SERA: Those crates are munitions. The quays are military." }] }));
after(20, fly("escort", "Cover the evidence launch through the harbor", [[-1200,40,-600],[0,40,-1350],[1400,40,-800]], 60, 4, undefined,
	{ beat: "MARINE: Paper's aboard. Keep the sky quiet.", chatter: [{ at: 0.5, text: "SERA: Western wing reacting. Launch is halfway out." }], reinforce: { at: 0.5, count: 2 } }));
before(21, fly("route", "Follow the dark canal through the city", [[-400,250,-100],[-900,300,-700],[0,320,-1500]],0,0,430,
	{ beat: "SERA: The dark canal keeps you off his radar. Follow it.", chatter: [{ at: 0.66, text: "SERA: Relay above the apartments. Hit only the dish." }] }));
before(22, fly("recon", "Find the depots through the fog", [[-520,250,-850],[520,250,-850]], 8, 2, 400,
	{ beat: "SERA: The fog depots carry his signature. Find them.", chatter: [{ at: 0.5, text: "SERA: Permits match. Every depot is fuel." }] }));
MISSIONS[22].phases = [fly("defend", "Defend the command frigate", [[0,300,-1100]], 65, 4, undefined,
	{ beat: "FRIGATE: Ring closing. Raiders on the bow.", chatter: [{ at: 0.5, text: "FRIGATE: Second group off the platform. Hold them." }], reinforce: { at: 0.5, count: 2 } }),
	{kind:"required_air",label:"Clear the platform command flight",count:3, beat: "FRIGATE: Ring closed. Command flight launching. Three."}];
before(24, fly("route", "Low sea approach: under the storm", [[-700,220,-100],[-1000,240,-750],[0,260,-1700]],0,0,360,
	{ beat: "SERA: Under the storm. Three gates to the platform.", chatter: [{ at: 0.66, text: "SERA: Last gate. The deck stores are ahead." }] }));
MISSIONS[24].phases.unshift(fly("escort", "Cover the landing craft to the beach", [[-1200,40,200],[-650,40,-500],[200,40,-900]], 70, 4, undefined,
	{ beat: "LANDING CRAFT: Beach in seventy. Keep them off us.", chatter: [{ at: 0.5, text: "SERA: Second intercept launching. Stay on the craft." }], reinforce: { at: 0.5, count: 2 } }));
after(26, fly("signal", "Triangulate the Marshal's last transmission", [[0,600,-1200]], 28, 2, undefined,
	{ beat: "TEAL (recorder): ...lane's open. Tell Sera I made the checkout.", chatter: [{ at: 0.5, text: "SERA: Triangulating. He's above the parliament transmitter." }] }));
after(27, fly("signal", "Broadcast Teal's evidence to the whole coast", [[0,500,-1350]], 30, 0, undefined,
	{ beat: "SERA: You're on every frequency. Say it your way.", chatter: [{ at: 0.5, text: "HARBOR: Loyalist pilots answering. Every harbor." }] }));
// Debrief text when a sortie fails, by mission id: what the coup gains if you do not finish.
const FAILURE_OUTCOMES = [
	"The bandits reach the field. Varda Rim is grounded and Teal's recordings stay locked away.",
	"The strike force stages unopposed. The coast keeps fuelling the raid on Varda Rim.",
	"The scouts close the ridge. Teal's last flight path goes cold.",
	"The rogue radar keeps watching Varda. The officers behind it stay hidden.",
	"The convoy is caught on the open road. The orchard families never reach the uplands.",
	"The fuel grain ships north. The coup's patrols stay supplied.",
	"The courier reaches the plateau. Tomorrow's coup orders go out on time.",
	"Varda's tower stays in coup hands, and the rim airfield goes with it.",
	"Vulture Lead holds the pass. Teal's final transmission stays buried with the witness.",
	"Node Kiro keeps transmitting. Loyalist traffic stays jammed.",
	"Lira and Merel keep the farm belt deaf. Teal's packet never reaches the loyalists.",
	"The transmitter truck is lost. The loyalist cells have no relay net.",
	"The staging farm keeps feeding the coup's fuel chain.",
	"The antenna row stays lit. The coup's chain of command stays intact.",
	"The broadcast is jammed. The garrisons stay with the coup.",
	"The last staging site survives the storm and the fuel keeps moving.",
	"The aurora relay stays hot. The Marshal's signature stays hidden.",
	"Vulture Two holds the plateau. The road to the coast stays shut.",
	"The harbor reserves survive. The coup keeps its coastal logistics.",
	"The Marshal's air cover holds together. The evidence never leaves the harbor.",
	"The broadcast tower keeps talking. The city hears only Rusk.",
	"The fuel depots survive the fog. The Marshal's convoy sails.",
	"The ring breaks. Fuel ships slip through to the platform.",
	"The platform reserves survive. The Marshal can wait out the blockade.",
	"The landing is pushed back into the sea. The city stays in coup hands.",
	"The Marshal's wing escapes the city. His last flight stays protected.",
	"Rusk escapes. The coup survives, and Teal's evidence is never heard.",
];
assert(FAILURE_OUTCOMES.size() === MISSIONS.size(), "Every mission needs a failure outcome");
for (let index = 0; index < MISSIONS.size(); index++) MISSIONS[index].failure = FAILURE_OUTCOMES[index];

// Recompute optional counts after authored flight objectives are installed.
for (const mission of MISSIONS) {
	let optional = 0;
	for (const phase of mission.phases) optional += phase.optionalRaiders ?? 0;
	mission.optionalRaiderMax = optional;
}

export const MISSION_COUNT = MISSIONS.size();

/** Display names for the three campaign acts (see the story outline above). */
export const ACT_NAMES: { readonly [act: number]: string } = { 1: "RIM STATIC", 2: "PLATEAU SIGNAL", 3: "COASTAL FRACTURE" };
export const ACT_NUMERALS: { readonly [act: number]: string } = { 1: "I", 2: "II", 3: "III" };
export const ACTS: Act[] = [1, 2, 3];

/** Briefing location line, e.g. "COASTAL CITY". */
export const REGION_NAMES: { readonly [region: string]: string } = {
	canyon_airfield: "CANYON AIRFIELD",
	canyon_pass: "CANYON PASS",
	upland_farm: "UPLAND FARMS",
	plateau_relay: "PLATEAU RELAY",
	coastal_city: "COASTAL CITY",
	coastal_harbor: "COASTAL HARBOR",
	ocean_platform: "OCEAN PLATFORM",
};

/** Time-of-day or weather word of an environment preset: "harbor_sunset" -> "SUNSET". */
export function environmentName(environment: EnvironmentPreset): string {
	const parts = environment.split("_");
	return string.upper(parts[parts.size() - 1]);
}

// Validate at module load so a bad authoring edit fails the server immediately.
assert(MISSION_COUNT === 27, "Broken Relay must ship 27 missions");
for (let index = 0; index < MISSIONS.size(); index++) {
	const blueprint = MISSIONS[index];
	const id = blueprint.id;
	assert(id === index + 1, `Mission ${index + 1} must have id ${index + 1}`);
	assert(blueprint.phases.size() >= 1, `Mission ${id} must have at least one phase`);
	assert(blueprint.failure.size() > 0 && blueprint.failure.size() <= 120, `Mission ${id} needs a short failure outcome`);
	let requiredAce = 0;
	let groundCount = 0;
	for (const phase of blueprint.phases) {
		const tag = `Mission ${id} phase ${phase.kind}`;
		if (phase.kind === "ace") requiredAce += 1;
		if (phase.kind === "required_air" || phase.kind === "required_ground") {
			assert((phase.count ?? 0) >= 1, `${tag} needs count >= 1`);
		}
		if (phase.kind === "required_ground") groundCount += phase.count ?? 0;
		if (phase.kind === "tutorial_missile") { assert(id === 1, `${tag} is only valid on Mission 1`); groundCount += phase.count ?? 0; }
		if (phase.points) {
			assert(phase.points.size() > 0, `${tag} needs at least one point`);
			for (const point of phase.points) {
				assert(math.abs(point.x) <= 2400 && math.abs(point.z) <= 2400, `${tag} point is outside the flyable area`);
				assert(point.y >= 40 && point.y <= 900, `${tag} point altitude is outside 40-900`);
			}
			assert((phase.radius ?? 0) > 0, `${tag} needs radius > 0`);
			if (phase.kind === "recon" || phase.kind === "signal" || phase.kind === "escort" || phase.kind === "defend") {
				assert((phase.seconds ?? 0) > 0, `${tag} needs seconds > 0`);
			}
			if (phase.ceiling !== undefined) assert(phase.ceiling >= 230, `${tag} ceiling must be >= 230`);
		}
		if (phase.reinforce) {
			assert(phase.reinforce.count >= 1 && phase.reinforce.count <= (phase.optionalRaiders ?? 0), `${tag} reinforce.count must fit within optionalRaiders`);
			assert(phase.reinforce.at >= 0 && phase.reinforce.at <= 1, `${tag} reinforce.at must be within 0-1`);
		}
		if (phase.chatter) for (const line of phase.chatter) {
			assert(line.at >= 0 && line.at <= 1, `${tag} chatter.at must be within 0-1`);
			assert(line.text.size() > 0, `${tag} chatter needs text`);
		}
	}
	assert(groundCount === blueprint.ground.size(), `Mission ${id} required_ground counts (${groundCount}) must match its ground targets (${blueprint.ground.size()})`);
	assert(requiredAce <= 1, `Mission ${id} can have at most one ace phase`);
	if (blueprint.aceStages) assert(requiredAce === 1, `Mission ${id} has ace stages without an ace phase`);
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
