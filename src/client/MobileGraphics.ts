import { Lighting, UserInputService, Workspace } from "@rbxts/services";

// Phone-only render trims, applied locally (Lighting and Terrain changes made on
// a client do not replicate). The server-built look is unchanged on desktop.
//  - post effects (bloom, sun rays, depth of field) are full-screen passes;
//  - volumetric clouds are a large fill-rate cost, so they get lighter.
// Memory heuristics such as Stats:GetTotalMemoryUsageMb are unreliable across
// devices, so the rule is simply "touch device".
const TOUCH_CLOUD_DENSITY = 0.18;
const TOUCH_CLOUD_COVER = 0.25;

function trimEffect(item: Instance): void {
	if (item.IsA("BloomEffect") || item.IsA("SunRaysEffect") || item.IsA("DepthOfFieldEffect")) item.Enabled = false;
}
function trimClouds(item: Instance): void {
	if (!item.IsA("Clouds")) return;
	item.Density = math.min(item.Density, TOUCH_CLOUD_DENSITY);
	item.Cover = math.min(item.Cover, TOUCH_CLOUD_COVER);
}

export function applyMobileGraphics(): RBXScriptConnection[] {
	if (!UserInputService.TouchEnabled) return [];
	for (const item of Lighting.GetChildren()) trimEffect(item);
	for (const item of Workspace.Terrain.GetChildren()) trimClouds(item);
	return [
		Lighting.ChildAdded.Connect(trimEffect),
		Workspace.Terrain.ChildAdded.Connect(trimClouds),
	];
}
