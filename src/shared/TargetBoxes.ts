// Pure rules for the Ace Combat-style target boxes: which contacts get a box,
// how big it draws, which ones fit on screen and when the selected box blinks.
// Shared so the offline Luau runner and Roblox Jest can check them.
import type { HudLayout, Rectangle } from "./UILayout";
import { rectanglesOverlap } from "./UILayout";

/** What a box means: a mission target (TGT), an optional raider, or a selected contact the server will not let you damage now. */
export type TargetBoxTone = "required" | "optional" | "protected";

/** The replicated attributes the server writes on each enemy model (CombatService.markTarget / publishDamageable). */
export interface TargetBoxFlags {
	/** `SkybreakEnemy`: enabled and alive. */
	enemy: unknown;
	/** `SkybreakOwner`: the player whose sortie owns the model. */
	owner: unknown;
	/** `Damageable`: the server's own sessionCanDamage rule for this enemy, this phase. */
	damageable: unknown;
	/** `RequiredTarget`: counts toward the objective. */
	required: unknown;
}

/** A contact competing for one of the pooled boxes; `distance` is studs from the player. */
export interface RankedContact {
	distance: number;
}

/** Boxes drawn at most, the selected target included. */
export const TARGET_BOX_LIMIT = 12;
/** Box edge, px, at the far end of the scale (and for anything farther). */
export const TARGET_BOX_MIN = 18;
/** Box edge, px, up close. */
export const TARGET_BOX_MAX = 60;
/** The selected box never shrinks below this, so its blink and caption stay readable. */
export const TARGET_BOX_SELECTED_MIN = 30;
/** Studs at which a box is TARGET_BOX_REFERENCE_SHARE of the screen height. */
export const TARGET_BOX_REFERENCE_DISTANCE = 300;
export const TARGET_BOX_REFERENCE_SHARE = 0.13;
/** Selected-box blink, Hz (a square wave, on half the time). */
export const TARGET_BOX_BLINK_HZ = 3.5;
/** Pixels a box keeps from the screen edge. */
export const TARGET_BOX_EDGE = 4;
/** Pixels added around each touch control before a box may not overlap it. */
export const TARGET_BOX_KEEPOUT_PAD = 4;

function compareDistance(a: RankedContact, b: RankedContact): boolean {
	return a.distance < b.distance;
}

export const TargetBoxes = {
	/**
	 * The box a contact gets, or undefined for none. Valid means exactly what the server
	 * accepts: an enabled enemy of this player's sortie that its phase lets missiles damage.
	 */
	Tone(flags: TargetBoxFlags, userId: number): TargetBoxTone | undefined {
		if (flags.enemy !== true || flags.owner !== userId || flags.damageable !== true) return undefined;
		return flags.required === true ? "required" : "optional";
	},
	/** The selected target always keeps a box (TGT cycling must show what it picked); protected ones draw muted. */
	SelectedTone(flags: TargetBoxFlags, userId: number): TargetBoxTone {
		return TargetBoxes.Tone(flags, userId) ?? "protected";
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
	 * Whether a `size` box centred on (x, y) fits: inside the viewport by TARGET_BOX_EDGE and clear
	 * of every keep-out (touch controls). Callers only pass points in front of the camera.
	 */
	Fits(x: number, y: number, size: number, viewportWidth: number, viewportHeight: number, keepouts: readonly Rectangle[]): boolean {
		const half = size / 2;
		if (x - half < TARGET_BOX_EDGE || y - half < TARGET_BOX_EDGE || x + half > viewportWidth - TARGET_BOX_EDGE || y + half > viewportHeight - TARGET_BOX_EDGE) return false;
		const box: Rectangle = { x: x - half, y: y - half, width: size, height: size };
		for (const keepout of keepouts) if (rectanglesOverlap(box, keepout)) return false;
		return true;
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
