import { getMission, MissionPhaseKind } from "./MissionCatalog";

type DeployablePhaseKind = Exclude<MissionPhaseKind, "tutorial">;

/**
 * Pure deployment instructions consumed by CombatService when a phase becomes
 * active. Keeping this mapping separate from Instance creation lets the full
 * catalog routing contract be regression-tested without substituting a second
 * test-only implementation.
 */
export interface CombatPhasePlan {
	kind: DeployablePhaseKind;
	groundCount: number;
	activateAllGround: boolean;
	requiredAir: number;
	optionalAir: number;
	aceCount: number;
	aceHealth?: number;
	phaseIndex?: number;
}

function plan(kind: CombatPhasePlan["kind"]): CombatPhasePlan {
	return {
		kind,
		groundCount: 0,
		activateAllGround: false,
		requiredAir: 0,
		optionalAir: 0,
		aceCount: 0,
	};
}

function parseGenericPhase(phase: string): LuaTuple<[DeployablePhaseKind | undefined, number]> {
	const underscore = phase.find("_")[0];
	if (underscore === undefined) return $tuple(undefined, -1);
	const kind = phase.sub(1, underscore - 1);
	const index = tonumber(phase.sub(underscore + 1));
	if (index === undefined || index % 1 !== 0) return $tuple(undefined, -1);
	if (kind !== "air" && kind !== "ground" && kind !== "ace" && kind !== "nav" && kind !== "hold") return $tuple(undefined, -1);
	return $tuple(kind, index);
}

/** Returns whether this phase may perform its deployment side effects. */
export function shouldApplyCombatPhase(appliedPhase: string | undefined, phase: string, hasOutcome: boolean): boolean {
	return !hasOutcome && appliedPhase !== phase;
}

/**
 * Routes both preserved legacy phases and Mission 3-27 catalog phases to the
 * concrete spawn/activation operations that CombatService performs.
 */
export function getCombatPhasePlan(missionId: number, phase: string): CombatPhasePlan | undefined {
	if (phase === "tutorial_target") {
		const result = plan("ground");
		result.activateAllGround = true;
		return result;
	}
	if (phase === "tutorial_bandits" || phase === "intercept") {
		const result = plan("air");
		result.requiredAir = 3;
		return result;
	}
	if (phase === "warehouses") {
		const result = plan("ground");
		result.activateAllGround = true;
		result.optionalAir = 5;
		return result;
	}
	if (phase === "ace" && missionId === 2) {
		const result = plan("ace");
		result.aceCount = 1;
		return result;
	}
	if (missionId < 3) return undefined;

	const [kind, phaseIndex] = parseGenericPhase(phase);
	if (kind === undefined || phaseIndex < 0) return undefined;
	const phaseDef = getMission(missionId).phases[phaseIndex];
	// Refuse stale or malformed phase strings instead of deploying the wrong wave.
	if (phaseDef === undefined || phaseDef.kind !== kind) return undefined;

	const result = plan(kind);
	result.phaseIndex = phaseIndex;
	if (kind === "ground") {
		result.groundCount = phaseDef.required;
		result.optionalAir = phaseDef.optional ?? 0;
	} else if (kind === "air") {
		result.requiredAir = phaseDef.required;
		result.optionalAir = phaseDef.optional ?? 0;
	} else if (kind === "ace") {
		result.aceCount = 1;
		result.aceHealth = phaseDef.health;
	} else if (kind === "hold") {
		result.optionalAir = phaseDef.optional ?? 0;
	}
	return result;
}
