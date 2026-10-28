import { VoiceLibrary } from "../VoiceLines";
import { AC04_VOICE_CUES } from "./AC04VoiceCues";
import { AC04_VOICE_BANK_ASSETS } from "./AC04VoiceBanks";
/** Independent identity; absent, changed or unapproved recordings stay silent. */
export const AC04Voice = new VoiceLibrary(AC04_VOICE_CUES, AC04_VOICE_BANK_ASSETS);
export function ac04StoryLineId(chapterId: string, beatIndex: number): string {
	return `ac04.story.${string.sub(chapterId, 6)}.b${string.format("%02d", beatIndex)}`;
}
