import { Players } from "@rbxts/services";

/**
 * SKYBREAK flies a jet, never an avatar. The player's humanoid character is not
 * used for anything (the camera is scriptable in the menu and in flight, the
 * default controls are disabled, the server owns every aircraft and StreamingEnabled
 * is off), so no avatar is spawned at all: `Players.CharacterAutoLoads = false`.
 *
 * Why: the lobby airbase is destroyed and the terrain cleared when a mission world
 * is built, so an avatar standing on it fell past FallenPartsDestroyHeight, died,
 * respawned at the origin (now empty air or sea), fell and died again. Every death
 * showed Roblox's default red damage flash and an empty health bar.
 *
 * Should a character ever exist anyway (Studio tools, a future LoadCharacter), it
 * is hardened: anchored where it stands, immortal, and never in the Dead state.
 */

/** The parts of `Players` this policy touches, so tests can pass a stand-in. */
export interface CharacterPolicyPlayers {
	CharacterAutoLoads: boolean;
	GetPlayers(): ReadonlyArray<CharacterPolicyPlayer>;
	PlayerAdded: RBXScriptSignal<(player: CharacterPolicyPlayer) => void>;
}
/** The parts of `Player` this policy touches. */
export interface CharacterPolicyPlayer {
	Character?: Model;
	CharacterAdded: RBXScriptSignal<(character: Model) => void>;
}

function findHumanoid(character: Model): Humanoid | undefined {
	const humanoid = character.FindFirstChildOfClass("Humanoid") ?? character.FindFirstChild("Humanoid", true);
	return humanoid?.IsA("Humanoid") ? humanoid : undefined;
}

function lockHealth(humanoid: Humanoid): RBXScriptConnection {
	if (humanoid.MaxHealth <= 0) humanoid.MaxHealth = 100;
	humanoid.Health = humanoid.MaxHealth;
	return humanoid.HealthChanged.Connect((health) => {
		if (health < humanoid.MaxHealth) humanoid.Health = humanoid.MaxHealth;
	});
}

export const CharacterPolicy = {
	/**
	 * Never spawn avatars, and harden any that exist or appear regardless.
	 * Returns the live connections so a caller can disconnect them.
	 */
	Apply(players: CharacterPolicyPlayers = Players): RBXScriptConnection[] {
		players.CharacterAutoLoads = false;
		const connections: RBXScriptConnection[] = [];
		const keep = (added: RBXScriptConnection[]) => { for (const connection of added) connections.push(connection); };
		const watch = (player: CharacterPolicyPlayer) => {
			if (player.Character) keep(CharacterPolicy.Harden(player.Character));
			connections.push(player.CharacterAdded.Connect((character) => keep(CharacterPolicy.Harden(character))));
		};
		for (const player of players.GetPlayers()) watch(player);
		connections.push(players.PlayerAdded.Connect(watch));
		return connections;
	},
	/**
	 * Make an existing character harmless: it cannot fall (root anchored), cannot
	 * die (health locked, Dead state disabled, no joint breaking) and shows no
	 * health bar. Returns the connections that keep the health locked.
	 */
	Harden(character: Model): RBXScriptConnection[] {
		const connections: RBXScriptConnection[] = [];
		const humanoid = findHumanoid(character);
		if (humanoid) {
			humanoid.BreakJointsOnDeath = false;
			humanoid.RequiresNeck = false;
			humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
			humanoid.SetStateEnabled(Enum.HumanoidStateType.Dead, false);
			connections.push(lockHealth(humanoid));
		}
		for (const part of character.GetDescendants()) {
			if (!part.IsA("BasePart")) continue;
			if (part.Name === "HumanoidRootPart" || part === character.PrimaryPart) part.Anchored = true;
			part.CanTouch = false;
		}
		return connections;
	},
};
