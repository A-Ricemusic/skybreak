import { describe, expect, it } from "@rbxts/jest-globals";
import { radarProject } from "../shared/RadarMath";
import { AC04_TOUCH_ACTIONS, ac04ClipSegment, ac04HudKeepouts, ac04HudLayout, ac04HudSolids, ac04ScopeProject, ac04ScopeReturnLine } from "../shared/ac04/ui/AC04HudLayout";
import { type AC04InputMode, type AC04Rect, AC04_TOUCH_HIT, ac04AircraftLayout, ac04BriefingLayout, ac04DebriefLayout, ac04Inside, ac04MenuLayout, ac04ObjectiveLayout, ac04Overlaps, ac04VisibleRows } from "../shared/ac04/ui/AC04MenuLayout";

/** Landscape desktop, the Studio compact window, large desktop, phone portrait/short portrait, phone landscape, small landscape, tablet, ultrawide. */
const VIEWPORTS: [number, number][] = [[1280, 720], [1205, 525], [1920, 1080], [390, 844], [390, 525], [844, 390], [640, 360], [1024, 768], [2560, 1080]];
const INPUTS: AC04InputMode[] = ["keyboard", "gamepad", "touch"];

function expectDisjoint(rects: AC04Rect[], label: string): void {
	for (let i = 0; i < rects.size(); i++) for (let j = i + 1; j < rects.size(); j++) {
		if (ac04Overlaps(rects[i], rects[j])) error(`${label}: rectangles ${i} and ${j} overlap`);
	}
}
function expectInside(rects: AC04Rect[], width: number, height: number, label: string): void {
	for (const rect of rects) if (!ac04Inside(rect, width, height) || rect.width <= 0 || rect.height <= 0) error(`${label}: rectangle outside the safe area`);
}

describe("AC04 flight HUD layout", () => {
	it("keeps every instrument inside the safe area, apart, and off the aim point", () => {
		for (const [width, height] of VIEWPORTS) for (const input of INPUTS) {
			const layout = ac04HudLayout(width, height, input), label = `${width}x${height} ${input}`;
			const solids = ac04HudSolids(layout);
			expectInside([...solids, layout.radio, layout.notice, layout.alert, layout.heading], width, height, label);
			expectDisjoint(solids, label);
			for (const rect of [layout.radio, layout.notice, layout.alert]) for (const solid of solids) expect(ac04Overlaps(rect, solid)).toBe(false);
			if (input !== "touch") for (const solid of solids) expect(ac04Overlaps(layout.rearm, solid)).toBe(false);
			const cx = width / 2, cy = height / 2;
			for (const rect of [...solids, layout.radio, layout.notice]) expect(cx > rect.x && cx < rect.x + rect.width && cy > rect.y && cy < rect.y + rect.height).toBe(false);
		}
	});
	it("places radar lower-left, stores lower-right, radio above the instruments and time upper-right", () => {
		const layout = ac04HudLayout(1280, 720, "keyboard");
		expect(layout.radar.x).toBeLessThan(1280 * 0.25);
		expect(layout.radar.y).toBeGreaterThan(720 * 0.5);
		expect(layout.stores.x).toBeGreaterThan(1280 * 0.7);
		expect(layout.stores.y).toBeGreaterThan(720 * 0.5);
		expect(layout.radio.y + layout.radio.height).toBeLessThan(layout.speed.y);
		expect(layout.time.x).toBeGreaterThan(1280 * 0.7);
		expect(layout.speed.x + layout.speed.width).toBeLessThan(640);
		expect(layout.altitude.x).toBeGreaterThan(640);
	});
	it("shows touch sticks and all six actions only on touch, each at least 44 px, with the radar above the left stick", () => {
		for (const [width, height] of VIEWPORTS) {
			const touch = ac04HudLayout(width, height, "touch");
			expect(touch.leftStick).toBeDefined();
			expect(touch.actions).toBeDefined();
			for (const action of AC04_TOUCH_ACTIONS) {
				expect(touch.actions![action].width).toBeGreaterThanOrEqual(AC04_TOUCH_HIT);
				expect(touch.actions![action].height).toBeGreaterThanOrEqual(AC04_TOUCH_HIT);
			}
			expect(touch.pause.height).toBeGreaterThanOrEqual(AC04_TOUCH_HIT);
			expect(touch.radar.y + touch.radar.height).toBeLessThanOrEqual(touch.leftStick!.y);
			const desktop = ac04HudLayout(width, height, "keyboard");
			expect(desktop.actions).toBeUndefined();
			expect(desktop.leftStick).toBeUndefined();
		}
	});
	it("lists every control a target box must avoid", () => {
		const layout = ac04HudLayout(390, 844, "touch");
		const keepouts = ac04HudKeepouts(layout);
		expect(keepouts.size()).toBe(12 + 2 + AC04_TOUCH_ACTIONS.size());
		for (const rect of [layout.heading, layout.speed, layout.altitude, layout.notice, layout.alert, layout.rearm]) expect(keepouts.includes(rect)).toBe(true);
	});
});

describe("AC04 rectangular radar scope", () => {
	const width = 160, height = 140, ox = 80, oy = 92;
	it("agrees with the existing heading-up radar basis at the four cardinal yaws", () => {
		for (const yaw of [0, math.pi / 2, math.pi, -math.pi / 2]) for (const [dx, dz] of [[0, -300], [300, 0], [0, 300], [-300, 0]]) {
			const scope = ac04ScopeProject(dx, dz, yaw, 1000, width, height, ox, oy);
			const disc = radarProject(dx, dz, yaw, 1000, 100);
			expect(math.sign(math.floor(scope.x - ox + 0.5))).toBe(math.sign(math.floor(disc.x + 0.5)));
			expect(math.sign(math.floor(scope.y - oy + 0.5))).toBe(math.sign(math.floor(disc.y + 0.5)));
		}
	});
	it("draws a contact straight ahead above the player and pins distant contacts to the border", () => {
		const ahead = ac04ScopeProject(0, -500, 0, 1000, width, height, ox, oy);
		expect(ahead.x).toBeCloseTo(ox);
		expect(ahead.y).toBeLessThan(oy);
		expect(ahead.edge).toBe(false);
		const far = ac04ScopeProject(9000, 9000, 0.7, 1000, width, height, ox, oy);
		expect(far.edge).toBe(true);
		expect(far.x).toBeGreaterThanOrEqual(0);
		expect(far.x).toBeLessThanOrEqual(width);
		expect(far.y).toBeGreaterThanOrEqual(0);
		expect(far.y).toBeLessThanOrEqual(height);
	});
	it("shows the southern return line below the player when heading north and above when heading south", () => {
		const north = ac04ScopeReturnLine(0, 3000, 3200, 0, 1000, width, height, ox, oy);
		expect(north).toBeDefined();
		expect(north![1]).toBeGreaterThan(oy);
		const south = ac04ScopeReturnLine(0, 3000, 3200, math.pi, 1000, width, height, ox, oy);
		expect(south).toBeDefined();
		expect(south![1]).toBeLessThan(oy);
		expect(ac04ScopeReturnLine(0, -2000, 3200, 0, 1000, width, height, ox, oy)).toBeUndefined();
	});
	it("clips segments to the scope box", () => {
		const clipped = ac04ClipSegment(-50, 10, 250, 10, 100, 100)!;
		expect(clipped[0]).toBeCloseTo(0);
		expect(clipped[2]).toBeCloseTo(100);
		expect(ac04ClipSegment(-50, -10, 250, -10, 100, 100)).toBeUndefined();
	});
});

describe("AC04 command screen layouts", () => {
	it("keeps phone-landscape metadata columns beside each other and above captions after the system inset", () => {
		for (const input of INPUTS) {
			const layout = ac04BriefingLayout(844, 332, input);
			expect(layout.metaLeft.y).toBe(layout.metaRight.y);
			expect(layout.metaLeft.height).toBe(layout.metaRight.height);
			expect(layout.metaLeft.x + layout.metaLeft.width).toBeLessThan(layout.metaRight.x);
			expect(layout.metaRight.y + layout.metaRight.height).toBeLessThan(layout.caption.y);
			expectDisjoint([layout.map, layout.metaLeft, layout.metaRight, layout.caption, layout.commands], "phone safe root");
		}
	});
	it("reserves a separate portrait debrief mission subline above the result table", () => {
		const layout = ac04DebriefLayout(390, 786, "touch");
		expect(layout.title.height).toBeGreaterThanOrEqual(layout.typography.title + layout.typography.small + 16);
		expect(layout.title.y + layout.title.height).toBeLessThan(layout.summary.y);
	});
	it("keeps title, list, detail, help, status and Back visible without page scrolling", () => {
		for (const [width, height] of VIEWPORTS) for (const input of INPUTS) for (const rows of [4, 6, 18]) {
			const layout = ac04MenuLayout(width, height, input, rows), label = `${width}x${height} ${input} ${rows}`;
			const regions = [layout.title, layout.list, layout.detail, layout.help, layout.commands, layout.status];
			expectInside(regions, width, height, label);
			expectDisjoint(regions, label);
			expect(ac04VisibleRows(layout)).toBeGreaterThanOrEqual(1);
			if (input === "touch") expect(layout.rowPitch).toBeGreaterThanOrEqual(AC04_TOUCH_HIT);
		}
	});
	it("fits at least six archive rows on the 1205x525 Studio window", () => {
		expect(ac04VisibleRows(ac04MenuLayout(1205, 525, "keyboard", 18))).toBeGreaterThanOrEqual(6);
	});
	it("reserves the title identity subline above the first command", () => {
		for (const [width, height] of VIEWPORTS) for (const input of INPUTS) {
			const layout = ac04MenuLayout(width, height, input, 4);
			expect(layout.title.height).toBeGreaterThanOrEqual(layout.typography.title + layout.typography.small + 18);
			expect(layout.title.y + layout.title.height).toBeLessThan(layout.list.y);
		}
	});
	it("gives the briefing a square map and a caption lane of at least three lines", () => {
		for (const [width, height] of VIEWPORTS) for (const input of INPUTS) {
			const layout = ac04BriefingLayout(width, height, input), label = `${width}x${height} ${input}`;
			const regions = [layout.map, layout.metaLeft, layout.metaRight, layout.caption, layout.commands];
			expectInside(regions, width, height, label);
			expectDisjoint(regions, label);
			expect(layout.map.width).toBe(layout.map.height);
			expect(layout.caption.height).toBeGreaterThanOrEqual(3 * (layout.typography.caption + 4));
		}
	});
	it("keeps aircraft, objective and debrief commands pinned inside the safe area", () => {
		for (const [width, height] of VIEWPORTS) for (const input of INPUTS) {
			const label = `${width}x${height} ${input}`;
			const aircraft = ac04AircraftLayout(width, height, input);
			const aircraftRegions = [aircraft.name, aircraft.roster, aircraft.preview, aircraft.equipment, aircraft.description, aircraft.commands];
			expectInside(aircraftRegions, width, height, label);
			expectDisjoint(aircraftRegions, label);
			const objective = ac04ObjectiveLayout(width, height, input);
			expectInside([objective.panel, objective.status, objective.commands], width, height, label);
			expectDisjoint([objective.panel, objective.status, objective.commands], label);
			const debrief = ac04DebriefLayout(width, height, input);
			const debriefRegions = [debrief.title, debrief.summary, debrief.statistics, debrief.caption, debrief.status, debrief.commands];
			expectInside(debriefRegions, width, height, label);
			expectDisjoint(debriefRegions, label);
		}
	});
});
