import { describe, expect, it } from "@rbxts/jest-globals";
import { DifficultyKind } from "../shared/Difficulty";
import { FlightMath } from "../shared/FlightMath";
import { MissileEvent, MissileRay, MissileRules, Point } from "../shared/MissileRules";

// Pure hostile-missile contracts; also run in the offline Luau VM (toBe/toBeUndefined only).
// Each engagement flies the real FlightMath jet against a MissileRules missile at the server's
// fixed step, launched exactly as CombatService launches one (collision course, 0.8 x gimbal).

const STEP = 1 / 30;

interface Engagement {
	level: DifficultyKind;
	act: number;
	/** Where the shooter is from the jet's nose (degrees, +right) and how far. */
	bearing: number;
	range: number;
	/** Full stick (-1 left, +1 right) once the missile is this close; undefined flies straight. */
	breakAt?: number;
	turn?: number;
	throttle?: number;
	ray?: MissileRay;
}
interface Outcome { event: MissileEvent; locked: boolean; age: number; speed: number; jetSpeed: number; at?: Point }

function velocity(state: { yaw: number; pitch: number; speed: number }): Point {
	const [x, y, z] = FlightMath.Forward(state.yaw, state.pitch);
	return { x: x * state.speed, y: y * state.speed, z: z * state.speed };
}
function fly(engagement: Engagement): Outcome {
	const throttle = engagement.throttle ?? 1;
	const jet = { x: 0, y: 400, z: 0, yaw: 0, pitch: 0, roll: 0, speed: FlightMath.MinSpeed + (FlightMath.MaxSpeed - FlightMath.MinSpeed) * throttle };
	const profile = MissileRules.Profile(engagement.level, engagement.act);
	const angle = math.rad(engagement.bearing);
	// The jet faces -Z; +X is its right wing.
	const from = { x: math.sin(angle) * engagement.range, y: 400, z: -math.cos(angle) * engagement.range };
	const aim = MissileRules.LeadDirection(from, profile.burnSpeed, { position: { x: jet.x, y: jet.y, z: jet.z }, velocity: velocity(jet) }, profile.gimbal * 0.8);
	const missile = MissileRules.Launch(from, aim, profile);
	const input = { x: 0, y: 0, throttle };
	for (let step = 0; step < 15 * 30; step++) {
		const dx = missile.position.x - jet.x, dy = missile.position.y - jet.y, dz = missile.position.z - jet.z;
		if (engagement.breakAt !== undefined && math.sqrt(dx * dx + dy * dy + dz * dz) <= engagement.breakAt) input.x = engagement.turn ?? -1;
		FlightMath.Step(jet, input, STEP);
		const result = MissileRules.Step(missile, profile, { position: { x: jet.x, y: jet.y, z: jet.z }, velocity: velocity(jet) }, STEP, engagement.ray);
		if (result.event !== "flying") return { event: result.event, locked: missile.locked, age: missile.age, speed: missile.speed, jetSpeed: jet.speed, at: result.at };
	}
	return { event: "flying", locked: missile.locked, age: missile.age, speed: missile.speed, jetSpeed: jet.speed };
}

describe("Hostile missile guidance", () => {
	it("hits a jet that ignores it, from any aspect and on every level", () => {
		for (const level of ["easy", "normal", "ace"] as DifficultyKind[]) {
			// Cruise throttle: the jet neither turns nor runs.
			expect(fly({ level, act: 2, bearing: 0, range: 1500, throttle: 0.65 }).event).toBe("hit");
			expect(fly({ level, act: 2, bearing: 90, range: 1000, throttle: 0.65 }).event).toBe("hit");
			expect(fly({ level, act: 2, bearing: 135, range: 900, throttle: 0.65 }).event).toBe("hit");
			expect(fly({ level, act: 2, bearing: 180, range: 800, throttle: 0.65 }).event).toBe("hit");
		}
	});
	it("misses a hard break turn at 500 studs on Normal: the jet slips out of the seeker cone", () => {
		const tail = fly({ level: "normal", act: 2, bearing: 180, range: 800, breakAt: 500, turn: -1 });
		expect(tail.event).toBe("expired");
		expect(tail.locked).toBe(false);
		const quarter = fly({ level: "normal", act: 2, bearing: 135, range: 900, breakAt: 500, turn: -1, throttle: 0.65 });
		expect(quarter.event === "hit").toBe(false);
	});
	it("still hits a break left far too late on Normal", () => {
		expect(fly({ level: "normal", act: 2, bearing: 0, range: 1500, breakAt: 250, turn: -1 }).event).toBe("hit");
	});
	it("can be outrun after the burn: a long tail shot coasts below the jet's speed and gives up", () => {
		const run = fly({ level: "normal", act: 2, bearing: 180, range: 1400 });
		expect(run.event).toBe("expired");
		expect(run.locked).toBe(false);
		const profile = MissileRules.Profile("normal", 2);
		expect(run.age > profile.burnSeconds).toBe(true);
		// Easy burns out sooner: even a 1000-stud tail shot is outrun at full throttle.
		expect(fly({ level: "easy", act: 1, bearing: 180, range: 1000 }).event).toBe("expired");
		// The same shot at cruise is not outrun on Normal.
		expect(fly({ level: "normal", act: 2, bearing: 180, range: 800, throttle: 0.65 }).event).toBe("hit");
	});
	it("drops the lock forever once the jet is outside the seeker cone, flies straight and self-destructs", () => {
		const profile = MissileRules.Profile("normal", 2);
		// Fired 60 degrees off the line to a jet sitting still at the origin.
		const missile = MissileRules.Launch({ x: 0, y: 0, z: 1000 }, { x: math.sin(math.rad(60)), y: 0, z: -math.cos(math.rad(60)) }, profile);
		const jet = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
		expect(MissileRules.OffBoresight(missile, jet.position) > profile.gimbal).toBe(true);
		const heading = { ...missile.direction };
		let event: MissileEvent = "flying";
		for (let step = 0; step < 12 * 30 && event === "flying"; step++) event = MissileRules.Step(missile, profile, jet, STEP).event;
		expect(missile.locked).toBe(false);
		expect(event).toBe("expired");
		expect(math.abs(missile.direction.x - heading.x) < 1e-9 && math.abs(missile.direction.z - heading.z) < 1e-9).toBe(true);
	});
	it("detonates harmlessly on a ridge between it and the jet", () => {
		// A ridge across the whole sky at z = -700, between a head-on shooter at 1500 and the jet.
		const ridge: MissileRay = (from, to) => {
			if ((from.z + 700) * (to.z + 700) > 0) return undefined;
			const t = (-700 - from.z) / (to.z - from.z);
			return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: -700 };
		};
		const blocked = fly({ level: "ace", act: 3, bearing: 0, range: 1500, throttle: 0.65, ray: ridge });
		expect(blocked.event).toBe("terrain");
		expect(blocked.at!.z).toBe(-700);
		// Open sky (a ray that never hits) changes nothing.
		expect(fly({ level: "ace", act: 3, bearing: 0, range: 1500, throttle: 0.65, ray: () => undefined }).event).toBe("hit");
	});
	it("fuses on a close pass and lets a near miss go", () => {
		const profile = MissileRules.Profile("normal", 2);
		expect(profile.fuse).toBe(22);
		for (const [offset, expected] of [[15, "hit"], [30, "flying"]] as [number, MissileEvent][]) {
			// Unlocked, flying straight down -Z past a parked jet `offset` studs to the side; one big step crosses it.
			const missile = MissileRules.Launch({ x: offset, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, profile);
			missile.locked = false;
			const result = MissileRules.Step(missile, profile, { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }, 1);
			expect(result.event).toBe(expected);
		}
	});
	it("puts a hit before a ridge behind the jet, and the ridge before a jet behind it", () => {
		const profile = MissileRules.Profile("normal", 2);
		const wallAt = (z: number): MissileRay => (from, to) => ((from.z - z) * (to.z - z) > 0 ? undefined : { x: from.x, y: from.y, z });
		const shot = () => MissileRules.Launch({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, profile);
		const parked = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
		expect(MissileRules.Step(shot(), profile, parked, 1, wallAt(-100)).event).toBe("hit");
		expect(MissileRules.Step(shot(), profile, parked, 1, wallAt(100)).event).toBe("terrain");
	});
});

describe("Hostile missile profiles", () => {
	it("scales by act (Act I gentlest) and difficulty (Easy lazy and short, Ace sharp and long)", () => {
		const act1 = MissileRules.Profile("normal", 1), act3 = MissileRules.Profile("normal", 3);
		expect(act1.turnCap < act3.turnCap).toBe(true);
		expect(act1.burnSeconds < act3.burnSeconds).toBe(true);
		expect(act1.fuse).toBe(18);
		expect(act3.fuse).toBe(26);
		const easy = MissileRules.Profile("easy", 2), normal = MissileRules.Profile("normal", 2), ace = MissileRules.Profile("ace", 2);
		expect(easy.turnCap < normal.turnCap && normal.turnCap < ace.turnCap).toBe(true);
		expect(easy.burnSeconds < normal.burnSeconds && normal.burnSeconds < ace.burnSeconds).toBe(true);
		expect(normal.gimbal).toBe(math.rad(45));
		// A missile from the mission's ace turns a little harder and sees a little wider.
		const pilot = MissileRules.Profile("normal", 2, true);
		expect(pilot.turnCap > normal.turnCap && pilot.gimbal > normal.gimbal).toBe(true);
	});
	it("never out-accelerates a full-throttle jet sideways on Normal", () => {
		const jet = FlightMath.MaxSpeed * 1.12;
		for (const act of [1, 2, 3]) {
			const profile = MissileRules.Profile("normal", act, true);
			expect(profile.burnSpeed * profile.turnCap < jet).toBe(true);
			expect(profile.burnSpeed > FlightMath.MaxSpeed).toBe(true);
		}
	});
	it("burns at full speed, then coasts down", () => {
		const profile = MissileRules.Profile("normal", 2);
		expect(MissileRules.SpeedAt(profile, 0)).toBe(profile.burnSpeed);
		expect(MissileRules.SpeedAt(profile, profile.burnSeconds)).toBe(profile.burnSpeed);
		expect(MissileRules.SpeedAt(profile, profile.burnSeconds + 2) < FlightMath.MaxSpeed).toBe(true);
		// Unknown act or level falls back to Act I / Normal instead of failing.
		expect(MissileRules.Profile("bogus" as DifficultyKind, 0 / 0).fuse).toBe(18);
	});
});

describe("Hostile missile readout", () => {
	it("gives the bearing from the jet's nose (+right, 180 on the tail) for any heading", () => {
		const jet = { x: 0, y: 0, z: 0 };
		expect(math.abs(MissileRules.Bearing(jet, 0, { x: 0, y: 0, z: -500 })) < 1e-6).toBe(true);
		expect(math.abs(MissileRules.Bearing(jet, 0, { x: 500, y: 0, z: 0 }) - 90) < 1e-6).toBe(true);
		expect(math.abs(MissileRules.Bearing(jet, 0, { x: -500, y: 0, z: 0 }) + 90) < 1e-6).toBe(true);
		expect(math.abs(math.abs(MissileRules.Bearing(jet, 0, { x: 0, y: 0, z: 500 })) - 180) < 1e-6).toBe(true);
		// Heading west (yaw +90 degrees: nose toward -X): a missile to the north (-Z) is on the right wing.
		expect(math.abs(MissileRules.Bearing(jet, math.rad(90), { x: 0, y: 0, z: -500 }) - 90) < 1e-6).toBe(true);
	});
	it("estimates time to impact from the closing speed and reports none while opening", () => {
		const profile = MissileRules.Profile("normal", 2);
		const missile = MissileRules.Launch({ x: 0, y: 0, z: -1200 }, { x: 0, y: 0, z: 1 }, profile);
		const headOn = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -300 } };
		expect(math.abs(MissileRules.TimeToImpact(missile, headOn)! - 1200 / (profile.burnSpeed + 300)) < 1e-6).toBe(true);
		const away = MissileRules.Launch({ x: 0, y: 0, z: -1200 }, { x: 0, y: 0, z: -1 }, profile);
		expect(MissileRules.TimeToImpact(away, headOn)).toBeUndefined();
	});
	it("launches on a collision course, inside the lead limit, or straight at the jet with no intercept", () => {
		const target = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 300, y: 0, z: 0 } };
		const lead = MissileRules.LeadDirection({ x: 0, y: 0, z: 1000 }, 600, target, math.rad(40));
		// sin(lead) = 300 / 600: 30 degrees toward the jet's travel.
		expect(math.abs(lead.x - 0.5) < 1e-6).toBe(true);
		const capped = MissileRules.LeadDirection({ x: 0, y: 0, z: 1000 }, 600, target, math.rad(20));
		expect(math.abs(capped.x - math.sin(math.rad(20))) < 1e-6).toBe(true);
		// Slower than a jet running straight away: no intercept, aim straight at it.
		const direct = MissileRules.LeadDirection({ x: 0, y: 0, z: 1000 }, 200, { position: target.position, velocity: { x: 0, y: 0, z: -300 } }, math.rad(40));
		expect(math.abs(direct.z + 1) < 1e-6).toBe(true);
	});
});
