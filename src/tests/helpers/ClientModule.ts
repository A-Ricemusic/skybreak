import { StarterPlayer } from "@rbxts/services";

/**
 * roblox-ts forbids importing src/client (an isolated container) from specs, so
 * specs `import type` a client module and load its compiled ModuleScript here.
 */
export function requireClientModule<T>(name: string): T {
	const client = StarterPlayer.WaitForChild("StarterPlayerScripts").WaitForChild("Client");
	const module = client.WaitForChild(name);
	assert(module.IsA("ModuleScript"), `client module ${name} is not a ModuleScript`);
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Roblox require of a ModuleScript Instance, not a CommonJS import.
	return require(module) as T;
}
