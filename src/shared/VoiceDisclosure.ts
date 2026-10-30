/** Shared copy for the permanent credit and first-voice notice. */
export const VOICE_DISCLOSURE = "Character voices are AI-generated (ElevenLabs text-to-speech); they are not real people.";
export const VOICE_DISCLOSURE_DETAIL = "Artificially generated output is not human views or advice and may be inaccurate.";
export const VOICE_NOTICE_ATTRIBUTE = "SkybreakVoiceNoticeUntil";
export const VOICE_NOTICE_SECONDS = 12;

/** Client-session lifetime; never reset by a sortie, respawn, or UI remount. */
export class VoiceDisclosureSession {
	private shown = false;
	FirstVoice(now: number): number | undefined {
		if (this.shown) return undefined;
		this.shown = true;
		return now + VOICE_NOTICE_SECONDS;
	}
}
