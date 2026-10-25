import { ReplicatedStorage } from "@rbxts/services";
import { GameConfig } from "../shared/GameConfig";
import { Remotes } from "../shared/Types";
import { CampaignService } from "./CampaignService";
import { CombatService } from "./CombatService";
import { WorldBuilder } from "./WorldBuilder";

function ensureRemote<T extends "RemoteFunction" | "RemoteEvent">(folder: Folder, name: string, className: T): CreatableInstances[T] {
	let existing = folder.FindFirstChild(name);
	if (existing && !existing.IsA(className)) {
		existing.Destroy();
		existing = undefined;
	}
	if (!existing) {
		existing = new Instance(className);
		existing.Name = name;
		existing.Parent = folder;
	}
	return existing as CreatableInstances[T];
}

function initialize(): void {
	const existingFolder = ReplicatedStorage.FindFirstChild("Remotes");
	let remotesFolder: Folder | undefined;
	if (existingFolder?.IsA("Folder")) {
		remotesFolder = existingFolder;
	} else if (existingFolder) {
		existingFolder.Destroy();
	}
	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	const remotes: Remotes = {
		CampaignRequest: ensureRemote(remotesFolder, "CampaignRequest", "RemoteFunction"),
		FlightInput: ensureRemote(remotesFolder, "FlightInput", "RemoteEvent"),
		CombatAction: ensureRemote(remotesFolder, "CombatAction", "RemoteEvent"),
		MissionState: ensureRemote(remotesFolder, "MissionState", "RemoteEvent"),
	};

	WorldBuilder.Build();
	const [combatInitialized, combatError] = pcall(() => CombatService.Init(remotes, CampaignService.OnFinished));
	if (!combatInitialized) {
		warn(`SKYBREAK CombatService initialization failed; missions are disabled: ${tostring(combatError)}`);
		CampaignService.Init(remotes, undefined);
	} else {
		CampaignService.Init(remotes, CombatService);
	}
	print(`${GameConfig.DisplayName}: ${GameConfig.Subtitle} server started`);
}

// Test places map the production server tree too. Unit/integration specs import
// modules directly and must not create world/remotes or connect live services.
if (game.Workspace.GetAttribute("SkybreakTestMode") !== true) initialize();
