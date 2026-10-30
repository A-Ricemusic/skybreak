import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { CharacterPolicy, CharacterPolicyPlayer, CharacterPolicyPlayers } from "../server/CharacterPolicy";

function makeCharacter(): { character: Model; humanoid: Humanoid; root: Part } {
	const character = new Instance("Model");
	character.Name = "TestAvatar";
	const root = new Instance("Part");
	root.Name = "HumanoidRootPart";
	root.Parent = character;
	const head = new Instance("Part");
	head.Name = "Head";
	head.Parent = character;
	character.PrimaryPart = root;
	const humanoid = new Instance("Humanoid");
	humanoid.MaxHealth = 100;
	humanoid.Health = 100;
	humanoid.Parent = character;
	return { character, humanoid, root };
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
		const added = new Instance("BindableEvent");
		garbage.push(added);
		const players: CharacterPolicyPlayers = { CharacterAutoLoads: true, GetPlayers() { return []; }, PlayerAdded: added.Event as never };
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		expect(players.CharacterAutoLoads).toBe(false);
	});
	it("hardens a character: anchored root, locked health, no Dead state, no joint breaking", () => {
		const { character, humanoid, root } = makeCharacter();
		garbage.push(character);
		humanoid.BreakJointsOnDeath = true;
		humanoid.RequiresNeck = true;
		for (const c of CharacterPolicy.Harden(character)) live.push(c);
		expect(root.Anchored).toBe(true);
		expect(humanoid.BreakJointsOnDeath).toBe(false);
		expect(humanoid.RequiresNeck).toBe(false);
		expect(humanoid.GetStateEnabled(Enum.HumanoidStateType.Dead)).toBe(false);
		expect(humanoid.HealthDisplayType).toBe(Enum.HumanoidHealthDisplayType.AlwaysOff);
		humanoid.Health = 0;
		task.wait();
		expect(humanoid.Health).toBe(humanoid.MaxHealth);
		humanoid.TakeDamage(40);
		task.wait();
		expect(humanoid.Health).toBe(humanoid.MaxHealth);
	});
	it("hardens characters that already exist and any added later for present and future players", () => {
		const existing = makeCharacter();
		const later = makeCharacter();
		const future = makeCharacter();
		const added = new Instance("BindableEvent");
		const existingAdded = new Instance("BindableEvent");
		const futureAdded = new Instance("BindableEvent");
		garbage.push(existing.character, later.character, future.character, added, existingAdded, futureAdded);
		const presentPlayer: CharacterPolicyPlayer = { Character: existing.character, CharacterAdded: existingAdded.Event as never };
		const futurePlayer: CharacterPolicyPlayer = { CharacterAdded: futureAdded.Event as never };
		const players: CharacterPolicyPlayers = { CharacterAutoLoads: true, GetPlayers() { return [presentPlayer]; }, PlayerAdded: added.Event as never };
		for (const c of CharacterPolicy.Apply(players)) live.push(c);
		expect(existing.root.Anchored).toBe(true);
		expect(later.root.Anchored).toBe(false);
		existingAdded.Fire(later.character);
		task.wait();
		expect(later.root.Anchored).toBe(true);
		expect(later.humanoid.GetStateEnabled(Enum.HumanoidStateType.Dead)).toBe(false);
		added.Fire(futurePlayer);
		task.wait();
		futureAdded.Fire(future.character);
		task.wait();
		expect(future.root.Anchored).toBe(true);
		expect(future.humanoid.GetStateEnabled(Enum.HumanoidStateType.Dead)).toBe(false);
	});
	it("tolerates a character without a humanoid", () => {
		const character = new Instance("Model");
		const part = new Instance("Part");
		part.Name = "HumanoidRootPart";
		part.Parent = character;
		garbage.push(character);
		expect(CharacterPolicy.Harden(character).size()).toBe(0);
		expect(part.Anchored).toBe(true);
	});
});
