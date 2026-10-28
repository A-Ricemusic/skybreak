# AC04 original voice production

This directory is separate from the existing approved `assets/voice` campaign. Its scripts are newly written adaptations in `src/shared/ac04/AC04Story.ts`; no original game recordings or script lines are used as audio. No AC04 audio has been generated or uploaded yet.

`lines.json` is the exact reviewable transcript: 48 story beats, 18 briefings, 18 debriefings and 62 radio lines, with stable `ac04.*` IDs. Speaker prefixes remain in caption text and are removed only from spoken radio text. The 18 strategic overview descriptions remain silent UI text. Re-export after any script change; generation and packing reject a stale manifest.

`casting.json` proposes existing stock voices, not actor imitations: George narrates the adult recollection, Brian voices SkyEye, Daniel briefs/debriefs. Supporting roles use stock Sarah, Chris, Eric, Charlie, Callum, Bella, Bill, Lily, Harry and Adam. Availability and commercial-use entitlement must be checked against the actual provider account at generation. No license or listening verdict is implied by these proposed IDs.

Offline preparation:

```sh
bun tools/ac04-voice-lines.ts
bun tools/ac04-voice-lines.ts --check
python3 tools/ac04-voice.py plan
```

After the coordinator has obtained a private ElevenLabs key and confirmed the current account/model/voice availability, use `tools/ac04-voice.py generate --key-file <private-file> --budget <authorized-credit-budget>`. It reuses the existing content-hash cache and provider provenance, rejects free-tier generation, and checks available credits. The inherited half-credit Turbo estimate is an estimate to verify against the current account; character counts are the stable planning measure. Never put a key in a tracked file, shell command argument value, transcript or game code.

`pack`, `stt`, `checklist` and `sampler` use the same existing pipeline through the isolated adapter. They write only this directory and `src/shared/ac04/AC04VoiceCues.ts` / `AC04VoiceBanks.ts`; the old generated tables and approved banks remain untouched. Bank file IDs are local to this directory, while runtime bank keys have an `ac04_` prefix. Generation, packing and STT each require their own checks; a passing compile is not an audio review.

Before any upload, an independent reviewer must listen to the exact banks, compare their transcripts, inspect provenance and automated checklists, verify current applicable policies and commercial rights, and write `review.json` in the existing voice workflow format (exact hashes, reviewer/method, approval, transcript-match evidence and top-level commercialUsePermitted). Do not copy an old bank's approval. No AC04 upload adapter exists yet; the old `tools/upload-voice.py` targets the old campaign and must not be used for this directory. The coordinator must add an isolated upload adapter preserving the existing account lock/HALT/journal and strict moderation gates before uploading.

The runtime adapter requires an exact caption match and a bank ID from a matching independent review and moderation-approved upload record. Empty bank IDs keep the full caption path available. The new cinematic uses the shared VoicePlayer for clean narration, waits through bounded audio loading, holds long enough for speech, and stops audio on skip/unmount. The AC04 menu/HUD now uses the same exact-text library for briefings, successful debriefings and radio. Radio deduplicates serials, queues captions for voice duration, freezes its clock during bounded loading or pause, and stops on scene/session cleanup. Actual audible playback, permission to use the uploaded sound in the place, pause/resume, overlaps and failure fallbacks require Studio verification once reviewed assets exist.
