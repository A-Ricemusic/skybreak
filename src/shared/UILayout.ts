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
	alert: Rectangle;
	callout: Rectangle;
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

export interface CinematicLayout {
	compact: boolean;
	topBar: Rectangle;
	bottomPanel: Rectangle;
	chapter: Rectangle;
	title: Rectangle;
	progress: Rectangle;
	speaker: Rectangle;
	subtitle: Rectangle;
	reducedMotion: Rectangle;
	skip: Rectangle;
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

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode): HudLayout {
	const width = math.max(320, viewportWidth);
	const height = math.max(240, viewportHeight);
	const margin = width < 700 || height < 420 ? 14 : 22;
	// The objective callout sits at the very top of the CoreUI-safe area so it
	// never crosses the flight view or target bracket. The incoming-warning
	// alert is a slim pill that stacks below the callout only while active, so
	// a persistent banner is never reserved across the forward view. Horizontal
	// centering stays inside the ScreenGui's safe inset, which already excludes
	// the Roblox topbar on the left and any phone cutout on the right.
	const callout = centered(width, math.min(420, width - margin * 2), margin, 50);
	const alert = centered(width, math.min(380, width - margin * 2), callout.y + callout.height + 10, 32);

	if (inputMode === "touch") {
		const portrait = height > width;
		const compactLandscape = !portrait && (width < 360 || height < 280);
		if (compactLandscape) {
			// At the 320x240 minimum, the usual vertical throttle and stacked status
			// compete with both the warning lane and the right-side target button.
			// Use two compact rows instead: throttle/status immediately below the
			// alert, then the primary controls along the bottom safe edge.
			const throttleLength = MIN_TOUCH_TARGET * 2 + 36;
			const upperRowY = alert.y + alert.height + 10;
			const throttle = { x: margin, y: upperRowY, width: throttleLength, height: MIN_TOUCH_TARGET };
			const statusWidth = 128;
			const statusHeight = 40;
			const status = { x: width - margin - statusWidth, y: upperRowY, width: statusWidth, height: statusHeight };
			const joystickSize = 64;
			const joystick = { x: margin, y: height - margin - joystickSize, width: joystickSize, height: joystickSize };
			const missileSize = 64;
			const missile = { x: width - margin - missileSize, y: height - margin - missileSize, width: missileSize, height: missileSize };
			const targetSize = MIN_TOUCH_TARGET;
			const target = { x: missile.x - 14 - targetSize, y: height - margin - targetSize, width: targetSize, height: targetSize };
			return { margin, alert, callout, status, touch: { joystick, throttle, throttleVertical: false, missile, target } };
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
		return { margin, alert, callout, status, touch: { joystick, throttle, throttleVertical: !portrait, missile, target } };
	}

	const status = { x: width - margin - 150, y: height - margin - 40, width: 150, height: 40 };
	const besideStatus = width - 2 * (margin + status.width + 12);
	const hints = besideStatus >= 320
		? centered(width, math.min(720, besideStatus), height - margin - 30, 30)
		: centered(width, width - margin * 2, status.y - 10 - 30, 30);
	return { margin, alert, callout, status, hints };
}

/**
 * One panel shared by every menu screen. Landscape keeps it to the left so the
 * display aircraft stays visible on the right; portrait uses a bottom sheet.
 */
export function getMenuLayout(viewportWidth: number, viewportHeight: number): MenuLayout {
	const width = math.max(320, viewportWidth);
	const height = math.max(240, viewportHeight);
	if (width >= height * 1.15) {
		const x = math.floor(math.clamp(width * 0.05, 20, 72));
		const panelWidth = math.floor(math.clamp(width * 0.36, 280, 440));
		const vertical = height < 440 ? 14 : math.floor(math.clamp(height * 0.08, 24, 64));
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

/**
 * Caption-first cinematic layout. Chapter/title metadata lives in the top
 * letterbox; dialogue and side-by-side actions live in the bottom panel. All
 * returned child rectangles use viewport coordinates so tests can verify real
 * bounds before React converts them to panel-local offsets.
 */
export function getCinematicLayout(viewportWidth: number, viewportHeight: number): CinematicLayout {
	const width = math.max(320, viewportWidth);
	const height = math.max(240, viewportHeight);
	const compact = height < 360 || width < 480;
	const outerPadding = width < 400 ? 12 : 18;
	const topHeight = math.floor(math.clamp(height * 0.15, 40, 70));
	const topBar = { x: 0, y: 0, width, height: topHeight };
	const progressWidth = 54;
	const chapter = { x: outerPadding, y: 4, width: width - outerPadding * 2 - progressWidth - 8, height: 12 };
	const progress = { x: width - outerPadding - progressWidth, y: 4, width: progressWidth, height: 12 };
	const title = { x: outerPadding, y: 19, width: width - outerPadding * 2, height: topHeight - 21 };

	const landscapeShort = height <= 340 && width >= height;
	const requestedPanelHeight = landscapeShort
		? math.max(140, math.floor(height * 0.45))
		: math.floor(math.clamp(height * 0.32, 180, 250));
	const panelHeight = math.min(requestedPanelHeight, height - topHeight - 12);
	const bottomPanel = { x: 0, y: height - panelHeight, width, height: panelHeight };
	const speaker = { x: outerPadding, y: bottomPanel.y + outerPadding - 2, width: width - outerPadding * 2, height: 16 };
	const actionGap = width < 400 ? 10 : 12;
	const actionY = height - outerPadding - MIN_TOUCH_TARGET;
	const actionWidth = math.floor((width - outerPadding * 2 - actionGap) / 2);
	const reducedMotion = { x: outerPadding, y: actionY, width: actionWidth, height: MIN_TOUCH_TARGET };
	const skip = { x: outerPadding + actionWidth + actionGap, y: actionY, width: width - outerPadding - (outerPadding + actionWidth + actionGap), height: MIN_TOUCH_TARGET };
	const subtitleY = speaker.y + speaker.height + 6;
	const subtitle = { x: outerPadding, y: subtitleY, width: width - outerPadding * 2, height: actionY - 8 - subtitleY };
	return { compact, topBar, bottomPanel, chapter, title, progress, speaker, subtitle, reducedMotion, skip };
}

/** Status toasts stay clear of the menu panel, or of the mission alert lane when no menu is shown. */
export function getToastLayout(viewportWidth: number, viewportHeight: number, menu?: MenuLayout): Rectangle {
	const width = math.max(320, viewportWidth);
	const toastHeight = 44;
	if (menu?.mode === "side") {
		const left = menu.panel.x + menu.panel.width + 16;
		const toastWidth = math.min(380, width - left - 16);
		return { x: left + math.floor((width - left - 16 - toastWidth) / 2), y: 16, width: toastWidth, height: toastHeight };
	}
	if (menu) return centered(width, math.min(380, width - 28), 14, toastHeight);
	const hud = getHudLayout(viewportWidth, viewportHeight, "keyboard");
	const bannerBottom = math.max(hud.callout.y + hud.callout.height, hud.alert.y + hud.alert.height);
	return centered(width, math.min(380, width - 28), bannerBottom + 8, toastHeight);
}

/** Gamepad select/back hints: bottom-right beside the side panel, or just above the bottom sheet. */
export function getMenuHintsLayout(viewportWidth: number, viewportHeight: number, menu: MenuLayout): Rectangle {
	if (menu.mode === "side") {
		const width = math.max(320, viewportWidth);
		const hintsWidth = math.min(260, width - 16 - (menu.panel.x + menu.panel.width + 16));
		return { x: width - 16 - hintsWidth, y: math.max(240, viewportHeight) - 16 - 28, width: hintsWidth, height: 28 };
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
