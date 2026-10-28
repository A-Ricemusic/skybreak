/**
 * AC04 interface routing and focus memory. Pure: the client keeps one AC04NavState and replaces it
 * through these functions, so back targets, remembered selections and list scrolling are testable.
 * Routing never launches a sortie; launching is an explicit command on the objective screen.
 */
export type AC04Route =
	| "title" | "records" | "controls"
	| "hub" | "briefing" | "aircraft" | "missionArchive" | "storyArchive" | "objective"
	| "loading" | "flight" | "result" | "story";
export type AC04BriefingStep = "strategic" | "detail";
/** "sortie": aircraft chosen on the way to the objective screen. "review": opened from the hub, returns there. */
export type AC04AircraftPurpose = "sortie" | "review";
export type AC04Intent = "up" | "down" | "left" | "right" | "confirm" | "back";

export interface AC04NavState {
	route: AC04Route;
	/** Last focused row per route; returning to a route restores it. */
	focus: Partial<Record<AC04Route, number>>;
	/** First visible row per scrolling list route. */
	scroll: Partial<Record<AC04Route, number>>;
	briefingStep: AC04BriefingStep;
	aircraftPurpose: AC04AircraftPurpose;
}

/** Routes whose commands accept keyboard/gamepad navigation. Flight uses the pause menu instead. */
export const AC04_MENU_ROUTES: readonly AC04Route[] = ["title", "records", "controls", "hub", "briefing", "aircraft", "missionArchive", "storyArchive", "objective", "loading", "result"];

const BACK: Partial<Record<AC04Route, AC04Route>> = {
	records: "title", controls: "title",
	hub: "records", missionArchive: "hub", storyArchive: "hub", objective: "aircraft",
};

export function ac04InitialNav(): AC04NavState {
	return { route: "title", focus: {}, scroll: {}, briefingStep: "strategic", aircraftPurpose: "review" };
}

export function ac04Go(state: AC04NavState, route: AC04Route, patch: { briefingStep?: AC04BriefingStep; aircraftPurpose?: AC04AircraftPurpose } = {}): AC04NavState {
	return {
		...state, route,
		briefingStep: patch.briefingStep ?? (route === "briefing" ? "strategic" : state.briefingStep),
		aircraftPurpose: patch.aircraftPurpose ?? state.aircraftPurpose,
	};
}

/** The route Back leads to, or undefined where Back is not offered (title, sortie, results, story). */
export function ac04BackRoute(state: AC04NavState): AC04Route | undefined {
	if (state.route === "briefing") return state.briefingStep === "detail" ? "briefing" : "hub";
	if (state.route === "aircraft") return "hub";
	return BACK[state.route];
}

export function ac04Back(state: AC04NavState): AC04NavState | undefined {
	if (state.route === "briefing" && state.briefingStep === "detail") return { ...state, briefingStep: "strategic" };
	const target = ac04BackRoute(state);
	return target === undefined ? undefined : ac04Go(state, target);
}

export function ac04FocusOf(state: AC04NavState, route: AC04Route = state.route): number {
	return state.focus[route] ?? 0;
}

export function ac04WithFocus(state: AC04NavState, route: AC04Route, index: number, scroll?: number): AC04NavState {
	const focus = { ...state.focus };
	focus[route] = index;
	if (scroll === undefined) return { ...state, focus };
	const scrolls = { ...state.scroll };
	scrolls[route] = scroll;
	return { ...state, focus, scroll: scrolls };
}

/** Nearest enabled row at or after `index` (then before it); -1 when nothing is enabled. */
export function ac04ClampFocus(index: number, enabled: readonly boolean[]): number {
	const count = enabled.size();
	if (count === 0) return -1;
	const start = math.clamp(math.floor(index), 0, count - 1);
	for (let i = start; i < count; i++) if (enabled[i]) return i;
	for (let i = start - 1; i >= 0; i--) if (enabled[i]) return i;
	return -1;
}

/** Next enabled row in `delta` direction, skipping disabled rows; wraps when asked. */
export function ac04MoveFocus(index: number, delta: number, enabled: readonly boolean[], wrap = true): number {
	const count = enabled.size();
	if (count === 0) return -1;
	const step = delta < 0 ? -1 : 1;
	let current = math.clamp(math.floor(index), 0, count - 1);
	for (let tries = 0; tries < count; tries++) {
		let destination = current + step;
		if (destination < 0 || destination >= count) {
			if (!wrap) return enabled[current] ? current : ac04ClampFocus(index, enabled);
			destination = destination < 0 ? count - 1 : 0;
		}
		current = destination;
		if (enabled[current]) return current;
	}
	return ac04ClampFocus(index, enabled);
}

/** First visible row so the focused row stays inside a window of `visible` rows; moves only when needed. */
export function ac04ScrollTop(focus: number, count: number, visible: number, top: number): number {
	const window = math.max(1, math.floor(visible));
	const maxTop = math.max(0, count - window);
	let result = math.clamp(math.floor(top), 0, maxTop);
	if (focus < result) result = focus;
	else if (focus >= result + window) result = focus - window + 1;
	return math.clamp(result, 0, maxTop);
}

const KEY_INTENTS: { [name: string]: AC04Intent } = {
	Up: "up", W: "up", DPadUp: "up",
	Down: "down", S: "down", DPadDown: "down",
	Left: "left", A: "left", DPadLeft: "left",
	Right: "right", D: "right", DPadRight: "right",
	Return: "confirm", KeypadEnter: "confirm", ButtonA: "confirm",
	Backspace: "back", ButtonB: "back",
};

/**
 * Menu intent for a KeyCode name. Escape stays with the Roblox menu and P with pause. Space is not a
 * confirm key: it fires missiles, and a held trigger at sortie end must not skip the debrief.
 */
export function ac04KeyIntent(keyName: string): AC04Intent | undefined {
	return KEY_INTENTS[keyName];
}

/** Thumbstick direction with hysteresis: engages past 0.6, holds until it falls under 0.35. */
export function ac04StickIntent(x: number, y: number, held?: AC04Intent): AC04Intent | undefined {
	const magnitude = math.max(math.abs(x), math.abs(y));
	if (held !== undefined && magnitude >= 0.35) return held;
	if (magnitude < 0.6) return undefined;
	if (math.abs(y) >= math.abs(x)) return y > 0 ? "up" : "down";
	return x > 0 ? "right" : "left";
}
