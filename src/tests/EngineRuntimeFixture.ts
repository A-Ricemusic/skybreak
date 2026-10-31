import type { MissionBlueprint } from "../shared/MissionCatalog";

/** Fresh, campaign-independent data. Callers author the feature under test explicitly. */
export function engineRuntimeFixture(): MissionBlueprint {
 return {
  id: 9001, act: 1, codename: "ENGINE FIXTURE", title: "Engine fixture",
  region: "canyon_airfield", environment: "canyon_noon", worldKey: "engine_runtime_fixture",
  // Spacious synthetic arena for independently authored D4–D12 routes.
  airspace:{softHalfWidth:14000,hardHalfWidth:15360,spawnLimit:13500,radarRange:18000},
  countdownSeconds:600,
  scoring:{basis:"points",points:{bandit:100,bomber:100,escort:60,ace:240,raider:60,courier:100,ground:150},rank:{S:1560,A:1200,B:600,C:500}},
  primary: "Exercise engine contracts", briefing: "Synthetic test sortie.",
  debrief: "Fixture complete.", failure: "Fixture failed.",
  ground: [], phases: [{kind:"required_air",label:"Fixture target",count:1}],
 };
}
