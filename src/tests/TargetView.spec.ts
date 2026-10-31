import { describe, expect, it } from "@rbxts/jest-globals";
import { TargetPriority } from "../shared/TargetPriority";
import { TargetView } from "../server/TargetView";

// Server-side validation of the TGT payload: only a real CFrame with finite unit axes near the jet is used;
// everything else (missing table, wrong types, NaN, a camera far away) falls back to the jet's nose.
describe("TargetView.FromClient", () => {
	const jet = new Vector3(1000, 500, -2000);
	const nose = CFrame.lookAt(jet, jet.add(new Vector3(0, 0, -1)));
	const chase = CFrame.lookAt(jet.add(new Vector3(0, 12, 60)), jet.add(new Vector3(0, 0, -400)));
	const ahead = { x: jet.X, y: jet.Y, z: jet.Z - 1500 };
	const behind = { x: jet.X, y: jet.Y, z: jet.Z + 1500 };
	it("uses a plausible chase camera with its FOV and aspect", () => {
		const view = TargetView.FromClient({ cframe: chase, fov: 80, aspect: 2.2 }, jet, nose);
		expect(view.aspect).toBe(2.2);
		expect(view.tanHalfFov).toBeCloseTo(math.tan(math.rad(40)), 6);
		expect(view.position.z).toBeCloseTo(jet.Z + 60, 3);
		expect(TargetPriority.InView(view, ahead)).toBe(true);
		expect(TargetPriority.InView(view, behind)).toBe(false);
	});
	it("falls back to the nose view when the payload is missing or not a table", () => {
		for (const raw of [undefined, 5, "camera", true]) {
			const view = TargetView.FromClient(raw, jet, nose);
			expect(view.position).toEqual({ x: jet.X, y: jet.Y, z: jet.Z });
			expect(view.aspect).toBe(TargetPriority.AspectBounds.default);
			expect(view.tanHalfFov).toBeCloseTo(math.tan(math.rad(TargetPriority.FovBounds.default) / 2), 6);
		}
	});
	it("falls back when cframe is not a CFrame", () => {
		for (const cframe of [undefined, Vector3.zero, "CFrame.new()", { Position: jet }]) {
			const view = TargetView.FromClient({ cframe, fov: 70, aspect: 1.7 }, jet, nose);
			expect(view.position).toEqual({ x: jet.X, y: jet.Y, z: jet.Z });
			expect(view.aspect).toBe(TargetPriority.AspectBounds.default);
		}
	});
	it("falls back when the camera is far from the jet or its components are not finite", () => {
		const far = CFrame.lookAt(jet.add(new Vector3(0, 0, TargetPriority.MaxCameraOffset + 50)), jet);
		expect(TargetView.FromClient({ cframe: far, fov: 70, aspect: 1.7 }, jet, nose).position.z).toBe(jet.Z);
		const nan = new CFrame(0 / 0, 0, 0);
		expect(TargetView.FromClient({ cframe: nan, fov: 70, aspect: 1.7 }, jet, nose).position).toEqual({ x: jet.X, y: jet.Y, z: jet.Z });
	});
	it("clamps implausible FOV and aspect from a valid camera", () => {
		const view = TargetView.FromClient({ cframe: chase, fov: 1e9, aspect: -3 }, jet, nose);
		expect(view.tanHalfFov).toBeCloseTo(math.tan(math.rad(TargetPriority.FovBounds.max) / 2), 6);
		expect(view.aspect).toBe(TargetPriority.AspectBounds.min);
		expect(TargetView.FromClient({ cframe: chase, fov: "wide", aspect: 0 / 0 }, jet, nose).aspect).toBe(TargetPriority.AspectBounds.default);
	});
	it("still answers from the nose when the jet frame itself is unusable", () => {
		const broken = new CFrame(0 / 0, 0 / 0, 0 / 0);
		const view = TargetView.FromClient(undefined, new Vector3(0 / 0, 0, 0), broken);
		expect(view.look).toEqual({ x: 0, y: 0, z: -1 });
	});
});
