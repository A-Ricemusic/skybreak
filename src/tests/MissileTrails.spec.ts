import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import type { MissileTrails as MissileTrailsClass } from "../client/MissileTrails";
import { requireClientModule } from "./helpers/ClientModule";
import { PLAYER_MISSILE } from "../shared/JetFactory";

const { MissileTrails } = requireClientModule<{ MissileTrails: typeof MissileTrailsClass }>("MissileTrails");

const motors = (part: BasePart) =>
	part
		.GetChildren()
		.filter((child) => child.Name === "MotorFx")
		.size();
const plumeCount = (trails: MissileTrailsClass) => trails["plumes"].size();
const missile = (folder: Instance) => {
	const part = new Instance("Part");
	part.Name = PLAYER_MISSILE;
	part.Anchored = true;
	part.CanCollide = false;
	part.Parent = folder;
	return part;
};

describe("missile trail lifecycle", () => {
	it("keeps one motor effect per surviving missile across Start/Stop/Start", () => {
		const folder = new Instance("Folder");
		folder.Parent = Workspace;
		const first = missile(folder);
		const trails = new MissileTrails();
		trails.Start(folder);
		expect(motors(first)).toBe(1);
		const second = missile(folder);
		task.wait();
		expect(motors(second)).toBe(1);
		trails.Start(folder);
		expect(motors(first)).toBe(1);
		expect(motors(second)).toBe(1);
		trails.Stop();
		expect(motors(first)).toBe(0);
		expect(motors(second)).toBe(0);
		expect(plumeCount(trails)).toBe(0);
		trails.Start(folder);
		expect(motors(first)).toBe(1);
		expect(motors(second)).toBe(1);
		trails.Stop();
		expect(motors(first)).toBe(0);
		expect(motors(second)).toBe(0);
		folder.Destroy();
	});

	it("retires a removed missile's motor at once and lets its smoke fade", () => {
		const folder = new Instance("Folder");
		folder.Parent = Workspace;
		const part = missile(folder);
		const trails = new MissileTrails();
		trails.Start(folder);
		const plume = trails["plumes"].get(part);
		expect(plume).toBeDefined();
		if (!plume) return;
		trails.Step();
		part.Parent = undefined;
		trails.Step();
		expect(plumeCount(trails)).toBe(0);
		expect(motors(part)).toBe(0);
		expect(plume.puffs.Enabled).toBe(false);
		// Smoke carriers stay on Terrain for the Debris-managed fade.
		for (const carrier of [plume.a, plume.b, plume.c]) expect(carrier.Parent).toBe(Workspace.Terrain);
		trails.Stop();
		part.Destroy();
		folder.Destroy();
	});
});
