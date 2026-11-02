import { createBlueprintSession } from "../server/CombatSessionFactory";
import type { CombatSession } from "../server/CombatSession";
import type { MissionBlueprint } from "../shared/MissionCatalog";
import { FlightMath, FlightState } from "../shared/FlightMath";
import type { SpecialKind } from "../shared/SpecialWeapons";
import type { DifficultyKind } from "../shared/Difficulty";

export interface SessionFixtureOptions {
	/** Session folder; a detached Folder when absent. */
	folder?: Folder;
	/** Initial flight state; `FlightMath.NewState()` when absent. */
	state?: FlightState;
	special?: SpecialKind;
	difficulty?: DifficultyKind;
	startedAt?: number;
	/** Stub player identity (fixtures never send remotes). */
	userId?: number;
}

/**
 * A complete, production-shaped session for runtime specs, built by the same factory as a real launch so a new
 * `CombatSession` field cannot silently diverge from the fixtures. The player is a stub and the aircraft an empty
 * Model under the folder. Callers then override the fields a scenario needs (`blueprintState`, `enemies`,
 * `collisionParams`, ...) instead of hand-writing partial literals.
 */
export function sessionFixture(blueprint: MissionBlueprint, options: SessionFixtureOptions = {}): CombatSession {
	const folder = options.folder ?? new Instance("Folder");
	const aircraft = new Instance("Model"); aircraft.Name = "FixtureAircraft"; aircraft.Parent = folder;
	const player = { UserId: options.userId ?? 1 } as Player;
	return createBlueprintSession(player, 1, folder, aircraft, options.state ?? FlightMath.NewState(), blueprint,
		options.special ?? "salvo", options.difficulty ?? "normal", options.startedAt ?? 0);
}
