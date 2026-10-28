import { UserInputService } from "@rbxts/services";
import { inputModeFromInputType, inputModeFromPreferred, type InputMode } from "../../shared/UILayout";

const glyphCache = new Map<string, string>();

function glyphFor(keyCodeName: string): string {
	const cached = glyphCache.get(keyCodeName);
	if (cached !== undefined) return cached;
	let image = "";
	const keyCode = Enum.KeyCode.GetEnumItems().find((item) => item.Name === keyCodeName);
	if (keyCode) {
		const [ok, result] = pcall(() => UserInputService.GetImageForKeyCode(keyCode));
		if (ok && typeIs(result, "string")) image = result;
	}
	glyphCache.set(keyCodeName, image);
	return image;
}

function readInputMode(): InputMode {
	const [ok, preferred] = pcall(() => UserInputService.PreferredInput);
	if (ok && typeIs(preferred, "EnumItem")) {
		const mode = inputModeFromPreferred(preferred.Name);
		if (mode) return mode;
	}
	const last = inputModeFromInputType(UserInputService.GetLastInputType().Name);
	if (last) return last;
	if (UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled) return "touch";
	if (UserInputService.GamepadEnabled && !UserInputService.KeyboardEnabled) return "gamepad";
	return "keyboard";
}

export { glyphCache, glyphFor, readInputMode };
