import { describe, expect, it } from "@rbxts/jest-globals";
import { MISSIONS, MissionCatalog, MissionPhaseBlueprint } from "./LegacyCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { STORY, speakerStyle } from "../shared/RelayStory";
import { VOICE_BANK_ASSETS } from "../shared/VoiceBanks";
import { VOICE_CUES, VoiceCue } from "../shared/VoiceCues";
import { VOICE_TAIL, Voice, VoiceLibrary, cinematicBeatSeconds, duckGain, storyLineId } from "../shared/VoiceLines";

function radioTexts(): string[] {
	const out: string[] = [];
	const phase = (p: MissionPhaseBlueprint) => {
		if (p.beat !== undefined) out.push(p.beat);
		for (const c of p.chatter ?? []) out.push(c.text);
		for (const g of p.groupCalls ?? []) out.push(g);
		if (p.hazard) out.push(p.hazard.text);
		if (p.twist) {
			out.push(p.twist.text);
			for (const q of p.twist.insert) phase(q);
		}
	};
	for (const bp of MISSIONS) {
		for (const p of bp.phases) phase(p);
		for (const s of bp.aceStages ?? []) out.push(s);
		for (const s of bp.aceReturns ?? []) out.push(s);
	}
	return out;
}

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

describe("shipped voice table", () => {
	it("reuses exact speaker/text recordings and leaves changed lines silent", () => {
		let recorded = 0, pending = 0;
		for (const chapter of STORY) chapter.beats.forEach((beat, index) => {
			const clip=Voice.Story(chapter.id,index,beat.text);
			if (beat.recordingId === undefined) { expect(clip).toBeUndefined(); pending++; }
			else { const cue=VOICE_CUES[beat.recordingId]; expect(cue.text).toBe(beat.text); expect(cue.speaker).toBe(speakerStyle(beat.speaker).name === "MARSHAL" ? "RUSK" : speakerStyle(beat.speaker).name === "FLIGHT LOG" ? "LOG" : speakerStyle(beat.speaker).name === "RECORDER 7-T" ? "RECORDER" : speakerStyle(beat.speaker).name); expect(clip).toBeDefined(); recorded++; }
		});
		expect(recorded).toBe(78);
		expect(pending).toBe(44);
	});
	it("maps catalog radio except explicitly subtitle-only M1 safety instructions", () => {
		const texts = radioTexts();
		expect(texts.size()).toBeGreaterThan(250);
		// Revised M1 safety instructions intentionally have no recording: never play the old
		// long-hold instructions over the new subtitles. Asset generation is a separate task.
		const subtitleOnly = new Set(MissionCatalog.Get(1).phases.map(phase => phase.beat!));
		expect(subtitleOnly.size()).toBe(4);
		for (const text of [BlueprintRunner.LiveWarning, BlueprintRunner.PracticeReset]) expect(Voice.Radio(text)).toBeUndefined();
		for (const text of texts) {
			if (subtitleOnly.has(text)) expect(Voice.Radio(text)).toBeUndefined();
			else expect(Voice.RadioId(text) !== undefined ? text : `UNMAPPED ${text}`).toBe(text);
		}
	});
	it("voices the server's ace wing calls for every difficulty's raider count", () => {
		expect(Voice.RadioId("SERA: VULTURE LEAD pulled back to call his wing. 1 inbound.")).toBeDefined();
		expect(Voice.RadioId("SERA: AIR MARSHAL RUSK pulled back to call his wing. 3 inbound.")).toBeDefined();
	});
	it("never voices HUD system text or the trainee on the radio", () => {
		for (const text of ["MISSION FAILED", "MISSION ACCOMPLISHED · RETURN TO BASE", "Select the radar: TGT / Tab / Y",
			"Recon drone up: all contacts marked", "VULTURE LEAD deployed flares"]) expect(Voice.RadioId(text)).toBeUndefined();
		for (const [, cue] of pairs(VOICE_CUES)) if (cue.radio) expect(cue.speaker === "TRAINEE").toBe(false);
	});
	it("keeps every cue inside a known bank, in order, without overlap, under 6.5 minutes", () => {
		const ends = new Map<string, number[][]>();
		for (const [, cue] of pairs(VOICE_CUES)) {
			expect(VOICE_BANK_ASSETS[cue.bank] !== undefined).toBe(true);
			expect(cue.finish).toBeGreaterThan(cue.start);
			expect(cue.finish).toBeLessThanOrEqual(390);
			const list = ends.get(cue.bank) ?? [];
			list.push([cue.start, cue.finish]);
			ends.set(cue.bank, list);
		}
		for (const [, list] of ends) {
			list.sort((a, b) => a[0] < b[0]);
			for (let i = 1; i < list.size(); i++) expect(list[i][0]).toBeGreaterThanOrEqual(list[i - 1][1] + 0.2);
		}
	});
	it("keeps Teal's recordings on tape and gives every speaker in a cue a known chip name", () => {
		for (const chapter of STORY) chapter.beats.forEach((beat, index) => {
			if (beat.recordingId === undefined) return;
			const cue = VOICE_CUES[beat.recordingId];
			if (speakerStyle(beat.speaker).name === "TEAL") expect(cue.tape).toBe(true);
		});
	});
	it("stays silent for every line whose bank has no approved asset yet", () => {
		for (const [id, cue] of pairs(VOICE_CUES)) {
			if (VOICE_BANK_ASSETS[cue.bank] === "") expect(Voice.Clip(id as string, cue.text)).toBeUndefined();
			else expect(Voice.Clip(id as string, cue.text)?.assetId).toBe(VOICE_BANK_ASSETS[cue.bank]);
		}
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
