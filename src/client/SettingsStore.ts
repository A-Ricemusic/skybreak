import { useEffect, useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { defaultSettings, PlayerSettings, readSettings, SETTING_ATTRIBUTES, SETTING_ORDER, SettingKey } from "../shared/PlayerSettings";
import { MotionPreference } from "./MotionPreference";

// Client-only settings store. Values live as attributes on PlayerGui: they
// survive respawns and UI remounts for the session, need no DataStore or
// ReplicatedStorage, and other client systems (audio reads MusicVolume /
// SfxVolume) can read them without importing this module.

type Listener = (settings: PlayerSettings) => void;
const listeners = new Set<Listener>();
let current = defaultSettings();
let host: Instance | undefined;
let watching = false;

function playerGui(): Instance | undefined {
	if (host && host.Parent) return host;
	const player = Players.LocalPlayer;
	host = player ? player.FindFirstChildOfClass("PlayerGui") : undefined;
	return host;
}

function apply(settings: PlayerSettings): void {
	current = settings;
	MotionPreference.shake = settings.shake;
	for (const listener of listeners) {
		const [ok, problem] = pcall(listener, settings);
		if (!ok) warn(`SKYBREAK settings listener: ${tostring(problem)}`);
	}
}

function refresh(): void {
	const gui = playerGui();
	apply(gui ? readSettings((name) => gui.GetAttribute(name)) : current);
}

function watch(): void {
	const gui = playerGui();
	if (watching || !gui) return;
	watching = true;
	// Writes from anywhere (this sheet, Studio QA, another script) flow back to every reader.
	for (const key of SETTING_ORDER) gui.GetAttributeChangedSignal(SETTING_ATTRIBUTES[key]).Connect(refresh);
	// First run in a session: publish the defaults so audio and QA can read every value.
	for (const key of SETTING_ORDER) if (gui.GetAttribute(SETTING_ATTRIBUTES[key]) === undefined) gui.SetAttribute(SETTING_ATTRIBUTES[key], current[key]);
	refresh();
}

export const SettingsStore = {
	Get(): PlayerSettings {
		watch();
		return current;
	},
	Set<K extends SettingKey>(key: K, value: PlayerSettings[K]): void {
		watch();
		const gui = playerGui();
		if (gui) gui.SetAttribute(SETTING_ATTRIBUTES[key], value);
		else apply({ ...current, [key]: value });
	},
	Subscribe(listener: Listener): () => void {
		watch();
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};

/** Current settings, re-rendering on every change. */
export function useSettings(): PlayerSettings {
	const [settings, setSettings] = useState(() => SettingsStore.Get());
	useEffect(() => SettingsStore.Subscribe((value) => setSettings(value)), []);
	return settings;
}
