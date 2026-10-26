// Pure ace stage rules shared by the server (authoritative) and tests.
//
// An ace fights in three stages split at 2/3 and 1/3 of its health. A hit is capped at the
// next stage line so no stage is skipped. Crossing a line makes the ace invulnerable for 3 s,
// resets the player's lock on it, and (when it has wingmen to call) sends it into a retreat:
// it runs until it is more than 1800 studs out (or 10 s pass), calls its raiders, holds off
// while they fight (until they are down, or 25 s), then turns back in for the next stage.
// That sequence is never cut short: a pursuer may keep hitting the ace while it runs or holds,
// but the hit stops above the next stage line (and short of a kill in the last stage) until
// it has called its wing and turned back in.
export type AceMode = "fight" | "retreat" | "hold";
export type AceEvent = "called" | "returned";
export interface AceStageState {
	stage: number;
	mode: AceMode;
	/** Seconds spent in the current mode. */
	modeTime: number;
	invulnerableUntil: number;
}
const STAGE_INVULNERABLE = 3;
const RETREAT_RANGE = 1800;
const RETREAT_MAX_SECONDS = 10;
const HOLD_MIN_SECONDS = 4;
const HOLD_MAX_SECONDS = 25;

export const AceRules = {
	StageInvulnerable: STAGE_INVULNERABLE,
	RetreatRange: RETREAT_RANGE,
	RetreatMaxSeconds: RETREAT_MAX_SECONDS,
	HoldMinSeconds: HOLD_MIN_SECONDS,
	HoldMaxSeconds: HOLD_MAX_SECONDS,
	New(): AceStageState { return { stage: 0, mode: "fight", modeTime: 0, invulnerableUntil: 0 }; },
	/** Health at which the current stage ends, or -1 in the last stage. */
	StageLine(maxHealth: number, stage: number): number {
		if (stage === 0) return maxHealth * (2 / 3);
		if (stage === 1) return maxHealth / 3;
		return -1;
	},
	/** A hit stops at the next stage line so every stage (radio call, retreat, raiders) plays. */
	CapDamage(health: number, maxHealth: number, stage: number, damage: number): number {
		const line = AceRules.StageLine(maxHealth, stage);
		return line >= 0 && health > line ? math.min(damage, health - line) : damage;
	},
	/**
	 * The hit an ace actually takes. Fighting, it stops at the next stage line (CapDamage). Retreating
	 * or holding, it leaves the ace above that line, or alive in the last stage, so the call and the
	 * return of the stage in progress always happen before the next stage (or the kill) can.
	 */
	CapHit(state: AceStageState, health: number, maxHealth: number, damage: number): number {
		if (state.mode === "fight") return AceRules.CapDamage(health, maxHealth, state.stage, damage);
		const floor = math.max(AceRules.StageLine(maxHealth, state.stage), 0);
		return math.max(0, math.min(damage, health - floor - 1));
	},
	/**
	 * Did a hit from `before` to `after` health cross the current stage line? Advances the stage when it
	 * did. Only a fighting ace crosses: a retreat or hold in progress is never overwritten.
	 */
	Cross(state: AceStageState, maxHealth: number, before: number, after: number, now: number, retreats: boolean): boolean {
		if (state.mode !== "fight") return false;
		const line = AceRules.StageLine(maxHealth, state.stage);
		if (line < 0 || !(before > line && after <= line)) return false;
		state.stage += 1;
		state.invulnerableUntil = now + STAGE_INVULNERABLE;
		state.mode = retreats ? "retreat" : "fight";
		state.modeTime = 0;
		return true;
	},
	/** Advances the retreat: "called" when the ace is far enough to call its wing, "returned" when it turns back in. */
	Step(state: AceStageState, dt: number, separation: number, raidersAlive: number): AceEvent | undefined {
		state.modeTime += math.max(0, dt);
		if (state.mode === "retreat" && (separation > RETREAT_RANGE || state.modeTime >= RETREAT_MAX_SECONDS)) {
			state.mode = "hold"; state.modeTime = 0;
			return "called";
		}
		if (state.mode === "hold" && ((raidersAlive <= 0 && state.modeTime >= HOLD_MIN_SECONDS) || state.modeTime >= HOLD_MAX_SECONDS)) {
			state.mode = "fight"; state.modeTime = 0;
			return "returned";
		}
		return undefined;
	},
	/** Only a fighting ace launches missiles or notches locks; a retreating or holding one is running. */
	Fights(state: AceStageState): boolean { return state.mode === "fight"; },
	Invulnerable(state: AceStageState, now: number): boolean { return now < state.invulnerableUntil; },
	/** Raiders an ace calls at `stage` (1 or 2) out of the phase's `total`: the larger half first. */
	RaidersForStage(total: number, stage: number): number {
		const first = math.ceil(math.max(0, total) / 2);
		return stage === 1 ? first : stage === 2 ? math.max(0, total - first) : 0;
	},
};
