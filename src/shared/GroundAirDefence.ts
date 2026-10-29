import type { DifficultyKind } from "./Difficulty";
export const GroundAirDefence = {
	Range: 1500, Cap: 2, Windup: 1.2, Reload: 5, Damage: 4, HitChance: 0.35,
	Scale(difficulty: DifficultyKind): number { return difficulty === "easy" ? 0.65 : difficulty === "ace" ? 1.25 : 1; },
	Eligible(alive: boolean, active: boolean, distance: number): boolean { return alive && active && distance >= 80 && distance <= 1500; },
	Admit(active: number): boolean { return active < 2; },
	Hit(roll: number, difficulty: DifficultyKind, evading: boolean): boolean { return !evading && roll >= 0 && roll < 0.35 * GroundAirDefence.Scale(difficulty); },
};
