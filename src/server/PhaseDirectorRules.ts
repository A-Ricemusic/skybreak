import { MissionBlueprint } from "../shared/MissionCatalog";

/** Mission-wide compatibility flag: phase order must not change Mission 2's fixed waves. */
export function fixedRaiders(blueprint: MissionBlueprint | undefined): boolean {
	return blueprint?.phases.some((phase) => phase.execution?.fixedRaiders === true) ?? false;
}
