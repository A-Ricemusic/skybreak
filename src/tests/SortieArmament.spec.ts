import { describe, expect, it } from "@rbxts/jest-globals";
import { GunCandidate, GunRules, MISSILE_REGEN_SECONDS, SortieArmament, validateArmament } from "../shared/SortieArmament";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { WeaponRules } from "../shared/WeaponRules";
import { TelemetryCodec, TelemetryNumbers } from "../shared/TelemetryCodec";
import { Telemetry } from "../shared/Types";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { RearmPlan, validateBatchC } from "../shared/EngineBatchC";
import { armamentStatusLine, statusLine } from "../shared/HudInstruments";
import { getHudLayout, hudObstacles, MIN_TOUCH_TARGET, rectangleInside, rectanglesOverlap, STICK_MAX_SIZE, STICK_MIN_SIZE, JOYSTICK_SIZE, type Rectangle } from "../shared/UILayout";

function rejects(fn: () => void): boolean { const [ok] = pcall(fn); return !ok; }
const rearm: RearmPlan = { zone: { x: 0, y: 145.7786702793, z: 2400 }, radius: 200, landing: { touchdown: { x: 0, y: 20, z: 0 }, headingDegrees: 0, approachDistance: 2400, rolloutDistance: 400, approachSeconds: 30, rolloutSeconds: 10, glideDegrees: 3 }, takeoffSeconds: 10, missiles: true, special: true, health: false };
function strike(armament?: MissionBlueprint["armament"], plan: RearmPlan = rearm): MissionBlueprint {
	return { ...MissionCatalog.Get(1), armament, ground: [], phases: [{ kind: "score_threshold", label: "Strike", scoreThreshold: { points: 2000, seconds: 600, waitForExpiry: true }, rearm: plan }] };
}
const ahead = (z: number, x = 0, ground = false, allowed = true): GunCandidate => ({ position: { x, y: 100, z: -z }, ground, allowed });
const ORIGIN = { x: 0, y: 100, z: 0 }, NOSE = { x: 0, y: 0, z: -1 };

describe("Engine batch D1: opt-in sortie armament", () => {
	it("keeps missions other than missions 6, 7, 9, 10, 11, 12, 13, 14 and 15 on today's rack: no armament, no gun", () => {
		for (let id = 0; id <= 18; id++) {
			if (id === 6 || id === 7 || id === 9 || id === 10 || id === 11 || id === 12 || id === 13 || id === 14 || id === 15) continue;
			const blueprint = MissionCatalog.Get(id);
			expect(blueprint.armament).toBeUndefined();
			expect(GunRules.New(blueprint.armament)).toBeUndefined();
			expect(SortieArmament.MissileCapacity(blueprint.armament)).toBe(WeaponRules.MaxMissiles);
			expect(SortieArmament.Regenerates(blueprint.armament)).toBe(true);
		}
	});
	it("reproduces the default rack exactly: +1 missile per 2.5 s up to eight, and the special's own charges and recharge", () => {
		let missiles = 3, regen = 0, oldMissiles = 3, oldRegen = 0;
		for (const dt of [1 / 30, 0.5, 2.4, 0.1, 1 / 30, 3, 2.5, 7, 1 / 30]) {
			[missiles, regen] = SortieArmament.RackTick(missiles, regen, dt, undefined);
			oldRegen += dt;
			if (oldRegen >= 2.5) { oldRegen -= 2.5; oldMissiles = math.min(WeaponRules.MaxMissiles, oldMissiles + 1); }
			expect(missiles).toBe(oldMissiles); expect(regen).toBeCloseTo(oldRegen, 6);
		}
		expect(MISSILE_REGEN_SECONDS).toBe(2.5);
		for (const kind of SpecialWeapons.Order) expect(SortieArmament.NewSpecial(kind, undefined)).toEqual(SpecialWeapons.New(kind));
		expect(SortieArmament.Refill({ missiles: true, special: true }, undefined, "flares")).toEqual({ missiles: 8, special: SpecialWeapons.New("flares") });
		expect(SortieArmament.Refill({ missiles: false, special: false }, undefined, "flares")).toEqual({});
		expect(SortieArmament.Refund(8, undefined)).toBe(8); expect(SortieArmament.Refund(5, undefined)).toBe(6);
		expect(SortieArmament.EmptyNotice(undefined)).toBe("no_ammo");
	});
	it("never regenerates a finite stock, refunds up to it and rearms it back", () => {
		const armament = { stock: { missiles: 40, specialCharges: 2 } };
		expect(SortieArmament.MissileCapacity(armament)).toBe(40);
		expect(SortieArmament.RackTick(12, 1, 30, armament)).toEqual([12, 0]);
		expect(SortieArmament.Refund(40, armament)).toBe(40); expect(SortieArmament.Refund(12, armament)).toBe(13);
		expect(SortieArmament.EmptyNotice(armament)).toBe("missiles_spent");
		const flares = SortieArmament.NewSpecial("flares", armament);
		expect(flares.charges).toBe(2); expect(flares.finite).toBe(true); expect(flares.capacity).toBe(2);
		flares.charges = 0; SpecialWeapons.Tick(flares, 60); expect(flares.charges).toBe(0);
		const open = SpecialWeapons.New("flares"); open.charges = 0; SpecialWeapons.Tick(open, 15); expect(open.charges).toBe(1);
		expect(SortieArmament.NewSpecial("lance", { stock: { missiles: 10 } }).charges).toBe(SpecialWeapons.Get("lance").charges);
		const refill = SortieArmament.Refill({ missiles: true, special: true }, armament, "flares");
		expect(refill.missiles).toBe(40); expect(refill.special!.charges).toBe(2); expect(refill.gunRounds).toBeUndefined();
	});
	it("refills the gun with the missiles unless the rearm says otherwise", () => {
		const armament = { gun: { rounds: 600 }, stock: { missiles: 30 } };
		expect(SortieArmament.Refill({ missiles: true, special: false }, armament, "uav").gunRounds).toBe(600);
		expect(SortieArmament.Refill({ missiles: false, special: false }, armament, "uav").gunRounds).toBeUndefined();
		expect(SortieArmament.Refill({ missiles: false, special: false, gun: true }, armament, "uav").gunRounds).toBe(600);
		expect(SortieArmament.Refill({ missiles: true, special: false, gun: false }, armament, "uav").gunRounds).toBeUndefined();
	});
	it("validates armament data and its rearm link", () => {
		expect(rejects(() => validateArmament(undefined, false))).toBe(false);
		expect(rejects(() => validateArmament({ gun: { rounds: 600 } }, true))).toBe(false);
		expect(rejects(() => validateArmament({ stock: { missiles: 48, specialCharges: 0 } }, false))).toBe(false);
		for (const bad of [{}, { gun: { rounds: 0 } }, { gun: { rounds: 2001 } }, { gun: { rounds: 1.5 } }, { gun: { rounds: 0 / 0 } }, { stock: { missiles: 0 } }, { stock: { missiles: 121 } }, { stock: { missiles: 8, specialCharges: -1 } }, { stock: { missiles: 8, specialCharges: 17 } }])
			expect(rejects(() => validateArmament(bad as never, false))).toBe(true);
		expect(rejects(() => validateArmament(undefined, true))).toBe(true);
		expect(rejects(() => validateArmament({ stock: { missiles: 8 } }, true))).toBe(true);
		expect(rejects(() => MissionCatalog.ValidatePolicy(strike({ gun: { rounds: 600 }, stock: { missiles: 48 } }, { ...rearm, gun: true })))).toBe(false);
		expect(rejects(() => MissionCatalog.ValidatePolicy(strike(undefined, { ...rearm, gun: true })))).toBe(true);
		expect(rejects(() => MissionCatalog.ValidatePolicy(strike({ stock: { missiles: 0 } })))).toBe(true);
		expect(rejects(() => validateBatchC([{ kind: "score_threshold", label: "Strike", scoreThreshold: { points: 1, seconds: 60, waitForExpiry: true }, rearm: { ...rearm, gun: "yes" as never } }], 15000))).toBe(true);
	});
	it("holds the trigger at ten rounds a second and releases it when the magazine runs dry", () => {
		const gun = GunRules.New({ gun: { rounds: 12 } })!;
		expect(gun.rounds).toBe(12); expect(gun.held).toBe(false);
		expect(GunRules.Step(gun, 1)).toBe(0);
		expect(GunRules.Start(gun)).toBeUndefined();
		expect(GunRules.Step(gun, 1 / 30)).toBe(1);
		let fired = 1;
		for (let step = 0; step < 29; step++) fired += GunRules.Step(gun, 1 / 30);
		expect(fired).toBe(10); expect(gun.rounds).toBe(2);
		GunRules.Stop(gun); expect(GunRules.Step(gun, 1)).toBe(0);
		GunRules.Start(gun); GunRules.Start(gun);
		expect(GunRules.Step(gun, 1)).toBe(2); expect(gun.rounds).toBe(0); expect(gun.held).toBe(false); expect(gun.fired).toBe(12);
		expect(GunRules.Start(gun)).toBe("gun_empty"); expect(gun.held).toBe(false);
		GunRules.Refill(gun, 9999); expect(gun.rounds).toBe(12);
		expect(GunRules.Step(gun, 0 / 0)).toBe(0);
	});
	it("never beats the held rate by cycling the trigger (shot cooldown survives releases)", () => {
		const dt = 1 / 30, steps = 300;
		const held = GunRules.New({ gun: { rounds: 2000 } })!;
		GunRules.Start(held);
		let heldShots = 0;
		for (let step = 0; step < steps; step++) heldShots += GunRules.Step(held, dt);
		expect(heldShots).toBeGreaterThanOrEqual(100); expect(heldShots).toBeLessThanOrEqual(101);
		// Press every 90 ms, release 45 ms later (the reviewer's reproduction), re-sending Start while held.
		const cycling = GunRules.New({ gun: { rounds: 2000 } })!;
		let cycledShots = 0;
		for (let step = 0; step < steps; step++) {
			const phase = (step * dt) % 0.09;
			if (phase < 0.045) GunRules.Start(cycling); else GunRules.Stop(cycling);
			cycledShots += GunRules.Step(cycling, dt);
		}
		expect(cycledShots).toBeLessThanOrEqual(heldShots);
		// Worst case: press, release and press again inside every step.
		const spam = GunRules.New({ gun: { rounds: 2000 } })!;
		let spamShots = 0;
		for (let step = 0; step < steps; step++) { GunRules.Start(spam); GunRules.Stop(spam); GunRules.Start(spam); spamShots += GunRules.Step(spam, dt); }
		expect(spamShots).toBeLessThanOrEqual(heldShots);
		// A release does not bank credit: after a long pause the next press fires one round, not a burst.
		GunRules.Stop(spam); expect(GunRules.Step(spam, 5)).toBe(0); expect(spam.cooldown).toBe(0);
		GunRules.Start(spam); expect(GunRules.Step(spam, dt)).toBe(1);
		GunRules.Stop(spam); GunRules.Start(spam); expect(GunRules.Step(spam, dt)).toBe(0);
	});
	it("blocks a round on any cover before the aim point, near or far, but never on the target itself", () => {
		expect(GunRules.Occluded(undefined, false, 500)).toBe(false);
		expect(GunRules.Occluded(490, false, 500)).toBe(true); // cover 10 studs in front of the target
		expect(GunRules.Occluded(50, false, 500)).toBe(true); // a ridge near the muzzle
		expect(GunRules.Occluded(495, true, 500)).toBe(false); // the target's own parts
		expect(GunRules.Occluded(500 - GunRules.CoverEpsilon + 0.5, false, 500)).toBe(false); // at the aim point
		expect(GunRules.Occluded(500 - GunRules.CoverEpsilon - 0.5, false, 500)).toBe(true);
	});
	it("resolves each round to the nearest allowed target inside the cone and range", () => {
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(500), ahead(300)])).toBe(1);
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(300, 0, false, false), ahead(500)])).toBe(1);
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(-100)])).toBeUndefined();
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(GunRules.Range + 1)])).toBeUndefined();
		const edge = GunRules.Tolerance(false, 500);
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(500, edge - 0.5)])).toBe(0);
		expect(GunRules.Resolve(ORIGIN, NOSE, [ahead(500, edge + 0.5)])).toBeUndefined();
		expect(GunRules.Tolerance(true, 0)).toBeLessThan(GunRules.Tolerance(false, 0));
		expect(GunRules.Resolve(ORIGIN, { x: 0, y: 0, z: 0 }, [ahead(300)])).toBeUndefined();
		expect(GunRules.Resolve(ORIGIN, { x: 0, y: 0, z: -5 }, [ahead(300)])).toBe(0);
		expect(GunRules.Resolve(ORIGIN, NOSE, [{ position: { x: 0 / 0, y: 100, z: -300 }, ground: false, allowed: true }])).toBeUndefined();
	});
	it("rate-limits impact effects without skipping damage", () => {
		const gun = GunRules.New({ gun: { rounds: 10 } })!;
		expect(GunRules.TakeEffect(gun, 1)).toBe(true); expect(GunRules.TakeEffect(gun, 1.05)).toBe(false); expect(GunRules.TakeEffect(gun, 1.2)).toBe(true);
	});
	it("adds gun rounds to the telemetry tail without changing legacy packet lengths", () => {
		const numbers: TelemetryNumbers = { health: 100, speed: 160, altitude: 850, kills: 0, total: 0, missiles: 10, missileCooldown: 0, evadeCooldown: 0, lockProgress: 0, incoming: false, lockWarning: false, boundaryWarning: false, elapsed: 100, timeRemaining: 900, objectiveProgress: 0, objectiveTotal: 1, groundKills: 0, targetDistance: 0 };
		const into = {} as Telemetry;
		expect(TelemetryCodec.Encode(1, numbers).size()).toBe(29);
		expect(TelemetryCodec.Encode(1, { ...numbers, missionPoints: 5 }).size()).toBe(33);
		const packet = TelemetryCodec.Encode(2, { ...numbers, gunRounds: 412 });
		expect(packet.size()).toBe(34);
		TelemetryCodec.Decode(packet, into);
		expect(into.gunRounds).toBe(412); expect(into.missionPoints).toBeUndefined(); expect(into.jamVisualRange).toBeUndefined(); expect(into.terrainClearance).toBeUndefined();
		TelemetryCodec.Decode(TelemetryCodec.Encode(3, { ...numbers, gunRounds: 0, missionPoints: 1200 }), into);
		expect(into.gunRounds).toBe(0); expect(into.missionPoints).toBe(1200);
		TelemetryCodec.Decode(TelemetryCodec.Encode(4, numbers), into);
		expect(into.gunRounds).toBeUndefined();
	});
	it("leads the ammo line with GUN only when a gun is fitted", () => {
		const status = { missiles: 8, missileCooldown: 0, special: "FLR", specialCharges: 3, specialCooldown: 0, specialActive: 0, evadeCharges: 3 };
		expect(armamentStatusLine(status)).toEqual({ cells: statusLine(status), fit: false });
		expect(armamentStatusLine({ ...status, missiles: 40 }).fit).toBe(true);
		const gun = armamentStatusLine(status, 600);
		expect(gun.cells.size()).toBe(4); expect(gun.cells[0].text).toBe("GUN 600"); expect(gun.cells[0].tone).toBe("normal"); expect(gun.fit).toBe(true);
		expect(armamentStatusLine(status, 0).cells[0].tone).toBe("danger");
		expect(WeaponRules.IsActionKind("GunStart")).toBe(true); expect(WeaponRules.IsActionKind("GunStop")).toBe(true);
		expect(WeaponRules.IsFireNotice("gun_empty")).toBe(true); expect(WeaponRules.IsFireNotice("missiles_spent")).toBe(true);
	});
	it("lays out the touch GUN button only when fitted, clear of every control and on screen", () => {
		const roots: [number, number][] = [[560, 240], [706, 267], [750, 332], [844, 390], [390, 705], [1280, 720], [320, 182], [319, 161], [568, 320], [320, 568], [390, 844], [667, 375], [800, 390], [1024, 768], [1920, 1080]];
		for (const [width, height] of roots) {
			const plain = getHudLayout(width, height, "touch");
			expect(plain.touch!.gun).toBeUndefined();
			expect(getHudLayout(width, height, "keyboard", { gun: true }).touch).toBeUndefined();
			for (const stickSize of [STICK_MIN_SIZE, JOYSTICK_SIZE, STICK_MAX_SIZE]) {
				const layout = getHudLayout(width, height, "touch", { stickSize, gun: true });
				const gun = layout.touch!.gun;
				// Real phone roots (landscape and portrait) always get a GUN button.
				if (height >= 240) expect(gun).toBeDefined();
				const rectangles: Rectangle[] = hudObstacles(layout);
				for (let a = 0; a < rectangles.size(); a++) for (let b = a + 1; b < rectangles.size(); b++) expect(rectanglesOverlap(rectangles[a], rectangles[b])).toBe(false);
				for (const rectangle of rectangles) expect(rectangleInside(rectangle, width, height, layout.margin)).toBe(true);
				if (gun) { expect(gun.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET); expect(gun.height).toBe(gun.width); }
			}
		}
	});
});
