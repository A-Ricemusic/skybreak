import { describe, expect, it } from "@rbxts/jest-globals";
import {
	briefingExcerpt,
	formatElapsed,
	getLoadingLayout,
	LOADING_MIN_TEXT,
	LOADING_SEGMENT_COUNT,
	LoadingProgress,
	loadingHeaderHeight,
	loadingStage,
	loadingTips,
	missionEyebrow,
	segmentLabelWidth,
	stageTarget,
	tipIndex,
	type LoadingInput,
} from "../shared/LoadingScreenModel";
import { MissionCatalog } from "../shared/MissionCatalog";

/** Safe-area sizes (CoreUISafeInsets roots): PC, console (with and without TV-safe), tablet, phones both ways, tiny. */
const LOADING_ROOTS: [number, number][] = [
	[1920, 1022], [2560, 1382], [1366, 710], [1280, 662], [1824, 1026], [1920, 1080],
	[1024, 710], [768, 966],
	[750, 332], [844, 332], [706, 267], [667, 317], [568, 262], [320, 182],
	[390, 750], [430, 830], [375, 609], [320, 510],
];

interface Box { x: number; y: number; width: number; height: number }
function inside(box: Box, width: number, height: number): boolean {
	return box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height;
}
function input(phase: LoadingInput["phase"], worldPhase?: string, preload = 0, world = worldPhase !== undefined): LoadingInput {
	return { phase, worldPhase, preload, world };
}

describe("loading screen layout", () => {
	it("keeps every text block inside the safe area, stacked without overlap", () => {
		for (const [width, height] of LOADING_ROOTS) {
			const layout = getLoadingLayout(width, height);
			const blocks: Box[] = [layout.header];
			if (layout.brief) blocks.push(layout.brief);
			if (layout.tip) blocks.push(layout.tip);
			blocks.push(layout.progress);
			for (const box of blocks) expect(inside(box, width, height)).toBe(true);
			for (let i = 1; i < blocks.size(); i++) expect(blocks[i - 1].y + blocks[i - 1].height).toBeLessThanOrEqual(blocks[i].y);
			if (layout.act) {
				expect(inside(layout.act, width, height)).toBe(true);
				expect(layout.act.x).toBeGreaterThanOrEqual(layout.header.x + layout.header.width);
			}
			expect(layout.header.height).toBe(loadingHeaderHeight(layout));
		}
	});

	it("uses readable type everywhere and large titles on big screens", () => {
		for (const [width, height] of LOADING_ROOTS) {
			const layout = getLoadingLayout(width, height);
			for (const size of [layout.smallSize, layout.metaSize, layout.eyebrowSize, layout.bodySize, layout.codenameSize]) expect(size).toBeGreaterThanOrEqual(LOADING_MIN_TEXT);
			expect(layout.titleSize).toBeGreaterThanOrEqual(22);
			if (layout.mode === "wide" && height >= 700) expect(layout.titleSize).toBeGreaterThanOrEqual(56);
		}
	});

	it("picks wide for PC/console/tablet, tall for portrait phones and compact for short landscape phones", () => {
		expect(getLoadingLayout(1920, 1022).mode).toBe("wide");
		expect(getLoadingLayout(1824, 1026).mode).toBe("wide");
		expect(getLoadingLayout(1024, 710).mode).toBe("wide");
		expect(getLoadingLayout(390, 750).mode).toBe("tall");
		expect(getLoadingLayout(768, 966).mode).toBe("tall");
		expect(getLoadingLayout(750, 332).mode).toBe("compact");
		expect(getLoadingLayout(568, 262).mode).toBe("compact");
	});

	it("draws six equal segments that span the bar, labelled only when the labels fit", () => {
		for (const [width, height] of LOADING_ROOTS) {
			const layout = getLoadingLayout(width, height);
			const total = layout.segmentWidth * LOADING_SEGMENT_COUNT + layout.segmentGap * (LOADING_SEGMENT_COUNT - 1);
			expect(total).toBeCloseTo(layout.progress.width, 3);
			expect(layout.segmentWidth).toBeGreaterThanOrEqual(20);
			if (layout.labelsHeight > 0) expect(layout.segmentWidth).toBeGreaterThanOrEqual(segmentLabelWidth(layout.smallSize));
			expect(layout.labelsHeight + layout.barHeight + 6 + layout.statusHeight).toBe(layout.progress.height);
		}
		expect(getLoadingLayout(1920, 1022).labelsHeight).toBeGreaterThan(0);
	});

	it("shows the objective on PC and phones, and a briefing excerpt where there is room", () => {
		for (const [width, height] of [[1920, 1022], [1280, 662], [1824, 1026], [390, 750], [750, 332], [706, 267]] as [number, number][]) {
			const layout = getLoadingLayout(width, height);
			expect(layout.brief).toBeDefined();
			expect(layout.objectiveLines).toBeGreaterThanOrEqual(1);
			expect(layout.tip).toBeDefined();
		}
		for (const [width, height] of [[1920, 1022], [1280, 662], [390, 750]] as [number, number][]) expect(getLoadingLayout(width, height).excerptLines).toBeGreaterThanOrEqual(2);
		// One excerpt line reads as a fragment: it is never chosen.
		for (const [width, height] of LOADING_ROOTS) expect(getLoadingLayout(width, height).excerptLines).never.toBe(1);
	});

	it("puts the jet behind the copy's free side, inside the full screen", () => {
		for (const [width, height] of LOADING_ROOTS) {
			const jet = getLoadingLayout(width, height).jet;
			expect(jet.x).toBeGreaterThanOrEqual(0);
			expect(jet.y).toBeGreaterThanOrEqual(0);
			expect(jet.x + jet.width).toBeLessThanOrEqual(1);
			expect(jet.y + jet.height).toBeLessThanOrEqual(1);
			expect(jet.width * jet.height).toBeGreaterThanOrEqual(0.35);
		}
	});
});

describe("loading phases", () => {
	it("maps launch and world-build phases to segments in client order", () => {
		const cases: [LoadingInput, number, string][] = [
			[input("building"), 0, "request"],
			[input("queued"), 0, "queued"],
			[input("building", undefined, 0, true), 0, "world"],
			[input("building", "plan"), 1, "plan"],
			[input("building", "environment"), 1, "environment"],
			[input("building", "terrain"), 2, "terrain"],
			[input("building", "dressing"), 3, "dressing"],
			[input("building", "done"), 3, "done"],
			[input("preloading", "done", 0.4), 4, "sync"],
			[input("preloading", "done", 1), 5, "ready"],
		];
		for (const [given, segment, key] of cases) {
			const stage = loadingStage(given);
			expect(stage.segment).toBe(segment);
			expect(stage.key).toBe(key);
		}
	});

	it("says the queue state clearly and names each real phase", () => {
		const queued = loadingStage(input("queued", "terrain"));
		expect(queued.words).toBe("Waiting for the previous mission to clear…");
		expect(queued.queued).toBe(true);
		expect(loadingStage(input("building", "terrain")).words).toBe("Shaping terrain…");
		expect(loadingStage(input("building", "dressing")).words).toBe("Placing scenery and targets…");
		expect(loadingStage(input("preloading", "done", 0.42)).words).toBe("Syncing the world to your aircraft · 42%");
		expect(loadingStage(input("preloading", "done", 1)).words).toBe("Awaiting tower clearance");
		// Unknown attributes (other worlds, future phases) fall back to the generic stage.
		expect(loadingStage(input("building", "mystery", 0, true)).key).toBe("world");
		expect(loadingStage({ phase: "building", worldPhase: 7, world: false, preload: 0 }).key).toBe("request");
	});

	it("never fills a segment before the client sees the next phase", () => {
		for (const given of [input("queued"), input("building"), input("building", "plan"), input("building", "terrain"), input("building", "dressing"), input("building", "done"), input("preloading", "done", 1)]) {
			const stage = loadingStage(given);
			expect(stageTarget(stage, 10000)).toBeLessThan((stage.segment + 1) / LOADING_SEGMENT_COUNT);
			expect(stageTarget(stage, 0)).toBeGreaterThanOrEqual(stage.segment / LOADING_SEGMENT_COUNT);
		}
	});
});

describe("loading progress fill", () => {
	it("only rises, through queue/build regressions and preload jitter, and completes on Started", () => {
		const progress = new LoadingProgress();
		const timeline: [LoadingInput, number][] = [
			[input("building"), 0], [input("queued"), 0.5], [input("queued"), 30], [input("building"), 31],
			[input("building", "plan"), 32], [input("building", "terrain"), 33], [input("building", "plan"), 34],
			[input("building", "terrain"), 50], [input("building", "dressing"), 60], [input("building", "done"), 61],
			[input("preloading", "done", 0.3), 62], [input("preloading", "done", 0.1), 62.2], [input("preloading", "done", 0.8), 63],
			[input("preloading", "done", 1), 64], [input("preloading", "done", 1), 66],
			[{ phase: "preloading", worldPhase: "done", world: true, preload: 0 / 0 }, 66.5],
		];
		let last = 0;
		for (const [given, at] of timeline) {
			const value = progress.Update(loadingStage(given), at);
			expect(value).toBeGreaterThanOrEqual(last);
			expect(value).toBeLessThan(1);
			last = value;
		}
		expect(progress.ActiveSegment()).toBe(5);
		expect(progress.Complete()).toBe(1);
		expect(progress.Value()).toBe(1);
		progress.Reset();
		expect(progress.Value()).toBe(0);
	});

	it("stays monotonic for pseudo-random phase orders and time steps", () => {
		const phases: LoadingInput[] = [input("queued"), input("building"), input("building", "plan"), input("building", "environment"), input("building", "terrain"), input("building", "dressing"), input("building", "done"), input("preloading", "done", 0.2), input("preloading", "done", 0.7), input("preloading", "done", 1)];
		let seed = 12345;
		const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
		for (let run = 0; run < 20; run++) {
			const progress = new LoadingProgress();
			let now = 0, last = 0;
			for (let step = 0; step < 60; step++) {
				now += random() * 3;
				const value = progress.Update(loadingStage(phases[math.floor(random() * phases.size())]), now);
				expect(value).toBeGreaterThanOrEqual(last);
				expect(value).toBeLessThanOrEqual(1);
				last = value;
			}
		}
	});

	it("creeps forward inside a long phase so a 45-second terrain build never looks frozen", () => {
		const progress = new LoadingProgress();
		const terrain = loadingStage(input("building", "terrain"));
		const early = progress.Update(terrain, 0);
		const later = progress.Update(terrain, 5);
		const latest = progress.Update(terrain, 45);
		expect(later).toBeGreaterThan(early);
		expect(latest).toBeGreaterThan(later);
		expect(latest).toBeLessThan(3 / LOADING_SEGMENT_COUNT);
	});
});

describe("loading copy", () => {
	it("formats the elapsed clock", () => {
		expect(formatElapsed(0)).toBe("0:00");
		expect(formatElapsed(7.9)).toBe("0:07");
		expect(formatElapsed(83)).toBe("1:23");
		expect(formatElapsed(725)).toBe("12:05");
		expect(formatElapsed(-4)).toBe("0:00");
		expect(formatElapsed(0 / 0)).toBe("0:00");
	});

	it("labels practice and numbered missions", () => {
		expect(missionEyebrow(0)).toBe("PRACTICE FLIGHT");
		expect(missionEyebrow(2)).toBe("MISSION 02");
		expect(missionEyebrow(18)).toBe("MISSION 18");
	});

	it("gives device-appropriate tips with the real bindings", () => {
		const has = (tips: string[], text: string) => tips.some((tip) => tip.find(text, 1, true)[0] !== undefined);
		const keyboard = loadingTips("keyboard", { rearm: false });
		const touch = loadingTips("touch", { rearm: false });
		const gamepad = loadingTips("gamepad", { rearm: false });
		expect(has(keyboard, "Space")).toBe(true);
		expect(has(keyboard, "Tab")).toBe(true);
		expect(has(keyboard, "Press F to evade")).toBe(true);
		expect(has(touch, "TGT")).toBe(true);
		expect(has(touch, "EVADE")).toBe(true);
		expect(has(touch, "Space")).toBe(false);
		expect(has(gamepad, "RT")).toBe(true);
		expect(has(gamepad, "Press Y")).toBe(true);
		expect(has(gamepad, "Space")).toBe(false);
		expect(has(keyboard, "rearm")).toBe(false);
		expect(has(loadingTips("touch", { rearm: true }), "rearm")).toBe(true);
		for (const tips of [keyboard, touch, gamepad]) for (const tip of tips) expect(tip.size()).toBeLessThanOrEqual(80);
	});

	it("rotates tips on a fixed period", () => {
		expect(tipIndex(5, 0)).toBe(0);
		expect(tipIndex(5, 6.9)).toBe(0);
		expect(tipIndex(5, 7)).toBe(1);
		expect(tipIndex(5, 35)).toBe(0);
		expect(tipIndex(0, 12)).toBe(0);
	});

	it("excerpts every mission briefing at a sentence or word boundary within budget", () => {
		const missions = [MissionCatalog.Get(0), ...MissionCatalog.All()];
		for (const mission of missions) {
			for (const budget of [60, 90, 140, 220]) {
				const excerpt = briefingExcerpt(mission.briefing, budget);
				expect(utf8.len(excerpt)[0] ?? 0).toBeLessThanOrEqual(budget);
				expect(excerpt.size()).toBeGreaterThan(0);
				const last = excerpt.sub(-1);
				const ellipsis = excerpt.sub(-3) === "…";
				expect(ellipsis || last === "." || last === "!" || last === "?" || excerpt === mission.briefing).toBe(true);
			}
		}
		expect(briefingExcerpt("Short.", 40)).toBe("Short.");
		expect(briefingExcerpt("One two three four five six seven", 15)).toBe("One two three…");
		expect(briefingExcerpt("First sentence here. Second sentence that is long.", 30)).toBe("First sentence here.");
	});
});
