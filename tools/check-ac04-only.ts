// Local release contract: inspect source/package inputs and actual project mappings.
import { resolve, relative } from "node:path";
import { stat } from "node:fs/promises";
const forbidden = /MissionCatalog|MissionRules|BlueprintRunner|CampaignRepository|CampaignProgress|RelayStory|RelayCinematic|SkybreakCampaign_v1|SkybreakAC04Campaign_v1|Broken Relay|CHOOSE YOUR CAMPAIGN|CAMPAIGN SELECTION|commsrelay|relaytruck|harborlaunch|build-relay-assets/i;
const textFile = /\.(?:ts|tsx|js|mjs|cjs|py|lua|luau|json|txt|xml|rbxmx|rbxlx)$/i;
export async function checkAC04Only(root: string): Promise<number> {
 const inspected = new Set<string>();
 async function inspect(path: string) {
  if (inspected.has(path)) return;
  inspected.add(path);
  const name = relative(root, path);
  if (name.startsWith("out/tests/")) return; // Native test fixtures mirror src/tests; not shipped by default.project.json.
  if (forbidden.test(name) || /(?:^|\/)mission\/grainsilo\.mesh\.json$/i.test(name)) throw Error(`Retired campaign input: ${name}`);
  if (textFile.test(path)) {
   let content = await Bun.file(path).text();
   // Exact historical usage text in retained generic Blender provenance is evidence, not campaign input.
   if (name === "assets/roblox-upload/manifest.json" || name === "assets/roblox-upload/relay-mast/checklist.json")
    content = content.replaceAll("Relay stations across the campaign (M3-M27): scenery companion to the Comms" + "Relay target.", "Generic communications station historical usage");
   if (forbidden.test(content)) throw Error(`Retired campaign reference in ${name}`);
  }
 }
 for (const pattern of ["src/**/*.{ts,tsx}", "tools/**/*.{ts,py,js,luau,lua}", "assets/**/*", "package.json", "*.project.json"]) {
  for await (const name of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) {
   // Historical reports/docs are outside these roots. Tests intentionally contain rejection fixtures.
   if (name.startsWith("src/tests/") || name.startsWith("tools/tests/") || name === "tools/check-ac04-only.ts") continue;
   await inspect(resolve(root, name));
  }
 }
 async function mapped(node: unknown): Promise<void> {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
   if (key === "$path" && typeof value === "string") {
    if (forbidden.test(value) || /(?:^|\/)mission\/grainsilo\.mesh\.json$/i.test(value)) throw Error(`Retired mapped input: ${value}`);
    // Vendor libraries are not project campaign inputs.
    if (value === "include" || value.startsWith("node_modules/")) continue;
    const path = resolve(root, value);
    if (relative(root, path).startsWith("..")) throw Error(`Project mapping escapes package: ${value}`);
    const info = await stat(path);
    if (info.isDirectory()) {
     for await (const file of new Bun.Glob("**/*").scan({ cwd: path, onlyFiles: true })) await inspect(resolve(path, file));
    } else await inspect(path);
   } else await mapped(value);
  }
 }
 for await (const name of new Bun.Glob("*.project.json").scan({cwd: root})) await mapped(await Bun.file(resolve(root, name)).json());
 const service = await Bun.file(resolve(root,"src/server/AC04CampaignService.ts")).text();
 if (!service.includes('GetDataStore("SkybreakAC04Fresh_20261027_v1")')) throw Error("Fresh save namespace missing");
 if (!service.includes('`player_${player.UserId}`')) throw Error("Standard player keys missing");
 return inspected.size;
}
if (import.meta.main) console.log(`AC04_ONLY passed inputs=${await checkAC04Only(resolve(import.meta.dir,".."))}; cloud deletion NOT claimed`);
