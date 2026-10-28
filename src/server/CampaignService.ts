import { CampaignRequestBudget } from "./CampaignRequestBudget";
import { DataStoreService, Players, RunService } from "@rbxts/services";
import { GameConfig } from "../shared/GameConfig";
import { MISSION_COUNT } from "../shared/MissionCatalog";
import { CampaignResponse, FinishedCallback, Remotes } from "../shared/Types";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { Difficulty } from "../shared/Difficulty";
import {
	CampaignCoordinator,
	CampaignStore,
	canAttemptRecovery,
	completeMission,
	isValidSlot,
	resolveMissionRequest,
	StoredProfile,
} from "./CampaignRepository";

interface CombatApi {
	StartMission(player: Player, slot: number, missionId?: number, special?: unknown, difficulty?: unknown): LuaTuple<[boolean, string?]>;
	EndMission(player: Player): void;
	GetSession(player: Player): unknown;
}

interface PlayerState {
	readonly player: Player;
	readonly coordinator: CampaignCoordinator;
	loaded: boolean;
	loadStarted: boolean;
	activeSlot?: number;
	activeMission?: number;
	requestBusy: boolean;
	budget: CampaignRequestBudget;
	lastRecovery: number;
	closing: boolean;
}

const LOAD_TIMEOUT = 20;
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
		budget: new CampaignRequestBudget(),
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

function response(state: PlayerState): CampaignResponse {
	return {
		ok: true,
		deletions: state.coordinator.getDeletions(),
		slots: state.coordinator.getSlots(),
		persistence: state.coordinator.getPersistence(),
	};
}

/** Refusals carry only the error; the client discards every other field when ok is not true. */
function refuse(message: string): CampaignResponse {
	return { ok: false, error: message };
}

function listSlots(state: PlayerState): CampaignResponse {
	if (!waitForLoad(state)) return refuse("Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") {
		const now = os.clock();
		if (canAttemptRecovery(state.lastRecovery, now, RECOVERY_INTERVAL)) {
			state.lastRecovery = now;
			state.coordinator.recover();
		}
	}
	if (state.coordinator.getPersistence() === "unavailable") return refuse("Campaign saves are temporarily unavailable.");
	return response(state);
}

function startMission(state: PlayerState, payload: unknown): CampaignResponse {
	const slot = typeIs(payload, "table") ? (payload as { slot?: unknown }).slot : undefined;
	const requestedMission = typeIs(payload, "table") ? (payload as { missionId?: unknown }).missionId : undefined;
	const requestedSpecial = typeIs(payload, "table") ? (payload as { special?: unknown }).special : undefined;
	const requestedDifficulty = typeIs(payload, "table") ? (payload as { difficulty?: unknown }).difficulty : undefined;
	if (!isValidSlot(slot)) return refuse("Choose a valid campaign slot (1-4).");
	if (!waitForLoad(state)) return refuse("Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") {
		return refuse("Your cloud save could not be loaded; mission start is blocked to protect it.");
	}
	if (!combatService) return refuse("Flight systems are not installed in this build.");
	const saveSlot = state.coordinator.getSlots()[slot - 1];
	const [missionId, missionError] = resolveMissionRequest(saveSlot, requestedMission);
	if (missionId === undefined) return refuse(missionError ?? "Choose a valid mission.");
	if (requestedSpecial !== undefined && !SpecialWeapons.IsKind(requestedSpecial)) return refuse("Choose a valid special weapon.");
	// No choice sent: the slot's last loadout, then the default.
	const special = SpecialWeapons.IsKind(requestedSpecial) ? requestedSpecial : SpecialWeapons.IsKind(saveSlot.special) ? saveSlot.special : SpecialWeapons.Default;
	if (requestedDifficulty !== undefined && !Difficulty.IsKind(requestedDifficulty)) return refuse("Choose a valid difficulty.");
	const difficulty = Difficulty.IsKind(requestedDifficulty) ? requestedDifficulty : Difficulty.IsKind(saveSlot.difficulty) ? saveSlot.difficulty : Difficulty.Default;

	const [sessionOk, existingSession] = pcall(() => combatService!.GetSession(state.player));
	if (!sessionOk) {
		warn(`SKYBREAK could not inspect combat session: ${tostring(existingSession)}`);
		return refuse("Flight systems are temporarily unavailable.");
	}
	if (existingSession !== undefined || state.activeSlot !== undefined || state.activeMission !== undefined) return refuse("A mission is already in progress.");

	const [startedCallOk, started, startError] = pcall(() => combatService!.StartMission(state.player, slot, missionId, special, difficulty));
	if (!startedCallOk) {
		warn(`SKYBREAK mission start failed: ${tostring(started)}`);
		return refuse("The mission could not be started.");
	}
	if (started !== true) return refuse(tostring(startError ?? "The mission could not be started."));

	state.activeSlot = slot;
	state.activeMission = missionId;
	state.coordinator.recordMissionStarted(slot, missionId, special, difficulty);
	// The briefing chapter for this mission plays once per slot; retries and replays launch directly.
	state.coordinator.recordCutsceneSeen(slot, missionId - 1);
	return response(state);
}

function deleteSlot(state: PlayerState, payload: unknown): CampaignResponse {
	const slot = typeIs(payload, "table") ? (payload as { slot?: unknown }).slot : undefined;
	if (!isValidSlot(slot)) return refuse("Choose a valid campaign slot (1-4).");
	if (!waitForLoad(state)) return refuse("Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") return refuse("Campaign saves are temporarily unavailable.");
	if (state.activeSlot !== undefined || state.activeMission !== undefined) return refuse("Finish the current mission before deleting a save.");
	state.coordinator.deleteSlot(slot);
	// Bound the wait; response.deletions reports actual confirmation even if this times out.
	// ok means local acceptance, never durable cloud success.
	state.coordinator.flush();
	return response(state);
}

function returnToMenu(state: PlayerState): CampaignResponse {
	state.activeSlot = undefined;
	state.activeMission = undefined;
	if (!combatService) return response(state);
	const [success, errorMessage] = pcall(() => combatService!.EndMission(state.player));
	if (!success) {
		warn(`SKYBREAK mission cleanup failed: ${tostring(errorMessage)}`);
		return refuse("The active flight could not be cleaned up.");
	}
	return response(state);
}

function handleRequest(player: Player, action: unknown, payload?: unknown): CampaignResponse {
	// Never create state here: a late invoke after PlayerRemoving must not start a fresh load.
	const state = states.get(player);
	if (!state || state.closing) return refuse("Campaign session is closing.");
	// Rate-limit before validating, so malformed requests spend budget too.
	if (!state.budget.accept(os.clock(), typeIs(action, "string") && action === "DeletionStatus")) return refuse("Please wait a moment before trying again.");
	if (!typeIs(action, "string")) return refuse("Invalid campaign action.");
	// No yielding load/recovery, queue ownership or foreground timestamp changes for observations.
	if (action === "DeletionStatus") {
		if (!state.loaded) return refuse("Campaign data is still loading. Please try again.");
		return response(state);
	}
	if (state.requestBusy) return refuse("Another campaign request is already in progress.");
	state.requestBusy = true;

	const [success, result] = xpcall(() => {
		if (action === "ListSlots") return listSlots(state);
		if (action === "StartMission") return startMission(state, payload);
		if (action === "ReturnToMenu") return returnToMenu(state);
		if (action === "DeleteSlot") return deleteSlot(state, payload);
		return refuse("Unknown campaign action.");
	}, (errorValue) => debug.traceback(tostring(errorValue)));
	state.requestBusy = false;
	if (success) return result;
	warn(`SKYBREAK campaign request crashed: ${tostring(result)}`);
	return refuse("Campaign service encountered an error.");
}

const onFinished: FinishedCallback = (player, won, stats) => {
	const state = states.get(player);
	if (!state || state.closing) return;
	const slotIndex = state.activeSlot;
	const missionId = state.activeMission;
	const recorded = completeMission(state.coordinator, slotIndex, missionId, won, stats, (message) => {
		// Winning the finale unlocks and marks its closing chapter.
		if (message.kind === "Completed" && message.missionId === MISSION_COUNT && slotIndex !== undefined) state.coordinator.recordCutsceneSeen(slotIndex, MISSION_COUNT);
		if (player.Parent === Players) remotes!.MissionState.FireClient(player, message);
	});
	if (!recorded) {
		warn("SKYBREAK did not record a mission result that did not match the active server session");
		// Still end the client's flight on a result screen instead of a frozen HUD. Nothing was saved or
		// unlocked, so it must never read as a win (no rank, NEXT, or finale cinematic).
		if (player.Parent === Players) remotes!.MissionState.FireClient(player, {
			kind: "Failed", ...stats, reason: "not_recorded", saved: false, persistence: state.coordinator.getPersistence(),
		});
		return;
	}
	state.activeSlot = undefined;
	state.activeMission = undefined;
};

function shutdownPlayer(player: Player): void {
	const state = states.get(player);
	if (!state || state.closing) return;
	state.closing = true;
	state.activeSlot = undefined;
	state.activeMission = undefined;
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
