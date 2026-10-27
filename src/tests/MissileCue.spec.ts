import { describe, expect, it } from "@rbxts/jest-globals";
import { MissileCue, MissileCueInput } from "../shared/MissileCue";

// Pure HUD wording for the missile cue; also runs in the offline Luau VM (toBe/toBeUndefined only).
describe("Missile cue", () => {
	it("points toward the missile and names its clock position", () => {
		expect(MissileCue.Arrow(0)).toBe("↑");
		expect(MissileCue.Arrow(90)).toBe("→");
		expect(MissileCue.Arrow(-90)).toBe("←");
		expect(MissileCue.Arrow(180)).toBe("↓");
		expect(MissileCue.Arrow(-150)).toBe("↓");
		expect(MissileCue.Clock(0)).toBe(12);
		expect(MissileCue.Clock(90)).toBe(3);
		expect(MissileCue.Clock(-180)).toBe(6);
		expect(MissileCue.Clock(-90)).toBe(9);
		expect(MissileCue.Clock(-150)).toBe(7);
		expect(MissileCue.Clock(350)).toBe(12);
	});
	it("breaks away from the missile's side when the server sends no direction", () => {
		expect(MissileCue.BreakArrow(135)).toBe("←");
		expect(MissileCue.BreakArrow(-30)).toBe("→");
		expect(MissileCue.BreakArrow(0)).toBe("←");
	});
	it("reads seconds and direction, and BREAK inside the window", () => {
		expect(MissileCue.Text({ seconds: 2.14, bearing: -150 })).toBe("MISSILE 7 O'CLOCK ↓ 2.1s");
		expect(MissileCue.Text({ seconds: 2.14, bearing: -150 }, true)).toBe("MISSILE ↓ 2.1s");
		// Not closing: direction only.
		expect(MissileCue.Text({ bearing: 90 })).toBe("MISSILE 3 O'CLOCK →");
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakCue: "break", speed: 320 })).toBe("BREAK ← · MISSILE 1.4s");
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakCue: "break", speed: 240 })).toBe("BREAK ← · MISSILE 1.4s · POWER↑");
		// A slow jet keeps POWER even on a narrow HUD: the break the server checked is at full power.
		expect(MissileCue.Text({ seconds: 1.4, bearing: -20, breakCue: "break", speed: 240 }, true)).toBe("BREAK → POWER↑");
		expect(MissileCue.Text({ seconds: 1.4, bearing: -20, breakCue: "break", speed: 300 }, true)).toBe("BREAK →");
		expect(MissileCue.Text({ seconds: 1.4 })).toBeUndefined();
		expect(MissileCue.Text({ seconds: 1.4, bearing: 0 / 0 })).toBeUndefined();
	});
	it("turns the way the server's BREAK check says, even toward the missile's side", () => {
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakCue: "break", breakRight: true, speed: 320 })).toBe("BREAK → · MISSILE 1.4s");
		expect(MissileCue.Text({ seconds: 1.4, bearing: -150, breakCue: "break", breakRight: false, speed: 320 }, true)).toBe("BREAK ←");
		// No BREAK: the direction flag is ignored and the missile's position shows.
		expect(MissileCue.Text({ seconds: 2.14, bearing: -150, breakRight: true }, true)).toBe("MISSILE ↓ 2.1s");
	});
	it("says when to let go: HOLD on the same arrow while pulling, then CLEAR", () => {
		expect(MissileCue.Text({ seconds: 1.2, bearing: 150, breakCue: "hold", breakRight: true, speed: 300 })).toBe("HOLD → · MISSILE 1.2s");
		expect(MissileCue.Text({ seconds: 1.2, bearing: 150, breakCue: "hold", breakRight: false, speed: 240 })).toBe("HOLD ← · MISSILE 1.2s · POWER↑");
		expect(MissileCue.Text({ seconds: 1.2, bearing: 150, breakCue: "hold", breakRight: true, speed: 300 }, true)).toBe("HOLD →");
		expect(MissileCue.Text({ seconds: 1.2, bearing: 150, breakCue: "hold", breakRight: true, speed: 240 }, true)).toBe("HOLD → POWER↑");
		// A blind missile it follows is no longer closing or reported as incoming: no countdown, no bearing, still HOLD.
		expect(MissileCue.Text({ breakCue: "hold", breakRight: false, speed: 300 })).toBe("HOLD ←");
		expect(MissileCue.Text({ breakCue: "clear", speed: 240 })).toBe("CLEAR");
		expect(MissileCue.Text({ seconds: 1.2, bearing: 40, breakCue: "clear" }, true)).toBe("CLEAR");
	});
	it("shows HOLD and CLEAR after MISSILE INBOUND has gone, in green for CLEAR", () => {
		const row = { alertWidth: 220, cueWidth: 220, cueTextSize: 12, shared: false };
		const hold = MissileCue.Route("LOW SPEED", { breakCue: "hold", breakRight: true, speed: 300 }, row);
		expect(hold.alert).toBe("LOW SPEED");
		expect(hold.cue).toBe("HOLD →");
		expect(hold.clear).toBe(false);
		const clear = MissileCue.Route("", { breakCue: "clear" }, row);
		expect(clear.cue).toBe("CLEAR");
		expect(clear.clear).toBe(true);
		// Shared row: inlined ahead of any flight advice, or on its own.
		expect(MissileCue.Route("", { breakCue: "clear" }, { ...row, shared: true }).alert).toBe("CLEAR");
		expect(MissileCue.Route("STALL", { breakCue: "hold", breakRight: false, speed: 300 }, { ...row, alertWidth: 180, shared: true }).alert).toBe("HOLD ← · STALL");
		expect(MissileCue.Route("MISSILE INBOUND · STALL", { seconds: 1.2, bearing: 10, breakCue: "hold", breakRight: false, speed: 300 }, { ...row, alertWidth: 180, shared: true }).alert).toBe("HOLD ← · STALL");
		// BREAK still needs MISSILE INBOUND.
		expect(MissileCue.Route("", { seconds: 1.4, bearing: 150, breakCue: "break", speed: 320 }, row).cue).toBeUndefined();
	});
	it("replaces only MISSILE INBOUND in the shared warning line", () => {
		const cue = { seconds: 2.14, bearing: 180 };
		expect(MissileCue.Apply("MISSILE INBOUND", cue)).toBe("MISSILE 6 O'CLOCK ↓ 2.1s");
		expect(MissileCue.Apply("MISSILE INBOUND · LOW SPEED", cue)).toBe("MISSILE 6 O'CLOCK ↓ 2.1s · LOW SPEED");
		// A lock warning or plain flight advice is left alone, and so is everything without a bearing.
		expect(MissileCue.Apply("MISSILE LOCK · STALL", cue)).toBe("MISSILE LOCK · STALL");
		expect(MissileCue.Apply("", cue)).toBe("");
		expect(MissileCue.Apply("MISSILE INBOUND", {})).toBe("MISSILE INBOUND");
	});
	it("routes the cue to the reserved row, or inlines it once where that row is the warning row", () => {
		const cue = { seconds: 2.14, bearing: 180 };
		const row = { alertWidth: 220, cueWidth: 220, cueTextSize: 12, shared: false };
		// Separate row: the warning keeps MISSILE INBOUND and its flight advice; the row gets the cue.
		const split = MissileCue.Route("MISSILE INBOUND · LOW SPEED", cue, row);
		expect(split.alert).toBe("MISSILE INBOUND · LOW SPEED");
		expect(split.cue).toBe("MISSILE 6 O'CLOCK ↓ 2.1s");
		// Shared row (compact roots): one text source, the cue inlined, nothing for the second label.
		const shared = MissileCue.Route("MISSILE INBOUND", cue, { ...row, alertWidth: 180, cueWidth: 180, shared: true });
		expect(shared.alert).toBe("MISSILE ↓ 2.1s");
		expect(shared.cue).toBeUndefined();
		// No inbound missile (a lock, flight advice, nothing): no cue.
		expect(MissileCue.Route("MISSILE LOCK", cue, row).cue).toBeUndefined();
		expect(MissileCue.Route("", cue, row).cue).toBeUndefined();
		expect(MissileCue.Route("MISSILE INBOUND", {}, row).cue).toBeUndefined();
	});
	it("words the reserved row for its own width so POWER is never truncated", () => {
		const slowBreak: MissileCueInput = { seconds: 1.4, bearing: 150, breakCue: "break", speed: 240 };
		const row = { alertWidth: 240, cueWidth: 240, cueTextSize: 12, shared: false };
		// 31 RobotoMono glyphs at 12 pt is ~223 px.
		expect(MissileCue.Route("MISSILE INBOUND", slowBreak, row).cue).toBe("BREAK ← · MISSILE 1.4s · POWER↑");
		expect(MissileCue.Route("MISSILE INBOUND", slowBreak, { ...row, cueWidth: 220 }).cue).toBe("BREAK ← POWER↑");
		expect(MissileCue.Route("MISSILE INBOUND", { ...slowBreak, speed: 320 }, { ...row, cueWidth: 220 }).cue).toBe("BREAK ← · MISSILE 1.4s");
		expect(MissileCue.Route("MISSILE INBOUND", { seconds: 2.14, bearing: -150 }, { ...row, cueWidth: 120, cueTextSize: 10 }).cue).toBe("MISSILE ↓ 2.1s");
	});
});
