// Mission HUD layout: type scale and metrics per root size, touch controls (sticks, action row/grid,
// GUN), getHudLayout's placement of clock, objective, navigation slot, instruments, warning rows,
// radar, status panel, subtitle and hints, plus the kill-marker and toast placement around it.
// Kept pure and shared so ServerStorage-hosted Roblox Jest tests can import it.
import { hudTextWidth, STATUS_SEPARATOR, STATUS_SEPARATOR_TIGHT, statusMaxChars } from "./HudInstruments";
import {
	bottomOf,
	centered,
	centredFree,
	clear,
	freeHalf,
	MIN_TOUCH_TARGET,
	rectangleInside,
	rectanglesOverlap,
	rightOf,
	topLaneRight,
	type Rectangle,
} from "./UILayoutGeometry";
import type { InputMode } from "./UILayoutInput";
import type { MenuLayout } from "./UILayoutMenu";

export interface TouchLayout {
	joystick: Rectangle;
	/** Right analog stick disc; the same size as the steering stick. */
	throttle: Rectangle;
	/** "SPEED UP" caption centred above the throttle disc; omitted on compact roots. */
	throttleUpLabel?: Rectangle;
	/** "SLOW DOWN" caption centred below the throttle disc; omitted on compact roots. */
	throttleDownLabel?: Rectangle;
	/** FIRE, TGT, SPECIAL and EVADE are the same size (`button`): FIRE stands out by fill, not size. */
	missile: Rectangle;
	target: Rectangle;
	/** Second weapon slot button (FLR, UAV, 4AAM, XLAA). */
	special: Rectangle;
	/** Round EVADE button, nearest the throttle. */
	evade: Rectangle;
	/** Hold-to-fire GUN (batch D1): only when the sortie fits a gun and a free spot clears every other control. */
	gun?: Rectangle;
	/** Edge of every action button, px. */
	button: number;
	/** row: TGT FIRE SPECIAL EVADE on one baseline between the sticks; grid: TGT SPECIAL over FIRE EVADE (roots too narrow for the row). */
	arrangement: TouchArrangement;
}

export type TouchArrangement = "row" | "grid";

/** column: bottom of the left column (above the steering stick on touch); corner: top-right fallback on roots too short for the column. */
export type RadarPlacement = "column" | "corner";

export interface HudOptions {
	/** Requested touch stick edge in px (clamped to STICK_MIN_SIZE–STICK_MAX_SIZE and to what the root fits). */
	stickSize?: number;
	/** Effective HUD SCALE: the UIScale the layout is drawn through. Text sizes rise so nothing draws under MIN_PHYSICAL_TEXT px. */
	scale?: number;
	/** The sortie fits a gun (batch D1): touch layouts add a GUN button. Absent leaves every layout unchanged. */
	gun?: boolean;
}

/** Smallest text the HUD draws, in physical px after its UIScale. */
export const MIN_PHYSICAL_TEXT = 8;

/** Smallest layout text size that draws at MIN_PHYSICAL_TEXT px through a UIScale of `scale`. */
export function minHudTextSize(scale = 1): number {
	return math.max(1, math.ceil(MIN_PHYSICAL_TEXT / math.max(scale, 0.01) - 1e-6));
}

/** Type scale: Studio's 320x182 root, phones, and roots at least 900x600 (desktop and tablets). */
export type HudScale = "compact" | "regular" | "large";

export interface HudMetrics {
	scale: HudScale;
	/** Values: the clock, warnings and break cue. */
	text: number;
	/** Captions: the radar heading letters. */
	label: number;
	/** One text row in px. */
	row: number;
	/** SPEED/ALT caption row and box heights. */
	caption: number;
	box: number;
	/** SPEED/ALT value and caption text sizes. */
	instrumentText: number;
	instrumentLabel: number;
	/** Smallest text size for this HUD scale (MIN_PHYSICAL_TEXT px once drawn): the floor for shrink-to-fit labels. */
	minText: number;
}

/** Hull bar with one small ammo line under it (MSL · special · EVD). */
export interface StatusPanelLayout {
	/** The whole panel (what other elements must avoid). */
	frame: Rectangle;
	bar: Rectangle;
	line: Rectangle;
	/** Text size of the ammo line: the longest line the game can show fits `line` at it, never under `minText`. */
	text: number;
	/** STATUS_SEPARATOR, or STATUS_SEPARATOR_TIGHT where the spaced line would not fit at full size. */
	separator: string;
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
	/** Reserved row under the warning for a missile time-to-impact / BREAK cue; the same rectangle as `alert` on compact and crowded touch roots. */
	breakCue: Rectangle;
	/** Square radar, bottom of the left column; omitted when no 72 px square fits. */
	radar?: Rectangle;
	radarPlacement?: RadarPlacement;
	/** Hull bar and ammo line: above the throttle on touch, bottom-right otherwise; top-right where that has no room. */
	status: StatusPanelLayout;
	/** Radio subtitle, bottom-centre above the touch buttons or hint row; omitted when no line fits. */
	subtitle?: Rectangle;
	/** Touch row arrangement: one line above FIRE for refusals ("NO LOCK · FIRING BLIND"). Elsewhere refusals use the alert lane. */
	fireCaption?: Rectangle;
	/** Keyboard and gamepad only; touch players read the controls themselves. */
	hints?: Rectangle;
	/** Touch only; never laid out for keyboard or gamepad play. */
	touch?: TouchLayout;
}

/** The objective line never takes more than this share of the root width. */
const OBJECTIVE_MAX_SHARE = 0.38;
const OBJECTIVE_MAX_WIDTH = 340;
/** Narrowest objective when the weapon grid has to share the top row with it. */
export const OBJECTIVE_MIN_WIDTH = 120;
/** Two 11pt lines: long objectives and story radio wrap instead of shrinking below 10pt. */
export const OBJECTIVE_LINE_HEIGHT = 30;
/** Caption rows above and below the throttle disc. */
const THROTTLE_LABEL_HEIGHT = 10;
const ALERT_MAX_WIDTH = 220;
const ALERT_HEIGHT = 20;
/** Narrowest warning box (and break-cue row) when the centre is crowded: "MISSILE INBOUND" at 10pt. */
const ALERT_MIN_WIDTH = 120;
export const NAVIGATION_CAPTION_WIDTH = 120;
export const NAVIGATION_CAPTION_HEIGHT = 28;
/** Widest floating navigation caption; longer detail lines wrap instead of truncating. */
export const NAVIGATION_CAPTION_MAX_WIDTH = 200;
/** One caption row (10pt text). */
export const NAVIGATION_ROW_HEIGHT = 13;
/** The fixed navigation slot holds the distance plus two wrapped detail rows. */
export const NAVIGATION_SLOT_HEIGHT = NAVIGATION_ROW_HEIGHT * 3 + 2;
/** Default touch stick edge; STICK SIZE scales it 85%–130% (68–104 px). */
export const JOYSTICK_SIZE = 80;
/** Smallest stick the layout will shrink to so the action row still fits. */
export const STICK_MIN_SIZE = 64;
export const STICK_MAX_SIZE = 112;
/** TGT, FIRE, SPECIAL and EVADE: one size, on one baseline. */
export const ACTION_BUTTON_SIZE = 54;
export const PAUSE_SIZE = 44;
/** Keyboard and gamepad roots use a smaller mouse-sized pause button. */
const PAUSE_DESKTOP_SIZE = 32;
/** Smallest radar square; short phone roots (706x267) get one this size rather than none. */
export const RADAR_MIN_SIZE = 72;
/** Largest radar on phones; large roots go up to RADAR_LARGE_SIZE. */
export const RADAR_MAX_SIZE = 110;
export const RADAR_LARGE_SIZE = 170;
const FIRE_CAPTION_WIDTH = 150;
export const FIRE_CAPTION_HEIGHT = 12;
/** Root heights at or below this use the compact (Studio 320x182) arrangement. */
export const COMPACT_MAX_HEIGHT = 200;
const KILL_MARKER_MAX_WIDTH = 220;
export const KILL_MARKER_MIN_WIDTH = 90;
const KILL_MARKER_HEIGHT = 22;
/** Gap between the hull bar and the ammo line under it. */
export const STATUS_GAP = 3;
/** Narrowest status panel at HUD SCALE 100%+ (smaller scales need the room for larger type). */
export const STATUS_MIN_WIDTH = 96;
/** Spare px the longest ammo line leaves in its label, beyond RobotoMono's advance arithmetic (stroke, rasterisation). */
export const STATUS_TEXT_PAD = 2;
/** Two radio lines at most; one when that is all the room there is. */
const SUBTITLE_LINES = 2;

interface HudSizes {
	metrics: HudMetrics;
	clockWidth: number;
	/** Instrument (SPEED/ALT) width including the arrow tag. */
	instrument: number;
	reticle: number;
	alertHeight: number;
	alertWidth: number;
	breakCue: number;
	/** Status panel width (the widest ammo line, "MSL 8 · 4AAM ON · EVD 3", at `statusText`), bar height and line row. */
	status: number;
	statusBar: number;
	statusText: number;
	statusRow: number;
	radarMax: number;
	subtitleWidth: number;
	objectiveWidth: number;
}

const HUD_SIZES: { [scale in HudScale]: HudSizes } = {
	// SPEED/ALT (instrument, caption, box and their type) are ~20% under PR #44's 62/11/20 (regular) and 96/15/30 (large);
	// Studio-compact boxes already sit at the smallest readable type and keep their size.
	compact: {
		metrics: {
			scale: "compact",
			text: 10,
			label: 8,
			row: 11,
			caption: 8,
			box: 14,
			instrumentText: 10,
			instrumentLabel: 8,
			minText: 8,
		},
		clockWidth: 64,
		instrument: 44,
		reticle: 0,
		alertHeight: 18,
		alertWidth: 200,
		breakCue: 14,
		status: 100,
		statusBar: 5,
		statusText: 8,
		statusRow: 10,
		radarMax: RADAR_MAX_SIZE,
		subtitleWidth: 300,
		objectiveWidth: OBJECTIVE_MAX_WIDTH,
	},
	regular: {
		metrics: {
			scale: "regular",
			text: 12,
			label: 10,
			row: 14,
			caption: 9,
			box: 16,
			instrumentText: 10,
			instrumentLabel: 8,
			minText: 8,
		},
		clockWidth: 96,
		instrument: 50,
		reticle: 24,
		alertHeight: ALERT_HEIGHT,
		alertWidth: ALERT_MAX_WIDTH,
		breakCue: 16,
		status: 144,
		statusBar: 6,
		statusText: 10,
		statusRow: 12,
		radarMax: RADAR_MAX_SIZE,
		subtitleWidth: 440,
		objectiveWidth: OBJECTIVE_MAX_WIDTH,
	},
	large: {
		metrics: {
			scale: "large",
			text: 18,
			label: 13,
			row: 22,
			caption: 12,
			box: 24,
			instrumentText: 14,
			instrumentLabel: 10,
			minText: 8,
		},
		clockWidth: 140,
		instrument: 76,
		reticle: 34,
		alertHeight: 28,
		alertWidth: 300,
		breakCue: 22,
		status: 192,
		statusBar: 8,
		statusText: 13,
		statusRow: 16,
		radarMax: RADAR_LARGE_SIZE,
		subtitleWidth: 640,
		objectiveWidth: 420,
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

/** Status panel geometry for a frame: the hull bar on top, the ammo line under it. */
function statusPanel(frame: Rectangle, bar: number, row: number, text: number, separator: string): StatusPanelLayout {
	return {
		frame,
		bar: { x: frame.x, y: frame.y, width: frame.width, height: bar },
		line: { x: frame.x, y: frame.y + bar + STATUS_GAP, width: frame.width, height: row },
		text,
		separator,
	};
}

/** Every text size raised to the floor for the HUD scale; the rows holding them grow by the same amount. */
function scaledMetrics(base: HudMetrics, minText: number): HudMetrics {
	const text = math.max(base.text, minText);
	const label = math.max(base.label, minText);
	const instrumentText = math.max(base.instrumentText, minText);
	const instrumentLabel = math.max(base.instrumentLabel, minText);
	return {
		...base,
		text,
		label,
		instrumentText,
		instrumentLabel,
		minText,
		row: base.row + text - base.text,
		caption: base.caption + instrumentLabel - base.instrumentLabel,
		box: base.box + instrumentText - base.instrumentText,
	};
}

/** Safe margin between the HUD and the root edge: 6 px on compact or very narrow roots, up to 22 px on large ones. */
function hudMargin(width: number, height: number, compact: boolean): number {
	return compact || width < 360 ? 6 : height < 300 ? 10 : height < 500 || width < 700 ? 14 : 22;
}

/**
 * Touch controls: both sticks in the bottom corners and TGT, FIRE, SPECIAL, EVADE
 * as four same-size round buttons on one baseline, centred between the sticks.
 * They depend only on the root and the stick setting (never on the instruments):
 * thumbs learn where they are, so the HUD instruments adapt to the controls.
 * The stick gives way (down to STICK_MIN_SIZE) before the row does; roots too
 * narrow for the row even then (Studio's 320x182, portrait) get a 2x2 grid.
 * The stick limit reserves the top rows as fixed numbers: the 30 px objective,
 * 2 px, the 41 px navigation slot, then an 18 px warning row.
 */
function getTouchLayout(
	width: number,
	height: number,
	options?: HudOptions,
): { touch: TouchLayout; fireCaption?: Rectangle } {
	const compact = height < 240;
	const margin = hudMargin(width, height, compact);
	const gap = compact ? 6 : 8;
	// Touch controls keep a wider gap so a thumb on one cannot brush the next.
	const controlGap = compact || width < 360 ? 6 : 12;
	const objectiveBottom = margin + 30 + 2;
	// Regular roots lift both sticks so the throttle captions sit outside the
	// disc (above and below) without entering the safe margin.
	const labelLift = compact ? 0 : THROTTLE_LABEL_HEIGHT + 2;
	/** Widest stick that leaves `lane` px between the sticks. */
	const stickFor = (lane: number) => math.floor((width - margin * 2 - controlGap * 2 - lane) / 2);
	// The row with the touch spacing, then a tighter one; else the 2x2 grid.
	let arrangement: TouchArrangement = "grid";
	let button = MIN_TOUCH_TARGET,
		spacing = controlGap;
	for (const between of [controlGap, 6]) {
		if (stickFor(ACTION_BUTTON_SIZE * 4 + between * 3) < STICK_MIN_SIZE) continue;
		arrangement = "row";
		button = ACTION_BUTTON_SIZE;
		spacing = between;
		break;
	}
	// Grid: the 44 px minimum on short roots (Studio), as large as the lane allows on tall portrait ones.
	if (arrangement === "grid" && getHudScale(width, height) !== "compact")
		button = math.clamp(
			math.floor((width - margin * 2 - controlGap * 3 - STICK_MIN_SIZE * 2) / 2),
			MIN_TOUCH_TARGET,
			ACTION_BUTTON_SIZE,
		);
	const lane = arrangement === "row" ? button * 4 + spacing * 3 : button * 2 + controlGap;
	// Stick size: the request, limited so the action lane and the reserved top rows still fit.
	const fitsTall = compact
		? height - margin - (objectiveBottom + NAVIGATION_ROW_HEIGHT + 2)
		: height - margin - labelLift - (objectiveBottom + 41 + gap + 18 + gap);
	const requested = math.clamp(
		math.floor((options?.stickSize ?? JOYSTICK_SIZE) + 0.5),
		STICK_MIN_SIZE,
		STICK_MAX_SIZE,
	);
	const stick = math.max(STICK_MIN_SIZE, math.min(requested, stickFor(lane), fitsTall));
	const joystick = { x: margin, y: height - margin - labelLift - stick, width: stick, height: stick };
	const throttle = { ...joystick, x: width - margin - stick };
	const throttleUpLabel = compact
		? undefined
		: { x: throttle.x, y: throttle.y - labelLift, width: stick, height: THROTTLE_LABEL_HEIGHT };
	const throttleDownLabel = compact
		? undefined
		: { x: throttle.x, y: throttle.y + stick + 2, width: stick, height: THROTTLE_LABEL_HEIGHT };
	const centreX = math.floor(width / 2);
	const bottom = height - margin;
	const cell = (x: number, y: number): Rectangle => ({ x, y, width: button, height: button });
	let missile: Rectangle, target: Rectangle, special: Rectangle, evade: Rectangle;
	let fireCaption: Rectangle | undefined;
	if (arrangement === "row") {
		// Left to right: TGT, FIRE, SPECIAL, EVADE (nearest the right thumb), evenly spaced on one baseline.
		const left = centreX - math.floor(lane / 2);
		const y = bottom - button;
		[target, missile, special, evade] = [0, 1, 2, 3].map((index) => cell(left + index * (button + spacing), y));
		const fireCentre = missile.x + button / 2;
		const captionWidth = math.min(FIRE_CAPTION_WIDTH, math.floor(fireCentre - rightOf(joystick) - controlGap) * 2);
		fireCaption = {
			x: math.floor(fireCentre - captionWidth / 2),
			y: missile.y - 2 - FIRE_CAPTION_HEIGHT,
			width: captionWidth,
			height: FIRE_CAPTION_HEIGHT,
		};
	} else {
		// TGT SPECIAL over FIRE EVADE, centred between the sticks.
		const left = centreX - math.floor(controlGap / 2) - button;
		const right = left + button + controlGap;
		const lower = bottom - button;
		const upper = lower - controlGap - button;
		missile = cell(left, lower);
		evade = cell(right, lower);
		target = cell(left, upper);
		special = cell(right, upper);
	}
	let gun: Rectangle | undefined;
	if (options?.gun === true) {
		// First free spot below the objective and navigation rows, clear of every other control and caption;
		// the instruments and warning row are placed afterwards around it (getHudLayout's `placed`).
		const reservedTop = compact ? objectiveBottom + NAVIGATION_ROW_HEIGHT + 2 : objectiveBottom + 41 + gap;
		const taken = [joystick, throttle, missile, target, special, evade];
		for (const optional of [throttleUpLabel, throttleDownLabel, fireCaption]) if (optional) taken.push(optional);
		const above = (rectangle: Rectangle) => cell(rectangle.x, rectangle.y - controlGap - button);
		const candidates =
			arrangement === "row"
				? [above(target), above(special), above(evade), above(fireCaption ?? missile)]
				: compact
					? // Studio's compact grid keeps SPEED/ALT above it: try beside the lower row instead.
						[cell(missile.x - controlGap - button, missile.y), cell(rightOf(evade) + controlGap, evade.y)]
					: [above(target), above(special)];
		for (const candidate of candidates) {
			if (
				candidate.y < reservedTop ||
				!rectangleInside(candidate, width, height, margin) ||
				!clear(candidate, taken)
			)
				continue;
			gun = candidate;
			break;
		}
	}
	return {
		touch: {
			joystick,
			throttle,
			throttleUpLabel,
			throttleDownLabel,
			missile,
			target,
			special,
			evade,
			gun,
			button,
			arrangement,
		},
		fireCaption,
	};
}

/** Pure layout calculation shared by the React HUD and Roblox Jest tests. */
export function getHudLayout(
	viewportWidth: number,
	viewportHeight: number,
	inputMode: InputMode,
	options?: HudOptions,
): HudLayout {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const touchMode = inputMode === "touch";
	const scale = getHudScale(width, height);
	const sizes = HUD_SIZES[scale];
	const minText = minHudTextSize(options?.scale);
	const metrics = scaledMetrics(sizes.metrics, minText);
	// Preserve a dedicated top warning lane until the bottom controls have enough height.
	const compact = scale === "compact";
	const landscape = width > height;
	const margin = hudMargin(width, height, compact);
	const gap = compact ? 6 : 8;
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
		width: math.max(
			0,
			math.min(sizes.objectiveWidth, math.floor(width * OBJECTIVE_MAX_SHARE), width - margin - calloutX),
		),
		height: compact ? 26 : scale === "large" ? metrics.row * 2 + 2 : OBJECTIVE_LINE_HEIGHT,
	};
	const topBottom = math.max(bottomOf(clock), bottomOf(callout), pause ? bottomOf(pause) : 0);
	const navigation = {
		x: calloutX,
		y: bottomOf(callout) + 2,
		width: NAVIGATION_CAPTION_WIDTH,
		height: NAVIGATION_SLOT_HEIGHT,
	};

	let touch: TouchLayout | undefined;
	let fireCaption: Rectangle | undefined;
	let hints: Rectangle | undefined;
	/** Bottom of the left (radar) and right (status) columns. */
	let leftBottom = height - margin;
	let rightBottom = height - margin;
	const placed: Rectangle[] = [clock, callout, ...(pause ? [pause] : [])];

	if (touchMode) {
		const controls = getTouchLayout(width, height, options);
		touch = controls.touch;
		fireCaption = controls.fireCaption;
		const { joystick, throttle, throttleUpLabel, throttleDownLabel, missile, target, special, evade } = touch;
		placed.push(joystick, throttle, missile, target, special, evade);
		for (const optional of [throttleUpLabel, throttleDownLabel, fireCaption, touch.gun])
			if (optional) placed.push(optional);
		leftBottom = joystick.y - gap;
		rightBottom = (throttleUpLabel?.y ?? throttle.y) - gap;
	} else {
		const hintsHeight = scale === "large" ? 20 : 18;
		hints = centered(width, math.min(360, width - margin * 2), height - margin - hintsHeight, hintsHeight);
	}

	// Right column: the hull bar and ammo line, bottom-aligned (right above the throttle on touch).
	// Landscape roots narrow it to the strip right of the forward view, never below the longest tight line at the floor size.
	// The ammo line keeps the spaced separator where its longest line fits at full size; else the tight one, shrunk to fit.
	const statusFull = math.max(sizes.statusText, minText);
	const tightChars = statusMaxChars(true);
	const lineWidth = (chars: number, size: number) => math.ceil(hudTextWidth(chars, size)) + STATUS_TEXT_PAD;
	const statusMinWidth = math.max(STATUS_MIN_WIDTH, lineWidth(tightChars, minText));
	const forwardRight = landscape && !compact ? width - margin - rightOf(forward) : sizes.status;
	const statusPreferred = math.max(sizes.status, lineWidth(tightChars, statusFull));
	const statusWidth = math.min(statusPreferred, math.max(statusMinWidth, forwardRight), width - margin * 2);
	const statusSpaced = lineWidth(statusMaxChars(false), statusFull) <= statusWidth;
	const statusText = statusSpaced
		? statusFull
		: math.clamp(math.floor((statusWidth - STATUS_TEXT_PAD) / hudTextWidth(tightChars, 1)), minText, statusFull);
	const statusRow = math.max(sizes.statusRow, statusText + 2);
	const statusHeight = sizes.statusBar + STATUS_GAP + statusRow;
	const statusX = width - margin - statusWidth;
	// Landscape roots keep the side panels out of the forward view; portrait and Studio-compact roots have no room beside it.
	const outsideForward = (candidate: Rectangle) => !landscape || compact || !rectanglesOverlap(candidate, forward);
	// On top of whatever is under its span: the throttle caption, or (portrait) a grid button reaching under it.
	let statusBottom = rightBottom;
	for (const rectangle of placed)
		if (rectangle.y > topBottom && rectangle.x < statusX + statusWidth && rightOf(rectangle) > statusX)
			statusBottom = math.min(statusBottom, rectangle.y - gap);
	const bottomRight = { x: statusX, y: statusBottom - statusHeight, width: statusWidth, height: statusHeight };
	const corner = { x: statusX, y: margin, width: statusWidth, height: statusHeight };
	const besideObjective = placed.filter((rectangle) => rectangle !== callout);
	const bottomFits = bottomRight.y >= topBottom + gap && clear(bottomRight, placed);
	// Above the throttle; else the top-right corner, narrowing the objective (never below OBJECTIVE_MIN_WIDTH);
	// else above the throttle reaching into the forward view's edge (crowded small roots at HUD SCALE 130%).
	let statusFrame: Rectangle | undefined = bottomFits && outsideForward(bottomRight) ? bottomRight : undefined;
	if (
		!statusFrame &&
		bottomOf(corner) <= rightBottom &&
		clear(corner, besideObjective) &&
		outsideForward(corner) &&
		corner.x - gap - callout.x >= OBJECTIVE_MIN_WIDTH
	) {
		if (rectanglesOverlap(corner, callout)) callout.width = corner.x - gap - callout.x;
		statusFrame = corner;
	}
	if (!statusFrame && bottomFits) statusFrame = bottomRight;
	// Nothing fits (portrait slivers): the top-right corner regardless.
	const status = statusPanel(
		statusFrame ?? { x: statusX, y: margin, width: statusWidth, height: statusHeight },
		sizes.statusBar,
		statusRow,
		statusText,
		statusSpaced ? STATUS_SEPARATOR : STATUS_SEPARATOR_TIGHT,
	);
	placed.push(status.frame);

	// Left column: a square radar under the top row (above the steering stick on touch), as large as fits.
	let radar: Rectangle | undefined;
	let radarPlacement: RadarPlacement | undefined;
	const radarLimit = math.min(sizes.radarMax, math.max(RADAR_MIN_SIZE, math.floor(height * 0.3)));
	for (let size = math.min(radarLimit, leftBottom - (topBottom + gap)); size >= RADAR_MIN_SIZE; size -= 2) {
		const candidate = { x: margin, y: leftBottom - size, width: size, height: size };
		if (clear(candidate, [...placed, ...(hints ? [hints] : [])]) && outsideForward(candidate)) {
			radar = candidate;
			radarPlacement = "column";
			break;
		}
	}
	if (!radar && !compact) {
		// Short roots: the top-right corner, when the status panel left it free and the top row keeps a lane for the kill callout and toasts.
		for (let size = radarLimit; size >= RADAR_MIN_SIZE; size -= 2) {
			const candidate = { x: width - margin - size, y: margin, width: size, height: size };
			const laneLeft = rightOf(callout) + gap;
			if (candidate.x - gap - laneLeft < KILL_MARKER_MIN_WIDTH) break;
			if (bottomOf(candidate) <= rightBottom && clear(candidate, placed) && outsideForward(candidate)) {
				radar = candidate;
				radarPlacement = "corner";
				break;
			}
		}
	}
	if (radar) placed.push(radar);

	// Keyboard and gamepad hints: bottom-centre, narrowed between the radar and the status panel.
	if (hints) {
		hints = centredFree(math.floor(width / 2), hints.y, hints.height, hints.width, 0, placed, width, margin) ?? {
			...hints,
			width: 0,
		};
		if (hints.width > 0) placed.push(hints);
	}

	// Centre instruments: reticle, SPEED left and ALT right of it, then the warning
	// box and the break-cue row under it. Moved up (then down) off any obstacle.
	const centreX = math.floor(width / 2);
	const reticleSize = sizes.reticle;
	const offset = math.clamp(math.floor(width * 0.14), math.floor(reticleSize / 2) + 8, 300);
	const alertWidth = math.min(sizes.alertWidth, width - margin * 2);
	/**
	 * `fit` 1: tighten SPEED/ALT towards the reticle and narrow the warning rows to the free span at this height;
	 * 2: also let the break cue share the warning row (as on compact roots).
	 */
	const cluster = (centreY: number, fit = 0) => {
		const boxTop = centreY - math.floor(metrics.box / 2);
		const top = boxTop - metrics.caption;
		const reticle =
			reticleSize > 0
				? {
						x: centreX - reticleSize / 2,
						y: centreY - reticleSize / 2,
						width: reticleSize,
						height: reticleSize,
					}
				: undefined;
		const below = math.max(boxTop + metrics.box, reticle ? bottomOf(reticle) : 0) + 4;
		let instrumentOffset = offset,
			warningWidth = alertWidth;
		const sharedCue = fit >= 2;
		if (fit >= 1) {
			instrumentOffset = math.min(
				offset,
				freeHalf(centreX, top, metrics.caption + metrics.box, placed, width, margin) - sizes.instrument,
			);
			warningWidth = math.min(
				alertWidth,
				2 *
					freeHalf(
						centreX,
						below,
						sizes.alertHeight + (sharedCue ? 0 : 2 + sizes.breakCue),
						placed,
						width,
						margin,
					),
			);
		}
		const speed = {
			x: centreX - instrumentOffset - sizes.instrument,
			y: top,
			width: sizes.instrument,
			height: metrics.caption + metrics.box,
		};
		const altitude = {
			x: centreX + instrumentOffset,
			y: top,
			width: sizes.instrument,
			height: metrics.caption + metrics.box,
		};
		const alert = {
			x: centreX - math.floor(warningWidth / 2),
			y: below,
			width: math.floor(warningWidth / 2) * 2,
			height: sizes.alertHeight,
		};
		const breakCue = sharedCue ? alert : { ...alert, y: bottomOf(alert) + 2, height: sizes.breakCue };
		const usable = instrumentOffset >= math.floor(reticleSize / 2) + 4 && alert.width >= ALERT_MIN_WIDTH;
		return { speed, altitude, reticle, alert, breakCue, usable };
	};
	type Cluster = ReturnType<typeof cluster>;
	const clusterRects = (candidate: Cluster) => [
		candidate.speed,
		candidate.altitude,
		...(candidate.alert !== callout ? [candidate.alert] : []),
		...(candidate.breakCue !== candidate.alert ? [candidate.breakCue] : []),
		...(candidate.reticle ? [candidate.reticle] : []),
	];
	const fitsCluster = (candidate: Cluster) => {
		if (!candidate.usable) return false;
		for (const rectangle of clusterRects(candidate))
			if (!rectangleInside(rectangle, width, height, margin) || !clear(rectangle, placed)) return false;
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
		let alert = {
			x: touch.target.x,
			y: top - 2 - sizes.alertHeight,
			width: rightOf(touch.special) - touch.target.x,
			height: sizes.alertHeight,
		};
		if (alert.y < topBottom + 2) alert = callout;
		instruments = { speed, altitude, reticle: undefined, alert, breakCue: alert, usable: true };
	} else {
		const ideal = math.floor(height / 2);
		// Full width first; then fitted where the fixed touch controls close in (stacked controls on small roots).
		for (const fit of [0, 1, 2]) {
			for (let step = 0; !instruments && step <= height; step += 2) {
				const up = cluster(ideal - step, fit);
				if (fitsCluster(up)) {
					instruments = up;
					break;
				}
				const down = cluster(ideal + step, fit);
				if (fitsCluster(down)) {
					instruments = down;
					break;
				}
				if (ideal - step < 0 && ideal + step > height) break;
			}
			if (instruments) break;
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
			if (rectangle.y > bottomOf(breakCue) && rectangle.x < centreX + 60 && rightOf(rectangle) > centreX - 60)
				floor = math.min(floor, rectangle.y);
		}
		const room = floor - 4 - (bottomOf(breakCue) + 4);
		const lines = math.min(SUBTITLE_LINES, math.floor(room / metrics.row));
		if (lines >= 1) {
			const lineHeight = lines * metrics.row;
			subtitle = centredFree(
				centreX,
				floor - 4 - lineHeight,
				lineHeight,
				sizes.subtitleWidth,
				120,
				placed,
				width,
				margin,
			);
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
		if (
			rectangle.y < navigationBottom &&
			bottomOf(rectangle) > navigation.y &&
			rectangle.x >= navigation.x + NAVIGATION_CAPTION_WIDTH / 2
		)
			navigationRight = math.min(navigationRight, rectangle.x - gap);
	}
	navigation.width = compact ? navigation.width : math.max(0, navigationRight - navigation.x);
	// Anything under it ends the slot; an instrument crossing its top edge (crowded touch roots, large sticks) empties it.
	for (const rectangle of placed) {
		if (
			rectangle.x < navigation.x + navigation.width &&
			rightOf(rectangle) > navigation.x &&
			bottomOf(rectangle) > navigation.y
		)
			navigationBottom = math.min(navigationBottom, rectangle.y - 2);
	}
	navigation.height = math.max(0, math.min(NAVIGATION_SLOT_HEIGHT, navigationBottom - navigation.y));
	// An empty slot is empty both ways; the floating caption then always has to find its own spot.
	if (navigation.height <= 0) navigation.width = 0;

	return {
		margin,
		metrics,
		clock,
		callout,
		navigation,
		pause,
		reticle,
		speed,
		altitude,
		alert,
		breakCue,
		radar,
		radarPlacement,
		status,
		subtitle,
		fireCaption,
		hints,
		touch,
	};
}

/**
 * The brief "SPLASH ONE" callout: top row, centred in the lane right of the
 * objective, above the forward view. Narrow roots drop it under the top row
 * (still above the forward view). The Studio compact root has room for
 * neither and borrows the alert lane for the moment.
 */
export function getKillMarkerLayout(
	viewportWidth: number,
	viewportHeight: number,
	inputMode: InputMode,
	options?: HudOptions,
): Rectangle {
	const width = math.max(1, viewportWidth);
	const height = math.max(1, viewportHeight);
	const hud = getHudLayout(width, height, inputMode, options);
	const gap = 8;
	const obstacles = hudObstacles(hud);
	const forward = getHudCentreBox(width, height);
	const laneLeft = rightOf(hud.callout) + gap;
	const laneRight = topLaneRight(laneLeft, hud.margin, KILL_MARKER_HEIGHT, obstacles, width - hud.margin, gap);
	const fits = (candidate: Rectangle) =>
		candidate.width >= KILL_MARKER_MIN_WIDTH && bottomOf(candidate) <= forward.y && clear(candidate, obstacles);
	const laneWidth = math.min(KILL_MARKER_MAX_WIDTH, laneRight - laneLeft);
	const lane = {
		x: laneLeft + math.floor((laneRight - laneLeft - laneWidth) / 2),
		y: hud.margin,
		width: laneWidth,
		height: KILL_MARKER_HEIGHT,
	};
	if (fits(lane)) return lane;
	const below = math.max(bottomOf(hud.callout), bottomOf(hud.clock), hud.pause ? bottomOf(hud.pause) : 0) + gap;
	const banner = centredFree(
		math.floor(width / 2),
		below,
		KILL_MARKER_HEIGHT,
		KILL_MARKER_MAX_WIDTH,
		KILL_MARKER_MIN_WIDTH,
		obstacles,
		width,
		hud.margin,
	);
	if (banner && fits(banner)) return banner;
	return hud.alert;
}

/** Status toasts stay clear of the menu panel, or of the mission HUD (for that input mode) when no menu is shown. */
export function getToastLayout(
	viewportWidth: number,
	viewportHeight: number,
	menu?: MenuLayout,
	inputMode: InputMode = "keyboard",
	options?: HudOptions,
): Rectangle {
	const width = math.max(1, viewportWidth);
	const toastHeight = 44;
	if (menu?.mode === "side") {
		const left = menu.panel.x + menu.panel.width + 16;
		const toastWidth = math.min(380, width - left - 16);
		return {
			x: left + math.floor((width - left - 16 - toastWidth) / 2),
			y: 16,
			width: toastWidth,
			height: toastHeight,
		};
	}
	if (menu) return centered(width, math.min(380, width - 28), 14, toastHeight);
	const hud = getHudLayout(viewportWidth, viewportHeight, inputMode, options);
	const height = math.max(1, viewportHeight);
	const obstacles = hudObstacles(hud);
	const free = (candidate: Rectangle) =>
		candidate.width >= 1 &&
		candidate.height >= 1 &&
		rectangleInside(candidate, width, height, 0) &&
		!obstacles.some((obstacle) => rectanglesOverlap(candidate, obstacle));
	const missionToastHeight = hud.metrics.scale === "compact" ? ALERT_HEIGHT : 30;
	const candidates: Rectangle[] = [];
	// In a mission the toast lives in the top row right of the objective, so it never enters the forward view.
	const left = hud.callout.x + hud.callout.width + 8;
	const right = topLaneRight(left, hud.callout.y, missionToastHeight, obstacles, width - hud.margin, 8);
	if (right - left >= (hud.metrics.scale === "compact" ? 96 : 120)) {
		const toastWidth = math.min(380, right - left);
		candidates.push({
			x: left + math.floor((right - left - toastWidth) / 2),
			y: hud.callout.y,
			width: toastWidth,
			height: missionToastHeight,
		});
	}
	// Otherwise a banner under the top row, then the column under the navigation slot.
	const topBottom = math.max(
		hud.callout.y + hud.callout.height,
		hud.clock.y + hud.clock.height,
		hud.pause ? hud.pause.y + hud.pause.height : 0,
	);
	const banner = centredFree(
		math.floor(width / 2),
		topBottom + 8,
		missionToastHeight,
		math.min(380, math.floor(width * 0.5)),
		140,
		obstacles,
		width,
		hud.margin,
	);
	if (banner) candidates.push(banner);
	const below = hud.navigation.y + hud.navigation.height + 8;
	const beside = centredFree(
		math.floor(width / 2),
		below,
		missionToastHeight,
		math.min(380, width - hud.margin * 2),
		140,
		obstacles,
		width,
		hud.margin,
	);
	if (beside) candidates.push(beside);
	// Compact: the right column between the status panel and the throttle stick.
	if (hud.touch) {
		const y = hud.status.frame.y + hud.status.frame.height + 2;
		const room = math.min(missionToastHeight, (hud.touch.throttleUpLabel ?? hud.touch.throttle).y - 2 - y);
		if (room >= 16) candidates.push({ x: hud.touch.throttle.x, y, width: hud.touch.throttle.width, height: room });
	}
	for (const candidate of candidates) if (free(candidate)) return candidate;
	// Nothing free (tiny portrait roots): the transient toast borrows the alert lane.
	return hud.alert;
}

/** Every laid-out HUD rectangle: texts, instruments, panels, buttons, radar and touch controls. */
export function hudObstacles(hud: HudLayout): Rectangle[] {
	const rectangles = [hud.clock, hud.callout, hud.speed, hud.altitude, hud.status.frame];
	// Compact roots may share rows: the warning with the objective, the break cue with the warning.
	if (hud.alert !== hud.callout) rectangles.push(hud.alert);
	if (hud.breakCue !== hud.alert) rectangles.push(hud.breakCue);
	for (const optional of [
		hud.navigation,
		hud.reticle,
		hud.subtitle,
		hud.hints,
		hud.pause,
		hud.radar,
		hud.fireCaption,
	])
		if (optional && optional.width > 0) rectangles.push(optional);
	const touch = hud.touch;
	if (touch) {
		rectangles.push(touch.joystick, touch.throttle, touch.missile, touch.target, touch.special, touch.evade);
		if (touch.gun) rectangles.push(touch.gun);
		if (touch.throttleUpLabel) rectangles.push(touch.throttleUpLabel);
		if (touch.throttleDownLabel) rectangles.push(touch.throttleDownLabel);
	}
	return rectangles;
}
