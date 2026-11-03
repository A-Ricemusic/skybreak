import { describe, expect, it } from "@rbxts/jest-globals";
import { isCutInPlan, isLandingPlan, isRearmPlan } from "../shared/CinematicPayload";
import { FlightPrediction } from "../shared/FlightPrediction";
import { LaunchStage } from "../shared/LaunchStage";
import { landingPose, type LandingPlan } from "../shared/LandingRules";
import { isFiniteNumber } from "../shared/Finite";
import { MissionCatalog } from "../shared/MissionCatalog";
import type { RearmPlan } from "../shared/RearmRules";
import type { CutInPlan } from "../shared/SortieCutaways";

const landing: LandingPlan = {
	touchdown: { x: 0, y: 20, z: 0 },
	headingDegrees: 0,
	approachDistance: 2400,
	rolloutDistance: 400,
	approachSeconds: 30,
	rolloutSeconds: 10,
	glideDegrees: 3,
};
const rearm: RearmPlan = {
	zone: { x: 0, y: 145, z: 2400 },
	radius: 200,
	landing,
	takeoffSeconds: 10,
	missiles: true,
	special: true,
	health: false,
};
const cutIn: CutInPlan = { at: 4, seconds: 8, subjects: ["lead"], captions: [{ at: 0, text: "BOGEYS" }] };
const NAN = 0 / 0;
const INF = 1 / 0;

/** Authored plans exactly as RearmRuntime/LandingRuntime send them (`send({ kind, plan })`). */
function authored() {
	const rearms: RearmPlan[] = [],
		landings: LandingPlan[] = [],
		cutIns: CutInPlan[] = [];
	for (const mission of MissionCatalog.All())
		for (const phase of mission.phases) {
			if (phase.rearm) rearms.push(phase.rearm);
			if (phase.landing) landings.push(phase.landing);
			if (phase.cutIn) cutIns.push(phase.cutIn);
		}
	return { rearms, landings, cutIns };
}

describe("cinematic MissionState payload guards", () => {
	it("accepts every authored rearm, landing and cut-in plan, including the carrier rearm", () => {
		const { rearms, landings, cutIns } = authored();
		expect(rearms.size() > 0).toBe(true);
		expect(landings.size() > 0).toBe(true);
		expect(cutIns.size() > 0).toBe(true);
		expect(rearms.some((plan) => plan.carrier !== undefined)).toBe(true);
		for (const plan of rearms) {
			expect(isRearmPlan(plan)).toBe(true);
			expect(isLandingPlan(plan.landing)).toBe(true);
		}
		for (const plan of landings) expect(isLandingPlan(plan)).toBe(true);
		for (const plan of cutIns) expect(isCutInPlan(plan)).toBe(true);
	});
	it("accepts every authored mission launch state", () => {
		for (const mission of MissionCatalog.All())
			if (mission.start)
				expect(FlightPrediction.IsLaunchState(LaunchStage.Pose(MissionCatalog.Start(mission.id)))).toBe(true);
	});
	it("rejects empty tables and wrong types", () => {
		for (const value of [undefined, 5, "plan", true, {}, []]) {
			expect(isRearmPlan(value)).toBe(false);
			expect(isLandingPlan(value)).toBe(false);
			expect(isCutInPlan(value)).toBe(false);
		}
	});
	it("rejects a landing with missing, non-finite or degenerate fields", () => {
		expect(isLandingPlan(landing)).toBe(true);
		expect(isLandingPlan({ ...landing, touchdown: undefined })).toBe(false);
		expect(isLandingPlan({ ...landing, touchdown: { x: 0, z: 0 } })).toBe(false);
		expect(isLandingPlan({ ...landing, touchdown: { x: 0, y: NAN, z: 0 } })).toBe(false);
		expect(isLandingPlan({ ...landing, headingDegrees: INF })).toBe(false);
		expect(isLandingPlan({ ...landing, approachDistance: "far" })).toBe(false);
		expect(isLandingPlan({ ...landing, glideDegrees: NAN })).toBe(false);
		expect(isLandingPlan({ ...landing, approachSeconds: 0 })).toBe(false);
		expect(isLandingPlan({ ...landing, rolloutSeconds: -1 })).toBe(false);
		expect(isLandingPlan({ ...landing, accomplishedSeconds: NAN })).toBe(false);
		expect(isLandingPlan({ ...landing, accomplishedSeconds: 2 })).toBe(true);
	});
	it("rejects finite but overflowing landing and rearm inputs", () => {
		expect(isLandingPlan({ ...landing, touchdown: { x: 0, y: 1e300, z: 0 } })).toBe(false);
		expect(isLandingPlan({ ...landing, touchdown: { x: -1e300, y: 20, z: 0 } })).toBe(false);
		expect(isLandingPlan({ ...landing, approachDistance: 1e300 })).toBe(false);
		expect(isLandingPlan({ ...landing, rolloutDistance: 1e300 })).toBe(false);
		expect(isLandingPlan({ ...landing, approachSeconds: 1e-300 })).toBe(false);
		expect(isLandingPlan({ ...landing, rolloutSeconds: 1e-300 })).toBe(false);
		expect(isLandingPlan({ ...landing, approachSeconds: 1e300 })).toBe(false);
		expect(isLandingPlan({ ...landing, glideDegrees: 90 })).toBe(false);
		expect(isLandingPlan({ ...landing, headingDegrees: 1e300 })).toBe(false);
		expect(isLandingPlan({ ...landing, accomplishedSeconds: 1e300 })).toBe(false);
		expect(isRearmPlan({ ...rearm, landing: { ...landing, touchdown: { x: 0, y: 1e300, z: 0 } } })).toBe(false);
		expect(isRearmPlan({ ...rearm, landing: { ...landing, rolloutSeconds: 1e-300 } })).toBe(false);
		expect(isRearmPlan({ ...rearm, takeoffSeconds: 1e-300 })).toBe(false);
		expect(isRearmPlan({ ...rearm, carrier: { catapult: { x: 0, y: 30, z: 1e300 } } })).toBe(false);
		// Within-bound extremes still yield a finite pose throughout.
		const extreme: LandingPlan = {
			...landing,
			touchdown: { x: 1e5, y: 1e5, z: -1e5 },
			approachDistance: 1e5,
			rolloutDistance: 1e5,
			approachSeconds: 0.05,
			rolloutSeconds: 0.05,
			glideDegrees: 45,
		};
		expect(isLandingPlan(extreme)).toBe(true);
		for (const t of [0, 0.025, 0.05, 0.075, 0.1]) {
			const pose = landingPose(extreme, t);
			for (const value of [pose.x, pose.y, pose.z, pose.speed]) expect(isFiniteNumber(value)).toBe(true);
		}
	});
	it("rejects a rearm without a valid nested landing, takeoff clock or carrier catapult", () => {
		expect(isRearmPlan(rearm)).toBe(true);
		expect(isRearmPlan({ ...rearm, landing: undefined })).toBe(false);
		expect(isRearmPlan({ ...rearm, landing: {} })).toBe(false);
		expect(isRearmPlan({ ...rearm, landing: { ...landing, rolloutSeconds: NAN } })).toBe(false);
		expect(isRearmPlan({ ...rearm, takeoffSeconds: undefined })).toBe(false);
		expect(isRearmPlan({ ...rearm, takeoffSeconds: 0 })).toBe(false);
		expect(isRearmPlan({ ...rearm, carrier: 5 })).toBe(false);
		expect(isRearmPlan({ ...rearm, carrier: {} })).toBe(false);
		expect(isRearmPlan({ ...rearm, carrier: { catapult: { x: 0, y: INF, z: 0 } } })).toBe(false);
		const centre = { x: 0, y: 20, z: 0 };
		expect(
			isRearmPlan({ ...rearm, carrier: { centre, width: 80, length: 300, catapult: { x: 0, y: 30, z: 40 } } }),
		).toBe(true);
	});
	it("rejects cut-in captions that are missing, malformed or not a plain array", () => {
		expect(isCutInPlan(cutIn)).toBe(true);
		expect(isCutInPlan({ ...cutIn, captions: [] })).toBe(true);
		expect(isCutInPlan({ ...cutIn, captions: undefined })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: "BOGEYS" })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: [5] })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: [{ at: NAN, text: "X" }] })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: [{ at: 1 }] })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: [{ at: 1, text: 7 }] })).toBe(false);
		expect(isCutInPlan({ ...cutIn, captions: { first: { at: 0, text: "X" } } })).toBe(false);
	});
});
