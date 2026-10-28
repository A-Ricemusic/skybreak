import type { AC04Run } from "../../AC04Runner";
import type { FlightPoint } from "../../WorldTypes";
import { LateMegalithSpec } from "./LateMegalith";

/**
 * Runtime adapters for M13-M18, composed by CombatService. Each helper is a small, separately reviewable behaviour
 * with the exact call site listed in docs/reviews/ac04-late-rebuild.json.
 */

/**
 * M14 wave 2: Wiki/Shotgunnova say the ten-missile group splits into two groups
 * of five (south-west and south-east) once attacked. Returns the lateral lane
 * a wave-2 missile should steer toward. Without it the runtime keeps each
 * missile on its spawn lane (two adjacent columns), which never diverge.
 */
export function lateM14WaveTwoLaneX(index: number, stationX: number, attacked: boolean): number {
	if (!attacked) return stationX;
	const lane = index < 5 ? -1 : 1;
	return math.clamp(stationX + lane * 1100, -1800, 1800);
}
/**
 * M14 final missile: Shotgunnova says it stays along the eastern edge of the
 * glacier with large weaving turns; the wiki advises firing at the peak of its
 * vertical movement. Lateral weave centred on the glacier's black margin plus a
 * vertical bob; amplitudes and periods are adaptations.
 */
export function lateM14FinalMissileOffset(secondsSinceSpawn: number): { x: number; dy: number } {
	return { x: 1450 + math.sin(secondsSinceSpawn * 0.9) * 450, dy: math.sin(secondsSinceSpawn * 1.7) * 90 };
}

/** Formation-preserving waypoint for groups that share one authored path (M15 Tu-160, M14 XB-70). */
export function lateFormationWaypoint(waypoint: FlightPoint, station: FlightPoint, leadStation: FlightPoint): FlightPoint {
	return { x: waypoint.x + station.x - leadStation.x, y: waypoint.y + station.y - leadStation.y, z: waypoint.z + station.z - leadStation.z };
}

/** M13: the hidden ship is unlockable and off radar in the source (Mitoro); extend ac04Jammed with this. */
export function lateLockDenied(missionId: number, groupId: string): boolean {
	return missionId === 13 && (groupId === "balloons" || groupId === "frigate");
}

/**
 * M18: opens the closed silo hatch when the core dies (source: the ceiling
 * opens after the main missile is destroyed). Only meaningful when
 * LATE_MEGALITH_HATCH_WIRED is true in LateWorldBuild.
 */
export function lateOpenMegalithHatch(folder: Instance, run: AC04Run): boolean {
	if (run.mission.id !== 18 || (run.groupKills.get("core") ?? 0) !== 1 || !run.dead.has("core_1")) return false;
	const hatch = folder.FindFirstChild(LateMegalithSpec.hatchName, true);
	if (!hatch || !hatch.IsA("BasePart")) return false;
	hatch.SetAttribute("FlightSolid", false);
	hatch.CanQuery = false; hatch.CanCollide = false; hatch.Transparency = 1;
	return true;
}

/** The central entry remains closed until all authoritative generator kills. */
export function lateOpenMegalithGate(folder: Instance, run: AC04Run): boolean {
	if (run.mission.id !== 18 || run.phaseIndex < 1 || !["generator-west", "generator-east", "generator-north"].every((id) => run.dead.has(`${id}_1`))) return false;
	const gate = folder.FindFirstChild("AC04CoreGate", true);
	if (!gate || !gate.IsA("BasePart")) return false;
	gate.SetAttribute("FlightSolid", false);
	gate.CanQuery = false; gate.CanCollide = false; gate.Transparency = 1;
	return true;
}

/** Existing defended-line tolerance, shared with the authoritative missile step. */
export function lateMissilePastDefense(z: number, returnZ: number): boolean { return z >= returnZ - 30; }
