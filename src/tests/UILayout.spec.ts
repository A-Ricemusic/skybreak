import { describe, expect, it } from "@rbxts/jest-globals";

import {
	FIRE_SIZE,
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

function expectSeparate(rectangles: Rectangle[]) {
	for (let first = 0; first < rectangles.size(); first++) {
		for (let second = first + 1; second < rectangles.size(); second++) {
			expect(rectanglesOverlap(rectangles[first], rectangles[second])).toBe(false);
		}
	}
}

function hudRectangles(layout: HudLayout, includeAlert = true): Rectangle[] {
	const rectangles = [layout.callout, layout.timer, layout.status, layout.health, layout.flightStatus, layout.navigation];
	if (includeAlert) rectangles.push(layout.alert);
	if (layout.hints) rectangles.push(layout.hints);
	const touch = layout.touch;
	if (touch) {
		rectangles.push(touch.joystick, touch.throttle, touch.missile, touch.target, touch.special);
		if (touch.throttleUpLabel) rectangles.push(touch.throttleUpLabel);
		if (touch.throttleDownLabel) rectangles.push(touch.throttleDownLabel);
	}
	return rectangles;
}

describe("minimal mission HUD layout", () => {
	it("separates touch hit regions, navigation, warnings and toasts around breakpoints", () => {
		for (const width of [319,320,321,349,350,351,359,360,361,390,560]) for (const height of [160,161,175,176,177,179,180,181,199,200,201,202,239,240,241,568]) {
			const hud=getHudLayout(width,height,"touch");
			expectSeparate([...hudRectangles(hud),getToastLayout(width,height)]);
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
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
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
			expect(touch.missile.width).toBe(height < 176 ? MIN_TOUCH_TARGET : FIRE_SIZE);
			expect(touch.target.width).toBe(height < 176 ? MIN_TOUCH_TARGET : TARGET_SIZE);
			expect(JOYSTICK_SIZE).toBe(96);
			expect(FIRE_SIZE).toBe(64);
			expect(TARGET_SIZE).toBe(48);
			expect(touch.special.width).toBe(height < 176 ? MIN_TOUCH_TARGET : SPECIAL_SIZE);
			expect(touch.special.height).toBe(height < 176 ? MIN_TOUCH_TARGET : SPECIAL_SIZE);
			for (const control of [touch.joystick, touch.throttle, touch.missile, touch.target, touch.special]) {
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

	it("keeps the objective to at most two short lines in the top-left corner", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.callout.x).toBe(layout.margin);
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
				expect(layout.timer.x + layout.timer.width).toBe(width - layout.margin);
				expect(layout.timer.y).toBe(layout.margin);
				expect(layout.status.x + layout.status.width).toBe(width - layout.margin);
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
				expect(health.x + health.width).toBe(width - layout.margin);
				expect(health.y).toBeGreaterThanOrEqual(layout.status.y + layout.status.height);
				expect(health.y - (layout.status.y + layout.status.height)).toBeLessThanOrEqual(2);
				expect(health.width).toBeLessThanOrEqual(layout.status.width);
				expect(health.width).toBeGreaterThanOrEqual(JOYSTICK_SIZE);
				expect(health.height).toBeGreaterThanOrEqual(4);
				expect(health.height).toBeLessThanOrEqual(8);
				expect(rectangleInside(health, width, height, layout.margin)).toBe(true);
				expect(rectanglesOverlap(health, getToastLayout(width, height))).toBe(false);
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
		for (const [width, height] of [...HUD_VIEWPORTS, [568, 320], [390, 844], [320, 568], [1024, 768], [1920, 1080]] as [number, number][]) {
			const centre = getHudCentreBox(width, height);
			for (const mode of MODES) {
				for (const rectangle of mode === "touch" ? [getHudLayout(width, height, mode).callout, getHudLayout(width, height, mode).timer, getHudLayout(width, height, mode).status, getHudLayout(width, height, mode).health] : hudRectangles(getHudLayout(width, height, mode), false)) {
					expect(rectanglesOverlap(rectangle, centre)).toBe(false);
				}
			}
			// Landscape phones also keep the mission toast out of the forward view.
			if (width > height && height > COMPACT_MAX_HEIGHT) expect(rectanglesOverlap(getToastLayout(width, height), centre)).toBe(false);
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
				if (mode !== "touch") expect(alert.y).toBeGreaterThanOrEqual(height * 0.8);
				// Directly above the hint row on keyboard and gamepad.
				if (layout.hints) expect(layout.hints.y - (alert.y + alert.height)).toBeLessThanOrEqual(8);
			}
		}
	});

	it("keeps combat buttons in the lane between independent sticks", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			const layout = getHudLayout(width, height, "touch");
			const touch = layout.touch!;
			for (const button of [touch.missile, touch.target, touch.special]) {
				expect(button.x).toBeGreaterThan(touch.joystick.x + touch.joystick.width);
				expect(button.x + button.width).toBeLessThan(touch.throttle.x);
			}
			expectSeparate([layout.alert, touch.joystick, touch.throttle, touch.missile, touch.target, touch.special]);
		}
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

	it("keeps the touch controls under 15% of a landscape phone screen", () => {
		for (const [width, height] of [[706, 267], [750, 332], [844, 390]] as [number, number][]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			let area = touch.throttle.width * touch.throttle.height;
			for (const control of [touch.joystick, touch.missile, touch.target, touch.special]) area += control.width * control.height;
			expect(area / (width * height)).toBeLessThan(0.15);
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
			const missionToast = getToastLayout(width, height);
			expectSeparate([missionToast, hud.alert, hud.callout, hud.timer, hud.status]);
			expect(rectanglesOverlap(missionToast, hud.touch!.joystick)).toBe(false);
			expect(rectanglesOverlap(missionToast, hud.touch!.missile)).toBe(false);
		}
		for (const [width, height] of HUD_VIEWPORTS) {
			const missionToast = getToastLayout(width, height);
			for (const mode of MODES) {
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
