/** Bounded cold-bank recovery. Pause freezes both the beat and its readiness deadline. */
export const VOICE_RETRY_SECONDS = 5;
export const VOICE_TIMEOUT_SECONDS = 12;
export function voiceLoadAction(loadingSeconds: number, retried: boolean): "wait" | "retry" | "fail" {
	if (loadingSeconds > VOICE_TIMEOUT_SECONDS) return "fail";
	if (loadingSeconds > VOICE_RETRY_SECONDS && !retried) return "retry";
	return "wait";
}
/** A pending line holds its complete subtitle/camera duration until audio can start. */
export function cinematicClockStep(dt: number, paused: boolean, loading: boolean): number {
	return paused || loading ? 0 : math.clamp(dt, 0, .1);
}
