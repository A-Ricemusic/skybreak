import { describe, expect, it } from "@rbxts/jest-globals";

import { effectiveHudScale } from "../shared/PlayerSettings";
import {
	FRIENDLY_TAG,
	TARGET_BOX_LIMIT,
	TARGET_BOX_MAX,
	TARGET_BOX_MIN,
	TARGET_BOX_SELECTED_MIN,
	TargetBoxes,
	type CaptionSpot,
	type RankedContact,
} from "../shared/TargetBoxes";
import { getHudLayout, rectanglesOverlap, type HudLayout, type Rectangle } from "../shared/UILayout";

const ME = 4242;
function flags(enemy: unknown, owner: unknown, damageable: unknown, required: unknown) {
	return { enemy, owner, damageable, required };
}

describe("target box validity", () => {
	it("boxes exactly the enemies the server would damage: required green, raiders optional", () => {
		expect(TargetBoxes.Tone(flags(true, ME, true, true), ME)).toBe("required");
		expect(TargetBoxes.Tone(flags(true, ME, true, false), ME)).toBe("optional");
	});
	it("gives no box to protected, dead, foreign or not-yet-published contacts", () => {
		// Not damageable this phase (the ace before its phase, the tutorial bandits before the radar).
		expect(TargetBoxes.Tone(flags(true, ME, false, true), ME)).toBeUndefined();
		// Killed (SkybreakEnemy cleared) or another player's sortie.
		expect(TargetBoxes.Tone(flags(false, ME, true, true), ME)).toBeUndefined();
		expect(TargetBoxes.Tone(flags(true, 7, true, true), ME)).toBeUndefined();
		// Attributes still replicating: no box until the server has said so.
		expect(TargetBoxes.Tone(flags(true, ME, undefined, true), ME)).toBeUndefined();
		expect(TargetBoxes.Tone(flags(undefined, undefined, undefined, undefined), ME)).toBeUndefined();
	});
	it("labels an owned friendly FRND without giving it a target box", () => {
		const friendly = { ...flags(false, ME, false, false), friendly: true };
		expect(TargetBoxes.FriendlyTag(friendly, ME)).toBe(FRIENDLY_TAG);
		expect(TargetBoxes.Tone(friendly, ME)).toBeUndefined();
		expect(TargetBoxes.FriendlyTag({ ...friendly, owner: 7 }, ME)).toBeUndefined();
	});
	it("still boxes the selected target when it is protected, in the muted tone", () => {
		expect(TargetBoxes.Selected(false, true, 0).tone).toBe("protected");
		expect(TargetBoxes.Selected(true, true, 0).tone).toBe("required");
		expect(TargetBoxes.Selected(true, false, 0).tone).toBe("optional");
		// Telemetry not in yet: drawn as its kind, never grey by accident.
		expect(TargetBoxes.Selected(undefined, true, 0.5).tone).toBe("required");
	});
	it("goes steady red and LOCKED only for a completed lock the server would damage", () => {
		const locked = TargetBoxes.Selected(true, true, 1);
		expect(locked.tone).toBe("locked");
		expect(locked.locked).toBe(true);
		expect(TargetBoxes.CaptionText(locked, 1, 820.4, true, -1)).toBe("LOCKED · 820m");
		expect(TargetBoxes.CaptionText(TargetBoxes.Selected(true, true, 0.6), 0.6, 820, true, 45)).toBe("LOCK 60% · 45%");
		expect(TargetBoxes.CaptionText(TargetBoxes.Selected(true, true, 0), 0, 820, true, -1)).toBe("TGT · 820m");
		expect(TargetBoxes.CaptionText(TargetBoxes.Selected(true, false, 0), 0, 820, false, -1)).toBe("820m");
	});
	it("never claims a lock on a protected selection, even with the lock full", () => {
		// The training radar during tutorial_target, an immune ace, an ace held at its stage floor: the lock still builds server-side.
		for (const progress of [0, 0.5, 0.99, 1]) {
			const style = TargetBoxes.Selected(false, true, progress);
			expect(style.tone).toBe("protected");
			expect(style.locked).toBe(false);
			const text = TargetBoxes.CaptionText(style, progress, 1000, true, 66);
			expect(string.find(text, "LOCK")[0]).toBeUndefined();
		}
		expect(TargetBoxes.CaptionText(TargetBoxes.Selected(false, true, 1), 1, 1000, true, -1)).toBe("TRACK · 1000m");
		expect(TargetBoxes.CaptionText(TargetBoxes.Selected(false, true, 0.2), 0.2, 1000, true, 66)).toBe("HOLD · 1000m · 66%");
	});
});

describe("target box size", () => {
	it("caps close contacts at 40px and preserves a compact selected marker", () => {
		expect(TargetBoxes.Size(100, 1080)).toBe(40);
		expect(TargetBoxes.Size(10000, 1080, true)).toBe(24);
	});
	it("shrinks with distance between the min and max", () => {
		const near = TargetBoxes.Size(150, 390);
		const mid = TargetBoxes.Size(400, 390);
		const far = TargetBoxes.Size(2500, 390);
		expect(near).toBe(TARGET_BOX_MAX);
		expect(mid).toBeLessThan(near);
		expect(mid).toBeGreaterThan(far);
		expect(far).toBe(TARGET_BOX_MIN);
		expect(TargetBoxes.Size(0, 390)).toBe(TARGET_BOX_MAX);
	});
	it("keeps the selected box readable when far", () => {
		expect(TargetBoxes.Size(2500, 390, true)).toBe(TARGET_BOX_SELECTED_MIN);
		expect(TargetBoxes.Size(150, 390, true)).toBe(TARGET_BOX_MAX);
	});
});

describe("target box blink", () => {
	it("is a steady square wave of about 3.5 Hz", () => {
		let changes = 0;
		let last = TargetBoxes.BlinkOn(0);
		let on = 0;
		// Two seconds: seven whole cycles.
		for (let step = 1; step <= 2000; step++) {
			const value = TargetBoxes.BlinkOn(step / 1000);
			if (value !== last) changes += 1;
			if (value) on += 1;
			last = value;
		}
		// 3.5 cycles a second: fourteen edges in two seconds, on half the time.
		expect(changes).toBe(14);
		expect(on).toBeGreaterThan(980);
		expect(on).toBeLessThan(1020);
	});
});

describe("target box ranking", () => {
	it("keeps the nearest boxes up to the cap, leaving room for the selected one", () => {
		const contacts: RankedContact[] = [];
		for (let index = 0; index < 20; index++) contacts.push({ distance: 3000 - index * 100 });
		const count = TargetBoxes.Rank(contacts, TARGET_BOX_LIMIT, 1);
		expect(count).toBe(TARGET_BOX_LIMIT - 1);
		expect(contacts[0].distance).toBe(1100);
		expect(contacts[count - 1].distance).toBe(2100);
		for (let index = 1; index < contacts.size(); index++) expect(contacts[index].distance >= contacts[index - 1].distance).toBe(true);
	});
	it("returns every contact when under the cap", () => {
		const contacts: RankedContact[] = [{ distance: 5 }, { distance: 1 }];
		expect(TargetBoxes.Rank(contacts)).toBe(2);
		expect(contacts[0].distance).toBe(1);
		expect(TargetBoxes.Rank([])).toBe(0);
	});
});

const SCREEN = (width: number, height: number) => TargetBoxes.Bounds(width, height);

describe("target box placement", () => {
	it("needs the whole box, stroke included, on screen", () => {
		expect(TargetBoxes.Fits(400, 200, 40, SCREEN(844, 390), [])).toBe(true);
		expect(TargetBoxes.Fits(10, 200, 40, SCREEN(844, 390), [])).toBe(false);
		expect(TargetBoxes.Fits(400, 380, 40, SCREEN(844, 390), [])).toBe(false);
		// 4 px edge + 2 px stroke + half the box.
		expect(TargetBoxes.Fits(26, 200, 40, SCREEN(844, 390), [])).toBe(true);
		expect(TargetBoxes.Fits(25, 200, 40, SCREEN(844, 390), [])).toBe(false);
	});
	it("keeps to the HUD root's safe area when there is one", () => {
		const bounds = TargetBoxes.Bounds(844, 390, { x: 44, y: 36, width: 756, height: 354 });
		expect(bounds.x).toBe(48);
		expect(bounds.y).toBe(40);
		expect(bounds.x + bounds.width).toBe(796);
		expect(bounds.y + bounds.height).toBe(386);
		expect(TargetBoxes.Fits(40, 200, 30, bounds, [])).toBe(false);
		expect(TargetBoxes.Fits(70, 200, 30, bounds, [])).toBe(true);
	});
	it("never draws over a touch control at any HUD scale", () => {
		for (const [width, height, scale] of [[844, 390, 1], [667, 375, 1], [568, 320, 1], [844, 390, 0.8], [1180, 820, 1.25]]) {
			const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
			const hud = getHudLayout(virtualWidth, virtualHeight, "touch", { scale });
			const keepouts = TargetBoxes.Keepouts(hud, scale, 0, 0);
			const touch = hud.touch!;
			const bounds = SCREEN(width, height);
			expect(keepouts.size()).toBe(hud.pause ? 7 : 6);
			// Centre of FIRE, in viewport px: a box there never fits.
			const fireX = (touch.missile.x + touch.missile.width / 2) * scale;
			const fireY = (touch.missile.y + touch.missile.height / 2) * scale;
			expect(TargetBoxes.Fits(fireX, fireY, TARGET_BOX_MIN, bounds, keepouts)).toBe(false);
			// The steering stick, likewise.
			const stickX = (touch.joystick.x + touch.joystick.width / 2) * scale;
			const stickY = (touch.joystick.y + touch.joystick.height / 2) * scale;
			expect(TargetBoxes.Fits(stickX, stickY, TARGET_BOX_MIN, bounds, keepouts)).toBe(false);
			// The open sky above the centre stays usable.
			expect(TargetBoxes.Fits(width / 2, height * 0.3, TARGET_BOX_MIN, bounds, keepouts)).toBe(true);
			// Every keep-out covers its control with padding.
			for (const control of [touch.missile, touch.target, touch.special, touch.evade, touch.joystick, touch.throttle]) {
				const scaled = { x: control.x * scale, y: control.y * scale, width: control.width * scale, height: control.height * scale };
				let covered = false;
				for (const keepout of keepouts) {
					if (keepout.x <= scaled.x && keepout.y <= scaled.y && keepout.x + keepout.width >= scaled.x + scaled.width && keepout.y + keepout.height >= scaled.y + scaled.height) covered = true;
				}
				expect(covered).toBe(true);
			}
		}
	});
	it("offsets keep-outs by the HUD root's origin and has none for keyboard play", () => {
		const hud = getHudLayout(800, 390, "touch");
		const shifted = TargetBoxes.Keepouts(hud, 1, 44, 0, 0);
		expect(shifted[0].x).toBe(hud.touch!.joystick.x + 44);
		expect(TargetBoxes.Keepouts(getHudLayout(1920, 854, "keyboard"), 1, 0, 0).size()).toBe(0);
	});
	it("moves the selected caption off EVADE (review case: 667x375, box 30 at 432,287)", () => {
		const hud = getHudLayout(667, 375, "touch", { scale: 1 });
		const keepouts = TargetBoxes.Keepouts(hud, 1, 0, 0);
		const bounds = SCREEN(667, 375);
		const evade = hud.touch!.evade;
		const spot: CaptionSpot = { above: false, dx: 0 };
		// The old under-the-box caption would have crossed EVADE.
		expect(rectanglesOverlap(TargetBoxes.CaptionRect(432, 287, 30, spot), evade)).toBe(true);
		if (TargetBoxes.Fits(432, 287, 30, bounds, keepouts) && TargetBoxes.PlaceCaption(432, 287, 30, bounds, keepouts, spot)) {
			expect(rectanglesOverlap(TargetBoxes.CaptionRect(432, 287, 30, spot), evade)).toBe(false);
		}
	});
	it("lifts a caption that would leave the bottom edge over the box (review case: 800x390 keyboard, box 30 at 400,371)", () => {
		const bounds = SCREEN(800, 390);
		const spot: CaptionSpot = { above: false, dx: 0 };
		expect(TargetBoxes.Fits(400, 360, 30, bounds, [])).toBe(true);
		expect(TargetBoxes.PlaceCaption(400, 360, 30, bounds, [], spot)).toBe(true);
		expect(spot.above).toBe(true);
		// Near the right edge it slides in rather than spilling off.
		expect(TargetBoxes.PlaceCaption(770, 200, 30, bounds, [], spot)).toBe(true);
		const caption = TargetBoxes.CaptionRect(770, 200, 30, spot);
		expect(caption.x + caption.width).toBeLessThanOrEqual(796);
		expect(spot.dx).toBeLessThan(0);
		// The TGT tag flips to the left at the right edge.
		expect(TargetBoxes.PlaceTag(780, 200, 18, bounds, [])).toBe("left");
		expect(TargetBoxes.PlaceTag(400, 200, 18, bounds, [])).toBe("right");
	});
});

/** The controls a player touches, in viewport px, unpadded: what no box or text may cover. */
function controlsOf(hud: HudLayout, scale: number, originX: number, originY: number): Rectangle[] {
	const touch = hud.touch!;
	const result: Rectangle[] = [];
	const list = [touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade];
	if (hud.pause) list.push(hud.pause);
	for (const r of list) result.push({ x: originX + r.x * scale, y: originY + r.y * scale, width: r.width * scale, height: r.height * scale });
	return result;
}
function inside(r: Rectangle, area: Rectangle): boolean {
	return r.x >= area.x && r.y >= area.y && r.x + r.width <= area.x + area.width && r.y + r.height <= area.y + area.height;
}
function hitsAny(r: Rectangle, controls: readonly Rectangle[]): boolean {
	for (const control of controls) if (rectanglesOverlap(r, control)) return true;
	return false;
}

describe("target box text across phone roots and HUD scales", () => {
	it("never puts a box, caption or TGT tag over a control or off screen (5 roots x HUD 0.8-1.3)", () => {
		const roots = [[667, 375], [800, 390], [706, 267], [568, 320], [320, 182]];
		const requested = [0.8, 0.9, 1, 1.1, 1.2, 1.3];
		// The smallest pooled box, locked (26), far selected (30) and the nearest box.
		const sizes = [TARGET_BOX_MIN, 26, TARGET_BOX_SELECTED_MIN, TARGET_BOX_MAX];
		const spot: CaptionSpot = { above: false, dx: 0 };
		let cases = 0, boxes = 0, captions = 0, lifted = 0, slid = 0, tags = 0, leftTags = 0, failures = 0;
		let firstFailure = "";
		const fail = (what: string) => { failures += 1; if (firstFailure === "") firstFailure = what; };
		for (const [width, height] of roots) {
			for (const ask of requested) {
				// A notch-free root; at 1 and 1.3 also one inset 30 px left and right (the HUD root's safe area).
				for (const inset of ask === 1 || ask === 1.3 ? [0, 30] : [0]) {
					const rootWidth = width - inset * 2;
					const scale = effectiveHudScale(ask, true, rootWidth, height);
					const hud = getHudLayout(math.floor(rootWidth / scale), math.floor(height / scale), "touch", { scale });
					const keepouts = TargetBoxes.Keepouts(hud, scale, inset, 0);
					const controls = controlsOf(hud, scale, inset, 0);
					const safe = { x: inset, y: 0, width: rootWidth, height };
					const bounds = TargetBoxes.Bounds(width, height, safe);
					const screen = { x: 0, y: 0, width, height };
					cases += 1;
					// Every 8 px across the screen, then rows and columns hugging each control just outside it.
					const xs: number[] = [], ys: number[] = [];
					for (let y = 0; y <= height; y += 8) for (let x = 0; x <= width; x += 8) { xs.push(x); ys.push(y); }
					for (const control of controls) {
						const right = control.x + control.width, bottom = control.y + control.height;
						for (let y = control.y - 50; y <= bottom + 50; y += 3) {
							for (const x of [control.x - 70, control.x - 31, control.x - 12, control.x - 3, right + 3, right + 12, right + 31, right + 70]) { xs.push(x); ys.push(y); }
						}
						for (let x = control.x - 70; x <= right + 70; x += 3) {
							for (const y of [control.y - 40, control.y - 22, control.y - 9, control.y - 3, bottom + 3, bottom + 9, bottom + 22]) { xs.push(x); ys.push(y); }
						}
					}
					for (let index = 0; index < xs.size(); index++) {
						const x = xs[index], y = ys[index];
						for (const size of sizes) {
							if (!TargetBoxes.Fits(x, y, size, bounds, keepouts)) continue;
							boxes += 1;
							const box = TargetBoxes.BoxRect(x, y, size);
							if (hitsAny(box, controls) || !inside(box, screen) || !inside(box, safe)) fail(`box ${width}x${height}@${scale} ${x},${y} ${size}`);
							if (TargetBoxes.PlaceCaption(x, y, size, bounds, keepouts, spot)) {
								captions += 1;
								if (spot.above) lifted += 1;
								if (spot.dx !== 0) slid += 1;
								const caption = TargetBoxes.CaptionRect(x, y, size, spot);
								if (hitsAny(caption, controls) || !inside(caption, screen) || !inside(caption, safe) || rectanglesOverlap(caption, box)) fail(`caption ${width}x${height}@${scale} ${x},${y} ${size}`);
							}
							const side = TargetBoxes.PlaceTag(x, y, size, bounds, keepouts);
							if (side !== undefined) {
								tags += 1;
								if (side === "left") leftTags += 1;
								const tag = TargetBoxes.TagRect(x, y, size, side);
								if (hitsAny(tag, controls) || !inside(tag, screen) || !inside(tag, safe)) fail(`tag ${width}x${height}@${scale} ${x},${y} ${size}`);
							}
						}
					}
				}
			}
		}
		expect(firstFailure).toBe("");
		expect(failures).toBe(0);
		expect(cases).toBe(40);
		// The sweep is not vacuous: boxes and text were placed, moved over the box, slid in and flipped left.
		expect(boxes).toBeGreaterThan(5000);
		expect(captions).toBeGreaterThan(2500);
		expect(lifted).toBeGreaterThan(100);
		expect(slid).toBeGreaterThan(100);
		expect(tags).toBeGreaterThan(2500);
		expect(leftTags).toBeGreaterThan(100);
	});
});

describe("touch target boxes", () => {
	function contact(x = 100, y = 100, size = 14) { return { x, y, size, boxed: true, friendly: false }; }
	it("hits a rendered contact by its boxed footprint", () => {
		const selected = contact(100, 100, 24);
		expect(TargetBoxes.TapHit([selected], 100, 100)).toBe(selected);
	});
	it("misses outside boxes and empty lists", () => {
		expect(TargetBoxes.TapHit([contact()], 123, 100)).toBeUndefined();
		expect(TargetBoxes.TapHit([], 100, 100)).toBeUndefined();
	});
	it("pads to 44 pixels, supports an override, and retains larger boxes", () => {
		const small = contact();
		expect(TargetBoxes.TapHit([small], 122, 122)).toBe(small);
		expect(TargetBoxes.TapHit([small], 122, 122, 20)).toBeUndefined();
		const large = contact(100, 100, 60);
		expect(TargetBoxes.TapHit([large], 130, 100)).toBe(large);
	});
	it("chooses the nearest centre among overlapping boxes", () => {
		const a = contact(), b = contact(110, 110);
		expect(TargetBoxes.TapHit([a, b], 108, 108)).toBe(b);
		expect(TargetBoxes.TapHit([b, a], 101, 101)).toBe(a);
	});
	it("ignores friendly and unboxed contacts even when closer", () => {
		const enemy = contact(110);
		expect(TargetBoxes.TapHit([{ ...contact(), friendly: true }, { ...contact(), boxed: false }, enemy], 100, 100)).toBe(enemy);
	});
	it("keeps the first contact for equal centre distances", () => {
		const a = contact(90), b = contact(110);
		expect(TargetBoxes.TapHit([a, b], 100, 100)).toBe(a);
	});
});
