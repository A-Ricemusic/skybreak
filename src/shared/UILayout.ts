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
	/** Right analog stick, including its up/down and percent labels. */
	throttle: Rectangle;
	missile: Rectangle;
	target: Rectangle;
	/** Second weapon slot button: beside FIRE, or beside TGT on narrow roots. */
	special: Rectangle;
}

export interface HudLayout {
	margin: number;
	/** One line of warning text, bottom-centre just above the touch lane or the hint row. */
	alert: Rectangle;
	/** One objective line, top-left of the CoreUI-safe area. */
	callout: Rectangle;
	/** Mission clock text, top-right. */
	timer: Rectangle;
	/** "HULL 87 · MSL 8" text directly under the clock. */
	status: Rectangle;
	flightStatus: Rectangle;
	/** Fixed slot for the navigation caption when no floating spot fits (under the objective). */
	navigation: Rectangle;
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

/** The objective line never takes more than this share of the root width. */
export const OBJECTIVE_MAX_SHARE = 0.38;
export const OBJECTIVE_MAX_WIDTH = 340;
/** Two 11pt lines: long objectives and story radio wrap instead of shrinking below 10pt. */
export const OBJECTIVE_LINE_HEIGHT = 30;
/** Tutorial copy must fit the single objective line. */
export const TUTORIAL_MAX_CHARS = 34;
export const TIMER_WIDTH = 48;
export const TIMER_HEIGHT = 14;
export const STATUS_WIDTH = 150;
export const STATUS_HEIGHT = 13;
export const ALERT_MAX_WIDTH = 220;
export const ALERT_HEIGHT = 18;
export const NAVIGATION_CAPTION_WIDTH = 120;
export const NAVIGATION_CAPTION_HEIGHT = 28;
export const JOYSTICK_SIZE = 96;
export const FIRE_SIZE = 64;
export const TARGET_SIZE = 48;
export const SPECIAL_SIZE = 48;
/** Root heights at or below this use the compact (Studio 320x182) arrangement. */
export const COMPACT_MAX_HEIGHT = 200;

/**
 * The forward view: the central 50% of the width and 60% of the height. Only
 * the target bracket, the navigation cue and the alert text may appear here.
 */
export function getHudCentreBox(viewportWidth: number, viewportHeight: number): Rectangle {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const x = math.floor(width * 0.25);
	const y = math.floor(height * 0.2);
	return { x, y, width: math.ceil(width * 0.75) - x, height: math.ceil(height * 0.8) - y };
}

/**
 * Only roots at most 200pt tall (the 320x182 Studio safe area). Real phones in
 * landscape lose their top inset to CoreUISafeInsets (an iPhone becomes about
 * 706x267) and must still get the regular layout.
 */
export function isCompactHud(_viewportWidth: number, viewportHeight: number): boolean {
	return math.max(1, viewportHeight) <= COMPACT_MAX_HEIGHT;
}

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode): HudLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const compact = isCompactHud(width, height);
	const margin = compact || width <= 320 ? 6 : height < 300 ? 10 : height < 500 || width < 700 ? 14 : 22;
	const gap = compact ? 6 : 8;
	// Touch controls keep a wider gap so a thumb on one cannot brush the next.
	const controlGap = compact ? 6 : 12;
	// The ScreenGui uses CoreUISafeInsets, so the origin is already below the
	// Roblox system buttons and clear of any notch. Top row: the objective line
	// on the left; the clock with hull/missiles under it on the right. Text only.
	const timer = { x: width - margin - TIMER_WIDTH, y: margin, width: TIMER_WIDTH, height: TIMER_HEIGHT };
	const status = { x: width - margin - STATUS_WIDTH, y: timer.y + timer.height + 2, width: STATUS_WIDTH, height: STATUS_HEIGHT };
	const flightStatus = { x: status.x, y: timer.y, width: STATUS_WIDTH - TIMER_WIDTH - gap, height: TIMER_HEIGHT };
	const calloutWidth = math.max(0, math.min(OBJECTIVE_MAX_WIDTH, math.floor(width * OBJECTIVE_MAX_SHARE), status.x - gap - margin));
	const callout = { x: margin, y: margin, width: calloutWidth, height: OBJECTIVE_LINE_HEIGHT };
	const navigation = { x: margin, y: callout.y + callout.height + 2, width: NAVIGATION_CAPTION_WIDTH, height: NAVIGATION_CAPTION_HEIGHT };

	if (inputMode === "touch") {
		const joystick = { x: margin, y: height - margin - JOYSTICK_SIZE, width: JOYSTICK_SIZE, height: JOYSTICK_SIZE };
		const throttle = { ...joystick, x: width - margin - JOYSTICK_SIZE };
		const laneLeft = joystick.x + JOYSTICK_SIZE + controlGap;
		const laneRight = throttle.x - controlGap;
		const stacked = laneRight - laneLeft < FIRE_SIZE + TARGET_SIZE + SPECIAL_SIZE + controlGap * 2;
		const fireSize = height < 176 ? MIN_TOUCH_TARGET : FIRE_SIZE;
		const targetSize = height < 176 ? MIN_TOUCH_TARGET : TARGET_SIZE;
		const missile = centered(width, fireSize, height - margin - fireSize, fireSize);
		if (!stacked) missile.x = laneRight - targetSize - controlGap - fireSize;
		const target = stacked
			? { x: math.floor(width / 2 - controlGap / 2 - targetSize), y: missile.y - controlGap - targetSize, width: targetSize, height: targetSize }
			: { x: missile.x - controlGap - targetSize, y: missile.y + fireSize - targetSize, width: targetSize, height: targetSize };
		const special = { ...target, x: stacked ? math.floor(width / 2 + controlGap / 2) : missile.x + fireSize + controlGap };
		// The tiny Studio root needs its alert between the top texts and actions.
		// Other roots reserve a full-width text row above the bottom control lane.
		if (compact) { navigation.width = JOYSTICK_SIZE; navigation.height = math.min(NAVIGATION_CAPTION_HEIGHT, joystick.y - navigation.y - 3); }
		const alert = compact
			? centered(width, laneRight - laneLeft, 38, ALERT_HEIGHT)
			: centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), math.min(joystick.y, target.y) - gap - ALERT_HEIGHT, ALERT_HEIGHT);
		return { margin, alert, callout, timer, status, flightStatus, navigation, touch: { joystick, throttle, missile, target, special } };
	}

	const hintsHeight = 18;
	const hints = centered(width, math.min(360, width - margin * 2), height - margin - hintsHeight, hintsHeight);
	// Keyboard/gamepad: the warning sits directly above the hint row, which also
	// carries the EVADE prompt while a missile is inbound.
	const alert = centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), hints.y - 2 - ALERT_HEIGHT, ALERT_HEIGHT);
	return { margin, alert, callout, timer, status, flightStatus, navigation, hints };
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
	if (isCompactHud(viewportWidth, viewportHeight)) return { x: width - hud.margin - JOYSTICK_SIZE, y: 38, width: JOYSTICK_SIZE, height: ALERT_HEIGHT };
	// In a mission the toast lives in the top row between the objective and the
	// clock, so it never enters the forward view. If that span is too narrow
	// (portrait phones), it drops below the top texts instead.
	const left = hud.callout.x + hud.callout.width + 8;
	const right = hud.status.x - 8;
	const missionToastHeight = 30;
	if (right - left >= 140) {
		const toastWidth = math.min(380, right - left);
		return { x: left + math.floor((right - left - toastWidth) / 2), y: hud.callout.y, width: toastWidth, height: missionToastHeight };
	}
	// Narrow roots use the space beside navigation, keeping transient notices
	// above the twin-stick warning/action lane.
	const besideNavigation = hud.navigation.x + hud.navigation.width + 8;
	if (width - hud.margin - besideNavigation >= 140) {
		return { x: besideNavigation, y: hud.navigation.y, width: width - hud.margin - besideNavigation, height: missionToastHeight };
	}
	const alertStackedOnTop = hud.alert.y + hud.alert.height <= math.max(1, viewportHeight) / 2;
	const bannerBottom = math.max(
		hud.callout.y + hud.callout.height,
		hud.status.y + hud.status.height,
		hud.navigation.y + hud.navigation.height,
		alertStackedOnTop ? hud.alert.y + hud.alert.height : 0,
	);
	return centered(width, math.min(380, math.floor(width * 0.5)), bannerBottom + 8, missionToastHeight);
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

/** The special-weapon key: C on keyboard, X on a gamepad (B evades, Y targets, RT fires). */
export function getSpecialHint(inputMode: InputMode, action: string): ControlHint | undefined {
	if (inputMode === "gamepad") return { keyCode: "ButtonX", label: "X", action };
	if (inputMode === "keyboard") return { label: "C", action };
	return undefined;
}

/** Most hints shown at once in the bottom-centre row. */
export const MAX_FLIGHT_HINTS = 2;

/**
 * Bottom-of-screen hints: a two-item legend at launch, otherwise only what is
 * actionable now (FIRE while locked with a missile ready). Never more than two.
 */
export function getFlightHints(inputMode: InputMode, context: FlightHintContext): ControlHint[] {
	if (inputMode === "touch") return [];
	const gamepad = inputMode === "gamepad";
	const fire: ControlHint = gamepad ? { keyCode: "ButtonR2", label: "RT", action: "FIRE" } : { label: "SPACE", action: "FIRE" };
	if (context.locked && context.missileReady) return [fire];
	if (context.introduction) {
		const target: ControlHint = gamepad ? { keyCode: "ButtonY", label: "Y", action: "TARGET" } : { label: "TAB", action: "TARGET" };
		const fly: ControlHint = gamepad ? { keyCode: "Thumbstick1", label: "LS", action: "FLY" } : { label: "WASD", action: "FLY" };
		return [fly, target];
	}
	return [];
}

/** Mission 1 training copy, short enough for the one-line objective (<= TUTORIAL_MAX_CHARS). */
export function getTutorialInstruction(step: string | undefined, mode: InputMode): string {
	if (step === "move") return mode === "touch" ? "L: fly / R: up-down throttle" : mode === "gamepad" ? "LS fly · RS up+/down- throttle" : "WASD fly · Q/E throttle";
	if (step === "target") return mode === "touch" ? "Tap TGT to select the radar" : mode === "gamepad" ? "Press Y to select the radar" : "Press Tab to select the radar";
	if (step === "missile") return mode === "touch" ? "Hold the lock, then tap FIRE" : mode === "gamepad" ? "Hold the lock, then press RT" : "Hold the lock, then press Space";
	return "";
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
