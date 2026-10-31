import type { DifficultyKind } from "./Difficulty";
import type { MissionAllies, MissionPressure } from "./MissionPolicy";

/** Pure allegiance, credit and fire policy shared by simulation and offline specs. */
export const AlliedRules = {
	/** Stable staggered slots: 80% player focus without random per-frame target flicker.
	 * Nearby/tailing players and incoming player fire override the ally slot. */
	PrioritisesPlayer(policy: MissionPressure | undefined, serial: number, elapsed: number, distance: number, tailDot: number, threatened: boolean): boolean {
		if (!policy) return false;
		return distance < 700 || AlliedRules.TailThreat(distance, tailDot) || threatened
			|| ((serial + math.floor(elapsed / 8)) % 5) / 5 < policy.playerPriority;
	},
	ApproachDegrees(policy: MissionPressure | undefined, role: string, behind: boolean, roll: number): number {
		return behind ? 150 + roll * 20 : policy && role === "raider" ? 10 + roll * (policy.forwardConeDegrees - 10) : 60 + roll * 15;
	},
	TailThreat(distance: number, tailDot: number, graceRemaining = 0): boolean {
		return graceRemaining <= 0 && distance < 1500 && tailDot < -0.6;
	},
	PressureFlare(policy: MissionPressure | undefined, friendly: boolean, role: string, difficulty: DifficultyKind): boolean {
		return !friendly && policy?.tailDefence === true && difficulty !== "easy" && (role === "raider" || role === "escort");
	},
	ForcePressureBreak(policy: MissionPressure | undefined, difficulty: DifficultyKind, tailing: boolean, threatened: boolean): boolean {
		return policy?.tailDefence === true && (tailing || difficulty !== "easy" && threatened);
	},
	/** Acquire a wingman only with a clear distance advantage; retain it until the player is closer. */
	HostileTargetsWingman(kind: string, role: string | undefined, playerDistance: number, wingmanDistance: number, retaining: boolean): boolean {
		if (kind === "ace" || role === "courier") return false;
		return wingmanDistance < playerDistance * (retaining ? 1 : 0.8);
	},
	/** The windup target is copied once; undefined deliberately means the player. */
	CommitWindupTarget<T>(target: T | undefined): T | undefined { return target; },
	WarnsPlayer(target: unknown, attackSector?: string): boolean { return target === undefined && attackSector === undefined; },
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
			&& !candidate.required && (candidate.role === "escort" || candidate.role === "raider");
	},
	/** Formation catch-up remains active during launch even while weapon engagement is suppressed. */
	FormationSpeed(playerSpeed: number, stationDistance: number): number {
		return math.clamp(playerSpeed + (stationDistance - 80) * 0.4, 120, 650);
	},
	Credit(policy: MissionAllies): boolean { return policy.creditPlayerKills === true; },
	MayDestroy(policy: MissionAllies): boolean { return policy.mayKill !== false; },
	BudgetRemaining(policy: MissionAllies, kills: number): boolean {
		return kills < (policy.killBudget ?? 1);
	},
	/** Rechecked at impact so missiles already in flight cannot spend a second kill. */
	ShotDamage(policy: MissionAllies, kills: number, required: boolean, damage: number): number {
		return !required && AlliedRules.BudgetRemaining(policy, kills) ? damage : 0;
	},
	Range: 1600,
	Leash: 3600,
	Reload: 20,
	FlightSpacing: 8,
	MissilesPerWingman: 8,
	MaxInFlight: 1,
	Damage: 30,
	HitChance: 0.35,
};
