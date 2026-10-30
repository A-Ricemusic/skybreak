// Runs the compiled cinematic consumer and VoicePlayer with deterministic service doubles.
// This is lifecycle/asset evidence only, never proof of Roblox authorization or audible output.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { STORY } from "../src/shared/RelayStory";
import { VOICE_CUES } from "../src/shared/VoiceCues";
import { VOICE_BANK_ASSETS } from "../src/shared/VoiceBanks";
import { writeAudioUseAllowlist } from "./audio-use-allowlist";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, ".."), dest = resolve(root, "build/voice-offline");
await mkdir(dest, { recursive: true });
await writeAudioUseAllowlist();
const json = async (name: string) => Bun.file(resolve(root, `assets/voice/${name}.json`)).json();
const [plan, uploaded, transcripts, lines, casting] = await Promise.all([json("upload-plan"), json("uploaded"), json("transcripts"), json("lines"), json("casting")]);
let regions = 0, beats = 0;
const memberIds = new Set<string>();
for (const bank of plan.banks) {
  const record = uploaded[bank.id];
  const hash = createHash("sha256").update(new Uint8Array(await Bun.file(resolve(root, `assets/voice/${bank.file}`)).arrayBuffer())).digest("hex");
  if (hash !== bank.sha256 || hash !== record.sha256 || record.state !== "MODERATION_STATE_APPROVED" || VOICE_BANK_ASSETS[bank.id] !== `rbxassetid://${record.assetId}`) throw Error(`Bank manifest mismatch: ${bank.id}`);
  const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", resolve(root, `assets/voice/${bank.file}`)], { stdout: "pipe", stderr: "pipe" });
  const duration = Number(await new Response(probe.stdout).text());
  if (await probe.exited !== 0 || !Number.isFinite(duration) || Math.abs(duration - bank.seconds) > .002) throw Error(`Encoded bank duration mismatch: ${bank.id}`);
  let end = 0;
  for (const member of bank.members) {
    const cue = VOICE_CUES[member.id], transcript = transcripts[member.id];
    if (memberIds.has(member.id) || !cue || !transcript || cue.bank !== bank.id || transcript.bank !== bank.id || cue.text !== transcript.text || cue.speaker !== transcript.speaker || cue.tape !== transcript.tape || cue.start !== member.start || cue.finish !== member.end || cue.start < end || cue.finish <= cue.start || cue.finish > duration) throw Error(`Region/transcript mismatch: ${member.id}`);
    memberIds.add(member.id); end = cue.finish; regions++;
  }
}
if (regions !== Object.keys(VOICE_CUES).length) throw Error("Unmanifested cues");
for (const chapter of STORY) for (const [index, beat] of chapter.beats.entries()) {
  const id = `story.c${String(chapter.id).padStart(2, "0")}.b${String(index).padStart(2, "0")}`;
  if (!beat.recordingId) { beats++; continue; } // subtitle-only, listed in voice-script.md
  const cue = VOICE_CUES[beat.recordingId], transcript = transcripts[beat.recordingId];
  const rawSpeaker = beat.speaker.split(" · ")[0], speaker = casting.aliases[rawSpeaker] ?? rawSpeaker;
  if (!cue || cue.radio || cue.text !== beat.text || cue.speaker !== speaker || transcript.text !== beat.text) throw Error(`Authored/recorded dialogue mismatch: ${id}`);
  beats++;
}
console.log(`VOICE_MANIFEST chapters=${STORY.length} beats=${beats} regions=${regions} bankHashes=${plan.banks.length}`);
let harness = await Bun.file(resolve(root, "tools/tests/voice-consumer.luau")).text();
const files = ["shared/VoiceDisclosure", "shared/VoiceReadiness", "shared/VoiceBanks", "shared/VoiceCues", "shared/RelayStory", "shared/VoiceLines", "shared/CinematicInput", "shared/CinematicLayout", "shared/CinematicStaging", "shared/CinematicSet", "shared/UploadedAssetSpecs", "shared/Teardown", "shared/StoryDocuments", "client/MotionPreference", "client/VoicePlayer", "client/RelayCinematic"];
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
  if (file === "client/RelayCinematic") {
    // Exclude only scenery construction/lighting/post-processing; the doubles register their undo steps
    // with the real teardown and can inject setup and cleanup faults (harnessFaults). Keep the actual component, hooks,
    // input handlers, effect body, beat clock, Voice.Story and VoicePlayer.Play calls.
    const marker = "local function RelayCinematic(_param)";
    if (!source.includes(marker)) throw Error("Cinematic test seam changed");
    source = source.replace(marker, `sceneFor = function(chapter,track) local folder=Instance.new("Folder");harnessStage.folder=folder;track(function() folder:Destroy() end);if harnessFaults.scene then error("injected scene fault") end;return {scene=folder,reels={},recorderLight={},tealStrip={}} end\nstageLighting = function(mood,track) harnessStage.lightingApplied+=1;track(function() harnessStage.lightingRestored+=1;if harnessFaults.lightingRestore then error("injected lighting restore fault") end end) end\nstageEffects = function(mood,track) track(function() harnessStage.effectsRestored+=1 end);if harnessFaults.effects then error("injected effects fault") end;return {depth=function() end} end\n${marker}`);
  }
  modules += `modules["${file.split("/").at(-1)}"] = (function()\n${source}\nend)()\n`;
}
harness = harness.replace("-- INSERT MODULES", modules);
await Bun.write(resolve(dest, "run.luau"), harness);
const executable = requireLuauBin();
const proc = Bun.spawn([executable, resolve(dest, "run.luau")], { stdout: "pipe", stderr: "pipe" });
const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
console.log(stdout); if (stderr) console.error(stderr);
await Bun.write(resolve(dest, "results.log"), stdout + stderr);
if (code !== 0) process.exitCode = code;
