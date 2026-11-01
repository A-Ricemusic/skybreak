# PR217 independent review of exact embedded Blender meshes

Reviewer: **GPT-6.1 Sol independent reviewer**. Review date: **2026-10-31**. I did not create these assets. Reviewed PR https://github.com/A-Ricemusic/skybreak/pull/217 at head `1cc08bcccf642148cd9614aebc11a4d48719187f`.

**Overall verdict: APPROVE — all 13 exact embedded exports score 10/10.** No unresolved content or provenance concern was found within this asset review. No non-compliant asset was identified. This is the project’s maximum safety judgment, not a guarantee against moderation, account action or policy changes.

## Scope and reproducible evidence

Used the requested detached scratch worktree; fetched origin, ran `bun install --frozen-lockfile` and `bun run build:place` successfully. Extracted exact UTF-8 StringValue.Value bytes from the built XML through the PR gate’s inventory parser, independently retained full instance paths, and recomputed SHA-256. All 13 hashes match the PR inventory. Every source JSON equals current fetched origin/main; Bun JSON.stringify of each source equals the corresponding extracted blob byte for byte. No geometry was re-exported for approval.

Built place SHA-256: `9bd87275af95be0eca06414edabd05a6c218d475532948900d61be5b1c9a34ac`. Retained at `/tmp/pr217-reviewed-place.rbxlx`. Exact extracted blobs: `/tmp/pr217-embedded-blobs/`. Inventory: `/tmp/pr217-inventory.json`. Source/generator/runtime evidence: `/tmp/pr217-source-evidence/`. Detailed provenance: `/tmp/pr217-provenance.json`.

The build contains no native embedded image textures, BinaryStrings or SharedStrings. Field-by-field inspection confirms all 13 mesh blobs contain only expected geometry/material/metadata fields, no UV coordinates or image payloads. No texture dependency hashes exist to list. The runtime builds per-material meshes with exported corner normals, RGB colors and alpha, and selects Roblox engine materials; it does not sample UV textures. `familyLabels` in Vanta is metadata, not rendered lettering.

I converted the **extracted bytes**, not FBX stand-ins or regenerated source geometry, back to Blender coordinates (x,y,z)=(Roblox x,z,y), reversed winding and corner-normal order, preserved all vertices and triangles, assigned every face its named material, and applied material RGBA/metallic/roughness. Blender 5.2.1 LTS in background mode rendered the complete assembled geometry using Cycles, neutral environment and two sun lights. First renders used 16 samples, remaining renders used 8. These are independent content-inspection renders, not Roblox Player screenshots or a pixel-exact simulation of engine materials. Geometry, material assignment and absence of texture content are exact; engine surface shading and lighting can differ.

I inspected all 13 contact sheets, each containing front, back, both sides, top, bottom and four three-quarter views (130 views total). Sheets show 400px thumbnails of retained 900×900 originals. I additionally opened Kestrel back and front-right three-quarter originals, and four supplemental warehouse underside originals (bottom-relit, low-front-relit, bottom-unlit-color, low-front-unlit-color). Additional lighting left the coplanar underside black, so diagnostic material-color emission renders of unchanged geometry were used to inspect that surface; they show no markings. These diagnostic views modify only the review shader, not exported geometry or the approved bytes. Every preview examined is enumerated and hashed below. No claim is made that all originals were individually opened at native resolution.

The owner/orchestrator reports these assets are already live. I verified matching main-source bytes, not deployment or live rendering. I did not launch Studio, play Roblox, upload, publish, access secrets, edit tracked project files, push or commit. The 39 externally referenced model IDs are outside this review; approval of these JSON blobs does not approve those model exports or whole-game behavior.

## Policy consultation on review date

| Source | Application |
|---|---|
| https://www.roblox.com/termsofuse → https://en.help.roblox.com/hc/en-us/articles/115004647846-Roblox-Terms-of-Use | Consulted served User Terms §6 and Creator Terms §2 on UGC, rights and responsibility. The served page displays **November 1, 2026**, one day after this review date; it is recorded as served, not represented as already effective on October 31. The same page’s Terms link resolves to itself; no distinct prior version was available there. |
| https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/ → https://about.roblox.com/community-standards | The support page redirects readers to the current standards. Consulted terrorism/extremism, harassment, sensitive events, violence/gore, sexual content/nudity, regulated goods and weapon schematics, political entities, profanity and IP. No prohibited content found in these meshes. |
| https://create.roblox.com/docs/marketplace/marketplace-policy | Followed linked avatar/modesty guidance to confirm applicability: no human figure or avatar exists in these exports; no clothing exception is needed. |
| https://en.help.roblox.com/hc/en-us/articles/15869919570708-Age-Restricted-Content-on-Roblox | Followed linked restricted-content guidance; no restricted-content allowance is needed or used for these ordinary meshes. |
| https://create.roblox.com/docs/production/publishing/rights-manager | Followed linked rights guidance; reviewed source construction and visual originality. No third-party mesh input or copied branded design was identified. |

Project checks additionally require no people/skin/nudity, national insignia, real unit markings, flags, extremist symbols, text/logos or copied trademarked designs in these assets. Every asset passes these checks. Generic vehicle lamps, engine outlets, structural braces and road lines are ordinary functional geometry, without added person or extremist imagery.

## Provenance and earlier reviews

The orchestrator explicitly clarified that the generators were run by earlier SKYBREAK build agents, all committed under Anthony Rice’s Git identity. No separate per-export named creator record exists. The creator attribution below follows that clarification and names the exact generator and its introduction commit. Git author identity is not claimed to prove which human or model operated a generator. Independence follows this review assignment and the fact that I did not create the assets.

All 13 geometry sources trace to committed procedural generators and shared exporter helpers. Their dimensions, component layout, materials and exported part names agree with the rendered mesh forms. The original sources use generated primitives/custom vertices, not imported third-party meshes. The aircraft generators’ import calls are round-trip validation of their own local exports. Source tracing plus visual review supports original project authorship; it is not a universal IP-clearance guarantee.

Searched all Markdown and JSON under `docs/qa/asset-reviews/` for each exact embedded hash: **no matching previous review/approval was found**. Prior reviews PR107 (bomber/carrier), PR137 (later textured aircraft), PR152 (radio/recorder/board/tin), and military-ground-kit concern different exports. Their FBX approvals are not inherited. `docs/aircraft-assets.md`, `docs/mission-assets.md` and `docs/specs/cutscene-assets.md` document the older untextured mesh path; PR53/PR55 descriptions document furniture and infrastructure provenance.

## Per-asset verdicts

| Identifier | Triangles | Score | Verdict |
|---|---:|---|---|
| CinematicChairGeometry | 1080 | 10/10 | APPROVE |
| CinematicDeskGeometry | 2280 | 10/10 | APPROVE |
| CliffTileGeometry | 150 | 10/10 | APPROVE |
| CommsRelayGeometry | 828 | 10/10 | APPROVE |
| GrainSiloGeometry | 960 | 10/10 | APPROVE |
| HarborLaunchGeometry | 244 | 10/10 | APPROVE |
| KestrelGeometry | 3684 | 10/10 | APPROVE |
| RadarGeometry | 2152 | 10/10 | APPROVE |
| RelayTruckGeometry | 640 | 10/10 | APPROVE |
| RoadTileGeometry | 68 | 10/10 | APPROVE |
| RunwayTileGeometry | 76 | 10/10 | APPROVE |
| VantaGeometry | 3840 | 10/10 | APPROVE |
| WarehouseGeometry | 3632 | 10/10 | APPROVE |

### CinematicChairGeometry

- Embedded path: `game/ServerStorage/CinematicChairGeometry.Value`.
- Exact embedded blob: `CinematicChairGeometry.json` (185817 bytes), SHA-256 `59a7f1a93db923911fad5a84c289636219f83ba882b99ed2c29d916ae937f514`.
- Source: `assets/mission/cinematicchair.mesh.json`, SHA-256 `8eb1d5f33e10b0de7bfa331a962f7a83b9f9e1bbd2eb71d55c2adda2013f1381`.
- Generator: `tools/build-cinematic-props.py`, SHA-256 `13a3e2cc21e2eb6fab9ffc1cd8f292dca3858b8caac44498c95d4a10ab4b1529`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-cinematic-props.py (committed under Anthony Rice's git identity, d31ed1dff5f04ef6f590c0fe7f01f64744bff3d5).
- Export version for approval: `embedded-json-v1-59a7f1a93db9` (review label for existing bytes, not a new geometry export).
- Geometry: 576 vertices / 1080 triangles; materials: Steel, DarkMetal, Roof.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Empty upholstered briefing chair: ribbed back cushion, armrests, steel uprights and sled feet. All surfaces are plain solid colors. No occupant, human figure, skin depiction, text, symbols, insignia, logos or distinctive branded furniture design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/3q-back-left.png` — SHA-256 `09940d8dd3a7c31e8d6868631949c838adf6ef309d0f31deb0e94f96e5db5fad`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/3q-back-right.png` — SHA-256 `0b6a6b178ad7e6c6adf456208e2636b043d2330b9fc8977626fa6d57856c800f`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/3q-front-left.png` — SHA-256 `76b3c5b837781a4c5707ae3dbd37282bdd2f57e8cca1d8ae23228f1ac5cf5f32`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/3q-front-right.png` — SHA-256 `ca9aa63963d782cc3bd5710a1d0ea29b668f7d2dc9254311499c66695b94b2ed`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/back.png` — SHA-256 `a767db2e579ceee6a8336f8c25db0a7a60f0172dd2847be3465f964d8930a6ba`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/bottom.png` — SHA-256 `f6c5f2112611ff375a293543f64813573bd3759a5174f72959f0e43b733c82ab`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/front.png` — SHA-256 `aa110315e17854f612da0a4e29dc4093e50291ffd1150a40ab99d1e306151a1a`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/left.png` — SHA-256 `11aa9fdb307524d2744042008de546a4f1299b6191796ba930ca6a9be862cd9b`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/right.png` — SHA-256 `bc152f0fe4aa869c5f82df2a08b37fb965bcc59af47ab16039e726abdac524f8`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry/top.png` — SHA-256 `d5ee2837dfa6e375e2c393d99a8f74a5f1fb5132caaa698015ddb862f09ae2d1`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicChairGeometry-sheet.png` — SHA-256 `c044312e2cbb79111a33ef24e2d980045cc388d0726098a6b2f6ca362ad79baf` (all ten standard views inspected in this sheet).

### CinematicDeskGeometry

- Embedded path: `game/ServerStorage/CinematicDeskGeometry.Value`.
- Exact embedded blob: `CinematicDeskGeometry.json` (401673 bytes), SHA-256 `f4b7117c03fec922cc4119b7b8e44284fe3c3c625160c2cad302a5fa156f2004`.
- Source: `assets/mission/cinematicdesk.mesh.json`, SHA-256 `8d26d62be24fe54cb76ab9722fb351d974657abdedb76beb0cecde32ba850377`.
- Generator: `tools/build-cinematic-props.py`, SHA-256 `13a3e2cc21e2eb6fab9ffc1cd8f292dca3858b8caac44498c95d4a10ab4b1529`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-cinematic-props.py (committed under Anthony Rice's git identity, d31ed1dff5f04ef6f590c0fe7f01f64744bff3d5).
- Export version for approval: `embedded-json-v1-f4b7117c03fe` (review label for existing bytes, not a new geometry export).
- Geometry: 1200 vertices / 2280 triangles; materials: Steel, DarkMetal, Roof, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic twin-pedestal desk with six drawers, yellow pulls, side ventilation slots, foot pads and rear cable tray. Plain worktop and underside; no people, skin, text, flags, insignia, logos or copied product details.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/3q-back-left.png` — SHA-256 `d07a021f14f8851d86e44125d7c512fc9f91ca66be17f4e249b578f703538ea3`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/3q-back-right.png` — SHA-256 `838e512c727b700e9754bb8268bed16f90890696c9ed1866ea76ceef7da747e6`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/3q-front-left.png` — SHA-256 `ee645233e3d8aeaa145a0d5681509ba7f971ea83836b95bc83bed435be4c344d`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/3q-front-right.png` — SHA-256 `84fbaaea691a9520264fd456e00d8ef1b225f0d50e5fa92726748d508997371c`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/back.png` — SHA-256 `7f641408d270cc61852c51e5203690e1c97e9b4bded3f90e134b033ad2811f68`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/bottom.png` — SHA-256 `bf759d5b8483baa96f8f3229fe39599577c1d2394369426436cf9846b46b7e8b`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/front.png` — SHA-256 `9cec6ccb93641262086eeab752e3d46dc868b46556f5da5847d0ce4cb67199b2`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/left.png` — SHA-256 `5935834fae0e1de74f177c26c0718d0767ccd42a28ee5946bede5593ce9debbb`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/right.png` — SHA-256 `ef94018df19c3f7ec015ccc88c07f5b793a6683a069b2bcc3a63b398eebed3f2`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry/top.png` — SHA-256 `fdae3c5a9c66e0e5118a96325d84a0c555c2cf4cd03bf71431ec5dd55d284e20`
  - `/tmp/skybreak-pr217-mesh-renders/CinematicDeskGeometry-sheet.png` — SHA-256 `f5907c8068316ed1f7d70f98b03edd438cb659aa2c158a14cfd607b68fb37b7a` (all ten standard views inspected in this sheet).

### CliffTileGeometry

- Embedded path: `game/ServerStorage/CliffTileGeometry.Value`.
- Exact embedded blob: `CliffTileGeometry.json` (25123 bytes), SHA-256 `1b174cce81b8c2c524f40f04319d66c8d4b0548664d2c5f8d0a94ecd829bb530`.
- Source: `assets/mission/clifftile.mesh.json`, SHA-256 `5f9e5cb4ebf5c6f49a5790a59511161bf27661976b04b9e352cc3c122e2af653`.
- Generator: `tools/build-world-kit.py`, SHA-256 `8499d029313809d137a4c1380034cd47b6389a1466bf40b72effa199c8132f31`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-world-kit.py (committed under Anthony Rice's git identity, 483abdf1ece1e5182d394a4a48fae38e94ad41c1).
- Export version for approval: `embedded-json-v1-1b174cce81b8` (review label for existing bytes, not a new geometry export).
- Geometry: 77 vertices / 150 triangles; materials: Concrete.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Closed stratified rock buttress with irregular ledges, a plain rear face and end caps. The repeating recesses read as rock strata. No human/skin content, glyphs, text, insignia, flags, extremist symbols, logos or branded design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/3q-back-left.png` — SHA-256 `a8410211de0d2cc5550841fb43414e83c03233444929f850ada16f92dee94b12`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/3q-back-right.png` — SHA-256 `df57ba5866c734003f8397976e9dfe88179c741372c08c4b6242df4f57998d50`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/3q-front-left.png` — SHA-256 `80decb22e2890d174207e4269f9a41011064b531d84f6e95da55e3da4f495d02`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/3q-front-right.png` — SHA-256 `0591e956a802ab922e5d49ba43198f5c1e6ed1957c1bd6a12de1ed9f217bcd2c`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/back.png` — SHA-256 `1e9e416184cac4bd03cd7468899245756c5865ba5c01b52a485449b3597b4b82`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/bottom.png` — SHA-256 `e0bb71387a6fa001ca359c345cd859f3115ab715982a673e02f5e158487c9c06`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/front.png` — SHA-256 `5df7a01096483e9178abfd9adbc1b573f86d8bca186a08abf666312f1307cfce`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/left.png` — SHA-256 `8499facd57bc7e924038393cbfced0288e527ef331b3613ff0a2e43a632c38ba`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/right.png` — SHA-256 `89a10637dcffd6487ca21913dc303baf8d422fb7b6dd462f9e39535ddbd3c991`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry/top.png` — SHA-256 `7166964cbbd47d4c5a02fb7c6896d3024fbe42ce47849bb28624c49704f665a1`
  - `/tmp/skybreak-pr217-mesh-renders/CliffTileGeometry-sheet.png` — SHA-256 `b25f7c9c8ea5d5a34912e38f1bf51373f52fb54f800fdbe2e76c981fe7f324e0` (all ten standard views inspected in this sheet).

### CommsRelayGeometry

- Embedded path: `game/ServerStorage/CommsRelayGeometry.Value`.
- Exact embedded blob: `CommsRelayGeometry.json` (123848 bytes), SHA-256 `b733bf72a7906f04775b6ccd72c0a70a054d3cb014e347a0adea22f3d4af794d`.
- Source: `assets/mission/commsrelay.mesh.json`, SHA-256 `1df62fc7fe60bef83622e514d716b5cf066109fadb7a4ff0150922469cac88a3`.
- Generator: `tools/build-relay-assets.py`, SHA-256 `b1220fafaa2944a619c96c07416bec85763a9f934a984855bb3808c2543686bc`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-relay-assets.py (committed under Anthony Rice's git identity, 83da53e6c8ea5360625d0cf184c91de83153693a).
- Export version for approval: `embedded-json-v1-b733bf72a790` (review label for existing bytes, not a new geometry export).
- Geometry: 484 vertices / 828 triangles; materials: Concrete, Steel, DarkMetal, Accent, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic four-legged lattice communications tower with diagonal braces, rectangular antenna panels, equipment cabinet and beacon. Structural diagonals are ordinary bracing, not iconography. No people, skin, text, national/unit markings, flags, extremist symbols or brand marks.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/3q-back-left.png` — SHA-256 `3bfab37616853ffc4875ce5f2b5b940e375e293dcd19300390e86ddf051ed409`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/3q-back-right.png` — SHA-256 `3e1d2d931e92a7e60a9abb673231a45557fee3ecd552d8b1dca37d1110207095`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/3q-front-left.png` — SHA-256 `b60c585cc77cc335422fb927ffbe4374f7a341c65264e82bad78c07a4bbaff92`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/3q-front-right.png` — SHA-256 `7363ed4049d4b7ebf8fc09f990eb95f78d2bcccc337755c7fc2e0509c972a316`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/back.png` — SHA-256 `1d09c91abd589b454fe6a6377a73b8883fb510077b19bf503881606a44638f8e`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/bottom.png` — SHA-256 `ff82c7709d64fe19213b7606984fe6da7ed5f997a7bbf525e59b0cabc9a631f2`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/front.png` — SHA-256 `d59d69befb508f5c1809c844e24e304fcd0e915c4b48330a02b60e50c0b971ba`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/left.png` — SHA-256 `45fa498e389a881c80b7a54a7a54132dcae9bf877194fd63eb8fb43dc7590bc7`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/right.png` — SHA-256 `89539af9320920b3ae776a19e720de7df9c2eec6cfddcf0d8171b1adb7d8a126`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry/top.png` — SHA-256 `e6a12bcc5f1c9350fa159146f062153e04c33414648927bb35de8fc320f9dca2`
  - `/tmp/skybreak-pr217-mesh-renders/CommsRelayGeometry-sheet.png` — SHA-256 `3d9de52a1554c1b5e9c0aad22dfb0bd31ea6b98ed95321a16e029e41c8541cef` (all ten standard views inspected in this sheet).

### GrainSiloGeometry

- Embedded path: `game/ServerStorage/GrainSiloGeometry.Value`.
- Exact embedded blob: `GrainSiloGeometry.json` (139848 bytes), SHA-256 `269bb66dffaa970912785713b592b90d185629543c44fe7bc89b9360d14fddfe`.
- Source: `assets/mission/grainsilo.mesh.json`, SHA-256 `a0e7c04637e81b0c2e02bba7885ace030e8b94439054bf60fad6a345f1e6a31c`.
- Generator: `tools/build-relay-assets.py`, SHA-256 `b1220fafaa2944a619c96c07416bec85763a9f934a984855bb3808c2543686bc`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-relay-assets.py (committed under Anthony Rice's git identity, 83da53e6c8ea5360625d0cf184c91de83153693a).
- Export version for approval: `embedded-json-v1-269bb66dffaa` (review label for existing bytes, not a new geometry export).
- Geometry: 528 vertices / 960 triangles; materials: Concrete, Steel, DarkMetal, Accent, Roof, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic cylindrical storage silo with reinforcing bands, conical roof, vent and ladder. The yellow front notice is a blank color panel with no text or pictogram. No human/skin imagery, insignia, flags, extremist symbols, logos or distinctive copied design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/3q-back-left.png` — SHA-256 `541dc33a020e40a82521c5e1d02db47c4e10f0dc07c39a67da7b16a74a80cfd5`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/3q-back-right.png` — SHA-256 `05f0ae05007b1b3f1f871f2085b91f0d95330d63623264b4001f83706f414e77`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/3q-front-left.png` — SHA-256 `999bcfe323583d2fbf53045f417bf6399a868e3e582e4d05fee3ce75a4181835`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/3q-front-right.png` — SHA-256 `b2d6304ccdc1a8079334246fdd4b6ea45c20b2ce8ac8d471ceef68044c74d17d`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/back.png` — SHA-256 `4a05a8ba3678cf455eae7ba64f9e9498f14241194735b2732f23408b42c53df3`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/bottom.png` — SHA-256 `d92db1c6a7bc92afbe7587320af1040f8f2e106706b74b21c99bf4fc3c2a4b0d`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/front.png` — SHA-256 `b11269b2a9297bead2effb438b9045a384be6083038136a2e421e57e4670e8af`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/left.png` — SHA-256 `813b1a974fca9076cfbde18a2d52611e99815395d3b72a62b34f20ac683c2f85`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/right.png` — SHA-256 `bec23f5c1bdb31a376acb109a5a6dcd752cb19d58b57271dd96943bed6b3e0c5`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry/top.png` — SHA-256 `280af5dc5726978c37829dac586662f9cf452c809e9e638ab6193cf8f3736d22`
  - `/tmp/skybreak-pr217-mesh-renders/GrainSiloGeometry-sheet.png` — SHA-256 `80c90f41d18b46f81848a159a94c73de6534658e96cde3aa9eb2a1fff8f00dd2` (all ten standard views inspected in this sheet).

### HarborLaunchGeometry

- Embedded path: `game/ServerStorage/HarborLaunchGeometry.Value`.
- Exact embedded blob: `HarborLaunchGeometry.json` (38279 bytes), SHA-256 `3a2ec598eaadbdc7fc9b6a73abab21d2c1979c5383eca8c4a28707c432374108`.
- Source: `assets/mission/harborlaunch.mesh.json`, SHA-256 `78a8cf28267a054295455ffd5255486d862ab710a8b546b4d0a223d16d3248e5`.
- Generator: `tools/build-relay-assets.py`, SHA-256 `b1220fafaa2944a619c96c07416bec85763a9f934a984855bb3808c2543686bc`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-relay-assets.py (committed under Anthony Rice's git identity, 83da53e6c8ea5360625d0cf184c91de83153693a).
- Export version for approval: `embedded-json-v1-3a2ec598eaad` (review label for existing bytes, not a new geometry export).
- Geometry: 138 vertices / 244 triangles; materials: Steel, DarkMetal, Accent, Glass, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic uncrewed launch with pointed hull, deck, orange cabin, one windshield, straight rails, antenna and bow beacon. The cabin is unoccupied; no person, skin, text, identification, flag, extremist symbol, logo or distinctive copied vessel design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/3q-back-left.png` — SHA-256 `7c8a65aecb33011f07fee426872782ad76a4c9b1a1cc9b39f38cbd84111d9f6d`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/3q-back-right.png` — SHA-256 `1e6a1b56c9e64f2a169c2f43d16d6e1e76e0f86fd9f32180dfd15f7e97c61b17`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/3q-front-left.png` — SHA-256 `955bf70c71000e43c1932321a93029011d6719e338117b08f551d499b35a4c4b`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/3q-front-right.png` — SHA-256 `1b7c2396ef7fd7f60e20f138830e1a71747cbce781d7d4f3441b24296b122d8a`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/back.png` — SHA-256 `cc46a4fee81a7faff5aee89e043497e6525f16a3fc2cdac8201376dae24eacad`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/bottom.png` — SHA-256 `92b695671a701ba34f0a5c6fb29a7c1f9c4c7ec0c67e217ab69db6a7efb903ab`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/front.png` — SHA-256 `405c4c9dd7769e3bc0c7164920293d0c7e2e21623b944144215e3b1644575ce9`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/left.png` — SHA-256 `5f01ec7567089fadb7515bbada183e516efb9dcda7bb2a0f8b528f3edb1cd821`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/right.png` — SHA-256 `a93be7f95396893d3bad31d015f3a9cf55dbae08119fd438aa64c7fd1381e62b`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry/top.png` — SHA-256 `5ef615a0a19a5dddb3108e894ed1d62aee5d260024df26817a7b17f1643ceffe`
  - `/tmp/skybreak-pr217-mesh-renders/HarborLaunchGeometry-sheet.png` — SHA-256 `e59fb1d0b38fbb7e9c3c7abac4448552e583121ad163e0fc1b2e4cf6cb286e8f` (all ten standard views inspected in this sheet).

### KestrelGeometry

- Embedded path: `game/ServerStorage/KestrelGeometry.Value`.
- Exact embedded blob: `KestrelGeometry.json` (661097 bytes), SHA-256 `dffa6a3bd713a8563b1f2e037ef424cf30210a2b0319ea8e832bc60652b90338`.
- Source: `assets/aircraft/kestrel.mesh.json`, SHA-256 `e7d4a95a8b45ca5d8f616cd966239e72514ed6522ebabd40209d9446ec9b367a`.
- Generator: `tools/build-aircraft.py`, SHA-256 `3965e05f337abbf97f6198f65564a91cdd4cf969e6bb77156e1633c75640656f`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-aircraft.py (committed under Anthony Rice's git identity, 4b7f96a98158d17aa81bb2fb59c0a9fbcdf53e5a).
- Export version for approval: `embedded-json-v1-dffa6a3bd713` (review label for existing bytes, not a new geometry export).
- Geometry: 1896 vertices / 3684 triangles; materials: White, Navy, Cyan, Canopy, Gunmetal, Exhaust, Glow.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Original stylized twin-engine, twin-fin fighter with pale wings, navy panels, cyan strips, canopy and exhaust rings. No pilot or human figure; no skin or nudity. Colored panels are simple geometric strips without text, national/unit insignia, flags, extremist symbols or logos. The generic aircraft features do not identify a copied branded airframe. Rear paired exhausts read as engine outlets, not a depicted person.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/3q-back-left.png` — SHA-256 `44b8795c7c7bd482bb24dc349040d30f8c70b10bf1267fe104950eccc37f0e26`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/3q-back-right.png` — SHA-256 `91135c1d697da4d8e308b7ef26f8994d2b2bed25e248c84d7123838e86f12338`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/3q-front-left.png` — SHA-256 `e804c867bd26197423342713f489f0d641e672253c819302ca4d957fb0f5ce60`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/3q-front-right.png` — SHA-256 `a29feee085ba2dc74b22de6895587215eb15166fc941042ea35a6278f42ca601`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/back.png` — SHA-256 `c8df1c305728f2cbd32bbc68111ecfba64a3f0395e6036a6a118409e30f21726`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/bottom.png` — SHA-256 `18e517edd4637a6360e40493c5e1b4e43398339f626ac4a45dfae4dbe675d75a`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/front.png` — SHA-256 `b828cc83335d8456c440bff7b53d7e8d984a8a6f448777a05d45ad6f89af8f4b`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/left.png` — SHA-256 `5a0d4ab76f9101047ee162eac6cb793be8fd464cac11a463fbaa4ed12f9cba32`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/right.png` — SHA-256 `990b6666eab05ff44ca9e6526c24214bd347e24fdc87f83964ef28f8b5d8efa3`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry/top.png` — SHA-256 `c3535015ac27d5d0f1e1afcd8d0c2d7a4e0999e3d1931dc2c0a3e5087d691bd8`
  - `/tmp/skybreak-pr217-mesh-renders/KestrelGeometry-sheet.png` — SHA-256 `df7bbda5210b8494da85ea1f5e417dcfe2ac3b9d33558d707bacf3723c19ed9f` (all ten standard views inspected in this sheet).

### RadarGeometry

- Embedded path: `game/ServerStorage/RadarGeometry.Value`.
- Exact embedded blob: `RadarGeometry.json` (365026 bytes), SHA-256 `a9bb6625100f9f9992eab2a54fb012fe6e47109db8857cca8f99596cb98b9b4f`.
- Source: `assets/mission/radar.mesh.json`, SHA-256 `bd73b12585a3a0ce234dfb96a9e58938dccb3cbab0e4141969cd7307d2dbb658`.
- Generator: `tools/build-mission-assets.py`, SHA-256 `6a26f8f25bc6d0c31a82fc761068e027081845c4b51f39b3645d7c3e51779c58`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-mission-assets.py (committed under Anthony Rice's git identity, 6529e64e026d24b0796054eb4bd8007db7958d62).
- Export version for approval: `embedded-json-v1-a9bb6625100f` (review label for existing bytes, not a new geometry export).
- Geometry: 1142 vertices / 2152 triangles; materials: Concrete, Steel, DarkMetal, Accent, Roof, Glass, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic radar installation: rectangular base, utility building, windows, lattice supports, concave circular dish and central feed horn. No crew or human imagery, text, flags, real-unit/national insignia, extremist symbols, logos or distinctive branded equipment. Plain warning strips are colored geometry.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/3q-back-left.png` — SHA-256 `7041d23abf7dfc45304bc07e491044bf47419d3b7349769cb45f273ebb7931cb`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/3q-back-right.png` — SHA-256 `58848ac1d8822e6511269b4dfffa09756c910377e14e5ea1c6dd151a9d72ea2c`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/3q-front-left.png` — SHA-256 `c65198e53250b836f0bf19a69b1d82fc733c43621ff1efaad66047d4d10c437e`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/3q-front-right.png` — SHA-256 `c16ed6f2c8067c8a0c965f3c0f07aee403a19a757b2fb265d8b59a6a807c5b5f`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/back.png` — SHA-256 `df78604e04f608e5865c6da6f731045eebc85979fa1ff5c5ae4d311d2b954093`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/bottom.png` — SHA-256 `360f75e61e96cdc6f9b3e9a7781c9c5330e300805e2bee103d34bcd4952fb6de`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/front.png` — SHA-256 `ce13d382680892cf4df262cde53d31c249d330ef67b8eacf5bebe703a101fbe6`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/left.png` — SHA-256 `aad1857c0135dcd0563087b5b458c5ff36898a3fbebebe54b552b65fc40a606a`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/right.png` — SHA-256 `e01157aa39810bc9a517ec48adab0f22069a2646576e83d33765648903377ae9`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry/top.png` — SHA-256 `e4c99241d5771df823030afe1926a5796984f69b648287d65fe90ac4bde4fe8a`
  - `/tmp/skybreak-pr217-mesh-renders/RadarGeometry-sheet.png` — SHA-256 `00dd700d27c24fbf69e39e47b4f385f42b7494ea3b6ddd396e584310a9d739c0` (all ten standard views inspected in this sheet).

### RelayTruckGeometry

- Embedded path: `game/ServerStorage/RelayTruckGeometry.Value`.
- Exact embedded blob: `RelayTruckGeometry.json` (102523 bytes), SHA-256 `3b012a19a0fdcf69157eed7a8826961334a934dfbad62256b95851f5d367a3b6`.
- Source: `assets/mission/relaytruck.mesh.json`, SHA-256 `c5236a71ce32387c42ad656110c71d9f1be5d026d2819cb875d496e44e8e5fd4`.
- Generator: `tools/build-relay-assets.py`, SHA-256 `b1220fafaa2944a619c96c07416bec85763a9f934a984855bb3808c2543686bc`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-relay-assets.py (committed under Anthony Rice's git identity, 83da53e6c8ea5360625d0cf184c91de83153693a).
- Export version for approval: `embedded-json-v1-3b012a19a0fd` (review label for existing bytes, not a new geometry export).
- Geometry: 344 vertices / 640 triangles; materials: Steel, DarkMetal, Accent, Glass, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic uncrewed box-bodied utility/radio truck with orange cab, continuous windshield, two plain headlamps, four wheels, roof equipment and whip antenna. No driver or skin, text, registration plate, national/unit insignia, flags, extremist symbols, logo or recognizable branded truck design. Headlamps read as normal vehicle equipment.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/3q-back-left.png` — SHA-256 `de92f6b5ca1887112386ecd1ee7d73b54c85df7617dbedd74f85c67757b22ba3`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/3q-back-right.png` — SHA-256 `c14ec8e764e1a867df8aeea52b8cdcac96a862f198fb8ca41eea0d9aa0db20ae`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/3q-front-left.png` — SHA-256 `c8f1f464ff8ccffe904b5fb26c8e693c20543d3491be30ba9c3b8568c534454f`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/3q-front-right.png` — SHA-256 `d5677b84673c1c8787548a30b8ecd70b43ab46b7745823e7634a8a787031034e`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/back.png` — SHA-256 `809b8c7ec98c59c871069f44a185e58153d372d6f1d2df253325d03cd3408839`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/bottom.png` — SHA-256 `3c31e4cd88bbbf06b6ac8b942764eab818a72868899e9d706b0f179ce5753ceb`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/front.png` — SHA-256 `1bb1afecddbc22214c69d1a5090f2a08ccb1d44046bfa6e6497bbe171cf3cf5a`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/left.png` — SHA-256 `51982fdc40c6422ef72e6ab6f2cea19a40d0591a587342873446aae885249a6f`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/right.png` — SHA-256 `4ed40bf00dcdcc1ddf1f4b9cbbeabec8c7b3b786d024db095dd6a1176f71e75a`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry/top.png` — SHA-256 `ccbfbec7278fe25e521019070be1c2e451d34c224de8675a67c9f6326234c6e6`
  - `/tmp/skybreak-pr217-mesh-renders/RelayTruckGeometry-sheet.png` — SHA-256 `88eb629542ab06c0817a7261cd8d1bae6d18eb3bdfc4ee17e910daeeb2061a77` (all ten standard views inspected in this sheet).

### RoadTileGeometry

- Embedded path: `game/ServerStorage/RoadTileGeometry.Value`.
- Exact embedded blob: `RoadTileGeometry.json` (9631 bytes), SHA-256 `f9afdf9c83fe9c789381780ff10f92be5d53ecfa136b5e02113b82017b52cdbb`.
- Source: `assets/mission/roadtile.mesh.json`, SHA-256 `f3ad7e580f88671d8fbeeb1453076a4fea5306962f9a4edcf606d23cc06b8f5c`.
- Generator: `tools/build-world-kit.py`, SHA-256 `8499d029313809d137a4c1380034cd47b6389a1466bf40b72effa199c8132f31`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-world-kit.py (committed under Anthony Rice's git identity, 483abdf1ece1e5182d394a4a48fae38e94ad41c1).
- Export version for approval: `embedded-json-v1-f9afdf9c83fe` (review label for existing bytes, not a new geometry export).
- Geometry: 50 vertices / 68 triangles; materials: Concrete, DarkMetal, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Plain thin cambered road segment with shoulders, edge lines and a yellow center dash. Edge-on views are thin as expected; top, underside and four obliques expose the pavement and markings. No people, skin, text, flags, insignia, extremist symbols, logos or copied branded design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/3q-back-left.png` — SHA-256 `328fd7a6e11ba826ba480664da85e271eaf539df9082c25a6775e68f00bfa319`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/3q-back-right.png` — SHA-256 `81cc319a4b3e49978a53018b4928c746b368a7d9cae23b9c065117893ad04778`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/3q-front-left.png` — SHA-256 `00b75dfc167e7840e8126eed0c139258a02ac3577824a4bfb449c2d90708d24b`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/3q-front-right.png` — SHA-256 `f4ed5079cbae2266ed379825c7720cf818639fcbf447f12bff9e275c71b330ac`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/back.png` — SHA-256 `ec78a477ca5980aceb3162cfb8afd7516fbefd03025b9b07f217a40474741b7d`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/bottom.png` — SHA-256 `f6d23ed751850ae21ed85da05c5cd5c88941787322b5728fc7633dbf4ae9ee78`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/front.png` — SHA-256 `f6a345917f0d68e7d53e4e1e36e4da0b71255836939120e4f69b6431bb711484`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/left.png` — SHA-256 `5007b7eea79578935bd06af96e48c6f4c0c9a165bf34fc812a081830241ffc67`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/right.png` — SHA-256 `2dc3aebcd2829ffcb6d531e577be9e6fd51179c1a8841381b591c9e98a98e66f`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry/top.png` — SHA-256 `f5283918e494d4f09a97b87e26c8b81d9def0c2436d53f8a2160c62671406bb5`
  - `/tmp/skybreak-pr217-mesh-renders/RoadTileGeometry-sheet.png` — SHA-256 `c5ae4745767f3269a1837c23c23530ac4d08f8133ff29c09f8bd758078b4e0bb` (all ten standard views inspected in this sheet).

### RunwayTileGeometry

- Embedded path: `game/ServerStorage/RunwayTileGeometry.Value`.
- Exact embedded blob: `RunwayTileGeometry.json` (10314 bytes), SHA-256 `fd324b43eebe5199c35a963d72d369e8f0b50932f061e38863bba65be406ab79`.
- Source: `assets/mission/runwaytile.mesh.json`, SHA-256 `ab2aef46946bc35e3543666eabdafb7c7d9ebbe86c92123dae31e24ad2a89c1d`.
- Generator: `tools/build-world-kit.py`, SHA-256 `8499d029313809d137a4c1380034cd47b6389a1466bf40b72effa199c8132f31`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-world-kit.py (committed under Anthony Rice's git identity, 483abdf1ece1e5182d394a4a48fae38e94ad41c1).
- Export version for approval: `embedded-json-v1-fd324b43eebe` (review label for existing bytes, not a new geometry export).
- Geometry: 50 vertices / 76 triangles; materials: Concrete, DarkMetal.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Plain crowned runway segment with shoulders, edge paint and one center dash. Top, underside and obliques expose all marked surfaces; orthographic side/end views are thin by construction. No runway number, text, people, skin, flags, insignia, extremist symbols, logos or copied branded design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/3q-back-left.png` — SHA-256 `c704aacb07f50e12495ab2ae5f33ebe9ff887535c705ce200d0cc74dbee84868`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/3q-back-right.png` — SHA-256 `b9316b9ffe285283d3bb46ca3702ada52f72e2e9869c1e42fe1d6e99d80ccd54`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/3q-front-left.png` — SHA-256 `0b3c72d42d5f0945d0993beca8e63b3fd99d93d4181bd8148e3afb2179f5475e`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/3q-front-right.png` — SHA-256 `f61857d790664fec907a8313eee026268fa450400545b47ab6520c4f216a1599`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/back.png` — SHA-256 `04f16b7532b552313167d222491879bcee7518f7703a6ec8b098f3cff01beb7d`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/bottom.png` — SHA-256 `22951f769b913fad50568088b9304a85891d9828d97f3858dd70056b6bc7aa46`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/front.png` — SHA-256 `a4acdd67bd624242a3a15c88930ed3963436c036ebc02ff0f2c57eafe63c2958`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/left.png` — SHA-256 `9616afd8b80d918d76a3f0b71e3ae7f556adec24fd33226efa4a98ea74bb4236`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/right.png` — SHA-256 `9a705ebe40d678a4e3894bfb086208eedc3de2fc9189170a0c9afeadc1adc2be`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry/top.png` — SHA-256 `a05786e804305d6fd0b53b07ab7bffa231bd8ab0fe24178b47e8ab8d6c5ff075`
  - `/tmp/skybreak-pr217-mesh-renders/RunwayTileGeometry-sheet.png` — SHA-256 `8570ba0e69006f3b0167d174cd21170ce028ab529968ec3ec018c0e4911f0053` (all ten standard views inspected in this sheet).

### VantaGeometry

- Embedded path: `game/ServerStorage/VantaGeometry.Value`.
- Exact embedded blob: `VantaGeometry.json` (678801 bytes), SHA-256 `1319ecd6c4db6d8260c565959bff22e22f4dc036f023a8771ac3955b0168b5d3`.
- Source: `assets/aircraft/vanta.mesh.json`, SHA-256 `dcb5087caa507cf5572351eb42640ae6444a6843489e79c02d9e46526de539a3`.
- Generator: `tools/build-enemy-aircraft.py`, SHA-256 `0b102059dec37f5833572946a290ac0d7cf6ebd7d79d655ffdde4d3b1d74e108`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-enemy-aircraft.py (committed under Anthony Rice's git identity, 30631682b9cc52b354e49bf7a412c65d1273af33).
- Export version for approval: `embedded-json-v1-1319ecd6c4db` (review label for existing bytes, not a new geometry export).
- Geometry: 1970 vertices / 3840 triangles; materials: White, Navy, Cyan, Canopy, Gunmetal, Exhaust, Glow.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Original stylized wedge/delta fighter with forward canards, single swept fin, dark panels, orange strips, amber canopy and exhaust structure. No pilot, person, skin or nudity. Simple geometric livery has no visible text, real-unit/national insignia, flags, extremist symbols or logos. Metadata familyLabels are identifiers, not rendered lettering. Generic airframe components do not identify a copied branded design.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/3q-back-left.png` — SHA-256 `f5ea4a113d2fa932a19012d3536fc78cca827c350fa917ac4702da095ba7d618`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/3q-back-right.png` — SHA-256 `27774041f72e0ed1ac54f0a00ad1d00eee9ba6189e21b756db83483878103962`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/3q-front-left.png` — SHA-256 `40c5371513bd135252d6bf90e06ea65963e78e2ca0ee6587598aafbf707787a8`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/3q-front-right.png` — SHA-256 `9b9166770684e708bef46c3d2d3d830277331ea150393e588d86d93d4667a1c3`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/back.png` — SHA-256 `60f1a208c63bc6d03a3450a6b8ac82e7a56329811ea8362726ddfd14ee2d2cb6`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/bottom.png` — SHA-256 `043edbb4344c7a2c21f60e2f97a89269cba581260fad2fbc951473a30f5d3e2a`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/front.png` — SHA-256 `3c6d42f9adfd8acb675c178b115a8efb85965576c0d6a517951d9bb213c6c5d2`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/left.png` — SHA-256 `ed4f8ab56d0d58b9c6b12bca5de169fe69f37722c62ac42bd50db27306992c0f`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/right.png` — SHA-256 `6a25e9f1936168683ca105461d1050bc7e7127df712388c590a8eb39d160ba31`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry/top.png` — SHA-256 `547407cd96a4a6a38cae940e95bc11a2b9e3e25265bf2e4761ce9d5d06a830b7`
  - `/tmp/skybreak-pr217-mesh-renders/VantaGeometry-sheet.png` — SHA-256 `fb9b81cd36d02a5c6e95a5c4ca8d07492ecc5f5384bf700d5a539079eabe0e59` (all ten standard views inspected in this sheet).

### WarehouseGeometry

- Embedded path: `game/ServerStorage/WarehouseGeometry.Value`.
- Exact embedded blob: `WarehouseGeometry.json` (612333 bytes), SHA-256 `f7ff528eb4b213bd3c530fb78cc332abbbbecb639dacc7463d221f8e0acd9fbd`.
- Source: `assets/mission/warehouse.mesh.json`, SHA-256 `e8eb649827b2586fdf1b06b12cbe0cdafaa4ad58ecac7ecf160e8804ebc4408d`.
- Generator: `tools/build-mission-assets.py`, SHA-256 `6a26f8f25bc6d0c31a82fc761068e027081845c4b51f39b3645d7c3e51779c58`. Uses shared `tools/build-mission-assets.py` exporter where applicable.
- Creator: SKYBREAK build agent via tools/build-mission-assets.py (committed under Anthony Rice's git identity, 6529e64e026d24b0796054eb4bd8007db7958d62).
- Export version for approval: `embedded-json-v1-f7ff528eb4b2` (review label for existing bytes, not a new geometry export).
- Geometry: 2068 vertices / 3632 triangles; materials: Concrete, Steel, DarkMetal, Accent, Roof, Glass, Warning.
- Textures/UVs: none. The JSON is the complete embedded dependency set.
- Policy links: all seven links in the policy consultation table above, including both required entry URLs.
- Findings: Generic corrugated warehouse with gabled roof, ridge vents, clerestory windows, paired end doors and plain yellow warning bands. No occupants, people, skin, lettering, national/unit insignia, flags, extremist symbols, logos or distinctive copied branded design. Standard underside renders were black; added light alone did not resolve this. Supplemental material-color emission renders of the unchanged geometry expose a plain rectangular underside without marks. Data inspection finds overlapping coplanar concrete/steel bottom faces, a shading/geometry quality issue rather than a safety concern; the original reviewed bytes are unchanged.
- Earlier exact-export review: none found under `docs/qa/asset-reviews/`.
- **Score: 10/10. Verdict: APPROVE. Fix needed: none. No unresolved concern.**
- Previews examined:
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/3q-back-left.png` — SHA-256 `5e1348b5430592fab8e5c6352472d385cfd4a8953914cb9fc23f61426fdced92`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/3q-back-right.png` — SHA-256 `cffbb695e05dd8ac66f02ef7ed1801162544f94640bade27557d4e3db3d12dfc`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/3q-front-left.png` — SHA-256 `b33e8ef3079fb165806028dab5c4420a86c2fc1c486fed623268bac3ab49321d`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/3q-front-right.png` — SHA-256 `47a5dac5446f86b8306fca58adf5af923eb17f4e7d94a0035bffc9154c20803d`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/back.png` — SHA-256 `526e38237166a0a334192f63a468ee9f9bb1b373aff2158f136fa88f94a77257`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/bottom-relit.png` — SHA-256 `60a4438f5c8277076fc1da3488e008516560a611a418cf3f21be6d21fb3e9758`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/bottom-unlit-color.png` — SHA-256 `e3971cf95f2b70a70abf21e266d759e34c25cb2bab88ee4f9c984a5617ecd447`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/bottom.png` — SHA-256 `daacc8a1e4002f4f5405a0dee5c1bb637a774d8cecf4d4c3cf08a52bcaf18f03`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/front.png` — SHA-256 `ec250bef72f1be9ee3738ff68b2d573ed37ef3fda7bc95a18a50c1110da9e818`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/left.png` — SHA-256 `25b0588b4eb781133f5e6f9a4c41a78de292fff7ae1f6c0591a4fcf9c02773d8`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/low-front-relit.png` — SHA-256 `48b8cbef5238df4a094bf447fd9a1d587837fed910b32b531bcd54b7c2336d6e`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/low-front-unlit-color.png` — SHA-256 `26cea8339874583971da945aaa068006918a0a60c7e682888798ef9b90aa8494`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/right.png` — SHA-256 `304fe7dc5e4e31eb1f3affb635457f1b68b6b65370516082966a1ec3a9c60507`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry/top.png` — SHA-256 `e9481068193d0e6cd137fc38489ace957930bef3320769191836aa43a2b2c1c2`
  - `/tmp/skybreak-pr217-mesh-renders/WarehouseGeometry-sheet.png` — SHA-256 `671599afba8f34ed1aae985991cb595795e0c3143e25eaafc502d63b2c278c30` (all ten standard views inspected in this sheet).

## Integration and limits

The repository-shaped package `/tmp/pr217-approvals/` contains 13 approval metadata records, 13 independent decisions, 13 export manifests and 13 exact reviewed blobs. Copy its `docs/` and `assets/` trees into a reviewable PR; preserve filename case. The report destination referenced by machine records is `docs/qa/asset-reviews/2026-10-31-pr217-embedded-mesh-review.md`. No existing FBX review is changed or superseded.

The records must be merged into origin/main before the real gate can authorize these bytes. All 13 records passed the actual `tools/roblox_upload.py::require_model_review` parser with Git evidence reads/listing replaced by this local package (see `/tmp/pr217-schema-validation.txt`). This verifies schema, identity distinction, exact hash sets and decisions; it is not publication authorization. Running the unmodified current gate against the retained place exited 1 for missing merged approvals (see `/tmp/pr217-current-gate.txt`). The actual gate remains fail-closed until merged evidence exists. Changed bytes, a re-export, changed dependencies or material content require a fresh independent review.

Temporary scratch worktree removed after evidence was retained. No main-workspace documents were modified because this task explicitly permits read-only repository review only.
