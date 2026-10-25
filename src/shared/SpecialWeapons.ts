// Pure rules for the second weapon slot: the special chosen on the briefing screen.
// The server owns the state and every gameplay effect; the HUD only renders it.
import { WeaponRules } from "./WeaponRules";

export type SpecialKind = "uav" | "flares" | "salvo" | "lance";
export type SpecialDenied = "special_empty" | "special_cooldown" | "special_active" | "special_no_target";
export type SpecialDecision = { kind: "denied"; reason: SpecialDenied } | { kind: "ok" };

export interface SpecialDefinition {
	kind: SpecialKind;
	/** Briefing name. */
	name: string;
	/** Three or four letters for the HUD button and status line. */
	short: string;
	/** One line for the briefing picker. */
	description: string;
	/** Charges at launch (and the recharge ceiling). */
	charges: number;
	/** Seconds to regain one charge; absent means the sortie's charges are all there is. */
	rechargeSeconds?: number;
	/** Seconds after an activation before the next one. */
	cooldown: number;
	/** Seconds the effect stays active after an activation (drone flight, decoy cloud). */
	duration?: number;
}

export interface SpecialState {
	kind: SpecialKind;
	charges: number;
	cooldown: number;
	/** Progress toward the next recharged charge, in seconds. */
	recharge: number;
	/** Seconds of effect remaining (0 when idle). */
	active: number;
}

export interface SpecialButtonState {
	text: string;
	/** Solid accent while the effect is active. */
	filled: boolean;
	enabled: boolean;
	/** Cooling down or empty: label shown dimmed. */
	dimmed: boolean;
}

/** What a salvo needs to know about one candidate; distance and dot are to the player's nose. */
export interface SalvoCandidate {
	distance: number;
	dot: number;
	ground: boolean;
	required: boolean;
	/** Alive, owned by this session and damageable in the current phase. */
	allowed: boolean;
	/** The player's current target leads the salvo. */
	current: boolean;
}

const UAV_RANGE_FACTOR = 1.35;
const UAV_LOCK_BUILD_SECONDS = 0.4;
const LANCE_RANGE = 3800;
const SALVO_MAX = 4;
const FLARE_DECOY_RADIUS = 1200;
const FLARE_CHANCE = 1;
const FLARE_CHANCE_ACE = 0.65;
const STANDARD_DAMAGE = 55;
const LANCE_DAMAGE = 110;
const LANCE_SPEED = 950;

const DEFINITIONS: { [K in SpecialKind]: SpecialDefinition } = {
	uav: {
		kind: "uav", name: "RECON DRONE", short: "UAV",
		description: "Marks every hostile for 20 s. Locks build twice as fast and 35% farther.",
		charges: 2, cooldown: 25, duration: 20,
	},
	flares: {
		kind: "flares", name: "FLARE POD", short: "FLR",
		description: "2.5 s decoy cloud: inbound missiles within 1200 m chase it. One charge back every 15 s.",
		charges: 3, rechargeSeconds: 15, cooldown: 1.5, duration: 2.5,
	},
	salvo: {
		kind: "salvo", name: "4AAM SALVO", short: "4AAM",
		description: "Four guided missiles at up to four different hostiles in the lock cone, no lock time.",
		charges: 3, cooldown: 5,
	},
	lance: {
		kind: "lance", name: "XLAA LANCE", short: "XLAA",
		description: "Heavy long-range missile: locks out to 3800 m and downs a bandit in one hit.",
		charges: 4, cooldown: 4,
	},
};
const ORDER: SpecialKind[] = ["uav", "flares", "salvo", "lance"];

function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

export const SpecialWeapons = {
	Default: "uav" as SpecialKind,
	Order: ORDER,
	UavRangeFactor: UAV_RANGE_FACTOR,
	UavLockBuildSeconds: UAV_LOCK_BUILD_SECONDS,
	LanceRange: LANCE_RANGE,
	SalvoMax: SALVO_MAX,
	FlareDecoyRadius: FLARE_DECOY_RADIUS,
	IsKind(value: unknown): value is SpecialKind {
		return typeIs(value, "string") && ORDER.includes(value as SpecialKind);
	},
	Get(kind: SpecialKind): SpecialDefinition { return DEFINITIONS[kind]; },
	All(): SpecialDefinition[] { return ORDER.map((kind) => DEFINITIONS[kind]); },
	/** The next special in briefing order (tap to cycle). */
	Next(kind: SpecialKind): SpecialKind { return ORDER[(ORDER.indexOf(kind) + 1) % ORDER.size()]; },
	New(kind: SpecialKind): SpecialState {
		return { kind, charges: DEFINITIONS[kind].charges, cooldown: 0, recharge: 0, active: 0 };
	},
	/** Advances cooldown, effect time and recharge by `dt` seconds. */
	Tick(state: SpecialState, dt: number): void {
		if (!finite(dt) || dt <= 0) return;
		state.cooldown = math.max(0, state.cooldown - dt);
		state.active = math.max(0, state.active - dt);
		const definition = DEFINITIONS[state.kind];
		if (definition.rechargeSeconds === undefined || state.charges >= definition.charges) { state.recharge = 0; return; }
		state.recharge += dt;
		while (state.recharge >= definition.rechargeSeconds && state.charges < definition.charges) {
			state.recharge -= definition.rechargeSeconds;
			state.charges += 1;
		}
		if (state.charges >= definition.charges) state.recharge = 0;
	},
	/**
	 * Spends a charge if the special can fire now. `targets` is how many valid targets the
	 * caller found (salvo: enemies in the cone, lance: 1 when locked); support specials pass 1.
	 */
	Activate(state: SpecialState, targets: number): SpecialDecision {
		const definition = DEFINITIONS[state.kind];
		if (!finite(state.charges) || state.charges <= 0) return { kind: "denied", reason: "special_empty" };
		// The drone's cooldown outlasts its flight, so "already up" is checked first to explain the press.
		if (state.kind === "uav" && state.active > 0) return { kind: "denied", reason: "special_active" };
		if (state.cooldown > 0) return { kind: "denied", reason: "special_cooldown" };
		if ((state.kind === "salvo" || state.kind === "lance") && (!finite(targets) || targets < 1)) return { kind: "denied", reason: "special_no_target" };
		state.charges -= 1;
		state.cooldown = definition.cooldown;
		state.active = definition.duration ?? 0;
		return { kind: "ok" };
	},
	/** Lock envelope range with this special equipped (lance) or active (drone). */
	LockRange(state: SpecialState): number {
		if (state.kind === "lance") return LANCE_RANGE;
		if (state.kind === "uav" && state.active > 0) return WeaponRules.LockRange * UAV_RANGE_FACTOR;
		return WeaponRules.LockRange;
	},
	LockBuildSeconds(state: SpecialState): number {
		return state.kind === "uav" && state.active > 0 ? UAV_LOCK_BUILD_SECONDS : WeaponRules.LockBuildSeconds;
	},
	/**
	 * Indices of up to four distinct salvo targets: allowed candidates inside the lock cone
	 * (`range`, air or ground dot), the current target first, then required ones, then nearest.
	 */
	SalvoTargets(candidates: readonly SalvoCandidate[], range: number): number[] {
		const picked: number[] = [];
		for (let index = 0; index < candidates.size(); index++) {
			const candidate = candidates[index];
			if (!candidate.allowed || !finite(candidate.distance) || !finite(candidate.dot)) continue;
			if (candidate.distance > range || candidate.dot < WeaponRules.LockDotFor(candidate.ground)) continue;
			picked.push(index);
		}
		table.sort(picked, (a, b) => {
			const left = candidates[a], right = candidates[b];
			if (left.current !== right.current) return left.current;
			if (left.required !== right.required) return left.required;
			return left.distance < right.distance;
		});
		while (picked.size() > SALVO_MAX) picked.pop();
		return picked;
	},
	FlareChance(ace: boolean): number { return ace ? FLARE_CHANCE_ACE : FLARE_CHANCE; },
	/** Whether a missile inside the decoy cloud takes the bait; `roll` is uniform in [0, 1). */
	FlareDecoys(roll: number, ace: boolean): boolean {
		return finite(roll) && roll < SpecialWeapons.FlareChance(ace);
	},
	/** Hull damage and speed of a missile launched by this special. */
	MissileDamage(kind: SpecialKind): number { return kind === "lance" ? LANCE_DAMAGE : STANDARD_DAMAGE; },
	MissileSpeed(kind: SpecialKind): number { return kind === "lance" ? LANCE_SPEED : WeaponRules.MissileSpeed; },
	StandardDamage: STANDARD_DAMAGE,
	/** HUD button label and state; the server answers every press, so it is always enabled. */
	Button(kind: SpecialKind, charges: number, cooldown: number, active: number): SpecialButtonState {
		const definition = DEFINITIONS[kind];
		const count = finite(charges) ? math.max(0, math.floor(charges)) : 0;
		if (finite(active) && active > 0) return { text: `${definition.short} ${math.ceil(active)}`, filled: true, enabled: true, dimmed: false };
		if (count <= 0) return { text: `${definition.short} 0`, filled: false, enabled: true, dimmed: true };
		if (finite(cooldown) && cooldown > 0) return { text: string.format("%.1f", cooldown), filled: false, enabled: true, dimmed: true };
		return { text: `${definition.short} ${count}`, filled: false, enabled: true, dimmed: false };
	},
};
