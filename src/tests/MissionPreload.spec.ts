import { describe, expect, it } from "@rbxts/jest-globals";
import { markCriticalGeometry } from "../shared/MissionReadiness";
import { Workspace } from "@rbxts/services";
import type { preloadMission as PreloadMission } from "../client/MissionPreload";
import { requireClientModule } from "./helpers/ClientModule";

const { preloadMission: enginePreloadMission } = requireClientModule<{ preloadMission: typeof PreloadMission }>(
	"MissionPreload",
);

function preloadMission(
	aircraft: unknown,
	expectedParts: number | undefined,
	alive: () => boolean,
	progress: (p: number) => void,
	timeout = 6,
	resolve?: () => unknown,
	preload?: (items: Instance[]) => void,
): boolean {
	return enginePreloadMission(aircraft, expectedParts, alive, progress, timeout, resolve, preload, 1, [
		{ origin: new Vector3(100000, 9000, 100000), distance: 16 },
	]);
}

function fixture() {
	const folder = new Instance("Folder");
	folder.Parent = Workspace;
	const aircraft = new Instance("Model");
	aircraft.Parent = folder;
	const root = new Instance("Part");
	root.Anchored = true;
	root.Parent = aircraft;
	aircraft.PrimaryPart = root;
	new Instance("Decal").Parent = root;
	markCriticalGeometry(folder, [root]);
	return { folder, aircraft, root };
}

describe("minimum playable mission preload", () => {
	it("waits for late aircraft reference, PrimaryPart and world replication", () => {
		const f = fixture();
		f.aircraft.PrimaryPart = undefined;
		let replicated: Model | undefined;
		task.delay(0.05, () => {
			replicated = f.aircraft;
		});
		task.delay(0.1, () => {
			f.aircraft.PrimaryPart = f.root;
		});
		task.delay(0.2, () => {
			new Instance("Part").Parent = f.folder;
		});
		let progress = 0;
		expect(
			preloadMission(
				undefined,
				2,
				() => true,
				(p) => {
					progress = p;
				},
				1,
				() => replicated,
				() => {},
			),
		).toBe(true);
		expect(progress).toBe(1);
		f.folder.Destroy();
	});
	it("never reports complete for missing aircraft, PrimaryPart or world parts", () => {
		const f = fixture();
		let progress = 0;
		const report = (p: number) => {
			progress = p;
		};
		expect(preloadMission(undefined, 1, () => true, report, 0.1)).toBe(false);
		f.aircraft.PrimaryPart = undefined;
		expect(preloadMission(f.aircraft, 1, () => true, report, 0.1)).toBe(false);
		f.aircraft.PrimaryPart = f.root;
		expect(preloadMission(f.aircraft, 2, () => true, report, 0.1)).toBe(false);
		f.root.SetAttribute("SkybreakLoadingCritical", undefined);
		expect(preloadMission(f.aircraft, 1, () => true, report, 0.1)).toBe(false);
		expect(progress < 1).toBe(true);
		f.folder.Destroy();
	});
	it("cancels while replication is incomplete and leaves replacement readiness untouched", () => {
		const f = fixture();
		let alive = true;
		let completed = false;
		task.delay(0.1, () => {
			alive = false;
		});
		expect(
			preloadMission(
				undefined,
				2,
				() => alive,
				(p) => {
					if (p === 1) completed = true;
				},
				1,
			),
		).toBe(false);
		expect(completed).toBe(false);
		expect(
			preloadMission(
				f.aircraft,
				1,
				() => true,
				() => {},
				1,
				undefined,
				() => {},
			),
		).toBe(true);
		expect(
			preloadMission(
				f.aircraft,
				undefined,
				() => true,
				() => {},
				0.1,
			),
		).toBe(false);
		f.folder.Destroy();
	});
	it("allows cosmetic failures and bounds stalled content without retaining its worker", () => {
		const f = fixture();
		expect(
			preloadMission(
				f.aircraft,
				1,
				() => true,
				() => {},
				0.2,
				undefined,
				() => error("content unavailable"),
			),
		).toBe(true);
		let resumed = false;
		expect(
			preloadMission(
				f.aircraft,
				1,
				() => true,
				() => {},
				0.1,
				undefined,
				() => {
					task.wait(0.4);
					resumed = true;
				},
			),
		).toBe(true);
		task.wait(0.5);
		expect(resumed).toBe(false);
		f.folder.Destroy();
	});
	it("cancels content and rechecks readiness after yielding and progress callbacks", () => {
		const f = fixture();
		let alive = true;
		task.delay(0.1, () => {
			alive = false;
		});
		expect(
			preloadMission(
				f.aircraft,
				1,
				() => alive,
				() => {},
				1,
				undefined,
				() => {
					task.wait(5);
				},
			),
		).toBe(false);
		expect(
			preloadMission(
				f.aircraft,
				1,
				() => true,
				(p) => {
					if (p === 1) f.aircraft.PrimaryPart = undefined;
				},
				1,
				undefined,
				() => {},
			),
		).toBe(false);
		f.folder.Destroy();
	});
});
