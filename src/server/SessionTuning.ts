// Per-act threat tuning for CombatService and the combat runtimes: the TUNING tables (CombatBalance and
// CombatEnvelope numbers indexed by act), the difficulty knob that scales each table, the GENTLE gate for
// missions 1-4 and the spawn/withdraw/avoidance/evade constants. Pure data plus two pure readers; no
// session mutation. Values are owned by the shared CombatBalance/CombatEnvelope modules; change them there.
import type { CombatSession } from "./CombatSession";
import { sessionAct } from "./SessionQueries";
import { CombatBalance } from "../shared/CombatBalance";
import { CombatEnvelope } from "../shared/CombatEnvelope";
import { Difficulty, type DifficultyKnob } from "../shared/Difficulty";
import { FlightPrediction } from "../shared/FlightPrediction";

// Threat tuning indexed by act (1-3). Missions 1-2 use act 1. Every knob is a plain per-act array so the
// difficulty selector can multiply it in tuned() without touching the combat code. Missions 1-4 use GENTLE
// for the flight gate instead (one threat at a time, the slowest cadence).
//   hostileDamage   hull lost per hostile missile hit (aces add ACE_DAMAGE_BONUS).
//   windup          seconds a shooter shows MISSILE WARNING before launch.
//   flightGate      seconds between windup starts for a lone bandit. More live hostiles divide it
//                   (ThreatRules.FlightGate: +50% per extra hostile, up to flightDivisor), never below
//                   the 1.5 s global spacing, so five bandits really are more dangerous than one.
//   flightDivisor   the most a flight can divide flightGate by.
//   threatCap       most concurrent hostile threats (windups lit plus missiles in flight); scales with
//                   live hostiles (one per two) up to this. Aces are outside the cap and the gate.
//   banditReload    one bandit's own reload after it fires; aceReload is the ace's (its whole gate).
//   fireAimDot      nose dot a shooter needs on the player; straightRelax is subtracted while the stick is centered.
//   fireRange       [min, max] launch range for bandits.
//   banditHealth    required bandits: two missiles on Normal; Ace restores heavier flights. Raiders stay at RAIDER_HEALTH.
//   banditFlares    flares a required bandit carries (Act III: one).
//   lockBreakChance odds a bandit breaks out of a lock building inside 900 studs (once per 12 s).
//   aceFlares       flares an ace carries; each decoys every player missile within 260 studs for 2.5 s.
//   aceLockBreak    seconds between ace lock-break notches (x0.6 below a third of health).
//   aceStageSpeed   speed bonus an ace gains at each stage line.
//   aceSalvo        hostile missiles per ace launch.
//   missileTurn     hostile missile steering rate (aces add aceMissileTurn): Act I can be out-turned, Act III must be evaded.
//   missileSpeed    hostile missile speed; missileLife its flight time; missileFuse its proximity radius on the player.
//   breakChance     odds a bandit breaks against an inbound guided player missile (shares the 12 s break cooldown).
//   breakSeconds    how long a break lasts; breakTurn the bandit's steering rate while breaking.
export const TUNING = {
	hostileDamage: CombatBalance.hostileDamage,
	windup: CombatBalance.windup,
	flightGate: CombatBalance.flightGate,
	flightDivisor: CombatBalance.flightDivisor,
	threatCap: CombatBalance.threatCap,
	banditReload: CombatBalance.banditReload,
	aceReload: CombatBalance.aceReload,
	fireAimDot: CombatBalance.fireAimDot,
	straightRelax: CombatBalance.straightRelax,
	fireRange: CombatBalance.fireRange,
	banditHealth: CombatBalance.banditHealth,
	banditFlares: [0, 0, 1],
	lockBreakChance: [0.5, 1, 1],
	aceFlares: CombatEnvelope.aceFlares,
	aceLockBreak: CombatEnvelope.aceLockBreak,
	aceStageSpeed: CombatEnvelope.aceStageSpeed,
	aceSalvo: CombatBalance.aceSalvo,
	missileTurn: [1.6, 2.2, 2.8],
	aceMissileTurn: [0.6, 0.9, 1.2],
	missileSpeed: CombatBalance.missileSpeed,
	missileLife: CombatBalance.missileLife,
	missileFuse: [32, 40, 48],
	breakChance: [0.15, 0.4, 0.6],
	breakSeconds: [1.4, 1.6, 1.8],
	breakTurn: [3.5, 4.5, 5.5],
};
/** Missions 1-4 (the rim's first sorties): the slowest gate, a small divisor, one threat at a time and no lock breaks. */
export const GENTLE = CombatBalance.gentle;
export const RAIDER_HEALTH = CombatBalance.raiderHealth;
export const COURIER_HEALTH = 160;
/** Faster than cruise (255) but slower than full throttle (320): a chase you win by committing to it. */
export const COURIER_SPEED = 275;
export const ACE_DAMAGE_BONUS = CombatEnvelope.aceDamageBonus;
/** Required waves arrive this far out (an approach before the lock); reinforcements from behind come a little closer. */
export const SPAWN_FRONT: [number, number] = [2600, 3200];
export const SPAWN_BEHIND: [number, number] = [2000, 2400];
/** A retired raider flies for the boundary this long before it is removed. */
export const WITHDRAW_SECONDS = 4;
/** Ground-avoidance look-ahead for enemy jets, and how often each jet casts it. */
export const AVOID_RANGE = 200;
export const AVOID_EVERY = 3;
/** The evade barrel roll (cosmetic, and no new windups start during it); the client predicts the same roll. */
export const EVADE_ROLL = FlightPrediction.EvadeRollSeconds;

// Which difficulty knob scales each act-indexed TUNING table; tables absent here are not scaled.
export const TUNING_KNOBS = new Map<number[], DifficultyKnob>([
	[TUNING.hostileDamage, "hostileDamage"],
	[TUNING.windup, "windup"],
	[TUNING.flightGate, "hostileGate"],
	[TUNING.banditReload, "hostileGate"],
	[TUNING.aceReload, "aceGate"],
	[TUNING.flightDivisor, "flightDivisor"],
	[TUNING.threatCap, "threatCap"],
	[TUNING.missileTurn, "missileTurn"],
	[TUNING.aceMissileTurn, "missileTurn"],
	[TUNING.missileFuse, "missileTurn"],
	[TUNING.breakChance, "breakChance"],
	[TUNING.lockBreakChance, "breakChance"],
]);
/** The act's value from a TUNING table, scaled for the session's difficulty. */
export function tuned(session: CombatSession, values: number[]): number {
	const value = values[sessionAct(session) - 1];
	const knob = TUNING_KNOBS.get(values);
	return knob === undefined ? value : Difficulty.Scale(session.difficulty, knob, value);
}
/** Missions 1-4 fire on the gentle gate. */
export function gentle(session: CombatSession): boolean {
	return session.missionId <= GENTLE.lastMission;
}
