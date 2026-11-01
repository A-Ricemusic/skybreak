# PR #221 independent naval-kit review

Reviewer: **GPT-6.1 Sol independent reviewer**. Date: **2026-11-01**. Creator: **SKYBREAK build agent via tools/assets/naval_kit.py (this PR)**.

Reviewed exact head `0ca566cd1176985b7891c7e1ba6e0066d9a7d45e` of https://github.com/A-Ricemusic/skybreak/pull/221. I did not create these assets. Read-only project review; no edit, push, upload, Studio launch or Player test.

## Part 1 — APPROVE all 12 exact exports, strict 10/10

This is the maximum project safety assessment, with no unresolved safety concerns. It is not a guarantee against moderation, account sanctions, or future policy changes. Approval covers only the enumerated bytes and dependencies. Any edit/re-export needs fresh independent review.

## Policies consulted on 2026-11-01

- https://www.roblox.com/termsofuse
- https://en.help.roblox.com/hc/en-us/articles/115004647846-Roblox-Terms-of-Use
- https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/
- https://about.roblox.com/community-standards
- https://en.help.roblox.com/hc/en-us/articles/15869919570708-Age-Restricted-Content-on-Roblox
- https://create.roblox.com/docs/production/publishing/ip-guidelines

The Terms redirect was followed to the official Terms effective November 1, 2026, including UGC rights/responsibilities. The support Community Standards page redirects to about.roblox.com. Relevant sections inspected: terrorism/extremism, real-world sensitive events, violence/gore, sexual content/nudity, illegal/regulated goods (weapon-making instructions and firearms), political entities, intellectual property. Linked age-restricted violence/war-crime restrictions and IP guidance were consulted. These are abstract in-game objects with no real-world construction instructions, sensitive-event narrative, glorification, people or harm imagery; the static weapon forms do not invoke an exception to the project restrictions.

## Independent method and coverage

Blender 5.2.1 LTS (9e2066aef7ef), background mode. Copied exact FBXs to /tmp, imported each through Blender FBX importer, measured triangle counts and bounds, verified one mesh/one UV layer and compared all embedded PNG byte hashes to supplied dependencies. All 48 embedded maps match. Reconstructed the same four-map PBR node wiring using these byte-identical PNGs and the imported UVs, including tangent normal mapping; rendered with Cycles, 8 samples, 640×640, ambient and three directional lights including underside illumination. No ground plane obscures bottom surfaces.

Personally examined every comparison.png (ten imported-FBX renders beside ten committed previews) and textures.png (all four complete maps at native 256×256), covering front, back, both sides, top, bottom and four three-quarter angles. Committed and independent images agree in geometry and mapped appearance; lighting, projection and top-camera orientation differ intentionally. Image hashes are evidence of byte identity, not alone proof of preview correspondence.

Inspected naval_kit.py plus skyasset geometry, procedural standard material, UV/baking and FBX export helpers, build registry and review packet scripts. No third-party geometry/image loading or real-ship references in the naval generator. Independently regenerated delivery geometry without baking/exporting; triangle counts agree and corresponding triangle vertices differ by at most 0.0000124 studs after correcting the .01 FBX scale. Initial decimal-bin comparisons on destroyer/missile-boat were rounding-boundary artifacts, resolved by unrounded triangle-nearest comparisons (<0.0001 stud tolerance). Generic naval forms only; no identifiable copied real-world design found.

Every asset: no people, crew, skin textures, nude/unclothed human depictions, faces, national insignia, hull numbers, flags/ensigns, real ship names, visible text, logos or extremist symbols; no blood, gore, distress or real-world weapon schematics. Maps contain only grey hard-surface paint/deck/glazing/steel and procedural weathering. Triangle range 120–812, below 2,400 each; sensible for these simple assets. Bottom-centre pivots, Blender -Y bow, export -Z bow; measured dimensions match checklist/specs within .001 studs.

Renders, embedded hash extraction, bounds and UV metadata: `/tmp/skybreak-pr221-renders/inspection.json`. Provenance geometry comparisons: `/tmp/skybreak-pr221-renders/generator-comparison.json`. Scripts/logs are preserved in the render directory. Exact FBX, maps, checklist and committed previews are retained alongside each asset.

## Per-asset exact evidence

### naval-aa

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Twin closed barrels, angular shield, turntable and circular foundation; no maker marks or schematics. No unresolved safety concern; no fix required.

Actual imported triangles: **260/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[10.0, 9.5, 21.65]`; bottom-centre pivot. Source geometry maximum error: `0.000001354` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-aa/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-aa/naval-aa-color.png` | `d68b1e33f04b1d7d6adf4c86ffb644e81a0fcc00a8c5e209096dcedf506355c9` |
| `assets/roblox-upload/naval-aa/naval-aa-normal.png` | `464945b76b73d258c21ca446f84c43a37793cedadf48d650879a6c5966fd3fed` |
| `assets/roblox-upload/naval-aa/naval-aa-roughness.png` | `8d81d5f99e98b4ddfa673905cd648374ff271bfff3f9ed0b56611eaa6c73935d` |
| `assets/roblox-upload/naval-aa/naval-aa-metalness.png` | `d7a3e01adb81f0c9b835019dc6d86e1b3d04b2ba41aa0335c0f1bbcb9f009cdf` |
| `assets/roblox-upload/naval-aa/naval-aa.fbx` | `93b83ee18aeb21c34260be1729d249cc2eada76d2c6ceb1cea78c176b7a1e4d6` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-aa/front.png`, `/tmp/skybreak-pr221-renders/naval-aa/back.png`, `/tmp/skybreak-pr221-renders/naval-aa/side.png`, `/tmp/skybreak-pr221-renders/naval-aa/side-right.png`, `/tmp/skybreak-pr221-renders/naval-aa/top.png`, `/tmp/skybreak-pr221-renders/naval-aa/bottom.png`, `/tmp/skybreak-pr221-renders/naval-aa/3q.png`, `/tmp/skybreak-pr221-renders/naval-aa/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-aa/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-aa/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-aa/preview-front.png`, `assets/roblox-upload/naval-aa/preview-side.png`, `assets/roblox-upload/naval-aa/preview-top.png`, `assets/roblox-upload/naval-aa/preview-3q.png`, `assets/roblox-upload/naval-aa/preview-back.png`, `assets/roblox-upload/naval-aa/preview-side-right.png`, `assets/roblox-upload/naval-aa/preview-bottom.png`, `assets/roblox-upload/naval-aa/preview-3q-front-left.png`, `assets/roblox-upload/naval-aa/preview-3q-rear-right.png`, `assets/roblox-upload/naval-aa/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-aa/comparison.png` and `/tmp/skybreak-pr221-renders/naval-aa/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-aa.json`.

### naval-container-ship

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Unmarked rectangular cargo boxes, ribs, deckhouse and generic chined hull. No unresolved safety concern; no fix required.

Actual imported triangles: **812/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[44.0, 59.5, 280.0]`; bottom-centre pivot. Source geometry maximum error: `0.000010832` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-container-ship/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-container-ship/naval-container-ship-color.png` | `8484bfca0be4f0599ea3a952d71f439b7a996fca032d8f86b84f2a39f681e075` |
| `assets/roblox-upload/naval-container-ship/naval-container-ship-normal.png` | `237e5ea2478788ee0dc94834d70a57db463e1807c395114ef10b79a8f61177f1` |
| `assets/roblox-upload/naval-container-ship/naval-container-ship-roughness.png` | `c0bad516390abcddd6ab22ecf4b8e3a4191aa130d1e43da60b6734d1510a23e9` |
| `assets/roblox-upload/naval-container-ship/naval-container-ship-metalness.png` | `2225577be2fe14f2e23541e264d14b2698e6a4de42bb11f1a43d1bd31eccac44` |
| `assets/roblox-upload/naval-container-ship/naval-container-ship.fbx` | `91350b4857cf30e6d4923e37dd77fd5b4b0903d5c040ba0c79e9b355af63459c` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-container-ship/front.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/back.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/side.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/side-right.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/top.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/bottom.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/3q.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-container-ship/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-container-ship/preview-front.png`, `assets/roblox-upload/naval-container-ship/preview-side.png`, `assets/roblox-upload/naval-container-ship/preview-top.png`, `assets/roblox-upload/naval-container-ship/preview-3q.png`, `assets/roblox-upload/naval-container-ship/preview-back.png`, `assets/roblox-upload/naval-container-ship/preview-side-right.png`, `assets/roblox-upload/naval-container-ship/preview-bottom.png`, `assets/roblox-upload/naval-container-ship/preview-3q-front-left.png`, `assets/roblox-upload/naval-container-ship/preview-3q-rear-right.png`, `assets/roblox-upload/naval-container-ship/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-container-ship/comparison.png` and `/tmp/skybreak-pr221-renders/naval-container-ship/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-container-ship.json`.

### naval-cruiser

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Generic chined hull, broad citadel and two simple secondary sensor masts; no copied distinctive warship details identified. No unresolved safety concern; no fix required.

Actual imported triangles: **544/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[40.0, 62.0, 310.0]`; bottom-centre pivot. Source geometry maximum error: `0.000012398` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-cruiser/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-cruiser/naval-cruiser-color.png` | `f5b64b51d225dc8ce74a73186733ec79c6586a4e34d4bf0acb6900d86e1ff624` |
| `assets/roblox-upload/naval-cruiser/naval-cruiser-normal.png` | `fcad8a2f05d012e6e283b3bd1a0e87fd951eece672f82388d719f62f29dcd4f6` |
| `assets/roblox-upload/naval-cruiser/naval-cruiser-roughness.png` | `ddade07571bdb27b24a6f2997cf36bab21291bba952c6aca952f7bb2a68dde20` |
| `assets/roblox-upload/naval-cruiser/naval-cruiser-metalness.png` | `ba86fb3932b2ceecdb28ff25e89aeaea0e6e1329ed8b7932053835ac7eb84510` |
| `assets/roblox-upload/naval-cruiser/naval-cruiser.fbx` | `983bd839010fcd32cb6ba25646d50e1a58c78a947b0afff273ad5b9483947818` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-cruiser/front.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/back.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/side.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/side-right.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/top.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/bottom.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/3q.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-cruiser/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-cruiser/preview-front.png`, `assets/roblox-upload/naval-cruiser/preview-side.png`, `assets/roblox-upload/naval-cruiser/preview-top.png`, `assets/roblox-upload/naval-cruiser/preview-3q.png`, `assets/roblox-upload/naval-cruiser/preview-back.png`, `assets/roblox-upload/naval-cruiser/preview-side-right.png`, `assets/roblox-upload/naval-cruiser/preview-bottom.png`, `assets/roblox-upload/naval-cruiser/preview-3q-front-left.png`, `assets/roblox-upload/naval-cruiser/preview-3q-rear-right.png`, `assets/roblox-upload/naval-cruiser/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-cruiser/comparison.png` and `/tmp/skybreak-pr221-renders/naval-cruiser/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-cruiser.json`.

### naval-destroyer

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Generic chined hull, separated stacks and simple fixed sensor panels; no copied distinctive warship details identified. No unresolved safety concern; no fix required.

Actual imported triangles: **512/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[34.0, 59.5, 270.0]`; bottom-centre pivot. Source geometry maximum error: `0.000012250` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-destroyer/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-destroyer/naval-destroyer-color.png` | `4fe91b256911b1281d9043dc14558c2855842d7d4d6496cec5cf03f05369553d` |
| `assets/roblox-upload/naval-destroyer/naval-destroyer-normal.png` | `da1eb6b3d1735c4990f4d3a41236b222efd618885a9cf482d6a31b95deb6ab33` |
| `assets/roblox-upload/naval-destroyer/naval-destroyer-roughness.png` | `54f65f781d837739ade35d86ad2bd29cfd31b173f345d8935ef2da6bc22ded05` |
| `assets/roblox-upload/naval-destroyer/naval-destroyer-metalness.png` | `af87307e440ccc9cf2a48b07dd1fc33d76b3944585498d92d7c7a88d4a0eaf21` |
| `assets/roblox-upload/naval-destroyer/naval-destroyer.fbx` | `a0ca71c777112eaecd2ab0fd147768c6ea501dc202a3a6bfa034b54a356077f5` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-destroyer/front.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/back.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/side.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/side-right.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/top.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/bottom.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/3q.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-destroyer/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-destroyer/preview-front.png`, `assets/roblox-upload/naval-destroyer/preview-side.png`, `assets/roblox-upload/naval-destroyer/preview-top.png`, `assets/roblox-upload/naval-destroyer/preview-3q.png`, `assets/roblox-upload/naval-destroyer/preview-back.png`, `assets/roblox-upload/naval-destroyer/preview-side-right.png`, `assets/roblox-upload/naval-destroyer/preview-bottom.png`, `assets/roblox-upload/naval-destroyer/preview-3q-front-left.png`, `assets/roblox-upload/naval-destroyer/preview-3q-rear-right.png`, `assets/roblox-upload/naval-destroyer/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-destroyer/comparison.png` and `/tmp/skybreak-pr221-renders/naval-destroyer/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-destroyer.json`.

### naval-frigate

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Generic chined hull, single funnel, small radome, deckhouses, bollards and rails; no copied distinctive warship details identified. No unresolved safety concern; no fix required.

Actual imported triangles: **508/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[30.0, 63.0, 240.0]`; bottom-centre pivot. Source geometry maximum error: `0.000012213` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-frigate/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-frigate/naval-frigate-color.png` | `cdd2ab772cb368b87fe29bf0ebe57a90987569d4989c1c03ea12ddea27f64787` |
| `assets/roblox-upload/naval-frigate/naval-frigate-normal.png` | `dc31a5ab4a09a1cb895b89e9d41f5fa5390d9fd71bc71a3dbbf53636868cb383` |
| `assets/roblox-upload/naval-frigate/naval-frigate-roughness.png` | `c54037b7d9c734024b9c52a2bc1c773f384c7b86f7ada64f6fb396a9962d59e5` |
| `assets/roblox-upload/naval-frigate/naval-frigate-metalness.png` | `99e2783597edf491cae3de0d88ce322a4a91a2abd937f6f60ac6f7830e2b52f0` |
| `assets/roblox-upload/naval-frigate/naval-frigate.fbx` | `15a7923a25f98061e7a74cad7923ee680ee64d57c10678757c85d87d27f3348c` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-frigate/front.png`, `/tmp/skybreak-pr221-renders/naval-frigate/back.png`, `/tmp/skybreak-pr221-renders/naval-frigate/side.png`, `/tmp/skybreak-pr221-renders/naval-frigate/side-right.png`, `/tmp/skybreak-pr221-renders/naval-frigate/top.png`, `/tmp/skybreak-pr221-renders/naval-frigate/bottom.png`, `/tmp/skybreak-pr221-renders/naval-frigate/3q.png`, `/tmp/skybreak-pr221-renders/naval-frigate/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-frigate/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-frigate/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-frigate/preview-front.png`, `assets/roblox-upload/naval-frigate/preview-side.png`, `assets/roblox-upload/naval-frigate/preview-top.png`, `assets/roblox-upload/naval-frigate/preview-3q.png`, `assets/roblox-upload/naval-frigate/preview-back.png`, `assets/roblox-upload/naval-frigate/preview-side-right.png`, `assets/roblox-upload/naval-frigate/preview-bottom.png`, `assets/roblox-upload/naval-frigate/preview-3q-front-left.png`, `assets/roblox-upload/naval-frigate/preview-3q-rear-right.png`, `assets/roblox-upload/naval-frigate/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-frigate/comparison.png` and `/tmp/skybreak-pr221-renders/naval-frigate/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-frigate.json`.

### naval-gun

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Single closed barrel and sealed muzzle, shield and base; abstract static in-game weapon. No unresolved safety concern; no fix required.

Actual imported triangles: **188/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[10.0, 9.55, 21.65]`; bottom-centre pivot. Source geometry maximum error: `0.000001349` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-gun/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-gun/naval-gun-color.png` | `8a2cf32f42b95660f03a7837ae986ccfddae9d1e31496de64dd74782e97a0ce7` |
| `assets/roblox-upload/naval-gun/naval-gun-normal.png` | `1b7ef6bee014503d8d326354a6f8913c37de0fee35f96c1ccb7e61aeae0f4ca3` |
| `assets/roblox-upload/naval-gun/naval-gun-roughness.png` | `1511dae1e9a9d75b0cecd1be87b82e407ce6e4d580a153f7133f320bdda079d9` |
| `assets/roblox-upload/naval-gun/naval-gun-metalness.png` | `7f31c1b7e5a82dd2ddbf2b3857317e013723394715bdeef293b92297200df7d4` |
| `assets/roblox-upload/naval-gun/naval-gun.fbx` | `d40e31a5a0f1b6b0a429b0eb283869a457cfc140ae9399983747c6831d17a63e` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-gun/front.png`, `/tmp/skybreak-pr221-renders/naval-gun/back.png`, `/tmp/skybreak-pr221-renders/naval-gun/side.png`, `/tmp/skybreak-pr221-renders/naval-gun/side-right.png`, `/tmp/skybreak-pr221-renders/naval-gun/top.png`, `/tmp/skybreak-pr221-renders/naval-gun/bottom.png`, `/tmp/skybreak-pr221-renders/naval-gun/3q.png`, `/tmp/skybreak-pr221-renders/naval-gun/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-gun/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-gun/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-gun/preview-front.png`, `assets/roblox-upload/naval-gun/preview-side.png`, `assets/roblox-upload/naval-gun/preview-top.png`, `assets/roblox-upload/naval-gun/preview-3q.png`, `assets/roblox-upload/naval-gun/preview-back.png`, `assets/roblox-upload/naval-gun/preview-side-right.png`, `assets/roblox-upload/naval-gun/preview-bottom.png`, `assets/roblox-upload/naval-gun/preview-3q-front-left.png`, `assets/roblox-upload/naval-gun/preview-3q-rear-right.png`, `assets/roblox-upload/naval-gun/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-gun/comparison.png` and `/tmp/skybreak-pr221-renders/naval-gun/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-gun.json`.

### naval-landing-craft

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Empty well, closed ramp, bulwarks and simple wheelhouse; no crew, troops or cargo figures. No unresolved safety concern; no fix required.

Actual imported triangles: **120/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[28.0, 28.0, 90.0]`; bottom-centre pivot. Source geometry maximum error: `0.000004768` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-landing-craft/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-landing-craft/naval-landing-craft-color.png` | `b54f2d5fbd414faa0edb4b9691f621dc406d12d6089a292d3264d62aa00e8a2d` |
| `assets/roblox-upload/naval-landing-craft/naval-landing-craft-normal.png` | `44da437029c7d4f5d146ca74521d3494a7244d9031b18a7d0205f846f7fcdf7e` |
| `assets/roblox-upload/naval-landing-craft/naval-landing-craft-roughness.png` | `13458c3011d7319957ff6d10b98b4528f848cfd60f2ffa869a42bfb36b2d1cc0` |
| `assets/roblox-upload/naval-landing-craft/naval-landing-craft-metalness.png` | `c91325000a20f519d85dd4de260d4f98d82efd920ece8e8c516247f642b4b94a` |
| `assets/roblox-upload/naval-landing-craft/naval-landing-craft.fbx` | `6cd9508665d80af057d70e336875c145944b018c0abe48a9e7353ea8f489373f` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-landing-craft/front.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/back.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/side.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/side-right.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/top.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/bottom.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/3q.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-landing-craft/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-landing-craft/preview-front.png`, `assets/roblox-upload/naval-landing-craft/preview-side.png`, `assets/roblox-upload/naval-landing-craft/preview-top.png`, `assets/roblox-upload/naval-landing-craft/preview-3q.png`, `assets/roblox-upload/naval-landing-craft/preview-back.png`, `assets/roblox-upload/naval-landing-craft/preview-side-right.png`, `assets/roblox-upload/naval-landing-craft/preview-bottom.png`, `assets/roblox-upload/naval-landing-craft/preview-3q-front-left.png`, `assets/roblox-upload/naval-landing-craft/preview-3q-rear-right.png`, `assets/roblox-upload/naval-landing-craft/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-landing-craft/comparison.png` and `/tmp/skybreak-pr221-renders/naval-landing-craft/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-landing-craft.json`.

### naval-landing-ship

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Empty vehicle deck and closed ramp; no vehicles, people or identifying signs. No unresolved safety concern; no fix required.

Actual imported triangles: **452/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[40.0, 59.5, 220.0]`; bottom-centre pivot. Source geometry maximum error: `0.000010790` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-landing-ship/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-landing-ship/naval-landing-ship-color.png` | `add886df5d7a02169f3ba867c67f7546bfb4f04b0e5ba2c1edb35d869039e977` |
| `assets/roblox-upload/naval-landing-ship/naval-landing-ship-normal.png` | `26ec8ba9f4fcf489e30dbd95d873c2b7bf7b1a72979ac06aac031c341a3ea886` |
| `assets/roblox-upload/naval-landing-ship/naval-landing-ship-roughness.png` | `e95f792572e0b51a99843631ee34837e265fd9a4cd808e25440e7f2a3587b1b9` |
| `assets/roblox-upload/naval-landing-ship/naval-landing-ship-metalness.png` | `814e40f2a3da46fbf4b72c628b9dfb92d6f3950522ce4b5748c76dc464fdd7e0` |
| `assets/roblox-upload/naval-landing-ship/naval-landing-ship.fbx` | `dc032ec7e752db25b512f1dcb1ea9f58c74fb787979708d140cbe93e78e6406f` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-landing-ship/front.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/back.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/side.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/side-right.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/top.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/bottom.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/3q.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-landing-ship/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-landing-ship/preview-front.png`, `assets/roblox-upload/naval-landing-ship/preview-side.png`, `assets/roblox-upload/naval-landing-ship/preview-top.png`, `assets/roblox-upload/naval-landing-ship/preview-3q.png`, `assets/roblox-upload/naval-landing-ship/preview-back.png`, `assets/roblox-upload/naval-landing-ship/preview-side-right.png`, `assets/roblox-upload/naval-landing-ship/preview-bottom.png`, `assets/roblox-upload/naval-landing-ship/preview-3q-front-left.png`, `assets/roblox-upload/naval-landing-ship/preview-3q-rear-right.png`, `assets/roblox-upload/naval-landing-ship/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-landing-ship/comparison.png` and `/tmp/skybreak-pr221-renders/naval-landing-ship/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-landing-ship.json`.

### naval-missile-boat

**APPROVE — 10/10**. Export version `naval-kit-2-profile2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Short chined hull with low deckhouse and closed equipment housings; separate combat mounts are not fused. No unresolved safety concern; no fix required.

Actual imported triangles: **452/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[18.0, 37.4, 105.0]`; bottom-centre pivot. Source geometry maximum error: `0.000006106` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-missile-boat/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-missile-boat/naval-missile-boat-color.png` | `1d7d41437fb2e2b1e13d2089b301ba73641247eb598daa526a3adc13e50ee11f` |
| `assets/roblox-upload/naval-missile-boat/naval-missile-boat-normal.png` | `adcf94cd2516c68e4bb4604481aa3d3c75e7f4e237e0bd6e920bd79ff1c6fc1b` |
| `assets/roblox-upload/naval-missile-boat/naval-missile-boat-roughness.png` | `da842cecedf066799fde56c111b702949e5d6393118b7c7609b846ab88ff3916` |
| `assets/roblox-upload/naval-missile-boat/naval-missile-boat-metalness.png` | `ffd363de1f578cfb56ad4a4d737d13a16a23efe0b86aca40b08b5a1583de8430` |
| `assets/roblox-upload/naval-missile-boat/naval-missile-boat.fbx` | `8cc6d0029bc3c74a48b857695277e8b215877f32bd50179d52bef186130e110e` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-missile-boat/front.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/back.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/side.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/side-right.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/top.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/bottom.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/3q.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-missile-boat/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-missile-boat/preview-front.png`, `assets/roblox-upload/naval-missile-boat/preview-side.png`, `assets/roblox-upload/naval-missile-boat/preview-top.png`, `assets/roblox-upload/naval-missile-boat/preview-3q.png`, `assets/roblox-upload/naval-missile-boat/preview-back.png`, `assets/roblox-upload/naval-missile-boat/preview-side-right.png`, `assets/roblox-upload/naval-missile-boat/preview-bottom.png`, `assets/roblox-upload/naval-missile-boat/preview-3q-front-left.png`, `assets/roblox-upload/naval-missile-boat/preview-3q-rear-right.png`, `assets/roblox-upload/naval-missile-boat/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-missile-boat/comparison.png` and `/tmp/skybreak-pr221-renders/naval-missile-boat/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-missile-boat.json`.

### naval-sam

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Three sealed rectangular canisters on a generic mount; no exposed missile internals or instructions. No unresolved safety concern; no fix required.

Actual imported triangles: **188/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[10.0, 14.363, 15.039]`; bottom-centre pivot. Source geometry maximum error: `0.000001354` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-sam/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-sam/naval-sam-color.png` | `c09900997d1431309974aafaefa0e557decb17936001d7ae5533a2cef3287e75` |
| `assets/roblox-upload/naval-sam/naval-sam-normal.png` | `8063a01e407fc099432609f162f7f1eeaa0dd081c48736fe7c77e6a168072e61` |
| `assets/roblox-upload/naval-sam/naval-sam-roughness.png` | `4023aaee389d1d7c9d8475639b58fc2b9d94e9cdbd29bfd908cf8dc2833c7264` |
| `assets/roblox-upload/naval-sam/naval-sam-metalness.png` | `0381df73b5f7b74d6f1f4a89e7937789320c52df98541fac5ebc8da7e5629da8` |
| `assets/roblox-upload/naval-sam/naval-sam.fbx` | `f2d5595d6510c75ba5544624bcb6dd3c7e5633141a374ac588153087e72f0bb6` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-sam/front.png`, `/tmp/skybreak-pr221-renders/naval-sam/back.png`, `/tmp/skybreak-pr221-renders/naval-sam/side.png`, `/tmp/skybreak-pr221-renders/naval-sam/side-right.png`, `/tmp/skybreak-pr221-renders/naval-sam/top.png`, `/tmp/skybreak-pr221-renders/naval-sam/bottom.png`, `/tmp/skybreak-pr221-renders/naval-sam/3q.png`, `/tmp/skybreak-pr221-renders/naval-sam/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-sam/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-sam/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-sam/preview-front.png`, `assets/roblox-upload/naval-sam/preview-side.png`, `assets/roblox-upload/naval-sam/preview-top.png`, `assets/roblox-upload/naval-sam/preview-3q.png`, `assets/roblox-upload/naval-sam/preview-back.png`, `assets/roblox-upload/naval-sam/preview-side-right.png`, `assets/roblox-upload/naval-sam/preview-bottom.png`, `assets/roblox-upload/naval-sam/preview-3q-front-left.png`, `assets/roblox-upload/naval-sam/preview-3q-rear-right.png`, `assets/roblox-upload/naval-sam/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-sam/comparison.png` and `/tmp/skybreak-pr221-renders/naval-sam/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-sam.json`.

### naval-submarine

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Generic tapered pressure hull, sail, sensors and diving planes; no identifiable class or insignia. No unresolved safety concern; no fix required.

Actual imported triangles: **284/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[28.0, 39.0, 200.0]`; bottom-centre pivot. Source geometry maximum error: `0.000007633` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-submarine/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-submarine/naval-submarine-color.png` | `bb189e54b322c6c26f5206c3fead05db8f4009962892995da3120b1a2cfecdb0` |
| `assets/roblox-upload/naval-submarine/naval-submarine-normal.png` | `beb4941a516ed42a4276c23251c6283ba564eec1bc989f0800034420300bcf91` |
| `assets/roblox-upload/naval-submarine/naval-submarine-roughness.png` | `9859b044dfd2fba1c54c23a2796d4263c5f76f2833b30b5ff53150c4257d3cf5` |
| `assets/roblox-upload/naval-submarine/naval-submarine-metalness.png` | `89c0d9592d666e4acaa7f90efef317419b0c841826d7ec155928578fa1867a06` |
| `assets/roblox-upload/naval-submarine/naval-submarine.fbx` | `29bbfecdbf48f1f327c8572a4b11ba3c6fa81b5c9f75fa6fa61999f7bc6b5a76` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-submarine/front.png`, `/tmp/skybreak-pr221-renders/naval-submarine/back.png`, `/tmp/skybreak-pr221-renders/naval-submarine/side.png`, `/tmp/skybreak-pr221-renders/naval-submarine/side-right.png`, `/tmp/skybreak-pr221-renders/naval-submarine/top.png`, `/tmp/skybreak-pr221-renders/naval-submarine/bottom.png`, `/tmp/skybreak-pr221-renders/naval-submarine/3q.png`, `/tmp/skybreak-pr221-renders/naval-submarine/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-submarine/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-submarine/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-submarine/preview-front.png`, `assets/roblox-upload/naval-submarine/preview-side.png`, `assets/roblox-upload/naval-submarine/preview-top.png`, `assets/roblox-upload/naval-submarine/preview-3q.png`, `assets/roblox-upload/naval-submarine/preview-back.png`, `assets/roblox-upload/naval-submarine/preview-side-right.png`, `assets/roblox-upload/naval-submarine/preview-bottom.png`, `assets/roblox-upload/naval-submarine/preview-3q-front-left.png`, `assets/roblox-upload/naval-submarine/preview-3q-rear-right.png`, `assets/roblox-upload/naval-submarine/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-submarine/comparison.png` and `/tmp/skybreak-pr221-renders/naval-submarine/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-submarine.json`.

### naval-supply-ship

**APPROVE — 10/10**. Export version `naval-kit-2`. Reviewer/date/creator and policy links: as above (apply individually to this asset).

Empty cargo hatches and simplified crane; generic unmarked chined hull. No unresolved safety concern; no fix required.

Actual imported triangles: **476/2400**; one mesh, one UV layer, four 256×256 embedded maps. Size in studs: `[40.0, 59.5, 240.0]`; bottom-centre pivot. Source geometry maximum error: `0.000012213` studs.

Exact files (repository-relative paths; retained copies under `/tmp/skybreak-pr221-renders/naval-supply-ship/`):

| Path | SHA-256 |
|---|---|
| `assets/roblox-upload/naval-supply-ship/naval-supply-ship-color.png` | `49e877155b57790e4d4e073f8d5d317f0d249fe64ebe0058f2029aab6c1184cb` |
| `assets/roblox-upload/naval-supply-ship/naval-supply-ship-normal.png` | `8929612275d6322b1d7c7bdbe81495586b1cbb7d0f6d59e744af22b34802b7f2` |
| `assets/roblox-upload/naval-supply-ship/naval-supply-ship-roughness.png` | `a2cfed45cf830711b63db54aa91e14d4eeef003bf31c77c791689da171fa3f37` |
| `assets/roblox-upload/naval-supply-ship/naval-supply-ship-metalness.png` | `8025811f18b1819906994201e498f48df9a490a2a936813eb27aa767d1433ca9` |
| `assets/roblox-upload/naval-supply-ship/naval-supply-ship.fbx` | `6f3dac33a96b40be68c6080a6bf2c29467f4c8a65015e9f9c20fcfc351dedd08` |

Independent renders examined: `/tmp/skybreak-pr221-renders/naval-supply-ship/front.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/back.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/side.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/side-right.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/top.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/bottom.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/3q.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/3q-front-left.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/3q-rear-left.png`, `/tmp/skybreak-pr221-renders/naval-supply-ship/3q-rear-right.png`.

Committed previews examined: `assets/roblox-upload/naval-supply-ship/preview-front.png`, `assets/roblox-upload/naval-supply-ship/preview-side.png`, `assets/roblox-upload/naval-supply-ship/preview-top.png`, `assets/roblox-upload/naval-supply-ship/preview-3q.png`, `assets/roblox-upload/naval-supply-ship/preview-back.png`, `assets/roblox-upload/naval-supply-ship/preview-side-right.png`, `assets/roblox-upload/naval-supply-ship/preview-bottom.png`, `assets/roblox-upload/naval-supply-ship/preview-3q-front-left.png`, `assets/roblox-upload/naval-supply-ship/preview-3q-rear-right.png`, `assets/roblox-upload/naval-supply-ship/preview-3q-rear-left.png`.

Also examined `/tmp/skybreak-pr221-renders/naval-supply-ship/comparison.png` and `/tmp/skybreak-pr221-renders/naval-supply-ship/textures.png`. Approval: `/tmp/naval-kit-approvals/naval-supply-ship.json`.

## Upload-gate handoff

The twelve top-level approval JSONs use the existing military-*.json format expected by upload-models.py. Current roblox_upload.py additionally requires an exact export-manifest.json, one matching committed decision, and committed source review. These are absent for the dormant naval kit at this PR head, so this safety APPROVE does not imply that uploads currently pass the gate. Supplied matching decisions in `/tmp/naval-kit-approvals/decisions/` (integer score 10) and manifests in `/tmp/naval-kit-approvals/export-manifests/`. The orchestrator must commit approvals to docs/qa/asset-reviews/approvals/, decisions to docs/qa/asset-reviews/decisions/, each manifest as assets/roblox-upload/<asset>/export-manifest.json, and this report to the sourceReview/record path specified above, then merge evidence to origin/main. No gate bypass, upload, or activation was performed. All 12 approval/manifest/decision sets were additionally accepted by the real require_model_review parser with committed-file reads and Git decision listing mocked to these exact local artifacts; this is format validation, not production authorization. Log: /tmp/pr221-approval-format.log.

## Part 2 — APPROVE

No actionable code findings in the dormant integration at the reviewed head. Static review conclusions:

- Fallbacks: RobloxAssetIds.ts:73–84 leaves all twelve IDs undefined. GroundTargetFactory.ts:21–23 retains the existing military fallback when naval cache is unavailable. CompositionWorld.ts adds decoration only after original placement/stand-ins; missing decoration leaves proxies untouched.
- Target identity/gameplay: no mission target data, health, score, position, footprint, collision proxy or combat allocation changed. Bounds/aim are captured before cosmetic decoration (GroundTargetFactory.ts:47–56 and 121–123). Existing primary parts remain. New visual parts disable query, touch, collision and FlightSolid; original proxies remain (lines 36–38).
- D2/D12: SurfaceTargetRuntime.ts and SurfaceTargetRules.ts are unchanged. Separate mounts remain target-owned children of their own combat models, parentId retirement, no collateral kill credit, routes, sinking every descendant and bridge-route velocity clearing remain unchanged. Added meshes follow existing PivotTo and sink loops. No new per-frame callbacks or traversal introduced; activated assets add only their ordinary descendant movement/render cost.
- Budget: all twelve keys registered with 24-instance allowances in WorldInstanceBudget.ts:9–16. Both decorators reject oversized imports before hiding proxies (GroundTargetFactory.ts:30–36, NavalDecoration.ts:18–20). Accepted decorations carry the existing budget marker and are checked/count separately from the unchanged base caps under hotfix #220. This does not assert total descendants remain below the base-only cap: total remains base plus bounded kit allowances, as designed in #220.
- Fit: independent FBX dimensions match authoredSize/size and bottom-centre convention. GroundTargetFactory.ts:24–27 and NavalDecoration.ts:14–16 uniformly fit existing bounds. Current M09 scenery placements have yaw zero, consistent with the axis-aligned scenery fitting helper; do not generalize that helper to rotated scenery without extending its bounds/orientation handling. Actual Roblox import appearance and runtime assembly were not observed.
- Publish gate: check-place-assets.py, roblox_upload.py and the strict publish workflow were not changed. Existing approvedUpload manifest entries are preserved byte-for-byte. write_manifest.py preserves prior evidence only for unchanged dependency bytes. No naval FBXs are newly embedded in the place and no naval IDs assigned. Offline inventory is structural, not publication authorization.

Validation personally run on exact head:

- `bun install --frozen-lockfile`: exit **0**, log `/tmp/pr221-install.log`.
- `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: exit **0**, log `/tmp/pr221-validation.log`; includes place build/inventory, module compile, **1,228 Luau contracts passed, 0 failed**, **165 Python tests passed**.
- Studio assembly tests compiled, not run. No Studio, Player, device-performance or live import claims.

All six human documents were inspected/reconciled against this review: they consistently describe this PR as unmerged/dormant with IDs unset and no new Player verification. Their pending-review status describes the committed branch before these external review artifacts. Read-only instructions prohibit changing them; the orchestrator should update them when incorporating this review. Existing older ledger entries are outside this asset review.

Scratch checkout had no tracked or untracked changes before removal. `git worktree remove /tmp/skybreak-pr221-review` completed with exit 0; checkout removed. Review artifacts and logs remain under /tmp.
