import type { MissionBlueprint } from "../MissionCatalog";

export const mission: MissionBlueprint = {
	id: 2,
	act: 1,
	codename: "Iron Coast",
	title: "IRON COAST",
	region: "coastal_city",
	environment: "harbor_sunset",
	primary: "Break the coastal strike force staging against Varda Rim",
	briefing: "Intercept the three-bandit screen, destroy five coastal warehouses while raiders pursue, then down the faster armored ace.",
	debrief: "The coast is quiet. One tape keeps looping: 'They moved the fuel north. Follow the relays.'",
	failure: "The strike force stages unopposed. The coast keeps fuelling the raid on Varda Rim.",
	phases: [
			{ execution: { directSpawn: true, preservePursuers: true, fixedRaiders: true, hudPhase: "intercept", objective: "Shoot down all three bandits" }, kind: "required_air", label: "Intercept the three-bandit screen", count: 3, beat: "SERA: Three bandits over the harbor. Take them." },
			{ execution: { directSpawn: true, preservePursuers: true, fixedRaiders: true, raiderKillCap: 5, hudPhase: "warehouses", objective: "Destroy all five warehouses; raiders may chase you" }, kind: "required_ground", label: "Destroy five warehouses", count: 5, optionalRaiders: 5, beat: "SERA: Five warehouses feed the raid. Burn them all." },
			{ execution: { directSpawn: true, preservePursuers: true, fixedRaiders: true, raiderKillCap: 5, hudPhase: "ace", objective: "Destroy the ace; his raiders are still dangerous" }, kind: "ace", label: "Destroy the ace", beat: "SERA: Their lead is armored. Make every shot count." },
		],
	ground: [
			{ asset: "warehouse", name: "WAREHOUSE 1", x: -550, z: -900 },
			{ asset: "warehouse", name: "WAREHOUSE 2", x: 0, z: -1100 },
			{ asset: "warehouse", name: "WAREHOUSE 3", x: 550, z: -900 },
			{ asset: "warehouse", name: "WAREHOUSE 4", x: -350, z: -1550 },
			{ asset: "warehouse", name: "WAREHOUSE 5", x: 350, z: -1550 },
		],
	legacy: 2,
	optionalRaiderMax: 5,
};
