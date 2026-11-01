// Pure HUD instrument rules (hull bar, ammo line, clock lines), shared by the
// React HUD and Roblox Jest.
import { EvadeRules } from "./EvadeRules";
import { WeaponRules } from "./WeaponRules";

export type HudTone = "normal" | "dim" | "warn" | "danger";

/** Hull colour band: green above 60%, amber above 30%, red at or below. */
export function hullTone(health: number): HudTone {
	return health > 60 ? "normal" : health > 30 ? "warn" : "danger";
}

/** Hull bar fill, 0-1. */
export function hullFraction(health: number): number {
	return health === health ? math.clamp(health, 0, 100) / 100 : 0;
}

export interface StatusCell {
	key: "gun" | "missile" | "special" | "evade";
	text: string;
	tone: HudTone;
}

export interface WeaponStatus {
	missiles: number;
	missileCooldown: number;
	/** Short special name: FLR, UAV, 4AAM, XLAA. */
	special: string;
	specialCharges: number;
	specialCooldown: number;
	specialActive: number;
	evadeCharges: number;
}

/** Separator between the ammo-line cells. */
export const STATUS_SEPARATOR = " · ";
/** Panels too narrow for the spaced line at full size join the cells tightly: "MSL 8·FLR 3·EVD 3". */
export const STATUS_SEPARATOR_TIGHT = "·";
/** RobotoMono's advance, 1229/2048 em: every HUD glyph (the "·" too) is this wide. */
export const HUD_FONT_ADVANCE = 1229 / 2048;
/** Longest special cell: a four-letter short name (4AAM, XLAA), a space, then "ON" or a one-digit charge count. */
export const STATUS_SPECIAL_CHARS = 7;

function digits(value: number): number {
	let count = 1;
	for (let rest = math.floor(value); rest >= 10; rest = math.floor(rest / 10)) count += 1;
	return count;
}

/** Characters (not UTF-8 bytes: "·" is two) in the longest ammo line the game can show with that separator. */
export function statusMaxChars(tight: boolean): number {
	const separator = tight ? 1 : 3;
	return 4 + digits(WeaponRules.MaxMissiles) + separator + STATUS_SPECIAL_CHARS + separator + 4 + digits(EvadeRules.MaxCharges);
}

/** Width in px of `chars` RobotoMono characters at `textSize`. */
export function hudTextWidth(chars: number, textSize: number): number {
	return chars * textSize * HUD_FONT_ADVANCE;
}

/**
 * The one small line under the hull bar: "MSL 8 · FLR 3 · EVD 3". The special
 * reads "ON" while it runs (its button shows the countdown). Values only change
 * on whole numbers, so the HUD rewrites the line only when its text changes.
 */
export function statusLine(status: WeaponStatus): StatusCell[] {
	const missiles = math.max(0, math.floor(status.missiles));
	const charges = math.max(0, math.floor(status.specialCharges));
	const evades = math.max(0, math.floor(status.evadeCharges));
	return [
		{ key: "missile", text: `MSL ${missiles}`, tone: missiles <= 0 ? "danger" : status.missileCooldown > 0 ? "dim" : "normal" },
		{ key: "special", text: status.specialActive > 0 ? `${status.special} ON` : `${status.special} ${charges}`, tone: status.specialActive > 0 ? "warn" : charges <= 0 || status.specialCooldown > 0 ? "dim" : "normal" },
		{ key: "evade", text: `EVD ${evades}`, tone: evades <= 0 ? "dim" : "normal" },
	];
}

/**
 * Batch D1 ammo line: "GUN 600" leads the line when the sortie fits a gun (absent otherwise, so
 * missions without a gun keep the three-cell line), and the line fits itself to its panel when
 * the gun cell or a finite stock above the eight-missile rack makes it longer than the layout's widest line.
 */
export function armamentStatusLine(status: WeaponStatus, gunRounds?: number): { cells: StatusCell[]; fit: boolean } {
	const cells = statusLine(status);
	if (gunRounds === undefined) return { cells, fit: math.floor(status.missiles) > WeaponRules.MaxMissiles };
	const rounds = math.max(0, math.floor(gunRounds));
	return { cells: [{ key: "gun", text: `GUN ${rounds}`, tone: rounds <= 0 ? "danger" : "normal" }, ...cells], fit: true };
}

/** Minutes and seconds, never negative: "04:07". */
export function formatClock(seconds: number): string {
	const whole = math.max(0, math.floor(seconds));
	return string.format("%02d:%02d", math.floor(whole / 60), whole % 60);
}

/** Top-left block: TIME left on the clock, then the phase objective count (or required kills). */
export function clockLines(timeRemaining: number, objectiveProgress: number | undefined, objectiveTotal: number | undefined, kills: number, total: number): [string, string] {
	const progress = objectiveTotal !== undefined && objectiveTotal > 0
		? `TGT ${math.min(objectiveProgress ?? 0, objectiveTotal)}/${objectiveTotal}`
		: total > 0 ? `KILL ${math.min(kills, total)}/${total}` : `KILL ${kills}`;
	return [`TIME ${formatClock(timeRemaining)}`, progress];
}

/** Second clock row while returning (RTB) and landing (DIST to touchdown); undefined keeps the target tally. */
export function returnProgressLine(phase: string | undefined, distance?: number): string | undefined {
	if (phase === "return_line") return "RTB";
	if (phase === "landing") return `DIST ${math.clamp(math.floor((distance ?? 0) + 0.5), 0, 9999)}`;
	return undefined;
}

/** Landing skip prompt for the current input mode (SPACE / RT / tap share the FIRE control). */
export function skipPrompt(inputMode: "touch" | "gamepad" | "keyboard"): string {
	return inputMode === "touch" ? "TAP TO SKIP" : inputMode === "gamepad" ? "RT  SKIP" : "SPACE  SKIP";
}

/** SPEED and ALT box values: whole numbers, clamped to four digits so the box never overflows. */
export function instrumentValue(value: number): string {
	return `${math.clamp(math.floor(value), -999, 9999)}`;
}
