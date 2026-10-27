# Roblox asset upload pipeline

SKYBREAK's realistic asset set (two fighters, two ace liveries and twenty world
props) is generated in Blender, checked locally, reviewed by an independent
reviewer, uploaded to Roblox as Model assets and only then switched on in the
game. Until an asset's ID is filled in, the game keeps using its procedural
path, so every step below can stop without breaking a build.

```
generate -> preview -> checklist -> reviewer -> upload -> moderation poll -> fill RobloxAssetIds.ts
```

Implementation agents never upload, never hold the Open Cloud key and never
call a Roblox web API. The coordinator does the upload after the reviewer
approves each asset.

## 1. Generate

Generators live in `tools/assets/` and are deterministic Blender Python:

| File | Contents |
| --- | --- |
| `skyasset.py` | Shared library: geometry helpers, procedural Cycles materials, PBR bake, previews, FBX export, checklist |
| `zones.py` | Surface recipes (concrete, painted metal, windows, corrugation, boards, foliage, rock...) |
| `aircraft.py` | Kestrel, Vanta and the Vanta ace liveries (v1) |
| `aircraft_v2.py` | Version 2 Kestrel, Vanta and ace liveries: shaped-section fuselages, intakes, cockpit, missiles (see [aircraft assets](aircraft-assets.md#version-2-aircraft)) |
| `compare_v1_v2.py` | Optional: renders `assets/roblox-upload/v1-vs-v2.png` from the exported FBX files |
| `world.py` | Frigate, oil platform, quay, containers, crane, hangar, tower, three city buildings, farmhouse, barn, silo, radar dish, relay mast, two trees, three rocks |
| `build.py` | Entry point: one asset per fresh Blender process |
| `build-all.sh` | Every asset, four processes at a time, then `write_manifest.py` |
| `write_manifest.py` | Validates every checklist, writes `assets/roblox-upload/manifest.json` and `src/shared/UploadedAssetSpecs.ts` |
| `contact_sheet.py` | Optional: tiles previews into one review image |

```sh
tools/assets/build-all.sh                     # everything (about 3 minutes on 8 cores)
tools/assets/build-all.sh kestrel frigate     # a subset, then the manifest again
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python tools/assets/build.py -- pine    # one asset, no manifest
```

Set `BLENDER` to use another Blender (5.2 is what the set was built with) and
`JOBS` to change parallelism. Logs go to `build/asset-<name>.log`.

Each asset is built in one Blender scene: pieces are authored with procedural
"zone" materials, joined into delivery meshes, triangulated, smart-UV-unwrapped
into one atlas and baked with Cycles into four textures (base colour, tangent
normal, roughness, metalness). Panel lines, windows, camouflage, rust, soot
and ambient occlusion are computed from world position and normals, so they
line up across separate pieces. Nothing draws glyphs.

Determinism: geometry, triangle counts, baked textures and checklists are
byte-identical between runs. The FBX differs only in its embedded creation
timestamp, and Eevee previews differ by GPU sampling noise, so a rebuild
shows those files as modified even when nothing changed.

`contact_sheet.py` makes `assets/roblox-upload/contact-sheet.png` (every 3/4
preview on one image) for a quick review pass.

Conventions: one Blender unit is one stud (1 stud ~ 0.28 m), Blender X right,
Z up, **-Y forward**; the FBX uses Roblox axes (+Y up, -Z forward). Aircraft are
centred on their bounding box; world props have their pivot at the bottom centre.

**FBX unit scale.** Roblox's Model import reads the FBX's centimetre values as
studs and ignores the file's unit metadata. The pilot upload proved it: the
Kestrel written at 0.28 m per stud (28 FBX cm per stud) imported at
644 × 172 × 754.6 studs, exactly **28×** its authored 23 × 6.143 × 26.95. The
generators therefore export at `FBX_METRES_PER_STUD = 0.01` (one FBX
centimetre per stud, `global_scale=0.01` in `skyasset.export_fbx`), so an
import arrives at the authored stud size. Each checklist records
`fbxMetresPerStud`. Folders without it are legacy 0.28 exports, which import
28× too large: today that is the four aircraft and the eight large props
other than the frigate. `manifest.json` lists each folder's
`expectedImportSizeStuds` and `gameSizeStuds`. The game rescales every import
regardless (see below), so both kinds work.

### Output per asset: `assets/roblox-upload/<asset>/`

| File | Purpose |
| --- | --- |
| `<asset>.fbx` | Mesh with the four textures embedded. Upload as a **Model**; this is the only file uploaded. |
| `<asset>-color.png`, `-normal.png`, `-roughness.png`, `-metalness.png` | The same textures for review (aircraft 1024², large props 512², small props 256²). Not uploaded: the Model import carries them. |
| `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png` | 1024² Eevee renders on a neutral background for review and moderation pre-check. |
| `preview-closeup.png` | v2 aircraft only: 1024² close-up of the cockpit and an intake (the canopy is rendered see-through as in game). |
| `checklist.json` | Name, triangle count and limit, objects, texture list and sizes, Roblox size in studs, ground offset, moderation booleans with notes, aircraft hinges and attachments. |

`manifest.json` lists every folder, its Roblox asset types and where the game
uses it. Everything here is committed (each file is well under 5 MB).

## 2. Preview

Open the four previews of every asset. The camera frames the whole asset; the
background is neutral grey; the 3/4 view is perspective, the others
orthographic. Check silhouette, scale cues, texture seams and that nothing
reads as text, a logo, a face or a real insignia.

## 3. Checklist

`checklist.json` must have `allChecksTrue: true`. The booleans and their
one-line notes are:

- `noText`: no letters, numbers or words anywhere in mesh or texture (no call signs, serials, squadron codes or hull numbers).
- `noLogosOrBrands`
- `noRealMilitaryInsignia`: no roundels, flags, real unit markings or real aircraft/ship copies.
- `noFaces`
- `noSuggestiveShapes`
- `noGoreOrWeaponsGlorification`: empty pylons and a covered naval gun are the limit.
- `originalDesign`

If any check would be false, change the generator until it is true; never
hand-edit a checklist. `write_manifest.py` fails if any check is not true, a
budget is exceeded, a texture is over its size limit or a file is missing.

Budgets: v1 aircraft ≤ 10,000 triangles and v2 aircraft 10,000-15,000, all with ≤ 1024² textures; frigate and oil
platform ≤ 6,000; trees ≤ 800; every other world prop ≤ 2,500. World textures:
large props ≤ 512² (frigate, oil platform, quay, crane, hangar, control tower,
office, apartments, city tower); small props ≤ 256² (trees, rocks, container
stack, farmhouse, barn, grain silo, relay mast, radar dish). `write_manifest.py`
enforces these per folder.

### Mobile texture budget

Illustrative residency at 4 bytes per texel (uncompressed RGBA, the upper
bound; Roblox's compressed GPU formats and streaming use less, so treat these as
capacity estimates, not measurements):

| Group | Maps | Base levels | With mips |
| --- | --- | --- | --- |
| 4 aircraft, 4 maps at 1024² | 16 | 64 MiB | ~85 MiB |
| 9 large props, 4 maps at 512² | 36 | 36 MiB | ~48 MiB |
| 11 small props, 4 maps at 256² | 44 | 11 MiB | ~15 MiB |
| **Whole set** | 96 | **111 MiB** (was 144) | **~148 MiB** (was ~192) |

A sortie only has the assets it places resident: the Kestrel, the Vanta and at
most one ace livery are 48 MiB of base levels. Each Model import uploads its own
copies of the embedded maps, so the liveries' identical normal and metalness
maps are not shared on Roblox.

## 4. Reviewer

An independent reviewer (not the agent that generated the asset) reads the
previews, the checklist and the generator diff, and records approve/reject per
asset in the PR. Only approved assets go further.

## 5. Upload (coordinator only)

For each approved folder, upload `<asset>.fbx` as a Model asset owned by the
experience owner (the user or the group that owns the place) with Open Cloud.
Upload nothing else from the folder: previews, checklists and the separate PNGs
are review evidence.

**Confirmed import behaviour (Kestrel pilot, asset 112234026185056,
2026-10-26):** the Open Cloud Model upload passed moderation, and
`InsertService:LoadAsset` returns a Model with one MeshPart per FBX object
(`Body`, `Aileron_L/R`, `Elevator_L/R`, `Rudder_L/R`). **Every MeshPart already
has a SurfaceAppearance whose ColorMap, NormalMap and other maps were
auto-uploaded from the textures embedded in the FBX.** No separate Image
uploads and no runtime map assignment are needed. Liveries (`vanta-vulture`,
`vanta-rusk`) are separate Model uploads that share the Vanta mesh.

The same pilot found the scale problem described under "FBX unit scale": the
import arrived 28× too large. Check after import: the aircraft has `Body` plus
the control surfaces (`Aileron_L/R`, `Elevator_L/R`, `Rudder_L/R` or `Rudder`)
and, for v2, `Canopy`, each with a SurfaceAppearance carrying all four maps
(Color, Normal, Roughness, Metalness); the size matches the manifest's
`expectedImportSizeStuds`.

## 6. Moderation poll

Poll the asset's moderation state until it is approved. If any asset is
rejected, halt the batch, record the reason and fix the generator; do not
retry an upload unchanged.

## 7. Fill `src/shared/RobloxAssetIds.ts`

Put the approved Model asset ID next to its key (the manifest's
`robloxAssetIdsKey`). That is the only code change needed to switch an asset
on. `bun run build` and the Jest specs still pass with any mix of set and
unset IDs.

## How the game uses an ID

- `src/shared/UploadedAssets.ts` loads an ID once on the server with
  `InsertService:LoadAsset` and keeps the BaseParts, dropping scripts and joints.
  It then validates them (`AssetSelection.AppearanceProblem`): every part must
  be a MeshPart with a SurfaceAppearance whose `ColorMapContent`,
  `NormalMapContent`, `RoughnessMapContent` and `MetalnessMapContent` are all
  set (`SURFACE_MAPS`), and an aircraft must have parts named exactly `Body`,
  every authored control surface and every glass part
  (`AssetSelection.RequiredAircraftParts`; the v2 `Canopy`). The canopy sits
  inside the body's bounds, so only the name check catches a lost or renamed
  one. No part is exempt from the four-map rule: every folder bakes all four
  maps into one atlas material, and the v2 Canopy uses that same material (its
  glass is a zone of the atlas). A plain untextured glass material would need
  an explicit per-part exception. It anchors the
  parts and scales the cached template with `Model:ScaleTo` to the in-game size
  (`AssetSelection.FitScale`: the longest side is matched, and each axis must
  then be within 5% of the expected proportions). Finally it moves the pivot to
  the authored origin. Callers clone the template.
  Any failure (load error, missing texture or part, absurd or misshapen size)
  warns once, is never retried in that server, and the caller falls back to the
  procedural asset.
- In-game size (`UploadedAssetSpecs.<name>.size`, written by
  `write_manifest.py`): aircraft are fitted to the length of the procedural
  aircraft in `assets/aircraft/*.mesh.json`, which cameras, targeting and
  effects are tuned for. The Kestrel is 26.0 studs long (gameScale 0.96475 of
  its authored 26.95), so the pilot import scales by 26 / 754.6 ≈ 0.0345 to
  22.19 × 5.93 × 26.0. The Vanta and its liveries are 26.4 long (gameScale
  0.95135). World props keep their authored real-world size (gameScale 1).
  Attachments and hinges in the spec are already in in-game studs.
- Aircraft: `BlenderAircraft.Populate` tries the uploaded model first, then the
  generated Blender meshes, then `JetFactory`'s part aircraft. Aces ask for
  their livery (`AssetSelection.LiveryForAce`: Vulture Lead/Two -> Vulture,
  Air Marshal Rusk -> Rusk) and fall back to the plain uploaded Vanta, then to
  a recoloured procedural Vanta. Trail and exhaust attachments come from the
  generator's authored positions. `GeometrySource` is `Uploaded`, `Blender` or
  `Fallback`.
- Control surfaces: hinge end points (model space) are in
  `UploadedAssetSpecs.<aircraft>.controlSurfaces` for future animation; the
  surfaces are welded rigidly today.
- World: `src/server/WorldAssets.ts` exposes `Place(name, parent, cframe)` and
  `PlaceUploaded(name, parent, cframe)`. `cframe` is the ground contact
  point (the waterline for the frigate, platform and quay) with -Z as the
  asset's front. Without an uploaded model, the frigate, platform, quay and
  buildings get a simple flight-solid part shape and the dressing props
  return `undefined` so the caller keeps its own Scenery primitives. Builders
  choose their fallback from the **placement result**: `GeometrySource` is
  `"Uploaded"` only when the uploaded mesh was placed. A first load can still
  fail after an ID is set. `PlaceUploaded(name, parent, cframe)` places only
  the uploaded mesh, or returns `undefined`. `WorldAssets.Has(name)` now loads
  and validates before answering, but it is only a planning hint. Placed parts
  are flight-solid (`CanQuery` with `FlightSolid=true`) like Scenery parts.

`Scenery.ts` and `RelayWorld.ts` do not call these hooks yet; the world
realism workstream wires them in.

## Known limits

- Small props bake 256² maps for the mobile budget; up close a barn or
  silo's boards and ribs are soft, but at flight distance they read the same.
- World textures are capped at 512², so the largest props (frigate 430
  studs, oil platform 317 studs, city tower 436 studs) carry roughly one
  texel per stud: hull seams, windows and grating read at flight distance but
  blur close up. A tiling trim-sheet material would be the next step.
- Trees are solid low-poly crowns (no alpha cards) to stay inside 800
  triangles and avoid transparency sorting on phones.
- v1 canopies are opaque tinted glass with no cockpit. v2 canopies are a separate
  `Canopy` MeshPart over a modelled cockpit; the loader sets its Transparency to
  `GLASS_TRANSPARENCY` (0.45). This has not been checked in Studio yet: if a
  SurfaceAppearance part ignores Transparency it still reads as dark tinted glass.
  The previews only approximate it (glass rendered at material alpha 0.60).
- Legacy folders (aircraft and large props except the frigate) are still 0.28 m
  per stud FBX exports and import 28× too large until they are regenerated and
  re-reviewed. The loader's rescale covers them, and covers any import route
  that treats units differently.

## Tests

- `src/tests/AssetSelection.spec.ts`: pure ID, candidate, livery, scale
  (the pilot's 644 × 172 × 754.6 import fitted to 22.19 × 5.93 × 26.0,
  correct-size imports, absurd ratios and wrong proportions) and
  SurfaceAppearance-validation rules (all four maps on every part, including a
  control surface and the canopy; exact `Body`, control-surface and `Canopy`
  names). Runs in Roblox Jest and in `bun run test:offline`.
- `src/tests/UploadedAssets.spec.ts`: Roblox Jest with an injected loader:
  all IDs unset keeps the procedural aircraft and never calls the loader. A set
  ID with textured MeshParts at the pilot's 28× scale is loaded once, scaled
  to the in-game size, cached and welded, and keeps its SurfaceAppearance. Bare
  MeshParts, a SurfaceAppearance without any map, a missing Color or Normal
  map, a missing Roughness or Metalness map on one control surface, plain
  Parts, a missing control surface and wrong proportions all fall back without
  retrying. A v2 import without `Canopy` (omitted or renamed) or missing any
  of the four maps on the body, a control surface or the canopy falls back to
  v1 (and to procedural geometry when v1 is unusable too). A
  failed load falls back and is not retried. Also covered: ace livery fallback
  order (including an untextured livery); world placement by ground offset at
  authored size, simple shapes and `undefined`; and a world fallback chosen from
  the placement result after a first load fails. Map setters are plugin-only,
  so the fakes mark maps with an attribute through the `probe` test hook.
