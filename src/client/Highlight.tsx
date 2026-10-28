import { createContext, useContext, useMemo, useState } from "@rbxts/react";
import type { InputMode } from "../shared/UILayout";

// Shared menu highlight: hover only counts for the mouse and selection only for
// the gamepad, so a touch tap never leaves a button lit. Lives outside GameUI so
// the briefing pickers can use it without an import cycle.
export const InputModeContext = createContext<InputMode>("keyboard");

/** Hides Roblox's default gamepad selection box; buttons draw their own hot style. */
export const SELECTION_NONE = new Instance("Frame");
SELECTION_NONE.BackgroundTransparency = 1;
SELECTION_NONE.BorderSizePixel = 0;

export function useHighlight(enabled: boolean) {
	const mode = useContext(InputModeContext);
	const [hovered, setHovered] = useState(false);
	const [selected, setSelected] = useState(false);
	const events = useMemo(() => ({
		MouseEnter: () => setHovered(true),
		MouseLeave: () => setHovered(false),
		SelectionGained: () => setSelected(true),
		SelectionLost: () => setSelected(false),
	}), []);
	return {
		hot: enabled && ((mode === "keyboard" && hovered) || (mode === "gamepad" && selected)),
		events,
		clearHover: () => setHovered(false),
	};
}
