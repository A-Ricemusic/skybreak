/** Player-facing number, clock, distance and radio formatting for the AC04 interface. Pure. */

/**
 * Display feet per stud. The flight HUD has always shown ALT as studs × 5, so distances use the same
 * conversion: one consistent display unit, never a claim about surveyed real-world scale.
 */
export const AC04_FEET_PER_STUD = 5;
/** Longest clock the HUD can show (99'59"). Larger or non-finite inputs clamp to it. */
const MAX_CLOCK = 99 * 60 + 59;

function finite(value: number): boolean {
	return value === value && value !== math.huge && value !== -math.huge;
}

/** Zero-padded non-negative integer: ac04Pad(52, 3) === "052". Values below zero show as zero. */
export function ac04Pad(value: number, digits: number): string {
	const whole = finite(value) ? math.max(0, math.floor(value)) : 0;
	const text = tostring(whole);
	return text.size() >= digits ? text : string.rep("0", digits - text.size()) + text;
}

/** 12345 -> "12,345". Non-finite input shows as "0". */
export function ac04Thousands(value: number): string {
	if (!finite(value)) return "0";
	let text = tostring(math.floor(math.abs(value)));
	let grouped = "";
	while (text.size() > 3) {
		grouped = "," + text.sub(-3) + grouped;
		text = text.sub(1, -4);
	}
	return (value <= -1 ? "-" : "") + text + grouped;
}

/** Instrument clock: 05'07"25 with centiseconds, 05'07" without. */
export function ac04Clock(seconds: number, centiseconds = true): string {
	const clamped = finite(seconds) ? math.clamp(seconds, 0, MAX_CLOCK + 0.99) : seconds === math.huge ? MAX_CLOCK : 0;
	const whole = math.floor(clamped);
	const base = `${ac04Pad(math.floor(whole / 60), 2)}'${ac04Pad(whole % 60, 2)}"`;
	return centiseconds ? base + ac04Pad(math.floor((clamped - whole) * 100), 2) : base;
}

/** Short clock for briefings and records: 10:00, 1:09. */
export function ac04Minutes(seconds: number): string {
	const whole = finite(seconds) ? math.max(0, math.floor(seconds)) : 0;
	return `${math.floor(whole / 60)}:${ac04Pad(whole % 60, 2)}`;
}

/** Studs to display feet, rounded to 10 ft, grouped: "12,340". */
export function ac04Distance(studs: number): string {
	if (!finite(studs)) return "----";
	return ac04Thousands(math.floor((math.max(0, studs) * AC04_FEET_PER_STUD) / 10 + 0.5) * 10);
}

export interface AC04RadioText {
	/** Callsign before the colon, when the line names one ("SkyEye"). */
	speaker?: string;
	line: string;
}

/** Splits "SkyEye: Bandits inbound." into speaker and text. Unattributed lines keep their full text. */
export function ac04SplitRadio(text: string): AC04RadioText {
	const [speaker, line] = string.match(text, "^(%a[%w%s%.%-']-):%s+(.+)$");
	if (typeIs(speaker, "string") && typeIs(line, "string") && speaker.size() <= 24) return { speaker: string.upper(speaker), line };
	return { line: text };
}
