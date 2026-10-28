export interface VoiceCue { bank: string; start: number; finish: number; speaker: string; tape: boolean; radio: boolean; text: string }
export const VOICE_CUES: Record<string, VoiceCue> = {};
