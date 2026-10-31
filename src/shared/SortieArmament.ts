// Engine batch D1: the player gun and opt-in finite sortie ammunition.
// Pure rules shared by the server (authoritative) and the HUD (presentation).
// A mission without `armament` keeps today's sortie exactly: no gun, an eight-missile
// rack regenerating one missile every 2.5 s, and the special's own charges and recharge.
import { WeaponRules } from "./WeaponRules";
import type { Point } from "./WeaponRules";
import { SpecialWeapons } from "./SpecialWeapons";
import type { SpecialKind, SpecialState } from "./SpecialWeapons";

/** The fitted cannon: a counted magazine for the whole sortie (refilled only by an opted-in rearm). */
export interface GunFit { rounds: number }
/** Finite sortie stocks: no missile regeneration and no special recharge; a rearm restores them. */
export interface SortieStock {
	missiles: number;
	/** Special charges for the sortie; absent keeps the special's own charge count (still without recharge). */
	specialCharges?: number;
}
export interface SortieArmament { gun?: GunFit; stock?: SortieStock; /** Hull-only sea-skimming XLAA mode. */ antiShip?: true }
/** Which stocks a rearm restores; `gun` absent follows `missiles`. */
export interface RefillFlags { missiles: boolean; special: boolean; gun?: boolean }
export interface Refill { missiles?: number; special?: SpecialState; gunRounds?: number }

export const GUN_ROUNDS_MAX = 2000;
export const STOCK_MISSILES_MAX = 120;
export const STOCK_SPECIAL_MAX = 16;
/** Seconds to regenerate one missile on the default rack. */
export const MISSILE_REGEN_SECONDS = 2.5;

function integer(value: unknown, low: number, high: number): boolean {
	return typeIs(value, "number") && value === value && value % 1 === 0 && value >= low && value <= high;
}

/** Throws on a malformed armament; absent armament is today's default and always valid. */
export function validateArmament(armament: SortieArmament | undefined, rearmGun: boolean): void {
	if (armament === undefined) { assert(!rearmGun, "Rearm gun refill needs a fitted gun"); return; }
	assert(typeIs(armament, "table"), "Invalid armament");
	assert(armament.gun !== undefined || armament.stock !== undefined || armament.antiShip !== undefined, "Armament must fit a gun, finite stocks or anti-ship mode");
	assert(armament.antiShip === undefined || armament.antiShip === true, "Invalid anti-ship fit");
	if (armament.gun !== undefined) assert(typeIs(armament.gun, "table") && integer(armament.gun.rounds, 1, GUN_ROUNDS_MAX), "Invalid gun rounds");
	else assert(!rearmGun, "Rearm gun refill needs a fitted gun");
	if (armament.stock !== undefined) {
		assert(typeIs(armament.stock, "table") && integer(armament.stock.missiles, 1, STOCK_MISSILES_MAX), "Invalid missile stock");
		assert(armament.stock.specialCharges === undefined || integer(armament.stock.specialCharges, 0, STOCK_SPECIAL_MAX), "Invalid special stock");
	}
}

export const SortieArmament = {
	/** Today's rack regenerates; a finite stock never does. */
	Regenerates(armament: SortieArmament | undefined): boolean { return armament?.stock === undefined; },
	MissileCapacity(armament: SortieArmament | undefined): number { return armament?.stock?.missiles ?? WeaponRules.MaxMissiles; },
	/** The special slot at launch: unchanged by default, a fixed non-recharging stock when finite. */
	NewSpecial(kind: SpecialKind, armament: SortieArmament | undefined): SpecialState {
		const state = SpecialWeapons.New(kind);
		const stock = armament?.stock;
		if (stock === undefined) return state;
		state.charges = stock.specialCharges ?? state.charges;
		state.capacity = state.charges;
		state.finite = true;
		return state;
	},
	/** Default rack: +1 missile every 2.5 s up to eight. Finite stock: nothing, and the timer stays clear. */
	RackTick(missiles: number, regen: number, dt: number, armament: SortieArmament | undefined): [number, number] {
		if (!SortieArmament.Regenerates(armament)) return [missiles, 0];
		regen += dt;
		if (regen >= MISSILE_REGEN_SECONDS) { regen -= MISSILE_REGEN_SECONDS; missiles = math.min(WeaponRules.MaxMissiles, missiles + 1); }
		return [missiles, regen];
	},
	/** A missile chasing a withdrawn enemy comes back to the rack (never above capacity). */
	Refund(missiles: number, armament: SortieArmament | undefined): number { return math.min(SortieArmament.MissileCapacity(armament), missiles + 1); },
	/** Why an empty FIRE is refused: the default rack is reloading; a finite stock is spent. */
	EmptyNotice(armament: SortieArmament | undefined): "no_ammo" | "missiles_spent" { return SortieArmament.Regenerates(armament) ? "no_ammo" : "missiles_spent"; },
	/** What a completed rearm restores. Default armament reproduces batch C exactly (eight missiles, a fresh special). */
	Refill(flags: RefillFlags, armament: SortieArmament | undefined, kind: SpecialKind): Refill {
		const refill: Refill = {};
		if (flags.missiles) refill.missiles = SortieArmament.MissileCapacity(armament);
		if (flags.special) refill.special = SortieArmament.NewSpecial(kind, armament);
		if (armament?.gun && (flags.gun ?? flags.missiles)) refill.gunRounds = armament.gun.rounds;
		return refill;
	},
};

// ---------------------------------------------------------------------------
// Player gun: hold to fire. The server counts rounds on its fixed step and resolves
// each round as an instant line from the nose; the client only draws tracers.

/** Rounds per second while the trigger is held. */
const GUN_RATE = 10;
/** Hull/health per round: a 55-health ground target takes 14 rounds; a 100-health raider 25. */
const GUN_DAMAGE = 4;
/** Effective range in studs. */
const GUN_RANGE = 900;
/** Miss tolerance at the muzzle (studs) and its growth per stud of range: an arcade cone, generous on purpose. */
const GUN_AIR_RADIUS = 26;
const GUN_GROUND_RADIUS = 20;
const GUN_SPREAD = 0.02;
/** Most impact effects the server sends per second (each round still counts). */
const GUN_EFFECT_INTERVAL = 0.15;
/** Float slack for the shot clock, and how far short of the aim point an obstacle hit still counts as the target. */
const SHOT_EPSILON = 1e-6;
const COVER_EPSILON = 2;

export interface GunState {
	rounds: number;
	capacity: number;
	held: boolean;
	/**
	 * Seconds until the next round may fire. Server-owned and kept across releases: pressing the
	 * trigger never replenishes firing time, so tapping cannot beat the held rate.
	 */
	cooldown: number;
	fired: number;
	hits: number;
	/** Elapsed time of the last impact effect sent. */
	effectAt: number;
}
export interface GunCandidate { position: Point; ground: boolean; allowed: boolean }

function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

export const GunRules = {
	Rate: GUN_RATE,
	Interval: 1 / GUN_RATE,
	Damage: GUN_DAMAGE,
	Range: GUN_RANGE,
	AirRadius: GUN_AIR_RADIUS,
	GroundRadius: GUN_GROUND_RADIUS,
	Spread: GUN_SPREAD,
	EffectInterval: GUN_EFFECT_INTERVAL,
	/** No gun unless the mission fits one. */
	New(armament: SortieArmament | undefined): GunState | undefined {
		const fit = armament?.gun;
		return fit ? { rounds: fit.rounds, capacity: fit.rounds, held: false, cooldown: 0, fired: 0, hits: 0, effectAt: -math.huge } : undefined;
	},
	/** Trigger pressed: the next round fires once the shot cooldown allows. Refused (and not held) when the magazine is empty. */
	Start(state: GunState): "gun_empty" | undefined {
		if (!finite(state.rounds) || state.rounds <= 0) { state.held = false; return "gun_empty"; }
		state.held = true;
		return undefined;
	},
	/** Trigger released, or the sortie took the jet away (pause, landing, rearm, input silence). The cooldown keeps running. */
	Stop(state: GunState): void { state.held = false; },
	/**
	 * Call every fixed step, held or not. Rounds to fire in this step: one each time the shot cooldown
	 * expires while held. Released, the cooldown only runs down to zero (no banked credit).
	 */
	Step(state: GunState, dt: number): number {
		if (!finite(dt) || dt <= 0) return 0;
		if (state.rounds <= 0) state.held = false;
		if (!state.held) { state.cooldown = math.max(0, state.cooldown - dt); return 0; }
		// Walk this step's time: a round fires whenever the cooldown is spent; one due exactly at the
		// step's end belongs to the next step. Held time never carries back before the press.
		let rounds = 0, budget = dt;
		const interval = 1 / GUN_RATE;
		while (state.rounds > 0) {
			if (state.cooldown <= SHOT_EPSILON) { state.cooldown = interval; state.rounds -= 1; state.fired += 1; rounds += 1; }
			else if (state.cooldown < budget - SHOT_EPSILON) { budget -= state.cooldown; state.cooldown = 0; }
			else { state.cooldown = math.max(0, state.cooldown - budget); break; }
		}
		if (state.rounds <= 0) GunRules.Stop(state);
		return rounds;
	},
	/**
	 * Line-of-fire verdict from one ray cast muzzle -> aim point (`distance` studs): any terrain/scenery hit
	 * before the aim point blocks the round, short of a 2-stud epsilon; hits on the target's own model never do.
	 */
	Occluded(hitDistance: number | undefined, hitIsTarget: boolean, distance: number): boolean {
		return hitDistance !== undefined && !hitIsTarget && hitDistance < distance - COVER_EPSILON;
	},
	CoverEpsilon: COVER_EPSILON,
	Refill(state: GunState, rounds: number): void { state.rounds = math.clamp(math.floor(rounds), 0, state.capacity); },
	/** Miss tolerance for a candidate `along` studs down the line. */
	Tolerance(ground: boolean, along: number): number { return (ground ? GUN_GROUND_RADIUS : GUN_AIR_RADIUS) + GUN_SPREAD * math.max(0, along); },
	/**
	 * One round fired from `origin` along unit `forward`: the index of the nearest allowed candidate
	 * in front of the nose, inside range, whose miss distance is within its tolerance; undefined is a miss.
	 */
	Resolve(origin: Point, forward: Point, candidates: readonly GunCandidate[], range: number = GUN_RANGE): number | undefined {
		const length = math.sqrt(forward.x * forward.x + forward.y * forward.y + forward.z * forward.z);
		if (!finite(length) || length <= 0) return undefined;
		const fx = forward.x / length, fy = forward.y / length, fz = forward.z / length;
		let best: number | undefined;
		let bestAlong = math.huge;
		for (let index = 0; index < candidates.size(); index++) {
			const candidate = candidates[index];
			if (!candidate.allowed) continue;
			const p = candidate.position;
			if (!finite(p.x) || !finite(p.y) || !finite(p.z)) continue;
			const dx = p.x - origin.x, dy = p.y - origin.y, dz = p.z - origin.z;
			const along = dx * fx + dy * fy + dz * fz;
			if (along <= 0 || along > range) continue;
			const mx = dx - fx * along, my = dy - fy * along, mz = dz - fz * along;
			if (math.sqrt(mx * mx + my * my + mz * mz) > GunRules.Tolerance(candidate.ground, along)) continue;
			if (along < bestAlong) { bestAlong = along; best = index; }
		}
		return best;
	},
	/** Rate-limits impact effects; every round still damages. */
	TakeEffect(state: GunState, elapsed: number): boolean {
		if (elapsed - state.effectAt < GUN_EFFECT_INTERVAL) return false;
		state.effectAt = elapsed;
		return true;
	},
};
