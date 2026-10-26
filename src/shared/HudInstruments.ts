// Pure HUD instrument rules (weapon rows, damage tone, clock lines, the Kestrel
// outline), shared by the React HUD and Roblox Jest.

/**
 * The Kestrel's top-view outline (nose up), right half, in studs from
 * tools/build-aircraft.py: x across (span 22.8), y along (nose -13, tail +13).
 */
const KESTREL_RIGHT_HALF: [number, number][] = [
	[0, -13],
	[0.82, -11.1],
	[1.3, -9.2],
	[1.72, -6.8],
	[1.88, -3.5],
	[4.55, -2.2],
	[11.4, 2.1],
	[11.05, 3.65],
	[4.1, 3.15],
	[2.95, 4.2],
	[2.95, 7.6],
	[5.25, 9.25],
	[5.0, 10.15],
	[2.95, 9.85],
	[2.75, 11.5],
	[1.55, 11.5],
	[0.6, 12.4],
	[0, 12.4],
];
const KESTREL_HALF_SPAN = 11.4;
const KESTREL_HALF_LENGTH = 13;

/** Closed outline, clockwise from the nose, in 0-1 box units (x right, y down). */
export function kestrelOutline(): [number, number][] {
	const points: [number, number][] = [];
	const unit = ([x, y]: [number, number]): [number, number] => [(x + KESTREL_HALF_SPAN) / (KESTREL_HALF_SPAN * 2), (y + KESTREL_HALF_LENGTH) / (KESTREL_HALF_LENGTH * 2)];
	for (const point of KESTREL_RIGHT_HALF) points.push(unit(point));
	// Mirror back up the left side (skipping the centre-line points already drawn).
	for (let index = KESTREL_RIGHT_HALF.size() - 2; index >= 1; index--) {
		const [x, y] = KESTREL_RIGHT_HALF[index];
		points.push(unit([-x, y]));
	}
	return points;
}

/** One straight stroke of line art: centre, length and rotation (degrees), in pixels of the box. */
export interface LineSegment {
	x: number;
	y: number;
	length: number;
	rotation: number;
}

/** The closed outline as frame-ready strokes for a `width` x `height` box (built once per size). */
export function outlineSegments(points: [number, number][], width: number, height: number): LineSegment[] {
	const segments: LineSegment[] = [];
	for (let index = 0; index < points.size(); index++) {
		const [ax, ay] = points[index];
		const [bx, by] = points[(index + 1) % points.size()];
		const x1 = ax * width, y1 = ay * height, x2 = bx * width, y2 = by * height;
		const length = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
		if (length < 0.5) continue;
		segments.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, length, rotation: math.deg(math.atan2(y2 - y1, x2 - x1)) });
	}
	return segments;
}

export type HudTone = "normal" | "dim" | "warn" | "danger";

/** Hull colour band: green above 60%, amber above 30%, red at or below. */
export function hullTone(health: number): HudTone {
	return health > 60 ? "normal" : health > 30 ? "warn" : "danger";
}

export interface WeaponRow {
	key: "missile" | "special" | "evade" | "damage";
	label: string;
	value: string;
	/** The selected (FIRE) weapon. */
	caret: boolean;
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
	health: number;
}

/**
 * The bottom-right weapon list: MSL, the special slot (FLR when flares are
 * equipped), EVD charges and DMG. Values only change on whole numbers, so the
 * HUD rewrites a label only when its text actually changes.
 */
export function weaponRows(status: WeaponStatus): WeaponRow[] {
	const missiles = math.max(0, math.floor(status.missiles));
	const charges = math.max(0, math.floor(status.specialCharges));
	const evades = math.max(0, math.floor(status.evadeCharges));
	const hull = math.clamp(math.floor(status.health + 0.5), 0, 100);
	const specialValue = status.specialActive > 0 ? `ON ${math.ceil(status.specialActive)}` : `${charges}`;
	return [
		{ key: "missile", label: "MSL", value: `${missiles}`, caret: true, tone: missiles <= 0 ? "danger" : status.missileCooldown > 0 ? "dim" : "normal" },
		{ key: "special", label: status.special, value: specialValue, caret: false, tone: status.specialActive > 0 ? "warn" : charges <= 0 || status.specialCooldown > 0 ? "dim" : "normal" },
		{ key: "evade", label: "EVD", value: `${evades}`, caret: false, tone: evades <= 0 ? "dim" : "normal" },
		{ key: "damage", label: "DMG", value: `${100 - hull}%`, caret: false, tone: hullTone(hull) },
	];
}

/** Ready missile rails beside the silhouette: left with one missile in hand, right with two, both dark while the launcher cycles. */
export function railsReady(missiles: number, missileCooldown: number): [boolean, boolean] {
	const ready = missileCooldown <= 0;
	return [ready && missiles >= 1, ready && missiles >= 2];
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
