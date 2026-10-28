/**
 * AC04 flight HUD geometry and radar projection. Pure.
 *
 * Composition follows the inspected original HUD captures: points upper-left, time upper-right, radio
 * upper-centre, speed and altitude flanking the view, radar lower-left and stores lower-right, with the
 * centre left clear for aiming. Touch adds sticks and a six-action area in input-specific lanes; these
 * lanes are adaptations (the original has no touch baseline) and need device measurement.
 */
import { type AC04InputMode, type AC04Rect, AC04_TOUCH_HIT, ac04Bottom, ac04Rect, ac04Right, ac04TypeScale } from "./AC04MenuLayout";

export type AC04TouchAction = "target" | "missile" | "evade" | "gun" | "special" | "rearm";
export const AC04_TOUCH_ACTIONS: readonly AC04TouchAction[] = ["target", "missile", "evade", "gun", "special", "rearm"];

export interface AC04HudLayout {
	width: number; height: number; margin: number;
	score: AC04Rect;
	time: AC04Rect;
	heading: AC04Rect;
	radio: AC04Rect;
	/** Short-lived objective update line and return guidance, under the radio. */
	notice: AC04Rect;
	speed: AC04Rect;
	altitude: AC04Rect;
	/** Warning strip below the aim point. */
	alert: AC04Rect;
	radar: AC04Rect;
	stores: AC04Rect;
	/** Contextual REARM request for pointer users while south of the return line (touch uses its action block). */
	rearm: AC04Rect;
	pause: AC04Rect;
	/** Present on touch only. */
	leftStick?: AC04Rect;
	rightStick?: AC04Rect;
	actions?: { [K in AC04TouchAction]: AC04Rect };
	text: { label: number; value: number; radio: number; small: number };
}

function grid(x: number, y: number, columns: number, cell: { w: number; h: number }, gap: number): { [K in AC04TouchAction]: AC04Rect } {
	const at = (i: number) => ac04Rect(x + (i % columns) * (cell.w + gap), y + math.floor(i / columns) * (cell.h + gap), cell.w, cell.h);
	return { target: at(0), missile: at(1), evade: at(2), gun: at(3), special: at(4), rearm: at(5) };
}

function overlaps(a: AC04Rect, b: AC04Rect): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function ac04HudLayout(width: number, height: number, input: AC04InputMode): AC04HudLayout {
	const typography = ac04TypeScale(width, height);
	const m = math.floor(math.clamp(math.min(width, height) * 0.03, 8, 28));
	const touch = input === "touch", portrait = height > width;
	const label = math.max(11, typography.small - 1), value = math.max(14, typography.body), radioText = math.max(14, typography.body), small = math.max(11, typography.small - 1);
	const side = math.max(m, width * 0.04);
	const score = ac04Rect(side, m, math.clamp(width * 0.2, 140, 250), label + value * 2 + 14);
	const timeWidth = math.floor(math.clamp(width * 0.17, 130, 210));
	const time = ac04Rect(width - side - timeWidth, m, timeWidth, label + value + 10);
	const pause = ac04Rect(ac04Right(time) - (touch ? 64 : 72), ac04Bottom(time) + 6, touch ? 64 : 72, touch ? AC04_TOUCH_HIT : 26);
	const heading = ac04Rect(width / 2 - 40, m, 80, small + 6);
	// Radio sits upper-centre between the corner blocks; where that gap is too narrow it drops below them.
	const radioHeight = small + 6 + (radioText + 4) * 3;
	const radioX = math.max(width * 0.25, ac04Right(score) + 8), radioRight = math.min(width * 0.75, time.x - 8);
	const radio = radioRight - radioX >= 200
		? ac04Rect(radioX, ac04Bottom(heading) + 4, radioRight - radioX, radioHeight)
		: ac04Rect(m, math.max(ac04Bottom(score), ac04Bottom(pause)) + 6, width - 2 * m, radioHeight);
	let notice = ac04Rect(width * 0.2, ac04Bottom(radio) + 4, width * 0.6, (small + 6) * 2);
	const instrumentWidth = math.floor(math.clamp(width * 0.11, 84, 130)), instrumentHeight = label + value + 12;
	const instrumentY = math.max(height * 0.46 - instrumentHeight / 2, ac04Bottom(notice) + 6);
	let speed = ac04Rect(width * 0.23 - instrumentWidth / 2, instrumentY, instrumentWidth, instrumentHeight);
	let altitude = ac04Rect(width * 0.77 - instrumentWidth / 2, instrumentY, instrumentWidth, instrumentHeight);
	const storesWidth = math.floor(math.clamp(width * 0.17, 132, 220)), storesHeight = (label + 8) * 5 + 4;
	const radarSide = math.floor(math.clamp(math.min(width * 0.18, height * 0.26), 84, 180));
	let radar = ac04Rect(side, height * 0.91 - radarSide, radarSide, radarSide);
	let stores = ac04Rect(width - math.max(m, width * 0.05) - storesWidth, height * 0.88 - storesHeight, storesWidth, storesHeight);
	let alert = ac04Rect(width / 2 - 120, math.max(height * 0.6, ac04Bottom(speed) + 6), 240, value + 12);
	let leftStick: AC04Rect | undefined, rightStick: AC04Rect | undefined;
	let actions: { [K in AC04TouchAction]: AC04Rect } | undefined;

	if (touch) {
		const cell = { w: 52, h: AC04_TOUCH_HIT }, gap = 6;
		const gridWidth = 3 * cell.w + 2 * gap, gridHeight = 2 * cell.h + gap;
		if (portrait) {
			// Portrait: a bottom thumb band holding both sticks and the 3×2 action block between them.
			const stick = math.floor(math.clamp((width - 2 * m - gridWidth - 16) / 2, 80, 130));
			const bandTop = height - math.max(160, stick + 2 * m, gridHeight + 2 * m);
			leftStick = ac04Rect(m, height - m - stick, stick, stick);
			rightStick = ac04Rect(width - m - stick, height - m - stick, stick, stick);
			actions = grid(width / 2 - gridWidth / 2, height - m - gridHeight, 3, cell, gap);
			const scope = math.floor(math.clamp(width * 0.3, 84, 130));
			radar = ac04Rect(m, bandTop - 8 - scope, scope, scope);
			stores = ac04Rect(width - m - storesWidth, bandTop - 8 - storesHeight, storesWidth, storesHeight);
			const y = math.min(speed.y, radar.y - 10 - instrumentHeight);
			speed = ac04Rect(m, y, instrumentWidth, instrumentHeight);
			altitude = ac04Rect(width - m - instrumentWidth, y, instrumentWidth, instrumentHeight);
			const lane = altitude.x - 8 - (ac04Right(speed) + 8);
			alert = ac04Rect(ac04Right(speed) + 8, math.min(alert.y, math.min(radar.y, stores.y) - alert.height - 8), math.min(240, lane), alert.height);
			alert = ac04Rect(width / 2 - alert.width / 2, alert.y, alert.width, alert.height);
		} else {
			// Landscape: sticks in the lower corners, the 3×2 action block inboard of the right stick.
			const stick = math.floor(math.clamp(height * 0.3, 96, 140));
			leftStick = ac04Rect(m, height - m - stick, stick, stick);
			rightStick = ac04Rect(width - m - stick, height - m - stick, stick, stick);
			actions = grid(rightStick.x - 10 - gridWidth, height - m - gridHeight, 3, cell, gap);
			const scope = math.floor(math.clamp(math.min(width * 0.14, leftStick.y - 10 - (ac04Bottom(score) + 8)), 72, 150));
			radar = ac04Rect(m, leftStick.y - 10 - scope, scope, scope);
			stores = ac04Rect(width - m - storesWidth, rightStick.y - 10 - storesHeight, storesWidth, storesHeight);
			if (stores.y < ac04Bottom(pause) + 6) stores = ac04Rect(actions.target.x - 10 - storesWidth, height - m - storesHeight, storesWidth, storesHeight);
		}
	}
	// Instruments yield to the radar and stores columns rather than overlap them.
	if (overlaps(altitude, stores)) altitude = ac04Rect(stores.x - 8 - instrumentWidth, altitude.y, instrumentWidth, instrumentHeight);
	if (overlaps(speed, radar)) speed = ac04Rect(ac04Right(radar) + 8, speed.y, instrumentWidth, instrumentHeight);
	// The notice line narrows between whatever shares its height band on either side of the centre.
	let left = notice.x, right = ac04Right(notice);
	for (const r of [score, time, pause, speed, altitude, radar, stores]) {
		if (r.y >= ac04Bottom(notice) || ac04Bottom(r) <= notice.y) continue;
		if (r.x + r.width / 2 < width / 2) left = math.max(left, ac04Right(r) + 8);
		else right = math.min(right, r.x - 8);
	}
	notice = ac04Rect(left, notice.y, right - left, notice.height);
	if (overlaps(alert, notice)) alert = ac04Rect(alert.x, ac04Bottom(notice) + 2, alert.width, alert.height);
	const rearm = ac04Rect(stores.x, stores.y - 6 - 26, stores.width, 26);
	if (!touch && overlaps(alert, rearm)) alert = ac04Rect(alert.x, rearm.y - 4 - alert.height, alert.width, alert.height);
	return { width, height, margin: m, score, time, heading, radio, notice, pause, alert, speed, altitude, radar, stores, rearm, leftStick, rightStick, actions, text: { label, value, radio: radioText, small } };
}

/** Every HUD rectangle a target box must avoid, in HUD-root pixels. */
export function ac04HudKeepouts(layout: AC04HudLayout): AC04Rect[] {
	const rects = [layout.score, layout.time, layout.radio, layout.radar, layout.stores, layout.pause, layout.heading, layout.speed, layout.altitude, layout.notice, layout.alert, layout.rearm];
	if (layout.leftStick) rects.push(layout.leftStick);
	if (layout.rightStick) rects.push(layout.rightStick);
	if (layout.actions) for (const action of AC04_TOUCH_ACTIONS) rects.push(layout.actions[action]);
	return rects;
}

/** Rectangles that must never overlap each other (radio is checked separately because it may span the top). */
export function ac04HudSolids(layout: AC04HudLayout): AC04Rect[] {
	const rects = [layout.score, layout.time, layout.radar, layout.stores, layout.pause, layout.speed, layout.altitude];
	if (layout.leftStick) rects.push(layout.leftStick);
	if (layout.rightStick) rects.push(layout.rightStick);
	if (layout.actions) for (const action of AC04_TOUCH_ACTIONS) rects.push(layout.actions[action]);
	return rects;
}

export interface AC04ScopePoint { x: number; y: number; edge: boolean }

/**
 * Heading-up projection into a rectangular scope. `yaw` is the FlightMath yaw (forward is
 * (-sin yaw, 0, -cos yaw)), the same basis as RadarMath.radarProject. The player sits at
 * (originX, originY) inside a width×height scope; `range` studs reach the nearest scope edge
 * ahead. Contacts outside the scope pin to its border (`edge`).
 */
export function ac04ScopeProject(dx: number, dz: number, yaw: number, range: number, width: number, height: number, originX: number, originY: number, inset = 4): AC04ScopePoint {
	const right = dx * math.cos(yaw) - dz * math.sin(yaw);
	const forward = -dx * math.sin(yaw) - dz * math.cos(yaw);
	const scale = math.max(1, originY - inset) / math.max(1, range);
	let x = originX + right * scale, y = originY - forward * scale;
	const minX = inset, maxX = width - inset, minY = inset, maxY = height - inset;
	if (x >= minX && x <= maxX && y >= minY && y <= maxY) return { x, y, edge: false };
	// Pull back along the ray from the origin until it meets the border.
	const vx = x - originX, vy = y - originY;
	let t = 1;
	if (vx > 0) t = math.min(t, (maxX - originX) / vx); else if (vx < 0) t = math.min(t, (minX - originX) / vx);
	if (vy > 0) t = math.min(t, (maxY - originY) / vy); else if (vy < 0) t = math.min(t, (minY - originY) / vy);
	x = originX + vx * t; y = originY + vy * t;
	return { x, y, edge: true };
}

/** Clips the segment (x1,y1)-(x2,y2) to the box [0,width]×[0,height] (Liang–Barsky); undefined when outside. */
export function ac04ClipSegment(x1: number, y1: number, x2: number, y2: number, width: number, height: number): [number, number, number, number] | undefined {
	const dx = x2 - x1, dy = y2 - y1;
	let t0 = 0, t1 = 1;
	const edges: [number, number][] = [[-dx, x1], [dx, width - x1], [-dy, y1], [dy, height - y1]];
	for (const [p, q] of edges) {
		if (p === 0) { if (q < 0) return undefined; continue; }
		const r = q / p;
		if (p < 0) { if (r > t1) return undefined; if (r > t0) t0 = r; }
		else { if (r < t0) return undefined; if (r < t1) t1 = r; }
	}
	return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

/**
 * The southern return line (world z = lineZ, all x) as a scope segment, unclamped projection then
 * clipped to the scope. Undefined when the line is not inside the scope at this range.
 */
export function ac04ScopeReturnLine(playerX: number, playerZ: number, lineZ: number, yaw: number, range: number, width: number, height: number, originX: number, originY: number, inset = 4): [number, number, number, number] | undefined {
	const span = range * 4;
	const scale = math.max(1, originY - inset) / math.max(1, range);
	const project = (wx: number): [number, number] => {
		const dx = wx - playerX, dz = lineZ - playerZ;
		const right = dx * math.cos(yaw) - dz * math.sin(yaw);
		const forward = -dx * math.sin(yaw) - dz * math.cos(yaw);
		return [originX + right * scale, originY - forward * scale];
	};
	const [ax, ay] = project(playerX - span), [bx, by] = project(playerX + span);
	return ac04ClipSegment(ax, ay, bx, by, width, height);
}

/** Bounding box helper for tests and keep-out math. */
export function ac04Union(rects: readonly AC04Rect[]): AC04Rect {
	let minX = math.huge, minY = math.huge, maxX = -math.huge, maxY = -math.huge;
	for (const rect of rects) {
		minX = math.min(minX, rect.x); minY = math.min(minY, rect.y);
		maxX = math.max(maxX, ac04Right(rect)); maxY = math.max(maxY, ac04Bottom(rect));
	}
	return rects.size() === 0 ? ac04Rect(0, 0, 0, 0) : ac04Rect(minX, minY, maxX - minX, maxY - minY);
}
