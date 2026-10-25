import { Players, ReplicatedStorage, StarterGui, Workspace } from "@rbxts/services";

// roblox-ts emits index.client.tsx as the conventional init.client.luau script.

import type { Remotes } from "../shared/Types";
import { FlightController } from "./FlightController";
import { mountGameUI } from "./GameUI";

if (Workspace.GetAttribute("SkybreakTestMode") !== true) {
	const player = Players.LocalPlayer;
	const playerModule = player.WaitForChild("PlayerScripts").WaitForChild("PlayerModule", 10);
	if (playerModule?.IsA("ModuleScript")) {
		const [loaded, module] = pcall(() => require(playerModule) as { GetControls?(): { Disable?(): void } });
		if (loaded && module.GetControls) {
			const controls = module.GetControls();
			controls.Disable?.();
		}
	}

	task.spawn(() => {
		for (let attempt = 0; attempt < 20; attempt++) {
			const [disabled] = pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false));
			if (disabled) break;
			task.wait(0.25);
		}
	});

	const folder = ReplicatedStorage.WaitForChild("Remotes");
	const remotes: Remotes = {
		CampaignRequest: folder.WaitForChild("CampaignRequest") as RemoteFunction,
		FlightInput: folder.WaitForChild("FlightInput") as RemoteEvent,
		CombatAction: folder.WaitForChild("CombatAction") as RemoteEvent,
		MissionState: folder.WaitForChild("MissionState") as RemoteEvent,
		Cutscene: folder.WaitForChild("Cutscene") as RemoteEvent,
	};
	const controller = new FlightController(remotes);
	const mounted = mountGameUI(player.WaitForChild("PlayerGui"), remotes, controller);
	const destroying = script.Destroying.Connect(() => {
		destroying.Disconnect();
		mounted.unmount();
		controller.Destroy();
	});
}
