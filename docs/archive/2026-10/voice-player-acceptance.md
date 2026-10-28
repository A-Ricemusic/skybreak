# Published cutscene dialogue acceptance

The reported failure is silence on a mobile device in the published Roblox Player,
place **112911685457826**, universe **10772984313**. The user additionally reports all custom effects silent while the built-in
mission-one water splash is audible. Custom-asset authorization is therefore the
leading candidate, but the runtime cause is not yet established. A separate stale local place has no voice consumer/modules; that is
an independently reproducible artifact defect, not an explanation of the mobile
report. Neither local bank audio, Studio place/game 0, preload success, nor
Sound.IsPlaying proves audible output in this experience.

At origin/main a40ccb8c2e941673d9e4d38e605d626e0732e366, RelayCinematic's mount
effect calls speak(0), and goTo calls speak(index). Both resolve Voice.Story with
chapter, zero-based beat, and exact displayed text, then call VoicePlayer.Play.
All 165 beats in 28 chapters match existing recordings; the 464 cue regions and
six bank hashes match their manifests. MobileGraphics has no audio branch.
VoiceVolume defaults to 1; the cutscene group is 1 and its master follows that
setting. Voices use non-positional Sounds and explicit bank playback regions.

This change does not regenerate/reupload recordings, substitute dialogue, or
change playback timing/regions. It makes missing/failed dialogue visible after
loading, includes experience/version context in fetch/timeout diagnostics, and
rejects missing or stale packaged voice scripts before an upload. The gate
compares eight script sources against compiled output, and checks that the
compiled cinematic actually requests recorded dialogue. It does not establish
that all compiled files are fresh relative to TypeScript: use build:place, which
compiles before packaging/checking. Manually bypassing the publish script also
bypasses the gate.

## Reproducible local checks

- `bun run build` compiles the production consumer and player.
- `LUAU_BIN=/path/to/luau bun run test:voice:offline` requires the standalone Luau
  CLI, ffprobe and Python 3. It checks all recorded story text/speakers, original
  bank hashes, encoded durations, all cue regions, and executes the compiled
  cinematic lifecycle plus real VoicePlayer against deterministic service and
  hook doubles. Scenery/lighting construction is excluded. This is not a React
  renderer or a native audio test. It covers mount and manual advance for all
  165 beats, natural advance, pending load, pause/resume, cancellation, volume,
  missing exact text, and visible timeout fallback. Artifact tests cover absent,
  stale, and wrong-class modules, including equally stale out/place consumers.
- `python3 tools/check-place-voice.py path/to/place.rbxlx` is read-only. The
  known stale local root place fails it. The normal build:place and publish
  commands now invoke it automatically. Do not run publish for verification.
- Removing the compiled mount-time `speak(0)` from the generated harness must fail
  at chapter 0 beat 0 (expected one voice). This guards the actual consumer call,
  rather than only checking a cue table or a preloaded bank.

No Studio, Rojo, live test, deployment, permission change or audio capture was
performed by the implementation agent.

## Required official Player acceptance (parent/live tester)

1. Record the actual published PlaceVersion and confirm its deployed client has
   RelayCinematic's Voice.Story/VoicePlayer.Play calls, VoicePlayer, VoiceBanks,
   VoiceCues and boot preload. Correlate with the build/commit being evaluated;
   an unpublished Studio edit is insufficient.
2. Verify all fourteen existing custom audio assets (six voice banks plus eight
   SFX/engine/wind assets) are authorized for universe 10772984313, Use only, with
   no public grant or dependencies. `bun tools/audio-use-allowlist.ts` validates
   the exact current IDs against VoiceBanks/SoundBank, uploaded approval records
   and all fourteen local hashes, then writes
   `build/voice-offline/audio-use-allowlist.json`. This is a plan, not evidence of
   a queried or applied grant.
   Record the actual grant/query results or exact denial errors. Moderation
   approval and an uploader's ability to preview audio are not experience grants.
   Do not regenerate or reupload existing approved recordings.
3. Join that published version on the affected mobile device. At nonzero Roblox,
   device and in-game VoiceVolume, record actual output while chapter 0 naturally
   plays TEAL b00 (0.250–8.269), SERA b01 (8.519–15.793), and TRAINEE b05
   (33.874–37.627), all from bank 96143096268975. Listen to the capture and verify
   spoken words/speaker match the displayed text. If device capture excludes game
   audio, use an external recording; do not count an empty capture as success.
4. Alongside the output capture retain per-cue SoundId, IsLoaded, TimeLength,
   TimePosition progression, PlaybackRegion, PlaybackLoudness samples, Sound and
   group volumes, fetch status, and Output errors with universe/place/version.
   IsPlaying alone is insufficient; loudness/position are corroboration, not
   proof of speaker/headphone output.
5. Capture audible custom engine/UI/explosion effects as well as dialogue; retain
   the built-in splash versus custom-audio comparison and exact fetch failures.
   Check a later cutscene bank, cold start, pause/resume, next, skip, cancel and
   re-entry on mobile. Force an unavailable bank separately: loading is bounded,
   fallback is explicitly labelled, controls remain responsive, and no wrong
   recording is substituted. Preserve normal recordings and settings afterward.

Only matching audible dialogue from the official published mobile Player closes
the reported issue. Until then the runtime failure and final acceptance remain
open, even if every local check passes.
