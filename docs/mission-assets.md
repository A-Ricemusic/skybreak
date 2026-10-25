# Blender mission-target pipeline

The radar training installation and military warehouse are authored by
`tools/build-mission-assets.py`. Their canonical runtime geometry is committed as
`assets/mission/radar.mesh.json` and `assets/mission/warehouse.mesh.json`. The
generator also creates local `.blend`, `.glb`, and preview PNG files for review;
those known exports are ignored and are not runtime inputs.

Regenerate both targets with Blender, then compile the project:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-mission-assets.py
bun run build
```

The generator creates complete scenes procedurally, consolidates disconnected
objects into one delivery mesh per material role, applies transforms and
modifiers, triangulates evaluated geometry, and exports Blender corner normals.
Both assets remain below 5,000 triangles. They use solid material colors only;
there are no image textures or uploaded Roblox asset IDs.

## Dimensions and placement

Both meshes are centered on the origin. Their JSON `bounds` are authoritative.
To rest a target on a ground plane, place its model center above the plane by
`-bounds.min[1]` studs. The warehouse is approximately 65 studs wide, 95 long,
and 41 high. The radar installation is approximately 65 by 65 studs with a
45-stud overall height.

Blender uses X right, Z up, and -Y forward. Export maps Blender `(x, y, z)` to
Roblox `(x, z, y)`, yielding Roblox +Y up and -Z forward. Because that coordinate
swap changes handedness, the exporter reverses triangle winding and the order of
the corresponding transformed corner normals.

## Runtime import

`tools/package-aircraft.ts` packages all four Blender assets—the two existing
aircraft and these two ground targets—as server-only JSON text. Both Rojo project
files map `WarehouseGeometry` and `RadarGeometry` into `ServerStorage`
`StringValue` instances.

`src/shared/MissionAssets.ts` validates the packaged geometry and builds one
`EditableMesh` for each authored material role. It preserves exported corner
normals and colors, centers each material's vertices before creating static
content, then restores the original center with the generated MeshPart's CFrame.
This uses `CreateDataModelContentAsync` followed by `CreateMeshPartAsync`, so it
requires no API key and produces real replicated Roblox mesh geometry.

The static MeshParts are cached and cloned for each call to
`MissionAssets.CreateWarehouse(name)` or `MissionAssets.CreateRadar(name)`. Each
returned model has an invisible, anchored `Root` at the origin as `PrimaryPart`.
The root and every render mesh disable collision, touch, and query participation;
combat remains analytic. Successful models have `GeometrySource="Blender"`.
Malformed or missing packaged data is an error. Only a runtime failure in the
engine mesh-content path produces an explicit warning and a root-only model with
`GeometrySource="Fallback"`.

## Inspection checklist

After regeneration:

1. Reopen both `.blend` files in background mode and confirm their stored scene
   metadata and mesh bounds.
2. Import each `.glb` into a clean Blender scene and compare dimensions with its
   source JSON bounds.
3. Inspect both preview PNGs for silhouette, dish readability, doors, corrugated
   cladding, roof vents, and intended material separation.
4. Run `bun run build` and `git diff --check`.

Studio, Rojo server, publishing, and live mission QA are intentionally separate
engine-level steps. In Studio, verify `GeometrySource` is `Blender`, geometry and
colors replicate to the client, target pivots align with world placement, and
missile damage continues to use the combat service rather than MeshPart queries.
