import type { MissionAllies } from "./MissionPolicy";

/** Pure allegiance, credit and fire policy shared by simulation and offline specs. */
export const AlliedRules = {
	/** Acquire a wingman only with a clear distance advantage; retain it until the player is closer. */
	HostileTargetsWingman(kind: string, role: string | undefined, playerDistance: number, wingmanDistance: number, retaining: boolean): boolean {
		if (kind === "ace" || role === "courier") return false;
		return wingmanDistance < playerDistance * (retaining ? 1 : 0.8);
	},
	/** The windup target is copied once; undefined deliberately means the player. */
	CommitWindupTarget<T>(target: T | undefined): T | undefined { return target; },
	WarnsPlayer(target: unknown): boolean { return target === undefined; },
	/** Friendlies and hostiles advance independent ordinals. */
	AirSerial(friendly: boolean, hostileSerial: number, alliedSerial: number): number { return friendly ? alliedSerial : hostileSerial; },
	PlayerTarget(candidate: { friendly?: boolean; enabled: boolean; health: number }): boolean {
		return candidate.friendly !== true && candidate.enabled && candidate.health > 0;
	},
	HostileBudget(candidates: { friendly?: boolean; enabled: boolean; health: number; kind: string; role?: string }[]): number {
		let count = 0;
		for (const candidate of candidates) if (AlliedRules.PlayerTarget(candidate) && candidate.kind !== "ground" && candidate.role !== "bomber") count++;
		return count;
	},
	Count(policy: MissionAllies | undefined): number { return policy?.count ?? 0; },
	CanEngage(policy: MissionAllies, candidate: { friendly?: boolean; required: boolean; role?: string; enabled: boolean; health: number }, weaponsEnabled = true): boolean {
		return weaponsEnabled && candidate.friendly !== true && candidate.enabled && candidate.health > 0
			&& (candidate.required ? policy.allowRequiredTargets === true : candidate.role === "escort" || candidate.role === "raider");
	},
	/** Formation catch-up remains active during launch even while weapon engagement is suppressed. */
	FormationSpeed(playerSpeed: number, stationDistance: number): number {
		return math.clamp(playerSpeed + (stationDistance - 80) * 0.4, 120, 650);
	},
	Credit(policy: MissionAllies): boolean { return policy.creditPlayerKills === true; },
	MayDestroy(policy: MissionAllies): boolean { return policy.mayKill !== false; },
	Range: 2200,
	Leash: 3600,
	Reload: 12,
	FlightSpacing: 3,
	MissilesPerWingman: 8,
	MaxInFlight: 2,
	Damage: 45,
};
