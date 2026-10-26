import { describe, expect, it } from "@rbxts/jest-globals";

import { EvadeRules } from "../shared/EvadeRules";
import { hudTextWidth, STATUS_SEPARATOR, STATUS_SEPARATOR_TIGHT, statusLine } from "../shared/HudInstruments";
import { effectiveHudScale } from "../shared/PlayerSettings";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { WeaponRules } from "../shared/WeaponRules";
import {
	ACTION_BUTTON_SIZE,
	FIRE_CAPTION_HEIGHT,
	hudObstacles,
	PAUSE_SIZE,
	RADAR_LARGE_SIZE,
	RADAR_MAX_SIZE,
	RADAR_MIN_SIZE,
	STATUS_GAP,
	STATUS_MIN_WIDTH,
	STATUS_TEXT_PAD,
	getHudScale,
	STICK_MAX_SIZE,
	STICK_MIN_SIZE,
	getEvadeHint,
	getFlightHints,
	getSpecialHint,
	getHudCentreBox,
	getHudLayout,
	getKillMarkerLayout,
	KILL_MARKER_MIN_WIDTH,
	MIN_PHYSICAL_TEXT,
	minHudTextSize,
	getMenuHintsLayout,
	getMenuLayout,
	getMenuSceneOpening,
	getPauseLayout,
	getSettingsLayout,
	SETTINGS_ROWS,
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
const STICK_SIZES = [STICK_MIN_SIZE, JOYSTICK_SIZE, STICK_MAX_SIZE];

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

// Roots the text-floor check sweeps: 667x375, 800x390 (844x390 after its notch), 706x267, 568x320, Studio's 320x182 and 1920x854.
const TEXT_FLOOR_ROOTS: [number, number][] = [
	[667, 375],
	[800, 390],
	[706, 267],
	[568, 320],
	[320, 182],
	[1920, 854],
];

/** Glyphs, not UTF-8 bytes ("·" is two). */
function glyphs(text: string): number {
	const [count] = utf8.len(text);
	return typeIs(count, "number") ? count : text.size();
}

/** Every ammo line the game can show: each special, every missile, charge and evade count, idle or running. */
function ammoLines(separator: string): string[] {
	const lines: string[] = [];
	for (const special of SpecialWeapons.All()) {
		for (let missiles = 0; missiles <= WeaponRules.MaxMissiles; missiles++) for (let charges = 0; charges <= special.charges; charges++) {
			for (const active of [0, 7.2]) for (let evades = 0; evades <= EvadeRules.MaxCharges; evades++) {
				const cells = statusLine({ missiles, missileCooldown: 0, special: special.short, specialCharges: charges, specialCooldown: 0, specialActive: active, evadeCharges: evades });
				lines.push(cells.map((cell) => cell.text).join(separator));
			}
		}
	}
	return lines;
}

describe("mission HUD layout", () => {
	it("separates touch hit regions, navigation, warnings and toasts around breakpoints, at every stick size", () => {
		for (const width of [319,320,321,349,350,351,359,360,361,390,560]) for (const height of [160,161,175,176,177,179,180,181,199,200,201,202,239,240,241,568]) for (const stickSize of STICK_SIZES) {
			const hud=getHudLayout(width,height,"touch",{stickSize});
			expectSeparate(hudRectangles(hud));
			// A toast with no free slot borrows the alert lane (it is transient); it never covers anything else.
			const toast=getToastLayout(width,height,undefined,"touch",{stickSize});
			const borrowed=sameRectangle(toast,hud.alert);
			for(const rect of hudRectangles(hud)) if(!(borrowed && sameRectangle(rect,hud.alert))) expect(rectanglesOverlap(toast,rect)).toBe(false);
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

	it("uses compact type on Studio roots, regular on phones and large from 900x600", () => {
		for (const [width, height] of [...COMPACT_VIEWPORTS, [320, 240]] as [number, number][]) expect(getHudScale(width, height)).toBe("compact");
		for (const [width, height] of [[560, 240], [667, 375], [706, 267], [750, 332], [800, 390], [844, 390], [390, 705], [390, 844]] as [number, number][]) expect(getHudScale(width, height)).toBe("regular");
		for (const [width, height] of [[1024, 768], [1280, 720], [1920, 854], [1920, 1080]] as [number, number][]) expect(getHudScale(width, height)).toBe("large");
		for (const [width, height] of [...HUD_VIEWPORTS, ...KEY_VIEWPORTS]) {
			const metrics = getHudLayout(width, height, "touch").metrics;
			expect(metrics.scale).toBe(getHudScale(width, height));
			expect(metrics.text).toBeGreaterThanOrEqual(10);
			expect(metrics.row).toBeGreaterThan(metrics.text);
		}
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

	it("stays separate and on screen at every HUD scale the settings allow", () => {
		for (const [width, height] of [...KEY_VIEWPORTS, [844, 390], [706, 267], [750, 332]] as [number, number][]) for (const mode of MODES) {
			for (let requested = 0.8; requested <= 1.3001; requested += 0.1) {
				const scale = effectiveHudScale(requested, mode === "touch", width, height);
				const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
				const layout = getHudLayout(virtualWidth, virtualHeight, mode, { scale });
				expectSeparate(hudRectangles(layout));
				for (const rectangle of hudRectangles(layout)) expect(rectangleInside(rectangle, virtualWidth, virtualHeight, layout.margin)).toBe(true);
			}
		}
	});

	it("draws every HUD label at 8 px or more after the HUD scale, and fits every ammo line on one row", () => {
		expect(MIN_PHYSICAL_TEXT).toBe(8);
		expect(minHudTextSize(0.8)).toBe(10);
		expect(minHudTextSize(0.9)).toBe(9);
		expect(minHudTextSize(1)).toBe(8);
		expect(minHudTextSize(1.3)).toBe(7);
		// The longest line each separator can produce, in glyphs; "MSL 8 · UAV ON · EVD 3" and "MSL 8 · 4AAM 3 · EVD 3" are among them.
		const longest = new Map<string, number>();
		for (const separator of [STATUS_SEPARATOR, STATUS_SEPARATOR_TIGHT]) {
			const lines = ammoLines(separator);
			expect(lines.includes(`MSL 8${separator}UAV ON${separator}EVD 3`)).toBe(true);
			expect(lines.includes(`MSL 8${separator}4AAM 3${separator}EVD 3`)).toBe(true);
			let chars = 0;
			for (const line of lines) chars = math.max(chars, glyphs(line));
			longest.set(separator, chars);
		}
		let smallest = math.huge;
		for (const [width, height] of TEXT_FLOOR_ROOTS) for (const mode of MODES) for (const stickSize of mode === "touch" ? STICK_SIZES : [JOYSTICK_SIZE]) {
			for (let requested = 0.8; requested <= 1.3001; requested += 0.1) {
				const scale = effectiveHudScale(requested, mode === "touch", width, height);
				const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
				const layout = getHudLayout(virtualWidth, virtualHeight, mode, { stickSize, scale });
				const metrics = layout.metrics;
				const status = layout.status;
				// Instrument captions and values, the clock, warnings, radar letters, the shrink-to-fit floor and the ammo line.
				for (const size of [metrics.text, metrics.label, metrics.instrumentText, metrics.instrumentLabel, metrics.minText, status.text]) {
					smallest = math.min(smallest, size * scale);
					expect(size * scale).toBeGreaterThanOrEqual(MIN_PHYSICAL_TEXT - 1e-6);
				}
				// Rows hold their text; the SPEED/ALT caption fits beside the arrow tag.
				expect(metrics.caption).toBeGreaterThanOrEqual(metrics.instrumentLabel);
				expect(metrics.box).toBeGreaterThanOrEqual(metrics.instrumentText);
				expect(status.line.height).toBeGreaterThanOrEqual(status.text);
				for (const instrument of [layout.speed, layout.altitude]) {
					if (instrument.height < metrics.caption + metrics.box) continue;
					expect(hudTextWidth(5, metrics.instrumentLabel)).toBeLessThanOrEqual(instrument.width - math.floor(metrics.box / 2));
				}
				// RobotoMono advances 1229/2048 em per glyph: the longest line fits the label at the size the layout picked.
				expect(status.separator === STATUS_SEPARATOR || status.separator === STATUS_SEPARATOR_TIGHT).toBe(true);
				expect(hudTextWidth(longest.get(status.separator)!, status.text)).toBeLessThanOrEqual(status.line.width - STATUS_TEXT_PAD);
				// The larger type never costs the separation or safe-margin invariants.
				expectSeparate(hudRectangles(layout));
				for (const rectangle of hudRectangles(layout)) expect(rectangleInside(rectangle, virtualWidth, virtualHeight, layout.margin)).toBe(true);
			}
		}
		expect(smallest).toBeGreaterThanOrEqual(MIN_PHYSICAL_TEXT - 1e-6);
	});

	it("keeps the spaced ammo line where it fits at full size and tightens it on Studio's 320x182", () => {
		expect(getHudLayout(667, 375, "touch").status.separator).toBe(STATUS_SEPARATOR);
		expect(getHudLayout(1920, 854, "keyboard").status.separator).toBe(STATUS_SEPARATOR);
		const studio = getHudLayout(320, 182, "touch").status;
		expect(studio.separator).toBe(STATUS_SEPARATOR_TIGHT);
		expect(studio.text).toBe(8);
		// HUD SCALE 80% on keyboard: 10 px of layout type (8 px drawn) and a wider panel to hold it.
		const scaled = getHudLayout(400, 227, "keyboard", { scale: 0.8 });
		expect(scaled.metrics.instrumentLabel).toBe(10);
		expect(scaled.status.text).toBe(10);
		expect(scaled.status.line.width).toBeGreaterThanOrEqual(math.ceil(hudTextWidth(19, 10)));
		const phone = getHudLayout(833, 468, "keyboard", { scale: 0.8 });
		expect(phone.metrics.instrumentLabel).toBe(10);
		expect(phone.metrics.caption).toBe(11);
	});

	it("lays out touch controls only for touch input", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS]) {
			expect(getHudLayout(width, height, "touch").touch).toBeDefined();
			expect(getHudLayout(width, height, "keyboard").touch).toBeUndefined();
			expect(getHudLayout(width, height, "gamepad").touch).toBeUndefined();
		}
	});

	it("uses four same-size action buttons, at least 44px, and smaller sticks", () => {
		expect(JOYSTICK_SIZE).toBe(80);
		expect(ACTION_BUTTON_SIZE).toBe(54);
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			expect(touch.joystick.width).toBe(JOYSTICK_SIZE);
			expect(touch.joystick.height).toBe(JOYSTICK_SIZE);
			for (const button of [touch.missile, touch.target, touch.special, touch.evade]) {
				expect(button.width).toBe(touch.button);
				expect(button.height).toBe(touch.button);
			}
			// The row is always full size; the Studio-sized grid uses the 44 px minimum.
			if (touch.arrangement === "row") expect(touch.button).toBe(ACTION_BUTTON_SIZE);
			else if (getHudScale(width, height) === "compact") expect(touch.button).toBe(MIN_TOUCH_TARGET);
			for (const control of [touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade]) {
				expect(control.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
				expect(control.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			}
			expect(touch.throttle.width).toBe(JOYSTICK_SIZE);
			expect(touch.throttle.height).toBe(JOYSTICK_SIZE);
			expect(touch.throttle.x).toBeGreaterThan(width / 2);
			expect(touch.throttle.y).toBe(touch.joystick.y);
		}
	});

	it("puts TGT, FIRE, SPECIAL and EVADE in one evenly spaced row on one baseline, centred between the sticks", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const stickSize of STICK_SIZES) {
			const layout = getHudLayout(width, height, "touch", { stickSize });
			const touch = layout.touch!;
			// Only Studio-sized roots and narrow portrait roots fall back to the 2x2 grid.
			if (getHudScale(width, height) !== "compact" && width > height) expect(touch.arrangement).toBe("row");
			if (touch.arrangement !== "row") continue;
			const row = [touch.target, touch.missile, touch.special, touch.evade];
			const spacing = row[1].x - (row[0].x + row[0].width);
			expect(spacing).toBeGreaterThanOrEqual(6);
			for (let index = 0; index < row.size(); index++) {
				expect(row[index].y + row[index].height).toBe(height - layout.margin);
				if (index > 0) expect(row[index].x - (row[index - 1].x + row[index - 1].width)).toBe(spacing);
			}
			const left = row[0].x - (touch.joystick.x + touch.joystick.width);
			const right = touch.throttle.x - (row[3].x + row[3].width);
			expect(math.abs(left - right)).toBeLessThanOrEqual(1);
		}
	});

	it("puts TIME and progress top-left right of PAUSE, and the objective (two short lines) beside them", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const clock = layout.clock;
				expect(clock.x).toBe(layout.pause ? layout.pause.x + layout.pause.width + 8 : layout.margin);
				expect(clock.y).toBe(layout.margin);
				// Two rows: TIME, then the objective count.
				expect(clock.height).toBe(layout.metrics.row * 2 + 2);
				expect(layout.callout.x).toBe(clock.x + clock.width + (layout.metrics.scale === "compact" ? 6 : 8));
				expect(layout.callout.y).toBe(layout.margin);
				expect(layout.callout.width).toBeLessThanOrEqual(width * 0.38);
				expect(layout.callout.height).toBeLessThanOrEqual(layout.metrics.scale === "large" ? layout.metrics.row * 2 + 2 : OBJECTIVE_LINE_HEIGHT);
			}
		}
	});

	it("puts the throttle captions outside the disc, centred above and below it", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS].filter(([w, h]) => getHudScale(w, h) !== "compact")) {
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

	it("keeps the top row, radar, status panel and hints out of the forward view on landscape roots", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, [568, 320], [1024, 768], [1920, 1080], ...KEY_VIEWPORTS].filter(([w, h]) => w > h && h > COMPACT_MAX_HEIGHT) as [number, number][]) {
			const centre = getHudCentreBox(width, height);
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				// Only the centre instruments, the radio subtitle and the navigation cue's slot may enter it.
				const outside = [layout.clock, layout.callout, layout.status.frame];
				for (const optional of [layout.pause, layout.radar, layout.hints]) if (optional) outside.push(optional);
				for (const rectangle of outside) expect(rectanglesOverlap(rectangle, centre)).toBe(false);
				expect(rectanglesOverlap(getToastLayout(width, height, undefined, mode), centre)).toBe(false);
			}
		}
	});

	it("centres the reticle between SPEED (left) and ALT (right), with the warning and break cue under it", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS].filter(([w, h]) => getHudScale(w, h) !== "compact")) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const reticle = layout.reticle!;
			const centreX = reticle.x + reticle.width / 2;
			const centreY = reticle.y + reticle.height / 2;
			expect(math.abs(centreX - width / 2)).toBeLessThanOrEqual(1);
			// Same row, mirrored about the reticle, tags pointing at it.
			expect(layout.speed.y).toBe(layout.altitude.y);
			expect(layout.speed.width).toBe(layout.altitude.width);
			expect(layout.speed.x + layout.speed.width).toBeLessThanOrEqual(reticle.x);
			expect(layout.altitude.x).toBeGreaterThanOrEqual(reticle.x + reticle.width);
			expect(centreX - (layout.speed.x + layout.speed.width)).toBe(layout.altitude.x - centreX);
			// The box (under its caption row) is level with the reticle.
			const boxCentre = layout.speed.y + layout.metrics.caption + layout.metrics.box / 2;
			expect(math.abs(boxCentre - centreY)).toBeLessThanOrEqual(1);
			// Warning box under the reticle, the break-cue row directly under it, both centred.
			expect(layout.alert.y).toBeGreaterThanOrEqual(reticle.y + reticle.height);
			expect(math.abs(layout.alert.x + layout.alert.width / 2 - centreX)).toBeLessThanOrEqual(1);
			expect(layout.breakCue.y).toBe(layout.alert.y + layout.alert.height + 2);
			expect(layout.breakCue.x).toBe(layout.alert.x);
			expect(layout.breakCue.width).toBe(layout.alert.width);
			expect(layout.alert.width).toBeGreaterThanOrEqual(110);
		}
		// Roots with room keep the reticle at the exact centre.
		for (const [width, height] of [[667, 375], [800, 390], [844, 390], [1920, 854], [1280, 720]] as [number, number][]) for (const mode of MODES) {
			const reticle = getHudLayout(width, height, mode).reticle!;
			expect(reticle.y + reticle.height / 2).toBe(math.floor(height / 2));
		}
	});

	it("puts SPEED and ALT over the action grid on the Studio compact root, sharing rows where it must", () => {
		const studio = getHudLayout(320, 182, "touch");
		expect(studio.reticle).toBeUndefined();
		expect(studio.speed.x).toBe(studio.touch!.target.x);
		expect(studio.altitude.x).toBe(studio.touch!.special.x);
		expect(studio.speed.y + studio.speed.height).toBeLessThanOrEqual(studio.touch!.target.y);
		expect(studio.breakCue).toBe(studio.alert);
		expect(studio.alert.y + studio.alert.height).toBeLessThanOrEqual(studio.speed.y);
		// The shortest roots drop the caption row, then share the warning with the objective line.
		for (const [width, height] of COMPACT_VIEWPORTS) {
			const layout = getHudLayout(width, height, "touch");
			if (layout.touch!.arrangement !== "grid") continue;
			expect(layout.speed.height).toBeGreaterThanOrEqual(layout.metrics.box);
			if (layout.alert !== layout.callout) expect(layout.alert.y).toBeGreaterThanOrEqual(layout.callout.y + layout.callout.height);
		}
		const shortest = getHudLayout(320, 160, "touch");
		expect(shortest.alert).toBe(shortest.callout);
	});

	it("puts a square radar at the bottom of the left column: above the stick on touch, in the corner otherwise", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const radar = layout.radar;
			if (!radar) continue;
			expect(radar.width).toBe(radar.height);
			expect(radar.width).toBeGreaterThanOrEqual(RADAR_MIN_SIZE);
			expect(radar.width).toBeLessThanOrEqual(layout.metrics.scale === "large" ? RADAR_LARGE_SIZE : RADAR_MAX_SIZE);
			if (layout.radarPlacement === "column") {
				expect(radar.x).toBe(layout.margin);
				const gap = layout.metrics.scale === "compact" ? 6 : 8;
				expect(radar.y + radar.height).toBe(layout.touch ? layout.touch.joystick.y - gap : height - layout.margin);
			} else {
				expect(radar.x + radar.width).toBe(width - layout.margin);
				expect(radar.y).toBe(layout.margin);
			}
		}
		// Every real phone and desktop root gets the bottom-left scope.
		for (const [width, height] of [[667, 375], [800, 390], [844, 390], [750, 332], [706, 267], [1920, 854], [1280, 720], [390, 705]] as [number, number][]) {
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				if (mode !== "touch" && width < height) continue;
				expect(layout.radarPlacement).toBe("column");
			}
		}
		expect(getHudLayout(1920, 854, "keyboard").radar!.width).toBe(RADAR_LARGE_SIZE);
		expect(getHudLayout(800, 390, "touch").radar!.width).toBe(RADAR_MAX_SIZE);
		// The 320x182 Studio root has no slot for a scope.
		expect(getHudLayout(320, 182, "touch").radar).toBeUndefined();
	});

	it("puts the hull bar and its one ammo line at the bottom of the right column", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const status = layout.status;
			expect(status.frame.x + status.frame.width).toBe(width - layout.margin);
			expect(status.frame.width).toBeGreaterThanOrEqual(math.min(STATUS_MIN_WIDTH, width - layout.margin * 2));
			// The bar on top, the line directly under it, both the panel's width.
			expect(status.bar).toEqual({ x: status.frame.x, y: status.frame.y, width: status.frame.width, height: status.bar.height });
			expect(status.line.y).toBe(status.bar.y + status.bar.height + STATUS_GAP);
			expect(status.line.x).toBe(status.frame.x);
			expect(status.line.width).toBe(status.frame.width);
			expect(status.line.y + status.line.height).toBe(status.frame.y + status.frame.height);
			expect(status.bar.height).toBeLessThanOrEqual(8);
			expect(status.text).toBeGreaterThanOrEqual(8);
			expect(status.text).toBeLessThanOrEqual(status.line.height);
		}
		// Phones and desktops: right above the throttle caption on touch, the bottom-right corner otherwise.
		for (const [width, height] of [[667, 375], [800, 390], [844, 390], [750, 332], [706, 267], [568, 320], [1920, 854], [1280, 720]] as [number, number][]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const bottom = layout.status.frame.y + layout.status.frame.height;
			if (layout.touch) expect(bottom).toBe(layout.touch.throttleUpLabel!.y - 8);
			else expect(bottom).toBe(height - layout.margin);
		}
	});

	it("keeps the touch buttons along the bottom, clear of the radar and the status panel", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const stickSize of STICK_SIZES) {
			const layout = getHudLayout(width, height, "touch", { stickSize });
			const touch = layout.touch!;
			expect(touch.missile.y + touch.missile.height).toBe(height - layout.margin);
			for (const button of [touch.missile, touch.target, touch.special, touch.evade, touch.joystick, touch.throttle]) {
				expect(rectanglesOverlap(button, layout.status.frame)).toBe(false);
				if (layout.radar) expect(rectanglesOverlap(button, layout.radar)).toBe(false);
			}
		}
	});

	it("lays the radio subtitle bottom-centre, above the buttons or hint row and under the break cue", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const subtitle = layout.subtitle;
			if (!subtitle) continue;
			expect(math.abs(subtitle.x + subtitle.width / 2 - width / 2)).toBeLessThanOrEqual(1);
			expect(subtitle.y).toBeGreaterThanOrEqual(layout.breakCue.y + layout.breakCue.height);
			expect(subtitle.height % layout.metrics.row).toBe(0);
			// Above every button (and the hint row) it shares columns with; wide roots keep it level with a right-hand button row.
			for (const below of [...(layout.touch ? [layout.touch.target, layout.touch.missile, layout.touch.special, layout.touch.evade] : []), ...(layout.fireCaption ? [layout.fireCaption] : []), ...(layout.hints ? [layout.hints] : [])]) {
				if (below.x < subtitle.x + subtitle.width && below.x + below.width > subtitle.x) expect(subtitle.y + subtitle.height).toBeLessThanOrEqual(below.y);
			}
		}
		for (const [width, height] of [[667, 375], [800, 390], [844, 390], [1920, 854], [1280, 720]] as [number, number][]) for (const mode of MODES) {
			expect(getHudLayout(width, height, mode).subtitle!.height).toBe(getHudLayout(width, height, mode).metrics.row * 2);
		}
		// The Studio compact root has no row for it: radio shares the objective line there.
		expect(getHudLayout(320, 182, "touch").subtitle).toBeUndefined();
	});

	it("puts the kill callout in the top row right of the objective, clear of every HUD element and the forward view", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS].filter(([w, h]) => w > h && getHudScale(w, h) !== "compact")) {
			const centre = getHudCentreBox(width, height);
			for (const mode of MODES) {
				const layout = getHudLayout(width, height, mode);
				const marker = getKillMarkerLayout(width, height, mode);
				expect(rectangleInside(marker, width, height, layout.margin)).toBe(true);
				expect(marker.width).toBeGreaterThanOrEqual(KILL_MARKER_MIN_WIDTH);
				expect(rectanglesOverlap(marker, centre)).toBe(false);
				for (const rectangle of hudRectangles(layout)) expect(rectanglesOverlap(marker, rectangle)).toBe(false);
				expect(marker.y).toBe(layout.margin);
				expect(marker.x).toBeGreaterThan(layout.callout.x + layout.callout.width);
			}
		}
	});

	it("keeps the kill callout on screen on Studio-sized roots, borrowing the alert lane when no slot fits", () => {
		for (const [width, height] of [...COMPACT_VIEWPORTS, [320, 240]] as [number, number][]) for (const mode of MODES) {
			const layout = getHudLayout(width, height, mode);
			const marker = getKillMarkerLayout(width, height, mode);
			expect(rectangleInside(marker, width, height, layout.margin)).toBe(true);
			if (sameRectangle(marker, layout.alert)) continue;
			for (const rectangle of hudRectangles(layout)) expect(rectanglesOverlap(marker, rectangle)).toBe(false);
		}
	});

	it("keeps combat buttons in the lane between independent sticks", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			const layout = getHudLayout(width, height, "touch");
			const touch = layout.touch!;
			for (const button of [touch.missile, touch.target, touch.special, touch.evade]) {
				expect(button.x).toBeGreaterThan(touch.joystick.x + touch.joystick.width);
				expect(button.x + button.width).toBeLessThan(touch.throttle.x);
			}
			expectSeparate([layout.alert, touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade]);
		}
	});

	it("puts EVADE on the right-thumb side: the end of the row nearest the throttle", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) for (const stickSize of STICK_SIZES) {
			const touch = getHudLayout(width, height, "touch", { stickSize }).touch!;
			expect(touch.evade.x + touch.evade.width / 2).toBeGreaterThan(width / 2);
			if (touch.arrangement === "row") {
				for (const other of [touch.missile, touch.target, touch.special]) expect(other.x).toBeLessThan(touch.evade.x);
				expect(touch.evade.y).toBe(touch.missile.y);
			} else {
				// Grid: bottom-right cell, beside FIRE.
				expect(touch.evade.y).toBe(touch.missile.y);
				expect(touch.evade.x).toBeGreaterThan(touch.missile.x);
			}
		}
		// Every real phone root gets the full-size button.
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [800, 390], [667, 375], [568, 320], [390, 705], [1920, 854]] as [number, number][]) {
			expect(getHudLayout(width, height, "touch").touch!.evade.width).toBe(ACTION_BUTTON_SIZE);
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
			if (layout.metrics.scale === "compact") { expect(layout.pause).toBeUndefined(); continue; }
			const pause = layout.pause!;
			expect(pause.x).toBe(layout.margin);
			expect(pause.y).toBe(layout.margin);
			if (mode === "touch") expect(pause.width).toBe(PAUSE_SIZE);
			expect(pause.width).toBe(pause.height);
			expect(rectangleInside(pause, width, height, layout.margin)).toBe(true);
		}
		for (const [width, height] of COMPACT_VIEWPORTS) expect(getHudLayout(width, height, "touch").pause).toBeUndefined();
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

	it("matches the agreed numbers on the key roots", () => {
		const studio = getHudLayout(320, 182, "touch");
		expect(studio.touch!.arrangement).toBe("grid");
		expect(studio.touch!.evade).toEqual({ x: 163, y: 132, width: 44, height: 44 });
		expect(studio.touch!.missile).toEqual({ x: 113, y: 132, width: 44, height: 44 });
		expect(studio.speed).toEqual({ x: 113, y: 54, width: 44, height: 22 });
		expect(studio.alert).toEqual({ x: 113, y: 34, width: 94, height: 18 });
		expect(studio.status.frame).toEqual({ x: 214, y: 72, width: 100, height: 18 });
		const se = getHudLayout(667, 375, "touch");
		expect(se.touch!.arrangement).toBe("row");
		expect(se.touch!.joystick).toEqual({ x: 14, y: 269, width: 80, height: 80 });
		expect(se.touch!.target).toEqual({ x: 207, y: 307, width: 54, height: 54 });
		expect(se.touch!.missile).toEqual({ x: 273, y: 307, width: 54, height: 54 });
		expect(se.touch!.special).toEqual({ x: 339, y: 307, width: 54, height: 54 });
		expect(se.touch!.evade).toEqual({ x: 405, y: 307, width: 54, height: 54 });
		expect(se.pause).toEqual({ x: 14, y: 14, width: 44, height: 44 });
		expect(se.clock).toEqual({ x: 66, y: 14, width: 96, height: 30 });
		expect(se.radar).toEqual({ x: 14, y: 151, width: 110, height: 110 });
		expect(se.status).toEqual({
			frame: { x: 509, y: 228, width: 144, height: 21 },
			bar: { x: 509, y: 228, width: 144, height: 6 },
			line: { x: 509, y: 237, width: 144, height: 12 },
			text: 10,
			separator: STATUS_SEPARATOR,
		});
		expect(se.reticle).toEqual({ x: 321, y: 175, width: 24, height: 24 });
		expect(se.speed).toEqual({ x: 190, y: 170, width: 50, height: 25 });
		expect(se.altitude).toEqual({ x: 426, y: 170, width: 50, height: 25 });
		expect(se.subtitle).toEqual({ x: 113, y: 261, width: 440, height: 28 });
		const notched = getHudLayout(800, 390, "touch");
		expect(notched.touch!.evade).toEqual({ x: 472, y: 322, width: 54, height: 54 });
		expect(notched.radar).toEqual({ x: 14, y: 166, width: 110, height: 110 });
		expect(notched.status.frame).toEqual({ x: 642, y: 243, width: 144, height: 21 });
		expect(notched.alert).toEqual({ x: 290, y: 211, width: 220, height: 20 });
		expect(notched.breakCue).toEqual({ x: 290, y: 233, width: 220, height: 16 });
		const desktop = getHudLayout(1920, 854, "keyboard");
		expect(desktop.radar).toEqual({ x: 22, y: 662, width: 170, height: 170 });
		expect(desktop.status.frame).toEqual({ x: 1706, y: 805, width: 192, height: 27 });
		expect(desktop.hints).toEqual({ x: 780, y: 812, width: 360, height: 20 });
		expect(desktop.subtitle).toEqual({ x: 640, y: 764, width: 640, height: 44 });
		expect(desktop.pause).toEqual({ x: 22, y: 22, width: 32, height: 32 });
		expect(desktop.speed).toEqual({ x: 616, y: 403, width: 76, height: 36 });
		// The 706x267 iPhone root: a smaller scope still fits under PAUSE.
		const phone = getHudLayout(706, 267, "touch");
		expect(phone.radar).toEqual({ x: 10, y: 77, width: 80, height: 80 });
		expect(phone.status.frame).toEqual({ x: 552, y: 124, width: 144, height: 21 });
	});

	it("draws SPEED and ALT about 20% smaller than PR #44 (box, arrow tag and type)", () => {
		const phone = getHudLayout(667, 375, "touch");
		// PR #44: 62 wide, 11 px caption row, 20 px box, 12/10pt type.
		expect(phone.speed.width).toBe(50);
		expect(phone.metrics.caption).toBe(9);
		expect(phone.metrics.box).toBe(16);
		expect(phone.metrics.instrumentText).toBe(10);
		expect(phone.metrics.instrumentLabel).toBe(8);
		// PR #44: 96 wide, 15 + 30 px, 18/13pt type.
		const desktop = getHudLayout(1920, 854, "keyboard");
		expect(desktop.speed.width).toBe(76);
		expect(desktop.speed.height).toBe(36);
		expect(desktop.metrics.instrumentText).toBe(14);
		expect(desktop.metrics.instrumentLabel).toBe(10);
	});

	it("keeps keyboard and gamepad hints a short bottom-centre row", () => {
		for (const mode of ["keyboard", "gamepad"] as InputMode[]) {
			for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS]) {
				const layout = getHudLayout(width, height, mode);
				const hints = layout.hints!;
				expect(hints).toBeDefined();
				expect(hints.height).toBeLessThanOrEqual(20);
				expect(hints.width).toBeLessThanOrEqual(360);
				expect(hints.y + hints.height).toBe(height - layout.margin);
				expect(math.abs(hints.x + hints.width / 2 - width / 2)).toBeLessThanOrEqual(1);
			}
		}
	});

	it("keeps the touch controls, EVADE included, under 14% of a landscape phone screen (PR #44: 17%)", () => {
		for (const [width, height] of [[706, 267], [750, 332], [844, 390], [800, 390], [667, 375]] as [number, number][]) {
			const touch = getHudLayout(width, height, "touch").touch!;
			let area = touch.throttle.width * touch.throttle.height;
			for (const control of [touch.joystick, touch.missile, touch.target, touch.special, touch.evade]) area += control.width * control.height;
			expect(area / (width * height)).toBeLessThan(0.14);
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
			expectSeparate([missionToast, ...(sameRectangle(missionToast, hud.alert) ? [] : [hud.alert]), hud.callout, hud.clock, hud.status.frame]);
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

describe("pause card and settings sheet", () => {
	it("fits the pause card and its three 44 px buttons on every root", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			const pause = getPauseLayout(width, height);
			expect(rectangleInside(pause.panel, width, height, 6)).toBe(true);
			expect(pause.buttons.size()).toBe(3);
			for (const button of pause.buttons) {
				expect(button.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
				expect(rectangleInside(button, pause.panel.width, pause.panel.height, 0)).toBe(true);
			}
			expectSeparate([pause.title, ...pause.buttons]);
		}
	});
	it("fits the settings sheet, scrolling its rows when the root is short", () => {
		for (const [width, height] of [...HUD_VIEWPORTS, ...COMPACT_VIEWPORTS, ...VIEWPORTS, ...KEY_VIEWPORTS]) {
			const sheet = getSettingsLayout(width, height);
			expect(rectangleInside(sheet.panel, width, height, 6)).toBe(true);
			expect(sheet.control).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			expect(sheet.rowHeight).toBeGreaterThanOrEqual(sheet.control);
			expect(sheet.done.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
			expectSeparate([sheet.header, sheet.list, sheet.done]);
			for (const part of [sheet.header, sheet.list, sheet.done]) expect(rectangleInside(part, sheet.panel.width, sheet.panel.height, 0)).toBe(true);
			// Label + − value + fit on one row.
			expect(sheet.list.width - (sheet.control * 2 + sheet.valueWidth)).toBeGreaterThanOrEqual(100);
		}
		// Tall roots show every row without scrolling.
		const desktop = getSettingsLayout(1920, 854);
		expect(desktop.list.height).toBeGreaterThanOrEqual(desktop.rowHeight * SETTINGS_ROWS);
	});
});
