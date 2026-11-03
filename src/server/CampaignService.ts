import { awaitResultSettlement } from "../shared/ResultContinuation";
import { encodeCampaignSlot } from "../shared/CampaignWire";
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
	IsCompleting(player: Player): boolean;
	StartMission(player: Player, slot: number, missionId?: number, special?: unknown, difficulty?: unknown, launchId?: number): LuaTuple<[boolean, string?]>;
	EndMission(player: Player): void;
	CancelLaunch(player: Player, launchId: number): void;
	GetSession(player: Player): unknown;
}

interface PlayerState {
	readonly player: Player;
	readonly coordinator: CampaignCoordinator;
	loaded: boolean;
	loadStarted: boolean;
	activeSlot?: number;
	activeMission?: number;
	activeLaunchId?: number;
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
		slots: state.coordinator.getSlots().map(encodeCampaignSlot),
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
	const playedChapter = typeIs(payload, "table") ? (payload as { playedChapter?: unknown }).playedChapter : undefined;
	const requestedMission = typeIs(payload, "table") ? (payload as { missionId?: unknown }).missionId : undefined;
	const launchId = typeIs(payload, "table") ? (payload as { launchId?: unknown }).launchId : undefined;
	if (launchId !== undefined && (!typeIs(launchId, "number") || launchId !== launchId || launchId < 1 || launchId > 1e9 || launchId % 1 !== 0)) return refuse("Invalid launch generation.");
	const requestedSpecial = typeIs(payload, "table") ? (payload as { special?: unknown }).special : undefined;
	const requestedDifficulty = typeIs(payload, "table") ? (payload as { difficulty?: unknown }).difficulty : undefined;
	if (!isValidSlot(slot)) return refuse("Choose a valid campaign slot (1-4).");
	if (!waitForLoad(state)) return refuse("Campaign data is still loading. Please try again.");
	if (state.coordinator.getPersistence() === "unavailable") {
		return refuse("Your cloud save could not be loaded; mission start is blocked to protect it.");
	}
	if (!combatService) return refuse("Flight systems are not installed in this build.");
	// Results can arrive before settlement releases its session. Keep this RPC pending
	// (client is on the loading screen), then use fresh authoritative progression.
	if (!awaitResultSettlement({
		completing: () => combatService!.IsCompleting(state.player),
		present: () => !state.closing && state.player.Parent === Players,
		now: () => os.clock(),
		wait: () => { task.wait(); },
	})) return refuse("Your mission result is still settling. Please retry the launch.");
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

	const [startedCallOk, started, startError] = pcall(() => combatService!.StartMission(state.player, slot, missionId, special, difficulty, launchId));
	if (!startedCallOk) {
		warn(`SKYBREAK mission start failed: ${tostring(started)}`);
		return refuse("The mission could not be started.");
	}
	if (started !== true) return refuse(tostring(startError ?? "The mission could not be started."));

	state.activeLaunchId = launchId;
	state.activeSlot = slot;
	state.activeMission = missionId;
	state.coordinator.recordMissionStarted(slot, missionId, special, difficulty);
	// A launch alone never implies the story was shown. Bind acknowledgement to the resolved, unlocked mission.
	state.coordinator.acknowledgeChapter(slot, missionId, playedChapter);
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
	state.activeLaunchId = undefined;
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
	// A timeout must be able to cancel a yielding StartMission without releasing its world/build lock (rate-limited like every request).
	if (action === "CancelLaunch") {
		const launchId = typeIs(payload, "table") ? (payload as { launchId?: unknown }).launchId : undefined;
		if (!typeIs(launchId, "number") || launchId !== launchId || launchId < 1 || launchId > 1e9 || launchId % 1 !== 0) return refuse("Invalid launch generation.");
		combatService?.CancelLaunch(player, launchId);
		if (state.activeLaunchId === launchId) { state.activeLaunchId = undefined; state.activeSlot = undefined; state.activeMission = undefined; }
		return { ok: true };
	}
	if (!typeIs(action, "string")) return refuse("Invalid campaign action.");
	// No yielding load/recovery, queue ownership or foreground timestamp changes for observations.
	if (action === "DeletionStatus") {
		if (!state.loaded) return refuse("Campaign data is still loading. Please try again.");
		return response(state);
	}
	if (state.requestBusy) return refuse(action === "StartMission" ? "The previous launch is still preparing. Please wait before retrying." : "Another campaign request is already in progress.");
	state.requestBusy = true;

	const [success, result] = xpcall(() => {
		if (action === "ListSlots") return listSlots(state);
		if (action === "StartMission") return startMission(state, payload);
		if (action === "FinishFinale") {
			const slot = typeIs(payload, "table") ? (payload as { slot?: unknown }).slot : undefined;
			if (!isValidSlot(slot) || !waitForLoad(state) || !state.coordinator.acknowledgeChapter(slot, MISSION_COUNT, MISSION_COUNT)) return refuse("Complete the finale before recording its chapter.");
			return response(state);
		}
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

/** Test-place-only registration: no DataStores, PlayerAdded connections or RPC replacement.
 * Requests still enter the exact handler installed as CampaignRequest.OnServerInvoke.
 */
export function installCampaignSmokePlayer(player: Player, coordinator: CampaignCoordinator, transport: Remotes, combat: CombatApi) {
 assert(RunService.IsStudio() && game.Workspace.GetAttribute("SkybreakTestMode") === true, "Test place only");
 assert(!initialized && states.size() === 0, "Campaign service must be uninitialized");
 const previous = { remotes, combatService };
 remotes = transport; combatService = combat;
 states.set(player, { player, coordinator, loaded: true, loadStarted: true, requestBusy: false,
  budget: new CampaignRequestBudget(), lastRecovery: -math.huge, closing: false });
 return {
  request: (action: string, payload?: unknown) => handleRequest(player, action, payload),
  recover: (missionId: number) => {
   assert(RunService.IsStudio() && game.Workspace.GetAttribute("SkybreakTestMode") === true, "Test place only");
   assert(!combat.IsCompleting(player) && combat.GetSession(player) === undefined, "Release sortie before smoke recovery");
   const state = states.get(player)!;
   state.activeSlot = undefined; state.activeMission = undefined; state.activeLaunchId = undefined;
   // Use repository validation and derived unlocks; never alter a cloud-backed profile.
   assert(coordinator.getPersistence() === "session", "Smoke recovery requires session-only persistence");
   for (let id = 1; id <= missionId; id++) coordinator.recordMissionResult(1, id, true, 0, 30);
   state.budget = new CampaignRequestBudget();
  },
  restore: () => { states.delete(player); remotes = previous.remotes; combatService = previous.combatService; },
 };
}
