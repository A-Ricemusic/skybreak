Cinematic review

Independent branch from origin/main 5cbae26; does not include targeting PR #51.
No flight inputs, movement physics, live Studio session or publishing changed.
No applicable root/ancestor AGENTS.md was present; the nested react-agent-testing
instructions are outside this change.

Audio

Previously every first Play started background preload, played/seeks an unloaded
Sound and allowed the story timeline to advance; an unloaded Sound was discarded
after four seconds. Boot now warms the six uploaded banks. Each handle waits for
IsLoaded, seeks its cue and then plays. A pending cutscene handle holds the beat
clock, not subtitle presentation/fade-in. Pause freezes playback and its loading
deadline. NEXT/SKIP/cancel stop the pending handle, so they never wait for loading.
Retry preload once at five seconds; at twelve seconds warn with cue and bank ID
and resume subtitle timing. Suppress another wait on that failed bank for sixty
seconds, then allow recovery. Missing/unuploaded cues retain subtitle timing.
Loading dialogue is visible; Sound.VoiceState records Loading/Playing for diagnosis.

Local bank evidence: ffmpeg volumedetect on voiceBank01.ogg from 8.519 to 15.793
seconds (story.c00.b01) reports mean -15.2 dB and peak -1.3 dB. The local source
is not silent. Runtime authorization/moderation/volume/device failures are NOT
proven or ruled out by this result. No experience playback was performed because
the flight agent owns Studio. No asset permissions were changed.

Visuals

The cinematic previously ignored uploaded world scenery and copied the menu-scaled
jet. The server now provides a canonical Kestrel and the approved uploaded Hangar
in RelayStoryModels; story subjects retain their existing independent mesh path.
A missing template or fallback GeometrySource emits an explicit warning.

Original Blender chair: 1080 triangles, 576 vertices, three material groups.
Original Blender desk: 2280 triangles, 1200 vertices, four material groups.
Canonical JSON exports are committed; build-cinematic-props.py reproduces them
and validates bounds, counts and triangle areas through the existing exporter.
Run Blender --background --python tools/build-cinematic-props.py -- --render
for local inspection PNGs. Props use the existing server static mesh pipeline;
if the platform rejects mesh generation, the legacy props remain with warnings.
No downloaded/third-party assets or new Roblox uploads are used.

Furniture rests on its measured bounds at floor y=0. Chair now faces the camera,
and chair camera height is 2.2 -> 5.8 studs. Primary aircraft position changes
(-40,7,-60) -> (-24,5,-28); secondary (70,7,-150) -> (28,5,-44), with no inherited
menu scale. Wide camera moves closer and the sky camera clears the nearer jet.
This is a bounded scene improvement, not a claim of a complete photoreal interior;
receiver/recorder and other small story details retain their procedural geometry.

Validation

- bun run test:offline: 484 passed, zero failures; build passes.
- bun run build:place: production place successfully built, never published.
- Blender exporter validation: both props pass; generated inspection PNGs reviewed.
- Pure tests cover delayed load/timeline, pause, retry/timeout, and perspective
  framing of the primary jet in landscape/portrait wide shots and hangar bounds.

Studio acceptance to commission separately

1. Use a cold-cache client in the actual experience. Play chapter 0 beat 1; verify
   bank 96143096268975 starts at 8.519, stops at 15.793 and is audible at normal
   VoiceVolume. Capture Output fetch statuses/errors, Sound.IsLoaded/IsPlaying,
   Sound.TimePosition, Sound.VoiceState, SoundGroup volumes and experience ID.
   If fetch fails, verify the asset's grant to that exact experience; moderation
   approval by itself is not evidence of an experience permission grant.
2. Simulate slow loading: subtitle/fade remains readable, playback receives its
   full cue duration after readiness, NEXT/SKIP/cancel work immediately. Pause
   before/after readiness then resume. Test permanently denied bank: one retry,
   bounded subtitle fallback, no twelve-second stall on every subsequent line.
3. Test missing/unuploaded cues, VoiceVolume=0, radio ducking, next during a fade,
   chapter completion/cancel/re-entry; no lingering Sounds or stage/lighting.
4. Inspect chapter 0 wide/chair/sky/evidence/recorder at desktop 16:9, phone
   portrait/landscape and short safe roots; full chair seating side, readable
   evidence, nearer aircraft, no wall/mesh camera clipping. Check all moods,
   especially a roofed night hangar, and later non-hangar story subject shots.
5. Confirm RelayStoryModels.CinematicChair/Desk GeometrySource=Blender and Kestrel
   Uploaded or Blender. Confirm the cinematic contains Uploaded hangar. Force
   unavailable assets and confirm warnings plus intentional legacy fallbacks.
6. Measure phone frame time and memory during entry and after repeated skip/replay;
   original furniture totals seven rendered material meshes and 3360 triangles.
   The canonical Kestrel and PBR hangar reuse the existing cache and mobile LOD.

Runtime audio, final art acceptance and GPU performance remain unverified.
