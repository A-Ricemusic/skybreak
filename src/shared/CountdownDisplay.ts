import { MissionBlueprint, MissionCatalog } from "./MissionCatalog";
import { FlightMath } from "./FlightMath";

type CountdownSource = number | MissionBlueprint | undefined;

/** Pure HUD countdown defaults and validation, kept mission-authored rather than globally capped. */
export const CountdownDisplay = {
	Limit(source: CountdownSource): number {
		if (typeIs(source, "table")) {
			let limit=MissionCatalog.CountdownSeconds(source);
			for (const p of MissionCatalog.ExpandedPhases(source)) limit=math.max(limit,p.update?.countdownSeconds ?? 0);
			return limit;
		}
		return CountdownDisplay.Limit(MissionCatalog.Get(MissionCatalog.IsValidId(source) ? source : 1));
	},
	Value(source: CountdownSource, value: unknown, previous?: number): number {
		const limit = CountdownDisplay.Limit(source);
		const fallback = FlightMath.IsFinite(previous) ? previous : limit;
		return math.clamp(FlightMath.IsFinite(value) ? value : fallback, 0, limit);
	},
};
