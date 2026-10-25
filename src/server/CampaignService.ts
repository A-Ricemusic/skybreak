import { DataStoreService, Players, RunService } from "@rbxts/services";
import { GameConfig } from "../shared/GameConfig";
import { CampaignResponse, FinishedCallback, Remotes } from "../shared/Types";
import { CampaignCoordinator, CampaignStore, canAttemptRecovery, completeMission, isValidSlot, StoredProfile } from "./CampaignRepository";

interface CombatApi {
	StartMission(player: Player, slot: number): LuaTuple<[boolean, string?]>;
	EndMission(player: Player): void;
	GetSession(player: Player): unknown;
}

interface PlayerState {
	readonly player: Player;
	readonly coordinator: CampaignCoordinator;
	loaded: boolean;
	loadStarted: boolean;
	activeSlot?: number;
	requestBusy: boolean;
	lastRequest: number;
	lastRecovery: number;
	closing: boolean;
}

const LOAD_TIMEOUT = 20;
const REQUEST_INTERVAL = 0.12;
const RECOVERY_INTERVAL = 3;

let profileStore: DataStore | undefined;
let remotes: Remotes | undefined;
let combatService: CombatApi | undefined;
let initialized = false;
const states = new Map<Player, PlayerState>();

function getProfileStore(): DataStore {
	if (!profileStore) profileStore = DataStoreService.GetDataStore(GameConfig.Campaign.DataStoreName);
	return profileStore;
}

class RobloxDataStore implements CampaignStore {
	public load(key: string): unknown {
		const [value] = getProfileStore().GetAsync<unknown>(key);
		return value;
	}

	public update(key: string, transform: (current: unknown) => StoredProfile): unknown {
		const [value] = getProfileStore().UpdateAsync<unknown, StoredProfile>(key, (current) => $tuple(transform(current)));
		return value;
	}
}

const robloxDataStore = new RobloxDataStore();

function unpublishedStudio(): boolean {
	return RunService.IsStudio() && game.GameId === 0;
}

function newState(player: Player): PlayerState {
	const sessionOnly = unpublishedStudio();
	if (sessionOnly) warn("SKYBREAK campaign persistence is SESSION-ONLY in this unpublished Studio place; no DataStore requests will be made.");
	return {
		player,
		coordinator: new CampaignCoordinator(`player_${player.UserId}`, sessionOnly ? undefined : robloxDataStore),
		loaded: false,
		loadStarted: false,
		requestBusy: false,
		lastRequest: 0,
		lastRecovery: -math.huge,
		closing: false,
	};
}

function getState(player: Player): PlayerState {
	let state = states.get(player);
	if (!state) {
		state = newState(player);
		states.set(player, state);
	}
	return state;
}

function startLoading(state: PlayerState): void {
	if (state.loadStarted) return;
	state.loadStarted = true;
	task.spawn(() => {
		state.coordinator.load();
		state.loaded = true;
	});
}

function waitForLoad(state: PlayerState): boolean {
	startLoading(state);
	const deadline = os.clock() + LOAD_TIMEOUT;
	while (!state.loaded && !state.closing && os.clock() < deadline) task.wait(0.05);
	return state.loaded;
}

function response(state: PlayerState, ok: boolean, errorMessage?: string): CampaignResponse {
	const result: CampaignResponse = {
		ok,
		slots: state.coordinator.getSlots(),
		persistence: state.coordinator.getPersistence(),
	};
	if (errorMessage !== undefined) result.error = errorMessage;
	return result;
}

function listSlots(state: PlayerState): CampaignResponse {
	if (!waitForLoad(state)) return response(state, false, "Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") {
		const now = os.clock();
		if (canAttemptRecovery(state.lastRecovery, now, RECOVERY_INTERVAL)) {
			state.lastRecovery = now;
			state.coordinator.recover();
		}
	}
	if (state.coordinator.getPersistence() === "unavailable") return response(state, false, "Campaign saves are temporarily unavailable.");
	return response(state, true);
}

function startMission(state: PlayerState, payload: unknown): CampaignResponse {
	const slot = typeIs(payload, "table") ? (payload as { slot?: unknown }).slot : undefined;
	if (!isValidSlot(slot)) return response(state, false, "Choose a valid campaign slot (1-4).");
	if (!waitForLoad(state)) return response(state, false, "Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") {
		return response(state, false, "Your cloud save could not be loaded; mission start is blocked to protect it.");
	}
	if (!combatService) return response(state, false, "Flight systems are not installed in this build.");

	const [sessionOk, existingSession] = pcall(() => combatService!.GetSession(state.player));
	if (!sessionOk) {
		warn(`SKYBREAK could not inspect combat session: ${tostring(existingSession)}`);
		return response(state, false, "Flight systems are temporarily unavailable.");
	}
	if (existingSession !== undefined || state.activeSlot !== undefined) return response(state, false, "A mission is already in progress.");

	const [startedCallOk, started, startError] = pcall(() => combatService!.StartMission(state.player, slot));
	if (!startedCallOk) {
		warn(`SKYBREAK mission start failed: ${tostring(started)}`);
		return response(state, false, "The mission could not be started.");
	}
	if (started !== true) return response(state, false, tostring(startError ?? "The mission could not be started."));

	state.activeSlot = slot;
	state.coordinator.recordMissionStarted(slot);
	return response(state, true);
}

function returnToMenu(state: PlayerState): CampaignResponse {
	state.activeSlot = undefined;
	if (!combatService) return response(state, true);
	const [success, errorMessage] = pcall(() => combatService!.EndMission(state.player));
	if (!success) {
		warn(`SKYBREAK mission cleanup failed: ${tostring(errorMessage)}`);
		return response(state, false, "The active flight could not be cleaned up.");
	}
	return response(state, true);
}

function handleRequest(player: Player, action: unknown, payload?: unknown): CampaignResponse {
	if (!typeIs(action, "string")) {
		const state = getState(player);
		return response(state, false, "Invalid campaign action.");
	}
	const state = getState(player);
	if (state.closing) return response(state, false, "Campaign session is closing.");

	const now = os.clock();
	if (now - state.lastRequest < REQUEST_INTERVAL) return response(state, false, "Please wait a moment before trying again.");
	state.lastRequest = now;
	if (state.requestBusy) return response(state, false, "Another campaign request is already in progress.");
	state.requestBusy = true;

	const [success, result] = xpcall(() => {
		if (action === "ListSlots") return listSlots(state);
		if (action === "StartMission") return startMission(state, payload);
		if (action === "ReturnToMenu") return returnToMenu(state);
		return response(state, false, "Unknown campaign action.");
	}, (errorValue) => debug.traceback(tostring(errorValue)));
	state.requestBusy = false;
	if (success) return result;
	warn(`SKYBREAK campaign request crashed: ${tostring(result)}`);
	return response(state, false, "Campaign service encountered an error.");
}

const onFinished: FinishedCallback = (player, won, stats) => {
	const state = states.get(player);
	if (!state || state.closing) return;
	const slotIndex = state.activeSlot;
	const recorded = completeMission(state.coordinator, slotIndex, won, stats, (message) => {
		if (player.Parent === Players) remotes!.MissionState.FireClient(player, message);
	});
	if (!recorded) {
		warn("SKYBREAK ignored a mission result that did not match the active server session");
		return;
	}
	state.activeSlot = undefined;
};

function shutdownPlayer(player: Player): void {
	const state = states.get(player);
	if (!state || state.closing) return;
	state.closing = true;
	state.activeSlot = undefined;
	if (combatService) pcall(() => combatService!.EndMission(player));
	if (state.loaded) state.coordinator.flush();
	states.delete(player);
}

export const CampaignService = {
	OnFinished: onFinished,
	Init(remoteTable: Remotes, combatModule?: CombatApi): void {
		assert(!initialized, "CampaignService.Init may only be called once");
		initialized = true;
		remotes = remoteTable;
		combatService = combatModule;

		remotes.CampaignRequest.OnServerInvoke = handleRequest;
		Players.PlayerAdded.Connect((player) => startLoading(getState(player)));
		Players.PlayerRemoving.Connect(shutdownPlayer);
		for (const player of Players.GetPlayers()) startLoading(getState(player));

		game.BindToClose(() => {
			let remaining = 0;
			for (const player of Players.GetPlayers()) {
				remaining++;
				task.spawn(() => {
					shutdownPlayer(player);
					remaining--;
				});
			}
			const deadline = os.clock() + 25;
			while (remaining > 0 && os.clock() < deadline) task.wait(0.1);
		});
	},
};
