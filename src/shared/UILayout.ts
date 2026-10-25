// Kept pure and shared so ServerStorage-hosted Roblox Jest tests can import it.
export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type InputMode = "touch" | "gamepad" | "keyboard";

/** Smallest edge length, in pixels, for any on-screen touch control. */
export const MIN_TOUCH_TARGET = 44;

export interface TouchLayout {
	joystick: Rectangle;
	throttle: Rectangle;
	throttleVertical: boolean;
	missile: Rectangle;
	target: Rectangle;
}

export interface HudLayout {
	margin: number;
	/** Incoming-missile / airspace pill. Bottom-centre between the control clusters
	 * (or just above them when the lane is too narrow); stacked under the
	 * objective only on compact landscape viewports. */
	alert: Rectangle;
	/** Objective panel, anchored to the top-left of the CoreUI-safe area. */
	callout: Rectangle;
	/** Mission clock chip, top-right of the safe area. */
	timer: Rectangle;
	status: Rectangle;
	/** Keyboard and gamepad only; touch players read the controls themselves. */
	hints?: Rectangle;
	/** Touch only; never laid out for keyboard or gamepad play. */
	touch?: TouchLayout;
}

export type MenuMode = "side" | "sheet";

export interface MenuLayout {
	mode: MenuMode;
	compact: boolean;
	panel: Rectangle;
}

export interface ControlHint {
	/** Enum.KeyCode name for gamepad glyph lookup; absent for keyboard and mouse. */
	keyCode?: string;
	label: string;
	action: string;
}

export interface FlightHintContext {
	introduction: boolean;
	locked: boolean;
	missileReady: boolean;
}

const centered = (viewportWidth: number, width: number, y: number, height: number): Rectangle => ({
	x: math.floor((viewportWidth - width) / 2),
	y,
	width,
	height,
});

/** Widest the objective panel may grow on large screens. */
export const OBJECTIVE_MAX_WIDTH = 340;
export const TIMER_CHIP_WIDTH = 60;
export const TIMER_CHIP_HEIGHT = 22;
export const ALERT_MAX_WIDTH = 220;
export const ALERT_MIN_WIDTH = 160;

/**
 * Where enemies, the target bracket and the reticle live while flying: the
 * middle 40% of the width between 12% and 55% of the height. Nothing in the
 * mission HUD may be reserved here on regular (non-compact) viewports.
 */
export function getHudCentreBox(viewportWidth: number, viewportHeight: number): Rectangle {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const x = math.floor(width * 0.3);
	const y = math.floor(height * 0.12);
	return { x, y, width: math.ceil(width * 0.7) - x, height: math.ceil(height * 0.55) - y };
}

/** Landscape viewports too small for the regular touch layout (e.g. the 320x182 safe area). */
export function isCompactHud(viewportWidth: number, viewportHeight: number): boolean {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	return height <= width && (width < 360 || height < 280);
}

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode): HudLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const shortSafeArea = height < 240;
	const margin = shortSafeArea ? 6 : width < 700 || height < 420 ? 14 : 22;
	const gap = shortSafeArea ? 4 : 10;
	const compact = isCompactHud(width, height);
	const centre = getHudCentreBox(width, height);
	// The ScreenGui uses CoreUISafeInsets with the topbar inset applied, so the
	// origin is already below the Roblox system buttons and clear of any notch.
	// The clock is a small chip in the top-right corner of that safe area and
	// the objective is a compact panel in the top-left; neither spans the
	// forward view where enemies and the target bracket appear.
	const timer = { x: width - margin - TIMER_CHIP_WIDTH, y: margin, width: TIMER_CHIP_WIDTH, height: TIMER_CHIP_HEIGHT };
	const besideTimer = timer.x - gap - margin;
	let calloutWidth: number;
	let calloutHeight: number;
	if (compact) {
		// Every pixel counts at 320x182: use the whole row beside the clock.
		calloutWidth = besideTimer;
		calloutHeight = shortSafeArea ? 46 : 50;
	} else {
		// Eyebrow + two objective lines need 50px. If that would reach down into
		// the centre box (every landscape phone), the panel stops at the box's
		// left edge instead. Portrait has the room above the box to stay wide.
		const clearsCentre = height > width || margin + 50 <= centre.y;
		calloutWidth = math.min(OBJECTIVE_MAX_WIDTH, besideTimer, clearsCentre ? besideTimer : math.max(150, centre.x - margin));
		// Narrow panels (small landscape phones) get a third objective line.
		calloutHeight = calloutWidth < 200 ? 62 : 50;
	}
	const callout = { x: margin, y: margin, width: calloutWidth, height: calloutHeight };
	// Compact screens have no free bottom lane between the controls, so the
	// pill stacks under the objective there (as before) at a reduced width.
	const compactAlertHeight = shortSafeArea ? 24 : 28;
	const compactAlert = centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), callout.y + callout.height + gap, compactAlertHeight);
	const alertHeight = 28;

	if (inputMode === "touch") {
		const portrait = height > width;
		if (compact) {
			// At the 320x240 minimum, the usual vertical throttle and stacked status
			// compete with both the warning lane and the right-side target button.
			// Use two compact rows instead: throttle/status immediately below the
			// alert, then the primary controls along the bottom safe edge.
			const alert = compactAlert;
			const throttleLength = MIN_TOUCH_TARGET * 2 + 36;
			const upperRowY = alert.y + alert.height + gap;
			const throttle = { x: margin, y: upperRowY, width: throttleLength, height: MIN_TOUCH_TARGET };
			const statusWidth = 128;
			const statusHeight = 40;
			const status = { x: width - margin - statusWidth, y: upperRowY, width: statusWidth, height: statusHeight };
			const joystickSize = shortSafeArea ? MIN_TOUCH_TARGET : 64;
			const joystick = { x: margin, y: height - margin - joystickSize, width: joystickSize, height: joystickSize };
			const missileSize = shortSafeArea ? MIN_TOUCH_TARGET : 64;
			const missile = { x: width - margin - missileSize, y: height - margin - missileSize, width: missileSize, height: missileSize };
			const targetSize = MIN_TOUCH_TARGET;
			const target = { x: missile.x - 14 - targetSize, y: height - margin - targetSize, width: targetSize, height: targetSize };
			return { margin, alert, callout, timer, status, touch: { joystick, throttle, throttleVertical: false, missile, target } };
		}
		const joystickSize = portrait ? 120 : height < 420 ? 112 : 132;
		const joystick = { x: margin, y: height - margin - joystickSize, width: joystickSize, height: joystickSize };
		const throttleLength = MIN_TOUCH_TARGET * 2 + 36;
		const throttle = portrait
			? { x: margin, y: joystick.y - 10 - MIN_TOUCH_TARGET, width: math.max(joystickSize, throttleLength), height: MIN_TOUCH_TARGET }
			: { x: joystick.x + joystickSize + 10, y: height - margin - throttleLength, width: MIN_TOUCH_TARGET, height: throttleLength };
		const missileSize = height < 420 ? 72 : 84;
		const missile = { x: width - margin - missileSize, y: height - margin - missileSize, width: missileSize, height: missileSize };
		const targetSize = 52;
		const target = { x: missile.x - 12 - targetSize, y: missile.y - 6, width: targetSize, height: targetSize };
		const statusWidth = 128;
		const statusHeight = 40;
		const status = { x: width - margin - statusWidth, y: target.y - 10 - statusHeight, width: statusWidth, height: statusHeight };
		// The alert pill prefers the bottom lane between the left (stick/throttle)
		// and right (fire/target/status) clusters, far below the target bracket.
		// Portrait phones have no such lane, so it sits just above the controls.
		const laneLeft = math.max(joystick.x + joystick.width, throttle.x + throttle.width) + gap;
		const laneRight = math.min(target.x, missile.x, status.x) - gap;
		let alert: Rectangle;
		if (laneRight - laneLeft >= ALERT_MIN_WIDTH) {
			const alertWidth = math.min(ALERT_MAX_WIDTH, laneRight - laneLeft);
			const x = math.clamp(math.floor((width - alertWidth) / 2), laneLeft, laneRight - alertWidth);
			alert = { x, y: height - margin - alertHeight, width: alertWidth, height: alertHeight };
		} else {
			const controlsTop = math.min(joystick.y, throttle.y, missile.y, target.y, status.y);
			alert = centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), controlsTop - gap - alertHeight, alertHeight);
		}
		return { margin, alert, callout, timer, status, touch: { joystick, throttle, throttleVertical: !portrait, missile, target } };
	}

	const status = { x: width - margin - 150, y: height - margin - 40, width: 150, height: 40 };
	const besideStatus = width - 2 * (margin + status.width + 12);
	const hints = besideStatus >= 320
		? centered(width, math.min(720, besideStatus), height - margin - 30, 30)
		: centered(width, width - margin * 2, status.y - 10 - 30, 30);
	// Keyboard/gamepad: the pill sits directly above the hint row, which also
	// carries the EVADE prompt while a missile is inbound.
	const alert = compact ? compactAlert : centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), hints.y - 8 - alertHeight, alertHeight);
	return { margin, alert, callout, timer, status, hints };
}

/**
 * One panel shared by every menu screen. Landscape keeps it to the left so the
 * display aircraft stays visible on the right; portrait uses a bottom sheet.
 */
export function getMenuLayout(viewportWidth: number, viewportHeight: number): MenuLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	if (width >= height * 1.15) {
		const x = math.floor(math.clamp(width * 0.05, 20, 72));
		const panelWidth = math.floor(math.clamp(width * 0.36, 280, 440));
		const vertical = height < 240 ? 6 : height < 440 ? 14 : math.floor(math.clamp(height * 0.08, 24, 64));
		const panelHeight = math.min(height - vertical * 2, 460);
		return {
			mode: "side",
			compact: panelHeight < 400,
			panel: { x, y: math.floor((height - panelHeight) / 2), width: panelWidth, height: panelHeight },
		};
	}
	const margin = 16;
	const available = height - margin * 2;
	const panelHeight = math.floor(math.clamp(height * 0.62, math.min(340, available), math.min(460, available)));
	const panelWidth = math.min(width - margin * 2, 520);
	return {
		mode: "sheet",
		compact: panelHeight < 400,
		panel: { x: math.floor((width - panelWidth) / 2), y: height - margin - panelHeight, width: panelWidth, height: panelHeight },
	};
}

/** Status toasts stay clear of the menu panel, or of the mission alert lane when no menu is shown. */
export function getToastLayout(viewportWidth: number, viewportHeight: number, menu?: MenuLayout): Rectangle {
	const width = math.max(1, viewportWidth);
	const toastHeight = 44;
	if (menu?.mode === "side") {
		const left = menu.panel.x + menu.panel.width + 16;
		const toastWidth = math.min(380, width - left - 16);
		return { x: left + math.floor((width - left - 16 - toastWidth) / 2), y: 16, width: toastWidth, height: toastHeight };
	}
	if (menu) return centered(width, math.min(380, width - 28), 14, toastHeight);
	const hud = getHudLayout(viewportWidth, viewportHeight, "keyboard");
	// Below the top-row objective and clock; the alert only counts when it is
	// stacked up there too (compact screens), not in its bottom lane.
	const alertStackedOnTop = hud.alert.y + hud.alert.height <= math.max(1, viewportHeight) / 2;
	const bannerBottom = math.max(hud.callout.y + hud.callout.height, hud.timer.y + hud.timer.height, alertStackedOnTop ? hud.alert.y + hud.alert.height : 0);
	return centered(width, math.min(380, width - 28), bannerBottom + 8, toastHeight);
}

/** Gamepad select/back hints: bottom-right beside the side panel, or just above the bottom sheet. */
export function getMenuHintsLayout(viewportWidth: number, viewportHeight: number, menu: MenuLayout): Rectangle {
	if (menu.mode === "side") {
		const width = math.max(1, viewportWidth);
		const hintsWidth = math.min(260, width - 16 - (menu.panel.x + menu.panel.width + 16));
		return { x: width - 16 - hintsWidth, y: math.max(1, viewportHeight) - 16 - 28, width: hintsWidth, height: 28 };
	}
	return { x: menu.panel.x, y: menu.panel.y - 36, width: menu.panel.width, height: 28 };
}

export function inputModeFromPreferred(name: string): InputMode | undefined {
	if (name === "Touch") return "touch";
	if (name === "Gamepad") return "gamepad";
	if (name === "KeyboardAndMouse") return "keyboard";
	return undefined;
}

/** Maps an Enum.UserInputType name to an input mode; unrelated input types return undefined. */
export function inputModeFromInputType(name: string): InputMode | undefined {
	if (name === "Touch") return "touch";
	if (name.sub(1, 7) === "Gamepad") return "gamepad";
	if (name === "Keyboard" || name === "MouseMovement" || name === "MouseWheel" || name.sub(1, 11) === "MouseButton") return "keyboard";
	return undefined;
}

/**
 * Hybrid devices can report mouse or gamepad activity mid-drag. Leaving touch
 * waits until the active joystick touch ends so the stick is always released.
 */
export function shouldAcceptInputModeChange(current: InputMode, nextMode: InputMode, touchDragActive: boolean): boolean {
	if (current === nextMode) return false;
	return !(touchDragActive && current === "touch");
}

export function getEvadeHint(inputMode: InputMode): ControlHint | undefined {
	if (inputMode === "gamepad") return { keyCode: "ButtonB", label: "B", action: "EVADE" };
	if (inputMode === "keyboard") return { label: "F", action: "EVADE" };
	return undefined;
}

/** Bottom-of-screen hints: a short legend at launch, otherwise only what is actionable now. */
export function getFlightHints(inputMode: InputMode, context: FlightHintContext): ControlHint[] {
	if (inputMode === "touch") return [];
	const gamepad = inputMode === "gamepad";
	const fire: ControlHint = gamepad ? { keyCode: "ButtonR2", label: "RT", action: "FIRE" } : { label: "SPACE", action: "FIRE" };
	if (context.introduction) {
		const evade = getEvadeHint(inputMode)!;
		const target: ControlHint = gamepad ? { keyCode: "ButtonY", label: "Y", action: "TARGET" } : { label: "TAB", action: "TARGET" };
		return gamepad
			? [{ keyCode: "Thumbstick1", label: "LS", action: "FLY" }, { keyCode: "ButtonL1", label: "LB", action: "SLOW" }, { keyCode: "ButtonR1", label: "RB", action: "FAST" }, fire, evade, target]
			: [
				{ label: "WASD", action: "FLY" },
				{ label: "Q / E", action: "THROTTLE" },
				{ label: "SHIFT", action: "BOOST" },
				{ label: "RMB", action: "STEER" },
				fire,
				evade,
				target,
			];
	}
	if (context.locked && context.missileReady) return [fire];
	return [];
}

export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectangleInside(inner: Rectangle, width: number, height: number, inset = 0): boolean {
	return inner.x >= inset && inner.y >= inset && inner.x + inner.width <= width - inset && inner.y + inner.height <= height - inset;
}

export function getSlotListHeight(panelHeight: number, compact: boolean): number {
	return math.min(compact ? 194 : 256, math.max(44, panelHeight - (compact ? 34 : 66) - 44 - 12));
}
