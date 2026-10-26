import { CombatBalance } from "../shared/CombatBalance";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { GuidedMissile, MissileProfile, MissileRules, MissileTarget, Point } from "../shared/MissileRules";
import { ThreatRules } from "../shared/ThreatRules";
import { FlightInput } from "../shared/Types";

// Engagement cadence for EngageSim.spec: the real FlightMath jet circling at cruise against
// bandits (and optionally the mission's ace) flying stepEnemies' pursuit, overshoot and fire
// control under CombatBalance's flight gate, divisor and cap, the launch gate
// (MissileRules.ShotClear, ChaseClear) and the fair-shot standoff (ThreatRules.KeepsRange). Test-only;
// deterministic for a seed (its own LCG, so Studio and the offline Luau VM draw the same numbers).
//
// Left out on purpose (they only make a real fight harder to shoot in): AceRules stages, lock-break
// notches, defensive breaks against player missiles, flares, terrain and ground avoidance.

const STEP = MissileRules.StepSeconds;
/** The cue pilot's reaction and pull, in steps, exactly as MissileRules.BreakCue checks them. */
const REACTION_STEPS = math.floor(MissileRules.CueReaction / STEP + 0.5);
const PULL_STEPS = math.floor(MissileRules.BreakHold / STEP + 0.5);
const CIRCLE: FlightInput = { x: -0.35, y: 0, throttle: 0.65 };
/** CombatService.TUNING by act. */
const WINDUP = [2.4, 2.0, 1.7];
const FIRE_RANGE = [[450, 1700], [400, 1900], [350, 2100]];
const AIM = [0.65, 0.55, 0.45];
const RELAX = [0.2, 0.25, 0.3];
const BANDIT_RELOAD = [10, 7.5, 5.5];
/** CombatService.HELD_SHOT_RETRY. */
const HELD_SHOT_RETRY = 1.5;

export type EngagePilot = "ignore" | "cue";
export interface EngageSetup {
	level: DifficultyKind;
	act: number;
	/** Ordinary bandits, alive for the whole run; plus the mission's ace when `ace`. */
	bandits: number;
	ace: boolean;
	/** "ignore" circles through every missile; "cue" flies each BREAK exactly as cued, the way MissileDuel's cue pilot does. */
	pilot: EngagePilot;
	seconds: number;
	seed: number;
	/** false: the launch gate alone (no standoff, windups checked on straight lines), for before/after tables. */
	keepRange?: boolean;
}
export interface ShooterTally {
	windups: number;
	launches: number;
	/** Windups that ended without a launch (ShotClear refused the shot at the end): an empty lock warning. */
	held: number;
	/** Longest run of consecutive held windups by any one shooter of this kind. */
	heldRun: number;
	hits: number;
	/**
	 * Hits by a missile whose BREAK the cue pilot followed exactly as cued, with no other missile's
	 * break followed since: the cue's promise broken. Must stay 0.
	 */
	followedHits: number;
	/** Missiles of this kind whose BREAK the cue pilot followed. */
	followed: number;
	/** Shortest time to impact at launch (MissileRules.TimeToImpact), or undefined before the first launch. */
	shortest?: number;
}
export interface EngageResult { seconds: number; bandits: ShooterTally; ace: ShooterTally }

interface Shooter {
	p: Point; d: Point; mode: "attack" | "extend"; modeTimer: number; pass: Point;
	fireTimer: number; windup: number; side: number; ace: boolean; held: number;
}
interface Shot { m: GuidedMissile; profile: MissileProfile; ace: boolean; followed: boolean }

function v(x: number, y: number, z: number): Point { return { x, y, z }; }
function add(a: Point, b: Point): Point { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a: Point, b: Point): Point { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
function mul(a: Point, s: number): Point { return v(a.x * s, a.y * s, a.z * s); }
function len(a: Point): number { return math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
function unitOr(a: Point, fallback: Point): Point { const size = len(a); return size > 0.01 ? mul(a, 1 / size) : fallback; }
function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function target(s: FlightState): MissileTarget {
	const [x, y, z] = FlightMath.Forward(s.yaw, s.pitch);
	return { position: v(s.x, s.y, s.z), velocity: v(x * s.speed, y * s.speed, z * s.speed) };
}
function tally(): ShooterTally { return { windups: 0, launches: 0, held: 0, heldRun: 0, hits: 0, followedHits: 0, followed: 0 }; }

export const EngageSim = {
	Run(setup: EngageSetup): EngageResult {
		const { level, act, pilot, seconds } = setup;
		const ai = math.clamp(act, 1, 3) - 1;
		let seed = setup.seed % 2147483647;
		if (seed <= 0) seed += 2147483646;
		const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
		const jet: FlightState = { x: 0, y: 500, z: 0, yaw: 0, pitch: 0, roll: 0, speed: FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * CIRCLE.throttle };
		const shooters: Shooter[] = [];
		const spawn = (index: number, ace: boolean) => {
			const a = random() * math.pi * 2, r = 2000 + random() * 800;
			const p = v(math.sin(a) * r, 450 + random() * 150, -math.cos(a) * r);
			shooters.push({ p, d: unitOr(sub(v(0, 500, 0), p), v(0, 0, -1)), mode: "attack", modeTimer: 0, pass: v(0, 0, -1), fireTimer: 4 + index * 1.5, windup: 0, side: index % 2 === 0 ? 1 : -1, ace, held: 0 });
		};
		for (let i = 0; i < setup.bandits; i++) spawn(i, false);
		if (setup.ace) spawn(setup.bandits, true);
		const live = setup.bandits;
		const windupSeconds = Difficulty.Scale(level, "windup", WINDUP[ai]);
		const [fireMin, fireMax] = FIRE_RANGE[ai];
		const flightGate = ThreatRules.FlightGate(
			Difficulty.Scale(level, "hostileGate", CombatBalance.flightGate[ai]), live,
			Difficulty.Scale(level, "flightDivisor", CombatBalance.flightDivisor[ai]), false);
		const cap = ThreatRules.ThreatCap(live, Difficulty.Scale(level, "threatCap", CombatBalance.threatCap[ai]));
		const banditReload = Difficulty.Scale(level, "hostileGate", BANDIT_RELOAD[ai]);
		const aceReload = Difficulty.Scale(level, "aceGate", CombatBalance.aceReload[ai]);
		const banditProfile = MissileRules.Profile(level, act, false);
		const aceProfile = MissileRules.Profile(level, act, true);
		const margin = ThreatRules.StandoffMargin(level);
		const shots: Shot[] = [];
		const result: EngageResult = { seconds, bandits: tally(), ace: tally() };
		let lastWindupAt = -100, pullUntil = -1, pullX = 0, pendingStep: number | undefined, pendingX = 0, telemetry = 0, step = -1;
		for (let t = 0; t < seconds; t += STEP) {
			step += 1;
			if (pendingStep !== undefined && step >= pendingStep) { pullUntil = step + PULL_STEPS; pullX = pendingX; pendingStep = undefined; }
			const input: FlightInput = step < pullUntil ? { x: pullX, y: 0.25, throttle: 1 } : CIRCLE;
			FlightMath.Step(jet, input, STEP);
			const tgt = target(jet);
			const fwd = unitOr(tgt.velocity, v(0, 0, -1));
			const lateral = v(-fwd.z, 0, fwd.x);
			let threats = 0;
			for (const s of shooters) if (!s.ace && s.windup > 0) threats += 1;
			for (const s of shots) if (!s.ace) threats += 1;
			let flightReady = ThreatRules.FlightReady({ sinceLastWindup: t - lastWindupAt, gate: flightGate, threats, cap });
			const playerStraight = ThreatRules.PlayerStraight(input.x, input.y);
			for (let index = 0; index < shooters.size(); index++) {
				const b = shooters[index];
				const record = b.ace ? result.ace : result.bandits;
				const profile = b.ace ? aceProfile : banditProfile;
				const separation = len(sub(tgt.position, b.p));
				b.modeTimer = math.max(0, b.modeTimer - STEP);
				if (b.mode === "extend" && b.modeTimer <= 0) b.mode = "attack";
				if (separation < 280 && b.mode !== "extend") {
					b.mode = "extend"; b.modeTimer = b.ace ? 2.2 : 3.0;
					b.pass = unitOr(add(add(b.d, mul(lateral, b.side * 0.6)), v(0, 0.3, 0)), b.d);
				}
				// The fair-shot standoff (stepEnemies): through the windup, on the jet's tail, it flies for the
				// point `range` studs back on the jet's track at matched speed.
				const range = MissileRules.Standoff(profile, jet.speed, margin);
				const holding = setup.keepRange !== false && b.mode === "attack" && b.windup > 0 && ThreatRules.KeepsRange(b.ace, b.held > 0)
					&& ThreatRules.HoldsStandoff(dot(fwd, unitOr(sub(b.p, tgt.position), fwd)), separation, range);
				let desired: Point;
				if (b.mode === "extend") desired = b.pass;
				else if (holding) desired = unitOr(sub(sub(tgt.position, mul(fwd, range)), b.p), b.d);
				else {
					const lead = math.clamp(separation / (350 + jet.speed), 0.35, 1.8);
					const weave = math.sin(t * (b.ace ? 1.7 : 0.65) + index * 1.8) * (b.ace ? 125 : 45);
					let dest = add(add(add(tgt.position, mul(tgt.velocity, lead)), mul(lateral, weave)), v(0, b.ace ? math.sin(t * 1.4) * 65 : 25, 0));
					if (separation > 1100) dest = add(dest, mul(lateral, b.side * 500));
					if (b.ace && separation > 600) dest = sub(dest, mul(fwd, 250));
					desired = unitOr(sub(dest, b.p), b.d);
				}
				let speed = math.clamp(jet.speed + (b.ace ? 48 : 24), b.ace ? 320 : 285, b.ace ? 380 : 350);
				if (!b.ace && b.mode === "extend") speed = ThreatRules.ExtendSpeed(jet.speed, 180);
				if (holding) speed = ThreatRules.StandoffSpeed(separation, range, jet.speed, speed);
				b.d = unitOr(add(b.d, mul(sub(desired, b.d), FlightMath.DampAlpha(b.ace ? 2.8 : 2.1, STEP))), b.d);
				const moved = add(b.p, mul(b.d, speed * STEP));
				b.p = v(math.clamp(moved.x, -2700, 2700), math.clamp(moved.y, 170, 1000), math.clamp(moved.z, -2700, 2700));
				b.fireTimer = math.max(0, b.fireTimer - STEP);
				const from = add(b.p, mul(b.d, MissileRules.LaunchOffset));
				const aimDot = dot(b.d, unitOr(sub(tgt.position, b.p), b.d));
				if (b.windup > 0) {
					b.windup = math.max(0, b.windup - STEP);
					if (b.windup > 0) continue;
					b.fireTimer = b.ace ? aceReload : banditReload;
					if (separation >= 2300) continue;
					if (MissileRules.ShotClear(from, mul(b.d, speed), tgt, profile)) {
						const missile = MissileRules.Launch(from, MissileRules.LaunchHeading(from, profile, tgt), profile);
						const arrives = MissileRules.TimeToImpact(missile, tgt);
						if (arrives !== undefined) record.shortest = math.min(record.shortest ?? math.huge, arrives);
						shots.push({ m: missile, profile, ace: b.ace, followed: false });
						record.launches += 1;
						b.held = 0;
					} else {
						record.held += 1;
						b.held += 1;
						record.heldRun = math.max(record.heldRun, b.held);
						b.fireTimer = HELD_SHOT_RETRY;
					}
				} else if (b.mode === "attack" && (b.ace || flightReady) && ThreatRules.MayFire({
					separation, aimDot, fireTimer: b.fireTimer, globalReady: true, evading: false, playerStraight,
					minRange: fireMin, maxRange: b.ace ? fireMax + 200 : fireMax, aimThreshold: AIM[ai], straightRelax: RELAX[ai],
				}) && (setup.keepRange === false || ThreatRules.KeepsRange(b.ace, b.held > 0)
					? MissileRules.ShotClear(from, mul(b.d, speed), tgt, profile, windupSeconds)
					: MissileRules.ChaseClear(from, speed, tgt, profile, windupSeconds))) {
					b.windup = windupSeconds;
					record.windups += 1;
					if (!b.ace) { lastWindupAt = t; threats += 1; flightReady = false; }
				}
			}
			for (let i = shots.size() - 1; i >= 0; i--) {
				const s = shots[i];
				const out = MissileRules.Step(s.m, s.profile, tgt, STEP);
				if (out.event === "flying") continue;
				if (out.event === "hit") {
					const record = s.ace ? result.ace : result.bandits;
					record.hits += 1;
					if (s.followed) record.followedHits += 1;
				}
				shots.remove(i);
			}
			// The cue pilot: telemetry at 10 Hz, BREAK on the most urgent locked missile, the stick CueReaction later.
			telemetry += STEP;
			if (telemetry < 0.1 - 1e-9) continue;
			telemetry -= 0.1;
			if (pilot !== "cue" || pendingStep !== undefined || step + 1 < pullUntil) continue;
			let urgent: Shot | undefined, urgentSeconds: number | undefined;
			for (const s of shots) {
				if (!s.m.locked || len(sub(s.m.position, tgt.position)) >= 1800) continue;
				const sec = MissileRules.TimeToImpact(s.m, tgt);
				if (sec !== undefined && (urgentSeconds === undefined || sec < urgentSeconds)) { urgent = s; urgentSeconds = sec; }
			}
			if (!urgent) continue;
			const stick = MissileRules.BreakCue(urgent.m, urgent.profile, jet, input);
			if (stick === undefined) continue;
			// The prediction's first step is the next loop step. Following this break voids any other missile's.
			pendingStep = step + 1 + REACTION_STEPS; pendingX = stick;
			if (!urgent.followed) (urgent.ace ? result.ace : result.bandits).followed += 1;
			for (const s of shots) s.followed = s === urgent;
		}
		return result;
	},
};
