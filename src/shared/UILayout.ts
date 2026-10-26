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
	/** Right analog stick disc; the same size as the steering stick. */
	throttle: Rectangle;
	/** "SPEED UP" caption centred above the throttle disc; omitted on compact roots. */
	throttleUpLabel?: Rectangle;
	/** "SLOW DOWN" caption centred below the throttle disc; omitted on compact roots. */
	throttleDownLabel?: Rectangle;
	missile: Rectangle;
	target: Rectangle;
	/** Second weapon slot button: beside FIRE, or beside TGT on narrow roots. */
	special: Rectangle;
	/** Round EVADE button on the right-thumb side: beside the throttle, above it on narrow roots. */
	evade: Rectangle;
	/** row: TGT FIRE SPECIAL EVADE between the sticks; stacked: FIRE under TGT/SPECIAL, EVADE above the throttle; grid: 2x2 (Studio compact). */
	arrangement: TouchArrangement;
}

export type TouchArrangement = "row" | "stacked" | "grid";

/** below: under the hull bar; corner: top-right corner with the clock column moved left of it; bottom: bottom-centre (desktop). */
export type RadarPlacement = "below" | "corner" | "bottom";

export interface HudOptions {
	/** Requested touch stick edge in px (clamped to STICK_MIN_SIZE–STICK_MAX_SIZE and to what the root fits). */
	stickSize?: number;
}

export interface HudLayout {
	margin: number;
	/** One line of warning text, bottom-centre just above the touch lane or the hint row. */
	alert: Rectangle;
	/** One objective line, top-left of the CoreUI-safe area. */
	callout: Rectangle;
	/** Mission clock text, top-right. */
	timer: Rectangle;
	/** "MSL 8 · FLR 2" text directly under the clock. */
	status: Rectangle;
	/** Hull bar directly under the weapon status, right-aligned. */
	health: Rectangle;
	flightStatus: Rectangle;
	/** Fixed slot for the navigation caption when no floating spot fits (under the objective). */
	navigation: Rectangle;
	/** PAUSE button, top-left; omitted on Studio-compact roots (the Roblox menu auto-pauses there). */
	pause?: Rectangle;
	/** Heading-up radar disc (square bounds); omitted when no 90 px slot fits. */
	radar?: Rectangle;
	radarPlacement?: RadarPlacement;
	/** Touch row arrangement: one line above FIRE for refusals ("NO LOCK · FIRING BLIND"). Elsewhere refusals use the alert lane. */
	fireCaption?: Rectangle;
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
export const HEALTH_BAR_HEIGHT = 6;
/** Studio's 320x182 root: thinner and only stick-wide, clear of the compact alert lane and toast. */
export const COMPACT_HEALTH_BAR_HEIGHT = 4;
/** Caption rows above and below the throttle disc. */
export const THROTTLE_LABEL_HEIGHT = 10;
export const ALERT_MAX_WIDTH = 220;
export const ALERT_HEIGHT = 18;
export const NAVIGATION_CAPTION_WIDTH = 120;
export const NAVIGATION_CAPTION_HEIGHT = 28;
/** Widest floating navigation caption; longer detail lines wrap instead of truncating. */
export const NAVIGATION_CAPTION_MAX_WIDTH = 200;
/** One caption row (10pt text). */
export const NAVIGATION_ROW_HEIGHT = 13;
/** The fixed navigation slot holds the distance plus two wrapped detail rows. */
export const NAVIGATION_SLOT_HEIGHT = NAVIGATION_ROW_HEIGHT * 3 + 2;
export const JOYSTICK_SIZE = 96;
export const STICK_MIN_SIZE = 80;
export const STICK_MAX_SIZE = 128;
export const EVADE_SIZE = 56;
export const PAUSE_SIZE = 44;
/** Keyboard and gamepad roots use a smaller mouse-sized pause button. */
export const PAUSE_DESKTOP_SIZE = 32;
export const RADAR_MIN_SIZE = 90;
export const RADAR_MAX_SIZE = 110;
export const FIRE_CAPTION_WIDTH = 150;
export const FIRE_CAPTION_HEIGHT = 12;
/** A corner radar only displaces the clock column while the objective keeps at least this width. */
export const MIN_OBJECTIVE_WIDTH = 160;
/** Top-row lane kept for toasts and the kill callout when a corner radar narrows the row. */
export const TOP_LANE_RESERVE = 140;
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
export function getHudLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode, options?: HudOptions): HudLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const touchMode = inputMode === "touch";
	// Preserve a dedicated top warning lane until the bottom controls have enough height.
	const compact = height < 240;
	const margin = compact || width < 360 ? 6 : height < 300 ? 10 : height < 500 || width < 700 ? 14 : 22;
	const gap = compact ? 6 : 8;
	// Touch controls keep a wider gap so a thumb on one cannot brush the next.
	const controlGap = compact || width < 360 ? 6 : 12;
	// The ScreenGui uses CoreUISafeInsets, so the origin is already below the
	// Roblox system buttons and clear of any notch. Top row: PAUSE, then the
	// objective line on the left; the clock with hull/missiles under it on the right.
	const pauseSize = touchMode ? PAUSE_SIZE : PAUSE_DESKTOP_SIZE;
	const pause = compact ? undefined : { x: margin, y: margin, width: pauseSize, height: pauseSize };
	const calloutX = pause ? pause.x + pause.width + gap : margin;
	const healthWidth = compact ? JOYSTICK_SIZE : STATUS_WIDTH;
	const healthHeight = compact ? COMPACT_HEALTH_BAR_HEIGHT : HEALTH_BAR_HEIGHT;
	const healthBottom = margin + TIMER_HEIGHT + 2 + STATUS_HEIGHT + (compact ? 1 : 2) + healthHeight;
	/** The clock column, right-aligned at `right`. */
	const column = (right: number) => {
		const timer = { x: right - TIMER_WIDTH, y: margin, width: TIMER_WIDTH, height: TIMER_HEIGHT };
		const status = { x: right - STATUS_WIDTH, y: timer.y + timer.height + 2, width: STATUS_WIDTH, height: STATUS_HEIGHT };
		const health = { x: right - healthWidth, y: status.y + status.height + (compact ? 1 : 2), width: healthWidth, height: healthHeight };
		const flightStatus = { x: status.x, y: timer.y, width: STATUS_WIDTH - TIMER_WIDTH - gap, height: TIMER_HEIGHT };
		return { timer, status, health, flightStatus };
	};
	const objectiveWidth = (statusX: number, reserve: number) =>
		math.max(0, math.min(OBJECTIVE_MAX_WIDTH, math.floor(width * OBJECTIVE_MAX_SHARE), statusX - gap - reserve - calloutX));
	let { timer, status, health, flightStatus } = column(width - margin);
	// Keep a top-row lane for toasts and the kill callout whenever the objective can spare it.
	const reserved = objectiveWidth(status.x, TOP_LANE_RESERVE + gap);
	let callout = { x: calloutX, y: margin, width: reserved >= MIN_OBJECTIVE_WIDTH ? reserved : objectiveWidth(status.x, 0), height: OBJECTIVE_LINE_HEIGHT };
	const navigation = { x: calloutX, y: callout.y + callout.height + 2, width: NAVIGATION_CAPTION_WIDTH, height: NAVIGATION_SLOT_HEIGHT };
	const navigationBottom = navigation.y + navigation.height;
	/** Fits the radar in the right column above `limit`: under the hull bar, else in the corner. */
	const fitRadar = (limit: number): { rectangle: Rectangle; placement: RadarPlacement } | undefined => {
		// Narrow roots cap the disc so a 90 px kill callout still fits centred beside it.
		const below = math.min(RADAR_MAX_SIZE, limit - gap - (healthBottom + gap), math.floor(width / 2 - margin - gap - KILL_MARKER_MIN_WIDTH / 2));
		if (below >= RADAR_MIN_SIZE) return { rectangle: { x: width - margin - below, y: healthBottom + gap, width: below, height: below }, placement: "below" };
		let size = math.min(RADAR_MAX_SIZE, limit - gap - margin);
		// The clock column moves left of the disc; the objective keeps MIN_OBJECTIVE_WIDTH, the disc shrinks first.
		const shortfall = MIN_OBJECTIVE_WIDTH - objectiveWidth(width - margin - size - gap - STATUS_WIDTH, TOP_LANE_RESERVE + gap);
		if (shortfall > 0) size -= shortfall;
		if (size < RADAR_MIN_SIZE) return undefined;
		return { rectangle: { x: width - margin - size, y: margin, width: size, height: size }, placement: "corner" };
	};
	let radar: Rectangle | undefined;
	let radarPlacement: RadarPlacement | undefined;
	const placeRadar = (limit: number) => {
		const fitted = fitRadar(limit);
		if (!fitted) return;
		radar = fitted.rectangle;
		radarPlacement = fitted.placement;
		if (fitted.placement !== "corner") return;
		({ timer, status, health, flightStatus } = column(fitted.rectangle.x - gap));
		callout = { ...callout, width: objectiveWidth(status.x, TOP_LANE_RESERVE + gap) };
	};
	/** The fixed navigation slot runs from the objective's left edge to the first right-column element at its height. */
	const finishNavigation = (disc: Rectangle | undefined) => {
		let right = width - margin;
		for (const obstacle of [status, health, ...(disc ? [disc] : [])]) {
			if (obstacle.y < navigation.y + navigation.height && obstacle.y + obstacle.height > navigation.y) right = math.min(right, obstacle.x);
		}
		navigation.width = math.min(NAVIGATION_CAPTION_MAX_WIDTH, right - gap - calloutX);
	};

	if (touchMode) {
		// Regular roots lift both sticks so the throttle captions sit outside the
		// disc (above and below) without entering the safe margin.
		const labelLift = compact ? 0 : THROTTLE_LABEL_HEIGHT + 2;
		const tiny = height < 180;
		const evadeSize = compact ? MIN_TOUCH_TARGET : EVADE_SIZE;
		let fireSize = tiny ? MIN_TOUCH_TARGET : FIRE_SIZE;
		let targetSize = tiny ? MIN_TOUCH_TARGET : TARGET_SIZE;
		// Stick size: the request, limited so the action lane, the alert row and a stacked EVADE still fit.
		const laneMinimum = compact ? MIN_TOUCH_TARGET * 2 + controlGap : targetSize * 2 + controlGap;
		const fitsWide = math.floor((width - margin * 2 - controlGap * 2 - laneMinimum) / 2);
		const fitsTall = compact
			? height - margin - (navigation.y + NAVIGATION_ROW_HEIGHT + 2)
			: math.min(
				height - margin - labelLift - (navigationBottom + gap + ALERT_HEIGHT + gap),
				height - margin - labelLift - controlGap - MIN_TOUCH_TARGET - (healthBottom + gap),
			);
		const requested = math.clamp(math.floor((options?.stickSize ?? JOYSTICK_SIZE) + 0.5), STICK_MIN_SIZE, STICK_MAX_SIZE);
		const stick = math.max(STICK_MIN_SIZE, math.min(requested, fitsWide, fitsTall));
		const joystick = { x: margin, y: height - margin - labelLift - stick, width: stick, height: stick };
		const throttle = { ...joystick, x: width - margin - stick };
		const throttleUpLabel = compact ? undefined : { x: throttle.x, y: throttle.y - labelLift, width: stick, height: THROTTLE_LABEL_HEIGHT };
		const throttleDownLabel = compact ? undefined : { x: throttle.x, y: throttle.y + stick + 2, width: stick, height: THROTTLE_LABEL_HEIGHT };
		const laneLeft = joystick.x + stick + controlGap;
		const laneRight = throttle.x - controlGap;
		const arrangement: TouchArrangement = laneRight - laneLeft >= targetSize * 2 + fireSize + evadeSize + controlGap * 3 ? "row" : compact ? "grid" : "stacked";
		let missile: Rectangle, target: Rectangle, special: Rectangle, evade: Rectangle;
		let fireCaption: Rectangle | undefined;
		if (arrangement === "row") {
			// Right to left from the throttle: EVADE (closest to the right thumb), SPECIAL, FIRE, TGT.
			const bottom = height - margin;
			evade = { x: laneRight - evadeSize, y: bottom - evadeSize, width: evadeSize, height: evadeSize };
			special = { x: evade.x - controlGap - targetSize, y: bottom - targetSize, width: targetSize, height: targetSize };
			missile = { x: special.x - controlGap - fireSize, y: bottom - fireSize, width: fireSize, height: fireSize };
			target = { x: missile.x - controlGap - targetSize, y: bottom - targetSize, width: targetSize, height: targetSize };
			const captionWidth = math.min(FIRE_CAPTION_WIDTH, (missile.x + fireSize / 2 - laneLeft) * 2);
			fireCaption = { x: math.floor(missile.x + fireSize / 2 - captionWidth / 2), y: missile.y - 2 - FIRE_CAPTION_HEIGHT, width: captionWidth, height: FIRE_CAPTION_HEIGHT };
		} else if (arrangement === "grid") {
			// Studio compact: TGT SPECIAL over FIRE EVADE, all at the 44 px minimum.
			fireSize = MIN_TOUCH_TARGET; targetSize = MIN_TOUCH_TARGET;
			const left = math.floor(width / 2 - controlGap / 2 - MIN_TOUCH_TARGET);
			const right = math.floor(width / 2 + controlGap / 2);
			const lower = height - margin - MIN_TOUCH_TARGET;
			const upper = lower - controlGap - MIN_TOUCH_TARGET;
			missile = { x: left, y: lower, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET };
			evade = { x: right, y: lower, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET };
			target = { x: left, y: upper, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET };
			special = { x: right, y: upper, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET };
		} else {
			missile = centered(width, fireSize, height - margin - fireSize, fireSize);
			target = { x: math.floor(width / 2 - controlGap / 2 - targetSize), y: missile.y - controlGap - targetSize, width: targetSize, height: targetSize };
			special = { ...target, x: math.floor(width / 2 + controlGap / 2) };
			// Above the throttle's SPEED UP caption, centred on the disc; 44 px when the column is short.
			const above = (size: number) => ({ x: throttle.x + math.floor((stick - size) / 2), y: (throttleUpLabel?.y ?? throttle.y) - controlGap - size, width: size, height: size });
			evade = above(EVADE_SIZE);
			if (evade.y < healthBottom + gap) evade = above(MIN_TOUCH_TARGET);
		}
		// The tiny Studio root needs its alert between the top texts and actions.
		// Other roots reserve a text row above the bottom control lane.
		if (compact) { navigation.width = stick; navigation.height = math.min(NAVIGATION_SLOT_HEIGHT, joystick.y - navigation.y - 2); }
		let alert: Rectangle;
		// Compact: centred in the lane and never wider than the gap to the hull bar (small sticks widen the lane).
		if (compact) alert = centered(width, math.min(laneRight - laneLeft, 2 * (health.x - gap - math.floor(width / 2))), 38, ALERT_HEIGHT);
		else {
			// A stacked EVADE sits in the right column: keep the centred alert narrower than the gap to it.
			const alertWidth = math.min(ALERT_MAX_WIDTH, width - margin * 2, arrangement === "stacked" ? 2 * (evade.x - gap - math.floor(width / 2)) : math.huge);
			alert = centered(width, alertWidth, math.min(joystick.y - labelLift, target.y, fireCaption?.y ?? math.huge) - gap - ALERT_HEIGHT, ALERT_HEIGHT);
		}
		if (!compact) {
			// Short stacked roots lift the alert row; the slot keeps at least two caption rows above it.
			navigation.height = math.min(NAVIGATION_SLOT_HEIGHT, alert.y - 2 - navigation.y);
			placeRadar(arrangement === "stacked" ? evade.y : throttleUpLabel?.y ?? throttle.y);
			finishNavigation(radar);
		}
		return {
			margin, alert, callout, timer, status, health, flightStatus, navigation, pause, radar, radarPlacement, fireCaption,
			touch: { joystick, throttle, throttleUpLabel, throttleDownLabel, missile, target, special, evade, arrangement },
		};
	}

	const hintsHeight = 18;
	const forwardBottom = math.ceil(height * 0.8);
	// Desktop roots tall enough put the radar bottom-centre under the hint row, below the forward view.
	const bottomSize = math.min(RADAR_MAX_SIZE, height - margin - hintsHeight - 2 - forwardBottom);
	if (bottomSize >= RADAR_MIN_SIZE) {
		radar = centered(width, bottomSize, height - margin - bottomSize, bottomSize);
		radarPlacement = "bottom";
	}
	const hints = centered(width, math.min(360, width - margin * 2), (radar ? radar.y - 2 : height - margin) - hintsHeight, hintsHeight);
	// Keyboard/gamepad: the warning sits directly above the hint row, which also
	// carries the EVADE prompt while a missile is inbound.
	const alert = centered(width, math.min(ALERT_MAX_WIDTH, width - margin * 2), hints.y - 2 - ALERT_HEIGHT, ALERT_HEIGHT);
	if (radarPlacement === undefined && !compact) placeRadar(alert.y);
	if (!compact) finishNavigation(radarPlacement === "bottom" ? undefined : radar);
	else navigation.width = math.min(NAVIGATION_CAPTION_WIDTH, status.x - gap - calloutX);
	return { margin, alert, callout, timer, status, health, flightStatus, navigation, hints, pause, radar, radarPlacement };
}

export const KILL_MARKER_MAX_WIDTH = 220;
export const KILL_MARKER_MIN_WIDTH = 90;
export const KILL_MARKER_HEIGHT = 22;

/**
 * The brief "SPLASH ONE" callout: top centre, in the lane between the objective
 * and the clock stack, above the forward view. Portrait roots with a narrow lane
 * drop it just under the top texts (still above the forward view). The Studio
 * compact root has room for neither and borrows the alert lane for the moment.
 */
export function getKillMarkerLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode, options?: HudOptions): Rectangle {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const hud = getHudLayout(width, height, inputMode, options);
	const gap = 8;
	const laneLeft = hud.callout.x + hud.callout.width + gap;
	const laneRight = math.min(hud.status.x, hud.flightStatus.x, hud.timer.x) - gap;
	const laneWidth = math.min(KILL_MARKER_MAX_WIDTH, laneRight - laneLeft);
	if (laneWidth >= KILL_MARKER_MIN_WIDTH) {
		return { x: laneLeft + math.floor((laneRight - laneLeft - laneWidth) / 2), y: hud.margin, width: laneWidth, height: KILL_MARKER_HEIGHT };
	}
	const below = math.max(hud.navigation.y + hud.navigation.height, hud.health.y + hud.health.height) + gap;
	const forward = getHudCentreBox(width, height);
	// A radar under the hull bar narrows the centred slot instead of pushing it down.
	const besideRadar = hud.radar && hud.radarPlacement !== "bottom" ? 2 * (hud.radar.x - gap - math.floor(width / 2)) : math.huge;
	const belowWidth = math.min(KILL_MARKER_MAX_WIDTH, width - hud.margin * 2, besideRadar);
	if (below + KILL_MARKER_HEIGHT <= forward.y && belowWidth >= KILL_MARKER_MIN_WIDTH) {
		return centered(width, belowWidth, below, KILL_MARKER_HEIGHT);
	}
	return hud.alert;
}

/** Share of a short (phone) landscape root given to the reading panel. */
export const MENU_PHONE_PANEL_SHARE = 0.6;
/** Share of a tall (tablet/desktop) landscape root given to the reading panel. */
export const MENU_DESKTOP_PANEL_SHARE = 0.44;
export const MENU_PANEL_MAX_WIDTH = 580;
export const MENU_PANEL_MAX_HEIGHT = 560;

/**
 * One panel shared by every menu screen. Landscape keeps it to the left and the
 * display aircraft in the open strip on the right; portrait uses a bottom sheet.
 * Phones in landscape give the copy about 60% of the width: mission text, not
 * the jet, is what the player has to read there.
 */
export function getMenuLayout(viewportWidth: number, viewportHeight: number): MenuLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	if (width >= height * 1.15) {
		const x = math.floor(math.clamp(width * 0.03, 12, 64));
		const share = height < 480 ? MENU_PHONE_PANEL_SHARE : MENU_DESKTOP_PANEL_SHARE;
		const panelWidth = math.floor(math.clamp(width * share, 280, MENU_PANEL_MAX_WIDTH));
		const vertical = height < 240 ? 6 : height < 440 ? 12 : math.floor(math.clamp(height * 0.08, 24, 64));
		const panelHeight = math.min(height - vertical * 2, MENU_PANEL_MAX_HEIGHT);
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

/** Status toasts stay clear of the menu panel, or of the mission HUD (for that input mode) when no menu is shown. */
export function getToastLayout(viewportWidth: number, viewportHeight: number, menu?: MenuLayout, inputMode: InputMode = "keyboard", options?: HudOptions): Rectangle {
	const width = math.max(1, viewportWidth);
	const toastHeight = 44;
	if (menu?.mode === "side") {
		const left = menu.panel.x + menu.panel.width + 16;
		const toastWidth = math.min(380, width - left - 16);
		return { x: left + math.floor((width - left - 16 - toastWidth) / 2), y: 16, width: toastWidth, height: toastHeight };
	}
	if (menu) return centered(width, math.min(380, width - 28), 14, toastHeight);
	const hud = getHudLayout(viewportWidth, viewportHeight, inputMode, options);
	const height = math.max(1, viewportHeight);
	const obstacles = hudObstacles(hud);
	const free = (candidate: Rectangle) => candidate.width >= 1 && candidate.height >= 1 && rectangleInside(candidate, width, height, 0)
		&& !obstacles.some((obstacle) => rectanglesOverlap(candidate, obstacle));
	const healthBottom = hud.health.y + hud.health.height;
	if (viewportHeight < 240) {
		// Compact: the right column between the hull bar and the throttle stick.
		const y = healthBottom + 2;
		const column = hud.touch?.throttle.width ?? JOYSTICK_SIZE;
		const throttleTop = hud.touch?.throttle.y ?? height - hud.margin - JOYSTICK_SIZE;
		return { x: width - hud.margin - column, y, width: column, height: math.max(1, math.min(ALERT_HEIGHT, throttleTop - 2 - y)) };
	}
	const missionToastHeight = 30;
	const candidates: Rectangle[] = [];
	// In a mission the toast lives in the top row between the objective and the
	// clock, so it never enters the forward view.
	const left = hud.callout.x + hud.callout.width + 8;
	const right = math.min(hud.status.x, hud.flightStatus.x, hud.timer.x) - 8;
	if (right - left >= 140) {
		const toastWidth = math.min(380, right - left);
		candidates.push({ x: left + math.floor((right - left - toastWidth) / 2), y: hud.callout.y, width: toastWidth, height: missionToastHeight });
	}
	// Narrow roots use the space beside navigation, up to the first right-column element at that height.
	const besideNavigation = hud.navigation.x + hud.navigation.width + 8;
	const besideTop = math.max(hud.navigation.y, healthBottom + 2);
	let besideRight = width - hud.margin;
	for (const obstacle of obstacles) {
		if (obstacle.x >= besideNavigation && obstacle.y < besideTop + missionToastHeight && obstacle.y + obstacle.height > besideTop) besideRight = math.min(besideRight, obstacle.x - 8);
	}
	if (besideRight - besideNavigation >= 140) candidates.push({ x: besideNavigation, y: besideTop, width: besideRight - besideNavigation, height: missionToastHeight });
	// Otherwise a banner under everything at the top of the screen, then the left column under navigation.
	const alertStackedOnTop = hud.alert.y + hud.alert.height <= height / 2;
	const bannerBottom = math.max(
		hud.callout.y + hud.callout.height,
		hud.status.y + hud.status.height,
		healthBottom,
		hud.navigation.y + hud.navigation.height,
		hud.radar && hud.radarPlacement !== "bottom" ? hud.radar.y + hud.radar.height : 0,
		alertStackedOnTop ? hud.alert.y + hud.alert.height : 0,
	);
	candidates.push(centered(width, math.min(380, math.floor(width * 0.5)), bannerBottom + 8, missionToastHeight));
	const leftRight = hud.radar && hud.radarPlacement !== "bottom" ? hud.radar.x - 8 : width - hud.margin;
	candidates.push({ x: hud.margin, y: hud.navigation.y + hud.navigation.height + 8, width: math.min(380, leftRight - hud.margin), height: missionToastHeight });
	for (const candidate of candidates) if (free(candidate)) return candidate;
	// Nothing free (tiny portrait roots): the transient toast borrows the alert lane.
	return hud.alert;
}

/** Every laid-out HUD rectangle: texts, bars, buttons, radar and touch controls. */
export function hudObstacles(hud: HudLayout): Rectangle[] {
	const rectangles = [hud.callout, hud.timer, hud.status, hud.health, hud.flightStatus, hud.navigation, hud.alert];
	for (const optional of [hud.hints, hud.pause, hud.radar, hud.fireCaption]) if (optional) rectangles.push(optional);
	const touch = hud.touch;
	if (touch) {
		rectangles.push(touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade);
		if (touch.throttleUpLabel) rectangles.push(touch.throttleUpLabel);
		if (touch.throttleDownLabel) rectangles.push(touch.throttleDownLabel);
	}
	return rectangles;
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

/**
 * Horizontal fraction (0-1) where the open scene strip begins, right of a side
 * panel. Used by the backdrop fade and the menu camera framing.
 */
export function getMenuSceneOpening(viewportWidth: number, menu: MenuLayout): number {
	return math.clamp((menu.panel.x + menu.panel.width) / math.max(1, viewportWidth), 0.3, 0.75);
}
