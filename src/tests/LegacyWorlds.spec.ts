import { describe, expect, it } from "@rbxts/jest-globals";
import {
	BOAT_HULL, IRON_COAST_BOATS, IRON_COAST_FALLBACK_HULL, IRON_COAST_FRIGATE, LEGACY_WATERLINE, ironCoastBerthOps, ironCoastMainlandOps, legacySeaOps,
} from "../shared/LegacyWorlds";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { KEEL_MIN } from "../shared/WorldAudit";
import { terrainTop } from "../shared/WorldPlan";

// The hand-composed M2 harbour's hulls against the terrain the server writes
// (TerrainSea, the mainland blocks and the frigate's berth), in the same order.
// Pure; also run in the offline Luau VM.
const ops = [...legacySeaOps(), ...ironCoastMainlandOps(), ...ironCoastBerthOps()];

function afloat(x: number, z: number, keel: number): string {
	const t = terrainTop(ops, x, z);
	if (t.water !== LEGACY_WATERLINE) return `(${math.floor(x)}, ${math.floor(z)}) not on open water (terrain ${t.solid})`;
	if (t.solid > keel - KEEL_MIN) return `(${math.floor(x)}, ${math.floor(z)}) keel ${keel} within ${KEEL_MIN} of the seabed at ${t.solid}`;
	return "afloat";
}

describe("M2 Iron Coast hulls", () => {
	it("moors the uploaded frigate over a berth deeper than its keel", () => {
		const f = IRON_COAST_FRIGATE, spec = UploadedAssetSpecs.Frigate;
		const keel = LEGACY_WATERLINE - spec.groundOffset;
		expect(keel).toBe(-32);
		const c = math.cos(f.yaw), s = math.sin(f.yaw);
		for (const lx of [-spec.size.X / 2, 0, spec.size.X / 2]) for (const lz of [-spec.size.Z / 2, -spec.size.Z / 4, 0, spec.size.Z / 4, spec.size.Z / 2]) {
			expect(afloat(f.x + c * lx + s * lz, f.z - s * lx + c * lz, keel)).toBe("afloat");
		}
		// Without the berth the legacy seabed (top at -24) cuts 8 studs into the hull.
		const shallow = terrainTop([...legacySeaOps(), ...ironCoastMainlandOps()], f.x, f.z);
		expect(shallow.solid > keel).toBe(true);
	});
	it("floats every moored boat, and the frigate's stand-in hull, above the seabed", () => {
		const keel = LEGACY_WATERLINE + BOAT_HULL.lift - BOAT_HULL.height / 2;
		for (const [x, z, yaw, length] of [...IRON_COAST_BOATS, IRON_COAST_FALLBACK_HULL]) {
			const c = math.cos(yaw), s = math.sin(yaw), hx = length * 0.16, hz = length / 2;
			for (const [lx, lz] of [[0, 0], [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) expect(afloat(x + c * lx + s * lz, z - s * lx + c * lz, keel)).toBe("afloat");
		}
	});
});
