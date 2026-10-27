import { BreakCueState } from "./Types";

// Pure HUD wording for the most urgent hostile missile (MissileRules on the server sends the numbers).
// The warning box keeps MISSILE INBOUND; the cue goes in the HUD's reserved break-cue row under it.
// Where that row is the warning row itself (compact roots, and the shortest ones where both are the
// objective line), the cue replaces MISSILE INBOUND in the one shared text instead, so two labels
// never draw over each other.
//
//   cue row: "MISSILE 7 O'CLOCK ↓ 2.1s"  ->  "BREAK ← · MISSILE 1.4s · POWER↑"  ->  "HOLD ← · MISSILE 1.2s"  ->  "CLEAR"
//   narrow:  "MISSILE ↓ 2.1s"             ->  "BREAK ← POWER↑"                   ->  "HOLD ←"                 ->  "CLEAR"
//   shared:  "MISSILE 7 O'CLOCK ↓ 2.1s · LOW SPEED"  (flight advice keeps its place after it)
//
// The arrow next to MISSILE points to where the missile is (↑ ahead, → right wing, ↓ tail, ← left
// wing). The BREAK arrow is the way to turn. The server picks it (MissileRules.BreakCue flies the
// break out both ways and only lights BREAK for a turn that wins); without that it falls back to
// away from the missile's side. HOLD (same row, same arrow) means keep pulling: letting go is not
// yet safe. CLEAR (green, about a second) means the missile can no longer reach the jet: let go any
// time. HOLD and CLEAR show even once the missile has lost its lock and MISSILE INBOUND has gone,
// because a blind missile's fuse is live until CLEAR.

export interface MissileCueInput {
	/** Seconds until the most urgent locked missile arrives; undefined when it is not closing. */
	seconds?: number;
	/** Where it is from the nose, degrees: 0 ahead, +90 right wing, -90 left wing, +/-180 tail. */
	bearing?: number;
	/** Server cue (MissileRules.CueTick): BREAK a hard break now wins, HOLD keep pulling, CLEAR let go. */
	breakCue?: BreakCueState;
	/** Server: the BREAK / HOLD turn is to the right (false: left). Absent: away from the missile's side. */
	breakRight?: boolean;
	/** Airspeed; under POWER_SPEED a break turn lacks the energy to win, so the cue asks for power. */
	speed?: number;
}

const COMBAT_TEXT = "MISSILE INBOUND";
/** Rows narrower than this get the short wording (matches the HUD's narrow warning). */
const NARROW_WIDTH = 200;
/** HUD text is RobotoMono: every glyph advances about 0.6 em. */
const MONO_ADVANCE = 0.6;

export interface MissileCueRows {
	/** Width of the warning row and of the break-cue row the text will be drawn in. */
	alertWidth: number;
	cueWidth: number;
	/** Text size of the break-cue row: the long wording is used only when it fits the row without truncating. */
	cueTextSize: number;
	/** The break-cue row is the warning row (same rectangle): one text source only. */
	shared: boolean;
}
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
	NarrowWidth: NARROW_WIDTH,
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
		if (input.breakCue === "clear") return "CLEAR";
		const seconds = finite(input.seconds) ? string.format("%.1fs", math.max(0, input.seconds)) : undefined;
		if (input.breakCue === "break" || input.breakCue === "hold") {
			const word = input.breakCue === "break" ? "BREAK" : "HOLD";
			const fallback = finite(input.bearing) ? MissileCue.BreakArrow(input.bearing) : undefined;
			const turn = input.breakRight === undefined ? fallback : input.breakRight ? "→" : "←";
			if (turn === undefined) return undefined;
			// The break the server checked is at full power: a slow jet is told so, even on a narrow HUD.
			const slow = finite(input.speed) && input.speed < POWER_SPEED;
			if (narrow) return `${word} ${turn}${slow ? " POWER↑" : ""}`;
			// HOLD may follow a missile that is no longer closing (blind): no countdown then.
			const missile = seconds ? ` · MISSILE ${seconds}` : input.breakCue === "break" ? " · MISSILE" : "";
			return `${word} ${turn}${missile}${slow ? " · POWER↑" : ""}`;
		}
		if (!finite(input.bearing)) return undefined;
		const arrow = MissileCue.Arrow(input.bearing);
		if (narrow) return `MISSILE ${arrow}${seconds ? ` ${seconds}` : ""}`;
		return `MISSILE ${MissileCue.Clock(input.bearing)} O'CLOCK ${arrow}${seconds ? ` ${seconds}` : ""}`;
	},
	/**
	 * `warning` (the shared flight/combat line) with MISSILE INBOUND replaced by the cue when there is
	 * one. HOLD and CLEAR also show without MISSILE INBOUND (a blind missile), ahead of any advice.
	 */
	Apply(warning: string, input: MissileCueInput, narrow = false): string {
		const cue = MissileCue.Text(input, narrow);
		if (cue === undefined) return warning;
		const [start, finish] = string.find(warning, COMBAT_TEXT, 1, true);
		if (start === undefined || finish === undefined) {
			if (!MissileCue.Releasing(input)) return warning;
			return warning === "" ? cue : `${cue} · ${warning}`;
		}
		return `${string.sub(warning, 1, start - 1)}${cue}${string.sub(warning, finish + 1)}`;
	},
	/** The cue is about letting go (HOLD or CLEAR): it shows whether or not MISSILE INBOUND does. */
	Releasing(input: MissileCueInput): boolean {
		return input.breakCue === "hold" || input.breakCue === "clear";
	},
	/**
	 * Splits `warning` (built for the warning row's width) and the cue between the warning row and the
	 * reserved break-cue row. A shared row gets one text with the cue inlined; a separate row keeps the
	 * warning as is and gets the cue, in the long wording only when that fits its own width (else the
	 * narrow one, so POWER↑ is never truncated away). The cue shows with MISSILE INBOUND, and HOLD /
	 * CLEAR without it. `clear` says the routed cue is CLEAR (the HUD draws it green).
	 */
	Route(warning: string, input: MissileCueInput, rows: MissileCueRows): { alert: string; cue?: string; clear: boolean } {
		const clear = input.breakCue === "clear";
		if (rows.shared) return { alert: MissileCue.Apply(warning, input, rows.alertWidth < NARROW_WIDTH), clear };
		if (!MissileCue.Releasing(input) && string.find(warning, COMBAT_TEXT, 1, true)[0] === undefined) return { alert: warning, clear: false };
		const wide = MissileCue.Text(input, false);
		if (wide === undefined) return { alert: warning, clear: false };
		const [glyphs] = utf8.len(wide);
		const fits = (glyphs === false ? wide.size() : glyphs) * rows.cueTextSize * MONO_ADVANCE <= rows.cueWidth;
		return { alert: warning, cue: fits ? wide : MissileCue.Text(input, true), clear };
	},
};
