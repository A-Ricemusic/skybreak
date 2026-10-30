import { describe, expect, it } from "@rbxts/jest-globals";
import { LaunchLoading } from "../shared/LaunchLoading";

describe("launch loading screen lifetime", () => {
	it("covers construction immediately and holds the input lock through preload until Started", () => {
		const launch = new LaunchLoading();
		expect(launch.Begin()).toBe(true);
		expect(launch.Phase()).toBe("building");
		expect(launch.Screen()).toBe("loading");
		expect(launch.Pending()).toBe(true);
		expect(launch.Begin()).toBe(false);
		expect(launch.Started()).toBe(false);
		expect(launch.Preload()).toBe(true);
		expect(launch.Phase()).toBe("preloading");
		// RPC acceptance/return does not release the launch lock.
		expect(launch.Begin()).toBe(false);
		expect(launch.Preload()).toBe(false);
		expect(launch.Started()).toBe(true);
		expect(launch.Pending()).toBe(false);
		expect(launch.Screen()).toBe("mission");
	});
	it("restores briefing eligibility after refusal, build failure or timeout and ignores late readiness", () => {
		for (const phase of ["building", "queued", "preloading"]) {
			const launch = new LaunchLoading(); launch.Begin();
			if (phase === "queued") launch.Queued();
			if (phase === "preloading") launch.Preload();
			launch.Fail();
			expect(launch.Phase()).toBe("idle");
			expect(launch.Screen()).toBe("briefing");
			expect(launch.Pending()).toBe(false);
			expect(launch.Preload()).toBe(false);
			expect(launch.Started()).toBe(false);
			expect(launch.Begin()).toBe(true);
		}
	});
	it("queues on the same loading screen, then builds and preloads without allowing a second launch", () => {
		const launch = new LaunchLoading(); launch.Begin(); launch.Queued();
		expect(launch.Phase()).toBe("queued");
		expect(launch.Screen()).toBe("loading");
		expect(launch.Begin()).toBe(false);
		launch.Building(); expect(launch.Phase()).toBe("building");
		expect(launch.Preload()).toBe(true);
		launch.Queued(); launch.Building();
		expect(launch.Phase()).toBe("preloading");
		expect(launch.Started()).toBe(true);
	});
});
