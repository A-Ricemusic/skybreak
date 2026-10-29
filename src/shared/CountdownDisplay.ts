import { MissionBlueprint, MissionCatalog } from "./MissionCatalog";
import { FlightMath } from "./FlightMath";

type CountdownSource = number | MissionBlueprint | undefined;

/** Pure HUD countdown defaults and validation, kept mission-authored rather than globally capped. */
export const CountdownDisplay = {
	Limit(source: CountdownSource): number {
		if (typeIs(source, "table")) return MissionCatalog.CountdownSeconds(source);
		return MissionCatalog.CountdownSeconds(MissionCatalog.IsValidId(source) ? source : 1);
	},
	Value(source: CountdownSource, value: unknown, previous?: number): number {
		const limit = CountdownDisplay.Limit(source);
		const fallback = FlightMath.IsFinite(previous) ? previous : limit;
		return math.clamp(FlightMath.IsFinite(value) ? value : fallback, 0, limit);
	},
};
