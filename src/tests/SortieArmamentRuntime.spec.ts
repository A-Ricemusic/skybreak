import { describe, expect, it } from "@rbxts/jest-globals";
import { stepRearm } from "../server/RearmRuntime";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { TargetScore } from "../shared/TargetScore";
import { FlightMath } from "../shared/FlightMath";
import { GunRules, SortieArmament } from "../shared/SortieArmament";
import type { RearmPlan } from "../shared/RearmRules";
import { Workspace } from "@rbxts/services";
import { gunOccluded, gunRaycastParams } from "../server/GunRuntime";

const plan: RearmPlan = { zone: { x: 0, y: 145.7786702793, z: 2400 }, radius: 2000, landing: { touchdown: { x: 0, y: 20, z: 0 }, headingDegrees: 0, approachDistance: 2400, rolloutDistance: 400, approachSeconds: 30, rolloutSeconds: 10, glideDegrees: 3 }, takeoffSeconds: 10, missiles: true, special: true, health: false };
function session(armament: MissionBlueprint["armament"], rearm: RearmPlan = plan): CombatSession {
	const bp: MissionBlueprint = { ...MissionCatalog.Get(1), armament, phases: [{ kind: "score_threshold", label: "Strike", scoreThreshold: { points: 2000, seconds: 600, waitForExpiry: true }, rearm }] };
	return {
		active: true, blueprint: bp, blueprintState: BlueprintRunner.NewState(bp, os.clock()), state: FlightMath.FromPose(0, 145.7786702793, 2400, 0, 0, 160),
		targetScore: new TargetScore(MissionCatalog.Scoring(1)), enemies: [], projectiles: [], special: SortieArmament.NewSpecial("flares", armament),
		gun: GunRules.New(armament), missiles: 0, health: 40, stateSequence: 1,
	} as unknown as CombatSession;
}
describe("Batch D1 runtime paths (Studio lease required to execute)", () => {
	it("restores a finite stock, its special charges and the gun magazine on rearm, and releases the trigger", () => {
		const armament = { gun: { rounds: 500 }, stock: { missiles: 36, specialCharges: 2 } };
		const s = session(armament);
		s.special.charges = 0; s.gun!.rounds = 7; GunRules.Start(s.gun!);
		const capacity = SortieArmament.MissileCapacity(armament);
		expect(stepRearm(s, 25, capacity, () => {})).toBe(true);
		expect(s.gun!.held).toBe(false); expect(s.missiles).toBe(0);
		expect(stepRearm(s, 25, capacity, () => {})).toBe(true);
		expect(s.missiles).toBe(36); expect(s.special.charges).toBe(2); expect(s.special.finite).toBe(true); expect(s.gun!.rounds).toBe(500); expect(s.health).toBe(40);
	});
	it("keeps batch C behaviour exactly for a mission without armament", () => {
		const s = session(undefined);
		s.special.charges = 0;
		stepRearm(s, 25, 8, () => {}); stepRearm(s, 25, 8, () => {});
		expect(s.missiles).toBe(8); expect(s.special.charges).toBe(3); expect(s.special.finite).toBeUndefined(); expect(s.gun).toBeUndefined();
	});
	it("leaves the magazine alone when the rearm opts the gun out", () => {
		const s = session({ gun: { rounds: 500 } }, { ...plan, gun: false });
		s.gun!.rounds = 3;
		stepRearm(s, 25, 8, () => {}); stepRearm(s, 25, 8, () => {});
		expect(s.gun!.rounds).toBe(3); expect(s.missiles).toBe(8);
	});
	it("lets cover block gun rounds near the target and near the muzzle, but not the target's own hull", () => {
		const folder = new Instance("Folder"); folder.Parent = Workspace;
		const block = (name: string, z: number, size: Vector3, parent: Instance = folder) => {
			const part = new Instance("Part"); part.Name = name; part.Anchored = true; part.Size = size; part.Position = new Vector3(0, 5000, z); part.Parent = parent; return part;
		};
		try {
			const target = new Instance("Model"); target.Parent = folder;
			block("Hull", -500, new Vector3(30, 20, 30), target);
			const near = block("NearCover", -490, new Vector3(40, 40, 2));
			const far = block("FarCover", -50, new Vector3(40, 40, 2));
			const surfaces = new RaycastParams(); surfaces.FilterType = Enum.RaycastFilterType.Include; surfaces.FilterDescendantsInstances = [folder]; surfaces.IgnoreWater = false;
			const params = gunRaycastParams(surfaces);
			expect(params.IgnoreWater).toBe(true);
			const from = new Vector3(0, 5000, 0), aim = new Vector3(0, 5000, -500);
			expect(gunOccluded(params, from, aim, target)).toBe(true);
			near.Parent = undefined;
			expect(gunOccluded(params, from, aim, target)).toBe(true);
			far.Parent = undefined;
			expect(gunOccluded(params, from, aim, target)).toBe(false);
   const sea = block("Sea", -250, new Vector3(40, 40, 2));
   surfaces.FilterDescendantsInstances = [target, sea];
   const seaParams = gunRaycastParams(surfaces);
   expect(seaParams.FilterDescendantsInstances.includes(sea)).toBe(false);
   expect(gunOccluded(seaParams, from, aim, target)).toBe(false);
		} finally { folder.Destroy(); }
	});
});
