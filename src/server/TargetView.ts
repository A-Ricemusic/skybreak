// The client's view as sent with a TGT press, turned into the pure frustum the press order uses.
// Server-authoritative: the payload only says where the camera looks; which contacts exist, their
// distances and ownership stay the server's. A malformed or implausible view falls back to the nose.
import { TargetPriority, type Point, type ViewFrustum } from "../shared/TargetPriority";

function point(vector: Vector3): Point { return { x: vector.X, y: vector.Y, z: vector.Z }; }
function frustumOf(frame: CFrame, fov: unknown, aspect: unknown, jet?: Point): ViewFrustum | undefined {
	return TargetPriority.Frustum(point(frame.Position), point(frame.LookVector), point(frame.RightVector), point(frame.UpVector), fov, aspect, jet);
}
/** Last resort when even the jet's own frame is unusable: a canonical view from the jet along -Z. */
function canonical(jet: Vector3): ViewFrustum {
	const origin = point(jet);
	const safe = { x: origin.x === origin.x ? origin.x : 0, y: origin.y === origin.y ? origin.y : 0, z: origin.z === origin.z ? origin.z : 0 };
	return TargetPriority.Frustum(safe, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, undefined, undefined)!;
}

export const TargetView = {
	/**
	 * The frustum for a TGT press. `raw` is the client's `{ cframe, fov, aspect }`: the CFrame must be a
	 * real CFrame with finite unit axes within MaxCameraOffset studs of the server's jet, FOV and aspect
	 * are clamped (see TargetPriority.Frustum). Anything else uses the jet's nose with the defaults.
	 */
	FromClient(raw: unknown, jet: Vector3, nose: CFrame): ViewFrustum {
		const anchor = point(jet);
		if (typeIs(raw, "table")) {
			const view = raw as { cframe?: unknown; fov?: unknown; aspect?: unknown };
			if (typeIs(view.cframe, "CFrame")) {
				const frustum = frustumOf(view.cframe, view.fov, view.aspect, anchor);
				if (frustum !== undefined) return frustum;
			}
		}
		return frustumOf(nose, undefined, undefined, anchor) ?? canonical(jet);
	},
};
