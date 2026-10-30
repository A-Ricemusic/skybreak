/**
 * Roblox's default CoreGui for a humanoid: the top-right health bar and the red
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
export interface CoreGuiPolicyResult {
	/** Core GUIs confirmed hidden. */
	hidden: Set<Enum.CoreGuiType>;
	resetButton: boolean;
	/** Everything in `Hidden` plus the reset button succeeded. */
	complete: boolean;
	attempts: number;
}

/** Core GUIs hidden for the whole session. */
const HIDDEN: ReadonlyArray<Enum.CoreGuiType> = [Enum.CoreGuiType.Health, Enum.CoreGuiType.Backpack];
const ATTEMPTS = 40;
const RETRY_SECONDS = 0.25;

export const CoreGuiPolicy = {
	Hidden: HIDDEN,
	Attempts: ATTEMPTS,
	RetrySeconds: RETRY_SECONDS,
	/**
	 * Hide every `Hidden` core GUI and the reset button. `wait` is called between
	 * attempts; the result says what succeeded.
	 */
	Apply(target: CoreGuiTarget, wait: (seconds: number) => unknown = (seconds) => task.wait(seconds)): CoreGuiPolicyResult {
		const hidden = new Set<Enum.CoreGuiType>();
		let resetButton = false;
		let attempts = 0;
		const complete = () => resetButton && HIDDEN.every((kind) => hidden.has(kind));
		while (!complete() && attempts < ATTEMPTS) {
			if (attempts > 0) wait(RETRY_SECONDS);
			attempts++;
			for (const kind of HIDDEN) {
				if (!hidden.has(kind) && pcall(() => target.SetCoreGuiEnabled(kind, false))[0]) hidden.add(kind);
			}
			if (!resetButton) resetButton = pcall(() => target.SetCore("ResetButtonCallback", false))[0];
		}
		return { hidden, resetButton, complete: complete(), attempts };
	},
};
