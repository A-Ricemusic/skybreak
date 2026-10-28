# Blender aircraft pipeline

There are two aircraft paths. The **uploaded** path (realistic textured
Kestrel and Vanta, with ace liveries) is used when an asset ID is set in
`src/shared/RobloxAssetIds.ts`; see [the Roblox asset pipeline](roblox-asset-pipeline.md)
and the section below. Otherwise the game uses the **procedural** path this
guide describes from here: generated EditableMesh geometry from committed JSON.

This project keeps the procedural Blender generators and the exact geometry used by Roblox in Git. Known Kestrel and Vanta Blender projects, interchange exports, validation statistics, and preview renders are ignored local artifacts. Default cleanup preserves Blender project and backup files because they may acquire manual edits after generation. Use this guide when changing or adding aircraft. The game uses TypeScript and React Lua; Blender tooling uses Python.

## Files and commands

Player aircraft source: `tools/build-aircraft.py`. Runtime geometry: `assets/aircraft/kestrel.mesh.json`.

Enemy aircraft source: `tools/build-enemy-aircraft.py`. Runtime geometry: `assets/aircraft/vanta.mesh.json`.

Run Blender in the background to regenerate an aircraft:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-aircraft.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-enemy-aircraft.py
bun run build:place
```

On other machines, substitute the installed Blender executable. Each generator resets the scene and recreates the complete aircraft from code; it does not read or modify an existing `.blend`. It exports `.blend`, `.fbx`, `.glb`, `.mesh.json`, statistics, and preview PNGs. Only the generator and runtime-required `.mesh.json` are canonical tracked inputs. The other outputs are useful for inspection and manual import but should not be committed.

After regeneration and inspection, explicitly remove disposable interchange exports, statistics, previews, and local build/test artifacts with:

```sh
bun run clean
```

`bun run clean:check` previews the paths and byte count. Cleanup deliberately preserves `.blend` and `.blend1` files, every lock file, locked place builds, `build/skybreak.rbxlx`, and screenshots other than the explicit legacy QA names. Review Blender files for manual edits and delete them manually only after confirming the Python generator reproduces everything worth keeping. A subsequent `bun run build:place` recreates compiler output and packaged geometry from the tracked mesh JSON files.

`tools/package-aircraft.ts` packages the geometry as text data under `build/`. The production and test Rojo projects map it to server-only `StringValue` instances in `ServerStorage`. Raw geometry is not a client script dependency.

Run `bun run watch` and `bun run serve` for TypeScript development. After regenerating Blender assets, run `bun run build` again. Restart the Rojo server when changing project mappings, and verify the new objects actually appear in Studio. A connected status alone does not prove a changed project mapping was loaded.

## Geometry contract

The JSON schema is `skybreak.triangulated-mesh.v1`:

- `vertices`: XYZ arrays in Roblox coordinates, measured in studs.
- `faces`: triangles with zero-based `indices`, three corresponding corner `normals`, and a material name.
- `materials`: material names and `baseColorRGBA` arrays.
- `bounds`, `parts`, and coordinate-system metadata: inspection/export information.
- `attachments`: `leftWingtip`, `rightWingtip`, and `exhaust` XYZ arrays for authored trail positions. Vanta requires these; Kestrel retains its explicit existing positions.

The current material roles are `White`, `Navy`, `Cyan`, `Canopy`, `Gunmetal`, `Exhaust`, and `Glow`. These are stable role names, not mandatory paint colors: the enemy's accent role can be red. Merge disconnected objects sharing a material into one mesh to keep the number of draw objects small. Preserve the authored enemy palette.

Author in Blender with X right, Z up, and **-Y forward**. The export maps `(x, y, z)` to Roblox `(x, z, y)`, giving **+Y up and -Z forward**. This swaps handedness: reverse triangle winding, and reorder corner normals to match the reversed corners. Transform and normalize normals too. Do not merely swap vertex axes.

Center the complete aircraft around its intended pivot. Keep dimensions near the existing aircraft so camera framing, target cues, and effects remain appropriate. Update trail attachment coordinates when wing or exhaust positions change. Export evaluated geometry with modifiers applied; never include the render platform, lights, or cameras in delivery meshes.

## How Roblox renders the model

`src/shared/BlenderAircraft.ts` reads the server-only data, validates it, and builds one `EditableMesh` per material. It then calls:

1. `AssetService:CreateEditableMesh()` and the vertex/triangle/normal methods.
2. `AssetService:CreateDataModelContentAsync(Content.fromObject(mesh))` to create static content that can replicate to clients.
3. `AssetService:CreateMeshPartAsync(content, options)` to create the renderable part.

**Center each material mesh's vertices before creating static content.** Record its original bounds center, subtract that center from every vertex, then place the resulting MeshPart at the recorded center. Opaque content preserves its vertex-space offset; setting the MeshPart position without recentering applies the offset twice. The engine bounds test caught this exact defect.

The editable object can be destroyed after static content is created. Templates are cached separately for each aircraft kind, and sorties clone those templates. The server retains the authoritative invisible root, pivot, flight state, and damage rules. `JetFactory` adds the three trails and welds every MeshPart (unanchored, massless) to the anchored invisible Root, so moving the Root moves the aircraft and only one CFrame replicates per update. Server-side aircraft ship with trails disabled: the client hides the replicated model and draws a local clone with trails on (the player's own jet is predicted locally with `FlightPrediction`; enemies are smoothed by `EnemySmoothing`).

`GeometrySource="Blender"` identifies generated geometry; `GeometrySource="Fallback"` identifies the built-in aircraft used if platform mesh generation is unavailable. `GeometryAsset` identifies the aircraft kind. Do not treat a silent fallback as a successful asset test. Packaging errors should fail clearly; platform capability failures should warn and preserve playable flight.

Static content is scoped to a running DataModel. It is regenerated from committed data when a server starts; it is **not** a permanent uploaded mesh asset ID. The runtime needs neither an API key nor a local HTTP server. Do not replace this with `Content.fromObject(editableMesh)` alone: an editable object reference is not the same server-to-client static-content path.

## Validation before committing

```sh
bun run build
bun run test:roblox
bun run build:place
git diff --check
```

`test:roblox` launches a separate authenticated Studio instance and runs Roblox Jest. It is not Bun's JavaScript test runner. Coordinate with the parent agent before running it on a shared desktop. Inspect `build/jest-results.json` and `build/jest-output.log` from that run.

Also reopen the generated `.blend`, round-trip the FBX and GLB, and inspect both render views before cleaning the exports. The complete aircraft must fit within the preview frame. Check triangle count, seven material groups, finite coordinates, winding, corner normals, and bounds.

In the actual game, verify the player, all three enemies, and airbase display use the intended model. Check client replication, correct front/up axes, canopy/exhaust placement, enemy identification, and trail attachment points. Complete the mission using the real controller. The former `tools/playtest-flight.client.luau` driver (removed in the 2026-10-28 tidy; recover it from git history at commit b0b1cb4 if needed) could fly a launched mission as a normal client LocalScript without changing health, damage, or kills. Plugin-context `require` can have a different module cache, so run controller QA in the normal LocalScript context.

For close-up visual inspection, isolate the test camera from the normal menu/flight camera owner. Adding another render-step callback alone can leave two camera writers competing and produce misleading empty screenshots. Restore normal startup afterward; an isolated model preview is separate from the genuine mission playtest.

## Uploaded realistic aircraft

`tools/assets/aircraft.py` builds new Kestrel and Vanta models for upload as
Roblox Model assets (run `tools/assets/build-all.sh kestrel vanta`). They are
original designs at the existing in-game size and stay within 10,000
triangles with 1024² PBR textures:

| Asset | Triangles | Roblox size (studs) | Delivery meshes |
| --- | --- | --- | --- |
| Kestrel | see `assets/roblox-upload/kestrel/checklist.json` | 23.0 x 6.1 x 27.0 | `Body`, `Aileron_L/R`, `Elevator_L/R` (all-moving stabilators), `Rudder_L/R` |
| Vanta | see `assets/roblox-upload/vanta/checklist.json` | 24.8 x 8.0 x 27.8 | `Body`, `Aileron_L/R` (delta elevons), `Elevator_L/R` (canards), `Rudder` |
| Vanta Vulture / Rusk | same mesh as Vanta | same | colour and roughness maps only |

- Kestrel: blended twin-engine fighter with chined nose, one-piece bubble
  canopy with windscreen and rear bows and sills, raked side intakes under
  leading-edge extensions, 38° trapezoidal wing, canted twin fins, ventral
  fins, petal nozzles, flush nose and main gear-up doors, tip rails and one
  empty pylon per wing. Two-tone grey countershading with a soft disruptive
  pattern, darker radome and anti-glare panel, thin cyan fin-tip bands.
- Vanta: canard cranked-delta interceptor with a single large fin, chin
  intake, framed canopy, ventral strakes and twin nozzles; dark grey splinter
  camouflage with rust-red bands. Ace liveries: Vulture flight (near-black
  with bone feather chevrons) and Air Marshal Rusk (oxblood with gold
  pinstripes). No text, numbers, serials, squadron codes or insignia.
- Panel lines, fasteners, access panels, flow streaks, belly stains, engine
  soot and ambient occlusion are baked into base colour, normal and roughness.

Control surfaces are separate FBX objects whose origin is on the hinge line.
Their hinge end points in model space (bounds-centred, +Y up, -Z forward) are
in `UploadedAssetSpecs.<aircraft>.controlSurfaces`, generated from the
checklist; wingtip and exhaust trail attachments are in `.attachments`. The
game welds them rigidly today; an animation pass can rotate each surface
about its hinge without re-exporting.

Loader order (`BlenderAircraft.Populate`): uploaded model for the requested
livery, then the plain uploaded Vanta for aces, then the procedural Blender
meshes below (recoloured for an ace livery), then `JetFactory`'s part
aircraft. `GeometrySource` is `Uploaded`, `Blender` or `Fallback`;
`UploadedAsset` and `Livery` record which model and paint were used.
`CombatService` asks for an ace livery from the mission's `aceName`.

## Version 2 aircraft

`tools/assets/aircraft_v2.py` (`tools/assets/build-all.sh kestrel-v2 vanta-v2`)
builds `kestrel-v2`, `vanta-v2`, `vanta-v2-vulture` and `vanta-v2-rusk`. They
replace v1's lofted superellipse tubes with real-aircraft anatomy and are
preferred over v1 when their IDs are set (`AssetSelection.AircraftCandidates`:
Kestrel v2, Kestrel; an ace's livery v2, livery v1, then plain Vanta v2, Vanta;
then procedural).

| Asset | Triangles | Roblox size (studs) | Delivery meshes |
| --- | --- | --- | --- |
| Kestrel v2 | see `assets/roblox-upload/kestrel-v2/checklist.json` | 22.2 x 5.3 x 26.0 | `Body`, `Canopy`, `Aileron_L/R`, `Elevator_L/R` (stabilators), `Rudder_L/R` |
| Vanta v2 (and liveries) | see `assets/roblox-upload/vanta-v2/checklist.json` | 24.6 x 7.3 x 26.4 | `Body`, `Canopy`, `Aileron_L/R` (elevons), `Elevator_L/R` (canards), `Rudder` |

- **Fuselage.** `Body` lofts half cross-sections of seven control points (top,
  shoulder, upper chine, a creased chine, lower side, engine bottom, keel)
  interpolated along the length with monotone cubics. The chine grows into the
  leading-edge root extension and blends into the wing root; the aft sections
  have two engine bulges with a tunnel between them. The cockpit is a tub
  between the canopy sills.
- **Intakes.** Kestrel: raked caret mouths under the chines with splitter plates
  and diverter struts. Vanta: ventral boxes under the extensions with horizontal
  splitter plates. Both have lip thickness, a duct painted light grey that
  darkens inward and a compressor face with baked blades. There is deliberately
  no spinner so the front view never reads as a pair of eyes.
- **Nozzles.** Kestrel: 2D nozzles in a boat-tail with serrated flaps; Vanta:
  round petal nozzles and a tail boom. Liners, flame holders, heat tint.
- **Canopy and cockpit.** A bubble canopy (separate `Canopy` part,
  see-through in game) with a windscreen bow, rear bow and sill rails over an
  empty ejection seat with headrest, instrument-panel shroud, HUD frame,
  consoles and stick.
- **Details.** Pitot, angle-of-attack vanes, a sensor ball (Vanta), blade
  antennas, a refuelling door (Kestrel) or probe (Vanta), flush gear doors,
  formation light strips, ventral fins/strakes, a dogtooth and fence (Vanta),
  wingtip rails, and wing pylons with a twin-rail launcher carrying two
  unmarked missiles each (Kestrel 2 pylons, Vanta 4).
- **Shading.** Smooth shading with face-area weighted normals on every
  delivery mesh (`Asset(weighted_normals=True)`).
- **Paint.** Kestrel: two-tone grey air-superiority scheme with a darker radome
  and anti-glare panel. Vanta: dark splinter camouflage with dark red fin and
  canard tips. Vulture: near-black splinter with a muted bone trailing-edge
  band with a soft wavy edge. Rusk: oxblood splinter with a gold fuselage
  pinstripe and fin tip. All have explicit panel lines, access panels, rivet
  rows, intake grime, exhaust soot, flow streaks and belly stains. There is no
  text, number, insignia or glyph-like mark.
- **Scale.** Authored at the in-game length (`Asset(target_length=...)`
  rescales the delivered model; patterns, hinges and attachments stay in
  authored coordinates via the shading Mapping node), so `gameScale` is 1 and
  the 0.01 m-per-stud FBX imports at its game size.
- **Draft loop.** `SKYASSET_DRAFT=1` makes `finish()` stop after delivery and
  write Workbench renders to `build/draft/<name>/` (about 5 s, no bake, nothing
  in `assets/`). `SKYASSET_VIEWS="name:tx,ty,tz:dx,dy,dz:dist;..."` adds extra
  draft close-ups in authored coordinates.

`assets/roblox-upload/v1-vs-v2.png` compares v1 (left) and v2 (right), Kestrel
on top and Vanta below, all with the same camera at in-game scale
(`compare_v1_v2.py`).

## Asset upload alternatives and known limitations

The installed Studio build `0.744.0.7441077` returned this exact error on 2026-10-24 when the documented plugin upload API was tested:

> CreateAssetAsync and CreateAssetVersionAsync are not available yet

`CreateEditableMesh` and `CreateDataModelContentAsync` succeeded, including from a normal game-server Script with the resulting MeshPart visible on the client. That is why this project uses the generated static-content path.

If a future Studio release enables `CreateAssetAsync`, an authenticated local plugin can upload an EditableMesh as a durable Mesh asset using that documented API. Check availability and return status before changing the pipeline. Do not assume documentation availability means the installed client has enabled the feature.

For manual import, use Studio's 3D Importer with a regenerated FBX or GLB. Open Cloud asset upload is another option with a properly supplied API key or OAuth authorization. Never extract Studio cookies or use internal `RobloxScriptSecurity` importer methods. Asset import does not create or publish the game itself.

Primary references: [AssetService](https://create.roblox.com/docs/reference/engine/classes/AssetService), [EditableMesh](https://create.roblox.com/docs/reference/engine/classes/EditableMesh), [Studio 3D Importer](https://create.roblox.com/docs/studio/importer), [Rojo sync details](https://rojo.space/docs/v7/sync-details/).
