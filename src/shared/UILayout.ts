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

/** column: bottom of the left column (above the steering stick on touch); corner: top-right fallback on roots too short for the column. */
export type RadarPlacement = "column" | "corner";

export interface HudOptions {
	/** Requested touch stick edge in px (clamped to STICK_MIN_SIZE–STICK_MAX_SIZE and to what the root fits). */
	stickSize?: number;
}

/** Type scale: Studio's 320x182 root, phones, and roots at least 900x600 (desktop and tablets). */
export type HudScale = "compact" | "regular" | "large";

export interface HudMetrics {
	scale: HudScale;
	/** Values: SPEED/ALT numbers, weapon rows, the clock. */
	text: number;
	/** Captions: SPEED, ALT, TIME. */
	label: number;
	/** One text row in px. */
	row: number;
	/** SPEED/ALT caption row and box heights. */
	caption: number;
	box: number;
}

export interface WeaponPanelLayout {
	/** The whole panel (what other elements must avoid). */
	frame: Rectangle;
	/** MSL, special, EVD, DMG: one row each, top to bottom. */
	rows: Rectangle[];
	/** Top view of the player's aircraft under the rows; omitted on the short variant. */
	silhouette?: Rectangle;
	/** One missile icon either side of the silhouette (ready rails). */
	rails?: Rectangle[];
}

export interface HudLayout {
	margin: number;
	metrics: HudMetrics;
	/** TIME and objective progress, two lines, top-left right of PAUSE. */
	clock: Rectangle;
	/** Objective (two lines), top row right of the clock. Radio replaces it only when there is no subtitle row. */
	callout: Rectangle;
	/** Fixed slot for the navigation caption when no floating spot fits (under the objective). */
	navigation: Rectangle;
	/** PAUSE button, top-left; omitted on Studio-compact roots (the Roblox menu auto-pauses there). */
	pause?: Rectangle;
	/** Flight-path reticle at the centre; omitted on compact roots, where the action grid sits there. */
	reticle?: Rectangle;
	/** SPEED caption and arrow-tag box, left of the reticle (caption row on top). */
	speed: Rectangle;
	/** ALT caption and arrow-tag box, right of the reticle. */
	altitude: Rectangle;
	/** Boxed warning (MISSILE, STALL, PULL UP, LOW ALT) under the reticle; the same rectangle as `callout` on the shortest compact roots. */
	alert: Rectangle;
	/** Reserved row under the warning for a missile time-to-impact / BREAK cue; the same rectangle as `alert` on compact roots. */
	breakCue: Rectangle;
	/** Square radar, bottom of the left column; omitted when no 72 px square fits. */
	radar?: Rectangle;
	radarPlacement?: RadarPlacement;
	/** Weapon list, damage and aircraft silhouette, bottom of the right column. */
	weapons: WeaponPanelLayout;
	/** Radio subtitle, bottom-centre above the touch buttons or hint row; omitted when no line fits. */
	subtitle?: Rectangle;
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
/** Caption rows above and below the throttle disc. */
export const THROTTLE_LABEL_HEIGHT = 10;
export const ALERT_MAX_WIDTH = 220;
export const ALERT_HEIGHT = 20;
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
/** Smallest radar square; short phone roots (706x267) get one this size rather than none. */
export const RADAR_MIN_SIZE = 72;
/** Largest radar on phones; large roots go up to RADAR_LARGE_SIZE. */
export const RADAR_MAX_SIZE = 110;
export const RADAR_LARGE_SIZE = 170;
export const FIRE_CAPTION_WIDTH = 150;
export const FIRE_CAPTION_HEIGHT = 12;
export const FIRE_SIZE = 64;
export const TARGET_SIZE = 48;
export const SPECIAL_SIZE = 48;
/** Root heights at or below this use the compact (Studio 320x182) arrangement. */
export const COMPACT_MAX_HEIGHT = 200;
/** Rows in the weapon panel: MSL, special, EVD, DMG. */
export const WEAPON_ROWS = 4;
/** Two radio lines at most; one when that is all the room there is. */
export const SUBTITLE_LINES = 2;

interface HudSizes {
	metrics: HudMetrics;
	clockWidth: number;
	/** Instrument (SPEED/ALT) width including the arrow tag. */
	instrument: number;
	reticle: number;
	alertHeight: number;
	alertWidth: number;
	breakCue: number;
	panel: number;
	silhouette: number;
	radarMax: number;
	subtitleWidth: number;
	objectiveWidth: number;
}

const HUD_SIZES: { [scale in HudScale]: HudSizes } = {
	compact: {
		metrics: { scale: "compact", text: 10, label: 8, row: 11, caption: 8, box: 14 },
		clockWidth: 64, instrument: 44, reticle: 0, alertHeight: 18, alertWidth: 200, breakCue: 14,
		panel: 84, silhouette: 0, radarMax: RADAR_MAX_SIZE, subtitleWidth: 300, objectiveWidth: OBJECTIVE_MAX_WIDTH,
	},
	regular: {
		metrics: { scale: "regular", text: 12, label: 10, row: 14, caption: 11, box: 20 },
		clockWidth: 96, instrument: 62, reticle: 24, alertHeight: ALERT_HEIGHT, alertWidth: ALERT_MAX_WIDTH, breakCue: 16,
		panel: 112, silhouette: 44, radarMax: RADAR_MAX_SIZE, subtitleWidth: 440, objectiveWidth: OBJECTIVE_MAX_WIDTH,
	},
	large: {
		metrics: { scale: "large", text: 16, label: 12, row: 19, caption: 14, box: 28 },
		clockWidth: 128, instrument: 86, reticle: 32, alertHeight: 26, alertWidth: 300, breakCue: 20,
		panel: 160, silhouette: 66, radarMax: RADAR_LARGE_SIZE, subtitleWidth: 640, objectiveWidth: 420,
	},
};

/**
 * The type scale for a root: compact below 240pt tall (and for small 4:3 roots
 * under 400x300, such as Studio's pre-inset 320x240), large from 900x600.
 */
export function getHudScale(viewportWidth: number, viewportHeight: number): HudScale {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	if (height < 240 || (width < 400 && height < 300)) return "compact";
	return width >= 900 && height >= 600 ? "large" : "regular";
}

/**
 * The forward view: the central 50% of the width and 60% of the height. Only
 * the centre instruments (reticle, SPEED, ALT, warning and break cue), the
 * target bracket, the navigation cue and the radio subtitle may appear here.
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

const bottomOf = (rectangle: Rectangle) => rectangle.y + rectangle.height;
const rightOf = (rectangle: Rectangle) => rectangle.x + rectangle.width;

/** Weapon panel geometry for a frame: rows on top, then the silhouette flanked by two rail icons. */
export function getWeaponPanelLayout(frame: Rectangle, row: number, silhouette: number): WeaponPanelLayout {
	const rows: Rectangle[] = [];
	for (let index = 0; index < WEAPON_ROWS; index++) rows.push({ x: frame.x, y: frame.y + index * row, width: frame.width, height: row });
	if (silhouette <= 0 || frame.height < WEAPON_ROWS * row + 4 + silhouette) return { frame, rows };
	// The Kestrel is 22.8 studs span by 26 long: the outline box keeps that aspect.
	const outlineWidth = math.floor(silhouette * 0.88);
	const top = frame.y + WEAPON_ROWS * row + 4;
	const outline = { x: frame.x + math.floor((frame.width - outlineWidth) / 2), y: top, width: outlineWidth, height: silhouette };
	const railWidth = math.max(4, math.floor(silhouette * 0.14));
	const railHeight = math.floor(silhouette * 0.62);
	const railY = top + math.floor((silhouette - railHeight) / 2);
	const railGap = math.max(6, math.floor(silhouette * 0.2));
	return {
		frame,
		rows,
		silhouette: outline,
		rails: [
			{ x: outline.x - railGap - railWidth, y: railY, width: railWidth, height: railHeight },
			{ x: rightOf(outline) + railGap, y: railY, width: railWidth, height: railHeight },
		],
	};
}

/**
 * Widest rectangle centred on `centreX` (at most `maxWidth`) in the row y..y+height
 * that stays clear of every obstacle; undefined when narrower than `minWidth`.
 */
function centredFree(centreX: number, y: number, height: number, maxWidth: number, minWidth: number, obstacles: Rectangle[], viewportWidth: number, margin: number): Rectangle | undefined {
	let half = math.min(maxWidth / 2, centreX - margin, viewportWidth - margin - centreX);
	for (const obstacle of obstacles) {
		if (obstacle.y >= y + height || bottomOf(obstacle) <= y) continue;
		if (obstacle.x >= centreX) half = math.min(half, obstacle.x - centreX);
		else if (rightOf(obstacle) <= centreX) half = math.min(half, centreX - rightOf(obstacle));
		else return undefined;
	}
	const width = math.floor(half) * 2;
	if (width < minWidth) return undefined;
	return { x: centreX - width / 2, y, width, height };
}

const clear = (candidate: Rectangle, obstacles: Rectangle[]) => !obstacles.some((obstacle) => rectanglesOverlap(candidate, obstacle));

/** Right end of the free top-row lane that starts at `left`: the first obstacle in the row y..y+height, or `limit`. */
function topLaneRight(left: number, y: number, height: number, obstacles: Rectangle[], limit: number, gap: number): number {
	let right = limit;
	for (const obstacle of obstacles) if (obstacle.x >= left && obstacle.y < y + height && bottomOf(obstacle) > y) right = math.min(right, obstacle.x - gap);
	return right;
}

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode, options?: HudOptions): HudLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const touchMode = inputMode === "touch";
	const scale = getHudScale(width, height);
	const sizes = HUD_SIZES[scale];
	const metrics = sizes.metrics;
	// Preserve a dedicated top warning lane until the bottom controls have enough height.
	const compact = scale === "compact";
	const landscape = width > height;
	const margin = compact || width < 360 ? 6 : height < 300 ? 10 : height < 500 || width < 700 ? 14 : 22;
	const gap = compact ? 6 : 8;
	// Touch controls keep a wider gap so a thumb on one cannot brush the next.
	const controlGap = compact || width < 360 ? 6 : 12;
	const forward = getHudCentreBox(width, height);

	// Top row (CoreUISafeInsets already keeps it below the Roblox buttons and any notch):
	// PAUSE, then TIME / progress, then the objective.
	const pauseSize = touchMode ? PAUSE_SIZE : PAUSE_DESKTOP_SIZE;
	const pause = compact ? undefined : { x: margin, y: margin, width: pauseSize, height: pauseSize };
	const clockX = pause ? rightOf(pause) + gap : margin;
	const clock = { x: clockX, y: margin, width: sizes.clockWidth, height: metrics.row * 2 + 2 };
	const calloutX = rightOf(clock) + gap;
	const callout = {
		x: calloutX,
		y: margin,
		width: math.max(0, math.min(sizes.objectiveWidth, math.floor(width * OBJECTIVE_MAX_SHARE), width - margin - calloutX)),
		height: compact ? 26 : scale === "large" ? metrics.row * 2 + 2 : OBJECTIVE_LINE_HEIGHT,
	};
	const topBottom = math.max(bottomOf(clock), bottomOf(callout), pause ? bottomOf(pause) : 0);
	const navigation = { x: calloutX, y: bottomOf(callout) + 2, width: NAVIGATION_CAPTION_WIDTH, height: NAVIGATION_SLOT_HEIGHT };

	let touch: TouchLayout | undefined;
	let fireCaption: Rectangle | undefined;
	let hints: Rectangle | undefined;
	/** Bottom of the left (radar) and right (weapons) columns. */
	let leftBottom = height - margin;
	let rightBottom = height - margin;
	const placed: Rectangle[] = [clock, callout, ...(pause ? [pause] : [])];

	if (touchMode) {
		// Regular roots lift both sticks so the throttle captions sit outside the
		// disc (above and below) without entering the safe margin.
		const labelLift = compact ? 0 : THROTTLE_LABEL_HEIGHT + 2;
		const tiny = height < 180;
		const evadeSize = compact ? MIN_TOUCH_TARGET : EVADE_SIZE;
		let fireSize = tiny ? MIN_TOUCH_TARGET : FIRE_SIZE;
		let targetSize = tiny ? MIN_TOUCH_TARGET : TARGET_SIZE;
		// Stick size: the request, limited so the action lane, the top row and a stacked EVADE still fit.
		const laneMinimum = compact ? MIN_TOUCH_TARGET * 2 + controlGap : targetSize * 2 + controlGap;
		const fitsWide = math.floor((width - margin * 2 - controlGap * 2 - laneMinimum) / 2);
		const fitsTall = compact
			? height - margin - (topBottom + 2 + NAVIGATION_ROW_HEIGHT + 2)
			: height - margin - labelLift - controlGap - MIN_TOUCH_TARGET - (topBottom + gap);
		// The weapon rows always keep a slot above the throttle.
		const fitsPanel = height - margin - labelLift - (margin + WEAPON_ROWS * metrics.row + gap);
		const requested = math.clamp(math.floor((options?.stickSize ?? JOYSTICK_SIZE) + 0.5), STICK_MIN_SIZE, STICK_MAX_SIZE);
		const stick = math.max(STICK_MIN_SIZE, math.min(requested, fitsWide, fitsTall, fitsPanel));
		const joystick = { x: margin, y: height - margin - labelLift - stick, width: stick, height: stick };
		const throttle = { ...joystick, x: width - margin - stick };
		const throttleUpLabel = compact ? undefined : { x: throttle.x, y: throttle.y - labelLift, width: stick, height: THROTTLE_LABEL_HEIGHT };
		const throttleDownLabel = compact ? undefined : { x: throttle.x, y: throttle.y + stick + 2, width: stick, height: THROTTLE_LABEL_HEIGHT };
		const laneLeft = joystick.x + stick + controlGap;
		const laneRight = throttle.x - controlGap;
		const arrangement: TouchArrangement = laneRight - laneLeft >= targetSize * 2 + fireSize + evadeSize + controlGap * 3 ? "row" : compact ? "grid" : "stacked";
		let missile: Rectangle, target: Rectangle, special: Rectangle, evade: Rectangle;
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
			if (evade.y < topBottom + gap) evade = above(MIN_TOUCH_TARGET);
		}
		touch = { joystick, throttle, throttleUpLabel, throttleDownLabel, missile, target, special, evade, arrangement };
		placed.push(joystick, throttle, missile, target, special, evade);
		for (const optional of [throttleUpLabel, throttleDownLabel, fireCaption]) if (optional) placed.push(optional);
		leftBottom = joystick.y - gap;
		rightBottom = (arrangement === "stacked" ? evade.y : throttleUpLabel?.y ?? throttle.y) - gap;
	} else {
		const hintsHeight = scale === "large" ? 20 : 18;
		hints = centered(width, math.min(360, width - margin * 2), height - margin - hintsHeight, hintsHeight);
	}

	// Right column: the weapon panel, bottom-aligned; the short variant (rows only) where the full one does not fit.
	const panelRows = WEAPON_ROWS * metrics.row;
	const panelX = width - margin - sizes.panel;
	// Landscape roots keep the side panels out of the forward view; portrait and Studio-compact roots have no room beside it.
	const outsideForward = (candidate: Rectangle) => !landscape || compact || !rectanglesOverlap(candidate, forward);
	let weapons: WeaponPanelLayout | undefined;
	for (const panelHeight of sizes.silhouette > 0 ? [panelRows + 4 + sizes.silhouette, panelRows] : [panelRows]) {
		const frame = { x: panelX, y: rightBottom - panelHeight, width: sizes.panel, height: panelHeight };
		if (frame.y >= margin && clear(frame, placed) && outsideForward(frame)) {
			weapons = getWeaponPanelLayout(frame, metrics.row, panelHeight > panelRows ? sizes.silhouette : 0);
			break;
		}
	}
	// Nothing fits above the throttle (portrait slivers): the top-right corner, rows only.
	weapons ??= getWeaponPanelLayout({ x: panelX, y: margin, width: sizes.panel, height: panelRows }, metrics.row, 0);
	placed.push(weapons.frame);

	// Left column: a square radar under the top row (above the steering stick on touch), as large as fits.
	let radar: Rectangle | undefined;
	let radarPlacement: RadarPlacement | undefined;
	const radarLimit = math.min(sizes.radarMax, math.max(RADAR_MIN_SIZE, math.floor(height * 0.3)));
	for (let size = math.min(radarLimit, leftBottom - (topBottom + gap)); size >= RADAR_MIN_SIZE; size -= 2) {
		const candidate = { x: margin, y: leftBottom - size, width: size, height: size };
		if (clear(candidate, [...placed, ...(hints ? [hints] : [])]) && outsideForward(candidate)) { radar = candidate; radarPlacement = "column"; break; }
	}
	if (!radar && !compact) {
		// Short roots: the top-right corner, when the weapon panel left it free.
		for (let size = radarLimit; size >= RADAR_MIN_SIZE; size -= 2) {
			const candidate = { x: width - margin - size, y: margin, width: size, height: size };
			if (bottomOf(candidate) <= rightBottom && clear(candidate, placed) && outsideForward(candidate)) { radar = candidate; radarPlacement = "corner"; break; }
		}
	}
	if (radar) placed.push(radar);

	// Keyboard and gamepad hints: bottom-centre, narrowed between the radar and the weapon panel.
	if (hints) {
		hints = centredFree(math.floor(width / 2), hints.y, hints.height, hints.width, 0, placed, width, margin) ?? { ...hints, width: 0 };
		if (hints.width > 0) placed.push(hints);
	}

	// Centre instruments: reticle, SPEED left and ALT right of it, then the warning
	// box and the break-cue row under it. Moved up (then down) off any obstacle.
	const centreX = math.floor(width / 2);
	const reticleSize = sizes.reticle;
	const offset = math.clamp(math.floor(width * 0.14), math.floor(reticleSize / 2) + 8, 300);
	const alertWidth = math.min(sizes.alertWidth, width - margin * 2);
	const cluster = (centreY: number) => {
		const boxTop = centreY - math.floor(metrics.box / 2);
		const top = boxTop - metrics.caption;
		const speed = { x: centreX - offset - sizes.instrument, y: top, width: sizes.instrument, height: metrics.caption + metrics.box };
		const altitude = { x: centreX + offset, y: top, width: sizes.instrument, height: metrics.caption + metrics.box };
		const reticle = reticleSize > 0 ? { x: centreX - reticleSize / 2, y: centreY - reticleSize / 2, width: reticleSize, height: reticleSize } : undefined;
		const below = math.max(boxTop + metrics.box, reticle ? bottomOf(reticle) : 0) + 4;
		const alert = { x: centreX - math.floor(alertWidth / 2), y: below, width: math.floor(alertWidth / 2) * 2, height: sizes.alertHeight };
		const breakCue = { ...alert, y: bottomOf(alert) + 2, height: sizes.breakCue };
		return { speed, altitude, reticle, alert, breakCue };
	};
	type Cluster = ReturnType<typeof cluster>;
	const clusterRects = (candidate: Cluster) => [candidate.speed, candidate.altitude, ...(candidate.alert !== callout ? [candidate.alert] : []), ...(candidate.breakCue !== candidate.alert ? [candidate.breakCue] : []), ...(candidate.reticle ? [candidate.reticle] : [])];
	const fitsCluster = (candidate: Cluster) => {
		for (const rectangle of clusterRects(candidate)) if (!rectangleInside(rectangle, width, height, margin) || !clear(rectangle, placed)) return false;
		return true;
	};
	let instruments: Cluster | undefined;
	if (compact && touch?.arrangement === "grid") {
		// Studio compact: SPEED and ALT over the 2x2 grid columns, the warning above them.
		// Short roots drop the caption row (the box reads "S 420"); when the warning has no
		// row left it shares the objective line (shown in its place while it lasts), and the
		// break cue always shares the warning row here.
		const full = metrics.caption + metrics.box;
		const instrumentHeight = touch.target.y - gap - full >= topBottom + 2 ? full : metrics.box;
		const top = touch.target.y - gap - instrumentHeight;
		const speed = { x: touch.target.x, y: top, width: touch.target.width, height: instrumentHeight };
		const altitude = { ...speed, x: touch.special.x };
		let alert = { x: touch.target.x, y: top - 2 - sizes.alertHeight, width: rightOf(touch.special) - touch.target.x, height: sizes.alertHeight };
		if (alert.y < topBottom + 2) alert = callout;
		instruments = { speed, altitude, reticle: undefined, alert, breakCue: alert };
	} else {
		const ideal = math.floor(height / 2);
		for (let step = 0; step <= height; step += 2) {
			const up = cluster(ideal - step);
			if (fitsCluster(up)) { instruments = up; break; }
			const down = cluster(ideal + step);
			if (fitsCluster(down)) { instruments = down; break; }
			if (ideal - step < 0 && ideal + step > height) break;
		}
		// No room (tiny portrait slivers): keep the instruments centred and on screen regardless.
		instruments ??= cluster(ideal);
	}
	const { speed, altitude, reticle, alert, breakCue } = instruments;
	for (const rectangle of clusterRects(instruments)) placed.push(rectangle);

	// Radio subtitle: bottom-centre, between the break cue and the buttons (or hint row).
	let subtitle: Rectangle | undefined;
	if (!compact) {
		let floor = height - margin;
		for (const rectangle of placed) {
			// Only what crosses the middle 120 px sets the floor; side columns just narrow the line.
			if (rectangle.y > bottomOf(breakCue) && rectangle.x < centreX + 60 && rightOf(rectangle) > centreX - 60) floor = math.min(floor, rectangle.y);
		}
		const room = floor - 4 - (bottomOf(breakCue) + 4);
		const lines = math.min(SUBTITLE_LINES, math.floor(room / metrics.row));
		if (lines >= 1) {
			const lineHeight = lines * metrics.row;
			subtitle = centredFree(centreX, floor - 4 - lineHeight, lineHeight, sizes.subtitleWidth, 120, placed, width, margin);
			if (subtitle) placed.push(subtitle);
		}
	}

	// The fixed navigation slot: under the objective, trimmed to the first element right of or below it.
	if (compact) {
		navigation.x = margin;
		navigation.width = touch ? touch.joystick.width : math.min(NAVIGATION_CAPTION_WIDTH, rightOf(callout) - margin);
	}
	navigation.y = compact ? topBottom + 2 : navigation.y;
	let navigationRight = math.min(navigation.x + NAVIGATION_CAPTION_MAX_WIDTH, width - margin);
	let navigationBottom = navigation.y + NAVIGATION_SLOT_HEIGHT;
	for (const rectangle of placed) {
		if (rectangle.y < navigationBottom && bottomOf(rectangle) > navigation.y && rectangle.x >= navigation.x + NAVIGATION_CAPTION_WIDTH / 2) navigationRight = math.min(navigationRight, rectangle.x - gap);
	}
	navigation.width = compact ? navigation.width : math.max(0, navigationRight - navigation.x);
	for (const rectangle of placed) {
		if (rectangle.x < navigation.x + navigation.width && rightOf(rectangle) > navigation.x && rectangle.y >= navigation.y) navigationBottom = math.min(navigationBottom, rectangle.y - 2);
	}
	navigation.height = math.max(0, math.min(NAVIGATION_SLOT_HEIGHT, navigationBottom - navigation.y));

	return {
		margin, metrics, clock, callout, navigation, pause, reticle, speed, altitude, alert, breakCue,
		radar, radarPlacement, weapons, subtitle, fireCaption, hints, touch,
	};
}

export const KILL_MARKER_MAX_WIDTH = 220;
export const KILL_MARKER_MIN_WIDTH = 90;
export const KILL_MARKER_HEIGHT = 22;

/**
 * The brief "SPLASH ONE" callout: top row, centred in the lane right of the
 * objective, above the forward view. Narrow roots drop it under the top row
 * (still above the forward view). The Studio compact root has room for
 * neither and borrows the alert lane for the moment.
 */
export function getKillMarkerLayout(viewportWidth: number, viewportHeight: number, inputMode: InputMode, options?: HudOptions): Rectangle {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const hud = getHudLayout(width, height, inputMode, options);
	const gap = 8;
	const obstacles = hudObstacles(hud);
	const forward = getHudCentreBox(width, height);
	const laneLeft = rightOf(hud.callout) + gap;
	const laneRight = topLaneRight(laneLeft, hud.margin, KILL_MARKER_HEIGHT, obstacles, width - hud.margin, gap);
	const fits = (candidate: Rectangle) => candidate.width >= KILL_MARKER_MIN_WIDTH && bottomOf(candidate) <= forward.y && clear(candidate, obstacles);
	const laneWidth = math.min(KILL_MARKER_MAX_WIDTH, laneRight - laneLeft);
	const lane = { x: laneLeft + math.floor((laneRight - laneLeft - laneWidth) / 2), y: hud.margin, width: laneWidth, height: KILL_MARKER_HEIGHT };
	if (fits(lane)) return lane;
	const below = math.max(bottomOf(hud.callout), bottomOf(hud.clock), hud.pause ? bottomOf(hud.pause) : 0) + gap;
	const banner = centredFree(math.floor(width / 2), below, KILL_MARKER_HEIGHT, KILL_MARKER_MAX_WIDTH, KILL_MARKER_MIN_WIDTH, obstacles, width, hud.margin);
	if (banner && fits(banner)) return banner;
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
	const missionToastHeight = hud.metrics.scale === "compact" ? ALERT_HEIGHT : 30;
	const candidates: Rectangle[] = [];
	// In a mission the toast lives in the top row right of the objective, so it never enters the forward view.
	const left = hud.callout.x + hud.callout.width + 8;
	const right = topLaneRight(left, hud.callout.y, missionToastHeight, obstacles, width - hud.margin, 8);
	if (right - left >= (hud.metrics.scale === "compact" ? 96 : 120)) {
		const toastWidth = math.min(380, right - left);
		candidates.push({ x: left + math.floor((right - left - toastWidth) / 2), y: hud.callout.y, width: toastWidth, height: missionToastHeight });
	}
	// Otherwise a banner under the top row, then the column under the navigation slot.
	const topBottom = math.max(hud.callout.y + hud.callout.height, hud.clock.y + hud.clock.height, hud.pause ? hud.pause.y + hud.pause.height : 0);
	const banner = centredFree(math.floor(width / 2), topBottom + 8, missionToastHeight, math.min(380, math.floor(width * 0.5)), 140, obstacles, width, hud.margin);
	if (banner) candidates.push(banner);
	const below = hud.navigation.y + hud.navigation.height + 8;
	const beside = centredFree(math.floor(width / 2), below, missionToastHeight, math.min(380, width - hud.margin * 2), 140, obstacles, width, hud.margin);
	if (beside) candidates.push(beside);
	// Compact: the right column between the weapon rows and the throttle stick.
	if (hud.touch) {
		const y = hud.weapons.frame.y + hud.weapons.frame.height + 2;
		const room = math.min(missionToastHeight, (hud.touch.throttleUpLabel ?? hud.touch.throttle).y - 2 - y);
		if (room >= 16) candidates.push({ x: hud.touch.throttle.x, y, width: hud.touch.throttle.width, height: room });
	}
	for (const candidate of candidates) if (free(candidate)) return candidate;
	// Nothing free (tiny portrait roots): the transient toast borrows the alert lane.
	return hud.alert;
}

/** Every laid-out HUD rectangle: texts, instruments, panels, buttons, radar and touch controls. */
export function hudObstacles(hud: HudLayout): Rectangle[] {
	const rectangles = [hud.clock, hud.callout, hud.navigation, hud.speed, hud.altitude, hud.weapons.frame];
	// Compact roots may share rows: the warning with the objective, the break cue with the warning.
	if (hud.alert !== hud.callout) rectangles.push(hud.alert);
	if (hud.breakCue !== hud.alert) rectangles.push(hud.breakCue);
	for (const optional of [hud.reticle, hud.subtitle, hud.hints, hud.pause, hud.radar, hud.fireCaption]) if (optional && optional.width > 0) rectangles.push(optional);
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

export interface PauseLayout {
	panel: Rectangle;
	/** Relative to the panel. */
	title: Rectangle;
	/** RESUME, SETTINGS, MAIN MENU; relative to the panel. */
	buttons: Rectangle[];
}

/** Centred pause card over the dimmed mission: a title and three full-width 44+ px buttons. */
export function getPauseLayout(viewportWidth: number, viewportHeight: number): PauseLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const padding = height < 240 ? 8 : 16;
	const gap = height < 240 ? 6 : 8;
	const titleHeight = height < 240 ? 20 : 28;
	const available = height - 12 - padding * 2 - titleHeight - gap * 3;
	const button = math.clamp(math.floor(available / 3), MIN_TOUCH_TARGET, 52);
	const panelWidth = math.min(300, width - 24);
	// Too short for a column of three (Studio compact): one row of three buttons.
	const row = available < MIN_TOUCH_TARGET * 3;
	const panelHeight = row ? padding * 2 + titleHeight + gap + MIN_TOUCH_TARGET : padding * 2 + titleHeight + gap * 3 + button * 3;
	const panel = { x: math.floor((width - panelWidth) / 2), y: math.max(6, math.floor((height - panelHeight) / 2)), width: panelWidth, height: panelHeight };
	const title = { x: padding, y: padding, width: panelWidth - padding * 2, height: titleHeight };
	const buttons: Rectangle[] = [];
	const cell = math.floor((panelWidth - padding * 2 - gap * 2) / 3);
	for (let index = 0; index < 3; index++) {
		buttons.push(row
			? { x: padding + index * (cell + gap), y: title.y + titleHeight + gap, width: cell, height: MIN_TOUCH_TARGET }
			: { x: padding, y: title.y + titleHeight + gap + index * (button + gap), width: panelWidth - padding * 2, height: button });
	}
	return { panel, title, buttons };
}

export interface SettingsLayout {
	panel: Rectangle;
	/** Title row, relative to the panel. */
	header: Rectangle;
	/** Scrolling list of setting rows, relative to the panel. */
	list: Rectangle;
	rowHeight: number;
	/** DONE button, relative to the panel. */
	done: Rectangle;
	/** − / + stepper buttons (and the toggle) are square, this size. */
	control: number;
	/** Width of the value text between the stepper buttons. */
	valueWidth: number;
}

export const SETTINGS_ROWS = 6;

/** The settings sheet: header, a scrolling list of 48 px rows with 44 px steppers, and DONE. */
export function getSettingsLayout(viewportWidth: number, viewportHeight: number): SettingsLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const padding = height < 240 ? 8 : 14;
	const headerHeight = height < 240 ? 22 : 30;
	const rowHeight = MIN_TOUCH_TARGET + 4;
	const panelWidth = math.min(460, width - 16);
	const panelHeight = math.min(height - 12, padding * 2 + headerHeight + 6 + SETTINGS_ROWS * rowHeight + 8 + MIN_TOUCH_TARGET);
	const panel = { x: math.floor((width - panelWidth) / 2), y: math.floor((height - panelHeight) / 2), width: panelWidth, height: panelHeight };
	const header = { x: padding, y: padding, width: panelWidth - padding * 2, height: headerHeight };
	const done = { x: padding, y: panelHeight - padding - MIN_TOUCH_TARGET, width: panelWidth - padding * 2, height: MIN_TOUCH_TARGET };
	const listTop = header.y + headerHeight + 6;
	const list = { x: padding, y: listTop, width: panelWidth - padding * 2, height: math.max(rowHeight, done.y - 8 - listTop) };
	return { panel, header, list, rowHeight, done, control: MIN_TOUCH_TARGET, valueWidth: panelWidth < 360 ? 52 : 64 };
}
