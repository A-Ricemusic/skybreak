import { VoicePlayer } from "./VoicePlayer";
import { Players, ReplicatedStorage, StarterGui, Workspace } from "@rbxts/services";

// roblox-ts emits index.client.tsx as the conventional init.client.luau script.

import type { Remotes } from "../shared/Types";
import { CombatEffects } from "./CombatEffects";
import { CoreGuiPolicy } from "../shared/CoreGuiPolicy";
import { FlightController } from "./FlightController";
import { mountGameUI } from "./GameUI";
import { applyMobileGraphics } from "./MobileGraphics";
import { Weather } from "./Weather";

if (Workspace.GetAttribute("SkybreakTestMode") !== true) {
	VoicePlayer.Preload();
	const player = Players.LocalPlayer;
	const playerModule = player.WaitForChild("PlayerScripts").WaitForChild("PlayerModule", 10);
	if (playerModule?.IsA("ModuleScript")) {
		const [loaded, module] = pcall(() => require(playerModule) as { GetControls?(): { Disable?(): void } });
		if (loaded && module.GetControls) {
			const controls = module.GetControls();
			controls.Disable?.();
		}
	}

	// No avatar health bar, red damage flash, backpack or reset button: the jet HUD is the only HUD.
	task.spawn(() => {
		const applied = CoreGuiPolicy.Apply(StarterGui);
		if (!applied.complete) {
			const missing: string[] = CoreGuiPolicy.Hidden.filter((kind) => !applied.hidden.has(kind)).map((kind) => kind.Name);
			if (!applied.resetButton) missing.push("ResetButton");
			warn(`SKYBREAK core GUI policy incomplete after ${applied.attempts} attempts; still showing: ${missing.join(", ")}`);
		}
	});

	const graphics = applyMobileGraphics();
	const folder = ReplicatedStorage.WaitForChild("Remotes");
	const remotes: Remotes = {
		CampaignRequest: folder.WaitForChild("CampaignRequest") as RemoteFunction,
		FlightInput: folder.WaitForChild("FlightInput") as UnreliableRemoteEvent,
		CombatAction: folder.WaitForChild("CombatAction") as RemoteEvent,
		MissionState: folder.WaitForChild("MissionState") as RemoteEvent,
		FlightState: folder.WaitForChild("FlightState") as UnreliableRemoteEvent,
		Telemetry: folder.WaitForChild("Telemetry") as UnreliableRemoteEvent,
		CombatEffect: folder.WaitForChild("CombatEffect") as RemoteEvent,
	};
	const controller = new FlightController(remotes);
	const playerGui = player.WaitForChild("PlayerGui");
	const buttons = new Map<GuiButton, RBXScriptConnection>();
	const bindButton = (item: Instance) => {
		if (!item.IsA("GuiButton") || buttons.has(item)) return;
		buttons.set(item, item.Activated.Connect(() => { if (item.Active) controller.ConfirmAudio(); }));
	};
	for (const item of playerGui.GetDescendants()) bindButton(item);
	const uiAdded = playerGui.DescendantAdded.Connect(bindButton);
	const uiRemoved = playerGui.DescendantRemoving.Connect((item) => {
		if (!item.IsA("GuiButton")) return;
		buttons.get(item)?.Disconnect(); buttons.delete(item);
	});
	const effects = CombatEffects.Start(remotes);
	const stopWeather = Weather.Start();
	const mounted = mountGameUI(playerGui, remotes, controller);
	const destroying = script.Destroying.Connect(() => {
		destroying.Disconnect();
		uiAdded.Disconnect(); uiRemoved.Disconnect();
		for (const [, connection] of buttons) connection.Disconnect();
		buttons.clear();
		for (const connection of graphics) connection.Disconnect();
		mounted.unmount();
		controller.Destroy();
		effects();
		stopWeather();
	});
}
