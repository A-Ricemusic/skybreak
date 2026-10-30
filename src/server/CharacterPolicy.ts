import { Players } from "@rbxts/services";

/**
 * SKYBREAK flies a jet, never an avatar. The player's humanoid character is not
 * used for anything (the camera is scriptable in the menu and in flight, the
 * default controls are disabled, the server owns every aircraft and StreamingEnabled
 * is off), so no avatar is spawned at all: `Players.CharacterAutoLoads = false`,
 * set both in the place (default.project.json / test.project.json) and here.
 *
 * Why: the lobby airbase is destroyed and the terrain cleared when a mission world
 * is built, so an avatar standing on it fell past FallenPartsDestroyHeight, died,
 * respawned at the origin (now empty air or sea) and fell again at the next build
 * or teardown. Every death showed Roblox's default red damage flash and an empty
 * health bar.
 *
 * Should a character ever appear anyway (Studio tools, a future LoadCharacter), it
 * is removed. Destroying it is the only state in which nothing can damage it and
 * Roblox's health GUI has nothing to show; parking it alive would still leave a
 * client-owned Humanoid whose state the server cannot fully control.
 */

/** The parts of `Players` this policy touches, so tests can pass a stand-in. */
export interface CharacterPolicyPlayers {
	CharacterAutoLoads: boolean;
	GetPlayers(): ReadonlyArray<CharacterPolicyPlayer>;
	PlayerAdded: RBXScriptSignal<(player: CharacterPolicyPlayer) => void>;
	PlayerRemoving: RBXScriptSignal<(player: CharacterPolicyPlayer) => void>;
}
/** The parts of `Player` this policy touches. */
export interface CharacterPolicyPlayer {
	Character?: Model;
	CharacterAdded: RBXScriptSignal<(character: Model) => void>;
}

export const CharacterPolicy = {
	/**
	 * Never spawn avatars, and remove any that exist or appear regardless.
	 * Per-player connections are dropped when that player leaves; the returned
	 * connections are the service-level ones, for a caller that wants to stop.
	 */
	Apply(players: CharacterPolicyPlayers = Players): RBXScriptConnection[] {
		players.CharacterAutoLoads = false;
		const perPlayer = new Map<CharacterPolicyPlayer, RBXScriptConnection>();
		const watch = (player: CharacterPolicyPlayer) => {
			if (player.Character) CharacterPolicy.Remove(player, player.Character);
			perPlayer.get(player)?.Disconnect();
			perPlayer.set(player, player.CharacterAdded.Connect((character) => CharacterPolicy.Remove(player, character)));
		};
		for (const player of players.GetPlayers()) watch(player);
		return [
			players.PlayerAdded.Connect(watch),
			players.PlayerRemoving.Connect((player) => { perPlayer.get(player)?.Disconnect(); perPlayer.delete(player); }),
		];
	},
	/** Remove an unexpected character and clear the player's reference to it. */
	Remove(player: CharacterPolicyPlayer, character: Model): void {
		if (player.Character === character) player.Character = undefined;
		character.Destroy();
	},
};
