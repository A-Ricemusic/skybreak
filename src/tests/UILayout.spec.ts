import { describe, expect, it } from "@rbxts/jest-globals";

import {
	EVADE_SIZE,
	FIRE_CAPTION_HEIGHT,
	FIRE_SIZE,
	hudObstacles,
	PAUSE_SIZE,
	RADAR_MAX_SIZE,
	RADAR_MIN_SIZE,
	STICK_MAX_SIZE,
	STICK_MIN_SIZE,
	getEvadeHint,
	getFlightHints,
	getSpecialHint,
	getHudCentreBox,
	getHudLayout,
	getKillMarkerLayout,
	KILL_MARKER_MIN_WIDTH,
	getMenuHintsLayout,
	getMenuLayout,
	getMenuSceneOpening,
	getToastLayout,
	COMPACT_MAX_HEIGHT,
	OBJECTIVE_LINE_HEIGHT,
	getTutorialInstruction,
	inputModeFromInputType,
	inputModeFromPreferred,
	isCompactHud,
	JOYSTICK_SIZE,
	MAX_FLIGHT_HINTS,
	MIN_TOUCH_TARGET,
	rectangleInside,
	rectanglesOverlap,
	shouldAcceptInputModeChange,
	SPECIAL_SIZE,
	TARGET_SIZE,
	TUTORIAL_MAX_CHARS,
	type HudLayout,
	type InputMode,
	type Rectangle,
} from "../shared/UILayout";

const VIEWPORTS: [number, number][] = [
	[320, 240],
	[568, 320],
	[844, 390],
	[320, 568],
	[390, 844],
	[1024, 768],
	[1920, 1080],
];

// Real roots after CoreUISafeInsets: 560x240 (smallest supported), the iPhone
// landscape that used to trip "compact" (706x267), the measured iPhone 13
// (750x332), 844x390, portrait 390x705 and a 1280x720 desktop.
const HUD_VIEWPORTS: [number, number][] = [
	[560, 240],
	[706, 267],
	[750, 332],
	[844, 390],
	[390, 705],
	[1280, 720],
];

// The 320x240 Studio simulator after the topbar inset; the only compact roots.
const COMPACT_VIEWPORTS: [number, number][] = [
	[320, 182],
	[319, 181],
	[319, 161],
	[320, 160],
	[560, 161],
];

const MODES: InputMode[] = ["touch", "keyboard", "gamepad"];

// The four roots the round-2 brief names: Studio compact, a 375x667 phone in
// landscape, an 844x390 notched phone after its 44 px left inset, and a wide desktop.
const KEY_VIEWPORTS: [number, number][] = [
	[320, 182],
	[667, 375],
	[800, 390],
	[1920, 854],
];
const STICK_SIZES = [STICK_MIN_SIZE, 96, STICK_MAX_SIZE];

function expectSeparate(rectangles: Rectangle[]) {
	for (let first = 0; first < rectangles.size(); first++) {
		for (let second = first + 1; second < rectangles.size(); second++) {
			expect(rectanglesOverlap(rectangles[first], rectangles[second])).toBe(false);
		}
	}
}

function hudRectangles(layout: HudLayout, includeAlert = true): Rectangle[] {
	return hudObstacles(layout).filter((rectangle) => includeAlert || rectangle !== layout.alert);
}

function sameRectangle(a: Rectangle, b: Rectangle): boolean {
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** The objective's left edge: right of the PAUSE button when there is one. */
function objectiveLeft(layout: HudLayout): number {
	return layout.pause ? layout.pause.x + layout.pause.width + 8 : layout.margin;
}

/** The clock column's right edge: left of a corner radar, else the margin. */
function columnRight(layout: HudLayout, width: number): number {
	return layout.radarPlacement === "corner" ? layout.radar!.x - 8 : width - layout.margin;
}

describe("minimal mission HUD layout", () => {
	it("separates touch hit regions, navigation, warnings and toasts around breakpoints, at every stick size", () => {
		for (const width of [319,320,321,349,350,351,359,360,361,390,560]) for (const height of [160,161,175,176,177,179,180,181,199,200,201,202,239,240,241,568]) for (const stickSize of STICK_SIZES) {
			const hud=getHudLayout(width,height,"touch",{stickSize});
			expectSeparate(hudRectangles(hud));
			// A toast with no free slot borrows the alert lane (it is transient); it never covers anything else.
			const toast=getToastLayout(width,height,undefined,"touch",{stickSize});
			const borrowed=sameRectangle(toast,hud.alert);
			for(const rect of hudRectangles(hud)) if(!(borrowed && rect===hud.alert)) expect(rectanglesOverlap(toast,rect)).toBe(false);
			for(const rect of hudRectangles(hud)) expect(rectangleInside(rect,width,height,hud.margin)).toBe(true);
		}
	});
	it("reserves the compact layout for roots at most 200pt tall, never for real phones", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS]) expect(isCompactHud(width, height)).toBe(false);
		for (const [width, height] of COMPACT_VIEWPORTS) expect(isCompactHud(width, height)).toBe(true);
		expect(isCompactHud(706, 267)).toBe(false);
		expect(isCompactHud(560, 201)).toBe(false);
		expect(isCompactHud(560, 200)).toBe(true);
	});

	it("keeps every HUD element on screen and separate, in every input mode", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const rectangles = hudRectangles(layout);
				expectSeparate(rectangles);
				for (const rectangle of rectangles) expect(rectangleInside(rectangle, width, height, layout.margin)).toBe(true);
			}
		}
	});

	it("lays out touch controls only for touch input", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS]) {
			expect(getHudLayout(width, height, "touch").touch).toBeDefined();
			expect(getHudLayout(width, height, "keyboard").touch).toBeUndefined();
			expect(getHudLayout(width, height, "gamepad").touch).toBeUndefined();
		}
	});

	it("uses small touch controls that are still at least 44px to press", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			expect(touch.joystick.width).toBe(JOYSTICK_SIZE);
			expect(touch.joystick.height).toBe(JOYSTICK_SIZE);
			// The Studio-compact 2x2 grid uses the 44 px minimum for every action.
			const small = height < 176 || touch.arrangement === "grid";
			expect(touch.missile.width).toBe(small ? MIN_TOUCH_TARGET : FIRE_SIZE);
			expect(touch.target.width).toBe(small ? MIN_TOUCH_TARGET : TARGET_SIZE);
			expect(JOYSTICK_SIZE).toBe(96);
			expect(FIRE_SIZE).toBe(64);
			expect(TARGET_SIZE).toBe(48);
			expect(EVADE_SIZE).toBe(56);
			expect(touch.special.width).toBe(small ? MIN_TOUCH_TARGET : SPECIAL_SIZE);
			expect(touch.special.height).toBe(small ? MIN_TOUCH_TARGET : SPECIAL_SIZE);
			expect(touch.evade.width).toBe(touch.evade.height);
			for (const control of [touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade]) {
				expect(control.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
				expect(control.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			}
			expect(touch.throttle.width).toBe(JOYSTICK_SIZE);
			expect(touch.throttle.height).toBe(JOYSTICK_SIZE);
			expect(touch.throttle.x).toBeGreaterThan(width / 2);
			expect(touch.throttle.y).toBe(touch.joystick.y);
			expect(touch.missile.width).toBeGreaterThanOrEqual(touch.target.width);
		}
	});

	it("keeps the objective to at most two short lines in the top-left corner, right of PAUSE", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.callout.x).toBe(objectiveLeft(layout));
				expect(layout.callout.y).toBe(layout.margin);
				expect(layout.callout.width).toBeLessThanOrEqual(width * 0.38);
				// Two 11pt lines: long objectives and story radio wrap instead of shrinking.
				expect(layout.callout.height).toBeLessThanOrEqual(OBJECTIVE_LINE_HEIGHT);
			}
		}
	});

	it("shows the clock as text in the top-right with hull and missiles directly below", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.timer.width).toBeLessThanOrEqual(48);
				expect(layout.timer.height).toBeLessThanOrEqual(14);
				expect(layout.timer.x + layout.timer.width).toBe(columnRight(layout, width));
				expect(layout.timer.y).toBe(layout.margin);
				expect(layout.status.x + layout.status.width).toBe(columnRight(layout, width));
				expect(layout.status.y).toBeGreaterThanOrEqual(layout.timer.y + layout.timer.height);
				expect(layout.status.y - (layout.timer.y + layout.timer.height)).toBeLessThanOrEqual(4);
				expect(layout.status.width).toBeLessThanOrEqual(150);
				expect(layout.status.height).toBeLessThanOrEqual(14);
			}
		}
	});

	it("draws a compact hull bar directly under the weapon status, inside the margin", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const health = layout.health;
				expect(health.x + health.width).toBe(columnRight(layout, width));
				expect(health.y).toBeGreaterThanOrEqual(layout.status.y + layout.status.height);
				expect(health.y - (layout.status.y + layout.status.height)).toBeLessThanOrEqual(2);
				expect(health.width).toBeLessThanOrEqual(layout.status.width);
				expect(health.width).toBeGreaterThanOrEqual(JOYSTICK_SIZE);
				expect(health.height).toBeGreaterThanOrEqual(4);
				expect(health.height).toBeLessThanOrEqual(8);
				expect(rectangleInside(health, width, height, layout.margin)).toBe(true);
				expect(rectanglesOverlap(health, getToastLayout(width, height, undefined, mode))).toBe(false);
			}
		}
		const phone = getHudLayout(750, 332, "touch").health;
		expect(phone).toEqual({ x: 586, y: 45, width: 150, height: 6 });
	});

	it("puts the throttle captions outside the disc, centred above and below it", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			const up = touch.throttleUpLabel!;
			const down = touch.throttleDownLabel!;
			for (const label of [up, down]) {
				expect(label.x).toBe(touch.throttle.x);
				expect(label.width).toBe(touch.throttle.width);
				expect(rectanglesOverlap(label, touch.throttle)).toBe(false);
			}
			expect(up.y + up.height).toBeLessThanOrEqual(touch.throttle.y);
			expect(down.y).toBeGreaterThanOrEqual(touch.throttle.y + touch.throttle.height);
		}
	});

	it("defines the forward view as the central 50% width and 60% height", () => {
		const box = getHudCentreBox(1000, 500);
		expect(box).toEqual({ x: 250, y: 100, width: 500, height: 300 });
	});

	it("keeps top texts and non-touch HUD out of the forward view; touch actions use the bottom lane", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, [568, 320], [390, 844], [320, 568], [1024, 768], [1920, 1080], ...KEY_VIEWPORTS.filter(([, h]) => h > COMPACT_MAX_HEIGHT)] as [number, number][]) {
			const centre = getHudCentreBox(width, height);
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const top = [layout.callout, layout.timer, layout.status, layout.health, ...(layout.pause ? [layout.pause] : [])];
				// The radar keeps out of the forward view on landscape roots (portrait has no room beside it).
				if (layout.radar && width > height) top.push(layout.radar);
				// The navigation slot is the navigation cue's fallback, which may enter the forward view.
				const rest = hudRectangles(layout, false).filter((r) => r !== layout.radar && r !== layout.navigation);
				for (const rectangle of mode === "touch" ? top : [...rest, ...top]) {
					expect(rectanglesOverlap(rectangle, centre)).toBe(false);
				}
				// Landscape phones also keep the mission toast out of the forward view.
				if (width > height && height > COMPACT_MAX_HEIGHT) expect(rectanglesOverlap(getToastLayout(width, height, undefined, mode), centre)).toBe(false);
			}
		}
	});

	it("puts the kill callout at the top centre, clear of every HUD text and the forward view", () => {
		// 320x240 is the pre-inset Studio simulator: too narrow and short for a top slot (see below).
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS].filter(([w, h]) => w >= 360 || h > 240)) {
			const centre = getHudCentreBox(width, height);
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const marker = getKillMarkerLayout(width, height, mode);
				expect(rectangleInside(marker, width, height, layout.margin)).toBe(true);
				expect(marker.width).toBeGreaterThanOrEqual(KILL_MARKER_MIN_WIDTH);
				expect(rectanglesOverlap(marker, centre)).toBe(false);
				for (const rectangle of hudRectangles(layout)) expect(rectanglesOverlap(marker, rectangle)).toBe(false);
				// Upper fifth of the screen, and in the middle half horizontally.
				expect(marker.y + marker.height).toBeLessThanOrEqual(height * 0.2);
				expect(marker.x + marker.width / 2).toBeGreaterThanOrEqual(width * 0.25);
				expect(marker.x + marker.width / 2).toBeLessThanOrEqual(width * 0.75);
			}
		}
	});

	it("keeps the kill callout on screen on Studio-sized roots, borrowing the alert lane when no slot fits", () => {
		for (const [width, height] of [...COMPACT_VIEWPORTS, [320, 240]] as [number, number][]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const marker = getKillMarkerLayout(width, height, mode);
			expect(rectangleInside(marker, width, height, layout.margin)).toBe(true);
			for (const rectangle of hudRectangles(layout, false)) expect(rectanglesOverlap(marker, rectangle)).toBe(false);
			if (width <= 320) expect(marker).toEqual(layout.alert);
		}
	});

	it("centres a short warning above the controls or non-touch hint row", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, [568, 320], [390, 844], [320, 568], [1024, 768], [1920, 1080]] as [number, number][]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const alert = layout.alert;
				expect(alert.width).toBeLessThanOrEqual(220);
				expect(alert.width).toBeGreaterThanOrEqual(110);
				expect(alert.height).toBeLessThanOrEqual(20);
				const centreX = alert.x + alert.width / 2;
				expect(math.abs(centreX - width / 2)).toBeLessThanOrEqual(width * 0.1);
				// The alert may enter the forward view (only it, the bracket and the navigation cue may),
				// but stays in the lower third, directly above the hint row on keyboard and gamepad.
				if (mode !== "touch") expect(alert.y).toBeGreaterThanOrEqual(height * 0.7);
				if (layout.hints) expect(layout.hints.y - (alert.y + alert.height)).toBeLessThanOrEqual(8);
				if (layout.hints) expect(alert.y + alert.height).toBeLessThanOrEqual(layout.hints.y);
			}
		}
	});

	it("keeps combat buttons in the lane between independent sticks", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			const layout = getHudLayout(width, height, "touch");
			const touch = layout.touch!;
			const lane = touch.arrangement === "stacked" ? [touch.missile, touch.target, touch.special] : [touch.missile, touch.target, touch.special, touch.evade];
			for (const button of lane) {
				expect(button.x).toBeGreaterThan(touch.joystick.x + touch.joystick.width);
				expect(button.x + button.width).toBeLessThan(touch.throttle.x);
			}
			expectSeparate([layout.alert, touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade]);
		}
	});

	it("puts EVADE on the right-thumb side: next to the throttle, or above it on narrow roots", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const stickSize of STICK_SIZES) {
			const touch = getHudLayout(width, height, "touch", { stickSize }).touch!;
			expect(touch.evade.x + touch.evade.width / 2).toBeGreaterThan(width / 2);
			if (touch.arrangement === "row") {
				// The action nearest the throttle disc, bottom-aligned with FIRE.
				for (const other of [touch.missile, touch.target, touch.special]) expect(other.x).toBeLessThan(touch.evade.x);
				expect(touch.evade.y + touch.evade.height).toBe(touch.missile.y + touch.missile.height);
			} else if (touch.arrangement === "stacked") {
				expect(touch.evade.x).toBeGreaterThanOrEqual(touch.throttle.x);
				expect(touch.evade.x + touch.evade.width).toBeLessThanOrEqual(touch.throttle.x + touch.throttle.width);
				expect(touch.evade.y + touch.evade.height).toBeLessThanOrEqual((touch.throttleUpLabel ?? touch.throttle).y);
			} else {
				// Compact grid: bottom-right cell, beside FIRE.
				expect(touch.evade.y).toBe(touch.missile.y);
				expect(touch.evade.x).toBeGreaterThan(touch.missile.x);
			}
		}
		// Every real phone root gets the full 56 px button.
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [800, 390], [667, 375], [390, 705], [1920, 854]] as [number, number][]) {
			expect(getHudLayout(width, height, "touch").touch!.evade.width).toBe(EVADE_SIZE);
		}
	});

	it("honours the requested stick size where it fits and clamps it where it would crowd the lane", () => {
		for (const stickSize of STICK_SIZES) {
			for (const [width, height] of [[844, 390], [800, 390], [667, 375], [1920, 854]] as [number, number][]) {
				expect(getHudLayout(width, height, "touch", { stickSize }).touch!.joystick.width).toBe(stickSize);
			}
			for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
				const touch = getHudLayout(width, height, "touch", { stickSize }).touch!;
				expect(touch.joystick.width).toBeGreaterThanOrEqual(STICK_MIN_SIZE);
				expect(touch.joystick.width).toBeLessThanOrEqual(stickSize);
				expect(touch.throttle.width).toBe(touch.joystick.width);
			}
		}
		// Out-of-range requests are clamped.
		expect(getHudLayout(844, 390, "touch", { stickSize: 400 }).touch!.joystick.width).toBe(STICK_MAX_SIZE);
		expect(getHudLayout(844, 390, "touch", { stickSize: 10 }).touch!.joystick.width).toBe(STICK_MIN_SIZE);
	});

	it("gives every non-compact root a PAUSE button at the top-left; compact roots rely on the Roblox menu", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			if (height < 240) { expect(layout.pause).toBeUndefined(); continue; }
			const pause = layout.pause!;
			expect(pause.x).toBe(layout.margin);
			expect(pause.y).toBe(layout.margin);
			if (mode === "touch") expect(pause.width).toBe(PAUSE_SIZE);
			expect(pause.width).toBe(pause.height);
			expect(rectangleInside(pause, width, height, layout.margin)).toBe(true);
		}
		for (const [width, height] of COMPACT_VIEWPORTS) expect(getHudLayout(width, height, "touch").pause).toBeUndefined();
	});

	it("puts the radar top-right on touch and bottom-centre on desktop, 90-110 px, wherever a slot fits", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const radar = layout.radar;
			if (!radar) continue;
			expect(radar.width).toBe(radar.height);
			expect(radar.width).toBeGreaterThanOrEqual(RADAR_MIN_SIZE);
			expect(radar.width).toBeLessThanOrEqual(RADAR_MAX_SIZE);
			if (layout.radarPlacement === "bottom") {
				expect(mode).never.toBe("touch");
				expect(math.abs(radar.x + radar.width / 2 - width / 2)).toBeLessThanOrEqual(1);
				expect(radar.y + radar.height).toBe(height - layout.margin);
				expect(rectanglesOverlap(radar, getHudCentreBox(width, height))).toBe(false);
				// The hint row sits directly above it.
				expect(layout.hints!.y + layout.hints!.height).toBeLessThanOrEqual(radar.y);
			} else {
				expect(radar.x + radar.width).toBe(width - layout.margin);
				if (layout.radarPlacement === "corner") expect(radar.y).toBe(layout.margin);
				else expect(radar.y).toBeGreaterThan(layout.health.y + layout.health.height);
			}
		}
		for (const [width, height] of [[667, 375], [800, 390], [844, 390], [750, 332], [706, 267], [1920, 854], [1280, 720], [390, 705]] as [number, number][]) {
			const touch = getHudLayout(width, height, "touch");
			expect(touch.radar).toBeDefined();
			expect(touch.radarPlacement).never.toBe("bottom");
		}
		for (const [width, height] of [[1920, 854], [1280, 720], [1024, 768], [1920, 1080]] as [number, number][]) {
			expect(getHudLayout(width, height, "keyboard").radarPlacement).toBe("bottom");
			expect(getHudLayout(width, height, "gamepad").radarPlacement).toBe("bottom");
		}
		// The 320x182 Studio root has no slot for a 90 px disc.
		expect(getHudLayout(320, 182, "touch").radar).toBeUndefined();
	});

	it("captions refusals directly above FIRE when the touch row has room, never on the objective line", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			const layout = getHudLayout(width, height, "touch");
			const caption = layout.fireCaption;
			if (layout.touch!.arrangement !== "row") { expect(caption).toBeUndefined(); continue; }
			expect(caption!.height).toBe(FIRE_CAPTION_HEIGHT);
			expect(caption!.y + caption!.height).toBeLessThanOrEqual(layout.touch!.missile.y);
			expect(math.abs(caption!.x + caption!.width / 2 - (layout.touch!.missile.x + layout.touch!.missile.width / 2))).toBeLessThanOrEqual(1);
			expect(rectanglesOverlap(caption!, layout.callout)).toBe(false);
		}
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) expect(getHudLayout(844, 390, mode).fireCaption).toBeUndefined();
	});

	it("matches the agreed numbers on the four key roots", () => {
		const studio = getHudLayout(320, 182, "touch");
		expect(studio.touch!.arrangement).toBe("grid");
		expect(studio.touch!.evade).toEqual({ x: 163, y: 132, width: 44, height: 44 });
		expect(studio.touch!.missile).toEqual({ x: 113, y: 132, width: 44, height: 44 });
		const se = getHudLayout(667, 375, "touch");
		expect(se.touch!.arrangement).toBe("row");
		expect(se.touch!.evade).toEqual({ x: 489, y: 305, width: 56, height: 56 });
		expect(se.radar).toEqual({ x: 543, y: 59, width: 110, height: 110 });
		expect(se.pause).toEqual({ x: 14, y: 14, width: 44, height: 44 });
		const notched = getHudLayout(800, 390, "touch");
		expect(notched.touch!.evade).toEqual({ x: 622, y: 320, width: 56, height: 56 });
		expect(notched.radar).toEqual({ x: 676, y: 59, width: 110, height: 110 });
		const desktop = getHudLayout(1920, 854, "keyboard");
		expect(desktop.radar).toEqual({ x: 905, y: 722, width: 110, height: 110 });
		expect(desktop.hints!.y).toBe(702);
		expect(desktop.pause).toEqual({ x: 22, y: 22, width: 32, height: 32 });
		// The 706x267 iPhone root: the disc takes the corner and the clock column moves left of it.
		const phone = getHudLayout(706, 267, "touch");
		expect(phone.radarPlacement).toBe("corner");
		expect(phone.timer.x + phone.timer.width).toBe(phone.radar!.x - 8);
	});

	it("keeps keyboard and gamepad hints a short bottom-centre row", () => {
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
				const hints = getHudLayout(width, height, mode).hints!;
				expect(hints).toBeDefined();
				expect(hints.height).toBeLessThanOrEqual(20);
				expect(hints.width).toBeLessThanOrEqual(360);
				expect(math.abs(hints.x + hints.width / 2 - width / 2)).toBeLessThanOrEqual(1);
			}
		}
	});

	it("keeps the touch controls, EVADE included, under 17% of a landscape phone screen", () => {
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [800, 390], [667, 375]] as [number, number][]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			let area = touch.throttle.width * touch.throttle.height;
			for (const control of [touch.joystick, touch.missile, touch.target, touch.special, touch.evade]) area += control.width * control.height;
			expect(area / (width * height)).toBeLessThan(0.17);
		}
	});

	it("writes every training instruction as one short line", () => {
		for (const step of ["move", "target", "missile"]) {
			for (const mode of MODES) {
				const text = getTutorialInstruction(step, mode);
				expect(text.size() > 0).toBe(true);
				// Byte length: never shorter than the character count.
				expect(text.size()).toBeLessThanOrEqual(TUTORIAL_MAX_CHARS);
			}
		}
		expect(TUTORIAL_MAX_CHARS).toBe(34);
		expect(getTutorialInstruction(undefined, "touch")).toBe("");
		expect(getTutorialInstruction("target", "touch")).toBe("Tap TGT to select the radar");
	});
});

describe("menu layout", () => {
	it("keeps the Studio compact panel inside the short safe area", () => {
		for (const [width, height] of [[319, 181], [320, 182]]) {
			const menu = getMenuLayout(width, height);
			expect(rectangleInside(menu.panel, width, height, 6)).toBe(true);
			expect(menu.panel.width).toBeGreaterThanOrEqual(280);
		}
	});
	it("keeps the panel inside every viewport", () => {
		for (const [width, height] of VIEWPORTS) {
			const layout = getMenuLayout(width, height);
			expect(rectangleInside(layout.panel, width, height, 12)).toBe(true);
			expect(layout.panel.width).toBeGreaterThanOrEqual(280);
		}
	});

	it("gives phone landscape copy most of the width and still leaves an open strip for the aircraft", () => {
		for (const [width, height] of [[560, 240], [568, 320], [706, 267], [750, 332], [844, 390], [1024, 768], [1280, 720], [1920, 1080]] as [number, number][]) {
			const layout = getMenuLayout(width, height);
			expect(layout.mode).toBe("side");
			// At least a third of the root stays open for the display jet.
			expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(width * 0.66);
			const opening = getMenuSceneOpening(width, layout);
			expect(opening).toBeGreaterThanOrEqual(0.3);
			expect(opening).toBeLessThanOrEqual(0.75);
		}
		// Phones: the reading panel is the larger share of the screen.
		for (const [width, height] of [[706, 267], [750, 332], [844, 390]] as [number, number][]) {
			expect(getMenuLayout(width, height).panel.width).toBeGreaterThanOrEqual(width * 0.55);
		}
	});

	it("uses a bottom sheet in portrait so the aircraft stays visible above it", () => {
		for (const [width, height] of [[320, 568], [390, 844]] as [number, number][]) {
			const layout = getMenuLayout(width, height);
			expect(layout.mode).toBe("sheet");
			expect(layout.panel.y).toBeGreaterThanOrEqual(height * 0.3);
		}
	});

	it("switches to compact typography on short viewports only", () => {
		expect(getMenuLayout(568, 320).compact).toBe(true);
		expect(getMenuLayout(1920, 1080).compact).toBe(false);
	});

	it("keeps gamepad menu hints on screen and off the panel", () => {
		for (const [width, height] of VIEWPORTS) {
			const menu = getMenuLayout(width, height);
			const hints = getMenuHintsLayout(width, height, menu);
			expect(rectangleInside(hints, width, height, 12)).toBe(true);
			expect(rectanglesOverlap(hints, menu.panel)).toBe(false);
		}
	});

	it("never places a toast over the menu panel, menu hints, or the mission alert lane", () => {
		for (const [width, height] of VIEWPORTS) {
			const menu = getMenuLayout(width, height);
			const menuToast = getToastLayout(width, height, menu);
			expect(rectanglesOverlap(menuToast, menu.panel)).toBe(false);
			expect(rectanglesOverlap(menuToast, getMenuHintsLayout(width, height, menu))).toBe(false);
			const hud = getHudLayout(width, height, "touch");
			const missionToast = getToastLayout(width, height, undefined, "touch");
			expectSeparate([missionToast, ...(sameRectangle(missionToast, hud.alert) ? [] : [hud.alert]), hud.callout, hud.timer, hud.status]);
			expect(rectanglesOverlap(missionToast, hud.touch!.joystick)).toBe(false);
			expect(rectanglesOverlap(missionToast, hud.touch!.missile)).toBe(false);
		}
		for (const [width, height] of [...HUD_VIEWPORTS, ...KEY_VIEWPORTS]) {
			for (const mode of MODES) {
				const missionToast = getToastLayout(width, height, undefined, mode);
				for (const rectangle of hudRectangles(getHudLayout(width, height, mode))) expect(rectanglesOverlap(missionToast, rectangle)).toBe(false);
			}
		}
	});
});

describe("input mode and contextual hints", () => {
	it("classifies preferred input and raw input types", () => {
		expect(inputModeFromPreferred("Touch")).toBe("touch");
		expect(inputModeFromPreferred("Gamepad")).toBe("gamepad");
		expect(inputModeFromPreferred("KeyboardAndMouse")).toBe("keyboard");
		expect(inputModeFromInputType("Touch")).toBe("touch");
		expect(inputModeFromInputType("Gamepad1")).toBe("gamepad");
		expect(inputModeFromInputType("Gamepad4")).toBe("gamepad");
		expect(inputModeFromInputType("Keyboard")).toBe("keyboard");
		expect(inputModeFromInputType("MouseButton2")).toBe("keyboard");
		expect(inputModeFromInputType("MouseMovement")).toBe("keyboard");
		expect(inputModeFromInputType("Focus")).toBeUndefined();
		expect(inputModeFromInputType("TextInput")).toBeUndefined();
	});

	it("does not leave touch mode while the joystick is held", () => {
		expect(shouldAcceptInputModeChange("touch", "keyboard", true)).toBe(false);
		expect(shouldAcceptInputModeChange("touch", "gamepad", true)).toBe(false);
		expect(shouldAcceptInputModeChange("touch", "keyboard", false)).toBe(true);
		expect(shouldAcceptInputModeChange("keyboard", "touch", false)).toBe(true);
		expect(shouldAcceptInputModeChange("gamepad", "gamepad", false)).toBe(false);
	});

	it("never shows button hints to touch players", () => {
		expect(getFlightHints("touch", { introduction: true, locked: true, missileReady: true }).size()).toBe(0);
		expect(getEvadeHint("touch")).toBeUndefined();
		expect(getSpecialHint("touch", "UAV")).toBeUndefined();
	});

	it("binds the special slot to C on keyboard and X on a gamepad, labelled with the weapon", () => {
		expect(getSpecialHint("keyboard", "FLR")).toEqual({ label: "C", action: "FLR" });
		expect(getSpecialHint("gamepad", "4AAM")).toEqual({ keyCode: "ButtonX", label: "X", action: "4AAM" });
	});

	it("shows at most two hints: a short launch legend, then only actionable ones", () => {
		expect(MAX_FLIGHT_HINTS).toBe(2);
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			for (const introduction of [true, false]) {
				for (const locked of [true, false]) {
					for (const missileReady of [true, false]) {
						expect(getFlightHints(mode, { introduction, locked, missileReady }).size()).toBeLessThanOrEqual(MAX_FLIGHT_HINTS);
					}
				}
			}
			expect(getFlightHints(mode, { introduction: true, locked: false, missileReady: true }).size()).toBe(2);
			expect(getFlightHints(mode, { introduction: false, locked: false, missileReady: true }).size()).toBe(0);
			expect(getFlightHints(mode, { introduction: false, locked: true, missileReady: false }).size()).toBe(0);
			const fire = getFlightHints(mode, { introduction: false, locked: true, missileReady: true });
			expect(fire.size()).toBe(1);
			expect(fire[0].action).toBe("FIRE");
			expect(getEvadeHint(mode)!.action).toBe("EVADE");
		}
	});

	it("uses gamepad glyphs for gamepad hints and key names for keyboard hints", () => {
		for (const hint of getFlightHints("gamepad", { introduction: true, locked: false, missileReady: false })) {
			expect(hint.keyCode).toBeDefined();
		}
		for (const hint of getFlightHints("keyboard", { introduction: true, locked: false, missileReady: false })) {
			expect(hint.keyCode).toBeUndefined();
		}
	});
});
