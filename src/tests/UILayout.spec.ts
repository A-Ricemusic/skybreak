import { describe, expect, it } from "@rbxts/jest-globals";

import {
	getSlotListHeight,
	getEvadeHint,
	getFlightHints,
	getHudLayout,
	getMenuHintsLayout,
	getMenuLayout,
	getToastLayout,
	inputModeFromInputType,
	inputModeFromPreferred,
	MIN_TOUCH_TARGET,
	rectangleInside,
	rectanglesOverlap,
	shouldAcceptInputModeChange,
	type InputMode,
	type Rectangle,
} from "../shared/UILayout";

const VIEWPORTS: [number, number][] = [
	[568, 320],
	[844, 390],
	[320, 568],
	[390, 844],
	[1024, 768],
	[1920, 1080],
];

function expectSeparate(rectangles: Rectangle[]) {
	for (let first = 0; first < rectangles.size(); first++) {
		for (let second = first + 1; second < rectangles.size(); second++) {
			expect(rectanglesOverlap(rectangles[first], rectangles[second])).toBe(false);
		}
	}
}

describe("minimal mission HUD layout", () => {
	it("lays out touch controls only for touch input", () => {
		for (const [width, height] of VIEWPORTS) {
			expect(getHudLayout(width, height, "touch").touch).toBeDefined();
			expect(getHudLayout(width, height, "keyboard").touch).toBeUndefined();
			expect(getHudLayout(width, height, "gamepad").touch).toBeUndefined();
		}
	});

	it("keeps every touch control separate, on screen, and large enough to press", () => {
		for (const [width, height] of VIEWPORTS) {
			const layout = getHudLayout(width, height, "touch");
			const touch = layout.touch!;
			const controls = [touch.joystick, touch.throttle, touch.missile, touch.target];
			expectSeparate([...controls, layout.status, layout.alert, layout.callout]);
			for (const rectangle of [...controls, layout.status, layout.alert, layout.callout]) {
				expect(rectangleInside(rectangle, width, height, 14)).toBe(true);
			}
			for (const control of [touch.joystick, touch.missile, touch.target]) {
				expect(control.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
				expect(control.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			}
			const throttleShort = touch.throttleVertical ? touch.throttle.width : touch.throttle.height;
			const throttleLong = touch.throttleVertical ? touch.throttle.height : touch.throttle.width;
			expect(throttleShort).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			expect(throttleLong).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET * 2 + 32);
		}
	});

	it("keeps the missile button the most prominent touch action", () => {
		const touch = getHudLayout(568, 320, "touch").touch!;
		expect(touch.missile.width).toBeGreaterThan(touch.target.width);
	});

	it("keeps keyboard and gamepad hints clear of the status readout", () => {
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			for (const [width, height] of [...VIEWPORTS, [480, 320] as [number, number]]) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.hints).toBeDefined();
				expectSeparate([layout.hints!, layout.status, layout.alert, layout.callout]);
				expect(rectangleInside(layout.hints!, math.max(320, width), height, 14)).toBe(true);
				expect(rectangleInside(layout.status, width, height, 14)).toBe(true);
			}
		}
	});

	it("anchors the objective callout at the top safe margin on every viewport and input mode", () => {
		for (const [width, height] of VIEWPORTS) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.callout.y).toBe(layout.margin);
				// The callout must sit inside the top band of the usable viewport so it
				// cannot cross the flight view, target bracket, or reticle (observed
				// across phone landscape, portrait, and tablet simulations).
				expect(layout.callout.y + layout.callout.height).toBeLessThanOrEqual(
					math.max(240, height) * 0.28,
				);
			}
		}
	});

	it("stacks the incoming warning below the objective callout rather than above it", () => {
		for (const [width, height] of VIEWPORTS) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				// Callout owns the top row; the alert pill only drops in beneath it
				// when visible so the forward view stays unobstructed otherwise.
				expect(layout.alert.y).toBeGreaterThanOrEqual(layout.callout.y + layout.callout.height);
				expect(layout.alert.y + layout.alert.height).toBeLessThanOrEqual(
					math.max(240, height) * 0.5,
				);
			}
		}
	});

	it("keeps the mission timer within the objective callout, not duplicated outside", () => {
		for (const [width, height] of VIEWPORTS) {
			const layout = getHudLayout(width, height, "touch");
			// The MissionTimer label is positioned at the right edge of the callout
			// in GameUI.tsx; the layout must leave at least 58px for its text and 10px
			// of padding so the timer never overflows into the alert lane below.
			expect(layout.callout.width).toBeGreaterThanOrEqual(68 + 76);
		}
	});

	it("keeps the HUD footprint small on a phone", () => {
		const width = 568;
		const height = 320;
		const layout = getHudLayout(width, height, "touch");
		const touch = layout.touch!;
		let area = layout.status.width * layout.status.height;
		for (const control of [touch.joystick, touch.throttle, touch.missile, touch.target]) area += control.width * control.height;
		expect(area / (width * height)).toBeLessThan(0.22);
	});
});

describe("menu layout", () => {
	it("keeps the panel inside every viewport", () => {
		for (const [width, height] of VIEWPORTS) {
			const layout = getMenuLayout(width, height);
			expect(rectangleInside(layout.panel, width, height, 12)).toBe(true);
			expect(layout.panel.width).toBeGreaterThanOrEqual(280);
		}
	});

	it("leaves the right side of landscape screens open for the aircraft", () => {
		for (const [width, height] of [[568, 320], [844, 390], [1024, 768], [1920, 1080]] as [number, number][]) {
			const layout = getMenuLayout(width, height);
			expect(layout.mode).toBe("side");
			expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(width * 0.56);
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
			expectSeparate([missionToast, hud.alert, hud.callout]);
			expect(rectanglesOverlap(missionToast, hud.touch!.joystick)).toBe(false);
			expect(rectanglesOverlap(missionToast, hud.touch!.missile)).toBe(false);
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
	});

	it("shows a launch legend, then only actionable hints", () => {
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			expect(getFlightHints(mode, { introduction: true, locked: false, missileReady: true }).size()).toBeGreaterThan(2);
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

describe("short campaign screen", () => {
	it("reserves a touch-sized footer below the scrolling slots", () => {
		for (const height of [240, 280, 320, 568]) {
			const menu = getMenuLayout(568, height);
			const top = menu.compact ? 34 : 66;
			expect(top + getSlotListHeight(menu.panel.height, menu.compact) + 12).toBeLessThanOrEqual(menu.panel.height - 44);
		}
	});
});
