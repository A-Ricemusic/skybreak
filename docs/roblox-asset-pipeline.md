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
| `aircraft.py` | Kestrel, Vanta and the Vanta ace liveries |
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

Conventions: one Blender unit is one stud (1 stud ~ 0.28 m), Blender X right,
Z up, **-Y forward**; the FBX is written in metres at 1 stud = 0.28 m with
Roblox axes (+Y up, -Z forward). Aircraft are centred on their bounding box;
world props have their pivot at the bottom centre.

### Output per asset: `assets/roblox-upload/<asset>/`

| File | Purpose |
| --- | --- |
| `<asset>.fbx` | Mesh with the four textures embedded. Upload as a **Model**. |
| `<asset>-color.png`, `-normal.png`, `-roughness.png`, `-metalness.png` | The same textures (aircraft 1024², world 512²). Upload as **Image** only if the FBX import drops a map. |
| `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png` | 1024² Eevee renders on a neutral background for review and moderation pre-check. |
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

Budgets: aircraft ≤ 10,000 triangles with ≤ 1024² textures; frigate and oil
platform ≤ 6,000; trees ≤ 800; every other world prop ≤ 2,500; world textures
≤ 512².

## 4. Reviewer

An independent reviewer (not the agent that generated the asset) reads the
previews, the checklist and the generator diff, and records approve/reject per
asset in the PR. Only approved assets go further.

## 5. Upload (coordinator only)

For each approved folder, upload `<asset>.fbx` as a Model asset owned by the
experience owner (the user or the group that owns the place), with Open Cloud
or Studio's 3D Importer. The importer should create one MeshPart per FBX
object with a SurfaceAppearance carrying the embedded maps; if a map is
missing, upload that PNG as an Image and set it on the SurfaceAppearance in
Studio, then publish the Model. Liveries (`vanta-vulture`, `vanta-rusk`) are
separate Model uploads that share the Vanta mesh.

Check after import: the aircraft has `Body` plus the control surfaces
(`Aileron_L/R`, `Elevator_L/R`, `Rudder_L/R` or `Rudder`); the size matches
`robloxSizeStuds` (the loader rescales anyway); nothing is anchored to odd
pivots.

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
  `InsertService:LoadAsset`, keeps the BaseParts (dropping scripts and joints),
  anchors them, rescales to the authored stud size from
  `UploadedAssetSpecs.ts` and moves the pivot to the authored origin. The
  template is cached; callers clone it. A failed load warns once, is never
  retried in that server, and the caller falls back.
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
  helpers (`PlaceFrigate`, `PlaceOilPlatform`, `PlaceQuay`,
  `PlaceContainerStack`, `PlaceGantryCrane`, `PlaceHangar`,
  `PlaceControlTower`, `PlaceOffice`, `PlaceApartmentBlock`, `PlaceCityTower`,
  `PlaceFarmhouse`, `PlaceBarn`, `PlaceGrainSilo`, `PlaceRadarDish`,
  `PlaceRelayMast`, `PlaceTree`, `PlaceRock`). `cframe` is the ground contact
  point (the waterline for the frigate, platform and quay) with -Z as the
  asset's front. Without an uploaded model, the frigate, platform, quay and
  buildings get a simple flight-solid part shape and the dressing props
  return `undefined` so the caller keeps its own Scenery primitives;
  `WorldAssets.Has(name)` tells a builder which path it is on. Placed parts are
  flight-solid (`CanQuery` with `FlightSolid=true`) like Scenery parts.

`Scenery.ts` and `RelayWorld.ts` do not call these hooks yet; the world
realism workstream wires them in.

## Tests

- `src/tests/AssetSelection.spec.ts`: pure ID, candidate, livery and scale
  rules. Runs in Roblox Jest and in `bun run test:offline`.
- `src/tests/UploadedAssets.spec.ts`: Roblox Jest with an injected loader:
  all IDs unset keeps the procedural aircraft and never calls the loader; a set
  ID is loaded once, normalised, cached and welded; a failed load falls back
  and is not retried; ace livery fallback order; world placement by ground
  offset, simple shapes and `undefined`.
