import { describe, expect, it } from "@rbxts/jest-globals";

import {
	getSlotListHeight,
	getEvadeHint,
	getFlightHints,
	getHudCentreBox,
	getHudLayout,
	getMenuHintsLayout,
	getMenuLayout,
	getToastLayout,
	inputModeFromInputType,
	inputModeFromPreferred,
	isCompactHud,
	MIN_TOUCH_TARGET,
	rectangleInside,
	rectanglesOverlap,
	shouldAcceptInputModeChange,
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

// Landscape phone safe areas, including the measured iPhone 13 (750x332) root.
const PHONE_LANDSCAPE: [number, number][] = [
	[480, 320],
	[540, 300],
	[568, 320],
	[667, 375],
	[750, 332],
	[844, 390],
];

function expectSeparate(rectangles: Rectangle[]) {
	for (let first = 0; first < rectangles.size(); first++) {
		for (let second = first + 1; second < rectangles.size(); second++) {
			expect(rectanglesOverlap(rectangles[first], rectangles[second])).toBe(false);
		}
	}
}

describe("minimal mission HUD layout", () => {
	it("fits the measured safe area after the topbar reduces a 320x240 simulator",()=>{
		for(const [width,height] of [[319,181],[320,182]])for(const mode of ["touch","keyboard","gamepad"] as InputMode[]) {
			const layout=getHudLayout(width,height,mode),touch=layout.touch;
			const rectangles=[layout.callout,layout.timer,layout.alert,layout.status];
			if(layout.hints)rectangles.push(layout.hints);
			if(touch)rectangles.push(touch.joystick,touch.throttle,touch.missile,touch.target);
			expectSeparate(rectangles);
			for(const rectangle of rectangles)expect(rectangleInside(rectangle,width,height,6)).toBe(true);
			if(touch)for(const control of [touch.joystick,touch.throttle,touch.missile,touch.target]) {
				expect(control.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
				expect(control.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			}
		}
	});
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
			expectSeparate([...controls, layout.status, layout.alert, layout.callout, layout.timer]);
			for (const rectangle of [...controls, layout.status, layout.alert, layout.callout, layout.timer]) {
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

	it("uses compact rows only when a landscape viewport cannot fit the normal touch layout", () => {
		const compact = getHudLayout(320, 240, "touch");
		const compactTouch = compact.touch!;
		expect(compactTouch.throttleVertical).toBe(false);
		expect(compactTouch.throttle.y).toBeGreaterThanOrEqual(compact.alert.y + compact.alert.height);
		expect(compact.status.y).toBe(compactTouch.throttle.y);
		expect(compactTouch.joystick.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
		expect(compactTouch.target.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

		const normalPhone = getHudLayout(568, 320, "touch").touch!;
		expect(normalPhone.throttleVertical).toBe(true);
		expect(normalPhone.joystick.width).toBe(112);
		expect(normalPhone.missile.width).toBe(72);
		expect(normalPhone.target.width).toBe(52);
	});

	it("keeps keyboard and gamepad hints clear of the status readout", () => {
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			for (const [width, height] of [...VIEWPORTS, [480, 320] as [number, number]]) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.hints).toBeDefined();
				expectSeparate([layout.hints!, layout.status, layout.alert, layout.callout, layout.timer]);
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

	it("keeps the objective panel compact in the top-left corner", () => {
		for (const [width, height] of [...VIEWPORTS, ...PHONE_LANDSCAPE]) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.callout.x).toBe(layout.margin);
				expect(layout.callout.width).toBeLessThanOrEqual(340);
				expect(layout.callout.height).toBeLessThanOrEqual(62);
				expect(layout.callout.width).toBeGreaterThanOrEqual(150);
			}
		}
	});

	it("keeps the objective panel under 42% of a landscape phone's width", () => {
		for (const [width, height] of PHONE_LANDSCAPE) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				expect(getHudLayout(width, height, mode).callout.width).toBeLessThanOrEqual(width * 0.42);
			}
		}
	});

	it("shows the mission clock as a small separate chip in the top-right corner", () => {
		for (const [width, height] of [...VIEWPORTS, ...PHONE_LANDSCAPE, [319, 181] as [number, number]]) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				expect(layout.timer.width).toBeLessThanOrEqual(64);
				expect(layout.timer.height).toBeLessThanOrEqual(24);
				expect(layout.timer.x + layout.timer.width).toBe(width - layout.margin);
				expect(layout.timer.y).toBe(layout.margin);
				expect(rectanglesOverlap(layout.timer, layout.callout)).toBe(false);
			}
		}
	});

	it("reserves nothing over the centre of the flight view where enemies and the target bracket appear", () => {
		for (const [width, height] of [...VIEWPORTS, ...PHONE_LANDSCAPE]) {
			if (isCompactHud(width, height)) continue;
			const centre: Rectangle = { x: width * 0.3, y: height * 0.12, width: width * 0.4, height: height * 0.43 };
			const box = getHudCentreBox(width, height);
			expect(box.x).toBeLessThanOrEqual(centre.x);
			expect(box.x + box.width).toBeGreaterThanOrEqual(centre.x + centre.width);
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				const rectangles = [layout.callout, layout.timer, layout.alert, layout.status];
				if (layout.hints) rectangles.push(layout.hints);
				if (layout.touch) rectangles.push(layout.touch.joystick, layout.touch.throttle, layout.touch.missile, layout.touch.target);
				for (const rectangle of rectangles) expect(rectanglesOverlap(rectangle, centre)).toBe(false);
			}
		}
	});

	it("keeps the warning a small pill clear of the objective and every touch control", () => {
		for (const [width, height] of [...VIEWPORTS, ...PHONE_LANDSCAPE, [319, 181] as [number, number]]) {
			for (const mode of ["touch", "keyboard", "gamepad"] as InputMode[]) {
				const layout = getHudLayout(width, height, mode);
				const alert = layout.alert;
				expect(alert.width).toBeLessThanOrEqual(220);
				expect(alert.width).toBeGreaterThanOrEqual(math.min(160, width - layout.margin * 2));
				expect(alert.height).toBeGreaterThanOrEqual(24);
				expect(alert.height).toBeLessThanOrEqual(30);
				expect(rectanglesOverlap(alert, layout.callout)).toBe(false);
				expect(rectanglesOverlap(alert, layout.timer)).toBe(false);
				const touch = layout.touch;
				if (touch) for (const control of [touch.joystick, touch.throttle, touch.missile, touch.target]) expect(rectanglesOverlap(alert, control)).toBe(false);
				if (isCompactHud(width, height)) {
					// No bottom lane fits at 320x182: stack directly under the objective.
					expect(alert.y).toBeGreaterThanOrEqual(layout.callout.y + layout.callout.height);
				} else {
					// Otherwise it lives below the target-bracket region, by the controls.
					expect(alert.y).toBeGreaterThanOrEqual(height * 0.55);
				}
			}
		}
	});

	it("puts the touch warning in the bottom lane between the control clusters on landscape phones", () => {
		for (const [width, height] of PHONE_LANDSCAPE) {
			const layout = getHudLayout(width, height, "touch");
			const touch = layout.touch!;
			expect(layout.alert.y + layout.alert.height).toBe(height - layout.margin);
			const laneLeft = math.max(touch.joystick.x + touch.joystick.width, touch.throttle.x + touch.throttle.width);
			const laneRight = math.min(touch.target.x, touch.missile.x, layout.status.x);
			expect(layout.alert.x - laneLeft).toBeGreaterThanOrEqual(8);
			expect(laneRight - (layout.alert.x + layout.alert.width)).toBeGreaterThanOrEqual(8);
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
	it("uses actual short safe height and keeps a pressable slot and footer",()=>{
		for(const [width,height] of [[319,181],[320,182]]) {
			const menu=getMenuLayout(width,height);
			expect(rectangleInside(menu.panel,width,height,6)).toBe(true);
			expect(getSlotListHeight(menu.panel.height,true)).toBeGreaterThanOrEqual(44);
			expect(34+getSlotListHeight(menu.panel.height,true)+12+44).toBeLessThanOrEqual(menu.panel.height);
		}
	});
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
			expectSeparate([missionToast, hud.alert, hud.callout, hud.timer]);
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
