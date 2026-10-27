import { describe, expect, it } from "@rbxts/jest-globals";
import { cinematicClockStep, voiceLoadAction } from "../shared/VoiceReadiness";

describe("cold voice bank coordination", () => {
	it("keeps the whole beat available after a cold bank finally loads", () => {
		let beatTime = 0;
		for (let i = 0; i < 80; i++) beatTime += cinematicClockStep(.1, false, true);
		expect(beatTime).toBe(0);
		beatTime += cinematicClockStep(.1, false, false);
		expect(beatTime).toBe(.1);
		expect(cinematicClockStep(.1, true, false)).toBe(0);
	});
	it("retries once then releases a permanently unavailable bank to subtitle timing", () => {
		expect(voiceLoadAction(4.1, false)).toBe("wait");
		expect(voiceLoadAction(5.1, false)).toBe("retry");
		expect(voiceLoadAction(8, true)).toBe("wait");
		expect(voiceLoadAction(12.1, true)).toBe("fail");
		// Timeout/manual next stops the pending handle: the clock resumes immediately.
		expect(cinematicClockStep(.1, false, false)).toBe(.1);
	});
	it("bounds a resumed frame and never moves backwards", () => {
		expect(cinematicClockStep(2, false, false)).toBe(.1);
		expect(cinematicClockStep(-1, false, false)).toBe(0);
	});
});
