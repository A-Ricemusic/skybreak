import { ReplicatedStorage } from "@rbxts/services";
import { MissionAssets } from "../shared/MissionAssets";
import { GameConfig } from "../shared/GameConfig";
import { Remotes } from "../shared/Types";
import { CampaignService } from "./CampaignService";
import { CombatService } from "./CombatService";
import { WorldBuilder } from "./WorldBuilder";

function ensureRemote<T extends "RemoteFunction" | "RemoteEvent" | "UnreliableRemoteEvent">(folder: Folder, name: string, className: T): CreatableInstances[T] {
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
		// High-rate streams are unreliable: a late packet is worthless, and a lost
		// one is replaced by the next instead of stalling everything queued behind it.
		FlightInput: ensureRemote(remotesFolder, "FlightInput", "UnreliableRemoteEvent"),
		CombatAction: ensureRemote(remotesFolder, "CombatAction", "RemoteEvent"),
		MissionState: ensureRemote(remotesFolder, "MissionState", "RemoteEvent"),
		FlightState: ensureRemote(remotesFolder, "FlightState", "UnreliableRemoteEvent"),
		Telemetry: ensureRemote(remotesFolder, "Telemetry", "UnreliableRemoteEvent"),
	};

	WorldBuilder.Build();
	const storyModels=new Instance("Folder");storyModels.Name="RelayStoryModels";
	for (const [name,make] of [
		["CommsRelay",()=>MissionAssets.CreateCommsRelay("CommsRelay")],
		["RelayTruck",()=>MissionAssets.CreateRelayTruck("RelayTruck")],
		["HarborLaunch",()=>MissionAssets.CreateHarborLaunch("HarborLaunch")],
	] as const) {const model=make();model.Name=name;model.Parent=storyModels;}
	storyModels.Parent=ReplicatedStorage;
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
