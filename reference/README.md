# Local AC04 research

Source: **Ace Combat 04: Shattered Skies. Full campaign [HD 1080p 60fps]** by **GamePlayShare**, <https://youtu.be/lO7bCwQOYUs>, 4:52:02 (17522 s). This is the supplied source description, not a claim that resolution, fps or complete coverage has been verified.

| Path | Purpose | Committed? |
|---|---|---|
| `reference/ac04/video/` | 480p proxy and local source metadata | No |
| `reference/ac04/frames/` | Scene-change and interval frames, inspection sheets | No |
| `reference/ac04/clips/` | Per-mission 1080p clips | No |
| `reference/ac04/audio/` | Local extracted audio | No |
| `reference/ac04/transcripts/` | Local timestamped transcripts | No |
| `reference/ledger.md` | Derived text coverage ledger and verified source metadata (created in Phase 1) | Yes |
| `docs/specs/` | Derived mission, systems and story specifications (created later) | Yes |

`reference/ac04/` is gitignored. Only text derived from footage is committed: the ledger and specs. Transcripts never leave the gitignored folder; specs paraphrase dialogue by function rather than quoting it. Do not commit downloaded video, frames, audio, transcripts, source artwork or signed media URLs. Reference titles may be used in internal docs under D-001; shipped names and expression must be original.

The build Mac has about 14 GB free per the owner's brief. Use a 480p proxy for campaign indexing and fetch bounded 1080p clips for mission/detail inspection instead of retaining the full-resolution recording. Track actual dimensions, timestamps, hashes and coverage in the ledger; proxy capture alone is not visual inspection.

See [extraction recipes](../skills/video-reference-analysis/references/extraction.md). Tool installation and version verification are a separate assignment; this PR installs nothing system-wide and claims no footage inspection.
