// Runs the compiled RelayCinematic with its real stage, lighting and post effects against engine
// doubles (tools/tests/cinematic-stage.luau), injecting setup, placement, frame, input and cleanup
// failures. Lifecycle evidence only: nothing is rendered and no Roblox engine is involved.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, ".."), dest = resolve(root, "build/cinematic-offline");
await mkdir(dest, { recursive: true });
const files = ["shared/VoiceDisclosure", "shared/VoiceReadiness", "shared/VoiceBanks", "shared/VoiceCues", "shared/RelayStory", "shared/VoiceLines", "shared/CinematicInput", "shared/CinematicLayout", "shared/CinematicStaging", "shared/UploadedAssetSpecs", "shared/CinematicSet", "shared/Teardown", "shared/StoryDocuments", "client/MotionPreference", "client/VoicePlayer", "client/RelayCinematic"];
let modules = "";
for (const file of files) {
  let source = await Bun.file(resolve(root, `out/${file}.luau`)).text();
  source = source.split("\n").filter(line => !line.startsWith("local TS = require(")).map(line => {
    if (!line.includes("TS.import(")) return line;
    const name = [...line.matchAll(/"([^"\n]+)"/g)].at(-1)?.[1];
    if (!name) throw Error(`Unknown dependency: ${line}`);
    return line.replace(/TS\.import\(.*\)/, `modules["${name}"]`);
  }).join("\n");
  if (source.includes("TS.")) throw Error(`Unhandled runtime dependency: ${file}`);
  modules += `modules["${file.split("/").at(-1)}"] = (function()\n${source}\nend)()\n`;
}
const harness = (await Bun.file(resolve(root, "tools/tests/cinematic-stage.luau")).text()).replace("-- INSERT MODULES", modules);
await Bun.write(resolve(dest, "run.luau"), harness);
const proc = Bun.spawn([requireLuauBin(), resolve(dest, "run.luau")], { stdout: "pipe", stderr: "pipe" });
const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
console.log(stdout); if (stderr) console.error(stderr);
await Bun.write(resolve(dest, "results.log"), stdout + stderr);
if (code !== 0) process.exitCode = code;
