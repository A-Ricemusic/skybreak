import type { MissionAllies } from "./MissionPolicy";

/** Pure allegiance, credit and fire policy shared by simulation and offline specs. */
export const AlliedRules = {
	PlayerTarget(candidate: { friendly?: boolean; enabled: boolean; health: number }): boolean {
		return candidate.friendly !== true && candidate.enabled && candidate.health > 0;
	},
	HostileBudget(candidates: { friendly?: boolean; enabled: boolean; health: number; kind: string; role?: string }[]): number {
		let count = 0;
		for (const candidate of candidates) if (AlliedRules.PlayerTarget(candidate) && candidate.kind !== "ground" && candidate.role !== "bomber") count++;
		return count;
	},
	Count(policy: MissionAllies | undefined): number { return policy?.count ?? 0; },
	CanEngage(policy: MissionAllies, candidate: { friendly?: boolean; required: boolean; role?: string; enabled: boolean; health: number }): boolean {
		return candidate.friendly !== true && candidate.enabled && candidate.health > 0
			&& (candidate.required ? policy.allowRequiredTargets === true : candidate.role === "escort" || candidate.role === "raider");
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
