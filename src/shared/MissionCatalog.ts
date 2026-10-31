import { ProtectionPlan, validateBatchD7 } from "./EngineBatchD7";
import { RepeatedArtillery, validateBatchD6 } from "./EngineBatchD6";
import { InterceptHold, validateBatchD4 } from "./EngineBatchD4";
import { GroundProgressPlan, validateBatchD5 } from "./EngineBatchD5";
import { CanyonEscape, validateBatchD3 } from "./EngineBatchD3";
import { NightLighting, validateNightLighting } from "./NightLighting";
import { SortieArmament, validateArmament } from "./SortieArmament";
import { ScoreThreshold, RadarJamming, RearmPlan, validateBatchC } from "./EngineBatchC";
import { CutInPlan, validateCutIn, validateRearmPresentation } from "./SortieCutaways";
import { MissionUpdate, ReturnLine, LandingPlan, validateBatchB } from "./EngineBatchB";
import { TypedGroundTarget, FighterArrival, StandaloneAce, validateCampaignEncounters } from "./CampaignEncounters";
import { BomberEncounter, validateBomberEncounter } from "./BomberEncounter";
import { mission as practice } from "./missions/practice";
import { missions } from "./missions";
import {
	LEGACY_MISSION_AIRSPACE,
	LEGACY_MISSION_COUNTDOWN,
	LEGACY_MISSION_SCORING,
	LEGACY_MISSION_START,
	MissionAirspacePolicy,
	MissionPolicy,
	MissionScoringPolicy,
	MissionStartPolicy,
	validateMissionPolicy,
} from "./MissionPolicy";
import { WavePlan } from "./WavePlan";

export type { SortieArmament } from "./SortieArmament";
export type { EncounterRole, MissionAirspacePolicy, MissionPolicy, MissionScoringPolicy, MissionStartPolicy } from "./MissionPolicy";

export type Act = 1 | 2 | 3;

export type MissionRegion =
	| "canyon_airfield"
	| "canyon_pass"
	| "upland_farm"
	| "plateau_relay"
	| "coastal_city"
	| "coastal_harbor"
	| "ocean_platform"
	| "snow_mountains";

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
	| "protected_air"
	// Teaching actions
	| "tutorial_move"
	| "tutorial_target"
	| "tutorial_missile"
	// Generic:
	| "score_threshold"
	| "required_air"
	| "required_ground"
	| "ace"
	| "return_line"
	| "landing"
	| "route"
	| "recon"
	| "signal"
	| "escort"
	| "defend"
	// A fast, non-firing courier that runs for `escape`; it escapes (mission failed) after `seconds`.
	| "chase";

/** A radio line fired once when the phase progress fraction crosses `at` (0-1). */
export interface PhaseChatter { at: number; text: string }
/** Optional raiders spawned at objective progress `at`; bomber phases use elapsed route fraction. */
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

/** Execution details preserving the original training and harbor sortie choreography. */
export interface PhaseExecution {
	minimumDwell?: number;
	movementDuration?: number;
	practice?: boolean;
	launchDelay?: number;
	activatePracticeTarget?: boolean;
	preservePursuers?: boolean;
	directSpawn?: boolean;
	fixedRaiders?: boolean;
	/** Sortie-wide cap, shared by phases (rather than the usual per-phase cap). */
	raiderKillCap?: number;
	hudPhase?: string;
	objective?: string;
}

export interface MissionPhaseBlueprint {
	protection?: ProtectionPlan;
	/** Finite waves queue within this opt-in concurrent fighter budget. */
	concurrentFighters?: number;
	interceptHold?: InterceptHold;
	canyonEscape?: CanyonEscape;
	repeatedArtillery?: RepeatedArtillery;
	cheapContacts?: true;
	scoreThreshold?: ScoreThreshold;
	jamming?: RadarJamming;
	groundProgress?: GroundProgressPlan;
	rearm?: RearmPlan;
	/** HUD-less cut-in with the mission clock held (SortieCutaways). */
	cutIn?: CutInPlan;
	/** Fired once on entry to this phase (mid-sortie update). */
	update?: MissionUpdate;
	returnLine?: ReturnLine;
	landing?: LandingPlan;
	groundTargets?: TypedGroundTarget[];
	fighterWaves?: FighterArrival[];
	standaloneAce?: StandaloneAce;
	bombers?: BomberEncounter;
	execution?: PhaseExecution;
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

export interface MissionBlueprint extends MissionPolicy {
	/** Engine batch D1: fitted gun and finite sortie stocks. Absent keeps today's regenerating rack and no gun. */
	armament?: SortieArmament;
	nightLighting?: NightLighting;
	terrainRelativeWarnings?: boolean;
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
	/** Historical catalog tag, retained for data/API compatibility; never selects a runner. */
	legacy?: 1 | 2;
}

export const PRACTICE = practice;
export const MISSIONS: MissionBlueprint[] = missions;

/** The phase list a sortie actually runs when every twist fires: inserts spliced after their host phase. */
function expandPhases(phases: MissionPhaseBlueprint[]): MissionPhaseBlueprint[] {
	const expanded: MissionPhaseBlueprint[] = [];
	for (const phase of phases) {
		expanded.push(phase);
		if (phase.twist) for (const inserted of phase.twist.insert) expanded.push(inserted);
	}
	return expanded;
}
// Recompute optional counts after authored flight objectives are installed.
for (const mission of MISSIONS) {
	let optional = 0;
	for (const phase of expandPhases(mission.phases)) optional += (phase.bombers?.escorts.count ?? 0) + (phase.optionalRaiders ?? 0) + (phase.standaloneAce ? 1 : 0) + (phase.fighterWaves ?? []).reduce((sum,w)=>sum+w.count,0);
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
	snow_mountains: "SNOWY MOUNTAINS",
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
assert(MISSION_COUNT === 18, "SKYBREAK must ship 18 numbered missions");
for (let index = -1; index < MISSIONS.size(); index++) {
	const blueprint = index === -1 ? PRACTICE : MISSIONS[index];
	const id = blueprint.id;
	assert(id === index + 1, `Mission ${index + 1} must have id ${index + 1}`);
	validateMissionPolicy(blueprint, id);
	assert(blueprint.terrainRelativeWarnings === undefined || typeIs(blueprint.terrainRelativeWarnings,"boolean"), "Invalid terrain warning flag");
	if(blueprint.nightLighting) validateNightLighting(blueprint.nightLighting, (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
		validateBatchC(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
	validateArmament(blueprint.armament, expandPhases(blueprint.phases).some(phase => phase.rearm?.gun === true));
	validateBatchD7(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).spawnLimit);
	validateBatchD6(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth, blueprint.terrainRelativeWarnings === true);
	validateBatchD4(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).spawnLimit);
	validateBatchD5(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
	validateBatchD3(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth, blueprint.terrainRelativeWarnings === true);
		validateBatchB(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
	validateCutIn(expandPhases(blueprint.phases));
	for (const phase of expandPhases(blueprint.phases)) if (phase.rearm) validateRearmPresentation(phase.rearm);
	validateCampaignEncounters(blueprint, expandPhases(blueprint.phases), blueprint.airspace ?? LEGACY_MISSION_AIRSPACE, blueprint.scoring ?? LEGACY_MISSION_SCORING);
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
		validateBomberEncounter(phase, blueprint.airspace ?? LEGACY_MISSION_AIRSPACE, blueprint.scoring ?? LEGACY_MISSION_SCORING);
		assert(phase.label.size() > 0 && phase.label.size() <= 40, `${tag} label must fit 40 characters`);
		if (phase.beat) assert(phase.beat.size() <= 72, `${tag} beat must fit 72 characters`);
		if (phase.kind === "ace") requiredAce += 1;
		if (phase.kind === "required_air" || phase.kind === "required_ground" || phase.kind === "chase") {
			assert((phase.count ?? 0) >= 1, `${tag} needs count >= 1`);
		}
		if (phase.kind === "required_ground" && phase.groundTargets === undefined) groundCount += phase.count ?? 0;
		if (phase.kind === "tutorial_missile") { assert(id === 0, `${tag} is only valid in Practice`); groundCount += phase.count ?? 0; }
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

function resolveBlueprint(value: number | MissionBlueprint): MissionBlueprint {
	if (typeIs(value, "number")) {
		assert(value >= 0 && value <= MISSION_COUNT && value % 1 === 0, `Unknown mission id: ${tostring(value)}`);
		return value === 0 ? PRACTICE : MISSIONS[value - 1];
	}
	return value;
}

export const MissionCatalog = {
	/** M3-M27 changed layout; older best times belong to the shorter sorties. */
	TimeVersion(id: number): number { return id >= 3 ? 2 : 1; },
	Get(id: number): MissionBlueprint {
		return resolveBlueprint(id);
	},
	/** Effective sortie deadline; absent policy preserves the global 900-second limit. */
	CountdownSeconds(value: number | MissionBlueprint): number {
		return resolveBlueprint(value).countdownSeconds ?? LEGACY_MISSION_COUNTDOWN;
	},
	/** Upper bound for settlement: each phase-entry reset can extend the previous deadline. */
	MaxMissionSeconds(value: number | MissionBlueprint): number {
		const blueprint = resolveBlueprint(value);
		let limit = MissionCatalog.CountdownSeconds(blueprint);
		for (const phase of expandPhases(blueprint.phases)) limit += (phase.update?.countdownSeconds ?? 0)+(phase.scoreThreshold?.seconds ?? 0);
		return limit;
	},
	/** Effective horizontal world limits; absent policy preserves WorldAirspace exactly. */
	Airspace(value: number | MissionBlueprint): MissionAirspacePolicy {
		return resolveBlueprint(value).airspace ?? LEGACY_MISSION_AIRSPACE;
	},
	/** Effective initial pose; absent policy preserves FlightMath.NewState exactly. */
	Start(value: number | MissionBlueprint): MissionStartPolicy {
		return resolveBlueprint(value).start ?? LEGACY_MISSION_START;
	},
	/** Effective point values and rank cuts; absent policy describes today's MissionScore rules. */
	Scoring(value: number | MissionBlueprint): MissionScoringPolicy {
		return resolveBlueprint(value).scoring ?? LEGACY_MISSION_SCORING;
	},
	/** Effective world-plan key; absent policy continues selecting by the mission's region. */
	WorldKey(value: number | MissionBlueprint): string {
		const blueprint = resolveBlueprint(value);
		return blueprint.worldKey ?? blueprint.region;
	},
	/** Effective release state; absent policy preserves today's fully available catalog. */
	Available(value: number | MissionBlueprint): boolean {
		return resolveBlueprint(value).available ?? true;
	},
	/** Exposed for authoring tests and future catalog builders; throws on an invalid policy. */
	ValidatePolicy(blueprint: MissionBlueprint): void {
		validateMissionPolicy(blueprint, blueprint.id);
		assert(blueprint.terrainRelativeWarnings === undefined || typeIs(blueprint.terrainRelativeWarnings,"boolean"),"Invalid terrain warning flag");
		if(blueprint.nightLighting) validateNightLighting(blueprint.nightLighting, (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
	validateBatchC(expandPhases(blueprint.phases), MissionCatalog.Airspace(blueprint).hardHalfWidth);
	validateArmament(blueprint.armament, expandPhases(blueprint.phases).some(phase => phase.rearm?.gun === true));
	validateBatchD7(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).spawnLimit);
	validateBatchD6(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth, blueprint.terrainRelativeWarnings === true);
	validateBatchD4(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).spawnLimit);
	validateBatchD5(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth);
	validateBatchD3(expandPhases(blueprint.phases), (blueprint.airspace ?? LEGACY_MISSION_AIRSPACE).hardHalfWidth, blueprint.terrainRelativeWarnings === true);
	validateBatchB(expandPhases(blueprint.phases), MissionCatalog.Airspace(blueprint).hardHalfWidth);
	validateCutIn(expandPhases(blueprint.phases));
	for (const phase of expandPhases(blueprint.phases)) if (phase.rearm) validateRearmPresentation(phase.rearm);
		assert(blueprint.phases.size()>0,"Mission needs a phase");
		validateCampaignEncounters(blueprint, expandPhases(blueprint.phases), MissionCatalog.Airspace(blueprint), MissionCatalog.Scoring(blueprint));
		for (const phase of expandPhases(blueprint.phases)) validateBomberEncounter(phase, blueprint.airspace ?? LEGACY_MISSION_AIRSPACE, blueprint.scoring ?? LEGACY_MISSION_SCORING);
	},
	All(): MissionBlueprint[] {
		return MISSIONS;
	},
	ByAct(act: Act): MissionBlueprint[] {
		return MISSIONS.filter((blueprint) => blueprint.act === act);
	},
	IsValidId(value: unknown): value is number {
		return typeIs(value, "number") && value === value && value % 1 === 0 && value >= 0 && value <= MISSION_COUNT;
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
			if (phases[i].kind === "required_ground" && phases[i].groundTargets === undefined) start += phases[i].count ?? 0;
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
			const count = phase.groundTargets !== undefined ? 0 : phase.hazard?.count ?? (phase.hidden ? phase.count ?? 0 : 0);
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
		return (phase.standaloneAce ? 1 : 0) + (phase.fighterWaves ?? []).reduce((sum,w) => sum+w.count,0) + (phase.bombers?.escorts.count ?? 0) + (phase.optionalRaiders ?? 0) + math.max(0, extra) * MissionCatalog.RaiderWaves(phase);
	},
	/**
	 * The most hostile aircraft a phase can have up at once if nothing held them back: every group a
	 * timer can send (all of them unless authored `groupAt` shares gate them), less the bandits that
	 * must be down for later events, plus every raider wave whose trigger has been reached, raiders
	 * never dying, each wave `extra` larger. The ace or courier counts one. The server never lets
	 * more than WavePlan.Budget(extra) fly (see CombatService requestAir); this is the demand on it.
	 */
	PeakAircraft(phase: MissionPhaseBlueprint, extra = 0): number {
		if (phase.bombers) return phase.bombers.count + MissionCatalog.RaiderCap(phase, extra);
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
		for (const phase of expandPhases(blueprint.phases)) total += (phase.bombers?.escorts.count ?? 0) + (phase.optionalRaiders ?? 0);
		return total;
	},
};
