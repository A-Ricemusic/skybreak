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

// Sane wire bounds. Finite inputs alone can still overflow the pose maths (touchdown.y + approachDistance *
// tan(glide); distance / duration for speed), so every input is bounded so each intermediate stays finite:
// worst case 1e5 + 1e5 * tan(45 deg) studs and 1e5 / 0.05 studs/s. Authored plans sit far inside these
// (distances <= 2400 studs, durations 4-24 s, glide 3 deg), and the CinematicPayload spec enforces that.
/** Largest |coordinate| or distance accepted, in studs. */
export const PAYLOAD_WORLD_BOUND = 1e5;
/** Shortest and longest accepted cinematic duration, in seconds (divisors in the pose maths). */
export const PAYLOAD_MIN_SECONDS = 0.05;
export const PAYLOAD_MAX_SECONDS = 600;
/** Largest |glide slope| accepted, in degrees; keeps tan(glide) <= 1. */
export const PAYLOAD_MAX_GLIDE_DEGREES = 45;
/** Largest |heading| accepted, in degrees; keeps math.rad/sin/cos well conditioned. */
export const PAYLOAD_MAX_HEADING_DEGREES = 3600;

function within(value: unknown, min: number, max: number): boolean {
	return isFiniteNumber(value) && value >= min && value <= max;
}
function isCoordinate(value: unknown): boolean {
	return within(value, -PAYLOAD_WORLD_BOUND, PAYLOAD_WORLD_BOUND);
}
function isPoint(value: unknown): boolean {
	if (!typeIs(value, "table")) return false;
	const p = value as Fields;
	return isCoordinate(p.x) && isCoordinate(p.y) && isCoordinate(p.z);
}
function isDistance(value: unknown): boolean {
	return within(value, 0, PAYLOAD_WORLD_BOUND);
}
/** Divisors in the pose maths: too short, non-positive or non-finite would yield NaN/infinite poses. */
function isDuration(value: unknown): boolean {
	return within(value, PAYLOAD_MIN_SECONDS, PAYLOAD_MAX_SECONDS);
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
		within(plan.headingDegrees, -PAYLOAD_MAX_HEADING_DEGREES, PAYLOAD_MAX_HEADING_DEGREES) &&
		isDistance(plan.approachDistance) &&
		isDistance(plan.rolloutDistance) &&
		isDuration(plan.approachSeconds) &&
		isDuration(plan.rolloutSeconds) &&
		within(plan.glideDegrees, -PAYLOAD_MAX_GLIDE_DEGREES, PAYLOAD_MAX_GLIDE_DEGREES) &&
		(plan.accomplishedSeconds === undefined || within(plan.accomplishedSeconds, 0, PAYLOAD_MAX_SECONDS))
	);
}

/** RearmPlan fields rearmPose/carrierRearmPose and the overlay's rearmClock read, including the carrier variant. */
export function isRearmPlan(value: unknown): value is RearmPlan {
	if (!typeIs(value, "table")) return false;
	const plan = value as Fields;
	if (!isLandingPlan(plan.landing) || !isDuration(plan.takeoffSeconds)) return false;
	if (plan.carrier === undefined) return true;
	return typeIs(plan.carrier, "table") && isPoint((plan.carrier as Fields).catapult);
}

/** CutInPlan fields EliteCutIn reads: its timed caption list. */
export function isCutInPlan(value: unknown): value is CutInPlan {
	if (!typeIs(value, "table")) return false;
	return isArrayOf((value as Fields).captions, isTimedLine);
}
