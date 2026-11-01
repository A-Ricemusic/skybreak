import { M01_ENVIRONMENT, M01_WORLD_KEY } from "./M01WorldPlan";
import { M02_ENVIRONMENT, M02_WORLD_KEY } from "./M02WorldPlan";
import { M03_ENVIRONMENT, M03_WORLD_KEY } from "./M03WorldPlan";
import { M04_ENVIRONMENT, M04_WORLD_KEY } from "./M04WorldPlan";
import { M05_ENVIRONMENT, M05_WORLD_KEY } from "./M05WorldPlan";
import { M06_ENVIRONMENT, M06_WORLD_KEY } from "./M06WorldPlan";
import { M07_ENVIRONMENT, M07_WORLD_KEY } from "./M07WorldPlan";
import { M08_ENVIRONMENT, M08_WORLD_KEY } from "./M08WorldPlan";
import { M09_ENVIRONMENT, M09_WORLD_KEY } from "./M09WorldPlan";
import { M10_ENVIRONMENT, M10_WORLD_KEY } from "./M10WorldPlan";
import { M11_ENVIRONMENT, M11_WORLD_KEY } from "./M11WorldPlan";
import { M12_ENVIRONMENT, M12_WORLD_KEY } from "./M12WorldPlan";
import { M13_ENVIRONMENT, M13_WORLD_KEY } from "./M13WorldPlan";
import { M14_ENVIRONMENT, M14_WORLD_KEY } from "./M14WorldPlan";
import { M15_ENVIRONMENT, M15_WORLD_KEY } from "./M15WorldPlan";
import { M16_ENVIRONMENT, M16_WORLD_KEY } from "./M16WorldPlan";
import { M17_ENVIRONMENT, M17_WORLD_KEY } from "./M17WorldPlan";
import { M18_ENVIRONMENT, M18_WORLD_KEY } from "./M18WorldPlan";
import { ENVIRONMENTS, type EnvironmentSpec } from "./EnvironmentPresets";
import type { EnvironmentPreset } from "./MissionCatalog";

/** Environment per campaign world key, as published by the mission world builders to Lighting.
 * Keep this table aligned with server registrations (checked by the offline gate).
 */
export const WORLD_ENVIRONMENTS = new Map<string, EnvironmentSpec>([
 [M01_WORLD_KEY, M01_ENVIRONMENT],
 [M02_WORLD_KEY, M02_ENVIRONMENT],
 [M03_WORLD_KEY, M03_ENVIRONMENT],
 [M04_WORLD_KEY, M04_ENVIRONMENT],
 [M05_WORLD_KEY, M05_ENVIRONMENT],
 [M06_WORLD_KEY, M06_ENVIRONMENT],
 [M07_WORLD_KEY, M07_ENVIRONMENT],
 [M08_WORLD_KEY, M08_ENVIRONMENT],
 [M09_WORLD_KEY, M09_ENVIRONMENT],
 [M10_WORLD_KEY, M10_ENVIRONMENT],
 [M11_WORLD_KEY, M11_ENVIRONMENT],
 [M12_WORLD_KEY, M12_ENVIRONMENT],
 [M13_WORLD_KEY, M13_ENVIRONMENT],
 [M14_WORLD_KEY, M14_ENVIRONMENT],
 [M15_WORLD_KEY, M15_ENVIRONMENT],
 [M16_WORLD_KEY, M16_ENVIRONMENT],
 [M17_WORLD_KEY, M17_ENVIRONMENT],
 [M18_WORLD_KEY, M18_ENVIRONMENT],
 ]);
/** Lighting can be unset, stale or supplied by another scene; unknown names have no weather. */
export function resolveEnvironment(key: string | undefined): EnvironmentSpec | undefined {
 return key === undefined ? undefined : WORLD_ENVIRONMENTS.get(key) ?? ENVIRONMENTS[key as EnvironmentPreset];
}
