import { Lighting, UserInputService, Workspace } from "@rbxts/services";
import { ENVIRONMENT_ATTRIBUTE } from "../shared/EnvironmentPresets";
import { phoneClouds } from "../shared/WeatherRules";

// Phone-only render trims, applied locally (Lighting and Terrain changes made on
// a client do not replicate). The server-built look is unchanged on desktop.
//  - post effects (bloom, sun rays, depth of field) are full-screen passes;
//  - volumetric cloud density is a large fill-rate cost, so it is clamped, but
//    storm, fog and overcast decks keep their cover (cover is cheap, and a storm
//    under a clear sky does not read as a storm). Rain and lightning stay on at a
//    lower particle share (client/Weather, shared/WeatherRules).
// Memory heuristics such as Stats:GetTotalMemoryUsageMb are unreliable across
// devices, so the rule is simply "touch device".

const preset = () => Lighting.GetAttribute(ENVIRONMENT_ATTRIBUTE) as string | undefined;

function trimEffect(item: Instance): void {
	if (item.IsA("BloomEffect") || item.IsA("SunRaysEffect") || item.IsA("DepthOfFieldEffect")) item.Enabled = false;
}
function trimClouds(item: Instance): void {
	if (!item.IsA("Clouds")) return;
	const trimmed = phoneClouds(preset(), item.Cover, item.Density);
	item.Density = trimmed.density;
	item.Cover = trimmed.cover;
}

export function applyMobileGraphics(): RBXScriptConnection[] {
	if (!UserInputService.TouchEnabled) return [];
	for (const item of Lighting.GetChildren()) trimEffect(item);
	for (const item of Workspace.Terrain.GetChildren()) trimClouds(item);
	return [
		Lighting.ChildAdded.Connect(trimEffect),
		Workspace.Terrain.ChildAdded.Connect(trimClouds),
		// The preset can replicate after its clouds: re-trim from the table when it lands.
		Lighting.GetAttributeChangedSignal(ENVIRONMENT_ATTRIBUTE).Connect(() => { for (const item of Workspace.Terrain.GetChildren()) trimClouds(item); }),
	];
}
