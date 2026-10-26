import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog } from "../shared/MissionCatalog";
import { layoutFor } from "../shared/MissionLayouts";
import { auditPlan } from "../shared/WorldAudit";
import { WORLD_BUDGET, WorldPlanner, terrainTop } from "../shared/WorldPlan";

// Pure world-plan contracts for missions 3-27; also run in the offline Luau VM.
// The engine half (the plan executed into Terrain, parts and uploaded clones)
// is covered by RelayWorld.spec in Roblox Jest.
const ids: number[] = [];
for (let id = 3; id <= 27; id++) ids.push(id);

describe("Mission world plans", () => {
	for (const id of ids) {
		it(`M${id} keeps flight points clear, targets grounded, nothing floating and the budget`, () => {
			const result = auditPlan(WorldPlanner.Build(id));
			const shown = result.problems.size() > 8 ? [...result.problems.filter((_, i) => i < 8), `... ${result.problems.size() - 8} more`] : result.problems;
			expect(shown.join("\n")).toBe("");
			expect(result.checkedAir).toBeGreaterThan(3);
		});
	}
	it("uses the uploaded models everywhere they fit", () => {
		for (const id of ids) {
			const plan = WorldPlanner.Build(id), bp = MissionCatalog.Get(id), c = WorldPlanner.Counts(plan);
			const has = (asset: string) => plan.props.filter((p) => p.asset === asset).size();
			if (plan.theme === "farm" || plan.theme === "coast") {
				expect(c.trees).toBeGreaterThanOrEqual(60);
				expect(c.trees).toBeLessThanOrEqual(150);
			}
			if (plan.theme === "farm") expect(has("Farmhouse") + has("Barn") + has("GrainSilo")).toBeGreaterThanOrEqual(3);
			if (bp.region === "coastal_city") expect(has("OfficeMidrise") > 0 && has("ApartmentBlock") > 0 && has("CityTower") > 0).toBe(true);
			if (bp.region === "coastal_harbor") expect(has("HarbourQuay") > 0 && has("ContainerStack") > 0 && has("GantryCrane") > 0).toBe(true);
			if (bp.region === "canyon_airfield") expect(has("Hangar") > 0 && has("ControlTower") === 1).toBe(true);
			if (plan.theme === "ocean") expect(has("OilPlatform")).toBe(1);
			if (bp.region === "plateau_relay") expect(has("RelayMast") > 0 && has("RadarDish") > 0).toBe(true);
			// Primitive trees and boulders are gone: scenery is uploaded clones, not part scatter.
			expect(plan.parts.filter((p) => p.name === "Canopy" || p.name === "Trunk" || p.name === "Boulder").size()).toBe(0);
		}
		// Every harbour-landmark mission shows a frigate alongside its quays.
		for (const id of ids) if (layoutFor(id).landmark === "harbor") expect(WorldPlanner.Build(id).props.filter((p) => p.asset === "Frigate").size()).toBeGreaterThanOrEqual(1);
	});
	it("rings the M23 platform with three frigates, the protected one tagged and beaconed", () => {
		const plan = WorldPlanner.Build(23);
		const frigates = plan.props.filter((p) => p.asset === "Frigate");
		expect(frigates.size()).toBe(3);
		expect(frigates.filter((p) => p.tag === "ProtectedHull").size()).toBe(1);
		expect(plan.parts.filter((p) => p.name === "Protected beacon").size()).toBe(2);
		const defend = MissionCatalog.ExpandedPhases(MissionCatalog.Get(23)).find((p) => p.kind === "defend")!.points![0];
		const hull = frigates.find((p) => p.tag === "ProtectedHull")!;
		// Alongside the defended point (where the protected launch floats), not on top of it.
		const d = math.sqrt((hull.x - defend.x) * (hull.x - defend.x) + (hull.z - defend.z) * (hull.z - defend.z));
		expect(d > 40 && d < 80).toBe(true);
		expect(WorldPlanner.Build(24).props.filter((p) => p.asset === "OilPlatform").size()).toBe(1);
	});
	it("uses Terrain water for every coast and ocean mission and keeps land missions dry", () => {
		for (const id of ids) {
			const plan = WorldPlanner.Build(id);
			const wet = plan.ops.some((o) => o.material === "Water");
			expect(wet).toBe(plan.theme === "coast" || plan.theme === "ocean" || plan.ops.some((o) => o.material === "Water" && o.sx === 160));
			if (plan.theme === "ocean") expect(terrainTop(plan.ops, 0, 2500).water).toBe(32);
		}
	});
	it("is deterministic and inside the mobile budget", () => {
		const a = WorldPlanner.Counts(WorldPlanner.Build(5));
		expect(a.parts).toBeLessThanOrEqual(WORLD_BUDGET.parts);
		expect(a.props).toBeLessThanOrEqual(WORLD_BUDGET.props);
		expect(a.uniqueMeshes).toBeLessThanOrEqual(WORLD_BUDGET.uniqueMeshes);
	});
});
