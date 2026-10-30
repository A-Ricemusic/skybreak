import { describe, expect, it } from "@rbxts/jest-globals";
import { LAUNCH_REQUEST_TIMEOUT, LaunchCancellation, LaunchLoading } from "../shared/LaunchLoading";

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
	it("watchdog restores briefing when neither the launch RPC nor Loading completes", () => {
		const launch = new LaunchLoading();
		const now = 100;
		launch.Begin(now);
		const generation = launch.Generation();
		// No RPC response and no Queued/Loading event. Drive the same timer entrypoint as GameUI.
		expect(launch.Watchdog(generation, now + LAUNCH_REQUEST_TIMEOUT - 1)).toBe(false);
		expect(launch.Pending()).toBe(true);
		expect(launch.Watchdog(generation, now + LAUNCH_REQUEST_TIMEOUT)).toBe(true);
		expect(launch.Pending()).toBe(false);
		expect(launch.Screen()).toBe("briefing");
		expect(launch.Current(generation)).toBe(false);
		expect(launch.Preload()).toBe(false);
		expect(launch.Started()).toBe(false);
		launch.Begin(now + LAUNCH_REQUEST_TIMEOUT + 1);
		// Late RPC/Loading/Started and the old timer cannot change the retry.
		expect(launch.Current(generation)).toBe(false);
		expect(launch.Watchdog(generation, now + LAUNCH_REQUEST_TIMEOUT * 3)).toBe(false);
		expect(launch.Screen()).toBe("loading");
		expect(launch.Pending()).toBe(true);
	});
	it("expires queued cleanup but leaves post-build replication to its existing watchdog", () => {
		const launch = new LaunchLoading(); launch.Begin(0); launch.Queued();
		expect(launch.Watchdog(launch.Generation(), LAUNCH_REQUEST_TIMEOUT)).toBe(true);
		expect(launch.Screen()).toBe("briefing");
		launch.Begin(1000); launch.Preload();
		expect(launch.Watchdog(launch.Generation(), 1000 + LAUNCH_REQUEST_TIMEOUT)).toBe(false);
		expect(launch.Phase()).toBe("preloading");
	});
	it("remembers server cancellation before a delayed RPC starts and cannot cancel a newer launch", () => {
		const cancellation = new LaunchCancellation();
		cancellation.Cancel(1);
		expect(cancellation.Cancelled(1)).toBe(true);
		expect(cancellation.Cancelled(2)).toBe(false);
		cancellation.Cancel(3); cancellation.Cancel(1);
		expect(cancellation.Cancelled(3)).toBe(true);
		expect(cancellation.Cancelled(4)).toBe(false);
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
