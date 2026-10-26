import { describe, expect, it } from "@rbxts/jest-globals";

import { effectiveHudScale } from "../shared/PlayerSettings";
import {
	ACTION_BUTTON_SIZE,
	COMPACT_MAX_HEIGHT,
	getHudLayout,
	hudObstacles,
	JOYSTICK_SIZE,
	MIN_TOUCH_TARGET,
	OBJECTIVE_MIN_WIDTH,
	rectangleInside,
	rectanglesOverlap,
	type HudLayout,
	type Rectangle,
} from "../shared/UILayout";

// The slimmed touch layout (owner feedback on PR #44, docs/design/hud-feedback-phone-2.jpg):
// TGT, FIRE, SPECIAL and EVADE the same size on one baseline, sticks ~17% smaller.
// Recorded from getHudLayout for every virtual root the settings reach from the roots
// below. Key: "<virtual root>@<stick px>". Per entry: joystick, throttle, FIRE, TGT,
// SPECIAL, EVADE as x,y,width,height. The HUD instruments adapt to these; the controls
// never move or shrink for them. Change this table only when the touch layout is meant to change.
const TOUCH: { [key: string]: number[] } = {
	"667x375@68": [14,281,68,68, 585,281,68,68, 273,307,54,54, 207,307,54,54, 339,307,54,54, 405,307,54,54],
	"667x375@80": [14,269,80,80, 573,269,80,80, 273,307,54,54, 207,307,54,54, 339,307,54,54, 405,307,54,54],
	"667x375@92": [14,257,92,92, 561,257,92,92, 273,307,54,54, 207,307,54,54, 339,307,54,54, 405,307,54,54],
	"667x375@104": [14,245,104,104, 549,245,104,104, 273,307,54,54, 207,307,54,54, 339,307,54,54, 405,307,54,54],
	"606x340@68": [14,246,68,68, 524,246,68,68, 243,272,54,54, 177,272,54,54, 309,272,54,54, 375,272,54,54],
	"606x340@80": [14,234,80,80, 512,234,80,80, 243,272,54,54, 177,272,54,54, 309,272,54,54, 375,272,54,54],
	"606x340@92": [14,222,92,92, 500,222,92,92, 243,272,54,54, 177,272,54,54, 309,272,54,54, 375,272,54,54],
	"606x340@104": [14,210,104,104, 488,210,104,104, 243,272,54,54, 177,272,54,54, 309,272,54,54, 375,272,54,54],
	"555x312@68": [14,218,68,68, 473,218,68,68, 217,244,54,54, 151,244,54,54, 283,244,54,54, 349,244,54,54],
	"555x312@80": [14,206,80,80, 461,206,80,80, 217,244,54,54, 151,244,54,54, 283,244,54,54, 349,244,54,54],
	"555x312@92": [14,194,92,92, 449,194,92,92, 217,244,54,54, 151,244,54,54, 283,244,54,54, 349,244,54,54],
	"555x312@104": [14,182,104,104, 437,182,104,104, 217,244,54,54, 151,244,54,54, 283,244,54,54, 349,244,54,54],
	"513x288@68": [10,198,68,68, 435,198,68,68, 196,224,54,54, 130,224,54,54, 262,224,54,54, 328,224,54,54],
	"513x288@80": [10,186,80,80, 423,186,80,80, 196,224,54,54, 130,224,54,54, 262,224,54,54, 328,224,54,54],
	"513x288@92": [10,174,92,92, 411,174,92,92, 196,224,54,54, 130,224,54,54, 262,224,54,54, 328,224,54,54],
	"513x288@104": [10,162,104,104, 399,162,104,104, 196,224,54,54, 130,224,54,54, 262,224,54,54, 328,224,54,54],
	"800x390@68": [14,296,68,68, 718,296,68,68, 340,322,54,54, 274,322,54,54, 406,322,54,54, 472,322,54,54],
	"800x390@80": [14,284,80,80, 706,284,80,80, 340,322,54,54, 274,322,54,54, 406,322,54,54, 472,322,54,54],
	"800x390@92": [14,272,92,92, 694,272,92,92, 340,322,54,54, 274,322,54,54, 406,322,54,54, 472,322,54,54],
	"800x390@104": [14,260,104,104, 682,260,104,104, 340,322,54,54, 274,322,54,54, 406,322,54,54, 472,322,54,54],
	"727x354@68": [14,260,68,68, 645,260,68,68, 303,286,54,54, 237,286,54,54, 369,286,54,54, 435,286,54,54],
	"727x354@80": [14,248,80,80, 633,248,80,80, 303,286,54,54, 237,286,54,54, 369,286,54,54, 435,286,54,54],
	"727x354@92": [14,236,92,92, 621,236,92,92, 303,286,54,54, 237,286,54,54, 369,286,54,54, 435,286,54,54],
	"727x354@104": [14,224,104,104, 609,224,104,104, 303,286,54,54, 237,286,54,54, 369,286,54,54, 435,286,54,54],
	"666x325@68": [14,231,68,68, 584,231,68,68, 273,257,54,54, 207,257,54,54, 339,257,54,54, 405,257,54,54],
	"666x325@80": [14,219,80,80, 572,219,80,80, 273,257,54,54, 207,257,54,54, 339,257,54,54, 405,257,54,54],
	"666x325@92": [14,207,92,92, 560,207,92,92, 273,257,54,54, 207,257,54,54, 339,257,54,54, 405,257,54,54],
	"666x325@104": [14,195,104,104, 548,195,104,104, 273,257,54,54, 207,257,54,54, 339,257,54,54, 405,257,54,54],
	"615x300@68": [14,206,68,68, 533,206,68,68, 247,232,54,54, 181,232,54,54, 313,232,54,54, 379,232,54,54],
	"615x300@80": [14,194,80,80, 521,194,80,80, 247,232,54,54, 181,232,54,54, 313,232,54,54, 379,232,54,54],
	"615x300@92": [14,182,92,92, 509,182,92,92, 247,232,54,54, 181,232,54,54, 313,232,54,54, 379,232,54,54],
	"615x300@104": [14,170,104,104, 497,170,104,104, 247,232,54,54, 181,232,54,54, 313,232,54,54, 379,232,54,54],
	"706x267@68": [10,177,68,68, 628,177,68,68, 293,203,54,54, 227,203,54,54, 359,203,54,54, 425,203,54,54],
	"706x267@80": [10,165,80,80, 616,165,80,80, 293,203,54,54, 227,203,54,54, 359,203,54,54, 425,203,54,54],
	"706x267@92": [10,153,92,92, 604,153,92,92, 293,203,54,54, 227,203,54,54, 359,203,54,54, 425,203,54,54],
	"706x267@104": [10,141,104,104, 592,141,104,104, 293,203,54,54, 227,203,54,54, 359,203,54,54, 425,203,54,54],
	"641x242@68": [10,152,68,68, 563,152,68,68, 260,178,54,54, 194,178,54,54, 326,178,54,54, 392,178,54,54],
	"641x242@80": [10,140,80,80, 551,140,80,80, 260,178,54,54, 194,178,54,54, 326,178,54,54, 392,178,54,54],
	"641x242@92": [10,128,92,92, 539,128,92,92, 260,178,54,54, 194,178,54,54, 326,178,54,54, 392,178,54,54],
	"641x242@104": [10,117,103,103, 528,117,103,103, 260,178,54,54, 194,178,54,54, 326,178,54,54, 392,178,54,54],
	"588x222@68": [6,148,68,68, 514,148,68,68, 237,162,54,54, 177,162,54,54, 297,162,54,54, 357,162,54,54],
	"588x222@80": [6,136,80,80, 502,136,80,80, 237,162,54,54, 177,162,54,54, 297,162,54,54, 357,162,54,54],
	"588x222@92": [6,124,92,92, 490,124,92,92, 237,162,54,54, 177,162,54,54, 297,162,54,54, 357,162,54,54],
	"588x222@104": [6,112,104,104, 478,112,104,104, 237,162,54,54, 177,162,54,54, 297,162,54,54, 357,162,54,54],
	"543x205@68": [6,131,68,68, 469,131,68,68, 214,145,54,54, 154,145,54,54, 274,145,54,54, 334,145,54,54],
	"543x205@80": [6,119,80,80, 457,119,80,80, 214,145,54,54, 154,145,54,54, 274,145,54,54, 334,145,54,54],
	"543x205@92": [6,107,92,92, 445,107,92,92, 214,145,54,54, 154,145,54,54, 274,145,54,54, 334,145,54,54],
	"543x205@104": [6,95,104,104, 433,95,104,104, 214,145,54,54, 154,145,54,54, 274,145,54,54, 334,145,54,54],
	"568x320@68": [14,226,68,68, 486,226,68,68, 224,252,54,54, 158,252,54,54, 290,252,54,54, 356,252,54,54],
	"568x320@80": [14,214,80,80, 474,214,80,80, 224,252,54,54, 158,252,54,54, 290,252,54,54, 356,252,54,54],
	"568x320@92": [14,202,92,92, 462,202,92,92, 224,252,54,54, 158,252,54,54, 290,252,54,54, 356,252,54,54],
	"568x320@104": [14,190,104,104, 450,190,104,104, 224,252,54,54, 158,252,54,54, 290,252,54,54, 356,252,54,54],
	"516x290@68": [10,200,68,68, 438,200,68,68, 198,226,54,54, 132,226,54,54, 264,226,54,54, 330,226,54,54],
	"516x290@80": [10,188,80,80, 426,188,80,80, 198,226,54,54, 132,226,54,54, 264,226,54,54, 330,226,54,54],
	"516x290@92": [10,176,92,92, 414,176,92,92, 198,226,54,54, 132,226,54,54, 264,226,54,54, 330,226,54,54],
	"516x290@104": [10,164,104,104, 402,164,104,104, 198,226,54,54, 132,226,54,54, 264,226,54,54, 330,226,54,54],
	"473x266@68": [10,176,68,68, 395,176,68,68, 176,202,54,54, 110,202,54,54, 242,202,54,54, 308,202,54,54],
	"473x266@80": [10,164,80,80, 383,164,80,80, 176,202,54,54, 110,202,54,54, 242,202,54,54, 308,202,54,54],
	"473x266@92": [10,156,88,88, 375,156,88,88, 176,202,54,54, 110,202,54,54, 242,202,54,54, 308,202,54,54],
	"473x266@104": [10,156,88,88, 375,156,88,88, 176,202,54,54, 110,202,54,54, 242,202,54,54, 308,202,54,54],
	"436x246@68": [10,156,68,68, 358,156,68,68, 158,182,54,54, 92,182,54,54, 224,182,54,54, 290,182,54,54],
	"436x246@80": [10,154,70,70, 356,154,70,70, 158,182,54,54, 92,182,54,54, 224,182,54,54, 290,182,54,54],
	"436x246@92": [10,154,70,70, 356,154,70,70, 158,182,54,54, 92,182,54,54, 224,182,54,54, 290,182,54,54],
	"436x246@104": [10,154,70,70, 356,154,70,70, 158,182,54,54, 92,182,54,54, 224,182,54,54, 290,182,54,54],
	"320x182@68": [6,108,68,68, 246,108,68,68, 113,132,44,44, 113,82,44,44, 163,82,44,44, 163,132,44,44],
	"320x182@80": [6,96,80,80, 234,96,80,80, 113,132,44,44, 113,82,44,44, 163,82,44,44, 163,132,44,44],
	"320x182@92": [6,84,92,92, 222,84,92,92, 113,132,44,44, 113,82,44,44, 163,82,44,44, 163,132,44,44],
	"320x182@104": [6,75,101,101, 213,75,101,101, 113,132,44,44, 113,82,44,44, 163,82,44,44, 163,132,44,44],
	"1920x854@68": [22,752,68,68, 1830,752,68,68, 900,778,54,54, 834,778,54,54, 966,778,54,54, 1032,778,54,54],
	"1920x854@80": [22,740,80,80, 1818,740,80,80, 900,778,54,54, 834,778,54,54, 966,778,54,54, 1032,778,54,54],
	"1920x854@92": [22,728,92,92, 1806,728,92,92, 900,778,54,54, 834,778,54,54, 966,778,54,54, 1032,778,54,54],
	"1920x854@104": [22,716,104,104, 1794,716,104,104, 900,778,54,54, 834,778,54,54, 966,778,54,54, 1032,778,54,54],
	"1745x776@68": [22,674,68,68, 1655,674,68,68, 812,700,54,54, 746,700,54,54, 878,700,54,54, 944,700,54,54],
	"1745x776@80": [22,662,80,80, 1643,662,80,80, 812,700,54,54, 746,700,54,54, 878,700,54,54, 944,700,54,54],
	"1745x776@92": [22,650,92,92, 1631,650,92,92, 812,700,54,54, 746,700,54,54, 878,700,54,54, 944,700,54,54],
	"1745x776@104": [22,638,104,104, 1619,638,104,104, 812,700,54,54, 746,700,54,54, 878,700,54,54, 944,700,54,54],
	"1600x711@68": [22,609,68,68, 1510,609,68,68, 740,635,54,54, 674,635,54,54, 806,635,54,54, 872,635,54,54],
	"1600x711@80": [22,597,80,80, 1498,597,80,80, 740,635,54,54, 674,635,54,54, 806,635,54,54, 872,635,54,54],
	"1600x711@92": [22,585,92,92, 1486,585,92,92, 740,635,54,54, 674,635,54,54, 806,635,54,54, 872,635,54,54],
	"1600x711@104": [22,573,104,104, 1474,573,104,104, 740,635,54,54, 674,635,54,54, 806,635,54,54, 872,635,54,54],
	"1476x656@68": [22,554,68,68, 1386,554,68,68, 678,580,54,54, 612,580,54,54, 744,580,54,54, 810,580,54,54],
	"1476x656@80": [22,542,80,80, 1374,542,80,80, 678,580,54,54, 612,580,54,54, 744,580,54,54, 810,580,54,54],
	"1476x656@92": [22,530,92,92, 1362,530,92,92, 678,580,54,54, 612,580,54,54, 744,580,54,54, 810,580,54,54],
	"1476x656@104": [22,518,104,104, 1350,518,104,104, 678,580,54,54, 612,580,54,54, 744,580,54,54, 810,580,54,54],
};

// 667x375, the 844x390 phone after its 44 px left inset, the iPhone after
// CoreUISafeInsets, the iPhone SE, Studio's compact root and a wide desktop.
const ROOTS: [number, number][] = [
	[667, 375],
	[800, 390],
	[706, 267],
	[568, 320],
	[320, 182],
	[1920, 854],
];
// STICK SIZE 85%, 100%, 115% and 130%: 68, 80, 92 and 104 px.
const STICK_SCALES = [0.85, 1, 1.15, 1.3];
const CONTROLS = ["joystick", "throttle", "missile", "target", "special", "evade"] as const;

/** No two HUD rectangles overlap, and each sits inside the root's safe margin. */
function expectSeparateInside(hud: HudLayout, width: number, height: number) {
	const rectangles = hudObstacles(hud);
	for (let first = 0; first < rectangles.size(); first++) {
		expect(rectangleInside(rectangles[first], width, height, hud.margin)).toBe(true);
		for (let second = first + 1; second < rectangles.size(); second++) expect(rectanglesOverlap(rectangles[first], rectangles[second])).toBe(false);
	}
}

describe("touch controls", () => {
	it("match the recorded rectangles at every HUD scale and stick size, with the instruments clear of them", () => {
		let checked = 0;
		for (const [width, height] of ROOTS) for (let requested = 0.8; requested <= 1.3001; requested += 0.1) for (const stickScale of STICK_SCALES) {
			const scale = effectiveHudScale(requested, true, width, height);
			const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
			const stickSize = JOYSTICK_SIZE * stickScale;
			const expected = TOUCH[`${virtualWidth}x${virtualHeight}@${math.floor(stickSize + 0.5)}`];
			expect(expected).toBeDefined();
			const hud = getHudLayout(virtualWidth, virtualHeight, "touch", { stickSize });
			const touch = hud.touch!;
			CONTROLS.forEach((name, index) => {
				const control: Rectangle = touch[name];
				const offset = index * 4;
				expect([control.x, control.y, control.width, control.height]).toEqual([expected[offset], expected[offset + 1], expected[offset + 2], expected[offset + 3]]);
			});
			// The radar, status panel and objective never sit on a control (or on each other), and nothing else does either.
			const controls = CONTROLS.map((name) => touch[name]);
			for (const instrument of [hud.status.frame, hud.callout, ...(hud.radar ? [hud.radar] : [])]) for (const control of controls) expect(rectanglesOverlap(instrument, control)).toBe(false);
			if (hud.radar) expect(rectanglesOverlap(hud.radar, hud.status.frame)).toBe(false);
			expectSeparateInside(hud, virtualWidth, virtualHeight);
			checked++;
		}
		expect(checked).toBe(ROOTS.size() * 6 * STICK_SCALES.size());
	});

	it("keep the four action buttons identical, at least 44 px, on one baseline", () => {
		for (const [width, height] of ROOTS) for (let requested = 0.8; requested <= 1.3001; requested += 0.1) for (const stickScale of STICK_SCALES) {
			const scale = effectiveHudScale(requested, true, width, height);
			const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
			const touch = getHudLayout(virtualWidth, virtualHeight, "touch", { stickSize: JOYSTICK_SIZE * stickScale }).touch!;
			const buttons = [touch.target, touch.missile, touch.special, touch.evade];
			for (const button of buttons) {
				expect(button.width).toBe(touch.button);
				expect(button.height).toBe(touch.button);
			}
			expect(touch.button).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			if (virtualHeight > COMPACT_MAX_HEIGHT) {
				// Every phone and desktop root: one row, one baseline, even spacing, TGT FIRE SPECIAL EVADE.
				expect(touch.arrangement).toBe("row");
				expect(touch.button).toBe(ACTION_BUTTON_SIZE);
				const spacing = buttons[1].x - (buttons[0].x + touch.button);
				for (let index = 1; index < buttons.size(); index++) {
					expect(buttons[index].y).toBe(buttons[0].y);
					expect(buttons[index].x - (buttons[index - 1].x + touch.button)).toBe(spacing);
				}
				expect(buttons[0].x).toBeGreaterThan(touch.joystick.x + touch.joystick.width);
				expect(buttons[3].x + touch.button).toBeLessThan(touch.throttle.x);
			} else {
				// Studio's 320x182 root: no room for the row beside the sticks, so a 2x2 grid with a shared baseline per row.
				expect(touch.arrangement).toBe("grid");
				expect(touch.target.y).toBe(touch.special.y);
				expect(touch.missile.y).toBe(touch.evade.y);
			}
		}
	});

	it("leave room for every instrument on small phones at every HUD scale and stick size", () => {
		for (const [width, height] of [[568, 320], [640, 360], [560, 240], [750, 332], [844, 390]] as [number, number][]) {
			for (let requested = 1; requested <= 1.3001; requested += 0.1) for (const stickScale of STICK_SCALES) {
				const scale = effectiveHudScale(requested, true, width, height);
				const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
				const hud = getHudLayout(virtualWidth, virtualHeight, "touch", { stickSize: JOYSTICK_SIZE * stickScale });
				expectSeparateInside(hud, virtualWidth, virtualHeight);
				expect(hud.callout.width).toBeGreaterThanOrEqual(OBJECTIVE_MIN_WIDTH);
			}
		}
	});
});
