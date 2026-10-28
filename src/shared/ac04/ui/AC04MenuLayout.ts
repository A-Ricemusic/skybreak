/**
 * Responsive geometry for the AC04 command screens. Pure: inputs are the safe-area size in pixels and
 * the active input mode; outputs are whole-pixel rectangles.
 *
 * Wide layouts start from a 1280×720 composition (command list left, detail pane right, help line
 * below). These proportions are adaptation starting points, not measurements of the original software.
 * Short landscape and narrow portrait forms keep every command and Back reachable without page scrolling;
 * long lists scroll inside their own region. Touch rows keep 44 px hit targets.
 */
export type AC04InputMode = "keyboard" | "gamepad" | "touch";
export type AC04Form = "wide" | "short" | "narrow";
export interface AC04Rect { x: number; y: number; width: number; height: number }

export const AC04_TOUCH_HIT = 44;
const PANEL_GAP = 20;

export function ac04Rect(x: number, y: number, width: number, height: number): AC04Rect {
	return { x: math.floor(x), y: math.floor(y), width: math.max(0, math.floor(width)), height: math.max(0, math.floor(height)) };
}
export function ac04Right(rect: AC04Rect): number { return rect.x + rect.width; }
export function ac04Bottom(rect: AC04Rect): number { return rect.y + rect.height; }
export function ac04Overlaps(a: AC04Rect, b: AC04Rect): boolean {
	return a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0
		&& a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
export function ac04Inside(inner: AC04Rect, width: number, height: number): boolean {
	return inner.x >= 0 && inner.y >= 0 && inner.x + inner.width <= width && inner.y + inner.height <= height;
}

/** Narrow below 640 px wide; short landscape below 500 px high; otherwise wide. */
export function ac04Form(width: number, height: number): AC04Form {
	if (width < 640) return "narrow";
	if (height < 500) return "short";
	return "wide";
}

export interface AC04TypeScale { title: number; command: number; body: number; small: number; caption: number }
/** Type sizes scale with the safe area but never fall below readable floors. */
export function ac04TypeScale(width: number, height: number): AC04TypeScale {
	const scale = math.clamp(math.min(width / 1280, height / 720), 0.8, 1.35);
	return {
		title: math.max(20, math.floor(30 * scale)),
		command: math.max(15, math.floor(18 * scale)),
		body: math.max(14, math.floor(17 * scale)),
		small: math.max(12, math.floor(13 * scale)),
		caption: math.max(15, math.floor(18 * scale)),
	};
}

function margin(width: number, height: number): number {
	return math.floor(math.clamp(math.min(width, height) * 0.045, 12, 40));
}

/** Visible row cadence: compact on keyboard/gamepad, a full 44 px hit target on touch. */
export function ac04RowPitch(form: AC04Form, input: AC04InputMode): number {
	if (input === "touch") return AC04_TOUCH_HIT;
	return form === "wide" ? 32 : 30;
}

/** Height of the footer command buttons (Back, Confirm...). */
export function ac04CommandHeight(input: AC04InputMode): number {
	return input === "touch" ? AC04_TOUCH_HIT : 32;
}

export interface AC04MenuLayout {
	form: AC04Form; width: number; height: number; margin: number;
	/** Navigation hint strip (keyboard/gamepad legend). Zero height on touch. */
	hints: AC04Rect;
	title: AC04Rect;
	list: AC04Rect;
	/** Detail pane: beside the list, or below it on narrow screens. */
	detail: AC04Rect;
	/** Contextual help for the focused command. */
	help: AC04Rect;
	/** Explicit Back/secondary command area, always on screen. */
	commands: AC04Rect;
	/** Discreet persistence/session status line. */
	status: AC04Rect;
	rowPitch: number;
	typography: AC04TypeScale;
}

/** @param listRows rows the list wants (narrow screens size the list to it, then give the rest to detail). */
export function ac04MenuLayout(width: number, height: number, input: AC04InputMode, listRows: number): AC04MenuLayout {
	const form = ac04Form(width, height), typography = ac04TypeScale(width, height), m = margin(width, height);
	const rowPitch = ac04RowPitch(form, input), command = ac04CommandHeight(input);
	// The title surface may render a second identity line (for example ISAF / MOBIUS 1).
	// Keep that line above the first command at every form factor instead of treating the
	// title rectangle as a single-line heading.
	const titleHeight = typography.title + typography.small + 18;
	const hintHeight = input === "touch" ? 0 : form === "wide" ? 24 : 20;
	const hints = ac04Rect(m, math.floor(m / 2), width - 2 * m, hintHeight);
	const statusHeight = typography.small + 4;
	if (form === "narrow") {
		const title = ac04Rect(m, ac04Bottom(hints) + 6, width - 2 * m, titleHeight);
		const commands = ac04Rect(m, height - m - command, width - 2 * m, command);
		const status = ac04Rect(m, commands.y - statusHeight - 4, width - 2 * m, statusHeight);
		const help = ac04Rect(m, status.y - typography.small * 2 - 10, width - 2 * m, typography.small * 2 + 6);
		const top = ac04Bottom(title) + 8, room = help.y - 8 - top;
		const listHeight = math.min(math.max(1, listRows) * rowPitch, math.floor(room * 0.55));
		const list = ac04Rect(m, top, width - 2 * m, math.max(rowPitch, listHeight));
		const detail = ac04Rect(m, ac04Bottom(list) + 10, width - 2 * m, help.y - 8 - (ac04Bottom(list) + 10));
		return { form, width, height, margin: m, hints, title, list, detail, help, commands, status, rowPitch, typography: typography };
	}
	if (form === "short") {
		const title = ac04Rect(2 * m, ac04Bottom(hints) + 4, width - 4 * m, titleHeight);
		const commands = ac04Rect(2 * m, height - m - command, width - 4 * m, command);
		const status = ac04Rect(2 * m, commands.y - statusHeight - 2, width - 4 * m, statusHeight);
		const help = ac04Rect(2 * m, status.y - typography.small - 8, width - 4 * m, typography.small + 6);
		const top = ac04Bottom(title) + 6;
		const list = ac04Rect(2 * m, top, math.clamp(width * 0.38, 250, 420), help.y - 6 - top);
		const detailX = ac04Right(list) + PANEL_GAP;
		const detail = ac04Rect(detailX, top, width - 2 * m - detailX, list.height);
		return { form, width, height, margin: m, hints, title, list, detail, help, commands, status, rowPitch, typography: typography };
	}
	const left = math.floor(width * 0.078);
	const title = ac04Rect(left, math.max(ac04Bottom(hints) + 8, math.floor(height * 0.11)), width - 2 * left, titleHeight);
	const commands = ac04Rect(left, height - m - command, width - 2 * left, command);
	const status = ac04Rect(left, commands.y - statusHeight - 6, width - 2 * left, statusHeight);
	const help = ac04Rect(left, status.y - typography.body - 14, width - 2 * left, typography.body + 8);
	const top = math.max(ac04Bottom(title) + 12, math.floor(height * 0.25));
	const list = ac04Rect(left, top, math.clamp(width * 0.31, 300, 460), help.y - 12 - top);
	const detailX = math.max(ac04Right(list) + 40, math.floor(width * 0.47));
	const detail = ac04Rect(detailX, top, width - left - detailX, list.height);
	return { form, width, height, margin: m, hints, title, list, detail, help, commands, status, rowPitch, typography: typography };
}

/** Rows that fit the list without clipping (at least one). */
export function ac04VisibleRows(layout: AC04MenuLayout): number {
	return math.max(1, math.floor(layout.list.height / layout.rowPitch));
}

export interface AC04BriefingLayout {
	form: AC04Form; margin: number;
	hints: AC04Rect;
	/** Square map, centred in the space above the caption lane. */
	map: AC04Rect;
	/** Operation metadata (mission, operation, area/time). */
	metaLeft: AC04Rect;
	/** Objective and force summary. */
	metaRight: AC04Rect;
	/** Narration caption lane; scrolls when the text is longer than the lane. */
	caption: AC04Rect;
	commands: AC04Rect;
	typography: AC04TypeScale;
}

/** Caption lane height that always fits at least three caption lines. */
function captionHeight(height: number, typography: AC04TypeScale): number {
	const line = typography.caption + 4;
	return math.floor(math.clamp(height * 0.15, line * 3 + 12, line * 5 + 12));
}

export function ac04BriefingLayout(width: number, height: number, input: AC04InputMode): AC04BriefingLayout {
	const form = ac04Form(width, height), typography = ac04TypeScale(width, height), m = margin(width, height);
	const hintHeight = input === "touch" ? 0 : form === "wide" ? 24 : 20;
	const hints = ac04Rect(m, math.floor(m / 2), width - 2 * m, hintHeight);
	const commands = ac04Rect(m, height - m - ac04CommandHeight(input), width - 2 * m, ac04CommandHeight(input));
	const lane = captionHeight(height, typography);
	if (form === "narrow") {
		const caption = ac04Rect(m, commands.y - 8 - lane, width - 2 * m, lane);
		const top = ac04Bottom(hints) + 6;
		const metaHeight = typography.small * 6 + 24;
		const side = math.max(80, math.min(width - 2 * m, caption.y - 8 - metaHeight - 8 - top));
		const map = ac04Rect((width - side) / 2, top, side, side);
		const metaY = ac04Bottom(map) + 8, half = math.floor((width - 2 * m - 8) / 2);
		return {
			form, margin: m, hints, map, typography: typography, caption, commands,
			metaLeft: ac04Rect(m, metaY, half, caption.y - 8 - metaY),
			metaRight: ac04Rect(m + half + 8, metaY, half, caption.y - 8 - metaY),
		};
	}
	const caption = ac04Rect(math.max(m, width * 0.0625), commands.y - 10 - lane, width - 2 * math.max(m, width * 0.0625), lane);
	const top = ac04Bottom(hints) + 8, bottom = caption.y - 10, room = bottom - top;
	if (form === "short") {
		const side = math.max(80, math.min(room, math.floor(width * 0.5)));
		const map = ac04Rect(m, top, side, side);
		const x = ac04Right(map) + PANEL_GAP, w = width - m - x;
		const half = math.floor((room - 8) / 2);
		return { form, margin: m, hints, map, typography: typography, caption, commands, metaLeft: ac04Rect(x, top, w, half), metaRight: ac04Rect(x, top + half + 8, w, room - half - 8) };
	}
	const sideWidth = math.clamp(width * 0.18, 170, 280);
	const side = math.max(120, math.min(room, width - 2 * (sideWidth + PANEL_GAP) - 2 * m));
	const map = ac04Rect((width - side) / 2, top, side, side);
	return {
		form, margin: m, hints, map, typography: typography, caption, commands,
		metaLeft: ac04Rect(map.x - PANEL_GAP - sideWidth, top, sideWidth, room),
		metaRight: ac04Rect(ac04Right(map) + PANEL_GAP, top, sideWidth, room),
	};
}

export interface AC04AircraftLayout {
	form: AC04Form; margin: number;
	hints: AC04Rect;
	/** Designation and position-in-list counter. */
	name: AC04Rect;
	/** Catalog list (available and locked aircraft). */
	roster: AC04Rect;
	/** Plan-view preview area. */
	preview: AC04Rect;
	/** GUN / MSL / SP.W loadout. */
	equipment: AC04Rect;
	/** Availability note. */
	description: AC04Rect;
	commands: AC04Rect;
	rowPitch: number;
	typography: AC04TypeScale;
}

export function ac04AircraftLayout(width: number, height: number, input: AC04InputMode): AC04AircraftLayout {
	const form = ac04Form(width, height), typography = ac04TypeScale(width, height), m = margin(width, height);
	const rowPitch = input === "touch" ? AC04_TOUCH_HIT : 26;
	const hintHeight = input === "touch" ? 0 : form === "wide" ? 24 : 20;
	const hints = ac04Rect(m, math.floor(m / 2), width - 2 * m, hintHeight);
	const commands = ac04Rect(m, height - m - ac04CommandHeight(input), width - 2 * m, ac04CommandHeight(input));
	const description = ac04Rect(m, commands.y - 8 - (typography.body * 2 + 10), width - 2 * m, typography.body * 2 + 10);
	const top = ac04Bottom(hints) + 6;
	const name = ac04Rect(m, top, width - 2 * m, typography.title + typography.small + 14);
	const bodyTop = ac04Bottom(name) + 8, bodyHeight = description.y - 8 - bodyTop;
	if (form === "narrow") {
		const previewHeight = math.floor(bodyHeight * 0.4);
		const preview = ac04Rect(m, bodyTop, width - 2 * m, previewHeight);
		const equipment = ac04Rect(m, ac04Bottom(preview) + 6, width - 2 * m, typography.small * 2 + 14);
		const roster = ac04Rect(m, ac04Bottom(equipment) + 8, width - 2 * m, description.y - 8 - (ac04Bottom(equipment) + 8));
		return { form, margin: m, hints, name, roster, preview, equipment, description, commands, rowPitch, typography: typography };
	}
	const rosterWidth = math.clamp(width * 0.2, 170, 260);
	const equipmentWidth = math.clamp(width * 0.17, 150, 230);
	const roster = ac04Rect(m, bodyTop, rosterWidth, bodyHeight);
	const equipment = ac04Rect(width - m - equipmentWidth, bodyTop + math.floor(bodyHeight * 0.35), equipmentWidth, math.min(bodyHeight - math.floor(bodyHeight * 0.35), typography.body * 6 + 30));
	const previewX = ac04Right(roster) + PANEL_GAP;
	const preview = ac04Rect(previewX, bodyTop, equipment.x - PANEL_GAP - previewX, bodyHeight);
	return { form, margin: m, hints, name, roster, preview, equipment, description, commands, rowPitch, typography: typography };
}

export interface AC04DebriefLayout {
	form: AC04Form; margin: number;
	hints: AC04Rect;
	title: AC04Rect;
	/** Ruled summary table (stacked above statistics on narrow screens, inside the scroll region). */
	summary: AC04Rect;
	statistics: AC04Rect;
	/** Debrief/failure caption. */
	caption: AC04Rect;
	/** Persistent Continue/Retry/Records footer. */
	commands: AC04Rect;
	/** Save note line directly above the footer. */
	status: AC04Rect;
	rowHeight: number;
	typography: AC04TypeScale;
}

export function ac04DebriefLayout(width: number, height: number, input: AC04InputMode): AC04DebriefLayout {
	const form = ac04Form(width, height), typography = ac04TypeScale(width, height), m = margin(width, height);
	const rowHeight = form === "wide" ? math.max(26, typography.body + 10) : typography.body + 8;
	const hintHeight = input === "touch" ? 0 : form === "wide" ? 24 : 20;
	const hints = ac04Rect(m, math.floor(m / 2), width - 2 * m, hintHeight);
	const commands = ac04Rect(m, height - m - ac04CommandHeight(input), width - 2 * m, ac04CommandHeight(input));
	const status = ac04Rect(m, commands.y - typography.small - 10, width - 2 * m, typography.small + 4);
	const title = ac04Rect(m, ac04Bottom(hints) + 4, width - 2 * m, typography.title + 8);
	const lines = form === "wide" ? 3 : 2;
	const caption = ac04Rect(m, status.y - 8 - (typography.body + 4) * lines - 8, width - 2 * m, (typography.body + 4) * lines + 8);
	const top = ac04Bottom(title) + 8, room = caption.y - 8 - top;
	if (form === "narrow") {
		const half = math.floor((room - 8) / 2);
		return { form, margin: m, hints, title, summary: ac04Rect(m, top, width - 2 * m, half), statistics: ac04Rect(m, top + half + 8, width - 2 * m, room - half - 8), caption, commands, status, rowHeight, typography: typography };
	}
	const inner = width - 2 * math.max(m, width * 0.05);
	const leftX = math.max(m, width * 0.05), leftWidth = math.floor(inner * 0.45);
	return {
		form, margin: m, hints, title, caption, commands, status, rowHeight, typography: typography,
		summary: ac04Rect(leftX, top, leftWidth, room),
		statistics: ac04Rect(leftX + leftWidth + 16, top, inner - leftWidth - 16, room),
	};
}

/** Explicit objective confirmation panel: centred, never taller than the safe area minus the footer. */
export function ac04ObjectiveLayout(width: number, height: number, input: AC04InputMode): { panel: AC04Rect; status: AC04Rect; commands: AC04Rect; hints: AC04Rect; form: AC04Form; typography: AC04TypeScale } {
	const form = ac04Form(width, height), typography = ac04TypeScale(width, height), m = margin(width, height);
	const hints = ac04Rect(m, math.floor(m / 2), width - 2 * m, input === "touch" ? 0 : 22);
	const commands = ac04Rect(m, height - m - ac04CommandHeight(input), width - 2 * m, ac04CommandHeight(input));
	const top = ac04Bottom(hints) + 8;
	const panelWidth = form === "narrow" ? width - 2 * m : math.min(width - 2 * m, math.max(560, width * 0.62));
	const status = ac04Rect(m, commands.y - typography.small - 10, width - 2 * m, typography.small + 4);
	const panel = ac04Rect((width - panelWidth) / 2, top, panelWidth, status.y - 6 - top);
	return { panel, status, commands, hints, form, typography: typography };
}

/** Splits a footer into `count` equal command buttons with 8 px gaps. */
export function ac04SplitCommands(area: AC04Rect, count: number): AC04Rect[] {
	const n = math.max(1, count), gap = 8;
	const each = math.floor((area.width - gap * (n - 1)) / n);
	const result: AC04Rect[] = [];
	for (let i = 0; i < n; i++) result.push(ac04Rect(area.x + i * (each + gap), area.y, each, area.height));
	return result;
}
