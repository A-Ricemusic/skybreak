// Pure HUD wording for the nearest hostile missile (MissileRules on the server sends the numbers).
// It rewrites the "MISSILE INBOUND" part of the shared warning line in the existing warning slot,
// so every input mode gets the same cue and flight advice keeps its place after it.
//
//   wide:   "MISSILE 7 O'CLOCK ↓ 2.1s · LOW SPEED"   ->  "BREAK ← · MISSILE 1.4s · POWER↑"
//   narrow: "MISSILE ↓ 2.1s"                          ->  "BREAK ←"
//
// The arrow next to MISSILE points to where the missile is (↑ ahead, → right wing, ↓ tail, ← left
// wing). The BREAK arrow is the way to turn: away from the missile's side, which puts it on the tail
// where the seeker loses a hard-turning jet.

export interface MissileCueInput {
	/** Seconds until the nearest locked missile arrives; undefined when it is not closing. */
	seconds?: number;
	/** Where it is from the nose, degrees: 0 ahead, +90 right wing, -90 left wing, +/-180 tail. */
	bearing?: number;
	/** Server: the nearest missile is inside the level's ideal break window. */
	breakNow?: boolean;
	/** Airspeed; under POWER_SPEED a break turn lacks the energy to win, so the cue asks for power. */
	speed?: number;
}

const COMBAT_TEXT = "MISSILE INBOUND";
/** Below this airspeed the BREAK cue adds POWER↑ (cruise is ~255, full throttle 320). */
const POWER_SPEED = 285;

function finite(value: number | undefined): value is number {
	return value !== undefined && value === value && math.abs(value) !== math.huge;
}
/** Bearing wrapped into -180..180. */
function wrap(bearing: number): number {
	return ((bearing + 180) % 360 + 360) % 360 - 180;
}

export const MissileCue = {
	PowerSpeed: POWER_SPEED,
	/** Arrow toward the missile: ↑ ahead, → right, ↓ behind, ← left (45-degree sectors either side). */
	Arrow(bearing: number): string {
		const b = wrap(bearing);
		if (math.abs(b) <= 45) return "↑";
		if (math.abs(b) >= 135) return "↓";
		return b > 0 ? "→" : "←";
	},
	/** Clock position (12 ahead, 3 right, 6 tail, 9 left). */
	Clock(bearing: number): number {
		const hour = math.floor(((wrap(bearing) + 360) % 360) / 30 + 0.5) % 12;
		return hour === 0 ? 12 : hour;
	},
	/** The way to break: away from the missile's side (a missile dead ahead or astern: left). */
	BreakArrow(bearing: number): string {
		return wrap(bearing) > 0 ? "←" : wrap(bearing) < 0 ? "→" : "←";
	},
	/** The missile part of the warning line, or undefined with nothing to say beyond MISSILE INBOUND. */
	Text(input: MissileCueInput, narrow = false): string | undefined {
		if (!finite(input.bearing)) return undefined;
		const seconds = finite(input.seconds) ? string.format("%.1fs", math.max(0, input.seconds)) : undefined;
		if (input.breakNow === true) {
			if (narrow) return `BREAK ${MissileCue.BreakArrow(input.bearing)}`;
			const power = finite(input.speed) && input.speed < POWER_SPEED ? " · POWER↑" : "";
			return `BREAK ${MissileCue.BreakArrow(input.bearing)} · MISSILE${seconds ? ` ${seconds}` : ""}${power}`;
		}
		const arrow = MissileCue.Arrow(input.bearing);
		if (narrow) return `MISSILE ${arrow}${seconds ? ` ${seconds}` : ""}`;
		return `MISSILE ${MissileCue.Clock(input.bearing)} O'CLOCK ${arrow}${seconds ? ` ${seconds}` : ""}`;
	},
	/** `warning` (the shared flight/combat line) with MISSILE INBOUND replaced by the cue when there is one. */
	Apply(warning: string, input: MissileCueInput, narrow = false): string {
		const cue = MissileCue.Text(input, narrow);
		if (cue === undefined) return warning;
		const [start, finish] = string.find(warning, COMBAT_TEXT, 1, true);
		if (start === undefined || finish === undefined) return warning;
		return `${string.sub(warning, 1, start - 1)}${cue}${string.sub(warning, finish + 1)}`;
	},
};
