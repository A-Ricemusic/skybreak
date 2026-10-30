import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CharacterPolicy, CharacterPolicyPlayer, CharacterPolicyPlayers } from "../server/CharacterPolicy";

/**
 * In-memory signal with reference semantics. A BindableEvent must not stand in for
 * Players.PlayerAdded here: it deep-copies table arguments when fired, so the policy
 * would receive copies of the fake players and its per-player bookkeeping (a Map keyed by
 * player, clearing `player.Character`) could never be observed. Real players are Instances,
 * which Roblox signals pass by reference, exactly as this fake does.
 */
class FakeSignal<T extends unknown[]> {
	private handlers = new Map<number, (...args: T) => void>();
	private serial = 0;
	Connect(handler: (...args: T) => void): RBXScriptConnection {
		const id = ++this.serial;
		this.handlers.set(id, handler);
		const connection = { Connected: true, Disconnect: () => { connection.Connected = false; this.handlers.delete(id); } };
		return connection as unknown as RBXScriptConnection;
	}
	Fire(...args: T): void { for (const [, handler] of this.handlers) handler(...args); }
	Count(): number { return this.handlers.size(); }
	AsSignal(): RBXScriptSignal<(...args: T) => void> { return this as unknown as RBXScriptSignal<(...args: T) => void>; }
}

function makeCharacter(): Model {
	const character = new Instance("Model");
	character.Name = "TestAvatar";
	const root = new Instance("Part");
	root.Name = "HumanoidRootPart";
	root.Parent = character;
	character.PrimaryPart = root;
	const humanoid = new Instance("Humanoid");
	humanoid.Parent = character;
	character.Parent = game.GetService("ServerStorage");
	return character;
}
interface Fakes { players: CharacterPolicyPlayers; added: FakeSignal<[CharacterPolicyPlayer]>; removing: FakeSignal<[CharacterPolicyPlayer]> }
function makePlayers(list: CharacterPolicyPlayer[]): Fakes {
	const added = new FakeSignal<[CharacterPolicyPlayer]>();
	const removing = new FakeSignal<[CharacterPolicyPlayer]>();
	return { added, removing, players: { CharacterAutoLoads: true, GetPlayers() { return list; }, PlayerAdded: added.AsSignal(), PlayerRemoving: removing.AsSignal() } };
}
function makePlayer(character?: Model): { player: CharacterPolicyPlayer; characterAdded: FakeSignal<[Model]> } {
	const characterAdded = new FakeSignal<[Model]>();
	return { player: { Character: character, CharacterAdded: characterAdded.AsSignal() }, characterAdded };
}

const garbage: Instance[] = [];
const live: RBXScriptConnection[] = [];
afterEach(() => {
	for (const connection of live) connection.Disconnect();
	live.clear();
	for (const item of garbage) item.Destroy();
	garbage.clear();
});

describe("CharacterPolicy", () => {
	it("turns automatic character loading off", () => {
		const { players } = makePlayers([]);
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		expect(players.CharacterAutoLoads).toBe(false);
	});
	it("removes a character and clears the player's reference", () => {
		const character = makeCharacter();
		garbage.push(character);
		const { player } = makePlayer(character);
		CharacterPolicy.Remove(player, character);
		expect(player.Character).toBeUndefined();
		expect(character.Parent).toBeUndefined();
	});
	it("removes characters that already exist and any added later, for present and future players", () => {
		const existing = makeCharacter();
		const later = makeCharacter();
		const future = makeCharacter();
		garbage.push(existing, later, future);
		const present = makePlayer(existing);
		const joiner = makePlayer();
		const { players, added } = makePlayers([present.player]);
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		expect(existing.Parent).toBeUndefined();
		expect(present.player.Character).toBeUndefined();
		expect(later.Parent).toBeDefined();
		present.player.Character = later;
		present.characterAdded.Fire(later);
		expect(later.Parent).toBeUndefined();
		expect(present.player.Character).toBeUndefined();
		added.Fire(joiner.player);
		expect(joiner.characterAdded.Count()).toBe(1);
		joiner.player.Character = future;
		joiner.characterAdded.Fire(future);
		expect(future.Parent).toBeUndefined();
		expect(joiner.player.Character).toBeUndefined();
	});
	it("stops watching a player who leaves", () => {
		const leaver = makePlayer();
		const { players, removing } = makePlayers([leaver.player]);
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		expect(leaver.characterAdded.Count()).toBe(1);
		removing.Fire(leaver.player);
		expect(leaver.characterAdded.Count()).toBe(0);
		const afterLeaving = makeCharacter();
		garbage.push(afterLeaving);
		leaver.player.Character = afterLeaving;
		leaver.characterAdded.Fire(afterLeaving);
		// No longer watched: the policy leaves this player alone (Roblox has already dropped them).
		expect(afterLeaving.Parent).toBeDefined();
		expect(leaver.player.Character).toBe(afterLeaving);
	});
});
