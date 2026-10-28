import { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, UserInputService } from "@rbxts/services";
import type { AC04InputMode } from "../../../shared/ac04/ui/AC04MenuLayout";
import { type AC04Intent, ac04KeyIntent, ac04StickIntent } from "../../../shared/ac04/ui/AC04Routing";

function modeFor(kind: Enum.UserInputType, previous: AC04InputMode): AC04InputMode {
	if (kind === Enum.UserInputType.Touch) return "touch";
	if (kind.Name.sub(1, 7) === "Gamepad") return "gamepad";
	if (kind === Enum.UserInputType.Keyboard || kind.Name.sub(1, 5) === "Mouse") return "keyboard";
	return previous;
}

/** Last-used input family; layouts and help text follow hot-plugging and switching. */
export function useAC04InputMode(): AC04InputMode {
	const initial = (): AC04InputMode => {
		const fallback: AC04InputMode = UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled ? "touch" : "keyboard";
		return modeFor(UserInputService.GetLastInputType(), fallback);
	};
	const [mode, setMode] = useState<AC04InputMode>(initial);
	useEffect(() => {
		const connection = UserInputService.LastInputTypeChanged.Connect((kind) => setMode((previous) => modeFor(kind, previous)));
		return () => connection.Disconnect();
	}, []);
	return mode;
}

/** Size of a GUI object's safe area (the ScreenGui root), kept current on resize and rotation. */
export function useAC04Size(target: GuiObject | ScreenGui | undefined): Vector2 {
	const [size, setSize] = useState(new Vector2(1280, 720));
	useEffect(() => {
		if (!target) return;
		const update = () => { const destination = target.AbsoluteSize; if (destination.X > 0 && destination.Y > 0) setSize(destination); };
		update();
		const connection = target.GetPropertyChangedSignal("AbsoluteSize").Connect(update);
		return () => connection.Disconnect();
	}, [target]);
	return size;
}

/**
 * Keyboard/gamepad menu navigation for the mounted screen. Only one screen is mounted at a time, so the
 * mounted one owns the intents. Roblox GUI selection is cleared so D-pad input is not consumed twice.
 */
export function useAC04MenuKeys(enabled: boolean, onIntent: (intent: AC04Intent) => void): void {
	const handler = useRef(onIntent);
	handler.current = onIntent;
	useEffect(() => {
		if (!enabled) return;
		GuiService.SelectedObject = undefined;
		let held: AC04Intent | undefined;
		const began = UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || UserInputService.GetFocusedTextBox()) return;
			const intent = ac04KeyIntent(input.KeyCode.Name);
			if (intent !== undefined) handler.current(intent);
		});
		const changed = UserInputService.InputChanged.Connect((input) => {
			if (input.KeyCode !== Enum.KeyCode.Thumbstick1) return;
			const destination = ac04StickIntent(input.Position.X, input.Position.Y, held);
			if (destination !== undefined && destination !== held) handler.current(destination);
			held = destination;
		});
		return () => { began.Disconnect(); changed.Disconnect(); };
	}, [enabled]);
}
