import type { MissionAirspacePolicy } from "./MissionPolicy";

/** Compatibility defaults for missions without an airspace policy. */
export const WorldAirspace = { soft: 3600, hard: 3800, spawnLimit: 3500, radarRange: 4400 };

/** Reliable start handoff: old/malformed packets safely retain the legacy world. */
export function resolveAirspace(value?: MissionAirspacePolicy): MissionAirspacePolicy {
	if (value !== undefined && typeIs(value, "table")) {
		const { softHalfWidth: soft, hardHalfWidth: hard, spawnLimit: spawn, radarRange: radar } = value;
		const positive = (n: number) => typeIs(n, "number") && n > 0 && n < math.huge;
		if (positive(soft) && positive(hard) && positive(spawn) && positive(radar) && hard >= soft && spawn <= hard) return value;
	}
	return { softHalfWidth: WorldAirspace.soft, hardHalfWidth: WorldAirspace.hard, spawnLimit: WorldAirspace.spawnLimit, radarRange: WorldAirspace.radarRange };
}

export function airspaceWarning(x: number, z: number, limits: MissionAirspacePolicy, margin = 0): boolean {
	return math.max(math.abs(x), math.abs(z)) > limits.softHalfWidth - margin;
}

export function clampAirSpawn(value: number, limits: MissionAirspacePolicy): number {
	return math.clamp(value, -limits.spawnLimit, limits.spawnLimit);
}
