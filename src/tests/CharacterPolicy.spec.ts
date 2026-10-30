import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CharacterPolicy, CharacterPolicyPlayer, CharacterPolicyPlayers } from "../server/CharacterPolicy";

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
interface Fakes { players: CharacterPolicyPlayers; added: BindableEvent; removing: BindableEvent; list: CharacterPolicyPlayer[] }
function makePlayers(list: CharacterPolicyPlayer[]): Fakes {
	const added = new Instance("BindableEvent");
	const removing = new Instance("BindableEvent");
	garbage.push(added, removing);
	return { added, removing, list, players: { CharacterAutoLoads: true, GetPlayers() { return list; }, PlayerAdded: added.Event as never, PlayerRemoving: removing.Event as never } };
}
function makePlayer(character?: Model): { player: CharacterPolicyPlayer; characterAdded: BindableEvent } {
	const characterAdded = new Instance("BindableEvent");
	garbage.push(characterAdded);
	return { player: { Character: character, CharacterAdded: characterAdded.Event as never }, characterAdded };
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
		task.wait();
		expect(later.Parent).toBeUndefined();
		expect(present.player.Character).toBeUndefined();
		added.Fire(joiner.player);
		task.wait();
		joiner.player.Character = future;
		joiner.characterAdded.Fire(future);
		task.wait();
		expect(future.Parent).toBeUndefined();
		expect(joiner.player.Character).toBeUndefined();
	});
	it("stops watching a player who leaves", () => {
		const leaver = makePlayer();
		const { players, removing } = makePlayers([leaver.player]);
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		removing.Fire(leaver.player);
		task.wait();
		const afterLeaving = makeCharacter();
		garbage.push(afterLeaving);
		leaver.player.Character = afterLeaving;
		leaver.characterAdded.Fire(afterLeaving);
		task.wait();
		// No longer watched: the policy leaves this player alone (Roblox has already dropped them).
		expect(afterLeaving.Parent).toBeDefined();
		expect(leaver.player.Character).toBe(afterLeaving);
	});
});
