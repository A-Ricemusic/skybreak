import { describe, expect, it } from "@rbxts/jest-globals";
import { ac04FailureText } from "../shared/AC04Presentation";
describe("AC04 debrief explanations",()=>{
	it("explains native collisions and provides relevant recovery advice",()=>{
		expect(ac04FailureText("crash_terrain")).toContain("terrain collision");
		expect(ac04FailureText("crash_water")).toContain("above the sea");
		expect(ac04FailureText("timeout")).toContain("phase clock");
	});
	it("does not expose unknown or absent internal tokens",()=>{
		expect(ac04FailureText("private_future_failure")).toBe(ac04FailureText());
		expect(ac04FailureText("invalid_campaign_result")).toContain("flight record");
	});
});
