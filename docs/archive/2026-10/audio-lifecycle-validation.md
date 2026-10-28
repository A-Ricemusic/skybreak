# Audio reconciliation and integration validation

Baseline: `e69613b` (main). PR #45 already contains the root's 25 cue files, eight uploaded banks, SoundBank, upload records and audio tools byte-for-byte. Root GameAudio predates PR #48 voice ducking and PR #51 damageability checks. Root AudioRules also predates the 600 studs/s wind calibration. None of those older files should replace main. PR #53's voice-readiness work remains intact. Root was read only.

This change fixes SFX tween ownership (mute cancels a pending duck/release), releases all spatial loops and mission listeners on player death, suppresses gameplay cues during pause, refills missed missile slots without replaying launches, releases engines when their primary part changes, suppresses search for undamageable targets, and makes disposal terminal. Start still clears transient impact tails and telemetry state for a mission retry. Preload probes are released even when disposal occurs during loading; there is no unbounded retry scheduler.

## Offline checks

- `bun run build`
- `LUAU_BIN=/path/to/official/luau bun tools/test-audio-offline.ts`
- `LUAU_BIN=/path/to/official/luau bun tools/test-relay-offline.ts`

The audio runner executes compiled GameAudio against deterministic service doubles. It is a lifecycle simulation, not Roblox Jest, playback, human listening or phone testing. Its asset audit checks all 25 regions and loop flags against the upload plan and all eight bank hashes against recorded approvals in `uploaded.json`. Those approvals were recorded on 2026-10-26; this is not a live moderation/experience-permission query. Existing `verification.json` is historical evidence, not a report from this change.

## Integration owner: Studio

1. Build this head in the integration checkout. In the intended experience's Studio client Play session, run the contents of `tools/check-audio.client.luau` as a LocalScript. Inspect `Players.LocalPlayer.PlayerGui.SkybreakAudioQA`: require `State = Passed` (or inspect the script's error report), `CueCount = 25`, `AssetCount = 8`, `FetchFailures = 0`, and all region checks completed. Record actual output and any denied asset IDs. Never run uploads or generation to resolve a permission failure.
2. Fly at 800, cruise, and 3000 mph. Listen for smooth cruise/burn/wind changes without restarting loops. Inspect `SoundService.SkybreakSFX` and confirm three player loops. Acquire a grey TRACK contact: no search or acquired tone. Acquire a damageable contact: search then one acquired tone. Switch contacts and repeat.
3. Combine incoming missile, hull <=25, boundary and lock search conditions: only one warning loop, priority incoming > low hull > boundary > search. Remove each higher priority condition and verify the lower one resumes.
4. During radio speech and during its half-second release fade, move SFX volume to zero. Wait at least one second: `SkybreakSFX.Volume` must stay zero. Restore volume; verify ducking still works and voice volume remains independent.
5. Pause during a missile salvo. Existing loops pause; no new gameplay hit, launch, flyby or warning cues start. Resume: loops and newly observed motors recover without replaying launch sounds. Existing one-shots may finish naturally. UI confirmation/result sounds remain available.
6. Sustain missile/combat activity: count live `SFX_missileMotor` <=12, `SFX_enemyEngine` <=8, transient sounds <=18, and warning loops <=1. Destroy a tracked missile and confirm its slot can be reused. Let an enemy despawn or replace its PrimaryPart and check no stale engine persists.
7. Die during a busy fight: no player engine, missile motor, enemy engine or warning loops remain. Explosion tails may finish for four seconds. Retry at least ten times; each retry clears old impacts and starts three player loops with fresh lock/denial/evade state. Return to menu and destroy the controller: no SkybreakAudio folder/group or stale callbacks remain. Repeat once with delayed asset loading; no growth in preload probe ownership after disposal.

## Integration owner: existing published build

No publishing is authorized for this child. After the parent/owner's separately authorized release, join the intended published experience with a normal permitted player account, including a real phone. Repeat the engine, warning, mute, death and retry checks; record device/OS, place version, audio output, and permission/loading errors. Confirm all eight asset IDs in `SoundBank.ts` are playable for that experience, since Studio owner access does not prove published access. Do not remove the Studio-only assertion from the QA script. Human listening must separately assess loop seams, bank bleed and relative levels; automated hash and lifecycle checks cannot establish those qualities.

Integration risks: death now disconnects folder tracking immediately while preserving explosion tails; validate event order in a real death/retry. Missile reconciliation scans the existing mission folder at 10 Hz alongside enemy scanning; budgets are unchanged. Roblox's native PlaybackRegion, Pause/Resume, Debris timing and asset loading behavior remain live-validation requirements. No asset IDs, audio binaries, combat rules or voice playback implementation changed.
