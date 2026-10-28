import { describe, expect, it } from "@rbxts/jest-globals";
import { VoiceCue } from "../shared/VoiceCues";
import { VOICE_TAIL, VoiceLibrary, cinematicBeatSeconds, duckGain, storyLineId } from "../shared/VoiceLines";
const FAKE: Record<string, VoiceCue> = {
	"story.c03.b01": { bank: "bankA", start: 10, finish: 14.5, speaker: "SERA", tape: false, radio: false, text: "Story line." },
	"radio.m02.p1.beat": { bank: "bankA", start: 20, finish: 22, speaker: "SERA", tape: false, radio: true, text: "SERA: Radio line." },
	"radio.m03.p1.beat": { bank: "bankB", start: 1, finish: 3, speaker: "TEAL", tape: true, radio: true, text: "TEAL (tape): Tape line." },
};

describe("voice-over cue lookup", () => {
	it("derives stable story ids from chapter and beat", () => {
		expect(storyLineId(0, 0)).toBe("story.c00.b00");
		expect(storyLineId(27, 6)).toBe("story.c27.b06");
	});
	it("returns a clip only when the bank is uploaded and the text matches exactly", () => {
		const library = new VoiceLibrary(FAKE, { bankA: "rbxassetid://1", bankB: "" });
		const clip = library.Story(3, 1, "Story line.");
		expect(clip?.assetId).toBe("rbxassetid://1");
		expect(clip?.start).toBe(10);
		expect(clip?.seconds).toBe(4.5);
		// Edited text without a regenerated recording stays silent rather than playing the old words.
		expect(library.Story(3, 1, "Story line, edited.")).toBeUndefined();
		// Bank not uploaded yet: silent no-op.
		expect(library.Radio("TEAL (tape): Tape line.")).toBeUndefined();
		expect(library.Story(9, 9, "Story line.")).toBeUndefined();
	});
	it("matches radio lines by their exact catalog text, never fuzzily", () => {
		const library = new VoiceLibrary(FAKE, { bankA: "rbxassetid://1", bankB: "rbxassetid://2" });
		expect(library.RadioId("SERA: Radio line.")).toBe("radio.m02.p1.beat");
		expect(library.Radio("TEAL (tape): Tape line.")?.tape).toBe(true);
		expect(library.RadioId("SERA: Radio line")).toBeUndefined();
		expect(library.RadioId("Radio line.")).toBeUndefined();
		// Story cues are never radio matches.
		expect(library.RadioId("Story line.")).toBeUndefined();
	});
});

describe("voice timing and ducking", () => {
	it("stretches a cutscene beat to the voice plus a tail, never shortens it", () => {
		expect(cinematicBeatSeconds(5)).toBe(5);
		expect(cinematicBeatSeconds(5, 3)).toBe(5);
		expect(cinematicBeatSeconds(5, 7.2)).toBeCloseTo(7.2 + VOICE_TAIL, 5);
		expect(VOICE_TAIL).toBe(0.4);
	});
	it("ducks effects by 6 dB only while someone speaks", () => {
		expect(duckGain(false)).toBe(1);
		expect(duckGain(true)).toBeCloseTo(0.501, 3);
	});
});
