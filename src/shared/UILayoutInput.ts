// Input mode detection and the control hints drawn around the HUD: Touch/Gamepad/Keyboard mode from
// Roblox input names, the EVADE/SPECIAL/FIRE key hints, and the mission 1 tutorial copy and movement
// indicator cells. Depends only on HudInstruments text metrics and the Rectangle type.
import { hudTextWidth } from "./HudInstruments";
import type { Rectangle } from "./UILayoutGeometry";

export type InputMode = "touch" | "gamepad" | "keyboard";

export interface ControlHint {
	/** Enum.KeyCode name for gamepad glyph lookup; absent for keyboard and mouse. */
	keyCode?: string;
	label: string;
	action: string;
}

export interface FlightHintContext {
	introduction: boolean;
	locked: boolean;
	missileReady: boolean;
}

/** Tutorial copy must fit the single objective line. */
export const TUTORIAL_MAX_CHARS = 34;

export function inputModeFromPreferred(name: string): InputMode | undefined {
	if (name === "Touch") return "touch";
	if (name === "Gamepad") return "gamepad";
	if (name === "KeyboardAndMouse") return "keyboard";
	return undefined;
}

/** Maps an Enum.UserInputType name to an input mode; unrelated input types return undefined. */
export function inputModeFromInputType(name: string): InputMode | undefined {
	if (name === "Touch") return "touch";
	if (name.sub(1, 7) === "Gamepad") return "gamepad";
	if (name === "Keyboard" || name === "MouseMovement" || name === "MouseWheel" || name.sub(1, 11) === "MouseButton")
		return "keyboard";
	return undefined;
}

/**
 * Hybrid devices can report mouse or gamepad activity mid-drag. Leaving touch
 * waits until the active joystick touch ends so the stick is always released.
 */
export function shouldAcceptInputModeChange(
	current: InputMode,
	nextMode: InputMode,
	touchDragActive: boolean,
): boolean {
	if (current === nextMode) return false;
	return !(touchDragActive && current === "touch");
}

export function getEvadeHint(inputMode: InputMode): ControlHint | undefined {
	if (inputMode === "gamepad") return { keyCode: "ButtonB", label: "B", action: "EVADE" };
	if (inputMode === "keyboard") return { label: "F", action: "EVADE" };
	return undefined;
}

/** The special-weapon key: C on keyboard, X on a gamepad (B evades, Y targets, RT fires). */
export function getSpecialHint(inputMode: InputMode, action: string): ControlHint | undefined {
	if (inputMode === "gamepad") return { keyCode: "ButtonX", label: "X", action };
	if (inputMode === "keyboard") return { label: "C", action };
	return undefined;
}

/** Most hints shown at once in the bottom-centre row. */
export const MAX_FLIGHT_HINTS = 2;

/**
 * Bottom-of-screen hints: a two-item legend at launch, otherwise only what is
 * actionable now (FIRE while locked with a missile ready). Never more than two.
 */
export function getFlightHints(inputMode: InputMode, context: FlightHintContext): ControlHint[] {
	if (inputMode === "touch") return [];
	const gamepad = inputMode === "gamepad";
	const fire: ControlHint = gamepad
		? { keyCode: "ButtonR2", label: "RT", action: "FIRE" }
		: { label: "SPACE", action: "FIRE" };
	if (context.locked && context.missileReady) return [fire];
	if (context.introduction) {
		const target: ControlHint = gamepad
			? { keyCode: "ButtonY", label: "Y", action: "TARGET" }
			: { label: "TAB", action: "TARGET" };
		const fly: ControlHint = gamepad
			? { keyCode: "Thumbstick1", label: "LS", action: "FLY" }
			: { label: "WASD", action: "FLY" };
		return [fly, target];
	}
	return [];
}

/** Small roots stack the two cells inside the same existing objective rectangle. */
export function getMovementIndicatorLayout(area: Rectangle, textSize: number): Rectangle[] {
	// Each half must fit the longest cell: "Tap W/S ↑↓ 0/3s" (15 characters).
	const stack = area.width < hudTextWidth(30, textSize);
	return [0, 1].map((index) => ({
		x: area.x + (stack ? 0 : (index * area.width) / 2),
		y: area.y + (stack ? (index * area.height) / 2 : 0),
		width: stack ? area.width : area.width / 2,
		height: stack ? area.height / 2 : area.height,
	}));
}

/** Two cells share the existing objective row; unfinished controls keep the amber teaching emphasis. */
export function getMovementIndicators(
	mode: InputMode,
	turn?: number,
	pitch?: number,
): { text: string; done: boolean }[] {
	const labels = mode === "keyboard" ? ["A/D", "W/S ↑↓"] : mode === "touch" ? ["L ↔", "L ↑↓"] : ["LS ↔", "LS ↑↓"];
	return [turn ?? -1, pitch ?? -1].map((value, index) => {
		const known = value >= 0 && value === value && math.abs(value) !== math.huge;
		const seconds = known ? math.clamp(value, 0, 3) : 0;
		const done = known && seconds >= 3;
		return { text: `${done ? "✓" : "Tap"} ${labels[index]} ${known ? math.floor(seconds) : "–"}/3s`, done };
	});
}

/** Mission 1 training copy, short enough for the one-line objective (<= TUTORIAL_MAX_CHARS). */
export function getTutorialInstruction(step: string | undefined, mode: InputMode): string {
	if (step === "move")
		return mode === "touch"
			? "Tap L turn/pitch; 3s total each"
			: mode === "gamepad"
				? "Tap LS turn/pitch; 3s total each"
				: "Tap A/D, W/S; 3s total each";
	if (step === "target")
		return mode === "touch"
			? "Tap radar box or TGT to select it"
			: mode === "gamepad"
				? "Press Y to select the radar"
				: "Press Tab to select the radar";
	if (step === "missile")
		return mode === "touch"
			? "Hold the lock, then tap FIRE"
			: mode === "gamepad"
				? "Hold the lock, then press RT"
				: "Hold the lock, then press Space";
	return "";
}
