import { describe, expect, it } from "@rbxts/jest-globals";
import { Players, RunService, Workspace } from "@rbxts/services";
import { CampaignCoordinator } from "../server/CampaignRepository";
import { CampaignService, installCampaignSmokePlayer } from "../server/CampaignService";
import { CombatService, installCampaignSmokeCombat } from "../server/CombatService";
import { CAMPAIGN_COMMAND_COOLDOWN } from "../server/CampaignRequestBudget";
import { MissionWorld } from "../server/MissionWorld";
import { registerWorldClear, worldLifecycle } from "../server/WorldLifecycleRuntime";
import { JetFactory } from "../shared/JetFactory";
import { MissionCatalog } from "../shared/MissionCatalog";
import { PauseRules } from "../shared/SessionGuard";
import type { Remotes } from "../shared/Types";

function primitive(name: string): Model {
	const model = new Instance("Model");
	model.Name = name;
	const root = new Instance("Part");
	root.Name = "Root";
	root.Anchored = true;
	root.CanCollide = false;
	root.CanQuery = false;
	root.Size = new Vector3(4, 2, 8);
	root.Parent = model;
	model.PrimaryPart = root;
	return model;
}

function waitForWiring(check: () => boolean, seconds = 3): void {
	const deadline = os.clock() + seconds;
	while (!check() && os.clock() < deadline) task.wait();
	assert(check(), "Loading wiring event did not complete within its test bound");
}

// Engine test: actual Init registrations, actual Heartbeat, StartMission/session registry,
// campaign command budget and exact expiry callback. Only identities, incoming transport and
// asset/world construction are substituted. No InsertService, mesh creation, PBR setters or audio.
describe("production loading handshake wiring (Studio)", () => {
	it("expires through the registered callback, retries without client help, and scopes actual Ready dispatch", () => {
		assert(
			RunService.IsStudio() && Workspace.GetAttribute("SkybreakTestMode") === true,
			"Isolated test place only",
		);
		assert(worldLifecycle.AwaitIdle(5), "World lease must be idle");
		const previousRoot = Workspace.FindFirstChild("SkybreakCombat");
		assert(
			previousRoot === undefined || previousRoot.GetChildren().isEmpty(),
			"Do not share an active combat world",
		);
		const root = previousRoot ?? new Instance("Folder");
		assert(root.IsA("Folder"), "Combat root must be a Folder");
		root.Name = "SkybreakCombat";
		root.Parent = Workspace;
		const player = { Name: "LoadingWiring", UserId: -275, Parent: Players } as unknown as Player;
		const other = { Name: "WrongSender", UserId: -276, Parent: Players } as unknown as Player;
		const signal = new Instance("BindableEvent");
		const actions: ((player: Player, payload: unknown) => void)[] = [];
		const inbound = (capture: boolean) => ({
			OnServerEvent: {
				Connect(callback: (player: Player, payload: unknown) => void) {
					if (capture) actions.push(callback);
					return signal.Event.Connect(() => {});
				},
			},
		});
		const packets: { kind: string; launchId?: number }[] = [];
		const sink = {
			FireClient(_player: Player, packet: unknown) {
				packets.push(packet as { kind: string; launchId?: number });
			},
		};
		const remotes = {
			MissionState: sink,
			FlightState: sink,
			Telemetry: sink,
			CombatEffect: sink,
			CombatAction: inbound(true),
			FlightInput: inbound(false),
		} as unknown as Remotes;
		const jets = JetFactory as unknown as {
			Create: (this: void, self: typeof JetFactory, name: string, enemy: boolean) => Model;
		};
		const world = MissionWorld as unknown as {
			Build: (
				this: void,
				self: typeof MissionWorld,
				id: number,
				folder: Instance,
			) => ReturnType<typeof MissionWorld.Build>;
			RestoreMenu: (this: void, self: typeof MissionWorld) => void;
		};
		const original = { create: jets.Create, build: world.Build, restore: world.RestoreMenu };
		jets.Create = (_self, name) => primitive(name);
		world.Build = (_self, id, folder) => {
			assert(id === 0, "Primitive fixture supports only Practice");
			const radar = primitive("TRAINING RADAR");
			radar.PivotTo(new CFrame(0, 50, -850));
			radar.Parent = folder;
			return { groundTargets: [radar] };
		};
		world.RestoreMenu = () => {};
		const restoreClear = registerWorldClear(MissionCatalog.WorldKey(0), () => {});
		const coordinator = new CampaignCoordinator("loading-wiring");
		coordinator.load();
		const combat = installCampaignSmokeCombat(player, root, remotes, CampaignService.OnFinished);
		const campaign = installCampaignSmokePlayer(player, coordinator, remotes, CombatService);
		let expired = 0;
		let admissions = 0;
		let callbackBeforeCleanup = true;
		const ready = (generation: number, owner = player) =>
			actions[0](owner, { action: "Ready", launchId: generation });
		const starts = () => packets.filter((p) => p.kind === "Started").size();
		const launch = (generation: number) => {
			task.wait(CAMPAIGN_COMMAND_COOLDOWN + 0.01);
			expect(campaign.request("StartMission", { slot: 1, missionId: 0, launchId: generation }).ok).toBe(true);
			const session = CombatService.GetSession(player);
			assert(session?.loading !== undefined, "Real StartMission must register its loading session");
			return session;
		};
		try {
			CombatService.Init(
				remotes,
				(owner, won, stats, identity) => {
					admissions++;
					return CampaignService.OnFinished(owner, won, stats, identity);
				},
				(owner, identity, generation) => {
					expired++;
					callbackBeforeCleanup = callbackBeforeCleanup && CombatService.GetSession(owner) === identity;
					CampaignService.OnLoadingExpired(owner, identity, generation);
				},
			);
			expect(actions.size()).toBe(1); // captures exactly the callback connected by production Init
			const first = launch(1);
			expect(campaign.request("CancelLaunch", { launchId: 1 }).ok).toBe(false); // real command budget refusal
			const firstFolder = first.folder;
			first.loading!.deadline = os.clock() - 1; // drive the deadline, not a cleanup/callback test hook
			ready(1); // expired Ready must not start, even before the next Heartbeat
			expect(starts()).toBe(0);
			expect(CombatService.GetSession(player)).toBe(first);
			waitForWiring(() => CombatService.GetSession(player) === undefined);
			expect(first.cleaned).toBe(true);
			expect(firstFolder.Parent).toBeUndefined();
			expect(first.elapsed).toBe(0);
			expect(expired).toBe(1);
			expect(callbackBeforeCleanup).toBe(true);
			expect(admissions).toBe(0);
			const second = launch(2); // real campaign ownership must have been cleared by the registered expiry
			PauseRules.Pause(second.pause, os.clock());
			second.loading!.deadline = os.clock() - 1;
			waitForWiring(() => CombatService.GetSession(player) === undefined); // no CancelLaunch sent at all
			expect(second.cleaned).toBe(true);
			expect(second.elapsed).toBe(0);
			expect(expired).toBe(2); // loading expiry wins over pause handling
			const replacement = launch(3);
			ready(1);
			ready(2);
			ready(3, other);
			expect(replacement.loading).toBeDefined();
			expect(starts()).toBe(0);
			const aircraftRoot = replacement.aircraft.PrimaryPart!;
			replacement.aircraft.PrimaryPart = undefined;
			ready(3);
			expect(replacement.loading).toBeDefined();
			aircraftRoot.Parent = replacement.folder;
			ready(3); // a root outside its own aircraft cannot establish readiness
			expect(replacement.loading).toBeDefined();
			aircraftRoot.Parent = replacement.aircraft;
			replacement.aircraft.Parent = new Instance("Folder");
			replacement.aircraft.PrimaryPart = aircraftRoot;
			ready(3); // a live root in the wrong session hierarchy must not pass
			expect(replacement.loading).toBeDefined();
			const detached = replacement.aircraft.Parent!;
			replacement.aircraft.Parent = replacement.folder;
			detached.Destroy();
			PauseRules.Pause(replacement.pause, os.clock());
			ready(3); // valid current Ready releases once while preserving an already-paused clock
			expect(replacement.loading).toBeUndefined();
			expect(starts()).toBe(1);
			expect(PauseRules.Paused(replacement.pause)).toBe(true);
			const state = { ...replacement.state };
			ready(3);
			ready(2);
			task.wait(0.1);
			expect(starts()).toBe(1);
			expect(replacement.elapsed).toBe(0);
			expect(replacement.state).toEqual(state);
			actions[0](player, { action: "Resume" });
			waitForWiring(() => replacement.elapsed > 0); // genuine normal play advances only after Ready and Resume
			actions[0](player, { action: "Pause" });
			expect(PauseRules.Paused(replacement.pause)).toBe(true);
			const pausedElapsed = replacement.elapsed;
			ready(3);
			task.wait(0.1);
			expect(replacement.elapsed).toBe(pausedElapsed);
			expect(expired).toBe(2);
			expect(admissions).toBe(0);
			expect(packets.filter((p) => p.kind === "Completed" || p.kind === "Failed").size()).toBe(0);
			expect(coordinator.getSlots()[0].missions?.[0]?.completed).never.toBe(true);
		} finally {
			CombatService.EndMission(player);
			assert(worldLifecycle.AwaitIdle(5), "Primitive world cleanup must finish before restoring methods");
			campaign.restore();
			combat.restore();
			jets.Create = original.create;
			world.Build = original.build;
			world.RestoreMenu = original.restore;
			restoreClear();
			signal.Destroy();
			if (previousRoot === undefined) root.Destroy();
		}
	}, 15000);
});
