/**
 * Session-wide comfort settings. The cinematic "Camera motion" toggle writes
 * `reduced`; the settings sheet writes `shake` (0–1). The flight camera reads
 * both: reduced drops shake and hit-stop camera moves, `shake` scales the shake.
 */
export const MotionPreference = { reduced: false, shake: 1 };
