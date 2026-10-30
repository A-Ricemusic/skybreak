// Pure rules for the Ace Combat-style target boxes: which contacts get a box,
// how big it draws, where it and its text fit on screen and when the selected box blinks.
// Shared so the offline Luau runner and Roblox Jest can check them.
import type { HudLayout, Rectangle } from "./UILayout";
import { rectanglesOverlap } from "./UILayout";

/** What a box means: a mission target (TGT), an optional raider, or a selected contact the server will not let you damage now. */
export type TargetBoxTone = "required" | "optional" | "protected";

/** The replicated attributes the server writes on each enemy model (CombatService.markTarget / publishDamageable). */
export interface TargetBoxFlags {
	friendly?: unknown;
	/** `SkybreakEnemy`: enabled and alive. */
	enemy: unknown;
	/** `SkybreakOwner`: the player whose sortie owns the model. */
	owner: unknown;
	/** `Damageable`: the server's canHurt rule: a missile would take health right now (phase, ace immunity and stage floors). */
	damageable: unknown;
	/** `RequiredTarget`: counts toward the objective. */
	required: unknown;
}

/** Lock progress at which the server calls a lock complete (the HUD's LOCKED). */
export const TARGET_LOCKED_AT = 0.99;

/**
 * The selected box's look. `locked` (steady red, tighter box) only for a completed lock on something the
 * server would damage; `caption` picks the text: LOCKED, LOCK n%, TRACK (full lock, no damage now),
 * HOLD (no damage now) or the plain range.
 */
export interface SelectedStyle {
	tone: TargetBoxTone | "locked";
	locked: boolean;
	caption: "locked" | "locking" | "track" | "hold" | "range";
}

/** A contact competing for one of the pooled boxes; `distance` is studs from the player. */
export interface RankedContact {
	distance: number;
}

/** Boxes drawn at most, the selected target included. */
export const TARGET_BOX_LIMIT = 12;
/** Box edge, px, at the far end of the scale (and for anything farther). */
export const TARGET_BOX_MIN = 14;
/** Box edge, px, up close. */
export const TARGET_BOX_MAX = 40;
/** The selected box never shrinks below this, so its blink and caption stay readable. */
export const TARGET_BOX_SELECTED_MIN = 24;
/** Studs at which a box is TARGET_BOX_REFERENCE_SHARE of the screen height. */
export const TARGET_BOX_REFERENCE_DISTANCE = 300;
export const TARGET_BOX_REFERENCE_SHARE = 0.08;
/** Selected-box blink, Hz (a square wave, on half the time). */
export const TARGET_BOX_BLINK_HZ = 3.5;
/** Pixels a box keeps from the screen edge. */
export const TARGET_BOX_EDGE = 4;
/** Pixels added around each touch control before a box may not overlap it. */
export const TARGET_BOX_KEEPOUT_PAD = 4;
/** The 1.5 px UIStroke draws outside the box frame; rounded up for the footprint. */
export const TARGET_BOX_STROKE = 2;
/** Selected-box caption ("LOCK 60%" / "LOCKED · 820m · 45%"): its label, px, and the gap from the box frame. */
export const TARGET_CAPTION_WIDTH = 128;
export const TARGET_CAPTION_HEIGHT = 13;
export const TARGET_CAPTION_GAP = 4;
/** The TGT tag on a mission target's box: label size, px, gap beside the box frame, and how far it rises above the box top. */
export const TARGET_TAG_WIDTH = 24;
export const TARGET_TAG_HEIGHT = 10;
export const TARGET_TAG_GAP = 2;
export const TARGET_TAG_RISE = 9;
export const FRIENDLY_TAG = "FRND";

/** Where the selected caption sits: under the box or over it, slid `dx` px sideways to stay on screen. */
export interface CaptionSpot {
	above: boolean;
	dx: number;
}
/** Which side of the box carries the TGT tag. */
export type TargetTagSide = "right" | "left";

// One scratch rectangle for the per-frame checks (no allocation per candidate).
const scratch: Rectangle = { x: 0, y: 0, width: 0, height: 0 };
/** Inside `bounds` and clear of every keep-out. */
function clear(x: number, y: number, width: number, height: number, bounds: Rectangle, keepouts: readonly Rectangle[]): boolean {
	if (x < bounds.x || y < bounds.y || x + width > bounds.x + bounds.width || y + height > bounds.y + bounds.height) return false;
	scratch.x = x; scratch.y = y; scratch.width = width; scratch.height = height;
	for (const keepout of keepouts) if (rectanglesOverlap(scratch, keepout)) return false;
	return true;
}
function captionTop(y: number, size: number, above: boolean): number {
	return above ? y - size / 2 - TARGET_CAPTION_GAP - TARGET_CAPTION_HEIGHT : y + size / 2 + TARGET_CAPTION_GAP;
}
function tagLeft(x: number, size: number, side: TargetTagSide): number {
	return side === "right" ? x + size / 2 + TARGET_TAG_GAP : x - size / 2 - TARGET_TAG_GAP - TARGET_TAG_WIDTH;
}

function compareDistance(a: RankedContact, b: RankedContact): boolean {
	return a.distance < b.distance;
}

/** A rendered box in viewport pixels; friendly labels are never tappable. */
export interface TapContact { x: number; y: number; size: number; boxed: boolean; friendly: boolean }

export const TargetBoxes = {
	TapHit<T extends TapContact>(contacts: readonly T[], x: number, y: number, minTouch = 44): T | undefined {
		let best: T | undefined;
		let nearest = math.huge;
		for (const contact of contacts) {
			if (!contact.boxed || contact.friendly) continue;
			const half = math.max(contact.size, minTouch) / 2;
			const dx = x - contact.x, dy = y - contact.y;
			if (math.abs(dx) > half || math.abs(dy) > half) continue;
			const distance = dx * dx + dy * dy;
			if (distance < nearest) { best = contact; nearest = distance; }
		}
		return best;
	},
	/** Friendly aircraft carry a label, but never a target box or lock bracket. */
	FriendlyTag(flags: TargetBoxFlags, userId: number): string | undefined {
		return flags.friendly === true && flags.owner === userId ? FRIENDLY_TAG : undefined;
	},
	/**
	 * The box a contact gets, or undefined for none. Valid means exactly what the server
	 * accepts: an enabled enemy of this player's sortie that its phase lets missiles damage.
	 */
	Tone(flags: TargetBoxFlags, userId: number): TargetBoxTone | undefined {
		if (flags.friendly === true || flags.enemy !== true || flags.owner !== userId || flags.damageable !== true) return undefined;
		return flags.required === true ? "required" : "optional";
	},
	/**
	 * How the selected box draws. It always keeps a box (TGT cycling must show what it picked). A contact the
	 * server will not damage now (`damageable` false: wrong phase, ace immunity, stage floor) is grey, keeps
	 * blinking and never reads LOCKED, even when the lock has completed: only a damageable lock goes steady red.
	 */
	Selected(damageable: boolean | undefined, required: boolean, lockProgress: number): SelectedStyle {
		const full = lockProgress >= TARGET_LOCKED_AT;
		if (damageable === false) return { tone: "protected", locked: false, caption: full ? "track" : "hold" };
		if (full) return { tone: "locked", locked: true, caption: "locked" };
		return { tone: required ? "required" : "optional", locked: false, caption: lockProgress > 0.01 ? "locking" : "range" };
	},
	/** The selected caption's text: lock state or hold reason, range, then remaining health when damaged. */
	CaptionText(style: SelectedStyle, lockProgress: number, distance: number, required: boolean, healthPercent: number): string {
		const range = `${math.floor(distance)}m`;
		const kind = style.caption;
		const head = kind === "locked" ? `LOCKED · ${range}` : kind === "locking" ? `LOCK ${math.floor(lockProgress * 100)}%`
			: kind === "track" ? `TRACK · ${range}` : kind === "hold" ? `HOLD · ${range}` : `${required ? "TGT · " : ""}${range}`;
		return healthPercent >= 0 ? `${head} · ${healthPercent}%` : head;
	},
	/** Box edge in px: about the jet's apparent size, clamped so far contacts stay visible and near ones never fill the view. */
	Size(distance: number, viewportHeight: number, selected = false): number {
		const raw = (viewportHeight * TARGET_BOX_REFERENCE_SHARE * TARGET_BOX_REFERENCE_DISTANCE) / math.max(1, distance);
		const size = math.floor(math.clamp(raw, TARGET_BOX_MIN, TARGET_BOX_MAX) + 0.5);
		return selected ? math.max(size, TARGET_BOX_SELECTED_MIN) : size;
	},
	/** True during the visible half of the selected box's blink. */
	BlinkOn(clock: number): boolean {
		return (clock * TARGET_BOX_BLINK_HZ) % 1 < 0.5;
	},
	/**
	 * Sorts `contacts` nearest first, in place (no allocation), and returns how many of them
	 * get a box when `reserved` boxes are already taken (the selected target).
	 */
	Rank(contacts: RankedContact[], limit = TARGET_BOX_LIMIT, reserved = 0): number {
		if (contacts.size() > 1) contacts.sort(compareDistance);
		return math.clamp(limit - reserved, 0, contacts.size());
	},
	/**
	 * The area boxes and their text may use: the viewport, cut to the HUD root's safe area when there is
	 * one (notch, Roblox top bar), less TARGET_BOX_EDGE all round.
	 */
	Bounds(viewportWidth: number, viewportHeight: number, safe?: Rectangle, edge = TARGET_BOX_EDGE): Rectangle {
		let left = 0, top = 0, right = viewportWidth, bottom = viewportHeight;
		if (safe) {
			left = math.max(left, safe.x); top = math.max(top, safe.y);
			right = math.min(right, safe.x + safe.width); bottom = math.min(bottom, safe.y + safe.height);
		}
		return { x: left + edge, y: top + edge, width: math.max(0, right - left - edge * 2), height: math.max(0, bottom - top - edge * 2) };
	},
	/** What a `size` box centred on (x, y) covers on screen, its stroke included. */
	BoxRect(x: number, y: number, size: number): Rectangle {
		const half = size / 2 + TARGET_BOX_STROKE;
		return { x: x - half, y: y - half, width: half * 2, height: half * 2 };
	},
	/**
	 * Whether a `size` box centred on (x, y), stroke included, fits inside `bounds` and clear of every
	 * keep-out (touch controls). Callers only pass points in front of the camera.
	 */
	Fits(x: number, y: number, size: number, bounds: Rectangle, keepouts: readonly Rectangle[]): boolean {
		const half = size / 2 + TARGET_BOX_STROKE;
		return clear(x - half, y - half, half * 2, half * 2, bounds, keepouts);
	},
	/** The selected caption's label on screen for a box at (x, y) and a spot from PlaceCaption. */
	CaptionRect(x: number, y: number, size: number, spot: CaptionSpot): Rectangle {
		return { x: x + spot.dx - TARGET_CAPTION_WIDTH / 2, y: captionTop(y, size, spot.above), width: TARGET_CAPTION_WIDTH, height: TARGET_CAPTION_HEIGHT };
	},
	/**
	 * Finds a spot for the selected caption that stays inside `bounds` and off every keep-out: under the box,
	 * then over it, each centred (slid in from a screen edge), then aligned to the box's left or right side.
	 * Writes it into `out` and returns true, or returns false when no spot fits (the box draws without it).
	 */
	PlaceCaption(x: number, y: number, size: number, bounds: Rectangle, keepouts: readonly Rectangle[], out: CaptionSpot): boolean {
		const width = TARGET_CAPTION_WIDTH, half = width / 2;
		if (bounds.width < width) return false;
		const minLeft = bounds.x, maxLeft = bounds.x + bounds.width - width;
		for (let pass = 0; pass < 2; pass++) {
			const above = pass === 1;
			const top = captionTop(y, size, above);
			for (let attempt = 0; attempt < 3; attempt++) {
				const wanted = attempt === 0 ? x - half : attempt === 1 ? x - size / 2 : x + size / 2 - width;
				const left = math.clamp(wanted, minLeft, maxLeft);
				if (!clear(left, top, width, TARGET_CAPTION_HEIGHT, bounds, keepouts)) continue;
				out.above = above; out.dx = left - (x - half);
				return true;
			}
		}
		return false;
	},
	/** The TGT tag's label on screen for a box at (x, y) with the tag on `side`. */
	TagRect(x: number, y: number, size: number, side: TargetTagSide): Rectangle {
		return { x: tagLeft(x, size, side), y: y - size / 2 - TARGET_TAG_RISE, width: TARGET_TAG_WIDTH, height: TARGET_TAG_HEIGHT };
	},
	/** The side whose TGT tag stays inside `bounds` and off every keep-out (right first), or undefined to drop the tag. */
	PlaceTag(x: number, y: number, size: number, bounds: Rectangle, keepouts: readonly Rectangle[]): TargetTagSide | undefined {
		const top = y - size / 2 - TARGET_TAG_RISE;
		if (clear(tagLeft(x, size, "right"), top, TARGET_TAG_WIDTH, TARGET_TAG_HEIGHT, bounds, keepouts)) return "right";
		if (clear(tagLeft(x, size, "left"), top, TARGET_TAG_WIDTH, TARGET_TAG_HEIGHT, bounds, keepouts)) return "left";
		return undefined;
	},
	/**
	 * Touch controls (sticks, action buttons, PAUSE) in viewport pixels: the HUD lays them out
	 * in virtual px, draws them through `scale` and places its root at (originX, originY).
	 */
	Keepouts(hud: HudLayout, scale: number, originX: number, originY: number, pad = TARGET_BOX_KEEPOUT_PAD): Rectangle[] {
		const result: Rectangle[] = [];
		const touch = hud.touch;
		if (!touch) return result;
		const rectangles = [touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade];
		if (hud.pause) rectangles.push(hud.pause);
		for (const rectangle of rectangles) {
			if (rectangle.width <= 0 || rectangle.height <= 0) continue;
			result.push({
				x: originX + rectangle.x * scale - pad, y: originY + rectangle.y * scale - pad,
				width: rectangle.width * scale + pad * 2, height: rectangle.height * scale + pad * 2,
			});
		}
		return result;
	},
};
