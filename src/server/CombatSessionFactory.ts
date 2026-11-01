import type { CombatSession } from "./CombatSession";
import { TargetScore } from "../shared/TargetScore";
import { MissionCatalog, type MissionBlueprint } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { fixedRaiders } from "./PhaseDirectorRules";
import { FlightMath, FlightState } from "../shared/FlightMath";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { GunRules, SortieArmament } from "../shared/SortieArmament";
import { SpecialKind } from "../shared/SpecialWeapons";
import { EvadeRules } from "../shared/EvadeRules";
import { PauseRules, Settlement, StepGuard } from "../shared/SessionGuard";

export const SessionInputBurst = 10;

/** Complete sortie defaults shared by production launches and combat-step fixtures. No world building or remotes. */
export function createCombatSession(player: Player, slot: number, folder: Folder, aircraft: Model,
 state: FlightState, missionId: number, specialKind: SpecialKind, difficultyKind: DifficultyKind,
 startedAt: number, launchId?: number): CombatSession {
 return createBlueprintSession(player, slot, folder, aircraft, state, MissionCatalog.Get(missionId), specialKind, difficultyKind, startedAt, launchId);
}

/** The same defaults for an explicit blueprint (specs with synthetic missions). Scoring and airspace policies come from the blueprint. */
export function createBlueprintSession(player: Player, slot: number, folder: Folder, aircraft: Model,
 state: FlightState, blueprint: MissionBlueprint, specialKind: SpecialKind, difficultyKind: DifficultyKind,
 startedAt: number, launchId?: number): CombatSession {
 const session: CombatSession = {
	launchId,
	targetScore: new TargetScore(MissionCatalog.Scoring(blueprint)),
	player, slot, folder, aircraft, state, missionId: blueprint.id, airspace: MissionCatalog.Airspace(blueprint), lastWindupAt: -math.huge, radioSerial: 0, chatterIndex: 0,
	input: { x: 0, y: 0, throttle: FlightMath.CruiseThrottle }, health: 100, kills: 0, elapsed: 0,
	// Absent armament: eight regenerating missiles, the special's own charges and no gun (unchanged).
	missiles: SortieArmament.MissileCapacity(blueprint.armament), missileCooldown: 0, evadeRemaining: 0, regen: 0, lockProgress: 0,
	special: SortieArmament.NewSpecial(specialKind, blueprint.armament), gun: GunRules.New(blueprint.armament),
	difficulty: difficultyKind,
	allies: [], alliedKills: [], alliedFireAt: -math.huge, enemies: [], projectiles: [], telemetryTime: 0, lastInput: os.clock(), lastInputEvent: -math.huge,
	active: true, finished: false, cleaned: false, previousReplicationFocus: player.ReplicationFocus,
	inputClientTime: 0, inputFresh: false, inputSteps: 0, inputTokens: SessionInputBurst, inputTokensAt: os.clock(), stateTime: 0, stateSequence: 0, telemetrySequence: 0,
	missilesFired: 0, missileHits: 0, flareBursts: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
	evade: EvadeRules.New(), guard: StepGuard.New(), pause: PauseRules.New(), pauseAck: 0, settlement: Settlement.New(),
	banditSerial: 0, raiderSerial: 0, spawnSerial: 0, allySerial: 0, reinforceIndex: 0, airQueue: [], stepCount: 0,
};
 session.blueprint = blueprint;
 session.blueprintState = BlueprintRunner.NewState(blueprint, startedAt, fixedRaiders(blueprint) ? 0 : Difficulty.Behaviour(difficultyKind).extraRaiders);
 return session;
}
