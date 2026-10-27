// Pure authoritative mission data shared by the server runner, UI, and tests.
// Mission 1 and 2 keep their legacy hardcoded paths (see MissionRules); their
// catalog entries describe the same objectives for the UI and story only.
//
// All 27 missions share the wall-clock deadline in GameConfig.Campaign.MissionTimeLimit
// and contribute to the four-slot save profile. Missions 3-27 are driven by their
// blueprint phase sequence in BlueprintRunner.
import { WavePlan } from "./WavePlan";

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
	| "defend"
	// A fast, non-firing courier that runs for `escape`; it escapes (mission failed) after `seconds`.
	| "chase";

/** A radio line fired once when the phase progress fraction crosses `at` (0-1). */
export interface PhaseChatter { at: number; text: string }
/** Optional raiders spawned mid-phase when the progress fraction crosses `at`. */
export interface PhaseReinforcement { at: number; count: number }
/**
 * Ground targets that light up during a timed phase once its progress fraction reaches `at`
 * (they stay hidden until then). They are required kills. While any is alive, "jam" freezes a
 * signal hold's timer and "guns" fire on the protected convoy or site (each drains like 1.5
 * raiders); the phase cannot complete until they are destroyed.
 */
export interface PhaseHazard { at: number; count: number; text: string; effect: "jam" | "guns" }
/**
 * A mid-phase twist: when the phase progress fraction reaches `at` (0-1; 1 fires as the
 * phase completes), the radio plays `text` and `insert` is spliced into the mission right
 * after this phase. Mode "after" (default) lets the current phase finish first; mode "now"
 * ends the current phase on the spot so the inserted objectives take over immediately.
 * Inserted phases are ordinary blueprints; they may not carry twists of their own.
 */
export interface PhaseTwist { at: number; text: string; insert: MissionPhaseBlueprint[]; mode?: "after" | "now" }

export interface MissionPhaseBlueprint {
	kind: PhaseKind;
	/** Authored flight volume centers. Only server-observed aircraft positions count. */
	points?: FlightPoint[];
	radius?: number;
	seconds?: number;
	ceiling?: number;
	/** A stopped escort remains visible here during recon, signal or route work. */
	parkedEscort?: FlightPoint;
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
	/** Mid-phase raider reinforcements, in `at` order; they count toward `optionalRaiders`. */
	reinforce?: PhaseReinforcement[];
	/** Objective change fired once mid-phase: a radio call plus phases inserted after this one. */
	twist?: PhaseTwist;
	/** `required_air`: split `count` into this many staggered groups (see WavePlan). */
	groups?: number;
	/** `required_air`: seconds between groups (a group also comes in once half the last one is down). */
	stagger?: number;
	/** `required_air`: groups after the first arrive from behind the player. */
	flank?: boolean;
	/**
	 * `required_air`: authored triggers for groups 1.. as a share (0-1) of the whole phase down. Such a
	 * group waits for its share, never for `stagger` or the half-of-the-last-group rule.
	 */
	groupAt?: number[];
	/** `required_air`: radio lines for groups 1.., said when the group actually spawns. */
	groupCalls?: string[];
	/** Timed phases: ground jammers or guns that light up mid-phase (see PhaseHazard). */
	hazard?: PhaseHazard;
	/** `chase`: where the courier runs. */
	escape?: FlightPoint;
	/** A ground radar is directing this phase's flight: the hostile fire gate is halved while it lasts. */
	directed?: boolean;
	/** `required_ground`: the targets stay hidden (and out of the world's radar) until the phase begins. */
	hidden?: boolean;
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
	/** Radio lines when the ace drops below 2/3 and 1/3 health (it breaks off and calls its wing). */
	aceStages?: string[];
	/** Radio lines when the ace turns back in after each retreat. */
	aceReturns?: string[];
	/** Legacy-hardcoded missions use their original CombatService code path. */
	legacy?: 1 | 2;
}

// ---------------------------------------------------------------------------
// Helpers for authoring succinct blueprints
// ---------------------------------------------------------------------------

interface MissionExtra { optionalRaiderMax?: number; aceHealth?: number; aceName?: string; aceStages?: string[]; aceReturns?: string[]; legacy?: 1 | 2 }

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

// Flying objectives, not narrative gates: the server checks swept checkpoint
// crossings, altitude, time on station, and the protected vehicle.
interface FlyExtra { directed?: boolean; parkedEscort?: FlightPoint; beat?: string; chatter?: PhaseChatter[]; reinforce?: PhaseReinforcement[]; twist?: PhaseTwist; hazard?: PhaseHazard }
function fly(kind: "route" | "recon" | "signal" | "escort" | "defend", label: string, points: number[][], seconds = 0, optionalRaiders = 0, ceiling?: number, extra: FlyExtra = {}): MissionPhaseBlueprint {
	return { kind, label, points: points.map((p) => ({ x: p[0], y: p[1], z: p[2] })),
		radius: kind === "route" ? 210 : kind === "recon" ? 420 : 1000,
		seconds, optionalRaiders, ceiling, directed: extra.directed, parkedEscort: extra.parkedEscort, beat: extra.beat, chatter: extra.chatter, reinforce: extra.reinforce, twist: extra.twist, hazard: extra.hazard };
}
interface AirExtra { groups?: number; stagger?: number; flank?: boolean; groupAt?: number[]; groupCalls?: string[]; optionalRaiders?: number; reinforce?: PhaseReinforcement[]; chatter?: PhaseChatter[]; twist?: PhaseTwist; directed?: boolean }
/** A required air phase: `count` bandits, optionally in staggered groups, with raiders and reinforcements. */
function air(label: string, count: number, beat: string, extra: AirExtra = {}): MissionPhaseBlueprint {
	return { kind: "required_air", label, count, beat, groups: extra.groups, stagger: extra.stagger, flank: extra.flank,
		groupAt: extra.groupAt, groupCalls: extra.groupCalls, optionalRaiders: extra.optionalRaiders, reinforce: extra.reinforce, chatter: extra.chatter, twist: extra.twist, directed: extra.directed };
}
interface GroundExtra { optionalRaiders?: number; reinforce?: PhaseReinforcement[]; chatter?: PhaseChatter[]; twist?: PhaseTwist; directed?: boolean; hidden?: boolean }
/** A required ground strike on the next `count` targets of the mission's ground list. */
function ground(label: string, count: number, beat: string, extra: GroundExtra = {}): MissionPhaseBlueprint {
	return { kind: "required_ground", label, count, beat, optionalRaiders: extra.optionalRaiders, reinforce: extra.reinforce,
		chatter: extra.chatter, twist: extra.twist, directed: extra.directed, hidden: extra.hidden };
}
/** A courier chase: one fast non-firing target that runs for `escape` and gets away after `seconds`. */
function chase(label: string, seconds: number, escape: number[], beat: string, chatter: PhaseChatter[], optionalRaiders = 0): MissionPhaseBlueprint {
	return { kind: "chase", label, count: 1, seconds, escape: { x: escape[0], y: escape[1], z: escape[2] }, beat, chatter, optionalRaiders };
}

export const MISSIONS: MissionBlueprint[] = [
	// ----- Act I: Rim Static -----
	// Act I alternates recovery, reconnaissance, flight and combat. Normal bandits
	// take two missiles, with one flight threat at a time; early sorties use the gentle gate.
	M(
		1, 1, "Rim Static", "FIRST FLIGHT", "canyon_airfield", "canyon_noon",
		"Complete flight training and repel a probing attack",
		"Trainee pilot checkout at Varda Rim. Turn and pitch, cycle to the training radar, lock and hit it, then intercept three bandits probing the rim.",
		"Varda Rim held. The quartermaster hands you a sealed case of your missing mentor's radio recordings.",
		[
			{ kind: "tutorial_move", label: "Practice short turn and pitch taps", tutorialStep: "move", beat: "Tap turn and pitch briefly. Three seconds TOTAL each; impacts reset you." },
			{ kind: "tutorial_target", label: "Cycle to the training target", tutorialStep: "target", beat: "Select radar: TGT / Tab / Y. Follow marker; turn back if you pass it." },
			{ kind: "tutorial_missile", label: "Lock and hit the training radar", tutorialStep: "missile", count: 1, beat: "Aim for LOCK, then FIRE / Space / RT. Pull up after firing." },
			{ kind: "required_air", label: "Intercept three bandits", count: 3, beat: "Bandits in 4s. Protection ends on arrival; impacts then fatal." },
		],
		[{ asset: "radar", name: "TRAINING RADAR", x: 0, z: -850 }],
		{ legacy: 1 },
	),
	M(
		2, 1, "Iron Coast", "IRON COAST", "coastal_city", "harbor_sunset",
		"Break the coastal strike force staging against Varda Rim",
		"Intercept the three-bandit screen, destroy five coastal warehouses while raiders pursue, then down the faster armored ace.",
		"The coast is quiet. One tape keeps looping: 'They moved the fuel north. Follow the relays.'",
		[
			{ kind: "required_air", label: "Intercept the three-bandit screen", count: 3, beat: "SERA: Three bandits over the harbor. Take them." },
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
		"Follow Teal's beacons, mark his receiver on a low scan, and clear the scouts between his two canyon routes. Keep a recovery link open until the receiver is reached.",
		"Recovery reaches the marked receiver with your radio guidance. Its memory points back at our own training grounds.",
		[
			fly("route", "Follow Teal's beacons", [[-280,240,-150],[-850,280,-900],[-400,350,-1700]], 0, 0, undefined,
				{ beat: "TEAL (tape): Stay low on the switchback.", chatter: [{ at: 0.66, text: "TEAL (tape): Third beacon's the one I nearly missed." }] }),
			fly("recon", "Locate Teal's receiver below the rim", [[-400,260,-1700],[-650,260,-1100]], 8, 0, 380,
				{ beat: "SERA: Scan below the beacons. Recovery needs the receiver marked.", chatter: [{ at: 0.5, text: "SERA: Receiver echo below the second beacon. Keep scanning." }] }),
			air("Clear scout flight alpha", 2, "SERA: Two scouts shadowing the rim. Clear the pair.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("route", "Teal's river run: stay under 320", [[-550,240,-650],[-150,250,-250],[350,260,-800]], 0, 0, 320,
				{ beat: "TEAL (tape): Under three-twenty along the river. Stay out of sight.", chatter: [{ at: 0.66, text: "SERA: Bravo flight is hunting the river. Last gate, then turn." }] }),
			air("Clear scout flight bravo", 3, "SERA: Bravo flight breaking cover. Three, in two groups. Clear them.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Guide recovery onto the receiver", [[-400,420,-1200]], 20, 0, undefined,
				{ beat: "RECOVERY: We have your mark. Keep the link open while we reach it.", chatter: [{ at: 0.5, text: "RECOVERY: Receiver in sight. We are climbing down now." }] }),
		],
		[],
	),
	M(
		4, 1, "Static Quarters", "STATIC QUARTERS", "canyon_airfield", "canyon_noon",
		"Silence an unlisted radar hidden inside the training grounds",
		"Scan the rogue training radar for proof, destroy it, and follow the service-road beacons clear. Defeat its response flight, then send the staff list to Varda.",
		"Varda records all three names before anyone can erase them. The list leads to the orchard witnesses.",
		[
			fly("recon", "Scan the quarters: stay under 380", [[-400,260,-600],[-750,260,-300],[-150,260,-250]], 7, 0, 380,
				{ beat: "BROADCAST: All Varda units stand down. Authority: Air Marshal.", chatter: [{ at: 0.5, text: "SERA: Stand down? Nobody at Varda issued that." }] }),
			ground("Destroy the hidden rim radar", 1, "SERA: Proof's recorded. Now kill the radar.", { optionalRaiders: 1 }),
			fly("route", "Follow the quarters service road", [[-700,260,-400],[0,300,-200],[600,330,-900]], 0, 0, undefined,
				{ beat: "SERA: Evidence copied. Follow the service road clear.", chatter: [{ at: 0.5, text: "SERA: Road is clear ahead. Keep to the beacon line." }] }),
			air("Fend off the response flight", 5, "SERA: They scrambled a flight. Five, in two groups. Hold the line.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Send the staff list to Varda", [[-200,420,-800]], 20, 1, undefined,
				{ beat: "SERA: Varda is copying the names. Hold the link.", chatter: [{ at: 0.5, text: "TOWER: First two names copied. Send the third." }] }),
		],
		[{ asset: "radar", name: "RIM RADAR", x: -400, z: -600 }],
	),
	M(
		5, 1, "Orchard Line", "ORCHARD LINE", "upland_farm", "farm_morning",
		"Cover the orchard evacuation convoy",
		"Cover the orchard trucks to the upland road and drive off the patrol leads. Check both bends for stragglers, report the families' names, and guide the seed tin toward the rim.",
		"Every family is accounted for at Varda. The seed tin and its map of military silos leave the orchard safely.",
		[
			fly("escort", "Cover the orchard evacuation trucks", [[-1000,70,-300],[0,70,-850],[1200,70,-300]], 100, 4, undefined,
				{ beat: "FARMER: Trucks rolling. Please stay with us.", chatter: [{ at: 0.5, text: "SERA: Second flight off the ridge. Turn back now." }, { at: 0.85, text: "FARMER: The road's in sight. Don't leave us yet." }], reinforce: [{ at: 0.5, count: 2 }] }),
			air("Drive off the patrol leads", 3, "SERA: Trucks are clear. Their patrol leads are turning in. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Check the evacuation road is empty", [[900,280,-300],[300,280,-700]], 6, 0, 400,
				{ beat: "FARMER: One truck lost its radio. Check both bends for stragglers.", chatter: [{ at: 0.5, text: "FARMER: One bend clear. Check behind the orchard wall too." }] }),
			fly("signal", "Pass the families' names to Varda", [[200,420,-700]], 20, 0, undefined,
				{ beat: "SERA: All trucks counted. Hold the link for the families' names.", chatter: [{ at: 0.5, text: "TOWER: Names copied. Finding beds for the children now." }] }),
			fly("route", "Bring the seed tin toward the rim", [[0,320,-300],[-600,340,100]], 0, 0, undefined,
				{ beat: "FARMER: Seed tin is aboard. Follow our homeward beacons.", chatter: [{ at: 0.5, text: "FARMER: The lead truck sees your lights. Keep leading." }] }),
		],
		[],
	),
	M(
		6, 1, "Grain Shadow", "GRAIN SHADOW", "upland_farm", "farm_overcast",
		"Destroy fuel grain silos stockpiling for the coup",
		"Follow the irrigation channel and scan the marked fuel silos without touching the farm roofs. Burn the stores, clear the patrol, and copy the fuel ledger from the farm crew.",
		"The silos are gone and the ledger is copied. A farmer identifies the courier who carries the next set of orders.",
		[
			fly("route", "Follow the farm irrigation channel", [[500,230,0],[850,250,-700],[250,240,-1550]], 0, 0, undefined,
				{ beat: "SERA: Follow the channel. The marked tanks sit at its end.", chatter: [{ at: 0.5, text: "FARMER: The unmarked roofs are ours. Please." }] }),
			fly("recon", "Mark fuel silos below 400", [[-520,260,-720],[540,260,-680]], 6, 0, 400,
				{ beat: "SERA: Low pass first. Mark the military silos, not the farmhouses.", chatter: [{ at: 0.5, text: "SERA: Fuel-grade grain in all three. The roofs are clean." }] }),
			ground("Destroy three fuel silos", 3, "SERA: Marked silos only. That grain is fuel.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			air("Clear the orchard patrol", 5, "SERA: Five answering the smoke, in two groups. Turn into them.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Copy the fuel ledger before leaving", [[0,430,-1000]], 20, 1, undefined,
				{ beat: "SERA: The farm crew found the ledger. Hold the link while they read it.", chatter: [{ at: 0.5, text: "FARMER: Three fuel shipments. All signed by the same officer." }] }),
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
		"Run the dust-pass gates and scan the clearings for the courier's trail. Strip his escort, catch him before the plateau, then head toward Varda while reading his packet over the radio.",
		"Varda copies tomorrow's coup orders and the first relay's name from the courier packet: Node Kiro.",
		[
			fly("route", "Run the dust pass under 400", [[-450,240,-200],[-900,300,-1000],[-200,300,-1850],[500,300,-1400]], 0, 0, 400,
				{ beat: "SERA: The courier runs under the dust. Stay in it.", chatter: [{ at: 0.66, text: "SERA: Five escorts ahead of him. Dust is thinning." }] }),
			fly("recon", "Find the courier's trail in the dust", [[-700,280,-1100],[-100,280,-1700]], 8, 0, 400,
				{ beat: "SERA: Scan both clearings for his engine trail.", chatter: [{ at: 0.5, text: "SERA: Engine trail at the second clearing. Keep low." }] }),
			air("Strip the courier's escort", 5, "SERA: Five escorts in the dust, in two groups. Strip them off him.", { groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			chase("Catch the courier before the plateau", 90, [-300,320,-2250], "SERA: There's the courier, running north. Ninety seconds. Catch him.",
				[{ at: 0.5, text: "SERA: He's halfway to the plateau. Close on him." }, { at: 0.8, text: "SERA: Twenty seconds and he's over the edge!" }]),
			fly("route", "Carry the courier packet toward Varda", [[0,440,-1200],[-700,400,-400]], 0, 0, undefined,
				{ beat: "SERA: Packet recovered. Head for Varda while I read the orders.", chatter: [{ at: 0.5, text: "SERA: Tomorrow's orders copied. Reading the signatures next." }] }),
		],
		[],
	),
	M(
		8, 1, "Rim Switch", "RIM SWITCH", "canyon_airfield", "canyon_dusk",
		"Hold Varda Rim through a coordinated counter-strike",
		"Protect Varda's tower while crews restore its code. Scan the smoke for spotters before striking, clear the retreating flight, and stay until loyal pilots acknowledge the restored code.",
		"The restored code reaches every loyal flight. Varda holds, but Vulture Lead is still hunting the night approach.",
		[
			fly("defend", "Protect Varda's control tower", [[-430,240,250]], 110, 5, undefined,
				{ beat: "SERA: Tower crew resetting the code. Keep the raiders off them.", chatter: [{ at: 0.5, text: "BROADCAST: Varda tower is in rebel hands. Fire on it." }, { at: 0.55, text: "SERA: Ignore that. It's him." }, { at: 0.7, text: "SERA: Second wave's dropping smoke on the apron. Spotters." }],
					reinforce: [{ at: 0.35, count: 1 }, { at: 0.65, count: 2 }] }),
			fly("recon", "Mark the apron spotters", [[-1050,280,-250],[-150,280,-450]], 6, 0, 400,
				{ beat: "SERA: Smoke on the apron. Scan for the two spotter dishes first.", chatter: [{ at: 0.5, text: "SERA: Two dishes in the smoke. Keep the parked trainers clear." }] }),
			ground("Counter-attack the spotter radars", 2, "SERA: Code is ours. Two spotter radars on the apron. Hit them.", { hidden: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			air("Catch the retreating flight", 3, "SERA: Spotters down. Their flight is running. Catch three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Send the restored tower code", [[-430,420,250]], 15, 0, undefined,
				{ beat: "TOWER: Code restored. Stay on the link until every loyal flight answers.", chatter: [{ at: 0.5, text: "TOWER: Loyal flight answering. Waiting on the last one." }] }),
		],
		[
			{ asset: "radar", name: "SPOTTER RADAR 1", x: -1050, z: -250 },
			{ asset: "radar", name: "SPOTTER RADAR 2", x: -150, z: -450 },
		],
	),
	M(
		9, 1, "Static Horizon", "STATIC HORIZON", "canyon_pass", "canyon_night",
		"Night sweep over the pass; Vulture Lead is waiting",
		"Follow the night lights and locate Vulture Lead's guard-channel source. Clear his patrol, draw him onto the open channel, defeat him, then mark his recorder for recovery.",
		"Recovery reaches Vulture Lead's recorder. Teal's cut-off transmission links the farms to the coastal harbors.",
		[
			fly("route", "Follow the night approach lights", [[500,350,-100],[900,420,-850],[0,450,-1700]], 0, 0, undefined,
				{ beat: "SERA: The approach lights are his bait. Fly them anyway.", chatter: [{ at: 0.66, text: "VULTURE LEAD: Teal flew this line too. Keep coming." }] }),
			fly("recon", "Find Vulture Lead's guard-channel source", [[0,340,-1500]], 8, 0, 480,
				{ beat: "SERA: His voice is bouncing off the pass. Scan low to mark the source.", chatter: [{ at: 0.5, text: "SERA: Guard-channel source above the pass. That is him." }] }),
			air("Clear the night patrol", 3, "SERA: Three on night vision, in two groups. Watch your horizon.",
				{ groups: 2, stagger: 16, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Draw Vulture Lead onto the open channel", [[0,500,-1200]], 20, 1, undefined,
				{ beat: "SERA: Patrol is gone. Hold the channel open. He will come to answer.", chatter: [{ at: 0.5, text: "VULTURE LEAD: You have my attention, trainee. Stay there." }] }),
			{ kind: "ace", label: "Defeat Vulture Lead", optionalRaiders: 2, beat: "Vulture Lead. He erased the witness. Not you." },
			fly("recon", "Mark Vulture Lead's recorder", [[400,300,-1200],[-200,300,-1600]], 5, 0, 450,
				{ beat: "RECOVERY: Recorder still transmitting. Mark it before the signal dies.", chatter: [{ at: 0.5, text: "RECOVERY: Recorder ping steady. Mark the second slope." }] }),
		],
		[],
		{
			aceHealth: 200, aceName: "VULTURE LEAD",
			aceStages: ["VULTURE LEAD: You fly like him. He died anyway. Wing, cut him off.", "VULTURE LEAD: Enough. Wing, on me!"],
			aceReturns: ["SERA: Vulture Lead's turning back in. Nose on him.", "VULTURE LEAD: Head on, trainee. Like he did."],
		},
	),

	// ----- Act II: Plateau Signal -----
	// Act II adds interrupted scans, truck reroutes, testimony and relay handoffs.
	// Its extra work comes from changing objectives rather than tougher Normal bandits.
	M(
		10, 2, "Plateau Cold", "PLATEAU COLD", "plateau_relay", "farm_overcast",
		"Scout and silence the first plateau relay",
		"Scan Node Kiro's archive; if intercepted, clear the camp flight and finish copying. Cut the transmitter, trace the command channel to its hidden radar, destroy it, then clear the blind response.",
		"Kiro's archive is safe and its directing radar is dark. Loyalist traffic returns with evidence linking the next two relays.",
		[
			fly("recon", "Scan Node Kiro (hold fire)", [[180,300,-1100]], 12, 0, 450,
				{ beat: "SERA: Scan the archive first. The dish can wait.", chatter: [{ at: 0.3, text: "SERA: Signatures copying. Stay low. Hold fire." }],
					twist: { at: 0.6, mode: "now", text: "SERA: They've seen you. Four climbing off the camp. Scan's on hold.", insert: [
						air("Break the camp's intercept", 4, "SERA: Four off the camp, in pairs. Clear them, then we finish the scan.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
						fly("recon", "Finish the archive scan", [[180,300,-1100]], 8, 2, 450,
							{ beat: "SERA: Back on the archive. Eight seconds of clean copy.", chatter: [{ at: 0.5, text: "SERA: Copy complete in four. Hold your line." }], reinforce: [{ at: 0.4, count: 1 }] }),
					] } }),
			ground("Cut Node Kiro's transmitter", 1, "SERA: Archive copied. Cut the transmitter.", {
				twist: { at: 1, text: "SERA: Radar is directing them. Hold the channel; we will trace it.", insert: [
					fly("signal", "Trace the camp radar's command channel", [[400,480,-1000]], 20, 2, undefined,
				{ directed: true, reinforce: [{ at: 0.5, count: 1 }], beat: "SERA: Hold the channel while we trace the camp radar.", chatter: [{ at: 0.5, text: "SERA: The radar is still directing them. Trace is closing." }] }),
			ground("Kill the camp radar", 1, "SERA: Radar on the camp roof. Its raiders fire twice as fast. Kill it.", { hidden: true, directed: true, optionalRaiders: 3 }),
				] } }),
			air("Intercept the blind response", 3, "SERA: Radar's dead. The response is flying blind. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
		],
		[
			{ asset: "comms_relay", name: "NODE KIRO", x: 180, z: -1100 },
			{ asset: "radar", name: "CAMP RADAR", x: 560, z: -820 },
		],
	),
	M(
		11, 2, "Signal Harvest", "SIGNAL HARVEST", "upland_farm", "farm_sunset",
		"Harvest the relays flanking the farm belt",
		"Take Lira and Merel on opposite ridges while clearing their alert flights. Follow the farm-road beacons to the unlisted third dish, then relay Teal's packet from the west ridge.",
		"Lira, Merel and the unlisted Sable fall. The west-ridge handoff reaches a loyalist cell with coordinates for a staging farm.",
		[
			ground("Destroy relay Node Lira", 1, "SERA: Lira first. West ridge dish.", { optionalRaiders: 1 }),
			air("Clear the alert flight", 3, "SERA: Alert flight airborne. Three. Clear them.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			ground("Destroy relay Node Merel", 1, "SERA: Merel next. East ridge.", {
				twist: { at: 1, text: "SERA: Third dish lit north of the belt. Node Sable. Not on the tin.", insert: [
					fly("route", "Follow the farm road north to Sable", [[300,280,-1200],[-100,300,-1650]], 0, 0, undefined,
						{ beat: "SERA: Farm road north. Two beacons to Sable.", chatter: [{ at: 0.5, text: "FARMER: That dish went up last week. Nobody asked us." }] }),
					ground("Destroy relay Node Sable", 1, "SERA: Sable. Dish only. The barn beside it is ours."),
					air("Clear Sable's guard flight", 3, "SERA: Guard flight off Sable. Three.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			fly("signal", "Relay Teal's packet from the west ridge", [[-820,400,-780]], 90, 4, undefined,
				{ beat: "SERA: Relaying Teal's packet. Ninety seconds. Hold the ridge orbit.", chatter: [{ at: 0.5, text: "FARMER: We're hearing it. Keep it coming." }, { at: 0.8, text: "SERA: Last of the packet. Don't drift off the ridge." }], reinforce: [{ at: 0.5, count: 2 }] }),
		],
		[
			{ asset: "comms_relay", name: "NODE LIRA", x: -820, z: -780 },
			{ asset: "comms_relay", name: "NODE MEREL", x: 820, z: -780 },
			{ asset: "comms_relay", name: "NODE SABLE", x: 0, z: -1650 },
		],
	),
	M(
		12, 2, "Open Field", "OPEN FIELD", "upland_farm", "farm_morning",
		"Escort the loyalist transmitter truck across the orchards",
		"Escort the transmitter through the refugee corridor. When false orders divert it, stop at the fork and scan the mill road before covering the new leg; clear the patrol, test the link, and lead in relief.",
		"The truck reaches the mill road safely, its new link answers, and relief takes over. The farms now have a working relay net.",
		[
			fly("escort", "Escort the loyalist transmitter truck", [[-1200,65,100],[-500,65,-900],[900,65,-1300]], 90, 4, undefined,
				{ beat: "TRUCK: Transmitter rolling. The corridor is full of refugees.", chatter: [{ at: 0.3, text: "SERA: Second flight coming for the truck." }], reinforce: [{ at: 0.3, count: 2 }],
					twist: { at: 0.5, mode: "now", text: "BROADCAST: Convoy, the north corridor is clear. Proceed north at speed.", insert: [
						fly("recon", "Check the mill road for refugees", [[300,280,-1500]], 8, 0, 420,
				{ parkedEscort: { x: -500, y: 65, z: -900 }, beat: "SERA: Ignore him. North is mined. Truck, stop. Scan the mill road.", chatter: [{ at: 0.5, text: "SERA: Refugees clear of the bend. One more look at the road." }] }),
			fly("escort", "Cover the reroute along the mill road", [[-500,65,-900],[300,65,-1500],[1300,65,-700]], 65, 4, undefined,
							{ beat: "SERA: Mill road is clear. Truck, swing east. We will cover you.", chatter: [{ at: 0.5, text: "TRUCK: Mill road's rough but we're moving. Stay with us." }], reinforce: [{ at: 0.5, count: 2 }] }),
					] } }),
			air("Occupy the orchard airspace", 6, "SERA: Truck's clear. Patrol escalating. Six, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 2 }] }),
			fly("signal", "Test the truck's new relay link", [[800,430,-900]], 20, 1, undefined,
				{ parkedEscort: { x: 1300, y: 65, z: -700 }, beat: "TRUCK: Parked and transmitting. Hold for our first reply.", chatter: [{ at: 0.5, text: "TRUCK: First loyalist cell answering. Holding for the second." }] }),
			fly("route", "Lead the relief crew to the truck", [[300,320,-700],[1300,330,-700]], 0, 0, undefined,
				{ parkedEscort: { x: 1300, y: 65, z: -700 }, beat: "SERA: Relief crew following your beacons. Bring them to the truck.", chatter: [{ at: 0.5, text: "SERA: Relief crew sees the transmitter. Last beacon ahead." }] }),
		],
		[],
	),
	M(
		13, 2, "Staging Farm", "STAGING FARM", "upland_farm", "farm_overcast",
		"Dismantle the coup's upland staging farm",
		"Follow the rail spur and scan the military stores among civilian roofs. Destroy four silos, clear the responding flights and cut the relay, then send the rail crew's ledger to the cells.",
		"The staging farm is dark. Its copied ledger reaches the cells and points to the plateau antenna chain.",
		[
			fly("route", "Follow the rail spur to the staging farm", [[-500,270,-350],[-250,300,-850]], 0, 0, undefined,
				{ beat: "SERA: Rail spur runs straight to their stores. Follow it.", chatter: [{ at: 0.5, text: "SERA: Spur ends at the silos. Low and quiet now." }] }),
			fly("recon", "Scan the staging farm low", [[0,300,-1000]], 10, 2, 420,
				{ beat: "SERA: Mark the stores. Civilian roofs stay standing.", chatter: [{ at: 0.5, text: "SERA: Fuel ledger confirmed. Those silos are military." }], reinforce: [{ at: 0.5, count: 1 }] }),
			ground("Destroy four fuel silos", 4, "SERA: Four silos. Marked only.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }],
				twist: { at: 0.5, text: "SERA: Four off the plateau. Finish the silos, then turn into them.", insert: [
					air("Break the plateau reinforcements", 4, "SERA: Silos burning. Now the four, in pairs. Turn in.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			ground("Destroy the farm relay", 1, "SERA: The relay's still calling for help. Cut it."),
			air("Hold off the raiders", 3, "SERA: Raiders off the plateau. Three more, with hangers-on.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			fly("signal", "Send the staging ledger to the cells", [[0,450,-1000]], 20, 1, undefined,
				{ beat: "SERA: Rail crew has the ledger. Hold the link to the cells.", chatter: [{ at: 0.5, text: "LOYALIST: Rail ledger copied. Matching it against Kiro's orders." }] }),
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
		"Cross the saddle beacons and strike the three antennas. Locate the replacement dish on the saddle road before destroying it, clear the perimeter flight, and listen until the whole chain is silent.",
		"The replacement mast falls with the fixed row. A final listening check confirms the coup has switched to courier runs.",
		[
			fly("route", "Cross the four saddle beacons", [[-500,320,-100],[-1000,450,-700],[0,550,-1200],[1000,430,-1500]], 0, 0, undefined,
				{ beat: "SERA: Saddle beacons lead to the arrays. Climb.", chatter: [{ at: 0.5, text: "SERA: All three arrays can hear you now." }, { at: 0.75, text: "BROADCAST: Unknown aircraft on the saddle. Intercept." }] }),
			ground("Destroy three plateau antennas", 3, "SERA: Three dishes on the ridge. Blind them.", { optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }],
				twist: { at: 0.3, text: "SERA: Replacement mast on the saddle road. Cut that one too.", insert: [
					fly("recon", "Find the saddle-road replacement mast", [[-250,300,-450]], 8, 0, 450,
				{ beat: "SERA: Scan the saddle road. They have raised a replacement dish.", chatter: [{ at: 0.5, text: "SERA: Dish truck on the saddle road. Civilian vans are clear." }] }),
			ground("Destroy the mobile mast", 1, "SERA: Mast located on the saddle road. Hit the dish."),
				] } }),
			air("Clear the perimeter CAP", 4, "SERA: Perimeter CAP turning in. Four, in pairs, with raiders.", { groups: 2, stagger: 18, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Hold the saddle: confirm the row is dark", [[0,450,-1200]], 60, 4, undefined,
				{ beat: "SERA: Hold the saddle. I'm listening for anything left alive.", chatter: [{ at: 0.4, text: "SERA: More off the dark end of the row. Hold the orbit." }, { at: 0.8, text: "SERA: Nothing on the chain. Almost there." }], reinforce: [{ at: 0.4, count: 2 }] }),
		],
		[
			{ asset: "comms_relay", name: "ANTENNA ONE", x: -600, z: -1100 },
			{ asset: "comms_relay", name: "ANTENNA TWO", x: 0, z: -1340 },
			{ asset: "comms_relay", name: "ANTENNA THREE", x: 600, z: -1100 },
			{ asset: "comms_relay", name: "MOBILE MAST", x: -250, z: -450 },
		],
	),
	M(
		15, 2, "Loyalist Window", "LOYALIST WINDOW", "upland_farm", "farm_morning",
		"Buy the loyalist broadcast its one clear window",
		"Hold the loyalist broadcast link and destroy any jammers that block it. Clear the second intruders, follow the garrisons' reply beacons, and scan both compounds to confirm they stood down.",
		"The broadcast lands and the reply is verified from the air. Loyalist garrisons park their aircraft instead of following the forged orders.",
		[
			fly("signal", "Hold the broadcast link", [[0,420,-900]], 90, 4, undefined,
				{ beat: "LOYALIST: Transmitting. Every second is a garrison.", chatter: [{ at: 0.3, text: "SERA: Raiders inbound. Stay inside the volume." }, { at: 0.75, text: "LOYALIST: Garrisons answering. Keep the volume." }], reinforce: [{ at: 0.3, count: 2 }],
					hazard: { at: 0.4, count: 2, effect: "jam", text: "LOYALIST: Link lost! Kill the two jammer trucks on the farm road." } }),
			air("Hold the second intruders", 7, "SERA: Second wave, riding harder. Seven, in two groups. Raiders in tow.",
				{ groups: 2, stagger: 18, optionalRaiders: 3, reinforce: [{ at: 0.3, count: 1 }, { at: 0.6, count: 2 }] }),
			fly("route", "Follow the garrisons' reply beacons", [[-500,300,-400],[600,330,-1100]], 0, 0, undefined,
				{ beat: "LOYALIST: Two reply beacons lit. Follow them to check the garrisons.", chatter: [{ at: 0.5, text: "LOYALIST: West garrison beacon confirmed. East is ahead." }] }),
			fly("recon", "Confirm the garrisons have stood down", [[-1000,280,-900],[950,280,-1600]], 7, 1, 420,
				{ beat: "SERA: Scan both compounds for parked aircraft. Verify they stood down.", chatter: [{ at: 0.5, text: "SERA: Engines cold at the first compound. Check the second." }] }),
		],
		[
			{ asset: "comms_relay", name: "JAMMER TRUCK 1", x: -620, z: -640 },
			{ asset: "comms_relay", name: "JAMMER TRUCK 2", x: 560, z: -1260 },
		],
	),
	M(
		16, 2, "Storm Walk", "STORM WALK", "upland_farm", "farm_storm",
		"Finish the staging ground while the storm covers you",
		"Run the river gates under the storm and identify the last fuel stores in the rain. Burn them, clear the diving patrol, cut the forward relay, and copy its final traffic.",
		"The stores and relay are dark. Their copied traffic identifies the crown station carrying the Marshal's real signature.",
		[
			fly("route", "River gates: stay under 400", [[400,220,0],[800,240,-750],[0,280,-1450]], 0, 0, 400,
				{ beat: "SERA: River gates keep you under the storm. Stay low.", chatter: [{ at: 0.66, text: "SERA: Last gate. The marked tanks are just past it." }] }),
			fly("recon", "Identify fuel stores in the rain", [[-520,280,-820],[540,280,-820]], 7, 0, 400,
				{ beat: "SERA: Rain hides the markings. Scan both ends before you fire.", chatter: [{ at: 0.5, text: "SERA: Fuel markings visible. Keep the farm roofs out of the strike." }] }),
			ground("Destroy three remaining silos", 3, "SERA: Three silos under the storm. Burn them.", { optionalRaiders: 1, reinforce: [{ at: 0.34, count: 1 }],
				twist: { at: 0.66, text: "SERA: Five diving through the cloud. Finish the tanks and turn.", insert: [
					air("Catch the storm patrol", 5, "SERA: Patrol riding the thunder. Five, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
				] } }),
			ground("Destroy the forward relay", 1, "SERA: Forward relay on the staging path. Cut it."),
			fly("signal", "Read the dead relay's last traffic", [[0,420,-1600]], 80, 4, undefined,
				{ beat: "SERA: Hold over the relay. Its last traffic is still in the air.", chatter: [{ at: 0.35, text: "SERA: Pair off the plateau, using the storm. Hold the orbit." }, { at: 0.7, text: "SERA: Second pair, coming out of the rain." }], reinforce: [{ at: 0.35, count: 2 }, { at: 0.7, count: 2 }] }),
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
		"Cut the crown relay and clear its intercepts, then receive the archive. If the signal breaks, scan beneath the array, kill the jammer and its escort, and return to finish receiving the signature.",
		"The resumed receive orbit brings the complete signed order home: Air Marshal Rusk. Vulture Two challenges your call sign.",
		[
			ground("Destroy the plateau relay", 1, "SERA: One dish under the aurora. Cut it.", { optionalRaiders: 1 }),
			air("Clear the aurora intercept", 4, "SERA: Four intercepts lit by the aurora, in pairs.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Orbit to receive the archive", [[-100,500,-1400]], 90, 2, undefined,
				{ beat: "TEAL (tape): If you hear this up here, read the signature.", chatter: [{ at: 0.3, text: "SERA: The archive is speaking. Signature decoding." }],
					twist: { at: 0.5, mode: "now", text: "SERA: Archive lost. Jammer under the array. Find it, low.", insert: [
						fly("recon", "Find the jammer under the array", [[500,300,-1150]], 6, 0, 450,
							{ beat: "SERA: Get under the aurora glow. It'll show on the scan.", chatter: [{ at: 0.5, text: "SERA: There. A dish truck in the array's shadow." }] }),
						ground("Destroy the aurora jammer", 1, "SERA: Jammer marked. Cut it."),
						air("Clear the jammer's escort", 2, "SERA: Its escort is up. Two.", { optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
						fly("signal", "Resume the receive orbit", [[-100,500,-1400]], 50, 2, undefined,
							{ beat: "SERA: Archive's back. Hold the orbit. Read the signature.", chatter: [{ at: 0.5, text: "SERA: Signature decoding. Hold. It carries a Marshal's seal." }], reinforce: [{ at: 0.4, count: 1 }] }),
					] } }),
		],
		[
			{ asset: "comms_relay", name: "AURORA RELAY", x: -100, z: -1400 },
			{ asset: "comms_relay", name: "AURORA JAMMER", x: 500, z: -1150 },
		],
	),
	M(
		18, 2, "Ridge Ace", "RIDGE ACE", "plateau_relay", "relay_night",
		"Close act two against the plateau ace",
		"Climb into Vulture Two's lights and mark a safe pickup site before clearing his wingmen. Defeat him through three stages, protect the marines' recovery, and relay his testimony to the coast.",
		"The marines recover Vulture Two alive from the ridge. His recorded testimony reaches the coast before the next strike.",
		[
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
		[],
		{
			aceHealth: 260, aceName: "VULTURE TWO",
			aceStages: ["VULTURE TWO: I taught him that turn. Wing, show the trainee the answer.", "VULTURE TWO: Last lesson. Wing, keep him busy."],
			aceReturns: ["VULTURE TWO: Now. Again, trainee. From the top.", "VULTURE TWO: Head on. The way Teal never would."],
		},
	),

	// ----- Act III: Coastal Fracture -----
	// Act III links precision strikes with rescues, inspections and evidence handoffs.
	// Normal keeps two-missile bandits and one flight threat; Ace restores armored pressure.
	M(
		19, 3, "Harbor Run", "HARBOR RUN", "coastal_city", "harbor_fog",
		"First strike on the coup's harbor logistics",
		"Scan the military quays, burn the stores and break the early intercept. Trace a safe lane for the workers' launch, escort it clear, defeat the remaining flight and open the rescue channel.",
		"The military stores burn while harbor workers reach safety. Their rescue channel stays open as Rusk moves into the city.",
		[
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
		[
			{ asset: "warehouse", name: "QUAY 1", x: -500, z: -900 },
			{ asset: "warehouse", name: "QUAY 2", x: 0, z: -1150 },
			{ asset: "warehouse", name: "QUAY 3", x: 500, z: -900 },
		],
	),
	M(
		20, 3, "Fracture Line", "FRACTURE LINE", "coastal_city", "city_evening",
		"Split the Air Marshal's air cover in half",
		"Break the eastern wing and scan the launch's exit. Cover Teal's paper evidence through the harbor, silence the bank guns, mark the patrol boat's approach and confirm the handoff over the radio.",
		"The launch clears the guns and transfers Teal's evidence at sea. Marines confirm the archive and tapes are safely aboard.",
		[
			air("Shatter the eastern wing", 9, "SERA: Full wing on the east line. Nine, in three groups.", { groups: 3, stagger: 18 }),
			fly("recon", "Scan the launch's exit", [[700,280,-1400]], 6, 1, 420,
				{ beat: "MARINE: Paper is aboard. Scan the harbor exit before we move.", chatter: [{ at: 0.5, text: "MARINE: Exit marked. We will move as soon as your scan is clear." }] }),
			fly("escort", "Cover the evidence launch", [[-1400,40,-1150],[0,40,-1450],[1400,40,-1150]], 110, 4, undefined,
				{ beat: "MARINE: Launch moving. Keep the sky quiet.", chatter: [{ at: 0.5, text: "SERA: Western wing reacting. Launch is halfway out." }], reinforce: [{ at: 0.5, count: 2 }],
					hazard: { at: 0.15, count: 2, effect: "guns", text: "MARINE: Guns on both banks, firing on the launch! Silence them!" } }),
			fly("route", "Mark the open-water rendezvous", [[900,340,-1300],[1400,350,-600]], 0, 0, undefined,
				{ parkedEscort: { x: 1400, y: 40, z: -1150 }, beat: "MARINE: Holding at the exit. Mark the patrol boat's approach beacons.", chatter: [{ at: 0.5, text: "MARINE: Patrol boat sees your mark. One more beacon." }] }),
			fly("signal", "Confirm the evidence handoff at sea", [[900,500,-900]], 20, 0, undefined,
				{ parkedEscort: { x: 1400, y: 40, z: -1150 }, beat: "MARINE: Patrol boat alongside. Hold until the paper changes hands.", chatter: [{ at: 0.5, text: "MARINE: Archive case passed. Tapes are next." }] }),
		],
		[
			{ asset: "radar", name: "WEST BANK GUN", x: -720, z: -930 },
			{ asset: "radar", name: "EAST BANK GUN", x: 720, z: -930 },
		],
	),
	M(
		21, 3, "City Night", "CITY NIGHT", "coastal_city", "city_night",
		"Night strike on the Marshal's broadcast tower",
		"Follow the dark canal and mark the dish above the apartments before firing. Clear the escort, confirm the tower is silent, cover the repair launch and guide its crew to the dark district.",
		"Rusk's tower stays silent. Repair crews reach the district while its residents open their windows to the quiet.",
		[
			fly("route", "Follow the dark canal through the city", [[-400,250,-100],[-900,300,-700],[0,320,-1500]], 0, 1, 430,
				{ beat: "SERA: The dark canal keeps you off his radar. Follow it.", chatter: [{ at: 0.66, text: "SERA: Relay above the apartments. Hit only the dish." }] }),
			fly("recon", "Mark the dish above the apartments", [[0,300,-1300]], 8, 1, 430,
				{ beat: "SERA: Low scan over the canal. Mark the dish above the roofs.", chatter: [{ at: 0.5, text: "SERA: Dish marked. Apartment roofs stay standing." }] }),
			ground("Destroy the broadcast relay", 1, "SERA: Broadcast relay above the city. Dish only.", { optionalRaiders: 2 }),
			air("Hold off the escort flight", 4, "SERA: Escort flight scrambling. Four, in two pairs.", { groups: 2, stagger: 35, optionalRaiders: 2, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("signal", "Confirm the dark tower is silent", [[0,520,-1300]], 60, 4, undefined,
				{ beat: "SERA: Hold over the tower. I want to hear nothing from it.", chatter: [{ at: 0.4, text: "SERA: Pair off the dark side of the city. Hold the orbit." }, { at: 0.8, text: "SERA: Still silent. Hold it." }], reinforce: [{ at: 0.4, count: 2 }] }),
			fly("escort", "Cover the repair launch", [[-600,40,-1500],[400,40,-900]], 45, 2, undefined,
				{ beat: "HARBOR: Repair crew moving. Cover us to the dark district.", chatter: [{ at: 0.5, text: "HARBOR: Crew passing the canal bend. Keep the approach clear." }] }),
			fly("route", "Mark the repair crew's district route", [[-600,320,-800],[0,350,-300],[600,350,-900]], 0, 1, undefined,
				{ parkedEscort: { x: 400, y: 40, z: -900 }, beat: "HARBOR: Launch moored. Follow district lights to guide the shore crew.", chatter: [{ at: 0.5, text: "HARBOR: Shore crew sees your mark. Moving to the next street." }] }),
		],
		[{ asset: "comms_relay", name: "BROADCAST RELAY", x: 0, z: -1300 }],
	),
	M(
		22, 3, "Harbor Fog", "HARBOR FOG", "coastal_harbor", "harbor_fog",
		"Finish the harbor in the fog",
		"Scan and destroy the five fuel depots, follow the empty piers and clear the fog patrol. Escort the inspection launch, verify the last two hoses are dry and report to the frigates.",
		"Inspectors verify every fuel hose is dry. The frigates receive proof that Rusk's escape fleet cannot refuel.",
		[
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
		"Defend the command frigate, scan the last gap and clear the platform flight. Sweep the outer beacons, cover the inspection launch across the gap and send the closed-ring report to the landing force.",
		"The inspected blockade is closed. The landing force receives confirmation that no fuel ship can reach the platform.",
		[
			// The command frigate holds the ring's south-east station, clear of the platform deck (world: frigate ring).
			fly("defend", "Defend the command frigate", [[650,300,-1550]], 90, 6, undefined,
				{ beat: "FRIGATE: Ring closing. Raiders on the bow.", chatter: [{ at: 0.35, text: "FRIGATE: Second group off the platform. Hold them." }, { at: 0.7, text: "FRIGATE: Third group, low on the water. Two left in the ring." }], reinforce: [{ at: 0.35, count: 2 }, { at: 0.7, count: 2 }] }),
			fly("recon", "Check the gap between the frigates", [[300,300,-1700]], 7, 1, 450,
				{ beat: "FRIGATE: One gap open. Scan the water before we close the ring.", chatter: [{ at: 0.5, text: "FRIGATE: No wake in the gap. Finish the sweep." }] }),
			air("Clear the platform command flight", 4, "FRIGATE: Ring closed. Command flight launching. Four, from both sides.", { groups: 2, stagger: 18, flank: true, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("route", "Fly the blockade's outer beacons", [[-800,350,-1800],[800,350,-1800]], 0, 1, undefined,
				{ beat: "FRIGATE: Follow the outer beacons. Check the whole sea lane is in sight.", chatter: [{ at: 0.5, text: "FRIGATE: Western lane visible. Sweep to the eastern beacon." }] }),
			fly("escort", "Cover the blockade inspection launch", [[0,40,-1800],[800,40,-1600]], 50, 2, undefined,
				{ beat: "FRIGATE: Inspection launch crossing. Cover it until it docks.", chatter: [{ at: 0.5, text: "FRIGATE: Inspection launch halfway across. Gap remains clear." }] }),
			fly("signal", "Report the blockade is closed", [[500,500,-1500]], 20, 0, undefined,
				{ beat: "FRIGATE: No ships through. Hold the command link for the landing force.", chatter: [{ at: 0.5, text: "LANDING FORCE: Ring report received. Bringing our boats forward." }] }),
		],
		[],
	),
	M(
		24, 3, "Platform Fire", "PLATFORM FIRE", "ocean_platform", "ocean_storm",
		"Strike the offshore platform through the storm",
		"Fly the low sea gates, burn the platform stores and break the storm patrol. Find and stop the escaping tanker, cover the deck crew's rescue launch and confirm nothing else has lifted.",
		"The tanker is stopped and the deck crew rescued. The frigate confirms the platform's fuel chain is broken.",
		[
			fly("route", "Low sea approach: under 360", [[-700,220,-100],[-1000,240,-750],[0,260,-1700]], 0, 1, 360,
				{ beat: "SERA: Under the storm. Three gates to the platform.", chatter: [{ at: 0.66, text: "SERA: Last gate. The deck stores are ahead." }] }),
			ground("Destroy three platform warehouses", 3, "SERA: Three stores on the deck. Burn them.", { optionalRaiders: 2, reinforce: [{ at: 0.34, count: 1 }] }),
			air("Clear the storm patrol", 5, "SERA: Patrol in the storm shadow. Five, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Find the tanker in the storm shadow", [[200,300,-1500]], 7, 1, 420,
				{ beat: "SERA: Scan below the cloud. The tanker is hiding behind the deck smoke.", chatter: [{ at: 0.5, text: "SERA: Engine heat below the cloud. It is running for the coast." }] }),
			chase("Stop the escaping fuel tanker", 90, [200,350,2100], "SERA: Tanker jet lifting off, running for the coast. Stop it.",
				[{ at: 0.5, text: "SERA: Tanker's halfway to the coast. Close on it." }, { at: 0.8, text: "SERA: He's almost over the city. Now!" }], 2),
			fly("escort", "Escort the deck crew's rescue launch", [[-700,40,-1400],[700,40,-1700]], 50, 2, undefined,
				{ beat: "FRIGATE: Deck crew aboard. Cover them clear of the burning stores.", chatter: [{ at: 0.5, text: "FRIGATE: Launch halfway clear. Deck crew accounted for." }] }),
			fly("signal", "Report the platform fuel chain is broken", [[0,500,-1100]], 20, 1, undefined,
				{ beat: "FRIGATE: Tanker down. Hold while we check for other launches.", chatter: [{ at: 0.5, text: "FRIGATE: No second tanker on radar. Checking the last deck returns." }] }),
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
		"Escort the landing craft to the beach and defeat the first intercept. Scan both beach exits, stop the rear attack, cut the directing relay and hold the link until both landing squads answer.",
		"Both squads confirm the beach exits are held. The loyalists advance into the city as Rusk brings his personal flight airborne.",
		[
			fly("escort", "Cover the landing craft to the beach", [[-900,40,-1750],[-450,40,-1400],[50,40,-1000]], 80, 4, undefined,
				{ beat: "LANDING CRAFT: Beach in eighty seconds. Keep them off us.", chatter: [{ at: 0.5, text: "SERA: Second intercept launching. Stay on the craft." }, { at: 0.85, text: "LANDING CRAFT: Surf line. Ramps going down." }], reinforce: [{ at: 0.5, count: 2 }] }),
			air("Hold the first intercept", 3, "SERA: First intercept off the apron. Three, in two groups.", { groups: 2, stagger: 18, optionalRaiders: 1, reinforce: [{ at: 0.5, count: 1 }] }),
			fly("recon", "Mark the safe route off the beach", [[-300,280,-1100],[300,280,-1000]], 12, 2, 420,
				{ beat: "LANDING CRAFT: Ramps down. Scan both exits so we can leave the sand.", chatter: [{ at: 0.5, text: "LANDING CRAFT: West exit clear. Check the eastern street." }] }),
			air("Hold the second intercept", 3, "SERA: Second wave with raiders, coming round behind. Hold the beach.",
				{ groups: 2, stagger: 18, flank: true, optionalRaiders: 3, reinforce: [{ at: 0.5, count: 2 }] }),
			ground("Destroy the beach relay", 1, "SERA: Beach relay is still directing fire. Cut it."),
			fly("signal", "Confirm both beach exits are held", [[0,480,-1100]], 20, 1, undefined,
				{ beat: "LANDING CRAFT: Streets reached. Hold for both beach exits to answer.", chatter: [{ at: 0.5, text: "LANDING CRAFT: West exit answering. Waiting for the eastern squad." }] }),
		],
		[{ asset: "comms_relay", name: "BEACH RELAY", x: 0, z: -1250 }],
	),
	M(
		26, 3, "Fracture Last", "FRACTURE LAST", "coastal_city", "city_night",
		"Trap the Marshal's wing between you and the city",
		"Break the split wing, watching for the rear flight at halfway. Map the rooftop echoes, fix Rusk's transmission, follow the loyalist corridor and protect the quay and witness launch.",
		"Rusk's wing is broken and his position confirmed. The witnesses reach parliament under your cover.",
		[
			air("Break the Marshal's wing", 8, "SERA: Wing splits. Four ahead; the rest will come round behind.",
				{ groups: 2, flank: true, groupAt: [0.5], groupCalls: ["SERA: Second flight on your six! Turn!"], optionalRaiders: 2, reinforce: [{ at: 0.6, count: 2 }] }),
			fly("recon", "Scan the signal below the skyline", [[0,300,-1200]], 6, 0, 430,
				{ beat: "SERA: Signal bouncing between roofs. Scan low to narrow it down.", chatter: [{ at: 0.5, text: "SERA: Rooftop echoes mapped. We still need the name of the mast." }] }),
			fly("signal", "Triangulate Rusk's transmission", [[0,600,-1200]], 40, 4, undefined,
				{ beat: "TEAL (tape): He'll be where he can hear himself. The parliament mast.", chatter: [{ at: 0.5, text: "SERA: Triangulating. He's above the parliament transmitter." }, { at: 0.8, text: "SERA: Fix is closing. Stay in the volume." }], reinforce: [{ at: 0.4, count: 2 }] }),
			fly("route", "Follow the loyalists' city corridor", [[-600,320,-700],[400,350,-1300]], 0, 0, undefined,
				{ beat: "SERA: Loyalists marked a corridor. Follow two lights into the city.", chatter: [{ at: 0.5, text: "SERA: Loyalists see your lights. Follow the last city beacon." }] }),
			fly("defend", "Protect the parliament quay launch", [[500,40,-1400]], 45, 2, undefined,
				{ beat: "MARINE: Secure the quay while witnesses board. Cover the marked site.", chatter: [{ at: 0.5, text: "MARINE: Witnesses boarding. Quay remains secure." }] }),
			fly("escort", "Cover the witness launch to parliament", [[500,40,-1400],[1100,40,-1000]], 30, 2, undefined,
				{ beat: "MARINE: Witnesses aboard. Keep us covered until parliament is in sight.", chatter: [{ at: 0.5, text: "MARINE: Parliament in sight. Witnesses still aboard." }] }),
		],
		[],
	),
	M(
		27, 3, "Broken Relay", "BROKEN RELAY", "coastal_city", "city_dawn",
		"Confront the Air Marshal and finish the broadcast",
		"Clear Rusk's wing, cut his relay and defeat his last escort. Mark a safe landing strip, bring him down through three stages, climb Teal's beacon line and broadcast the evidence to the coast.",
		"Rusk is in custody on the marked road. The coast hears Teal's evidence in your voice: 'For Teal. For the rim.'",
		[
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
		[{ asset: "comms_relay", name: "MARSHAL RELAY", x: 0, z: -1350 }],
		{
			aceHealth: 320, aceName: "AIR MARSHAL RUSK",
			aceStages: ["RUSK: Every relay says I am the law. Yours is a child's radio. Wing!", "RUSK: Teal obeyed until the one order that mattered. Wing, finish him."],
			aceReturns: ["SERA: Rusk is turning back in. Here he comes.", "RUSK: Then hear it from me. Head on."],
		},
	),
];


/** The phase list a sortie actually runs when every twist fires: inserts spliced after their host phase. */
function expandPhases(phases: MissionPhaseBlueprint[]): MissionPhaseBlueprint[] {
	const expanded: MissionPhaseBlueprint[] = [];
	for (const phase of phases) {
		expanded.push(phase);
		if (phase.twist) for (const inserted of phase.twist.insert) expanded.push(inserted);
	}
	return expanded;
}
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
	"Lira, Merel and Sable keep the farm belt deaf. Teal's packet never reaches the loyalists.",
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
	for (const phase of expandPhases(mission.phases)) optional += phase.optionalRaiders ?? 0;
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
function inBounds(point: FlightPoint): boolean {
	return math.abs(point.x) <= 2400 && math.abs(point.z) <= 2400 && point.y >= 40 && point.y <= 900;
}
function reinforceTotal(phase: MissionPhaseBlueprint): number {
	let total = 0;
	if (phase.reinforce) for (const wave of phase.reinforce) total += wave.count;
	return total;
}
assert(MISSION_COUNT === 27, "Broken Relay must ship 27 missions");
for (let index = 0; index < MISSIONS.size(); index++) {
	const blueprint = MISSIONS[index];
	const id = blueprint.id;
	assert(id === index + 1, `Mission ${index + 1} must have id ${index + 1}`);
	if (id >= 3) {
		const flow = expandPhases(blueprint.phases);
		assert(flow.size() >= 4 && flow.size() <= 7, `Mission ${id} needs 4-7 objective beats`);
		for (let beat = 1; beat < flow.size(); beat++) {
			assert(flow[beat].kind !== flow[beat - 1].kind, `Mission ${id} repeats adjacent objective kinds`);
		}
	}
	assert(blueprint.phases.size() >= 1, `Mission ${id} must have at least one phase`);
	assert(blueprint.failure.size() > 0 && blueprint.failure.size() <= 120, `Mission ${id} needs a short failure outcome`);
	for (const line of [...(blueprint.aceStages ?? []), ...(blueprint.aceReturns ?? [])]) assert(line.size() <= 72, `Mission ${id} ace radio must fit 72 characters`);
	let requiredAce = 0;
	let groundCount = 0;
	for (const phase of blueprint.phases) if (phase.twist) {
		const tag = `Mission ${id} phase ${phase.kind} twist`;
		assert(phase.twist.at > 0 && phase.twist.at <= 1, `${tag} at must be within (0, 1]`);
		assert(phase.twist.text.size() > 0 && phase.twist.text.size() <= 72, `${tag} needs a short radio line`);
		assert(phase.twist.insert.size() >= 1, `${tag} must insert at least one phase`);
		for (const inserted of phase.twist.insert) assert(inserted.twist === undefined, `${tag} may not nest twists`);
		assert(phase.kind !== "route" || phase.twist.mode !== "now", `${tag} cannot cut a route short`);
		// A hazard's targets must die before its phase ends; a "now" twist would strand them.
		assert(phase.hazard === undefined || phase.twist.mode !== "now", `${tag} cannot cut a hazard phase short`);
		if (phase.twist.mode === "now" && (phase.kind === "required_air" || phase.kind === "required_ground" || phase.kind === "ace" || phase.kind === "chase")) {
			// Kill phases progress in whole increments: the first kill that reaches `at` must leave work undone,
			// otherwise the twist would only fire on the completing kill and silently be a no-op.
			const span = phase.kind === "ace" ? 1 : phase.count ?? 0;
			assert(math.ceil(phase.twist.at * span - 1e-5) < span, `${tag} with mode "now" would only fire on the completing kill`);
		}
	}
	for (const phase of expandPhases(blueprint.phases)) {
		const tag = `Mission ${id} phase ${phase.kind}`;
		assert(phase.label.size() > 0 && phase.label.size() <= 40, `${tag} label must fit 40 characters`);
		if (phase.beat) assert(phase.beat.size() <= 72, `${tag} beat must fit 72 characters`);
		if (phase.kind === "ace") requiredAce += 1;
		if (phase.kind === "required_air" || phase.kind === "required_ground" || phase.kind === "chase") {
			assert((phase.count ?? 0) >= 1, `${tag} needs count >= 1`);
		}
		if (phase.kind === "required_ground") groundCount += phase.count ?? 0;
		if (phase.kind === "tutorial_missile") { assert(id === 1, `${tag} is only valid on Mission 1`); groundCount += phase.count ?? 0; }
		if (phase.parkedEscort) {
			assert((phase.kind === "recon" || phase.kind === "signal" || phase.kind === "route") && inBounds(phase.parkedEscort), `${tag} parked escort needs an in-bounds recon, signal or route stop`);
		}
		if (phase.points) {
			assert(phase.points.size() > 0, `${tag} needs at least one point`);
			for (const point of phase.points) assert(inBounds(point), `${tag} point is outside the flyable area or 40-900 altitude`);
			assert((phase.radius ?? 0) > 0, `${tag} needs radius > 0`);
			if (phase.kind === "recon" || phase.kind === "signal" || phase.kind === "escort" || phase.kind === "defend") {
				assert((phase.seconds ?? 0) > 0, `${tag} needs seconds > 0`);
			}
			if (phase.ceiling !== undefined) assert(phase.ceiling >= 230, `${tag} ceiling must be >= 230`);
		}
		if (phase.kind === "chase") {
			assert(phase.count === 1 && (phase.seconds ?? 0) > 0, `${tag} chases one courier for a positive time`);
			assert(phase.escape !== undefined && inBounds(phase.escape) && phase.points === undefined, `${tag} needs an in-bounds escape point and no flight volume`);
		}
		if (phase.groups !== undefined || phase.stagger !== undefined || phase.flank !== undefined || phase.groupAt !== undefined || phase.groupCalls !== undefined) {
			assert(phase.kind === "required_air", `${tag}: groups, stagger, flank, groupAt and groupCalls are only for required_air`);
			assert((phase.groups ?? 1) >= 1 && (phase.groups ?? 1) <= (phase.count ?? 0), `${tag} groups must be 1..count`);
			assert(phase.stagger === undefined || phase.stagger > 0, `${tag} stagger must be positive`);
			const plan = WavePlan.Groups(phase.count ?? 0, phase.groups ?? 1);
			if (phase.groupAt) {
				assert(phase.groupAt.size() === plan.size() - 1 && phase.stagger === undefined, `${tag} groupAt needs one share per later group and no stagger`);
				let previous = 0, spawned = plan[0];
				for (let index = 0; index < phase.groupAt.size(); index++) {
					const at: number = phase.groupAt[index];
					// A share the groups already out cannot reach would strand the phase.
					assert(at > previous && at < 1 && math.ceil(at * (phase.count ?? 0) - 1e-5) <= spawned, `${tag} groupAt shares must rise and be reachable`);
					previous = at; spawned += plan[index + 1];
				}
			}
			if (phase.groupCalls) {
				assert(phase.groupCalls.size() <= plan.size() - 1, `${tag} has more group calls than later groups`);
				for (const line of phase.groupCalls) assert(line.size() > 0 && line.size() <= 72, `${tag} group calls need a short radio line`);
			}
		}
		if (phase.hazard) {
			const effect = phase.hazard.effect;
			assert((effect === "jam" && phase.kind === "signal") || (effect === "guns" && (phase.kind === "escort" || phase.kind === "defend")),
				`${tag} hazard "${effect}" does not fit this phase`);
			assert(phase.hazard.at >= 0 && phase.hazard.at < 1 && phase.hazard.count >= 1, `${tag} hazard needs at in [0, 1) and a count`);
			assert(phase.hazard.text.size() > 0 && phase.hazard.text.size() <= 72, `${tag} hazard needs a short radio line`);
			groundCount += phase.hazard.count;
		}
		if (phase.hidden) assert(phase.kind === "required_ground", `${tag}: only ground strikes hide their targets`);
		if (phase.reinforce) {
			assert(reinforceTotal(phase) >= 1 && reinforceTotal(phase) <= (phase.optionalRaiders ?? 0), `${tag} reinforcements must fit within optionalRaiders`);
			let previous = -1;
			for (const wave of phase.reinforce) {
				assert(wave.count >= 1 && wave.at >= 0 && wave.at <= 1 && wave.at > previous, `${tag} reinforce waves need a count and increasing at in 0-1`);
				previous = wave.at;
			}
		}
		if (phase.chatter) for (const line of phase.chatter) {
			assert(line.at >= 0 && line.at <= 1, `${tag} chatter.at must be within 0-1`);
			assert(line.text.size() > 0 && line.text.size() <= 72, `${tag} chatter needs text`);
		}
	}
	assert(groundCount === blueprint.ground.size(), `Mission ${id} ground objectives (${groundCount}) must match its ground targets (${blueprint.ground.size()})`);
	assert(requiredAce <= 1, `Mission ${id} can have at most one ace phase`);
	if (blueprint.aceStages) assert(requiredAce === 1, `Mission ${id} has ace stages without an ace phase`);
	if (blueprint.aceReturns) assert(requiredAce === 1 && blueprint.aceReturns.size() === 2, `Mission ${id} needs two ace return lines and an ace`);
}

export const MissionCatalog = {
	/** M3-M27 changed layout; older best times belong to the shorter sorties. */
	TimeVersion(id: number): number { return id >= 3 ? 2 : 1; },
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
	/**
	 * Every phase a sortie runs, in order, with each twist's inserted phases spliced after
	 * their host. Twists always fire before their host phase can complete, so this is the
	 * authoritative objective list for totals, par and the debrief.
	 */
	ExpandedPhases(blueprint: MissionBlueprint): MissionPhaseBlueprint[] {
		return expandPhases(blueprint.phases);
	},
	/** Number of phases a winning sortie completes (authored phases plus twist inserts). */
	TotalPhases(blueprint: MissionBlueprint): number {
		return expandPhases(blueprint.phases).size();
	},
	/** Required air kills across all `required_air` and `chase` phases plus 1 for an ace phase. */
	RequiredAirKills(blueprint: MissionBlueprint): number {
		let total = 0;
		for (const phase of expandPhases(blueprint.phases)) {
			if (phase.kind === "required_air" || phase.kind === "chase") total += phase.count ?? 0;
			else if (phase.kind === "ace") total += 1;
		}
		return total;
	},
	/** Required ground kills across all `required_ground` phases and phase hazards, plus the tutorial radar. */
	RequiredGroundKills(blueprint: MissionBlueprint): number {
		let total = 0;
		for (const phase of expandPhases(blueprint.phases)) {
			if (phase.kind === "required_ground") total += phase.count ?? 0;
			else if (phase.kind === "tutorial_missile") total += phase.count ?? 0;
			total += phase.hazard?.count ?? 0;
		}
		return total;
	},
	/**
	 * First ground-target index a phase owns in `phases` (the live or expanded list): ground strikes
	 * and hazards consume the mission's ground list in phase order.
	 */
	GroundStart(phases: MissionPhaseBlueprint[], index: number): number {
		let start = 0;
		for (let i = 0; i < index && i < phases.size(); i++) {
			if (phases[i].kind === "required_ground") start += phases[i].count ?? 0;
			start += phases[i].hazard?.count ?? 0;
		}
		return start;
	},
	/** Ground-target indices kept hidden until their phase activates them (hazards and `hidden` strikes). */
	HiddenGround(blueprint: MissionBlueprint): Set<number> {
		const hidden = new Set<number>();
		const phases = expandPhases(blueprint.phases);
		for (let index = 0; index < phases.size(); index++) {
			const phase = phases[index];
			const count = phase.hazard?.count ?? (phase.hidden ? phase.count ?? 0 : 0);
			const start = MissionCatalog.GroundStart(phases, index);
			for (let offset = 0; offset < count; offset++) hidden.add(start + offset);
		}
		return hidden;
	},
	/** Raiders that arrive at a phase's start (the rest come in its reinforcement waves; an ace calls all of its own). */
	InitialRaiders(phase: MissionPhaseBlueprint): number {
		if (phase.kind === "ace") return 0;
		return math.max(0, (phase.optionalRaiders ?? 0) - reinforceTotal(phase));
	},
	/** Separate raider waves a phase spawns: its opening wave, each reinforcement, or an ace's two calls. */
	RaiderWaves(phase: MissionPhaseBlueprint): number {
		const raiders = phase.optionalRaiders ?? 0;
		if (phase.kind === "ace") return (math.ceil(raiders / 2) > 0 ? 1 : 0) + (raiders - math.ceil(raiders / 2) > 0 ? 1 : 0);
		return (MissionCatalog.InitialRaiders(phase) > 0 ? 1 : 0) + (phase.reinforce?.size() ?? 0);
	},
	/** Raiders a phase may lose when every wave brings `extra` more (Ace difficulty). */
	RaiderCap(phase: MissionPhaseBlueprint, extra = 0): number {
		return (phase.optionalRaiders ?? 0) + math.max(0, extra) * MissionCatalog.RaiderWaves(phase);
	},
	/**
	 * The most hostile aircraft a phase can have up at once if nothing held them back: every group a
	 * timer can send (all of them unless authored `groupAt` shares gate them), less the bandits that
	 * must be down for later events, plus every raider wave whose trigger has been reached, raiders
	 * never dying, each wave `extra` larger. The ace or courier counts one. The server never lets
	 * more than WavePlan.Budget(extra) fly (see CombatService requestAir); this is the demand on it.
	 */
	PeakAircraft(phase: MissionPhaseBlueprint, extra = 0): number {
		const wave = (count: number) => (count > 0 ? count + math.max(0, extra) : 0);
		const raiders = phase.optionalRaiders ?? 0;
		if (phase.kind === "ace") return 1 + wave(math.ceil(raiders / 2)) + wave(raiders - math.ceil(raiders / 2));
		const initial = wave(MissionCatalog.InitialRaiders(phase));
		const reinforce = phase.reinforce ?? [];
		if (phase.kind !== "required_air" && phase.kind !== "required_ground") {
			let all = initial;
			for (const entry of reinforce) all += wave(entry.count);
			return (phase.kind === "chase" ? 1 : 0) + all;
		}
		const count = phase.count ?? 0;
		const air = phase.kind === "required_air";
		const plan = air ? WavePlan.Groups(count, phase.groups ?? 1) : [];
		let peak = 0;
		// k = required kills so far: kill-fraction events have fired, and k bandits are no longer up.
		for (let k = 0; k < count; k++) {
			let spawned = 0;
			for (let index = 0; index < plan.size(); index++) {
				const at = index > 0 ? phase.groupAt?.[index - 1] : undefined;
				if (at !== undefined && k + 1e-5 < at * count) break;
				spawned += plan[index];
			}
			let up = air ? math.max(0, spawned - k) : 0;
			up += initial;
			for (const entry of reinforce) if (k + 1e-5 >= entry.at * count) up += wave(entry.count);
			peak = math.max(peak, up);
		}
		return peak;
	},
	/** Max optional raider spawns, summed across phases that permit them. */
	MaxOptionalRaiders(blueprint: MissionBlueprint): number {
		if (blueprint.optionalRaiderMax !== undefined) return blueprint.optionalRaiderMax;
		let total = 0;
		for (const phase of expandPhases(blueprint.phases)) total += phase.optionalRaiders ?? 0;
		return total;
	},
};
