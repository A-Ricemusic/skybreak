/**
 * Roblox's default CoreGui for a humanoid: the top-right health bar, the red
 * damage flash (both `CoreGuiType.Health`), the backpack hotbar and the reset
 * button. SKYBREAK draws its own jet HUD, so all of them are turned off.
 *
 * Lives in shared so the Roblox Jest suite can exercise it; only the client calls it.
 *
 * `SetCoreGuiEnabled` and `SetCore` can throw before the CoreScripts have
 * registered, so every call is retried on its own until it succeeds.
 */

/** The parts of `StarterGui` the policy calls, so tests can pass a stand-in. */
export interface CoreGuiTarget {
	SetCoreGuiEnabled(kind: Enum.CoreGuiType, enabled: boolean): void;
	SetCore(parameter: string, value: unknown): void;
}
export interface CoreGuiPolicyResult { health: boolean; backpack: boolean; resetButton: boolean; attempts: number }

/** Core GUIs hidden for the whole session. */
const HIDDEN: ReadonlyArray<Enum.CoreGuiType> = [Enum.CoreGuiType.Health, Enum.CoreGuiType.Backpack];
const ATTEMPTS = 40;
const RETRY_SECONDS = 0.25;

export const CoreGuiPolicy = {
	Hidden: HIDDEN,
	Attempts: ATTEMPTS,
	RetrySeconds: RETRY_SECONDS,
	/**
	 * Hide the health bar and damage flash, the backpack and the reset button.
	 * `wait` is called between attempts; the result says what succeeded.
	 */
	Apply(target: CoreGuiTarget, wait: (seconds: number) => unknown = (seconds) => task.wait(seconds)): CoreGuiPolicyResult {
		const result: CoreGuiPolicyResult = { health: false, backpack: false, resetButton: false, attempts: 0 };
		const done = () => result.health && result.backpack && result.resetButton;
		while (!done() && result.attempts < ATTEMPTS) {
			if (result.attempts > 0) wait(RETRY_SECONDS);
			result.attempts++;
			if (!result.health) result.health = pcall(() => target.SetCoreGuiEnabled(Enum.CoreGuiType.Health, false))[0];
			if (!result.backpack) result.backpack = pcall(() => target.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false))[0];
			if (!result.resetButton) result.resetButton = pcall(() => target.SetCore("ResetButtonCallback", false))[0];
		}
		return result;
	},
};
