---
name: video-reference-analysis
description: Inspect timestamped video segments to describe visible content or derive evidence-backed game, UI, cinematic, and world requirements. Use for reference footage analysis and implementation comparison; a video link or transcript alone does not establish visual inspection.
---

# Video reference analysis

Turn an accessible video segment into inspected visual evidence, explicit unknowns, and—when requested—implementation requirements. Analysis does not authorize implementation, asset uploads, publication, or resuming paused development.

## Establish the segment and purpose

Accept a video URL or local file plus start/end timestamps and a label such as “first mission,” “aircraft selection,” or “opening cutscene.” The user need not manually edit the recording. If timestamps are absent, locate the requested sequence and state its boundaries; clarify only if genuinely ambiguous.

Use these as working sizes, not model limits:

- Menus/UI: 30 seconds–3 minutes, including selection, confirmation, and Back.
- Cutscenes: 2–5 minutes; preserve a complete scene where practical.
- Gameplay: 5–15 minutes per segment; split longer missions at objective or encounter transitions.
- Long recordings: index and process meaningful segments, maintaining a coverage ledger. Do not imply that indexing or sparse sampling constitutes complete viewing.

Adapt sampling to the question. A still composition, an animation transition, and enemy arrival timing require different evidence.

## Acquire and verify usable evidence

Use available video tools or retrieve the requested interval with `yt-dlp` and extract frames with FFmpeg. Read [extraction.md](references/extraction.md) for commands, timestamp handling, and an evidence-record example.

Before describing content, verify that the tools actually returned usable video/images. A watch-page shell, metadata, transcript, downloaded-but-unopened image, or failed image-tool response is not visual evidence. Storyboard thumbnails can locate scenes; tiny or enlarged thumbnails do not establish fine typography, geometry, expressions, or markings.

Prefer readable source-resolution frames. Record the actual retrieved dimensions; a “1080p” title is not verification of image detail. Extracted/upscaled footage may still contain low-detail original imagery.

If access fails, make a bounded attempt using another applicable method. State the remaining limitation and request the specific missing clip or reference when necessary. Do not silently substitute other footage, general game knowledge, or inference for inspection of the supplied video. Identify any supplementary sources separately.

## Inspect sequences and details

1. Sample the complete requested interval for an overview; every two seconds is a starting point for slowly changing scenes, not a universal coverage guarantee.
2. Open the resulting contact sheets and full-resolution key frames with an actual image-viewing tool. Successfully creating files is not inspection.
3. Inspect transitions, brief overlays, input feedback, fast action, and uncertain events more densely, using consecutive frames or supported playback. Coarse samples can miss these entirely.
4. Track actual shot/state order, camera framing, holds, transitions, and visible interactions. Measure timing from the recording when timing matters; do not invent it from a still.
5. Treat audio separately. State whether narration, music, sound effects, or only subtitles/transcripts were examined. Reading captions is not listening; a transcript alone does not establish delivery or sound design.

For a visual description, report the observed sequence and presentation. Separate visible facts, subtitle/narrative context, and interpretation. Do not identify an unreadable number, insignia, character, or aircraft variant as visually confirmed.

## Derive requirements when requested

Capture evidence relevant to the requested surface:

- **UI:** screen states and navigation, hierarchy, proportions, typography, color, selected/disabled states, maps, captions, transitions, and interaction feedback.
- **Story:** shot sequence, subjects/poses, recurring visual identities, environment, framing, lighting, art style, holds and transitions; distinguish artwork from playback controls.
- **Mission:** briefing, start position/heading, objectives, enemy groups actually encountered, arrivals, phase changes, return/rearm, failure evidence and debrief.
- **World:** terrain silhouette, coastlines, landmarks, relative placement, sightlines, route distances and traversal times. Cross-check maps or telemetry before asserting exact scale; camera perspective and one flight path are insufficient.

One successful playthrough does not prove every enemy count, hidden trigger, optional encounter, failure rule, difficulty variant, or off-screen location. Label observed, inferred, independently corroborated, and unknown requirements. Keep source-native units separate from proposed adaptation units.

Maintain a coverage ledger: requested intervals/surfaces, intervals and frames actually inspected, timestamp precision, source resolution, audio coverage, gaps and supplementary sources. Do not mark a whole mission “reviewed” because a few screenshots were examined.

## Compare before expanding an implementation

Apply this section only when implementation/comparison is authorized:

- Identify the accepted project revision and the existing controls, combat, models and UI to preserve. Reference footage does not automatically authorize replacing working components.
- Build one bounded visual or gameplay slice first. Compare the actual rendered output against readable reference frames and the accepted baseline at comparable framing/viewport sizes.
- Record concrete matches, mismatches and regressions separately from functional test results. Rendered presence, TextFits, test counts or scripted mission completion do not establish visual quality, input usability or human flight feel.
- Unresolved required reference coverage, rejected fidelity, or an unaccepted regression blocks the affected replacement from being represented as ready. Obtain the required acceptance under the project's existing process before broadening or shipping it; do not invent an extra approval process for simple analysis.
- Keep temporary geometry explicitly temporary. Do not replace accepted assets with placeholders merely to make a mission runnable. Reference screenshots are research evidence, not automatically authorized production assets.

## Deliver and preserve scope

Scale the output to the user’s request. A short visual question can be answered directly with inspected details and limits. A specification should include timestamped observations, key-frame paths/links, requirements, unresolved questions, and comparison criteria. Do not equate captured frames with inspected frames or observed gameplay with simulated results.

For SKYBREAK work, keep evidence outside `docs/human/`. When findings change product decisions, implementation, readiness or release state, reconcile the affected content in all four human HTML documents as required by AGENTS.md; a standalone read-only question does not itself resume game development. Follow existing exact-asset review and publication rules.
