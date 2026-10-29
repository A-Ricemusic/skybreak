import { MissionBlueprint, MissionCatalog } from "./MissionCatalog";
import { FlightMath } from "./FlightMath";

type CountdownSource = number | MissionBlueprint | undefined;

const limits = new Map<number, number>();

/** Pure HUD countdown defaults and validation, kept mission-authored rather than globally capped. */
export const CountdownDisplay = {
	Limit(source: CountdownSource): number {
		if (typeIs(source, "table")) {
			let limit=MissionCatalog.CountdownSeconds(source);
			for (const p of MissionCatalog.ExpandedPhases(source)) limit=math.max(limit,p.update?.countdownSeconds ?? 0);
			return limit;
		}
		const id = MissionCatalog.IsValidId(source) ? source : 1;
		const cached = limits.get(id);
		if (cached !== undefined) return cached;
		const limit = CountdownDisplay.Limit(MissionCatalog.Get(id));
		limits.set(id, limit);
		return limit;
	},
	Value(source: CountdownSource, value: unknown, previous?: number): number {
		const limit = CountdownDisplay.Limit(source);
		const fallback = FlightMath.IsFinite(previous) ? previous : limit;
		return math.clamp(FlightMath.IsFinite(value) ? value : fallback, 0, limit);
	},
};
