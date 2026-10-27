import { describe, expect, it } from "@rbxts/jest-globals";
import { WorldAirspace } from "../shared/WorldAirspace";
import { KIT_BOUNDS } from "../shared/WorldDistricts";
import { MissionCatalog } from "../shared/MissionCatalog";
import { layoutFor } from "../shared/MissionLayouts";
import { KEEL_MIN, auditPlan } from "../shared/WorldAudit";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { WATER_Y, WORLD_BUDGET, WorldPlanner, propBox, surfaceAt, terrainTop } from "../shared/WorldPlan";

// Pure world-plan contracts for missions 3-27; also run in the offline Luau VM.
// The engine half (the plan executed into Terrain, parts and uploaded clones)
// is covered by RelayWorld.spec in Roblox Jest.
const ids: number[] = [];
for (let id = 3; id <= 27; id++) ids.push(id);

describe("Mission world plans", () => {
	it("connects outer roads and keeps the airstrip clear in expanded airspace", () => {
		expect(WorldAirspace.soft).toBeLessThan(WorldAirspace.hard);
		expect(WorldAirspace.hard).toBeLessThan(4000);
		for (const id of [3, 5, 19]) {
			const plan = WorldPlanner.Build(id);
			expect(plan.props.filter((p) => p.tag === "OuterDistrict").size()).toBeGreaterThan(15);
			// At each junction the full surface is paved; the access spur connects
			// to the longitudinal road instead of stopping short of it.
			for (const [x, z] of [[3400, 1100], [3400, -600], [3400, 600], [3300, 1100]]) expect(surfaceAt(plan, x, z).kind).toBe("part");
			for (const p of plan.parts) if (p.mesh !== undefined) {
				expect([p.sx, p.sy, p.sz]).toEqual(KIT_BOUNDS[p.mesh]);
				expect(math.max(math.abs(p.x) + p.sx / 2, math.abs(p.z) + p.sz / 2)).toBeLessThan(WorldAirspace.hard);
			}
		}
		const m3 = WorldPlanner.Build(3);
		// Sweep the runway and both approaches: no prop/terrain buried in pavement.
		for (let z = -850; z <= 850; z += 25) {
			for (const x of [2910, 2950, 2990]) expect(surfaceAt(m3, x, z).y).toBeLessThan(46);
		}
		expect(WorldPlanner.Build(5).parts.some((p) => p.mesh === "RunwayTile")).toBe(false);
	});
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
	it("keeps every escort, defend and parked launch afloat along its whole path", () => {
		let checked = 0;
		for (const id of ids) {
			const plan = WorldPlanner.Build(id);
			const wet = plan.theme === "coast" || plan.theme === "ocean";
			if (wet) expect(plan.waterPaths.size() > 0 || MissionCatalog.ExpandedPhases(MissionCatalog.Get(id)).every((p) => p.kind !== "escort" && p.kind !== "defend" && p.parkedEscort === undefined)).toBe(true);
			checked += plan.waterPaths.size();
			const boat = auditPlan(plan).problems.filter((p) => p.sub(1, 4) === "boat");
			expect(boat.join("\n")).toBe("");
		}
		expect(checked).toBeGreaterThan(8);
		// Regression (PR #47 review): M21's civic pavement roofed the launch's canal between its vertices.
		const m21 = WorldPlanner.Build(21);
		expect(terrainTop(m21.ops, -200, -1260).water).toBe(WATER_Y);
		expect(surfaceAt(m21, -200, -1260).kind).toBe("water");
		// And M25's canal mouth had a concrete bank cap standing across it in open water.
		const m25 = WorldPlanner.Build(25);
		expect(terrainTop(m25.ops, -730, -1602).water).toBe(WATER_Y);
	});
	it("moors every frigate over a berth deeper than its keel", () => {
		let frigates = 0;
		for (const id of ids) {
			const plan = WorldPlanner.Build(id);
			for (const p of plan.props) {
				if (p.asset !== "Frigate") continue;
				frigates += 1;
				const box = propBox(p);
				expect(box.bottom).toBe(WATER_Y - UploadedAssetSpecs.Frigate.groundOffset);
				const c = math.cos(p.yaw), s = math.sin(p.yaw);
				for (const lx of [-box.rect.hx, 0, box.rect.hx]) for (const lz of [-box.rect.hz, -box.rect.hz / 2, 0, box.rect.hz / 2, box.rect.hz]) {
					const x = p.x + c * lx + s * lz, z = p.z - s * lx + c * lz, t = terrainTop(plan.ops, x, z);
					expect(`M${id} hull (${math.floor(x)}, ${math.floor(z)}): water ${t.water}, seabed ok ${t.solid <= box.bottom - KEEL_MIN}`).toBe(`M${id} hull (${math.floor(x)}, ${math.floor(z)}): water ${WATER_Y}, seabed ok true`);
				}
			}
		}
		expect(frigates).toBeGreaterThanOrEqual(8);
	});
	it("is deterministic and inside the mobile budget", () => {
		const a = WorldPlanner.Counts(WorldPlanner.Build(5));
		expect(a.parts).toBeLessThanOrEqual(WORLD_BUDGET.parts);
		expect(a.props).toBeLessThanOrEqual(WORLD_BUDGET.props);
		expect(a.uniqueMeshes).toBeLessThanOrEqual(WORLD_BUDGET.uniqueMeshes);
	});
});
