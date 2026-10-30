// Runs the compiled cinematic consumer and VoicePlayer with deterministic service doubles.
// This is lifecycle/asset evidence only, never proof of Roblox authorization or audible output.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { STORY } from "../src/shared/RelayStory";
import { VOICE_CUES, VOICE_PENDING } from "../src/shared/VoiceCues";
import { VOICE_BANK_ASSETS } from "../src/shared/VoiceBanks";
import { writeAudioUseAllowlist } from "./audio-use-allowlist";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, ".."), dest = resolve(root, "build/voice-offline");
await mkdir(dest, { recursive: true });
await writeAudioUseAllowlist();
const json = async (name: string) => Bun.file(resolve(root, `assets/voice/${name}.json`)).json();
const [plan, uploaded, transcripts, lines, casting, provenance, legacy] = await Promise.all([json("upload-plan"), json("uploaded"), json("transcripts"), json("lines"), json("casting"), json("provenance"), json("legacy-banks")]);
let regions = 0, beats = 0, reused = 0;
const memberIds = new Set<string>();
const linesById = new Map<string, { id: string; text: string; spoken: string; speaker: string; tape: boolean }>(lines.lines.map((l: { id: string }) => [l.id, l]));
const fileHash = async (file: string) => createHash("sha256").update(new Uint8Array(await Bun.file(resolve(root, `assets/voice/${file}`)).arrayBuffer())).digest("hex");
async function checkBank(bank: { id: string; file: string; sha256: string; seconds: number; members: { id: string; start: number; end: number; legacyId?: string }[] }, isLegacy: boolean) {
  const record = uploaded[bank.id];
  const hash = await fileHash(bank.file);
  if (hash !== bank.sha256) throw Error(`Bank file hash mismatch: ${bank.id}`);
  const approved = record?.sha256 === hash && record.state === "MODERATION_STATE_APPROVED" && record.assetId;
  const expectedAsset = approved ? `rbxassetid://${record.assetId}` : "";
  if (VOICE_BANK_ASSETS[bank.id] !== expectedAsset) throw Error(`Bank approval/asset mismatch: ${bank.id}`);
  // D-142: a reused region must sit in the exact approved live export, never in new or unapproved audio.
  const frozen = legacy.banks[bank.id];
  if (isLegacy && (!approved || !frozen || frozen.sha256 !== hash || String(record.assetId) !== frozen.assetId)) throw Error(`Legacy bank is not the approved live asset: ${bank.id}`);
  if (!isLegacy && (frozen || plan.legacyBanks.some((b: { id: string }) => b.id === bank.id))) throw Error(`New bank reuses a legacy id: ${bank.id}`);
  const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", resolve(root, `assets/voice/${bank.file}`)], { stdout: "pipe", stderr: "pipe" });
  const duration = Number(await new Response(probe.stdout).text());
  if (await probe.exited !== 0 || !Number.isFinite(duration) || Math.abs(duration - bank.seconds) > .002) throw Error(`Encoded bank duration mismatch: ${bank.id}`);
  let end = 0;
  for (const member of bank.members) {
    const cue = VOICE_CUES[member.id], transcript = transcripts[member.id], line = linesById.get(member.id), origin = provenance.lines[member.id];
    if (memberIds.has(member.id) || !cue || !transcript || !line || cue.bank !== bank.id || transcript.bank !== bank.id || cue.text !== transcript.text || cue.text !== line.text || cue.speaker !== transcript.speaker || cue.tape !== transcript.tape || cue.start !== member.start || cue.finish !== member.end || cue.start < end || cue.finish <= cue.start || cue.finish > duration) throw Error(`Region/transcript mismatch: ${member.id}`);
    if (origin?.bank !== bank.id || origin.source !== (isLegacy ? "legacy" : "new") || transcript.source !== origin.source) throw Error(`Provenance mismatch: ${member.id}`);
    if (isLegacy) {
      // Same take: cache key (voice, model, settings, spoken text), ElevenLabs request id and raw sha256, region and treatment.
      const take = frozen.members.find((m: { legacyId: string }) => m.legacyId === member.legacyId);
      if (!take || take.cacheKey !== origin.cacheKey || take.requestId !== origin.requestId || take.rawSha256 !== origin.rawSha256 || !take.requestId || !take.rawSha256 || take.start !== member.start || take.end !== member.end || take.spoken !== line.spoken || take.tape !== line.tape || take.speaker !== line.speaker) throw Error(`Reused region is not this line's approved take: ${member.id}`);
      reused++;
    }
    memberIds.add(member.id); end = cue.finish; regions++;
  }
}
for (const bank of plan.legacyBanks) await checkBank(bank, true);
for (const bank of plan.banks) await checkBank(bank, false);
if (regions !== Object.keys(VOICE_CUES).length) throw Error("Unmanifested cues");
// Every scripted line is either a verified cue or pending (no cue, silent) with its exact text.
for (const line of lines.lines) {
  const pending = VOICE_PENDING[line.id];
  if (memberIds.has(line.id) === (pending !== undefined)) throw Error(`Line neither cued nor pending (or both): ${line.id}`);
  if (pending !== undefined && (pending !== line.text || transcripts[line.id].bank !== null || provenance.lines[line.id].source !== "pending")) throw Error(`Pending line mismatch: ${line.id}`);
}
if (Object.keys(VOICE_PENDING).length + memberIds.size !== lines.lines.length) throw Error("Pending table has unknown lines");
const pendingTiers = Object.values(plan.pendingTiers as Record<string, { lines: string[] }>).flatMap(t => t.lines);
if (pendingTiers.length !== Object.keys(VOICE_PENDING).length || pendingTiers.some(id => VOICE_PENDING[id] === undefined)) throw Error("Pending tiers differ from the pending table");
for (const chapter of STORY) for (const [index, beat] of chapter.beats.entries()) {
  const id = `story.c${String(chapter.id).padStart(2, "0")}.b${String(index).padStart(2, "0")}`;
  if (!beat.recordingId) { beats++; continue; } // subtitle-only, listed in voice-script.md
  const cue = VOICE_CUES[beat.recordingId], transcript = transcripts[beat.recordingId];
  const rawSpeaker = beat.speaker.split(" · ")[0], speaker = casting.aliases[rawSpeaker] ?? rawSpeaker;
  if (transcript?.text !== beat.text) throw Error(`Authored/recorded dialogue mismatch: ${id}`);
  if (cue ? (cue.radio || cue.text !== beat.text || cue.speaker !== speaker) : VOICE_PENDING[beat.recordingId] !== beat.text) throw Error(`Authored/recorded dialogue mismatch: ${id}`);
  beats++;
}
console.log(`VOICE_MANIFEST chapters=${STORY.length} beats=${beats} regions=${regions} reusedApproved=${reused} pending=${Object.keys(VOICE_PENDING).length} bankHashes=${plan.legacyBanks.length + plan.banks.length}`);
let harness = await Bun.file(resolve(root, "tools/tests/voice-consumer.luau")).text();
const files = ["shared/VoiceDisclosure", "shared/VoiceReadiness", "shared/VoiceBanks", "shared/VoiceCues", "shared/RelayStory", "shared/VoiceLines", "shared/CinematicInput", "shared/CinematicLayout", "shared/CinematicStaging", "shared/StoryDocuments", "client/MotionPreference", "client/VoicePlayer", "client/RelayCinematic"];
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
    // Exclude only scenery construction/lighting. Keep the actual component, hooks,
    // input handlers, effect body, beat clock, Voice.Story and VoicePlayer.Play calls.
    const marker = "local function RelayCinematic(_param)";
    if (!source.includes(marker)) throw Error("Cinematic test seam changed");
    source = source.replace(marker, `sceneFor = function() return {scene=Instance.new("Folder"),reels={},recorderLight={},tealStrip={}} end\nstageLighting = function() return function() end end\n${marker}`);
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
