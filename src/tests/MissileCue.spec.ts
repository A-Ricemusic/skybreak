import { describe, expect, it } from "@rbxts/jest-globals";
import { MissileCue } from "../shared/MissileCue";

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
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakNow: true, speed: 320 })).toBe("BREAK ← · MISSILE 1.4s");
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakNow: true, speed: 240 })).toBe("BREAK ← · MISSILE 1.4s · POWER↑");
		// A slow jet keeps POWER even on a narrow HUD: the break the server checked is at full power.
		expect(MissileCue.Text({ seconds: 1.4, bearing: -20, breakNow: true, speed: 240 }, true)).toBe("BREAK → POWER↑");
		expect(MissileCue.Text({ seconds: 1.4, bearing: -20, breakNow: true, speed: 300 }, true)).toBe("BREAK →");
		expect(MissileCue.Text({ seconds: 1.4 })).toBeUndefined();
		expect(MissileCue.Text({ seconds: 1.4, bearing: 0 / 0 })).toBeUndefined();
	});
	it("turns the way the server's BREAK check says, even toward the missile's side", () => {
		expect(MissileCue.Text({ seconds: 1.4, bearing: 150, breakNow: true, breakRight: true, speed: 320 })).toBe("BREAK → · MISSILE 1.4s");
		expect(MissileCue.Text({ seconds: 1.4, bearing: -150, breakNow: true, breakRight: false, speed: 320 }, true)).toBe("BREAK ←");
		// No BREAK: the direction flag is ignored and the missile's position shows.
		expect(MissileCue.Text({ seconds: 2.14, bearing: -150, breakRight: true }, true)).toBe("MISSILE ↓ 2.1s");
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
});
