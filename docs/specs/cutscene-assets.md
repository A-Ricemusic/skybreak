# Cutscene assets: inventory and modernization plan

Written 2026-10-29 for the owner's request "please modernize the assets used in cut scenes". Scope is the Broken Relay story cinematic (`src/client/RelayCinematic.tsx`), the only cutscene system in the game: one chapter plays before each mission and the finale after mission 18 (D-030). Chapter numbers below follow the 18-mission story (PR #159: chapters 0–18); code and tests find story-driven chapters by their `RelayStory` content, not by number. In-mission presentation (mission 1's carrier fly-off, briefings, results) is out of scope; it already uses the uploaded carrier and Kestrel v2.

Direction: realistic, original Blender assets through `tools/assets/` (D-023), consistent with the uploaded Kestrel v2, Vanta v2, carrier and bomber; no third-party assets; no figures. Every new Blender asset passes the AGENTS.md upload safety gate before it reaches Roblox. Cinematic timing, text, voice, camera poses and input are unchanged by this work.

## How a cutscene is built

- `RelayCinematic.sceneFor` builds a stage 6,000 studs above the world for the chapter: a radio desk with its props, the empty instructor's chair, a parked Kestrel, the chapter's story subject (truck, launch or relay mast), and scenery chosen by the chapter's `scene` (hangar, canyon, farm, relay, harbor, city or sea).
- `CinematicStaging` holds the pure tables: mood lighting (`moodLighting`), camera poses per shot (`shotPose`), prop anchors and story-driven prop rules (tapes in the tin, the recorder's lid, Sera's board, the burned orchard, the aurora).
- The server publishes `ReplicatedStorage.RelayStoryModels` (`src/server/index.server.ts`). The client clones what it finds there and falls back per model to part-built stand-ins.
- Text (`RelayStory`, `StoryDocuments`), voice (`VoiceLines`, `VoicePlayer`), speaker chips and the caption panel (`CinematicLayout`) are UI and audio, not 3D assets. They are unchanged.

## Inventory (before this PR)

"Dated" is a judgement from code and from earlier in-engine passes (docs/broken-relay.md, "Cutscene visual pass"). The before screenshots under `docs/qa/cutscenes/` exist only if a Studio capture was possible (see "Studio captures" below).

| Asset | Where used | Current form | How dated | Screenshot-worthy problems |
|---|---|---|---|---|
| Parked Kestrel (`CinematicKestrel`) | Every chapter; second airframe in hangar chapters | `JetFactory.Create` → uploaded Kestrel v2 (approved, `133879661006824`), procedural fallback | Modern | None; already the approved v2 model. |
| Hangar (`CinematicHangar`) | Hangar chapters (0, 1) | Uploaded hangar (approved, `128288825519992`) | Acceptable | Older 4-preview asset; reads as a shelter. |
| Radio desk (`CinematicDesk`) | Every chapter, every desk shot | Blender mesh.json via EditableMesh (`tools/build-cinematic-props.py`), flat material colours, no textures | Medium | Untextured flat colours next to the textured jet. |
| Instructor's chair (`CinematicChair`) | Every chapter, chair shot push-in | Blender mesh.json via EditableMesh, flat colours | Medium | Untextured; the chair shot fills the frame with it. |
| Teal's receiver | Every chapter; the default radio shot is centred on it | One 7 x 4 x 3 metal Part, a neon strip, two cylinder Parts with a spoke as reels | Very dated | A grey box with two flat discs on its face: the most-seen object in every cutscene. |
| Field recorder | Recorder close-ups; lid open in the recovery chapter (16, "The last fracture") | DiamondPlate box with five small detail Parts and a neon lamp | Very dated | The recorder close-up fills the screen with a box. |
| Sera's status board | Every chapter (beside the desk); chapter 5 wipes Teal's strip | Slate Part on a single post (post sunk below the floor), three strip Parts | Dated | A slab on a stick. |
| Coffee tin of tapes | Chapter 1 onwards | Cylinder Part with box cassettes | Dated | A red cylinder. |
| Flight chart and document | Evidence shot | Paper Part with a SurfaceGui document | Acceptable | Legible by design; keep as is. |
| Stage floor | Every chapter | One 700 x 700 slate slab (glass at sea) | Very dated | Same grey slate under farm, canyon, city and harbour. |
| Scenery: city, canyon, farm, relay, harbour | Every non-hangar, non-sea chapter (wide, sky and chair shots) | Seven coloured blocks behind the desk; city adds neon window strips | Very dated | Seven boxes in a row; the radio shot looks the other way, at empty floor. |
| Relay mast ring | Relay chapters (6, 7, 10, 11, 13, 17) | Five grey cylinder Parts | Dated | Plain sticks around the uploaded-style relay subject. |
| Sea scenery | Chapter 8 ("The frigate ring"); the old storm-platform chapter is cut from the 18-mission story | A concrete block on a glass slab; nothing at sea | Very dated | No ships in the frigate chapter. |
| Story subjects (`RelayTruck`, `HarborLaunch`, `CommsRelay`) | Farm, harbour/sea, other chapters | Blender mesh.json via EditableMesh, flat colours | Medium | Shared with live missions (PhaseDirector), so out of scope for a cinematic-only change. |
| Aurora | Night relay chapters | Thin neon bars | Acceptable | Reads as curtains at distance; unchanged. |
| Post-processing | Every chapter | None of its own; inherits the world's grade and bloom | Dated | Flat contrast, no depth separation in close shots. |

## Modernization plan (priority order)

1. **Scenery from already-approved uploads (done, code only, no upload).** `CinematicSet.backdropFor` places approved models around the desk: city blocks and towers, farm buildings and a broadleaf orchard (charred stumps once it burns in chapter 9, "Walking the storm"), scaled rocks for the canyon, pines, a radar dish and five relay masts for the relay chain, quay, cranes and container stacks for the harbour, frigates for the frigate ring (chapter 8). A second band stands in front of the desk so the radio shot, the most common shot, has a background. Every spot whose model has not replicated, or fails to place, gets its own part-built stand-in sized from that asset (ships float at their waterline), and the story subject gets one too; partial availability never leaves a gap.
2. **Stage ground and post-processing (done, code only).** Per-scene ground (`stageGround`: sandstone canyon, grass or burned ground farm, rock relay, asphalt city, concrete harbour with a strip of water, a sea slab that runs out to the storm fog). A local mood grade (`moodGrade`), soft sun rays at dawn and dusk when the world has none, and depth of field that follows the shot (`shotDepth`; wide, sky and cards stay sharp). Phones keep their budget: `MobileGraphics` disables sun rays and depth of field as they are added. All effects are destroyed on unmount.
3. **New Blender desk props (done: approved at 10/10, uploaded, moderation-approved, wired).** The four most-seen dated props, at the procedural envelopes the camera poses were tuned for. Independent review: `docs/qa/asset-reviews/2026-10-29-pr152-review-1.md` and `approvals/cinematic-*.json`. `RobloxAssetIds`: radio console `107763051422036`, field recorder `87111261775563`, status board `105938775214679`, tape tin `86951943477271`. The cinematic keeps its procedural prop whenever a load fails. Import orientation and scale have not been checked in Studio yet (it is signed out).
   - `cinematic-radio-console`: field radio with a reel-to-reel deck; two reel parts spin while a tape or the log speaks.
   - `cinematic-field-recorder`: handheld cassette recorder; its `Lid` part opens on its hinge in the recovery chapter (16); the game keeps its blinking neon lamp on the lens. (Its checklist's `usage` and `reviewStatus` text predate the remap and the approval; the approved export is deliberately left byte-identical.)
   - `cinematic-status-board`: rolling slate board on a two-post stand; the game keeps its three name strips (chapter 5's wipe logic unchanged).
   - `cinematic-tape-tin`: open coffee tin; the game keeps standing the remaining cassettes in it.
4. **Textured desk and chair (next).** Re-author `CinematicDesk` and `CinematicChair` as textured FBX uploads in `tools/assets/` (today they are untextured EditableMesh). Same envelopes; same gate.
5. **Story subjects (later).** Textured uploads for `RelayTruck`, `HarborLaunch` and `CommsRelay`. They are also live mission targets, so they need their own PR with mission checks.
6. **Briefing room or ops tent (not planned).** A room set would change the established composition (desk in the open with the jet and subject behind it) and occlude the shots; not recommended unless the owner wants a different cutscene look.

Human figures: none are planned. If a later set ever needs crew, they must be fully clothed (flight suits, helmets with visors down) with no visible faces or skin textures, and pass the gate like any other asset.

## Budgets

| Asset | Export version | Triangles (limit) | Texture | Size (studs) | FBX SHA-256 | checklist.json SHA-256 |
|---|---|---|---|---|---|---|
| `cinematic-radio-console` | `cinematic-radio-console-1` | 3,068 (3,500) | 512 | 7.34 x 7.02 x 3.54 | `8398f60a2363852be9e900dc146c211fb190e7faf4c92484c364ded70e4e0ca6` | `51e20e58db679ef8c8044210865c55ec47bd71d65ba16d14667d89ce2cd36453` |
| `cinematic-field-recorder` | `cinematic-field-recorder-1` | 864 (1,800) | 512 | 2.14 x 1.11 x 3.32 | `0ec0ad7de0cd375e6dc20c6c558581fc153a8ae27aee1f477b0bf5f1d40a13da` | `469c0ac7c9c1305b34b3f6f67493956cb9030e03d3bfdcb195659c5dfb6e944b` |
| `cinematic-status-board` | `cinematic-status-board-1` | 744 (1,800) | 512 | 5.24 x 9.53 x 2.44 | `313dc862ef36680c52aeb3b9756c2f6a5a737fbe369f5dc660f492c42dbd94f8` | `1ca8d0ea4f4ddc440f4e26dbc4fa6cad8d60c27fa0e7f794b7d7049493d11e56` |
| `cinematic-tape-tin` | `cinematic-tape-tin-1` | 896 (1,200) | 256 | 1.90 x 1.71 x 1.90 | `e65aa071ff3441468603abe610412cf6d5824a14e5a23f761ef2ccd61f3a913a` | `a35e34bd17f20faeac10d71bb60d13e7aa66f685e2ae0da1772891aa761deff7` |

Each folder holds the FBX (textures embedded), its four PBR maps, 15–18 previews (front, sides, back, top, bottom, low and high front, four 3/4 views, close-ups including one from the cutscene camera's direction) and `contact-sheet.png`; `checklist.json` lists a SHA-256 for every other file. The creator self-checks are recorded in each checklist, but approval must come from an independent reviewer. A composite of all four exported FBXs seated on a desk stand-in, rendered from the radio, recorder, wide and board directions, is in `docs/qa/cutscenes/2026-10-29/blender-set-preview/` (`tools/assets/cinematic_set_preview.py`); it is a review aid, not an upload.

Design notes for the reviewer: the console's front is deliberately asymmetric (long window and small meter on the top row; wide grille, one knob, two stacked small knobs and three stacked toggles below) after a draft with a meter and grille either side of a central knob read too much like a face; its reels lie flat on top, staggered, with different tape packs. The recorder has no paired features on any face (strap lugs were removed for the same reason). The status board's three thin ledges carry the game's blank name strips.

The whole new desk set is under 6,000 triangles, well inside the phone budget for a scene that otherwise holds one jet. The approved scenery is the same models the mission worlds already load; a cutscene places at most about 20 of them.

## Seating contract

Each prop checklist records `anchors` (Roblox model space, from the bottom-centre pivot): `Body` (console housing centre, desk-relative (0, 7, 0)), `FrequencyWindow` (window face, where the teal strip glows), `Centre` (recorder body centre; tin centre), `Lamp` (recorder lens), `Board` (slate centre, the `BOARD` point). `write_manifest.py` copies them into `UploadedAssetSpecs` with the reel `rotors` and the recorder's `controlSurfaces.Lid` hinge. `RelayCinematic.seatProp` places a model with `PivotTo(target * CFrame.new(-anchor))`.

## Activation after approval (done 2026-10-30 for all four)

1. An independent reviewer (not this asset's creator) reviews each folder at its exact export version and writes `docs/qa/asset-reviews/approvals/<folder>.json` (AGENTS.md gate, 10/10 required).
2. The coordinator uploads only the approved FBX with `tools/upload-models.py` and waits for moderation.
3. Set the asset's `RobloxAssetIds` entry. No other code change is needed; the server places it in `RelayStoryModels` and the cinematic prefers it.
4. Check the radio, recorder (including the recovery chapter 16), evidence and wide shots in Studio at desktop and phone aspect.

## Studio captures

See `docs/qa/cutscenes/` for what was captured and what was not.
