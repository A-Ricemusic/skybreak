import { describe, expect, it } from "@rbxts/jest-globals";
import { ReplicatedStorage, RunService } from "@rbxts/services";
import { AC04CampaignService } from "../server/AC04CampaignService";
import { Remotes } from "../shared/Types";

describe("AC04 unpublished Studio startup", () => {
	it("exposes campaign entry without acquiring an unavailable cloud DataStore", () => {
		expect(RunService.IsStudio()).toBe(true);
		expect(game.GameId).toBe(0);
		const folder = new Instance("Folder"); folder.Name = "Remotes"; folder.Parent = ReplicatedStorage;
		const event = new Instance("RemoteEvent"); event.Parent = folder;
		const stream = new Instance("UnreliableRemoteEvent"); stream.Parent = folder;
		const remotes: Remotes = { FlightInput: stream, CombatAction: event, MissionState: event, FlightState: stream, Telemetry: stream, CombatEffect: event };
		const [ok, failure] = pcall(() => AC04CampaignService.Init(remotes, {
			StartMission() { return $tuple(false, "Unused startup fixture"); },
			EndMission() {},
			GetSession() { return undefined; },
		}));
		const created = folder.FindFirstChild("AC04Request")?.IsA("RemoteFunction") === true;
		folder.Destroy();
		if (!ok) error(tostring(failure));
		expect(created).toBe(true);
	});
});
