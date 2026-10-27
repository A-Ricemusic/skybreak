// Deterministic lifecycle simulation of compiled GameAudio, not a Roblox/audio playback test.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, "..");
const dest = resolve(root, "build/audio-offline");
await mkdir(dest, { recursive: true });
const bankText = await Bun.file(resolve(root, "src/shared/SoundBank.ts")).text();
const uploaded = await Bun.file(resolve(root, "assets/audio/uploaded.json")).json();
const plan = await Bun.file(resolve(root, "assets/audio/upload-plan.json")).json();
const cues = await Bun.file(resolve(root, "assets/audio/cues.json")).json();
let checked = 0;
for (const bank of plan.cues) {
  const record = uploaded[bank.id];
  if (record?.state !== "MODERATION_STATE_APPROVED") throw new Error(`No recorded approval: ${bank.id}`);
  const bytes = await Bun.file(resolve(root, `assets/audio/${bank.id}.ogg`)).arrayBuffer();
  if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== record.sha256) throw new Error(`Hash mismatch: ${bank.id}`);
  for (const member of bank.members) {
    const line = bankText.split("\n").find(line => line.trim().startsWith(`${member.id}:`));
    const match = line?.match(/assetId: "rbxassetid:\/\/(\d+)", seconds: ([\d.]+), loop: (true|false), start: ([\d.]+), finish: ([\d.]+)/);
    const cue = cues.cues.find((cue: { id: string }) => cue.id === member.id);
    if (!match || match[1] !== record.assetId || !cue || (match[3] === "true") !== cue.loop || Math.abs(+match[4] - member.start) > 0.000002 || Math.abs(+match[5] - member.end) > 0.000002 || Math.abs(+match[2] - (member.end - member.start)) > 0.000002) throw new Error(`Bank mismatch: ${member.id}`);
    checked++;
  }
}
if (checked !== cues.cues.length || checked !== (bankText.match(/assetId: "rbxassetid:/g) ?? []).length) throw new Error("Cue coverage mismatch");
console.log(`Asset manifest audit: ${checked} cues / ${plan.cues.length} recorded-approved banks; local hashes match. No live permission check.`);
let harness = await Bun.file(resolve(root, "tools/tests/audio-lifecycle.luau")).text();
// GameAudio imports these production names; retain their compiled values without
// loading JetFactory's Roblox instance construction into the standalone harness.
const jetFactory = await Bun.file(resolve(root, "out/shared/JetFactory.luau")).text();
const missileNames = ["HOSTILE_MISSILE", "PLAYER_MISSILE"].map(name => {
  const declaration = jetFactory.match(new RegExp(`^local ${name} = ("[^"\\n]+")$`, "m"));
  if (!declaration) throw new Error(`Missing compiled missile name: ${name}`);
  return `${name} = ${declaration[1]}`;
});
harness = `local _JetFactory = { ${missileNames.join(", ")} }\n${harness}`;
for (const name of ["AudioRules", "SoundBank", "GameAudio"]) {
  let source = await Bun.file(resolve(root, `out/${name === "GameAudio" ? "client" : "shared"}/${name}.luau`)).text();
  source = source.split("\n").filter(line => !line.startsWith("local TS = require(") && !line.includes("TS.import(")).join("\n");
  if (source.includes("TS.")) throw new Error(`Unhandled runtime import: ${name}`);
  harness = harness.replace(`-- INSERT ${name}`, source);
}
await Bun.write(resolve(dest, "run.luau"), harness);
const executable = requireLuauBin();
const proc = Bun.spawn([executable, resolve(dest, "run.luau")], { stdout: "inherit", stderr: "inherit" });
if (await proc.exited !== 0) process.exitCode = 1;
