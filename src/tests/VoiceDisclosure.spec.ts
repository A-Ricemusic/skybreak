import { describe, expect, it } from "@rbxts/jest-globals";
import { VoiceDisclosureSession, VOICE_DISCLOSURE, VOICE_DISCLOSURE_DETAIL } from "../shared/VoiceDisclosure";

describe("AI voice disclosure", () => {
	it("identifies artificial voices, provider and non-human origin in the settings credit", () => {
		expect(VOICE_DISCLOSURE).toBe("Character voices are AI-generated (ElevenLabs text-to-speech); they are not real people.");
		expect(VOICE_DISCLOSURE_DETAIL).toBe("Artificially generated output is not human views or advice and may be inaccurate.");
	});
	it("shows once across cutscene/radio lines and later sorties in a session", () => {
		const session = new VoiceDisclosureSession();
		expect(session.FirstVoice(10)).toBe(22);
		expect(session.FirstVoice(11)).toBe(undefined);
		expect(session.FirstVoice(1000)).toBe(undefined);
		expect(new VoiceDisclosureSession().FirstVoice(1000)).toBe(1012);
	});
});
