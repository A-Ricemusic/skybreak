// Read-only preparation for the parent's authorized permission repair. Makes no HTTP calls.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { VOICE_BANK_ASSETS } from "../src/shared/VoiceBanks";
import { SoundBank } from "../src/shared/SoundBank";
const root = resolve(import.meta.dir, "..");
const APPROVED_IDS = [
  "96143096268975", "72249736253176", "70686186147484", "112591774159889", "119322000491190", "115928309099950",
  "100845993226613", "96034533542673", "129430411346132", "140586818884141", "119891912328421", "103061867054487", "78239725791801", "119485031741286",
];
export async function writeAudioUseAllowlist() {
  const assets: { kind: string; bank: string; assetId: string; sha256: string }[] = [];
  for (const kind of ["voice", "audio"]) {
    const uploaded = await Bun.file(resolve(root, `assets/${kind}/uploaded.json`)).json();
    const used = new Set((kind === "voice" ? Object.values(VOICE_BANK_ASSETS) : Object.values(SoundBank).map(cue => cue.assetId)).map(id => id.replace("rbxassetid://", "")));
    if (used.size !== (kind === "voice" ? 6 : 8) || Object.keys(uploaded).length !== used.size) throw Error(`Unexpected ${kind} bank inventory`);
    for (const [bank, record] of Object.entries(uploaded) as [string, { assetId: string; sha256: string; state: string; assetType: string }][]) {
      if (!used.delete(record.assetId) || !APPROVED_IDS.includes(record.assetId) || record.state !== "MODERATION_STATE_APPROVED" || record.assetType !== "Audio") throw Error(`Bank outside approved Use scope: ${kind}/${bank}`);
      const bytes = await Bun.file(resolve(root, `assets/${kind}/${bank}.ogg`)).arrayBuffer();
      if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== record.sha256) throw Error(`Bank hash mismatch: ${kind}/${bank}`);
      assets.push({ kind, bank, assetId: record.assetId, sha256: record.sha256 });
    }
    if (used.size) throw Error(`Unverified runtime ${kind} bank`);
  }
  if (new Set(assets.map(asset => asset.assetId)).size !== 14 || assets.length !== 14) throw Error("Expected exactly 14 distinct banks");
  const report = { status: "planned-not-applied", universeId: "10772984313", placeId: "112911685457826", permission: "Use", includeDependencies: false, public: false, assets };
  const dest = resolve(root, "build/voice-offline");
  await mkdir(dest, { recursive: true });
  await Bun.write(resolve(dest, "audio-use-allowlist.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("AUDIO_USE_ALLOWLIST 14 verified current banks; universe=10772984313 Use only; no grants queried/applied");
  return report;
}
if (import.meta.main) await writeAudioUseAllowlist();
