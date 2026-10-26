import { describe, expect, it } from "@rbxts/jest-globals";

import {
	TARGET_BOX_LIMIT,
	TARGET_BOX_MAX,
	TARGET_BOX_MIN,
	TARGET_BOX_SELECTED_MIN,
	TargetBoxes,
	type RankedContact,
} from "../shared/TargetBoxes";
import { getHudLayout } from "../shared/UILayout";

const ME = 4242;
function flags(enemy: unknown, owner: unknown, damageable: unknown, required: unknown) {
	return { enemy, owner, damageable, required };
}

describe("target box validity", () => {
	it("boxes exactly the enemies the server would damage: required green, raiders optional", () => {
		expect(TargetBoxes.Tone(flags(true, ME, true, true), ME)).toBe("required");
		expect(TargetBoxes.Tone(flags(true, ME, true, false), ME)).toBe("optional");
	});
	it("gives no box to protected, dead, foreign or not-yet-published contacts", () => {
		// Not damageable this phase (the ace before its phase, the tutorial bandits before the radar).
		expect(TargetBoxes.Tone(flags(true, ME, false, true), ME)).toBeUndefined();
		// Killed (SkybreakEnemy cleared) or another player's sortie.
		expect(TargetBoxes.Tone(flags(false, ME, true, true), ME)).toBeUndefined();
		expect(TargetBoxes.Tone(flags(true, 7, true, true), ME)).toBeUndefined();
		// Attributes still replicating: no box until the server has said so.
		expect(TargetBoxes.Tone(flags(true, ME, undefined, true), ME)).toBeUndefined();
		expect(TargetBoxes.Tone(flags(undefined, undefined, undefined, undefined), ME)).toBeUndefined();
	});
	it("still boxes the selected target when it is protected, in the muted tone", () => {
		expect(TargetBoxes.SelectedTone(flags(true, ME, false, true), ME)).toBe("protected");
		expect(TargetBoxes.SelectedTone(flags(true, ME, true, true), ME)).toBe("required");
		expect(TargetBoxes.SelectedTone(flags(true, ME, true, false), ME)).toBe("optional");
	});
});

describe("target box size", () => {
	it("shrinks with distance between the min and max", () => {
		const near = TargetBoxes.Size(150, 390);
		const mid = TargetBoxes.Size(400, 390);
		const far = TargetBoxes.Size(2500, 390);
		expect(near).toBe(TARGET_BOX_MAX);
		expect(mid).toBeLessThan(near);
		expect(mid).toBeGreaterThan(far);
		expect(far).toBe(TARGET_BOX_MIN);
		expect(TargetBoxes.Size(0, 390)).toBe(TARGET_BOX_MAX);
	});
	it("keeps the selected box readable when far", () => {
		expect(TargetBoxes.Size(2500, 390, true)).toBe(TARGET_BOX_SELECTED_MIN);
		expect(TargetBoxes.Size(150, 390, true)).toBe(TARGET_BOX_MAX);
	});
});

describe("target box blink", () => {
	it("is a steady square wave of about 3.5 Hz", () => {
		let changes = 0;
		let last = TargetBoxes.BlinkOn(0);
		let on = 0;
		// Two seconds: seven whole cycles.
		for (let step = 1; step <= 2000; step++) {
			const value = TargetBoxes.BlinkOn(step / 1000);
			if (value !== last) changes += 1;
			if (value) on += 1;
			last = value;
		}
		// 3.5 cycles a second: fourteen edges in two seconds, on half the time.
		expect(changes).toBe(14);
		expect(on).toBeGreaterThan(980);
		expect(on).toBeLessThan(1020);
	});
});

describe("target box ranking", () => {
	it("keeps the nearest boxes up to the cap, leaving room for the selected one", () => {
		const contacts: RankedContact[] = [];
		for (let index = 0; index < 20; index++) contacts.push({ distance: 3000 - index * 100 });
		const count = TargetBoxes.Rank(contacts, TARGET_BOX_LIMIT, 1);
		expect(count).toBe(TARGET_BOX_LIMIT - 1);
		expect(contacts[0].distance).toBe(1100);
		expect(contacts[count - 1].distance).toBe(2100);
		for (let index = 1; index < contacts.size(); index++) expect(contacts[index].distance >= contacts[index - 1].distance).toBe(true);
	});
	it("returns every contact when under the cap", () => {
		const contacts: RankedContact[] = [{ distance: 5 }, { distance: 1 }];
		expect(TargetBoxes.Rank(contacts)).toBe(2);
		expect(contacts[0].distance).toBe(1);
		expect(TargetBoxes.Rank([])).toBe(0);
	});
});

describe("target box placement", () => {
	it("needs the whole box on screen", () => {
		expect(TargetBoxes.Fits(400, 200, 40, 844, 390, [])).toBe(true);
		expect(TargetBoxes.Fits(10, 200, 40, 844, 390, [])).toBe(false);
		expect(TargetBoxes.Fits(400, 380, 40, 844, 390, [])).toBe(false);
	});
	it("never draws over a touch control at any HUD scale", () => {
		for (const [width, height, scale] of [[844, 390, 1], [667, 375, 1], [568, 320, 1], [844, 390, 0.8], [1180, 820, 1.25]]) {
			const virtualWidth = math.floor(width / scale), virtualHeight = math.floor(height / scale);
			const hud = getHudLayout(virtualWidth, virtualHeight, "touch", { scale });
			const keepouts = TargetBoxes.Keepouts(hud, scale, 0, 0);
			const touch = hud.touch!;
			expect(keepouts.size()).toBe(hud.pause ? 7 : 6);
			// Centre of FIRE, in viewport px: a box there never fits.
			const fireX = (touch.missile.x + touch.missile.width / 2) * scale;
			const fireY = (touch.missile.y + touch.missile.height / 2) * scale;
			expect(TargetBoxes.Fits(fireX, fireY, TARGET_BOX_MIN, width, height, keepouts)).toBe(false);
			// The steering stick, likewise.
			const stickX = (touch.joystick.x + touch.joystick.width / 2) * scale;
			const stickY = (touch.joystick.y + touch.joystick.height / 2) * scale;
			expect(TargetBoxes.Fits(stickX, stickY, TARGET_BOX_MIN, width, height, keepouts)).toBe(false);
			// The open sky above the centre stays usable.
			expect(TargetBoxes.Fits(width / 2, height * 0.3, TARGET_BOX_MIN, width, height, keepouts)).toBe(true);
			// Every keep-out covers its control with padding.
			for (const control of [touch.missile, touch.target, touch.special, touch.evade, touch.joystick, touch.throttle]) {
				const scaled = { x: control.x * scale, y: control.y * scale, width: control.width * scale, height: control.height * scale };
				let covered = false;
				for (const keepout of keepouts) {
					if (keepout.x <= scaled.x && keepout.y <= scaled.y && keepout.x + keepout.width >= scaled.x + scaled.width && keepout.y + keepout.height >= scaled.y + scaled.height) covered = true;
				}
				expect(covered).toBe(true);
			}
		}
	});
	it("offsets keep-outs by the HUD root's origin and has none for keyboard play", () => {
		const hud = getHudLayout(800, 390, "touch");
		const shifted = TargetBoxes.Keepouts(hud, 1, 44, 0, 0);
		expect(shifted[0].x).toBe(hud.touch!.joystick.x + 44);
		expect(TargetBoxes.Keepouts(getHudLayout(1920, 854, "keyboard"), 1, 0, 0).size()).toBe(0);
	});
});
