import { ac04CaptureCompletion } from "./AC04Completion";
import { AC04Persistence, AC04PersistenceState } from "./AC04Persistence";
import { ac04Aircraft } from "../shared/AC04Aircraft";
import { DataStoreService, Players, RunService, ReplicatedStorage } from "@rbxts/services";
import { AC04_AIRCRAFT, AC04Response, ac04BlankProfile, ac04Finite, ac04MissionAvailable, ac04Unlocked, ac04ValidMission } from "../shared/AC04Progress";
import { AC04Story } from "../shared/ac04/AC04Story";
import { CampaignRequestBudget } from "./CampaignRequestBudget";
import { MissionStats, Remotes } from "../shared/Types";

interface CombatApi {
	StartMission(player: Player, slot: number, missionId: number, aircraftType?: string): LuaTuple<[boolean, string?]>;
	EndMission(player: Player): void;
	GetSession(player: Player): { campaignId?: string; finished?: boolean } | undefined;
}
interface State extends AC04PersistenceState {
	busy: boolean; budget: CampaignRequestBudget;
	active?: { slot: number; mission: number };
}
const states = new Map<Player, State>();
let combat: CombatApi;
let remotes: Remotes;
let store: DataStore | undefined;
/** Acquire only inside a guarded cloud operation; unpublished Studio stays session-only. */
function cloudStore(): DataStore {
	if (store === undefined) store = DataStoreService.GetDataStore("SkybreakAC04Fresh_20261027_v1");
	return store;
}
function stateFor(player: Player): State {
	let state = states.get(player);
	if (!state) {
		const sessionOnly = RunService.IsStudio() && game.GameId === 0;
		state = { profile: ac04BlankProfile(), loaded: sessionOnly, loading: false, busy: false, saving: false, dirty: false, closing: false,
			persistence: sessionOnly ? "session" : "unavailable", budget: new CampaignRequestBudget() };
		states.set(player, state);
	}
	return state;
}
const persistence = new AC04Persistence<Player>({
	get(player) { return cloudStore().GetAsync(`player_${player.UserId}`)[0]; },
	update(player, transform) { return cloudStore().UpdateAsync(`player_${player.UserId}`, (current) => $tuple(transform(current)))[0]; },
	present(player, state) { return player.Parent === Players && states.get(player) === state; },
	now() { return os.clock(); }, wait(seconds) { task.wait(seconds); }, warn(message) { warn(message); },
});
const load = (player: Player, state: State) => persistence.load(player, state);
const save = (player: Player, state: State) => persistence.save(player, state);
const drain = (player: Player, state: State, deadline: number) => persistence.drain(player, state, deadline);
function response(state: State): AC04Response { return { ok: true, slots: state.profile.slots, persistence: state.persistence }; }
const fail = (message: string): AC04Response => ({ ok: false, error: message });
function request(player: Player, action: unknown, raw?: unknown): AC04Response {
	if (player.Parent !== Players) return fail("Campaign session is closing.");
	const state = stateFor(player);
	if (state.closing || state.busy || !state.budget.accept(os.clock(), false)) return fail("Please wait for the current campaign operation.");
	if (!typeIs(action, "string")) return fail("Invalid campaign action.");
	state.busy = true;
	const [ok, result] = pcall((): AC04Response => {
		if (!load(player, state)) return fail("AC04 records could not be loaded. Existing saves are protected; retry shortly.");
		if (action === "ListSlots") { if (state.dirty && state.persistence === "cloud" && !save(player, state)) return fail("AC04 records could not be saved. Existing saves are protected; retry shortly."); return response(state); }
		if (action === "ReturnToMenu") {
			const session = combat.GetSession(player);
			if (session?.finished) return fail("Please wait for the sortie result.");
			// A failed save must leave the live sortie intact, matching the client's retry state.
			if (state.dirty && state.persistence === "cloud" && !save(player, state)) return fail("AC04 records could not be saved. Existing saves are protected; retry shortly.");
			if (state.closing || player.Parent !== Players || states.get(player) !== state) return fail("Campaign session is closing.");
			if (session?.finished) return fail("Please wait for the sortie result.");
			if (session?.campaignId === "ac04") combat.EndMission(player);
			state.active = undefined;
			return response(state);
		}
		if (!typeIs(raw, "table")) return fail("Invalid campaign request.");
		const payload = raw as { slot?: unknown; missionId?: unknown; aircraft?: unknown; chapterId?: unknown };
		if (!ac04Finite(payload.slot) || payload.slot % 1 !== 0 || payload.slot < 1 || payload.slot > 4) return fail("Choose a flight record from 1 to 4.");
		const slot = state.profile.slots[payload.slot - 1];
		if (action === "StorySeen") {
			const chapter = AC04Story.find((c) => c.id === payload.chapterId);
			if (!chapter) return fail("Unknown story chapter.");
			const trigger = chapter.trigger;
			const required = trigger.event === "epilogue" ? 18 : trigger.event === "afterMissionSuccess" ? trigger.missionId : undefined;
			if (required !== undefined && !slot.missions[required]?.completed) return fail("That chapter is not yet unlocked.");
			if (!slot.seen.includes(chapter.id)) { slot.seen.push(chapter.id); slot.updatedAt = os.time(); state.dirty = true; }
			return response(state);
		}
		if (action !== "StartMission") return fail("Unknown campaign action.");
		if (state.active || combat.GetSession(player)) return fail("Finish the active sortie first.");
		const mission = payload.missionId;
		if (!ac04ValidMission(mission)) return fail("Complete the preceding mission before launching this sortie.");
		if (!ac04MissionAvailable(mission)) return fail("That mission is in preparation for a future release.");
		if (mission > ac04Unlocked(slot)) return fail("Complete the preceding mission before launching this sortie.");
		const aircraft = payload.aircraft ?? slot.aircraft;
		if (!typeIs(aircraft, "string") || !AC04_AIRCRAFT.includes(aircraft)) return fail("Choose a valid aircraft.");
		if (ac04Aircraft(aircraft).afterMission > 0 && !slot.missions[ac04Aircraft(aircraft).afterMission]?.completed) return fail("That aircraft is not yet available in this flight record.");
		const [started, startError] = combat.StartMission(player, payload.slot, mission, aircraft);
		if (state.closing || player.Parent !== Players || states.get(player) !== state) { if (combat.GetSession(player)?.campaignId === "ac04") combat.EndMission(player); return fail("Campaign session is closing."); }
		if (!started) return fail(startError ?? "The mission could not be launched.");
		state.active = { slot: payload.slot, mission }; slot.aircraft = aircraft; slot.updatedAt = os.time(); state.dirty = true;
		return response(state);
	});
	state.busy = false;
	if (!ok) { warn(`AC04 campaign request failed: ${tostring(result)}`); return fail("The campaign operation failed. Please retry."); }
	return result;
}
export const AC04CampaignService = {
	OnFinished(player: Player, won: boolean, stats: MissionStats): (() => void) | undefined {
		const state = states.get(player); if (!state) return;
		const valid = ac04CaptureCompletion(state, won, stats, os.time());
		if (valid === undefined) return;
		// CombatService retains its settlement/admission lock until this work returns.
		return () => {
			const saved = won && valid ? (state.persistence === "cloud" && !state.dirty) || save(player, state) : false;
			if (player.Parent === Players) remotes.MissionState.FireClient(player, { ...stats, kind: won && valid ? "Completed" : "Failed", reason: valid ? stats.reason : "invalid_campaign_result", saved, persistence: state.persistence });
		};
	},
	Init(remoteTable: Remotes, combatApi: CombatApi): void {
		remotes = remoteTable; combat = combatApi;
		const folder = ReplicatedStorage.WaitForChild("Remotes");
		const requestRemote = new Instance("RemoteFunction"); requestRemote.Name = "AC04Request"; requestRemote.Parent = folder;
		requestRemote.OnServerInvoke = request;
		Players.PlayerRemoving.Connect((player) => {
			const state = states.get(player); if (!state) return;
			state.closing = true; drain(player, state, os.clock() + 20); states.delete(player);
		});
		game.BindToClose(() => {
			let pending = 0;
			for (const [player, state] of states) { state.closing = true; if (state.dirty || state.saving) { pending++; task.spawn(() => { drain(player, state, os.clock() + 23); pending--; }); } }
			const deadline = os.clock() + 25; while (pending > 0 && os.clock() < deadline) task.wait(0.1);
		});
	},
};
