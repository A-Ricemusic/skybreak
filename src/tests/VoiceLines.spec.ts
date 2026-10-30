import { describe, expect, it } from "@rbxts/jest-globals";
import { MISSIONS, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
import { AceRules } from "../shared/AceRules";
import { Difficulty } from "../shared/Difficulty";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { STORY, speakerStyle } from "../shared/RelayStory";
import { VOICE_BANK_ASSETS } from "../shared/VoiceBanks";
import { VOICE_CUES, VOICE_PENDING, VoiceCue } from "../shared/VoiceCues";
import { VOICE_TAIL, Voice, VoiceLibrary, cinematicBeatSeconds, duckGain, storyLineId } from "../shared/VoiceLines";

function radioTexts(): string[] {
	const out: string[] = [];
	const phase = (p: MissionPhaseBlueprint) => {
		for (const c of p.landing?.radio ?? []) out.push(c.text);
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
	for (let id = 4; id <= 18; id++) for (const text of MISSION_STORY_TEXT[id].radio) out.push(text);
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
	it("records all 122 current story beats with exact text and speaker, or lists them as pending", () => {
		const assets: Record<string, string> = {};
		for (const [bank] of pairs(VOICE_BANK_ASSETS)) assets[bank as string] = "rbxassetid://1";
		const uploaded = new VoiceLibrary(VOICE_CUES, assets);
		const aliases: Record<string, string> = { MARSHAL: "RUSK", "FLIGHT LOG": "LOG", "RECORDER 7-T": "RECORDER" };
		let recorded = 0;
		for (const chapter of STORY) chapter.beats.forEach((beat, index) => {
			const id = storyLineId(chapter.id, index);
			const cue = VOICE_CUES[id] as VoiceCue | undefined;
			if (cue === undefined) {
				// A new take that is not packed yet: scripted with its exact text, silent even with every bank uploaded.
				expect(VOICE_PENDING[id]).toBe(beat.text);
				expect(uploaded.Story(chapter.id, index, beat.text)).toBeUndefined();
				recorded++;
				return;
			}
			expect(VOICE_PENDING[id]).toBeUndefined();
			expect(cue.text).toBe(beat.text);
			const name = speakerStyle(beat.speaker).name;
			expect(cue.speaker).toBe(aliases[name] ?? name);
			expect(cue.radio).toBe(false);
			expect(uploaded.Story(chapter.id, index, beat.text)?.id).toBe(id);
			expect(uploaded.Story(chapter.id, index, beat.text + " edited")).toBeUndefined();
			recorded++;
		});
		expect(recorded).toBe(122);
	});
	it("covers current catalog and planned story radio exactly, including landing instructions", () => {
		const texts = radioTexts();
		expect(texts.size()).toBe(46);
		const expected = new Set(texts);
		const pending = new Set<string>();
		for (const [id, text] of pairs(VOICE_PENDING)) if ((id as string).sub(1, 6) === "radio.") pending.add(text);
		let recorded = 0;
		for (const text of texts) {
			const id = Voice.RadioId(text);
			if (id === undefined) expect(pending.has(text)).toBe(true);
			else expect(VOICE_CUES[id].text).toBe(text);
			expect(Voice.RadioId(text + " edited")).toBeUndefined();
		}
		for (const [, cue] of pairs(VOICE_CUES)) if (cue.radio) {
			expect(expected.has(cue.text)).toBe(true);
			recorded++;
		}
		for (const text of pending) expect(expected.has(text)).toBe(true);
		expect(recorded + pending.size()).toBe(46);
		for (const text of [BlueprintRunner.LiveWarning, BlueprintRunner.PracticeReset]) expect(Voice.Radio(text)).toBeUndefined();
	});
	it("covers any current ace wing calls and excludes obsolete legacy calls", () => {
		// Current missions have standalone aces, with no staged raider calls. If a
		// staged ace is authored, every difficulty/count must acquire an exact cue.
		let calls = 0;
		for (const bp of MISSIONS) {
			if (bp.aceName === undefined) continue;
			let total = 0;
			for (const phase of bp.phases) if (phase.kind === "ace") total = phase.optionalRaiders ?? 0;
			for (const kind of Difficulty.Order) for (let stage = 1; stage <= 2; stage++) {
				const base = AceRules.RaidersForStage(total, stage);
				if (base <= 0) continue;
				const count = base + Difficulty.Behaviour(kind).extraRaiders;
				expect(Voice.RadioId(`SERA: ${bp.aceName} pulled back to call his wing. ${count} inbound.`)).toBeDefined();
				calls++;
			}
		}
		expect(calls).toBe(0);
		for (const text of ["SERA: VULTURE LEAD pulled back to call his wing. 1 inbound.",
			"SERA: AIR MARSHAL RUSK pulled back to call his wing. 3 inbound."]) expect(Voice.RadioId(text)).toBeUndefined();
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
	it("keeps Teal and recorder cues on tape, with all other speakers untreated", () => {
		let cues = 0;
		for (const [, cue] of pairs(VOICE_CUES)) {
			expect(cue.tape).toBe(cue.speaker === "TEAL" || cue.speaker === "RECORDER");
			cues++;
		}
		let pending = 0;
		for (const [id] of pairs(VOICE_PENDING)) {
			expect(VOICE_CUES[id as string]).toBeUndefined();
			pending++;
		}
		expect(cues + pending).toBe(168);
	});
	it("never plays a pending line, even with every bank uploaded", () => {
		const assets: Record<string, string> = {};
		for (const [bank] of pairs(VOICE_BANK_ASSETS)) assets[bank as string] = "rbxassetid://1";
		const uploaded = new VoiceLibrary(VOICE_CUES, assets);
		for (const [id, text] of pairs(VOICE_PENDING)) {
			expect(Voice.Clip(id as string, text)).toBeUndefined();
			expect(uploaded.Clip(id as string, text)).toBeUndefined();
			expect(uploaded.Radio(text)).toBeUndefined();
		}
	});
	it("stays silent for every line whose bank has no approved asset yet", () => {
		for (const [id, cue] of pairs(VOICE_CUES)) {
			if (VOICE_BANK_ASSETS[cue.bank] === "") {
				expect(Voice.Clip(id as string, cue.text)).toBeUndefined();
				const uploaded = new VoiceLibrary(VOICE_CUES, { [cue.bank]: "rbxassetid://1" });
				expect(uploaded.Clip(id as string, cue.text)).toBeDefined();
				expect(uploaded.Clip(id as string, cue.text + " edited")).toBeUndefined();
			}
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
