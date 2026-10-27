// Renders static PNG mocks of the flight HUD into docs/design/ from the real
// getHudLayout() numbers (run under Bun with a Luau `math` shim), drawn as
// HTML/SVG and captured with headless Chrome. Not part of the game build.
//   bun tools/render-hud-mock.ts            (every shot)
//   bun tools/render-hud-mock.ts target-boxes  (only shots whose file name contains the filter)
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const luauMath = Object.assign(Object.create(Math), {
	clamp: (value: number, low: number, high: number) => Math.min(Math.max(value, low), high),
	huge: Number.POSITIVE_INFINITY,
	rad: (degrees: number) => (degrees * Math.PI) / 180,
});
(globalThis as unknown as { math: unknown }).math = luauMath;
(Array.prototype as unknown as { size: () => number }).size = function (this: unknown[]) { return this.length; };
(globalThis as unknown as { string: unknown }).string = {
	// Enough of Luau's string.format for the HUD's "%02d" clock.
	format: (pattern: string, ...values: number[]) => pattern.replace(/%02d/g, () => String(Math.floor(values.shift() ?? 0)).padStart(2, "0")),
};
const { getHudLayout, getKillMarkerLayout } = await import("../src/shared/UILayout");
const { statusLine, hullFraction, hullTone, clockLines } = await import("../src/shared/HudInstruments");
const { TargetBoxes, TARGET_BOX_LIMIT } = await import("../src/shared/TargetBoxes");
type Rect = { x: number; y: number; width: number; height: number };

// The Kestrel's top-view outline (right half, studs from tools/build-aircraft.py) for the backdrop jets only.
const KESTREL_RIGHT_HALF: [number, number][] = [
	[0, -13], [0.82, -11.1], [1.3, -9.2], [1.72, -6.8], [1.88, -3.5], [4.55, -2.2], [11.4, 2.1], [11.05, 3.65], [4.1, 3.15],
	[2.95, 4.2], [2.95, 7.6], [5.25, 9.25], [5.0, 10.15], [2.95, 9.85], [2.75, 11.5], [1.55, 11.5], [0.6, 12.4], [0, 12.4],
];
function kestrelOutline(): [number, number][] {
	const unit = ([x, y]: [number, number]): [number, number] => [(x + 11.4) / 22.8, (y + 13) / 26];
	return [...KESTREL_RIGHT_HALF.map(unit), ...KESTREL_RIGHT_HALF.slice(1, -1).reverse().map(([x, y]) => unit([-x, y]))];
}
type Mode = "touch" | "keyboard" | "gamepad";

const root = resolve(import.meta.dir, "..");
const work = resolve(root, "build/hud-mock");
await mkdir(work, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const GREEN = "#6CFFB0", DIM = "#46A876", AMBER = "#FFC454", RED = "#FF5252", WHITE = "#ECFFF4", SHADOW = "#04100A";
const TONE: Record<string, string> = { normal: GREEN, dim: DIM, warn: AMBER, danger: RED };
const FONT = `"Roboto Mono", Menlo, monospace`;

/** `scale` is the capture's device-pixel ratio; `hudScale` the HUD SCALE setting (the UIScale the HUD is drawn through, default 1). */
interface Shot { file: string; screenWidth: number; screenHeight: number; insetLeft: number; mode: Mode; scale: number; hudScale?: number; boxes?: "on" | "off" | "locked" | "protected" }
const SHOTS: Shot[] = [
	{ file: "hud-mock-1920x854-keyboard.png", screenWidth: 1920, screenHeight: 854, insetLeft: 0, mode: "keyboard", scale: 1 },
	{ file: "hud-mock-844x390-touch.png", screenWidth: 844, screenHeight: 390, insetLeft: 44, mode: "touch", scale: 2 },
	{ file: "hud-mock-667x375-touch.png", screenWidth: 667, screenHeight: 375, insetLeft: 0, mode: "touch", scale: 2 },
	{ file: "hud-mock-568x320-touch.png", screenWidth: 568, screenHeight: 320, insetLeft: 0, mode: "touch", scale: 2 },
	{ file: "hud-mock-706x267-touch.png", screenWidth: 706, screenHeight: 267, insetLeft: 0, mode: "touch", scale: 2 },
	{ file: "hud-mock-320x182-touch.png", screenWidth: 320, screenHeight: 182, insetLeft: 0, mode: "touch", scale: 3 },
	// HUD SCALE 80% on keyboard: text sizes rise so they still draw at 8 px or more.
	{ file: "hud-mock-667x375-keyboard-hud80.png", screenWidth: 667, screenHeight: 375, insetLeft: 0, mode: "keyboard", scale: 2, hudScale: 0.8 },
	{ file: "hud-mock-320x182-keyboard-hud80.png", screenWidth: 320, screenHeight: 182, insetLeft: 0, mode: "keyboard", scale: 3, hudScale: 0.8 },
	// Target boxes on every valid target: the selected box's blink in both phases, then locked.
	{ file: "target-boxes-844x390-touch-blink-on.png", screenWidth: 844, screenHeight: 390, insetLeft: 44, mode: "touch", scale: 2, boxes: "on" },
	{ file: "target-boxes-844x390-touch-blink-off.png", screenWidth: 844, screenHeight: 390, insetLeft: 44, mode: "touch", scale: 2, boxes: "off" },
	{ file: "target-boxes-667x375-touch-locked.png", screenWidth: 667, screenHeight: 375, insetLeft: 0, mode: "touch", scale: 2, boxes: "locked" },
	// A completed lock on a selection the server will not damage now (immune ace, tutorial radar): grey TRACK, never red LOCKED.
	{ file: "target-boxes-667x375-touch-protected-track.png", screenWidth: 667, screenHeight: 375, insetLeft: 0, mode: "touch", scale: 2, boxes: "protected" },
	{ file: "target-boxes-1920x854-keyboard-blink-on.png", screenWidth: 1920, screenHeight: 854, insetLeft: 0, mode: "keyboard", scale: 1, boxes: "on" },
];

/** A contact for the target-box mocks: screen point as a viewport fraction, studs away, and what the server says it is. */
interface MockContact { fx: number; fy: number; distance: number; required: boolean; damageable: boolean; ground?: boolean; selected?: boolean; ace?: boolean }
const MOCK_CONTACTS: MockContact[] = [
	{ fx: 0.6, fy: 0.3, distance: 820, required: true, damageable: true, selected: true },
	{ fx: 0.42, fy: 0.22, distance: 380, required: true, damageable: true },
	{ fx: 0.78, fy: 0.4, distance: 1500, required: true, damageable: true },
	{ fx: 0.27, fy: 0.42, distance: 2400, required: true, damageable: true, ground: true },
	{ fx: 0.7, fy: 0.16, distance: 650, required: false, damageable: true },
	{ fx: 0.18, fy: 0.27, distance: 1100, required: false, damageable: true },
	// The ace before its phase: the server will not let it be damaged, so it gets no box.
	{ fx: 0.86, fy: 0.24, distance: 900, required: true, damageable: false, ace: true },
	// Valid, but behind the FIRE button on touch: no box over the control.
	{ fx: 0.6, fy: 0.84, distance: 1300, required: true, damageable: true },
];

/** The target boxes, drawn with the game's own rules (TargetBoxes.Tone/Selected/Size/Fits/PlaceCaption/PlaceTag/Keepouts) in viewport px. */
function targetBoxes(shot: Shot, hud: ReturnType<typeof getHudLayout>, hudScale: number): string {
	const sw = shot.screenWidth, sh = shot.screenHeight, phase = shot.boxes!;
	const keepouts = TargetBoxes.Keepouts(hud, hudScale, shot.insetLeft, 0);
	const bounds = TargetBoxes.Bounds(sw, sh, { x: shot.insetLeft, y: 0, width: sw - shot.insetLeft, height: sh });
	const out: string[] = [];
	let drawn = 0;
	for (const contact of MOCK_CONTACTS) {
		const x = contact.fx * sw, y = contact.fy * sh;
		const silhouette = contact.ground
			? `<rect x="${x - 7}" y="${y - 4}" width="14" height="8" fill="#4a4f45"/>`
			: `<polygon points="${kestrelOutline().map(([u, v]) => `${x - 7 + u * 14},${y - 8 + v * 16}`).join(" ")}" fill="${contact.ace ? "#5a2a2a" : "#3a4148"}"/>`;
		out.push(silhouette);
		const flags = { enemy: true, owner: 1, damageable: contact.damageable, required: contact.required };
		const lockProgress = phase === "locked" || phase === "protected" ? 1 : 0.6;
		const style = contact.selected ? TargetBoxes.Selected(phase === "protected" ? false : contact.damageable, contact.required, lockProgress) : undefined;
		const tone = style ? style.tone : TargetBoxes.Tone(flags, 1);
		if (tone === undefined || drawn >= TARGET_BOX_LIMIT) continue;
		const locked = style?.locked === true;
		const base = TargetBoxes.Size(contact.distance, sh, contact.selected === true);
		const size = locked ? Math.max(Math.floor(base * 0.85), 26) : base;
		if (!TargetBoxes.Fits(x, y, size, bounds, keepouts)) continue;
		drawn += 1;
		const color = tone === "locked" ? RED : tone === "required" ? GREEN : tone === "protected" ? "#969c9c" : DIM;
		const opacity = contact.selected ? (phase === "off" && !locked ? 0.15 : 1) : tone === "required" ? 0.95 : 0.7;
		out.push(`<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="${opacity}"/>`);
		if (style) {
			const spot = { above: false, dx: 0 };
			if (!TargetBoxes.PlaceCaption(x, y, size, bounds, keepouts, spot)) continue;
			const r = TargetBoxes.CaptionRect(x, y, size, spot);
			const caption = TargetBoxes.CaptionText(style, lockProgress, contact.distance, contact.required, -1);
			out.push(`<text x="${r.x + r.width / 2}" y="${r.y + r.height - 2}" fill="${color}" font-size="10" font-weight="700" text-anchor="middle">${caption}</text>`);
		} else if (tone === "required") {
			const side = TargetBoxes.PlaceTag(x, y, size, bounds, keepouts);
			if (side === undefined) continue;
			const r = TargetBoxes.TagRect(x, y, size, side);
			out.push(`<text x="${side === "right" ? r.x : r.x + r.width}" y="${r.y + r.height - 1}" fill="${color}" font-size="9" font-weight="700" text-anchor="${side === "right" ? "start" : "end"}">TGT</text>`);
		}
	}
	return `<svg class="layer boxes" width="${sw}" height="${sh}" >${out.join("")}</svg>`;
}


const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const box = (r: Rect) => `left:${px(r.x)};top:${px(r.y)};width:${px(r.width)};height:${px(r.height)};`;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function text(r: Rect, content: string, size: number, options: { color?: string; align?: string; bold?: boolean; valign?: string; wrap?: boolean } = {}) {
	const justify = options.valign === "bottom" ? "flex-end" : options.valign === "top" ? "flex-start" : "center";
	return `<div class="t" style="${box(r)}font-size:${size}px;color:${options.color ?? GREEN};text-align:${options.align ?? "left"};font-weight:${options.bold ? 700 : 500};justify-content:${justify};white-space:${options.wrap ? "normal" : "nowrap"};">${escape(content)}</div>`;
}
const line = (x1: number, y1: number, x2: number, y2: number, color = GREEN, width = 1.5, opacity = 1) =>
	`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="square"/>`;

function render(shot: Shot): string {
	// The HUD is laid out for the root divided by its scale (as GameUI does), then drawn scaled.
	const hudScale = shot.hudScale ?? 1;
	const width = Math.floor((shot.screenWidth - shot.insetLeft) / hudScale), height = Math.floor(shot.screenHeight / hudScale);
	const options = { scale: hudScale };
	const hud = getHudLayout(width, height, shot.mode, options);
	const kill = getKillMarkerLayout(width, height, shot.mode, options);
	const m = hud.metrics;
	const html: string[] = [];
	const svg: string[] = [];
	// Top row.
	if (hud.pause) { svg.push(`<rect x="${hud.pause.x}" y="${hud.pause.y}" width="${hud.pause.width}" height="${hud.pause.height}" fill="${SHADOW}" fill-opacity="0.4" stroke="${GREEN}" stroke-opacity="0.65"/>`); html.push(text(hud.pause, "II", hud.pause.width >= 44 ? 15 : 12, { align: "center", bold: true })); }
	const [time, progress] = clockLines(252, 2, 4, 3, 6);
	html.push(text({ ...hud.clock, height: m.row }, time, m.text));
	html.push(text({ ...hud.clock, y: hud.clock.y + m.row + 2, height: m.row }, progress, m.text));
	html.push(text(hud.callout, "Destroy the relay masts before the convoy reaches the pass", m.scale === "large" ? 16 : m.scale === "compact" ? 10 : 11, { valign: "top", wrap: true }));
	// Centre: reticle, SPEED / ALT arrow tags, warning and break cue.
	if (hud.reticle) {
		const r = hud.reticle, c = r.width / 2, ring = Math.floor(r.width * 0.36) / 2, cx = r.x + c, cy = r.y + c;
		svg.push(`<circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="${GREEN}" stroke-width="1.5"/>`);
		svg.push(line(r.x, cy, cx - ring, cy), line(cx + ring, cy, r.x + r.width, cy), line(cx, cy - ring, cx, cy - ring - r.width * 0.22));
	}
	for (const [r, caption, value, right] of [[hud.speed, "SPEED", "412", true], [hud.altitude, "ALT", "1830", false]] as [Rect, string, string, boolean][]) {
		const captioned = r.height >= m.caption + m.box, top = captioned ? m.caption : 0, b = r.height - top, tip = Math.floor(b / 2);
		const y0 = r.y + top, y1 = y0 + b, outer = right ? r.x : r.x + r.width, inner = right ? r.x + r.width - tip : r.x + tip, point = right ? r.x + r.width : r.x;
		svg.push(`<polygon points="${outer},${y0} ${inner},${y0} ${point},${y0 + b / 2} ${inner},${y1} ${outer},${y1}" fill="${SHADOW}" fill-opacity="0.2" stroke="${GREEN}" stroke-width="1.5"/>`);
		if (captioned) html.push(text({ x: right ? r.x : r.x + tip, y: r.y, width: r.width - tip, height: top }, caption, m.instrumentLabel));
		html.push(text({ x: right ? r.x + 2 : r.x + tip + 2, y: y0, width: r.width - tip - 4, height: b }, captioned ? value : `${caption[0]} ${value}`, m.instrumentText, { align: "center", bold: true }));
	}
	if (hud.alert !== hud.callout) {
		svg.push(`<rect x="${hud.alert.x}" y="${hud.alert.y}" width="${hud.alert.width}" height="${hud.alert.height}" fill="${SHADOW}" fill-opacity="0.25" stroke="${RED}" stroke-width="1.5"/>`);
		html.push(text(hud.alert, "MISSILE", m.text + 2, { color: RED, align: "center", bold: true }));
	}
	if (hud.breakCue !== hud.alert) html.push(text(hud.breakCue, "[ BREAK CUE SLOT ]", m.text, { color: RED, align: "center", bold: true }).replace("class=\"t\"", "class=\"t\" data-slot=\"1\""));
	// Bottom-left radar scope.
	if (hud.radar) {
		const r = hud.radar, R = r.width / 2, cx = r.x + R, cy = r.y + R;
		svg.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${SHADOW}" fill-opacity="0.5" stroke="${GREEN}" stroke-opacity="0.85" stroke-width="1.5"/>`);
		svg.push(line(r.x + 2, cy, r.x + r.width - 2, cy, GREEN, 1, 0.3), line(cx, r.y + 2, cx, r.y + r.height - 2, GREEN, 1, 0.3));
		for (const [scale, opacity] of [[(r.width - 10) / r.width, 0.65], [0.5, 0.45], [0.22, 0.3]]) svg.push(`<circle cx="${cx}" cy="${cy}" r="${R * scale}" fill="none" stroke="${GREEN}" stroke-opacity="${opacity}"/>`);
		const heading = (25 * Math.PI) / 180, rim = R - 5;
		for (const [letter, angle] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as [string, number][]) {
			const a = (angle * Math.PI) / 180 - heading;
			html.push(text({ x: cx + Math.sin(a) * rim - 6, y: cy - Math.cos(a) * rim - 6, width: 12, height: 12 }, letter, m.label, { align: "center", bold: true }));
		}
		const blip = (fx: number, fy: number, glyph: string, color: string, size: number) => html.push(text({ x: cx + fx * R - 8, y: cy + fy * R - 8, width: 16, height: 16 }, glyph, size, { color, align: "center", bold: true }));
		blip(0, 0, "▲", GREEN, 12);
		blip(0.42, -0.55, "▲", AMBER, 14); blip(-0.5, -0.35, "▲", GREEN, 11); blip(0.62, -0.1, "△", DIM, 11);
		blip(-0.25, 0.55, "◆", GREEN, 10); blip(0.1, -0.78, "◎", WHITE, 13); blip(0.22, -0.28, "•", RED, 16); blip(0.3, -0.38, "•", WHITE, 16);
		html.push(text({ x: r.x + r.width - 43, y: r.y + r.height - 11, width: 40, height: 10 }, "3.2k", Math.max(8, m.label - 2), { color: DIM, align: "right" }));
	}
	// Hull bar (88%: green) and the one ammo line under it, at the layout's size and separator (the longest line fits at it).
	const status = hud.status, health = 88;
	const hullColor = TONE[hullTone(health)];
	svg.push(`<rect x="${status.bar.x}" y="${status.bar.y}" width="${status.bar.width}" height="${status.bar.height}" fill="${SHADOW}" fill-opacity="0.4" stroke="${hullColor}" stroke-opacity="0.75"/>`);
	svg.push(`<rect x="${status.bar.x}" y="${status.bar.y}" width="${status.bar.width * hullFraction(health)}" height="${status.bar.height}" fill="${hullColor}" fill-opacity="0.9"/>`);
	const cells = statusLine({ missiles: 8, missileCooldown: 0, special: "FLR", specialCharges: 3, specialCooldown: 0, specialActive: 0, evadeCharges: 3 });
	const lineSize = status.text;
	html.push(`<div class="t" style="${box(status.line)}font-size:${lineSize}px;font-weight:500;justify-content:center;white-space:pre;"><span>${cells.map((cell) => `<span style="color:${TONE[cell.tone]}">${escape(cell.text)}</span>`).join(`<span style="color:${DIM}">${status.separator}</span>`)}</span></div>`);
	// Radio subtitle (or, without a row, it shares the objective line) and the kill callout.
	if (hud.subtitle) html.push(text(hud.subtitle, "OVERWATCH: Bandits two o'clock high. Break right and keep them off the convoy!", m.scale === "large" ? m.text : 12, { color: WHITE, align: "center", valign: "bottom", wrap: true }));
	if (kill !== hud.alert) html.push(text(kill, "SPLASH ONE", 16, { color: WHITE, align: "center", bold: true }));
	// Controls: touch sticks and buttons, or keyboard hints.
	const touch = hud.touch;
	if (touch) {
		for (const stick of [touch.joystick, touch.throttle]) {
			const R = stick.width / 2, knob = Math.floor(stick.width * 0.375) / 2;
			svg.push(`<circle cx="${stick.x + R}" cy="${stick.y + R}" r="${R}" fill="${SHADOW}" fill-opacity="0.25" stroke="${GREEN}" stroke-opacity="0.4"/>`);
			svg.push(`<circle cx="${stick.x + R}" cy="${stick.y + R}" r="${knob}" fill="${GREEN}" fill-opacity="0.3" stroke="${GREEN}" stroke-opacity="0.7"/>`);
		}
		if (touch.throttleUpLabel) html.push(text(touch.throttleUpLabel, "SPEED UP", 10, { align: "center" }));
		if (touch.throttleDownLabel) html.push(text(touch.throttleDownLabel, "SLOW DOWN", 10, { align: "center" }));
		// FIRE (no lock yet) is primary by its green tint and heavier ring, not by size.
		for (const [r, label, primary, size] of [[touch.target, "TGT", false, 11], [touch.missile, "FIRE", true, 12], [touch.special, "FLR 3", false, 10], [touch.evade, "EVADE", false, 11]] as [Rect, string, boolean, number][]) {
			const R = r.width / 2;
			svg.push(`<circle cx="${r.x + R}" cy="${r.y + R}" r="${R - 1.25}" fill="${primary ? GREEN : SHADOW}" fill-opacity="${primary ? 0.2 : 0.35}" stroke="${GREEN}" stroke-width="${primary || label === "EVADE" ? 2.5 : 1.5}" stroke-opacity="${primary || label === "EVADE" ? 1 : 0.7}"/>`);
			html.push(text({ ...r, y: r.y + (label === "EVADE" ? r.height * 0.2 : 0), height: label === "EVADE" ? r.height * 0.4 : r.height }, label, size, { color: GREEN, align: "center", bold: true }));
			if (label === "EVADE") for (let pip = 0; pip < 3; pip++) svg.push(`<circle cx="${r.x + R + (pip - 1) * 9}" cy="${r.y + r.height * 0.62 + 3}" r="3" fill="${GREEN}"/>`);
		}
	}
	if (hud.hints && hud.hints.width > 0) html.push(text(hud.hints, "SPACE FIRE    TAB TARGET", 10, { align: "center", bold: true, color: WHITE }));

	// Backdrop: sky, cloud deck, a bandit in a locked target box and the player's jet in chase view.
	const sw = shot.screenWidth, sh = shot.screenHeight;
	// Chase view: the outline squashed for perspective, low in the frame.
	const jetWidth = Math.min(sw * 0.3, sh * 0.75), jetHeight = jetWidth * 0.5, jetX = sw / 2 - jetWidth / 2, jetY = sh * 0.66;
	const jet = kestrelOutline().map(([x, y]) => `${jetX + x * jetWidth},${jetY + y * jetHeight}`).join(" ");
	const bandit = { x: shot.insetLeft + width * hudScale * 0.6, y: sh * 0.33 };
	const bracket = Math.max(28, Math.round(sh * 0.11));
	const backdrop = `
<svg class="layer" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">
 <defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5e9c"/><stop offset="0.55" stop-color="#7fa9d6"/><stop offset="0.7" stop-color="#c9dbec"/><stop offset="1" stop-color="#eef3f7"/></linearGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="${sh * 0.02}"/></filter>
 </defs>
 <rect width="${sw}" height="${sh}" fill="url(#sky)"/>
 <g filter="url(#soft)" fill="#ffffff" fill-opacity="0.85">
  <ellipse cx="${sw * 0.2}" cy="${sh * 0.78}" rx="${sw * 0.3}" ry="${sh * 0.12}"/><ellipse cx="${sw * 0.75}" cy="${sh * 0.82}" rx="${sw * 0.35}" ry="${sh * 0.13}"/>
  <ellipse cx="${sw * 0.5}" cy="${sh * 0.93}" rx="${sw * 0.6}" ry="${sh * 0.12}"/><ellipse cx="${sw * 0.3}" cy="${sh * 0.62}" rx="${sw * 0.08}" ry="${sh * 0.09}"/>
  <ellipse cx="${sw * 0.4}" cy="${sh * 0.3}" rx="${sw * 0.25}" ry="${sh * 0.02}" fill-opacity="0.35"/>
 </g>
 <polygon points="${jet}" fill="#56616c" stroke="#2a3138" stroke-width="2"/>
 ${shot.boxes ? "" : `<polygon points="${kestrelOutline().map(([x, y]) => `${bandit.x - 9 + x * 18},${bandit.y - 10 + y * 20}`).join(" ")}" fill="#3a4148"/>
 <rect x="${bandit.x - bracket / 2}" y="${bandit.y - bracket / 2}" width="${bracket}" height="${bracket}" fill="none" stroke="${RED}" stroke-width="1.5"/>`}
</svg>
${shot.boxes ? targetBoxes(shot, hud, hudScale) : `<div class="t" style="left:${px(bandit.x - 60)};top:${px(bandit.y + bracket / 2 + 4)};width:120px;height:13px;font-size:10px;color:${RED};text-align:center;font-weight:700;justify-content:center;">LOCKED · 820m</div>`}`;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;width:${sw}px;height:${sh}px;background:#000;}
.layer{position:absolute;left:0;top:0;}
.boxes{filter:drop-shadow(0 0 1px ${SHADOW});}
.boxes text{font-family:${FONT};}
.hud{position:absolute;left:${shot.insetLeft}px;top:0;width:${width}px;height:${height}px;transform:scale(${hudScale});transform-origin:0 0;filter:drop-shadow(0 0 1px ${SHADOW}) drop-shadow(0 0 1px ${SHADOW});}
.t{position:absolute;display:flex;flex-direction:column;font-family:${FONT};line-height:1.15;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;}
.t[data-slot]{opacity:0.55;}
.inset{position:absolute;left:0;top:0;width:${shot.insetLeft}px;height:${sh}px;background:repeating-linear-gradient(45deg,rgba(0,0,0,.25) 0 6px,rgba(0,0,0,.1) 6px 12px);}
</style></head><body>
${backdrop}
${shot.insetLeft > 0 ? `<div class="inset"></div>` : ""}
<div class="hud"><svg class="layer" width="${width}" height="${height}">${svg.join("")}</svg>${html.join("")}</div>
</body></html>`;
}

const filter = process.argv[2];
for (const shot of SHOTS) {
	if (filter && !shot.file.includes(filter)) continue;
	const page = resolve(work, shot.file.replace(".png", ".html"));
	await Bun.write(page, render(shot));
	const out = resolve(root, "docs/design", shot.file);
	const chrome = Bun.spawn([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", `--force-device-scale-factor=${shot.scale}`, `--window-size=${shot.screenWidth},${shot.screenHeight}`, `--screenshot=${out}`, `file://${page}`], { stdout: "ignore", stderr: "ignore" });
	await chrome.exited;
	console.log(`${shot.file}: ${(await Bun.file(out).exists()) ? "written" : "FAILED"}`);
}
