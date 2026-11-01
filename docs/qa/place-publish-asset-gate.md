# Place publication asset gate

Based on merged #216 (d33c9a94); historical #216 commits are excluded from this PR. No publication, upload, secrets or private state access.
## Actual build inventory

`bun run build:place` packages 13 Blender exports via `tools/package-aircraft.ts`, `JSON.stringify` and the ServerStorage mappings in `default.project.json`. They become StringValue.Value strings and are consumed at runtime to construct geometry. There are no native MeshParts, native embedded texture blobs, BinaryStrings or SharedStrings in the inspected build. The compiled RobloxAssetIds module references 39 uploaded model IDs. FBX/PNG files in assets/roblox-upload are not copied into the place by Rojo.

SHA-256 below is over extracted UTF-8 StringValue bytes (exact minified JSON, including coordinates). It is **not** the pretty-printed source-file hash or the FBX hash.

| Embedded file | Bytes | SHA-256 |
|---|---:|---|
| CinematicChairGeometry.json | 185817 | `59a7f1a93db923911fad5a84c289636219f83ba882b99ed2c29d916ae937f514` |
| CinematicDeskGeometry.json | 401673 | `f4b7117c03fec922cc4119b7b8e44284fe3c3c625160c2cad302a5fa156f2004` |
| CliffTileGeometry.json | 25123 | `1b174cce81b8c2c524f40f04319d66c8d4b0548664d2c5f8d0a94ecd829bb530` |
| CommsRelayGeometry.json | 123848 | `b733bf72a7906f04775b6ccd72c0a70a054d3cb014e347a0adea22f3d4af794d` |
| GrainSiloGeometry.json | 139848 | `269bb66dffaa970912785713b592b90d185629543c44fe7bc89b9360d14fddfe` |
| HarborLaunchGeometry.json | 38279 | `3a2ec598eaadbdc7fc9b6a73abab21d2c1979c5383eca8c4a28707c432374108` |
| KestrelGeometry.json | 661097 | `dffa6a3bd713a8563b1f2e037ef424cf30210a2b0319ea8e832bc60652b90338` |
| RadarGeometry.json | 365026 | `a9bb6625100f9f9992eab2a54fb012fe6e47109db8857cca8f99596cb98b9b4f` |
| RelayTruckGeometry.json | 102523 | `3b012a19a0fdcf69157eed7a8826961334a934dfbad62256b95851f5d367a3b6` |
| RoadTileGeometry.json | 9631 | `f9afdf9c83fe9c789381780ff10f92be5d53ecfa136b5e02113b82017b52cdbb` |
| RunwayTileGeometry.json | 10314 | `fd324b43eebe5199c35a963d72d369e8f0b50932f061e38863bba65be406ab79` |
| VantaGeometry.json | 678801 | `1319ecd6c4db6d8260c565959bff22e22f4dc036f023a8771ac3955b0168b5d3` |
| WarehouseGeometry.json | 612333 | `f7ff528eb4b213bd3c530fb78cc332abbbbecb639dacc7463d221f8e0acd9fbd` |

## Independent review and pending merge

All 13 exact exports have independent GPT-6.1 Sol 10/10 approval, with unchanged records, decisions, manifests and bytes included in this PR. See [review](asset-reviews/embedded-place-meshes/2026-10-31-pr217-embedded-mesh-review.md). Render filenames and hashes are listed there; PNGs at most 200 KB are retained beside it. The original report path is also retained because machine records reference it.

Production authorization remains strict: records must exist identically on fetched origin/main. Until merge, the real offline authorization command refuses missing merged approvals. CI runs inventory and gate regression tests, so pending approvals do not fail PR validation. A temporary offline Git evidence fixture can verify this exact build against the PR records without changing production refs or authorizing publication.

## Authorization and provenance

Every populated StringValue payload is hashed, even custom/non-JSON encodings. All nonempty BinaryString and SharedString bytes are decoded with strict base64 validation and hashed, including unused shared blobs. Unknown content URIs fail closed. Embedded names are `<StringValue.Name>.json`; native blobs use `<sha256>.bin`. Exact extracted files belong under `assets/roblox-upload/<filename-stem>/`, with export-manifest, approval metadata and independent decision records in #216 format. The reused parser accepts embedded JSON/mesh/PNG/binary files while retaining the existing FBX-only upload default, origin/main evidence, exact dependencies, independent identity and negative-decision rules.

There is **no procedural blob exemption**. The deterministic non-Blender blob allowlist is the empty set: inspection of the actual build shows no such payloads. Engine primitive properties contain no mesh/texture bytes and produce no entries. Future procedural blob exemptions require a deterministic generator and explicit review; checking in an unexplained hash is insufficient. Blender exports can never use this exception.

Referenced IDs are checked against the merged repo upload manifest's idsTable (RobloxAssetIds.ts), restricted to manifest asset keys. That table is the existing coordinator-maintained uploaded/moderation-approved ID catalog, not a private account journal. Newly added IDs need a separate merged catalog update. This preserves reuse of already uploaded models, including historical exports now blocked from reupload under #216. It does not assert a fresh safety review or live moderation check for those IDs. Runtime script behavior beyond the compiled catalog is code-review scope, not statically provable from arbitrary Luau.

## HALT, retry and build stability

The publisher fetches origin/main, pins a temporary read-only copy, and validates that same copy immediately before every POST, including 409 retries. No POST occurs on failure. The model HALT applies only if embedded hashes differ from the previous main commit's deterministically packaged geometry. The baseline uses main's first parent (the merge's previous main tip), its Rojo mapping and source exports, and Bun JSON.stringify as in the real build. This is a conservative Git baseline, not a deployment receipt: no claim that the preceding commit was published. Unknown baseline mappings fail closed. Unchanged code-only deploys do not inspect private state and do not inherit audio or model HALTs; new embedded bytes consult canonical model HALT via #216's state-location validation. Strict approval is required even for unchanged baseline bytes.

Tests cover current-build extraction, one-vertex tampering, exact synthetic merged approval records, local-only/negative decisions, binary/shared blobs, references, conditional model HALT and retry gate wiring. Synthetic fixtures are temporary and never approve repository assets.

## Validation performed

Validation (2026-10-31): `bun install --frozen-lockfile`, `bun run build`, and prescribed `LUAU_BIN` `bun run validate:offline` all exited 0, including 162 Python tests. Strict current-build publication authorization separately refuses missing approvals as expected. No real uploads or account-state access.

Rebuild verification (2026-10-31): frozen install and build exited 0. The strict parser accepted the exact built place against a temporary Git fixture containing this PR’s unchanged evidence: 13 blobs and 39 catalog references. Real origin/main authorization still exits 1 for missing merged approvals, as required. No PNG was included: none of the supplied renders is at most 200 KB. All render filenames and hashes remain in the review.

PR #217 final validation: frozen install, standalone build, and prescribed LUAU_BIN validate:offline all exited 0; 1,225 Luau contracts and 162 Python tests passed. GitGuardian and guard passed after history cleanup; CI validate pending at recording. No publish/upload or Player test.

## PR #218 military catalog integration

The current build references 49 catalog IDs. All ten military manifest entries include approvedUpload provenance (model ID, approval upload/dependency hashes, owner-reported APPROVED moderation on 2026-10-31 and source record). The existing gate still trusts only identical committed origin/main manifest and ID-table bytes. These metadata fields document provenance; they do not bypass that merged-evidence requirement. The inventory regression compares the compiled reference set to the populated source catalog rather than a fixed count.

Validation completed: frozen install, standalone build, build:place and prescribed LUAU_BIN validate:offline all exited 0 (163 Python tests). Strict offline validate authorized 13 blobs and 49 IDs using a temporary post-merge Git evidence fixture; production refs were unchanged. No upload, publish, secret read, canonical upload-state access, Studio or Player test.
