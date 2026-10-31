import type { FighterArrival, StandaloneAce } from "../shared/CampaignEncounters";
import type { AirRequest } from "../shared/WavePlan";
import { MissionBlueprint } from "../shared/MissionCatalog";

/** Mission-wide compatibility flag: phase order must not change Mission 2's fixed waves. */
export function fixedRaiders(blueprint: MissionBlueprint | undefined): boolean {
	return blueprint?.phases.some((phase) => phase.execution?.fixedRaiders === true) ?? false;
}

/** Authored arrivals use their exact count, without the legacy extra-raider wave rule. */
export function authoredAirRequest(arrival: FighterArrival | StandaloneAce): AirRequest {
 return { arrival, role: "name" in arrival ? "ace" : arrival.role,
  count: "name" in arrival ? 1 : arrival.count, behind: false, call: arrival.call };
}
