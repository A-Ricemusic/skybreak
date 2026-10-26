// Pure HUD instrument rules (hull bar, ammo line, clock lines), shared by the
// React HUD and Roblox Jest.

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
	key: "missile" | "special" | "evade";
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

/** SPEED and ALT box values: whole numbers, clamped to four digits so the box never overflows. */
export function instrumentValue(value: number): string {
	return `${math.clamp(math.floor(value), -999, 9999)}`;
}
