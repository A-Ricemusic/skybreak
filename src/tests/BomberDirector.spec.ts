// Studio only: director scheduling and replicated actor poses use actual Instances/CFrames.
import { describe, expect, it } from "@rbxts/jest-globals";
import { createPhaseDirector, SpawnOptions } from "../server/PhaseDirector";
import { AirRole, CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";

function harness(blueprint: MissionBlueprint) {
	const folder = new Instance("Folder");
	const s = { blueprint, blueprintState: BlueprintRunner.NewState(blueprint, 0), difficulty: "normal", elapsed: 0,
		active: true, folder, enemies: [], projectiles: [], airQueue: [], spawnSerial: 0,
		state: { x: 0, y: 700, z: 10000 } } as unknown as CombatSession;
	const calls: { role: AirRole; options?: SpawnOptions }[] = [];
	const director = createPhaseDirector({
		spawnAir: (_, count, role, options) => { for (let i = 0; i < count; i++) { calls.push({ role, options }); s.spawnSerial++; } },
		activateGround: () => undefined, withdrawAirborne: () => undefined,
		liveAircraft: () => calls.filter((c) => c.role !== "bomber").size(),
		radio: () => undefined, acquireTarget: () => undefined, publishDamageable: () => undefined, isCurrent: () => true,
	});
	return { s, calls, director, folder };
}
function encounter(): MissionBlueprint {
	return { ...MissionCatalog.Get(1), phases: [{ kind: "required_air", label: "Intercept", count: 6,
		bombers: { count: 6, speed: 200, waypoints: [{ x: 0, y: 700, z: 20000 }], escape: { x: 0, y: 700, z: -20000 },
			escorts: { count: 4, initial: 2, role: "escort", aceName: "GREY KITE", aceAt: 150 } } }] };
}
describe("Bomber director integration", () => {
	it("spawns six route bombers and two optional escorts, then the named ace once", () => {
		const h = harness(encounter());
		h.director.Apply(h.s); h.director.Apply(h.s);
		expect(h.calls.filter((c) => c.role === "bomber").size()).toBe(6);
		expect(h.calls.filter((c) => c.role === "escort" && c.options?.optional).size()).toBe(2);
		h.s.elapsed = 149.99; h.director.Step(h.s); expect(h.calls.size()).toBe(8);
		h.s.elapsed = 150; h.director.Step(h.s); h.director.Step(h.s);
		expect(h.calls.size()).toBe(10);
		const ace = h.calls.filter((c) => c.role === "ace");
		expect(ace.size()).toBe(1); expect(ace[0].options?.name).toBe("GREY KITE"); expect(ace[0].options?.optional).toBe(true);
		h.folder.Destroy();
	});
	it("steps bombers on the route outside legacy bounds and fails at its endpoint", () => {
		const h = harness(encounter()); h.director.Apply(h.s);
		const bomber = { enabled: true, health: 180, maxHealth: 180, bomberSlot: 0, role: "bomber" } as unknown as Enemy;
		h.s.enemies.push(bomber); h.s.elapsed = 10; h.director.Step(h.s);
		expect(bomber.position.Z).toBeGreaterThan(17000); expect(bomber.velocity.Magnitude).toBeCloseTo(200);
		h.s.elapsed = 200; h.director.Step(h.s);
		expect(h.s.blueprintState?.outcome).toBe("failed"); expect(h.s.blueprintState?.reason).toBe("escaped");
		h.folder.Destroy();
	});
	it("preserves every current combat phase's opening required roles and counts", () => {
		for (const bp of MissionCatalog.All()) for (const phase of MissionCatalog.ExpandedPhases(bp)) {
			if (phase.kind !== "required_air" && phase.kind !== "chase" && phase.kind !== "ace") continue;
			const h = harness({ ...bp, phases: [phase] }); h.director.Apply(h.s);
			const role = phase.kind === "ace" ? "ace" : phase.kind === "chase" ? "courier" : "bandit";
			const count = phase.kind === "ace" ? 1 : phase.kind === "chase" ? phase.count ?? 1
				: phase.execution?.launchDelay !== undefined ? 0 : phase.execution?.directSpawn ? phase.count ?? 0 : math.ceil((phase.count ?? 0) / (phase.groups ?? 1));
			expect(h.calls.filter((c) => c.role === role).size()).toBe(count);
			expect(h.s.bomberEncounter).toBeUndefined(); h.folder.Destroy();
		}
	});
});
