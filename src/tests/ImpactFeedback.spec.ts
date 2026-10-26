import { describe, expect, it } from "@rbxts/jest-globals";
import { ImpactFeedback, KillSnapshot } from "../shared/ImpactFeedback";

// Pure presentation rules; also run by the offline Luau runner (toBe/toBeUndefined only).
const snap = (kills: number, groundKills = 0, aceKilled = false): KillSnapshot => ({ kills, groundKills, aceKilled });

describe("kill callouts", () => {
	it("counts air kills as SPLASH ONE, TWO, THREE … then digits", () => {
		expect(ImpactFeedback.SplashText(1)).toBe("SPLASH ONE");
		expect(ImpactFeedback.SplashText(2)).toBe("SPLASH TWO");
		expect(ImpactFeedback.SplashText(3)).toBe("SPLASH THREE");
		expect(ImpactFeedback.SplashText(20)).toBe("SPLASH TWENTY");
		expect(ImpactFeedback.SplashText(21)).toBe("SPLASH 21");
		expect(ImpactFeedback.SplashText(0)).toBe("SPLASH ONE");
	});
	it("sequences air kills from the sortie's air count, skipping ground kills", () => {
		let previous = snap(0);
		const texts: string[] = [];
		for (const current of [snap(1), snap(2), snap(3, 1), snap(4, 1)]) {
			const kill = ImpactFeedback.DetectKill(previous, current);
			texts.push(kill ? kill.text : "-");
			previous = current;
		}
		expect(texts[0]).toBe("SPLASH ONE");
		expect(texts[1]).toBe("SPLASH TWO");
		expect(texts[2]).toBe("TARGET DESTROYED");
		expect(texts[3]).toBe("SPLASH THREE");
	});
	it("names ground kills and reports their count", () => {
		const kill = ImpactFeedback.DetectKill(snap(2, 1), snap(3, 2));
		expect(kill?.kind).toBe("ground");
		expect(kill?.count).toBe(2);
	});
	it("calls ACE DOWN once, when the ace flag first appears with a kill", () => {
		const ace = ImpactFeedback.DetectKill(snap(3), snap(4, 0, true));
		expect(ace?.kind).toBe("ace");
		expect(ace?.text).toBe("ACE DOWN");
		// Later kills in the same sortie are ordinary splashes.
		expect(ImpactFeedback.DetectKill(snap(4, 0, true), snap(5, 0, true))?.text).toBe("SPLASH FIVE");
	});
	it("ignores unchanged and reset counters (new sortie)", () => {
		expect(ImpactFeedback.DetectKill(snap(3), snap(3))).toBeUndefined();
		expect(ImpactFeedback.DetectKill(snap(5, 2, true), snap(0))).toBeUndefined();
	});
	it("still calls a kill when a dropped packet merged two", () => {
		expect(ImpactFeedback.DetectKill(snap(1), snap(3))?.text).toBe("SPLASH THREE");
	});
});

describe("camera shake", () => {
	it("clamps trauma to 0..1 and decays it to rest within a second", () => {
		expect(ImpactFeedback.AddTrauma(0.8, 0.6)).toBe(1);
		expect(ImpactFeedback.AddTrauma(0.2, -1)).toBe(0.2);
		let trauma = 1;
		for (let frame = 0; frame < 60; frame++) trauma = ImpactFeedback.DecayTrauma(trauma, 1 / 60);
		expect(trauma).toBe(0);
		expect(ImpactFeedback.DecayTrauma(0.5, 0.1) < 0.5).toBe(true);
	});
	it("keeps light hits subtle and heavy hits firmer, never full", () => {
		expect(ImpactFeedback.DamageTrauma(0)).toBe(0);
		expect(ImpactFeedback.DamageTrauma(-5)).toBe(0);
		const light = ImpactFeedback.DamageTrauma(10), heavy = ImpactFeedback.DamageTrauma(ImpactFeedback.HeavyHit);
		expect(light > 0 && light < 0.35).toBe(true);
		expect(heavy > light + 0.15).toBe(true);
		expect(ImpactFeedback.DamageTrauma(100) <= 0.65).toBe(true);
		// Intensity is trauma squared: a light hit moves the view under a tenth of the maximum.
		expect(ImpactFeedback.Intensity(light) < 0.1).toBe(true);
	});
	it("falls off with distance and grows with explosion scale", () => {
		const near = ImpactFeedback.ExplosionTrauma(50), mid = ImpactFeedback.ExplosionTrauma(300), far = ImpactFeedback.ExplosionTrauma(2000);
		expect(near > mid).toBe(true);
		expect(mid > 0).toBe(true);
		expect(far).toBe(0);
		expect(ImpactFeedback.ExplosionTrauma(300, 2) > mid).toBe(true);
		expect(ImpactFeedback.ExplosionTrauma(0, 0)).toBe(0);
		expect(ImpactFeedback.ExplosionTrauma(0, 10) <= 0.7).toBe(true);
	});
	it("stays still at rest and bounded at full trauma", () => {
		const rest = ImpactFeedback.Offset(0, 1.234);
		expect(rest.pitch === 0 && rest.yaw === 0 && rest.roll === 0 && rest.x === 0 && rest.y === 0).toBe(true);
		for (let t = 0; t < 2; t += 0.037) {
			const o = ImpactFeedback.Offset(1, t);
			expect(math.abs(o.pitch) <= math.rad(2.4) + 1e-9 && math.abs(o.yaw) <= math.rad(2.4) + 1e-9).toBe(true);
			expect(math.abs(o.roll) <= math.rad(3) + 1e-9 && math.abs(o.x) <= 1.1 + 1e-9 && math.abs(o.y) <= 1.1 + 1e-9).toBe(true);
		}
	});
});

describe("ace hit-stop", () => {
	it("nearly freezes the follow for the hold, then eases back to normal", () => {
		expect(ImpactFeedback.HitStop(0.05).follow < 0.1).toBe(true);
		const releasing = ImpactFeedback.HitStop(ImpactFeedback.HitStopSeconds + 0.09).follow;
		expect(releasing > 0.1 && releasing < 1).toBe(true);
		expect(ImpactFeedback.HitStop(1).follow).toBe(1);
		expect(ImpactFeedback.HitStop(-1).follow).toBe(1);
	});
	it("punches the FOV in and recovers within half a second", () => {
		expect(ImpactFeedback.HitStop(0).fov < -5).toBe(true);
		expect(ImpactFeedback.HitStop(0.5).fov).toBe(0);
		expect(ImpactFeedback.HitStopActive(0.1)).toBe(true);
		expect(ImpactFeedback.HitStopActive(0.6)).toBe(false);
		expect(ImpactFeedback.HitStopActive(-1)).toBe(false);
	});
	it("lasts a short dramatic beat", () => {
		expect(ImpactFeedback.HitStopSeconds >= 0.12 && ImpactFeedback.HitStopSeconds <= 0.2).toBe(true);
	});
});
