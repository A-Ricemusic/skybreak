// Studio only: director scheduling and replicated actor poses use actual Instances/CFrames.
import { describe, expect, it } from "@rbxts/jest-globals";
import { createPhaseDirector, SpawnOptions } from "../server/PhaseDirector";
import { AirRole, CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { BomberRules } from "../shared/BomberRules";
import { bomberEscortPose } from "../shared/BomberEncounter";
import { AssetSelection } from "../shared/AssetSelection";

function harness(blueprint: MissionBlueprint) {
	const folder = new Instance("Folder");
	const s = { blueprint, blueprintState: BlueprintRunner.NewState(blueprint, 0), difficulty: "normal", elapsed: 0,
		active: true, folder, enemies: [], projectiles: [], airQueue: [], spawnSerial: 0,
		state: { x: 0, y: 700, z: 10000 } } as unknown as CombatSession;
	const calls: { role: AirRole; options?: SpawnOptions }[] = [];
	const radio: string[] = [], budget = { fighters: undefined as number | undefined };
	const director = createPhaseDirector({
		spawnAllies: () => undefined,
		spawnAir: (_, count, role, options) => { for (let i = 0; i < count; i++) { calls.push({ role, options }); s.spawnSerial++; } },
		activateGround: () => undefined, withdrawAirborne: () => undefined,
		liveAircraft: () => budget.fighters ?? calls.filter((c) => c.role !== "bomber").size(),
		radio: (_, text) => { radio.push(text); }, acquireTarget: () => undefined, publishDamageable: () => undefined, isCurrent: () => true,
	});
	return { s, calls, director, folder, radio, budget };
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
	it("opens M1 with six forward attackers (budgeted), requests six aft at 120 s without kills, and queues the ace within budget", () => {
		for (const difficulty of ["normal", "ace"] as const) {
			const h = harness(MissionCatalog.Get(1)); h.s.difficulty = difficulty;
			const initial = 5;
			h.director.Apply(h.s); h.director.Apply(h.s);
			expect(h.calls.filter(c => c.role === "raider").size()).toBe(initial);
			for (const c of h.calls.filter(c => c.role === "raider")) expect(c.options?.behind).toBe(false);
			expect(h.s.airQueue.filter(w => w.role === "raider" && !w.behind).reduce((n,w)=>n+w.count,0)).toBe(difficulty === "ace" ? 2 : 1);
			h.s.elapsed = 119.99; h.director.Step(h.s); expect(h.s.reinforceIndex).toBe(0);
			h.s.elapsed = 120; h.director.Step(h.s); h.director.Step(h.s);
			expect(h.s.reinforceIndex).toBe(1);
			expect(h.calls.filter(c => c.role !== "bomber").size()).toBe(7);
			h.s.elapsed = 150; h.director.Step(h.s);
			expect(h.calls.filter(c => c.role !== "bomber").size()).toBe(7);
			// Simulate one fighter lost: ace takes the next slot ahead of queued raiders.
			h.budget.fighters = 6; h.director.Step(h.s);
			expect(h.calls[h.calls.size()-1].role).toBe("ace");
			h.budget.fighters = 0; h.director.Step(h.s);
			const followup = h.calls.filter(c => c.role === "raider" && c.options?.behind);
			// The remaining opening raiders and escort consume the first released slots.
			expect(followup.size()).toBe(difficulty === "ace" ? 4 : 5);
			h.director.Step(h.s);
			expect(h.calls.filter(c => c.role === "raider" && c.options?.behind).size()).toBe(difficulty === "ace" ? 7 : 6);
			expect(h.s.airQueue.size()).toBe(0);
			expect(h.calls.filter(c => c.role === "ace").size()).toBe(1);
			h.folder.Destroy();
		}
	});

	it("passes the encounter ace identity for its livery even when the blueprint names a different ace", () => {
		for (const name of ["AIR MARSHAL RUSK", "VULTURE LEAD"]) {
			const bp = encounter(); bp.aceName = name === "AIR MARSHAL RUSK" ? "VULTURE LEAD" : "AIR MARSHAL RUSK";
			bp.phases[0].bombers!.escorts.aceName = name;
			const h = harness(bp); h.director.Apply(h.s); h.s.elapsed = 150; h.director.Step(h.s);
			const resolvedName = h.calls.filter((c) => c.role === "ace")[0].options?.name;
			expect(resolvedName).toBe(name);
			expect(AssetSelection.LiveryForAce(resolvedName, bp.aceName)).toBe(name === "AIR MARSHAL RUSK" ? "Rusk" : "Vulture");
			h.folder.Destroy();
		}
	});
	it("assigns unique escort poses at spawn and update, including more escorts than bombers and queued admissions", () => {
		for (const count of [1, 2, 6]) {
			const bp = encounter(), b = bp.phases[0].bombers!;
			bp.phases[0].count = count; b.count = count; b.escorts.count = 7;
			b.waypoints = [{ x: -20000, y: 500, z: 0 }]; b.escape = { x: 20000, y: 800, z: 0 };
			const h = harness(bp); h.budget.fighters = 7; h.director.Apply(h.s);
			expect(h.calls.size()).toBe(count);
			h.s.elapsed = 150; h.director.Step(h.s); expect(h.calls.size()).toBe(count);
			h.budget.fighters = 0; h.director.Step(h.s);
			const escorts = h.calls.filter((c) => c.role === "escort" || c.role === "ace");
			expect(escorts.size()).toBe(7); expect(h.s.bomberEncounter?.escortsSpawned).toBe(7);
			const leading = BomberRules.Sample(h.s.bomberEncounter!.route, 150).slots[0];
			for (let slot = 0; slot < escorts.size(); slot++) {
				const options = escorts[slot].options!;
				expect(options.escortSlot).toBe(slot); expect(options.pose).toEqual(bomberEscortPose(leading, slot));
				h.s.enemies.push({ enabled: true, health: 100, maxHealth: 100, escortSlot: slot,
					position: new Vector3(options.pose!.position.x, options.pose!.position.y, options.pose!.position.z) } as Enemy);
			}
			h.s.state.x = -40000; h.s.elapsed = 151; h.director.Step(h.s);
			const nextLeading = BomberRules.Sample(h.s.bomberEncounter!.route, 151).slots[0];
			for (let slot = 0; slot < escorts.size(); slot++) {
				const expected = bomberEscortPose(nextLeading, slot).position;
				expect(h.s.enemies[slot].position.sub(new Vector3(expected.x, expected.y, expected.z)).Magnitude).toBeCloseTo(0);
			}
			expect(h.calls.size()).toBe(count + 7); h.folder.Destroy();
		}
	});
	it("steps bombers on the route outside legacy bounds and fails at its endpoint", () => {
		const h = harness(encounter()); h.director.Apply(h.s);
		const bomber = { enabled: true, health: 180, maxHealth: 180, bomberSlot: 0, role: "bomber" } as unknown as Enemy;
		h.s.enemies.push(bomber); h.s.elapsed = 10; h.director.Step(h.s);
		expect(bomber.position.Z).toBeGreaterThan(17000); expect(bomber.velocity.Magnitude).toBeCloseTo(200);
		h.s.elapsed = 200; h.director.Step(h.s);
		expect(h.s.blueprintState?.outcome).toBe("failed"); expect(h.s.blueprintState?.reason).toBe("bombers_escaped");
		expect(h.radio[h.radio.size() - 1]).toBe("The bombers are through.");
		h.folder.Destroy();
	});
	it("uses an authored endpoint radio call on a route with a different heading", () => {
		const bp = encounter(), b = bp.phases[0].bombers!;
		b.waypoints = [{ x: -20000, y: 700, z: 0 }]; b.escape = { x: 20000, y: 700, z: 0 };
		b.escapeCall = "The formation crossed the boundary.";
		const h = harness(bp); h.director.Apply(h.s); h.s.elapsed = 200; h.director.Step(h.s);
		expect(h.s.blueprintState?.reason).toBe("bombers_escaped");
		expect(h.radio[h.radio.size() - 1]).toBe(b.escapeCall); h.folder.Destroy();
	});
	it("preserves every current combat phase's required roles, opening counts and authored arrivals", () => {
		for (const bp of MissionCatalog.All()) for (const phase of MissionCatalog.ExpandedPhases(bp)) {
			if (phase.kind !== "required_air" && phase.kind !== "chase" && phase.kind !== "ace") continue;
			const h = harness({ ...bp, phases: [phase] }); h.director.Apply(h.s);
			if (phase.bombers) {
				const bombers = phase.bombers;
				// Unscheduled formations still require their full count at opening.
				// Streams require exactly the slots due on the phase-relative clock.
				const expectDue = (elapsed: number) => {
					const expectedSlots: number[] = [];
					for (let slot = 0; slot < bombers.count; slot++) {
						if ((bombers.arrivalSeconds?.[slot] ?? 0) <= elapsed) expectedSlots.push(slot);
					}
					const spawned = h.calls.filter((c) => c.role === "bomber");
					expect(spawned.size()).toBe(expectedSlots.size());
					expect(spawned.map((c) => c.options?.bomberSlot)).toEqual(expectedSlots);
					for (const call of spawned) expect(call.options?.targetId).toBe(bombers.targetIds?.[call.options!.bomberSlot!]);
					expect(h.s.bomberEncounter?.bombersSpawned).toBe(expectedSlots.size());
				};
				expectDue(0);
				expect(h.calls.filter((c) => c.role === "escort" && c.options?.optional).size()).toBe(bombers.escorts.initial);
				expect(h.calls.filter((c) => c.role === "bandit").size()).toBe(0);
				expect(h.s.bomberEncounter).toBeDefined();
				let previousArrival = 0;
				for (const at of bombers.arrivalSeconds ?? []) {
					if (at <= previousArrival) continue;
					previousArrival = at;
					h.s.elapsed = at - 0.001; h.director.Step(h.s); expectDue(h.s.elapsed);
					h.s.elapsed = at; h.director.Step(h.s); expectDue(at);
					h.director.Step(h.s); expectDue(at); // A repeated step cannot duplicate a slot.
				}
				expect(h.calls.filter((c) => c.role === "bomber").size()).toBe(bombers.count);
				h.folder.Destroy();
				continue;
			}
			const role = phase.kind === "ace" ? "ace" : phase.kind === "chase" ? "courier" : "bandit";
			const count = phase.kind === "ace" ? 1 : phase.kind === "chase" ? phase.count ?? 1
				: phase.execution?.launchDelay !== undefined ? 0 : phase.execution?.directSpawn ? phase.count ?? 0 : math.ceil((phase.count ?? 0) / (phase.groups ?? 1));
			expect(h.calls.filter((c) => c.role === role).size()).toBe(count);
			if (role === "ace") expect(h.calls.filter((c) => c.role === "ace")[0].options?.name).toBeUndefined();
			expect(h.s.bomberEncounter).toBeUndefined(); h.folder.Destroy();
		}
	});
});


describe("D4 director contracts (compiled for orchestrator Studio lease)",()=>{
	function stream() {
		const bp=encounter(), p=bp.phases[0], b=p.bombers!;
		p.update={objective:"Protect transmitter",radio:[],countdownSeconds:360};
		p.interceptHold={site:{x:0,y:80,z:0},siteName:"VARDA TOWER",ignitionSecondsRemaining:35,ignitionCall:"Transmitter ignition."};
		b.waypoints=[{x:-10000,y:700,z:0}]; b.escape={x:0,y:700,z:0};b.speed=50;
		b.targetIds=["west-1","west-2","west-3","west-4","west-5","west-6"];
		b.arrivalSeconds=[0,10,20,30,40,50];b.escorts={count:0,initial:0,role:"escort",aceName:"NONE",aceAt:0};
		return bp;
	}
	it("admits the stream once per slot with stable target ids and no premature endpoint loss after kills",()=>{
		const h=harness(stream());h.folder.Parent=game.GetService("Workspace");h.director.Apply(h.s);expect(h.calls.size()).toBe(1);
		h.s.elapsed=9.99;h.director.Step(h.s);expect(h.calls.size()).toBe(1);
		h.s.elapsed=10;h.director.Step(h.s);h.director.Step(h.s);expect(h.calls.size()).toBe(2);
		expect(h.calls[1].options?.targetId).toBe("west-2");expect(h.calls[1].options?.bomberSlot).toBe(1);
		expect(h.calls[1].options?.pose?.position.x).toBeCloseTo(-10000);
		h.s.elapsed=50;h.director.Step(h.s);expect(h.calls.size()).toBe(6);
		// Kill path removes every bomber; the route origin reaching escape cannot fail a cleared hold.
		h.s.elapsed=250;h.director.Step(h.s);expect(h.s.blueprintState?.outcome).toBeUndefined();
		h.s.blueprintState!.ignitionAnnounced=true;h.director.Step(h.s);
		expect(h.s.navigationActor?.GetAttribute("BroadcastActive")).toBe(true);
		h.folder.Destroy();
	});
	it("moves each bomber on its own arrival clock and fails when a survivor reaches the site",()=>{
		const h=harness(stream());h.director.Apply(h.s);h.s.elapsed=50;h.director.Step(h.s);
		for(let slot=0;slot<6;slot++) h.s.enemies.push({enabled:true,health:180,maxHealth:180,bomberSlot:slot,role:"bomber"} as Enemy);
		h.s.elapsed=100;h.director.Step(h.s);
		// +X route: X = -10000 + 50 * (100 - arrivalSeconds[slot]) - local aft offset.
		// The default formation's second row remains 220 studs aft even with independent clocks.
		const expectedX = [-5000, -5500, -6000, -6720, -7220, -7720];
		for (let slot = 0; slot < 6; slot++) expect(h.s.enemies[slot].position.X).toBeCloseTo(expectedX[slot]);
		// Ignore dead slot 0's endpoint at 200 s; surviving slot 1 reaches it at 10 + 10000 / 50 = 210 s.
		h.s.enemies[0].health=0;h.s.elapsed=209.99;h.director.Step(h.s);expect(h.s.blueprintState?.outcome).toBeUndefined();
		h.s.elapsed=210;h.director.Step(h.s);expect(h.s.blueprintState?.outcome).toBe("failed");expect(h.s.blueprintState?.reason).toBe("bombers_escaped");h.folder.Destroy();
	});
	it("queues the initial 27 contacts at a seven-fighter ceiling without repeating the wave",()=>{
		const bp=encounter();bp.phases=[{kind:"score_threshold",label:"Battle",concurrentFighters:7,scoreThreshold:{points:800,seconds:420,waitForExpiry:true},fighterWaves:[{id:"battle",count:27,role:"raider",scoreRole:"escort",trigger:{kind:"phase_start",phase:0}}]}];
		const h=harness(bp);h.director.Apply(h.s);h.director.Step(h.s);h.director.Step(h.s);expect(h.calls.size()).toBe(7);expect(h.s.airQueue[0].count).toBe(20);
		h.budget.fighters=6;h.director.Step(h.s);expect(h.calls.size()).toBe(8);expect(h.s.airQueue[0].count).toBe(19);h.folder.Destroy();
	});
});
