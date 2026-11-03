// Wire-shape guards for the server's cinematic MissionState packets (pure; runs in the offline Luau VM).
// RearmStarted, LandingStarted and CutInStarted carry authored plans that the client reads every render frame
// (rearmPose, landingPose, carrierRearmPose, landingDistance, rearmClock, cutInCaption). Authoring assertions in
// LandingRules/RearmRules/SortieCutaways are not wire validators: these check, without throwing, exactly the fields
// those client paths consume, so a malformed packet is rejected before any controller state changes.
import { isFiniteNumber } from "./Finite";
import type { LandingPlan } from "./LandingRules";
import type { RearmPlan } from "./RearmRules";
import type { CutInPlan } from "./SortieCutaways";

type Fields = Record<string, unknown>;

function isPoint(value: unknown): boolean {
	if (!typeIs(value, "table")) return false;
	const p = value as Fields;
	return isFiniteNumber(p.x) && isFiniteNumber(p.y) && isFiniteNumber(p.z);
}
/** Divisors in the pose maths: zero, negative or non-finite would yield NaN/infinite poses. */
function isPositive(value: unknown): boolean {
	return isFiniteNumber(value) && value > 0;
}
/**
 * A dense 1..n array whose every entry passes `guard`. Client loops use generalized iteration, which also visits
 * non-array keys, so a table with any other key is rejected rather than trusted on its `#` length.
 */
function isArrayOf(value: unknown, guard: (entry: unknown) => boolean): boolean {
	if (!typeIs(value, "table")) return false;
	const size = (value as unknown[]).size();
	let count = 0;
	for (const [key, entry] of pairs(value as object)) {
		if (!typeIs(key, "number") || key % 1 !== 0 || key < 1 || key > size) return false;
		if (!guard(entry)) return false;
		count += 1;
	}
	return count === size;
}
function isTimedLine(value: unknown): boolean {
	if (!typeIs(value, "table")) return false;
	const line = value as Fields;
	return isFiniteNumber(line.at) && typeIs(line.text, "string");
}

/** Every LandingPlan field landingPose, landingDistance, landingAccomplishedAt and rearmClock read. */
export function isLandingPlan(value: unknown): value is LandingPlan {
	if (!typeIs(value, "table")) return false;
	const plan = value as Fields;
	return (
		isPoint(plan.touchdown) &&
		isFiniteNumber(plan.headingDegrees) &&
		isFiniteNumber(plan.approachDistance) &&
		isFiniteNumber(plan.rolloutDistance) &&
		isPositive(plan.approachSeconds) &&
		isPositive(plan.rolloutSeconds) &&
		isFiniteNumber(plan.glideDegrees) &&
		(plan.accomplishedSeconds === undefined || isFiniteNumber(plan.accomplishedSeconds))
	);
}

/** RearmPlan fields rearmPose/carrierRearmPose and the overlay's rearmClock read, including the carrier variant. */
export function isRearmPlan(value: unknown): value is RearmPlan {
	if (!typeIs(value, "table")) return false;
	const plan = value as Fields;
	if (!isLandingPlan(plan.landing) || !isPositive(plan.takeoffSeconds)) return false;
	if (plan.carrier === undefined) return true;
	return typeIs(plan.carrier, "table") && isPoint((plan.carrier as Fields).catapult);
}

/** CutInPlan fields EliteCutIn reads: its timed caption list. */
export function isCutInPlan(value: unknown): value is CutInPlan {
	if (!typeIs(value, "table")) return false;
	return isArrayOf((value as Fields).captions, isTimedLine);
}
