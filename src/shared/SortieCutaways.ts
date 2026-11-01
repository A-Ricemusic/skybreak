import { canSkipLanding, finiteNumber, landingDuration } from "./LandingRules";
import { rearmDuration, type RearmPlan } from "./RearmRules";
import type { MissionScoringPolicy } from "./MissionPolicy";
import { SpecialWeapons, type SpecialKind } from "./SpecialWeapons";

/**
 * Engine batch C presentation, kept pure for both peers (m05 §9): the rearm's own landing 3:00 and takeoff 1:00
 * clocks, the TAKEOFF / CHANGE WEAPON menu, and a HUD-less cut-in with the mission clock held.
 */
export const REARM_LANDING_CLOCK = 180;
export const REARM_TAKEOFF_CLOCK = 60;
/** An unanswered menu takes off with the current weapon; the main clock is held throughout, so this only bounds idling. */
export const REARM_MENU_SECONDS = 30;
export type RearmStage = "landing" | "menu" | "takeoff";
/** Server-observed rearm progress; `menu` is set while the TAKEOFF / CHANGE WEAPON menu waits for an answer. */
function rearmStage(plan: RearmPlan, elapsed: number, menu: boolean): RearmStage {
	if (menu) return "menu";
	return elapsed < landingDuration(plan.landing) ? "landing" : "takeoff";
}
/** The reference's separate clocks: LANDING counts from 3:00 and freezes at touchdown; TAKEOFF counts from 1:00. */
export function rearmClock(plan: RearmPlan, elapsed: number, menu: boolean): { label: "LANDING" | "TAKEOFF"; seconds: number } {
	const stage = rearmStage(plan, elapsed, menu);
	if (stage === "landing") return { label: "LANDING", seconds: REARM_LANDING_CLOCK - math.clamp(elapsed, 0, plan.landing.approachSeconds) };
	const rolled = stage === "menu" ? 0 : math.clamp(elapsed - landingDuration(plan.landing), 0, plan.takeoffSeconds);
	return { label: "TAKEOFF", seconds: REARM_TAKEOFF_CLOCK - rolled };
}
/** True while the menu should open: the rollout is over and no answer has been given this rearm. */
export function rearmMenuDue(plan: RearmPlan, elapsed: number, answered: boolean): boolean {
	return plan.weaponMenu === true && !answered && elapsed >= landingDuration(plan.landing) && elapsed < rearmDuration(plan);
}
/** A client's TAKEOFF / CHANGE WEAPON answer: a known special kind, or undefined to keep the current one. */
export function takeoffChoice(value: unknown): SpecialKind | undefined {
	return SpecialWeapons.IsKind(value) ? value : undefined;
}
/** Tower cues whose time falls in (from, to] of rearm time; a cue at 0 goes out on the first step. */
export function rearmRadioDue(plan: RearmPlan, from: number, to: number): string[] {
	const due: string[] = [];
	for (const cue of plan.radio ?? []) if ((cue.at > from || (from <= 0 && cue.at <= 0)) && cue.at <= to) due.push(cue.text);
	return due;
}

/**
 * A HUD-less cut-in of the aircraft whose score roles are listed in `subjects`, played once per phase as soon as
 * mission time reaches `at` and they are up (or 5 s later regardless). Hostile simulation, flight and the mission
 * clock are held for `seconds`; `captions` are timed in cut-in seconds; `after` goes out on the radio once it ends.
 */
export interface CutInPlan { at: number; seconds: number; subjects: string[]; captions: { at: number; text: string }[]; after?: string[] }
export const CUT_IN_GRACE = 5;
export function cutInDue(plan: CutInPlan, elapsed: number, subjectsUp: number): boolean {
	return finiteNumber(elapsed) && elapsed >= plan.at && (subjectsUp > 0 || elapsed >= plan.at + CUT_IN_GRACE);
}
/** The same 0.75 s guard as a landing: the FIRE/skip press that was already held cannot skip it. */
export function canSkipCutIn(elapsed: number): boolean { return canSkipLanding(elapsed); }
export function cutInCaption(plan: CutInPlan, elapsed: number): string | undefined {
	let caption: string | undefined;
	for (const line of plan.captions) if (elapsed >= line.at) caption = line.text;
	return caption;
}
/** Flypast for the cut-in camera: each subject starts `lead` studs back along its heading, 350 studs higher, at 180 studs/s. */
export const CUT_IN_LIFT = 350;
export const CUT_IN_SPEED = 180;
export const CUT_IN_LEAD = 1100;
export function cutInOffset(elapsed: number): number { return CUT_IN_SPEED * math.max(0, elapsed) - CUT_IN_LEAD; }
export function validateCutIn(phases: { kind: string; cutIn?: CutInPlan; update?: { countdownSeconds?: number } }[]): void {
	for (let i = 0; i < phases.size(); i++) {
		const plan = phases[i].cutIn;
		if (!plan) continue;
		assert(i > 0 && phases[i].update !== undefined, "A cut-in belongs to a mission update phase");
		assert(finiteNumber(plan.at) && plan.at >= 0 && finiteNumber(plan.seconds) && plan.seconds > 1 && plan.seconds <= 20, "Invalid cut-in timing");
		assert(plan.subjects.size() > 0 && plan.subjects.size() <= 4, "Cut-in needs subject roles");
		for (const role of plan.subjects) assert(role.size() > 0 && role.size() <= 32, "Invalid cut-in subject role");
		assert(plan.captions.size() > 0 && plan.captions.size() <= 6, "Cut-in needs captions");
		let previous = -1;
		for (const line of plan.captions) {
			assert(finiteNumber(line.at) && line.at > previous && line.at < plan.seconds && line.text.size() > 0 && line.text.size() <= 72, "Invalid cut-in caption");
			previous = line.at;
		}
		for (const line of plan.after ?? []) assert(line.size() > 0 && line.size() <= 72, "Invalid cut-in radio");
	}
}
export function validateRearmPresentation(plan: RearmPlan): void {
	assert(plan.weaponMenu === undefined || typeIs(plan.weaponMenu, "boolean"), "Invalid rearm menu flag");
	assert(landingDuration(plan.landing) <= REARM_LANDING_CLOCK && plan.landing.approachSeconds <= REARM_LANDING_CLOCK && plan.takeoffSeconds <= REARM_TAKEOFF_CLOCK, "Rearm must fit its clocks");
	let previous = -1;
	for (const cue of plan.radio ?? []) {
		assert(finiteNumber(cue.at) && cue.at > previous && cue.at >= 0 && cue.at <= rearmDuration(plan) && cue.text.size() > 0 && cue.text.size() <= 72, "Invalid rearm radio cue");
		previous = cue.at;
	}
}

/** HUD `PTS nnnn/2000` until the goal is met, then `PTS nnnn/<rank letter>` (m05 §7). */
export function pointsLine(points: number, goal: number | undefined, scoring: MissionScoringPolicy): string {
	if (goal !== undefined && points < goal) return `PTS ${points}/${goal}`;
	if (scoring.basis !== "points") return `PTS ${points}`;
	const rank = points >= scoring.rank.S ? "S" : points >= scoring.rank.A ? "A" : points >= scoring.rank.B ? "B" : points >= scoring.rank.C ? "C" : undefined;
	return rank !== undefined ? `PTS ${points}/${rank}` : `PTS ${points}`;
}
