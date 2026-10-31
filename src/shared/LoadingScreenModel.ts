import type { LaunchPhase } from "./LaunchLoading";
import type { InputMode, Rectangle } from "./UILayout";

/**
 * Pure model for the mission loading screen (D-200): layout per screen size, the
 * launch/world-build phase -> progress-segment mapping, a fill that never goes
 * backwards, device tips and the briefing excerpt. No Roblox instances, so the
 * offline Luau runner and Jest both exercise it.
 */

/** Six equal segments, in the order the client actually observes them. */
export const LOADING_SEGMENTS = ["CLEAR", "PLAN", "TERRAIN", "SCENERY", "SYNC", "READY"] as const;
export const LOADING_SEGMENT_COUNT = LOADING_SEGMENTS.size();

/** Server `WorldBuildPhase` attribute values (CompositionWorld, M01–M03 builders). */
export type WorldBuildPhase = "plan" | "environment" | "terrain" | "dressing" | "done";

export interface LoadingInput {
	phase: LaunchPhase;
	/** Raw `WorldBuildPhase` attribute; anything unrecognised is ignored. */
	worldPhase?: unknown;
	/** True once the server has named the mission's build folder (the Building message). */
	world: boolean;
	/** 0..1 replication/preload progress from MissionPreload. */
	preload: number;
}

export interface LoadingStage {
	/** Stable identity: the creep timer restarts whenever it changes. */
	key: string;
	segment: number;
	/** Fraction of the segment already earned when the stage begins. */
	base: number;
	/** Creep ceiling within the segment; a stage never fills its segment on its own. */
	cap: number;
	/** Creep time constant (seconds); larger is slower. */
	tau: number;
	/** Measured fraction inside the segment, when the client has one (preload). */
	measured?: number;
	words: string;
	queued: boolean;
}

function finite(value: number, fallback: number): number {
	return value === value && value !== math.huge && value !== -math.huge ? value : fallback;
}

export function isWorldBuildPhase(value: unknown): value is WorldBuildPhase {
	return value === "plan" || value === "environment" || value === "terrain" || value === "dressing" || value === "done";
}

/** Maps what the client knows (launch phase, server build attribute, preload fraction) to a segment and words. */
export function loadingStage(input: LoadingInput): LoadingStage {
	if (input.phase === "queued")
		return { key: "queued", segment: 0, base: 0, cap: 0.4, tau: 30, words: "Waiting for the previous mission to clear…", queued: true };
	if (input.phase === "preloading") {
		const preload = math.clamp(finite(input.preload, 0), 0, 1);
		if (preload >= 1) return { key: "ready", segment: 5, base: 0, cap: 0.85, tau: 1.5, words: "Awaiting tower clearance", queued: false };
		return { key: "sync", segment: 4, base: 0, cap: 1, tau: 1, measured: preload, words: `Syncing the world to your aircraft · ${math.floor(preload * 100)}%`, queued: false };
	}
	const world = input.worldPhase;
	if (world === "plan") return { key: "plan", segment: 1, base: 0, cap: 0.6, tau: 3, words: "Planning the battlespace…", queued: false };
	if (world === "environment") return { key: "environment", segment: 1, base: 0.6, cap: 0.9, tau: 2, words: "Setting weather and light…", queued: false };
	if (world === "terrain") return { key: "terrain", segment: 2, base: 0, cap: 0.9, tau: 10, words: "Shaping terrain…", queued: false };
	if (world === "dressing") return { key: "dressing", segment: 3, base: 0, cap: 0.85, tau: 8, words: "Placing scenery and targets…", queued: false };
	if (world === "done") return { key: "done", segment: 3, base: 0.9, cap: 0.98, tau: 2, words: "World built · handing over…", queued: false };
	if (input.world) return { key: "world", segment: 0, base: 0.5, cap: 0.9, tau: 3, words: "Preparing the world…", queued: false };
	return { key: "request", segment: 0, base: 0, cap: 0.5, tau: 3, words: "Requesting sortie…", queued: false };
}

/** Overall 0..1 target for a stage `elapsed` seconds after it began. */
export function stageTarget(stage: LoadingStage, elapsed: number): number {
	let within: number;
	if (stage.measured !== undefined) within = math.clamp(stage.measured, 0, 1) * 0.98;
	else {
		const t = math.max(0, finite(elapsed, 0));
		within = stage.base + (stage.cap - stage.base) * (1 - math.exp(-t / math.max(0.1, stage.tau)));
	}
	return math.clamp((stage.segment + math.clamp(within, 0, 1)) / LOADING_SEGMENT_COUNT, 0, 1);
}

/**
 * Displayed fill. Server phases can repeat or arrive out of order (queue -> building,
 * a late attribute), so the value only ever rises; Complete() fills it on Started.
 */
export class LoadingProgress {
	private shown = 0;
	private key?: string;
	private started = 0;
	public Value(): number { return this.shown; }
	public Reset(): void { this.shown = 0; this.key = undefined; this.started = 0; }
	public Update(stage: LoadingStage, now: number): number {
		if (stage.key !== this.key) { this.key = stage.key; this.started = now; }
		this.shown = math.max(this.shown, stageTarget(stage, now - this.started));
		return this.shown;
	}
	public Complete(): number { this.shown = 1; return 1; }
	/** Index of the segment the fill is currently inside (the last one when full). */
	public ActiveSegment(): number { return math.min(LOADING_SEGMENT_COUNT - 1, math.floor(this.shown * LOADING_SEGMENT_COUNT)); }
}

/** "0:07", "1:23", "12:05": mission-clock style elapsed time. */
export function formatElapsed(seconds: number): string {
	const whole = math.max(0, math.floor(finite(seconds, 0)));
	return string.format("%d:%02d", math.floor(whole / 60), whole % 60);
}

/** Up to `maxChars`, ending on a sentence where possible, otherwise on a word with an ellipsis. */
export function briefingExcerpt(text: string, maxChars: number): string {
	const trimmed = text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
	if (trimmed.size() <= maxChars) return trimmed;
	let best = 0;
	for (let i = 1; i <= maxChars; i++) {
		const c = trimmed.sub(i, i);
		if ((c === "." || c === "!" || c === "?") && (i === trimmed.size() || trimmed.sub(i + 1, i + 1) === " ")) best = i;
	}
	if (best >= maxChars * 0.4) return trimmed.sub(1, best);
	let cut = maxChars - 1;
	while (cut > 1 && trimmed.sub(cut + 1, cut + 1) !== " ") cut--;
	return `${trimmed.sub(1, cut).gsub("[%s,;:%-]+$", "")[0]}…`;
}

export interface LoadingTipOptions {
	/** The mission has a rearm/service stop. */
	rearm: boolean;
}

/** Control tips for the active device; every binding matches FlightController/MissionHud. */
export function loadingTips(mode: InputMode, options: LoadingTipOptions): string[] {
	const tips: string[] =
		mode === "touch"
			? [
				"Drag the left stick to fly; push the right stick up to speed up.",
				"Tap TGT, or tap an enemy's box, to select a target.",
				"Hold the lock on a target, then tap FIRE.",
				"Missile inbound? Tap EVADE to break away.",
			]
			: mode === "gamepad"
				? [
					"Left stick flies. LB slows down, RB speeds up.",
					"Press Y to cycle targets: the one ahead of your nose comes first.",
					"Hold the lock, then pull RT to fire a missile.",
					"Missile inbound? Press B to evade. X fires your special weapon.",
				]
				: [
					"W/S pitch and A/D turn. Q slows down; E or Shift speeds up.",
					"Tab or R cycles targets: the one ahead of your nose comes first.",
					"Hold the lock, then press Space to fire a missile.",
					"Missile inbound? Press F to evade. C fires your special weapon.",
					"Press P to pause the sortie.",
				];
	tips.push("Targets marked TGT are your objectives; other contacts add score.");
	if (options.rearm) tips.push("Low on missiles? Land at the service stop to rearm.");
	return tips;
}

/** The tip shown `elapsed` seconds into the load, rotating every `period` seconds. */
export function tipIndex(count: number, elapsed: number, period = 7): number {
	if (count <= 0) return 0;
	return math.floor(math.max(0, finite(elapsed, 0)) / period) % count;
}

export type LoadingMode = "wide" | "tall" | "compact";

/** Fractions of the full (inset-free) screen, for decoration behind the safe content. */
export interface ScaleRectangle { x: number; y: number; width: number; height: number }

export interface LoadingLayout {
	mode: LoadingMode;
	pad: number;
	/** Safe-area rectangles (CoreUISafeInsets space): every text element lives in these. */
	header: Rectangle;
	brief?: Rectangle;
	tip?: Rectangle;
	progress: Rectangle;
	act?: Rectangle;
	/** Progress band rows, relative to `progress`. */
	labelsHeight: number;
	barHeight: number;
	statusHeight: number;
	segmentGap: number;
	segmentWidth: number;
	/** Brief rows: objective label + up to two objective lines, then excerpt lines. */
	objectiveLines: number;
	excerptLines: number;
	eyebrowSize: number;
	titleSize: number;
	codenameSize: number;
	metaSize: number;
	bodySize: number;
	smallSize: number;
	/** The jet viewport, in full-screen fractions (it may sit behind the top bar and notch). */
	jet: ScaleRectangle;
}

/** Smallest text the loading screen draws (≥ UILayout's MIN_PHYSICAL_TEXT). */
export const LOADING_MIN_TEXT = 10;
/** Header rows: eyebrow, title, codename, meta. */
export const HEADER_ROW_GAP = 4;
export const BRIEF_LINE_HEIGHT = 1.3;

/** Conservative width of the longest segment label ("TERRAIN"/"SCENERY") in GothamBold caps. */
export function segmentLabelWidth(size: number): number {
	let longest = 0;
	for (const name of LOADING_SEGMENTS) longest = math.max(longest, name.size());
	return math.ceil(longest * size * 0.72) + 4;
}

export function loadingHeaderHeight(layout: Pick<LoadingLayout, "eyebrowSize" | "titleSize" | "codenameSize" | "metaSize">): number {
	return layout.eyebrowSize + 4 + layout.titleSize + 6 + layout.codenameSize + 4 + layout.metaSize + 4 + HEADER_ROW_GAP * 3;
}

/**
 * Layout for a safe area of `width` x `height`. Wide: title column left, jet right,
 * progress across the bottom. Tall (portrait phones): jet across the top, copy
 * below. Compact (short landscape phones): smaller type, the excerpt only if it fits.
 */
export function getLoadingLayout(width: number, height: number): LoadingLayout {
	const w = math.max(1, math.floor(width)), h = math.max(1, math.floor(height));
	const mode: LoadingMode = w < h * 0.9 ? "tall" : h < 360 ? "compact" : "wide";
	const pad = math.clamp(math.floor(math.min(w, h) * 0.05 + 0.5), 12, 48);
	const wide = mode === "wide", compact = mode === "compact";
	const titleSize = wide ? math.clamp(math.floor(h * 0.085), 34, 72) : compact ? math.clamp(math.floor(h * 0.1), 22, 32) : math.clamp(math.floor(w * 0.1), 26, 44);
	const eyebrowSize = wide ? (h >= 700 ? 16 : 14) : compact ? 11 : 13;
	const codenameSize = wide ? (h >= 700 ? 20 : 16) : compact ? 12 : 15;
	const metaSize = wide ? (h >= 700 ? 14 : 12) : compact ? 10 : 12;
	const bodySize = wide ? (h >= 700 ? 16 : 14) : compact ? 12 : 14;
	const smallSize = wide ? (h >= 700 ? 13 : 12) : compact ? 10 : 11;
	const inner = w - pad * 2;

	// Progress band pinned to the bottom of the safe area.
	const progressWidth = wide ? math.min(inner, 1200) : inner;
	const segmentGap = compact ? 3 : 4;
	const segmentWidth = (progressWidth - segmentGap * (LOADING_SEGMENT_COUNT - 1)) / LOADING_SEGMENT_COUNT;
	const showLabels = !compact && segmentWidth >= segmentLabelWidth(smallSize);
	const labelsHeight = showLabels ? smallSize + 6 : 0;
	const barHeight = compact ? 4 : 6;
	const statusHeight = smallSize + 8;
	const bandHeight = labelsHeight + barHeight + 6 + statusHeight;
	const progress = { x: pad, y: h - pad - bandHeight, width: progressWidth, height: bandHeight };

	// Header: tall layouts start under the jet strip; the others start at the top.
	const columnWidth = wide ? math.clamp(math.floor(w * 0.48), 280, 640) : compact ? math.clamp(math.floor(w * 0.54), 200, 460) : inner;
	const sizes = { eyebrowSize, titleSize, codenameSize, metaSize };
	const headerHeight = loadingHeaderHeight(sizes);
	const headerTop = mode === "tall" ? math.max(pad, math.floor(h * 0.4)) : pad + (wide ? math.floor(h * 0.04) : 0);
	const header = { x: pad, y: headerTop, width: columnWidth, height: headerHeight };

	// Tip line above the band, when the column below the header has room for it.
	const tipHeight = smallSize + 8;
	const gap = compact ? 8 : 14;
	let tip: Rectangle | undefined = { x: pad, y: progress.y - gap - tipHeight, width: progressWidth, height: tipHeight };
	if (tip.y < header.y + header.height + gap) tip = undefined;

	// Brief: objective (label + up to two lines) then the excerpt, in what remains.
	const briefTop = header.y + header.height + gap;
	const briefBottom = (tip ? tip.y : progress.y) - gap;
	const line = math.ceil(bodySize * BRIEF_LINE_HEIGHT);
	const labelRow = smallSize + 4;
	let brief: Rectangle | undefined;
	let objectiveLines = 0, excerptLines = 0;
	const available = briefBottom - briefTop;
	if (available >= labelRow + line) {
		objectiveLines = available >= labelRow + line * 2 + 6 ? 2 : 1;
		const remaining = available - labelRow - objectiveLines * line - 6;
		excerptLines = math.clamp(math.floor(remaining / line), 0, wide ? 4 : 3);
		if (excerptLines === 1) excerptLines = 0; // a single excerpt line reads as a fragment
		const used = labelRow + objectiveLines * line + (excerptLines > 0 ? 6 + excerptLines * line : 0);
		brief = { x: pad, y: briefTop, width: columnWidth, height: used };
	}

	// Act label: top-right on wide screens, clear of the header column.
	const actWidth = math.min(260, inner - columnWidth - pad);
	const act = wide && actWidth >= 140 ? { x: w - pad - actWidth, y: pad, width: actWidth, height: smallSize + 6 } : undefined;

	const jet: ScaleRectangle = wide ? { x: 0.4, y: 0.06, width: 0.6, height: 0.72 } : compact ? { x: 0.46, y: 0.02, width: 0.54, height: 0.74 } : { x: 0, y: 0.04, width: 1, height: 0.4 };
	return {
		mode, pad, header, brief, tip, progress, act,
		labelsHeight, barHeight, statusHeight, segmentGap, segmentWidth,
		objectiveLines, excerptLines,
		eyebrowSize, titleSize, codenameSize, metaSize, bodySize, smallSize, jet,
	};
}

/** Character budget for the excerpt: roughly what `lines` lines of `size` px text hold at `width`. */
export function excerptBudget(width: number, size: number, lines: number): number {
	if (lines <= 0) return 0;
	return math.floor((width / (size * 0.52)) * lines * 0.9);
}

/** The eyebrow over the title: practice has no number. */
export function missionEyebrow(missionId: number): string {
	return missionId === 0 ? "PRACTICE FLIGHT" : `MISSION ${string.format("%02d", missionId)}`;
}
