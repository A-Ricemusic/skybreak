import { describe, expect, it } from "@rbxts/jest-globals";
import { ac04Back, ac04BackRoute, ac04ClampFocus, ac04FocusOf, ac04Go, ac04InitialNav, ac04KeyIntent, ac04MoveFocus, ac04ScrollTop, ac04StickIntent, ac04WithFocus } from "../shared/ac04/ui/AC04Routing";

describe("AC04 interface routing", () => {
	it("starts on the title with nowhere to go back to", () => {
		const nav = ac04InitialNav();
		expect(nav.route).toBe("title");
		expect(ac04Back(nav)).toBeUndefined();
	});
	it("returns from records and archives to where they were opened, restoring focus", () => {
		let nav = ac04WithFocus(ac04InitialNav(), "title", 1);
		nav = ac04Go(nav, "records");
		nav = ac04WithFocus(nav, "records", 2);
		nav = ac04Go(nav, "hub");
		nav = ac04WithFocus(nav, "hub", 3);
		nav = ac04Go(nav, "missionArchive");
		nav = ac04WithFocus(nav, "missionArchive", 7, 2);
		nav = ac04Back(nav)!;
		expect(nav.route).toBe("hub");
		expect(ac04FocusOf(nav)).toBe(3);
		nav = ac04Go(nav, "missionArchive");
		expect(ac04FocusOf(nav)).toBe(7);
		expect(nav.scroll.missionArchive).toBe(2);
		nav = ac04Back(ac04Back(nav)!)!;
		expect(nav.route).toBe("records");
		expect(ac04FocusOf(nav)).toBe(2);
		nav = ac04Back(nav)!;
		expect(nav.route).toBe("title");
		expect(ac04FocusOf(nav)).toBe(1);
	});
	it("steps back inside the briefing before leaving it", () => {
		let nav = ac04Go(ac04InitialNav(), "briefing");
		expect(nav.briefingStep).toBe("strategic");
		nav = { ...nav, briefingStep: "detail" };
		nav = ac04Back(nav)!;
		expect(nav.route).toBe("briefing");
		expect(nav.briefingStep).toBe("strategic");
		expect(ac04Back(nav)!.route).toBe("hub");
	});
	it("walks the sortie path back through objective and aircraft to the hub", () => {
		let nav = ac04Go(ac04Go(ac04InitialNav(), "hub"), "aircraft", { aircraftPurpose: "sortie" });
		nav = ac04Go(nav, "objective");
		expect(nav.aircraftPurpose).toBe("sortie");
		nav = ac04Back(nav)!;
		expect(nav.route).toBe("aircraft");
		expect(ac04Back(nav)!.route).toBe("hub");
	});
	it("offers no Back from the sortie, results or story so nothing can skip settlement or acknowledgement", () => {
		for (const route of ["loading", "flight", "result", "story", "title"] as const) expect(ac04BackRoute(ac04Go(ac04InitialNav(), route))).toBeUndefined();
	});
	it("never routes to flight from navigation helpers", () => {
		const nav = ac04Go(ac04InitialNav(), "objective");
		expect(ac04Back(nav)!.route).never.toBe("loading");
		expect(ac04Back(nav)!.route).never.toBe("flight");
	});
});

describe("AC04 focus movement", () => {
	const enabled = [true, false, true, true, false];
	it("skips disabled rows and wraps", () => {
		expect(ac04MoveFocus(0, 1, enabled)).toBe(2);
		expect(ac04MoveFocus(3, 1, enabled)).toBe(0);
		expect(ac04MoveFocus(0, -1, enabled)).toBe(3);
	});
	it("holds at the ends without wrap", () => {
		expect(ac04MoveFocus(3, 1, enabled, false)).toBe(3);
		expect(ac04MoveFocus(0, -1, enabled, false)).toBe(0);
	});
	it("clamps a remembered index onto an enabled row, or -1 when none", () => {
		expect(ac04ClampFocus(1, enabled)).toBe(2);
		expect(ac04ClampFocus(9, enabled)).toBe(3);
		expect(ac04ClampFocus(0, [false, false])).toBe(-1);
		expect(ac04MoveFocus(0, 1, [])).toBe(-1);
	});
	it("scrolls only as far as needed to keep focus visible", () => {
		expect(ac04ScrollTop(0, 18, 6, 0)).toBe(0);
		expect(ac04ScrollTop(6, 18, 6, 0)).toBe(1);
		expect(ac04ScrollTop(17, 18, 6, 0)).toBe(12);
		expect(ac04ScrollTop(13, 18, 6, 12)).toBe(12);
		expect(ac04ScrollTop(4, 18, 6, 12)).toBe(4);
		expect(ac04ScrollTop(2, 3, 6, 5)).toBe(0);
	});
});

describe("AC04 menu input intents", () => {
	it("maps keyboard and gamepad keys and leaves Escape and P alone", () => {
		expect(ac04KeyIntent("Up")).toBe("up");
		expect(ac04KeyIntent("DPadDown")).toBe("down");
		expect(ac04KeyIntent("Return")).toBe("confirm");
		expect(ac04KeyIntent("ButtonA")).toBe("confirm");
		expect(ac04KeyIntent("ButtonB")).toBe("back");
		expect(ac04KeyIntent("Backspace")).toBe("back");
		expect(ac04KeyIntent("Escape")).toBeUndefined();
		expect(ac04KeyIntent("P")).toBeUndefined();
	});
	it("needs a deliberate stick push and a release before repeating", () => {
		expect(ac04StickIntent(0, 0.5)).toBeUndefined();
		expect(ac04StickIntent(0, 0.7)).toBe("up");
		expect(ac04StickIntent(0.1, -0.8)).toBe("down");
		expect(ac04StickIntent(0.8, 0.2)).toBe("right");
		expect(ac04StickIntent(0, 0.4, "up")).toBe("up");
		expect(ac04StickIntent(0, 0.2, "up")).toBeUndefined();
	});
});
