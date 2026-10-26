// Renders static PNG mocks of the flight HUD into docs/design/ from the real
// getHudLayout() numbers (run under Bun with a Luau `math` shim), drawn as
// HTML/SVG and captured with headless Chrome. Not part of the game build.
//   bun tools/render-hud-mock.ts
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const luauMath = Object.assign(Object.create(Math), {
	clamp: (value: number, low: number, high: number) => Math.min(Math.max(value, low), high),
	huge: Number.POSITIVE_INFINITY,
});
(globalThis as unknown as { math: unknown }).math = luauMath;
(Array.prototype as unknown as { size: () => number }).size = function (this: unknown[]) { return this.length; };
(globalThis as unknown as { string: unknown }).string = {
	// Enough of Luau's string.format for the HUD's "%02d" clock.
	format: (pattern: string, ...values: number[]) => pattern.replace(/%02d/g, () => String(Math.floor(values.shift() ?? 0)).padStart(2, "0")),
};
const { getHudLayout, getKillMarkerLayout } = await import("../src/shared/UILayout");
const { kestrelOutline, weaponRows, railsReady, clockLines } = await import("../src/shared/HudInstruments");
type Rect = { x: number; y: number; width: number; height: number };
type Mode = "touch" | "keyboard" | "gamepad";

const root = resolve(import.meta.dir, "..");
const work = resolve(root, "build/hud-mock");
await mkdir(work, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const GREEN = "#6CFFB0", DIM = "#46A876", AMBER = "#FFC454", RED = "#FF5252", WHITE = "#ECFFF4", SHADOW = "#04100A";
const TONE: Record<string, string> = { normal: GREEN, dim: DIM, warn: AMBER, danger: RED };
const FONT = `"Roboto Mono", Menlo, monospace`;

interface Shot { file: string; screenWidth: number; screenHeight: number; insetLeft: number; mode: Mode; scale: number }
const SHOTS: Shot[] = [
	{ file: "hud-mock-1920x854-keyboard.png", screenWidth: 1920, screenHeight: 854, insetLeft: 0, mode: "keyboard", scale: 1 },
	{ file: "hud-mock-844x390-touch.png", screenWidth: 844, screenHeight: 390, insetLeft: 44, mode: "touch", scale: 2 },
	{ file: "hud-mock-667x375-touch.png", screenWidth: 667, screenHeight: 375, insetLeft: 0, mode: "touch", scale: 2 },
	{ file: "hud-mock-320x182-touch.png", screenWidth: 320, screenHeight: 182, insetLeft: 0, mode: "touch", scale: 3 },
];

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
	const width = shot.screenWidth - shot.insetLeft, height = shot.screenHeight;
	const hud = getHudLayout(width, height, shot.mode);
	const kill = getKillMarkerLayout(width, height, shot.mode);
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
		if (captioned) html.push(text({ x: right ? r.x : r.x + tip, y: r.y, width: r.width - tip, height: top }, caption, m.label));
		html.push(text({ x: right ? r.x + 2 : r.x + tip + 2, y: y0, width: r.width - tip - 4, height: b }, captioned ? value : `${caption[0]} ${value}`, m.text, { align: "center", bold: true }));
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
	// Bottom-right weapon panel.
	const rows = weaponRows({ missiles: 8, missileCooldown: 0, special: "FLR", specialCharges: 2, specialCooldown: 0, specialActive: 0, evadeCharges: 3, health: 88 });
	const rowText = hud.weapons.text ?? m.text;
	const caretWidth = Math.floor(rowText * 0.8);
	rows.forEach((row, index) => {
		const r = hud.weapons.rows[index];
		if (row.caret) html.push(text({ ...r, width: caretWidth }, ">", rowText, { bold: true }));
		html.push(text({ ...r, x: r.x + caretWidth, width: r.width - caretWidth }, row.label, rowText, { color: TONE[row.tone] }));
		html.push(text({ ...r, x: r.x + caretWidth, width: r.width - caretWidth }, row.value, rowText, { color: TONE[row.tone], align: "right", bold: true }));
	});
	if (hud.weapons.silhouette) {
		const s = hud.weapons.silhouette;
		svg.push(`<polygon points="${kestrelOutline().map(([x, y]) => `${s.x + x * s.width},${s.y + y * s.height}`).join(" ")}" fill="none" stroke="${GREEN}" stroke-width="1.5" stroke-linejoin="round"/>`);
		svg.push(line(s.x + s.width / 2, s.y + s.height * 0.12, s.x + s.width / 2, s.y + s.height * 0.4, GREEN, 1, 0.5));
		const ready = railsReady(8, 0);
		hud.weapons.rails!.forEach((rail, index) => {
			const nose = Math.floor(rail.width * 1.4), fill = ready[index] ? GREEN : "none";
			svg.push(`<rect x="${rail.x}" y="${rail.y + nose / 2}" width="${rail.width}" height="${rail.height - nose / 2}" fill="${fill}" stroke="${ready[index] ? SHADOW : DIM}" stroke-opacity="0.5"/>`);
			svg.push(`<polygon points="${rail.x + rail.width / 2},${rail.y} ${rail.x + rail.width},${rail.y + nose / 2} ${rail.x},${rail.y + nose / 2}" fill="${fill}"/>`);
		});
	}
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
		for (const [r, label, filled, size] of [[touch.target, "TGT", false, 11], [touch.missile, "FIRE", true, 12], [touch.special, "FLR 2", false, 10], [touch.evade, "EVADE", false, 11]] as [Rect, string, boolean, number][]) {
			const R = r.width / 2;
			svg.push(`<circle cx="${r.x + R}" cy="${r.y + R}" r="${R - 0.75}" fill="${filled ? GREEN : SHADOW}" fill-opacity="${filled ? 0.45 : 0.35}" stroke="${GREEN}" stroke-width="${label === "EVADE" ? 2.5 : 1.5}" stroke-opacity="${filled ? 1 : 0.7}"/>`);
			html.push(text({ ...r, height: label === "EVADE" ? r.height * 0.75 : r.height }, label, size, { color: filled ? WHITE : GREEN, align: "center", bold: true }));
			if (label === "EVADE") for (let pip = 0; pip < 3; pip++) svg.push(`<circle cx="${r.x + R + (pip - 1) * 9}" cy="${r.y + r.height * 0.66}" r="3" fill="${GREEN}"/>`);
		}
	}
	if (hud.hints && hud.hints.width > 0) html.push(text(hud.hints, "SPACE FIRE    TAB TARGET", 10, { align: "center", bold: true, color: WHITE }));

	// Backdrop: sky, cloud deck, a bandit in a locked target box and the player's jet in chase view.
	const sw = shot.screenWidth, sh = shot.screenHeight;
	// Chase view: the outline squashed for perspective, low in the frame.
	const jetWidth = Math.min(sw * 0.3, sh * 0.75), jetHeight = jetWidth * 0.5, jetX = sw / 2 - jetWidth / 2, jetY = sh * 0.66;
	const jet = kestrelOutline().map(([x, y]) => `${jetX + x * jetWidth},${jetY + y * jetHeight}`).join(" ");
	const bandit = { x: shot.insetLeft + width * 0.6, y: sh * 0.33 };
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
 <polygon points="${kestrelOutline().map(([x, y]) => `${bandit.x - 9 + x * 18},${bandit.y - 10 + y * 20}`).join(" ")}" fill="#3a4148"/>
 <rect x="${bandit.x - bracket / 2}" y="${bandit.y - bracket / 2}" width="${bracket}" height="${bracket}" fill="none" stroke="${RED}" stroke-width="1.5"/>
</svg>
<div class="t" style="left:${px(bandit.x - 60)};top:${px(bandit.y + bracket / 2 + 4)};width:120px;height:13px;font-size:10px;color:${RED};text-align:center;font-weight:700;justify-content:center;">LOCKED · 820m</div>`;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;width:${sw}px;height:${sh}px;background:#000;}
.layer{position:absolute;left:0;top:0;}
.hud{position:absolute;left:${shot.insetLeft}px;top:0;width:${width}px;height:${height}px;filter:drop-shadow(0 0 1px ${SHADOW}) drop-shadow(0 0 1px ${SHADOW});}
.t{position:absolute;display:flex;flex-direction:column;font-family:${FONT};line-height:1.15;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;}
.t[data-slot]{opacity:0.55;}
.inset{position:absolute;left:0;top:0;width:${shot.insetLeft}px;height:${sh}px;background:repeating-linear-gradient(45deg,rgba(0,0,0,.25) 0 6px,rgba(0,0,0,.1) 6px 12px);}
</style></head><body>
${backdrop}
${shot.insetLeft > 0 ? `<div class="inset"></div>` : ""}
<div class="hud"><svg class="layer" width="${width}" height="${height}">${svg.join("")}</svg>${html.join("")}</div>
</body></html>`;
}

for (const shot of SHOTS) {
	const page = resolve(work, shot.file.replace(".png", ".html"));
	await Bun.write(page, render(shot));
	const out = resolve(root, "docs/design", shot.file);
	const chrome = Bun.spawn([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", `--force-device-scale-factor=${shot.scale}`, `--window-size=${shot.screenWidth},${shot.screenHeight}`, `--screenshot=${out}`, `file://${page}`], { stdout: "ignore", stderr: "ignore" });
	await chrome.exited;
	console.log(`${shot.file}: ${(await Bun.file(out).exists()) ? "written" : "FAILED"}`);
}
