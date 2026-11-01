import type { CombatSession } from "./CombatSession";

/** Live sorties by player. CombatService owns insertion and removal; telemetry reads it to ignore stale sessions. */
export const sessions = new Map<Player, CombatSession>();
