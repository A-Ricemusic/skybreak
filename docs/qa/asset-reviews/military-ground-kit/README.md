# Military ground kit — independent review packet

Status: **PENDING — NOT APPROVED, NOT UPLOADED**. Creator: implementation agent. Reviewer: unassigned. Review date/verdict: pending. No 10/10 safety assessment has been performed.

All ten RobloxAssetIds are undefined. No Studio launch, upload or Player test. Before any upload an independent reviewer must inspect the exact FBX exports, all four included textures and their assembled UV/material appearance from every relevant angle, consult current official policies (including applicable linked policies), record reviewer/date and explicitly approve 10/10. A re-export invalidates any approval. A maximum project safety judgment cannot guarantee moderation outcomes.

Policies for the reviewer to consult at review time: [Terms](https://www.roblox.com/termsofuse), [Community Standards](https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/). This packet does not claim a current-policy review.

Original procedural modeling only, no external models or textures. No figures, skin, text, flags, insignia or unit markings. Static covered gun barrels and sealed launch canisters are present: reviewer must assess them explicitly. Generator precheck booleans are creator declarations, not independent approval. No approval JSON is created.

Generator: `tools/assets/military_ground_kit.py`, invoked through `tools/assets/build.py`. One atlas material and one mesh per model, four 256² PBR maps, maximum 2,500 triangles; centimetre FBX convention and bottom-centre pivot from skyasset. No Blender source file required; scripts regenerate every export. Versions are pinned per checklist. Track revisions have suffix `-track2`; truck rack revision has suffix `-rack2`.

Runtime: `MilitaryGroundKit.ts` maps types; `GroundTargetFactory` fits each visual uniformly within the original bounds, retains invisible original query proxies and pre-decoration aim, and uses `WorldAssets.PlaceUploaded` with unchanged fallback on unset/failed IDs. World preload is bounded. D6 detail promotion uses the same factory; far cheap contacts deliberately keep their existing low-cost Part LOD. No target ID/position/footprint/health/score changes. Specialist generators, core and railguns are excluded. M10 semantic aliases are preserved; M15 already types 61 slots as vehicle, so this kit uses trucks there without inferring new barracks/tank roles. Future upload integration must verify orientation and appearance in Player; this branch cannot establish phone rendering or frame cost.

## Mission inventory

Counts are unique typed target IDs across expanded phases, including reserves and additions; not simultaneous contact counts or scenery counts. Generated from the compiled mission catalog with `tools/assets/ground_kit_packet.py`; full per-ID evidence is `mission-inventory.json`. M11, M13, M14 and M18 have no matching typed contacts (their specialist/protected scenery remains separate).

| Asset | M01–06 | M07 | M08 | M09 | M10 | M11–14 | M15 | M16 | M17 | M18 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| military-aa | 37 | 4 | 0 | 7 | 20 | 9 | 0 | 14 | 17 | 0 | 108 |
| military-artillery | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 10 | 0 | 0 | 19 |
| military-barracks | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 | 24 |
| military-bunker | 0 | 2 | 0 | 16 | 0 | 0 | 0 | 8 | 0 | 0 | 26 |
| military-containers | 7 | 0 | 0 | 0 | 12 | 0 | 0 | 0 | 0 | 0 | 19 |
| military-fuel | 32 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 40 |
| military-radar | 9 | 1 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 19 |
| military-sam | 18 | 2 | 0 | 2 | 12 | 7 | 0 | 0 | 8 | 0 | 49 |
| military-tank | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 100 | 30 | 0 | 137 |
| military-truck | 0 | 0 | 0 | 5 | 0 | 0 | 61 | 6 | 0 | 0 | 72 |

Regenerate under one build lease: `JOBS=1 sh tools/assets/build-all.sh military-aa military-artillery military-barracks military-bunker military-containers military-fuel military-radar military-sam military-tank military-truck` (bump export versions first). After offline validation: `LUAU_BIN=... python3 tools/assets/ground_kit_packet.py`.

## Exact exports and dependencies

Every file below is relative to its asset folder under `assets/roblox-upload/`. Checklists also pin every dependency and preview hash. FBX embeds all four maps; standalone maps permit review. Checklists themselves are hashed here. No uploads are authorized by this packet.

### military-aa

Version `military-ground-kit-1`; 192 / 2500 triangles; size [12.0, 14.0, 21.894] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-aa/checklist.json` | `6d2ea72252571183e194671cbfcb36501f043d8015f4269f6fa45022d0afc4f0` |
| `assets/roblox-upload/military-aa/contact-sheet.png` | `4645666c19a86af66e1d972583a144b7d3ed88eabefc074596c05ffc66769992` |
| `assets/roblox-upload/military-aa/military-aa-color.png` | `51e8732f2cbb517a0b7d19711a97d574bd3be601d7e971a15439d90aa412f4fa` |
| `assets/roblox-upload/military-aa/military-aa-metalness.png` | `c409dbf9a8a752354d5ef9be216dc700cc12177f93c8e7dbdb1e704eb22d7c92` |
| `assets/roblox-upload/military-aa/military-aa-normal.png` | `8cafd0c47b204082c34d822790085e1f889ea54cf2d3c253f72c245e2e98c367` |
| `assets/roblox-upload/military-aa/military-aa-roughness.png` | `3a575e4db6143371c71dacd9f6f1d61baf5ab7a761c4825b5462a17ea33d3775` |
| `assets/roblox-upload/military-aa/military-aa.fbx` | `ac7e8453d2077034c4baf5ae7906c911122e8b764fe2902afadff66cf91ba606` |
| `assets/roblox-upload/military-aa/preview-3q-front-left.png` | `99ae26092041943d11cc1f13485d6a0066bd1989c72aec274e8ed2d9a05c2a7f` |
| `assets/roblox-upload/military-aa/preview-3q-rear-left.png` | `3ff7cc1ded422c111fd2b2ef7aa3185e5933b6c37f26710b6bc1e1353100f21f` |
| `assets/roblox-upload/military-aa/preview-3q-rear-right.png` | `bd1362e5ec2098aaf30f401532b395c6eba13978bbeda82567997336905efc02` |
| `assets/roblox-upload/military-aa/preview-3q.png` | `24840caac87c2798b4bc1b53b953f5b1e13c72ee5287622d124d156e15761315` |
| `assets/roblox-upload/military-aa/preview-back.png` | `eb6ec13b576fd00ea8000d81fa244c45db3d4624c8e37e29a098d6fedae480ab` |
| `assets/roblox-upload/military-aa/preview-bottom.png` | `2941128e8ecc2b2cca060bb6592bbb9d6ce4be68253f2f01a9b2a7eee3511eb8` |
| `assets/roblox-upload/military-aa/preview-front.png` | `6dc96c54173487d41477df7e7bd688e1fd4a5816f0f8b52c95fab0dfe34c014e` |
| `assets/roblox-upload/military-aa/preview-side-right.png` | `8937e18403fac3e1d45d86d2974635a2f21acdb6dac2c5641cca378e078d2174` |
| `assets/roblox-upload/military-aa/preview-side.png` | `611a9bcee6053b16d0b2bca74c3e2cd916e5db5f3b1c9435aea2911388ea23d3` |
| `assets/roblox-upload/military-aa/preview-top.png` | `6b763fb5fef8009499225e56abb83cddf171ab77207bae4efbecd038e2b5df72` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-artillery

Version `military-ground-kit-1-track2`; 1620 / 2500 triangles; size [17.52, 14.4, 33.5] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-artillery/checklist.json` | `ce62ca6aa8cf5ce241820ddcc2d781e4eb3401c402e76c1d2734fc748ceabf45` |
| `assets/roblox-upload/military-artillery/contact-sheet.png` | `91f237c8e19426b662b0d98fd531d1f7864341aa33bba0016c2d586a93747b26` |
| `assets/roblox-upload/military-artillery/military-artillery-color.png` | `a2bced731a106701737b437d204af6cdfc0dad1ae10a75426d28f262aea643f4` |
| `assets/roblox-upload/military-artillery/military-artillery-metalness.png` | `5007eb8ecde6e746612b3fe9b58ab202653d2dee7b7d0b1f24a98bf822fadade` |
| `assets/roblox-upload/military-artillery/military-artillery-normal.png` | `3d0fa8174158170a3b7d42a7fd10a56eba13dd9ec534ff597a6bf7de5fd6198c` |
| `assets/roblox-upload/military-artillery/military-artillery-roughness.png` | `c8dab95fb23d608e38a9bfa53f2bf79c1d5c3902e58164e3b360c865dbc6a707` |
| `assets/roblox-upload/military-artillery/military-artillery.fbx` | `1a0e91dd74c9da144883b5c2799e276df1501e8f3ff4ad8f797185755608ed48` |
| `assets/roblox-upload/military-artillery/preview-3q-front-left.png` | `68a650711ba92ec2761651d6fc912dc276d803a38c85a520365f337b3fd6cfae` |
| `assets/roblox-upload/military-artillery/preview-3q-rear-left.png` | `e7ec8063fff7cd41d2624853a197961a28daccf2da7bf04f7a889800dabe7501` |
| `assets/roblox-upload/military-artillery/preview-3q-rear-right.png` | `ec2819c19868ed7672108513082b013183412e20a81c633da0f949a804fd2832` |
| `assets/roblox-upload/military-artillery/preview-3q.png` | `85823c8fd2b513d337fbf719e11cecb927fda85e620313de61c20249598b39c4` |
| `assets/roblox-upload/military-artillery/preview-back.png` | `65155f4265a329bf7d2cb94dcadb8e7ae01bd65ddab74f1abe45c020aaed1610` |
| `assets/roblox-upload/military-artillery/preview-bottom.png` | `64f581225526b74102567478f0513658b248b48366929de87c025616ead31e6f` |
| `assets/roblox-upload/military-artillery/preview-front.png` | `d05e520c0bfd0152daa5bc4874b1bc45ccfb705bd7be81f7649d4f4edfd42810` |
| `assets/roblox-upload/military-artillery/preview-side-right.png` | `f3c43167510443a790d17b194d45f70380b5535c47a8a8b292f2d871cc11bfb2` |
| `assets/roblox-upload/military-artillery/preview-side.png` | `c34ae07ab3546c665884e1f1f28627ce98c460f776d2b87f4a6471c6a9ca2f2d` |
| `assets/roblox-upload/military-artillery/preview-top.png` | `be81c3ab0dc5aa083c749467376b00eb930ee89a7ab1baf7b05ba95be50bf920` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-barracks

Version `military-ground-kit-1`; 164 / 2500 triangles; size [30.0, 19.0, 70.0] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-barracks/checklist.json` | `d2d3d66117bf8037b4ae76b33c2a0ed9bfdef68daa6f7f8a63f1399904b3e4bd` |
| `assets/roblox-upload/military-barracks/contact-sheet.png` | `93f6447c9b99b7ec43ec0d2fb59068825c004dd91cee21d1f98a04e9cbf82911` |
| `assets/roblox-upload/military-barracks/military-barracks-color.png` | `83399210687ddfed4737da6d0221be9834df36606e2f9f6c731f857d3111057f` |
| `assets/roblox-upload/military-barracks/military-barracks-metalness.png` | `966068dd0c23c60abeffaa37e2c5701bf72985d38acde8ca90619f242925df38` |
| `assets/roblox-upload/military-barracks/military-barracks-normal.png` | `44da437029c7d4f5d146ca74521d3494a7244d9031b18a7d0205f846f7fcdf7e` |
| `assets/roblox-upload/military-barracks/military-barracks-roughness.png` | `20a410eea3e47aff6e1ef8dbdacc605c5460275671d4fc739798a953c0630bf0` |
| `assets/roblox-upload/military-barracks/military-barracks.fbx` | `d4847b3fe1382d5df4f9bd055e0a3fc37b0c72d198193c2c9686dc0fa404888f` |
| `assets/roblox-upload/military-barracks/preview-3q-front-left.png` | `36dc3a8e493c3383f2e0c5b0cb4235c64d1531bf117b6ec5f549d9ba912cb641` |
| `assets/roblox-upload/military-barracks/preview-3q-rear-left.png` | `b7e43abecca16ab8fd2dacdd11f18668b4045393c7e6ff1bd54db9e7ee33048d` |
| `assets/roblox-upload/military-barracks/preview-3q-rear-right.png` | `be6d25e003be311bfe73264e7bb838f5820d6c0bac5c9df4fa18926912121b7a` |
| `assets/roblox-upload/military-barracks/preview-3q.png` | `590076c9d448b17888c9e790b59e6c26e3e83f579cfa5886281a29501a3797cd` |
| `assets/roblox-upload/military-barracks/preview-back.png` | `d57f7244ad40bee8d8b35ad48a19ae5be2543dd61a88e705f2f46f431f50f80a` |
| `assets/roblox-upload/military-barracks/preview-bottom.png` | `f793afee1509f5cf22ab86665e4b0fde50c41ad6960d12d79ad7b3a87526b39c` |
| `assets/roblox-upload/military-barracks/preview-front.png` | `6b88ff67c1e241ad8c5e8cff735d8f639dde0c2bb26a9cb0c9b7d98a895d659b` |
| `assets/roblox-upload/military-barracks/preview-side-right.png` | `4bddfec28926bdc53a5a42e78afd022dadb9859500ae5b35b1bda50bb699b790` |
| `assets/roblox-upload/military-barracks/preview-side.png` | `3748c65f5447f72801f35544ea542bf1aac98a6e2ccea2a5bcbe7cddded038c4` |
| `assets/roblox-upload/military-barracks/preview-top.png` | `ee19295782c033bccf3616e94cda4db09fc6cff8a675a101598d6391bb558e17` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-bunker

Version `military-ground-kit-1`; 76 / 2500 triangles; size [36.0, 14.055, 30.0] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-bunker/checklist.json` | `72983e0dacefe21b6aac5884f5d149fa060523b96bb40c9c68ded8a9361a68ed` |
| `assets/roblox-upload/military-bunker/contact-sheet.png` | `63dfe6b4ac40d761522910df7c3e177ac85e0c795e6dfd199f1c7fc61074970c` |
| `assets/roblox-upload/military-bunker/military-bunker-color.png` | `14f41da43bac606412e7e0866328f90bf130cec5130463e42560d0bb0c06e51b` |
| `assets/roblox-upload/military-bunker/military-bunker-metalness.png` | `a958736551e83599a152ffdb126691902340569c1d15af803c820a002ed5b284` |
| `assets/roblox-upload/military-bunker/military-bunker-normal.png` | `44da437029c7d4f5d146ca74521d3494a7244d9031b18a7d0205f846f7fcdf7e` |
| `assets/roblox-upload/military-bunker/military-bunker-roughness.png` | `0738bde613528196c7e9ce0ce14568bd791d910d6ddac79799ce7bf4f6e63267` |
| `assets/roblox-upload/military-bunker/military-bunker.fbx` | `bc9bbf7a15fb380722b5734c0cb964db04ca65bcd357d6b11083a4c903565ab7` |
| `assets/roblox-upload/military-bunker/preview-3q-front-left.png` | `e9a8c92fe28f60f4c9aa67b6cb7e2abe0bc2168c35670ad0006781005e1ab053` |
| `assets/roblox-upload/military-bunker/preview-3q-rear-left.png` | `37cabb0a32e7a2a14790438c35f6f93cf033c39075be35c570bf5bb56eed3f69` |
| `assets/roblox-upload/military-bunker/preview-3q-rear-right.png` | `9281183944113e01de7122851d574e48db17394863f704a305da91e8df38ba73` |
| `assets/roblox-upload/military-bunker/preview-3q.png` | `df90e9fcb5f5b99220f77ffa78c92ae83eb425ff974ce5923c2da4c2d13e7c10` |
| `assets/roblox-upload/military-bunker/preview-back.png` | `6f62b1bc4bdfeb0e9bab047474e1e1c4bbf0c5e63dd0d5f2f7ca66c09532c165` |
| `assets/roblox-upload/military-bunker/preview-bottom.png` | `919cc5426cc7e96d30647360bc02f076274abaaf6e1b3230a7b82be9fad9301e` |
| `assets/roblox-upload/military-bunker/preview-front.png` | `db311f5a8b96bb92761416b125162bc19f8736b9054712a62be39e81ce39faae` |
| `assets/roblox-upload/military-bunker/preview-side-right.png` | `e5c8544eb0560bc839b805f36ccf12295b4519d9eace36b37b2ed6652c8cbd9c` |
| `assets/roblox-upload/military-bunker/preview-side.png` | `a919d5b120f6cfe67a0acfcbf9f4ad6d9c6e6618de54f50a130edbe5efdcabe4` |
| `assets/roblox-upload/military-bunker/preview-top.png` | `91517ab6827cf3ba5f85ccf3861261ea35d2276e960c362bb74f246ae85a860d` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-containers

Version `military-ground-kit-1`; 900 / 2500 triangles; size [31.45, 24.0, 36.3] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-containers/checklist.json` | `d69c338a2a8655c06009e428ab15755f48c715d78c162bdccb163d99ae746b99` |
| `assets/roblox-upload/military-containers/contact-sheet.png` | `068698f2e5b195523bd93e9376e9e4cabc2f3d1bb80bc32c225ac4d810c97a3d` |
| `assets/roblox-upload/military-containers/military-containers-color.png` | `d072bee7f36d52d3d5eab963ba0f976ae235855af9234d2c960d7129d7b2b0d6` |
| `assets/roblox-upload/military-containers/military-containers-metalness.png` | `c98c849d2a897e9936e0f4d712e347c4ab3bb041a86ad7cc19237d202f6d25f3` |
| `assets/roblox-upload/military-containers/military-containers-normal.png` | `44da437029c7d4f5d146ca74521d3494a7244d9031b18a7d0205f846f7fcdf7e` |
| `assets/roblox-upload/military-containers/military-containers-roughness.png` | `5028f67c709aabb033057ae063555452889c344ee5c2210a6b0e7336669fbcc1` |
| `assets/roblox-upload/military-containers/military-containers.fbx` | `35ef2eb36f74f1e85dd359c668b94f4e4084be39605b2a1c9e6706f32618bdf3` |
| `assets/roblox-upload/military-containers/preview-3q-front-left.png` | `f1aac9aa610911b93318c83d7e9b6077ce15741660fdfaaa6297cace2b834b14` |
| `assets/roblox-upload/military-containers/preview-3q-rear-left.png` | `325adcc261bac547615a36d059ea3afedc7741f647f55b736c0b20163cc1efe5` |
| `assets/roblox-upload/military-containers/preview-3q-rear-right.png` | `17f0202453e897b9f08c22c00ccdbf1b79c47e92a138631cd74d21f062e7201f` |
| `assets/roblox-upload/military-containers/preview-3q.png` | `99a8cf1333d108c6d7407417db76ade34dff5dc67ec139f4a437e8ba98e459c2` |
| `assets/roblox-upload/military-containers/preview-back.png` | `8aa0736c0ce20de3d215d6a63995811c8abd6f0f7a11f2d15525ae64a2223f12` |
| `assets/roblox-upload/military-containers/preview-bottom.png` | `36e422b61da18c6c194c60e545721dba9f360250ccaba811efe698ccd981f151` |
| `assets/roblox-upload/military-containers/preview-front.png` | `6b6ee050928f4e82a7e326cbf08c1d35059f6ea4f86b4e54c8d2f11e9654e7a6` |
| `assets/roblox-upload/military-containers/preview-side-right.png` | `98e879b6cace171309445ae669450f38d5a86c1c0c77e1315f0087ecdcb0bb17` |
| `assets/roblox-upload/military-containers/preview-side.png` | `d84439012fefd05f165952135f1f7188eaf9a66ddf252fc4e861c566b4cc6f56` |
| `assets/roblox-upload/military-containers/preview-top.png` | `431ec924ef70005b651f2fe0aa5cec2fbfa74bb8f3319438ff21d21e907ca770` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-fuel

Version `military-ground-kit-1`; 976 / 2500 triangles; size [36.4, 26.5, 16.4] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-fuel/checklist.json` | `87dc3592c5a52d0392203fd9d6e67ed6022b3aa2dcf52f67e90f483d2100f3e5` |
| `assets/roblox-upload/military-fuel/contact-sheet.png` | `cbd4c20b4e5d46b5f5d055fb4e8075bd03bd9e17b44c35410400d7e4ed5fab17` |
| `assets/roblox-upload/military-fuel/military-fuel-color.png` | `45126ad36e6545e2b71698086b894d2269a51e6e2f73f1ba1d0fd5e862ff0e00` |
| `assets/roblox-upload/military-fuel/military-fuel-metalness.png` | `0454a9e82124f21dee89e64ef47016f89854fc5a1dc7b215a77e6f3795c6f8ca` |
| `assets/roblox-upload/military-fuel/military-fuel-normal.png` | `eb26d39d61bdb327cf89080f60ba6dcc55f39d0c9552c69cd9c3a9a10088796e` |
| `assets/roblox-upload/military-fuel/military-fuel-roughness.png` | `7c189577f6d765bac7244230c04ba2eccd5d478f4047457c2531b1f6cc603fc0` |
| `assets/roblox-upload/military-fuel/military-fuel.fbx` | `def28d8711bcb096d700d47a743f2c5dd7a143b3230a20aed774b27cf922fe63` |
| `assets/roblox-upload/military-fuel/preview-3q-front-left.png` | `f47f5a9428f713ae6b8bde2d5dcc62d0016c263c966c4e281b79892101ae89a4` |
| `assets/roblox-upload/military-fuel/preview-3q-rear-left.png` | `e021c67fe701a9a1b8bb966952633663288b2b6e347359290bb8c3029b5e671e` |
| `assets/roblox-upload/military-fuel/preview-3q-rear-right.png` | `cf19fce39a37d27504a3de293279ccdcd624e4dfe9e5ed528fabb5e576a2ef9a` |
| `assets/roblox-upload/military-fuel/preview-3q.png` | `e0cc36f75af1b12767435ea952adf4c65f39b377a19a8e3a14e7225d9a2e0dbc` |
| `assets/roblox-upload/military-fuel/preview-back.png` | `779013d1e6612807a7f104efbe32f8f8e3c6f9fa4b38250f65e4911f04a04972` |
| `assets/roblox-upload/military-fuel/preview-bottom.png` | `f55308b731fd2b9236a335665dbbb53e28d640869dec105a0b7cb316a488bfc6` |
| `assets/roblox-upload/military-fuel/preview-front.png` | `29bf7c5386f9a78bd566663ca778aa8e9256fe5f67a0fcf30f449ef41e5d856c` |
| `assets/roblox-upload/military-fuel/preview-side-right.png` | `097e467c7b6f04323d16a9f2bbad129a67b896188a84429b72cca9f99d6c10d1` |
| `assets/roblox-upload/military-fuel/preview-side.png` | `c5f4667ee5e9941db7c1fdfeb0ffe4d6b97ae972b886374764a1835e7a9e8f79` |
| `assets/roblox-upload/military-fuel/preview-top.png` | `449b86e5432b8059660244a89e106c71d2a669df7643fa33b47a31c6620d55e3` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-radar

Version `military-ground-kit-1`; 480 / 2500 triangles; size [18.0, 31.0, 19.75] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-radar/checklist.json` | `765adfa698667c4ac078bf246128be3deebf178cb215cc6697aa7847121328a5` |
| `assets/roblox-upload/military-radar/contact-sheet.png` | `f009859770c098ebe5af97723ae64ff6262cd3d060923dee094fba5847fc3350` |
| `assets/roblox-upload/military-radar/military-radar-color.png` | `aecdc46ea087b8a211c67b78351e6e329eba6aa1c5c4abfcdb37f0bc3889a2c7` |
| `assets/roblox-upload/military-radar/military-radar-metalness.png` | `8aeeb64fa1958c7b23f2deb58d32607a8020edce79bbdcc1f6f1239b05b416b7` |
| `assets/roblox-upload/military-radar/military-radar-normal.png` | `ad83a68143ce988777cc56eeecdb995c5a54c0de1102e04f3115204923b41d15` |
| `assets/roblox-upload/military-radar/military-radar-roughness.png` | `e5a7e6b63e94745c2b964370c71ddedc45cb75fba94fc2df9b2bfb7bbc186925` |
| `assets/roblox-upload/military-radar/military-radar.fbx` | `45674bc98d39f180214277f4f3385b3b8dda92fcc82d2b49314c81f4610c8462` |
| `assets/roblox-upload/military-radar/preview-3q-front-left.png` | `e2adf44d4ce85d8d01a8c028d8dd8859203b8d08bd5c66bdab9d7bf3cf26ef25` |
| `assets/roblox-upload/military-radar/preview-3q-rear-left.png` | `1dfbeb3a972c7d18188291a8b1365630b710ba16c1ab68eb8957ce47f42d8d98` |
| `assets/roblox-upload/military-radar/preview-3q-rear-right.png` | `b007fb4dd77b982c82c10898eb83467201c6308533c0eea01055d8e8c93bd111` |
| `assets/roblox-upload/military-radar/preview-3q.png` | `dae55f8384057a9c7b284d04c7038b24b5eaf31f5a85761124329cd5fc5a2ba7` |
| `assets/roblox-upload/military-radar/preview-back.png` | `5771e4cae2a5d5af0bb44aaea1e70e67e7104feb115a0eb9999039c62e5ae897` |
| `assets/roblox-upload/military-radar/preview-bottom.png` | `7161cf65226367851a40241522a7f044fe9e0fcf2ed11a30c9add5195d1af574` |
| `assets/roblox-upload/military-radar/preview-front.png` | `1e569ddd034c23c8b7a0793fb95fa72b84b3e2cd18fe91b4a0b3f464b738969a` |
| `assets/roblox-upload/military-radar/preview-side-right.png` | `5524feb59cdf19df5bd1cc9ce9894f72520320626986eb46533edb74dfd648d2` |
| `assets/roblox-upload/military-radar/preview-side.png` | `332c2456c94e7c6ad98bf1634f6ba93933e277ca9bb5e2a6a5e3a26b8e54398d` |
| `assets/roblox-upload/military-radar/preview-top.png` | `bdcceb20cee19bff4c5c1bd7ad341a16babbca436c4738f6799a0f048958512d` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-sam

Version `military-ground-kit-1`; 688 / 2500 triangles; size [15.2, 16.53, 25.0] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-sam/checklist.json` | `f84d80fd4c60faa13e5e4b0aef076c1b4f27c0978c109c4cb1e2bbf266f48afd` |
| `assets/roblox-upload/military-sam/contact-sheet.png` | `d736b8d5d30d06886a612806ce9294349078ab16a9276cb79bd68a76acc212a3` |
| `assets/roblox-upload/military-sam/military-sam-color.png` | `e6b3ff9100dfe52fcadb60ad253c45b0d9cf3ef293e3d2776f81348950b10ca8` |
| `assets/roblox-upload/military-sam/military-sam-metalness.png` | `221c680db798ffbf248c8321a0e059a8a8592bd9f0f7d180d16a41f96cc019c4` |
| `assets/roblox-upload/military-sam/military-sam-normal.png` | `d1a9db169359d16de2f074ae35db6500f6a65c2728bd4514b42842cf0c57ff9b` |
| `assets/roblox-upload/military-sam/military-sam-roughness.png` | `08aad0f2a0796194a1bb2a3a8ec2de0349cadf371ac460369b6ac39aa3ba7dfb` |
| `assets/roblox-upload/military-sam/military-sam.fbx` | `f10ce9a6716456be8db2b8e634246e78f35aa2ec96ddaf6417cbd8da743560bf` |
| `assets/roblox-upload/military-sam/preview-3q-front-left.png` | `544cd1be802c01b8697373feb58a32c14a8923b9764cc17f2a992ecb518111d7` |
| `assets/roblox-upload/military-sam/preview-3q-rear-left.png` | `ae387d15f7e0ece9a21d440177853b2dcc5f4d9ccc3174bbe76f754032b3a14a` |
| `assets/roblox-upload/military-sam/preview-3q-rear-right.png` | `fd8e874a037685ce385a5d196e6f3027cf9a1f5ba35a0bccd491386f1143e488` |
| `assets/roblox-upload/military-sam/preview-3q.png` | `7f18225717bed6ca3e36632a692abb175b2fb90d3371754f61eb3efabae3a275` |
| `assets/roblox-upload/military-sam/preview-back.png` | `bc44971bc7fcc217127f147809b82b023945575c7119dade579b8042fb081719` |
| `assets/roblox-upload/military-sam/preview-bottom.png` | `a16b71855f1228f64209179b52f9f2545437dfe7c4b620458947cf52f80eb074` |
| `assets/roblox-upload/military-sam/preview-front.png` | `4180671b9a3d8785d3cd0ea688bde6b87bea1794c9297443fd2fa036e8ec32f0` |
| `assets/roblox-upload/military-sam/preview-side-right.png` | `4449dbe643126c8e1e54c489aa279c940c2ce9ef16cf5f29374a4396938b644d` |
| `assets/roblox-upload/military-sam/preview-side.png` | `0c113d061bf0b04f5173637faa7f4906de5e748e779e25d40ff29988be225611` |
| `assets/roblox-upload/military-sam/preview-top.png` | `ade29123a5319edae4c6894eb1ac9241755d3957c2ad889969e6caf78336868b` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-tank

Version `military-ground-kit-1-track2`; 1620 / 2500 triangles; size [17.52, 12.0, 33.5] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-tank/checklist.json` | `173b2c7b1702cf8f6a0cc21c70b1204dcc2ad31574802be690151e76a91df460` |
| `assets/roblox-upload/military-tank/contact-sheet.png` | `531a18106b20e8755a53c8f0bdd674b99c404b0602bcd081a0e49514bb163165` |
| `assets/roblox-upload/military-tank/military-tank-color.png` | `eb17b726085c5434f24d62a0cfdfca6a2d3e7f279248aa189743f634538f4786` |
| `assets/roblox-upload/military-tank/military-tank-metalness.png` | `c1c8564eba328c836e7426be3e63206c2703418e78a620b11b12f4a1d59085c3` |
| `assets/roblox-upload/military-tank/military-tank-normal.png` | `d08a02bd054b45e2d3bac99feaf0fa6c7cde2fdba9b7e689f9a010f9bff5a8ad` |
| `assets/roblox-upload/military-tank/military-tank-roughness.png` | `87865e1660d9af67bfbcd84adac63687da8bb8c6ca9d0e77d0c4ce027f0af017` |
| `assets/roblox-upload/military-tank/military-tank.fbx` | `a20614334fb1a5bd1afc0c4cfd0415560aee49d3c234e8d2464c165ed2b82afe` |
| `assets/roblox-upload/military-tank/preview-3q-front-left.png` | `8ad116c8119c8d6b5266550980ffa995b0459744c49b51d245d982f000b03e74` |
| `assets/roblox-upload/military-tank/preview-3q-rear-left.png` | `973400ec9df84d3243f348ebc8850fbb8918fc579eb4ebcae083f2d2cc3e567e` |
| `assets/roblox-upload/military-tank/preview-3q-rear-right.png` | `15870f9c12337bb8b72206bb077a50f8de77e0f3865cd6a1a351e348bfe5e7e0` |
| `assets/roblox-upload/military-tank/preview-3q.png` | `6172931136db6040a285a661b301cee4ba8a0eb7d5fd1cc6f40fbc563913b34d` |
| `assets/roblox-upload/military-tank/preview-back.png` | `1d2d69ff37e7e67b697bb86e342c48176052954350c5cbc51b3a04227edc1175` |
| `assets/roblox-upload/military-tank/preview-bottom.png` | `b899229b10cf87c6030cab47d0b8bf3253a5ea38231708e3895c00478e8951b7` |
| `assets/roblox-upload/military-tank/preview-front.png` | `1ba4bba7faf93a263aa0db13e4ad68fb588cf5c92ef5670a8ab6f26cb6ebd384` |
| `assets/roblox-upload/military-tank/preview-side-right.png` | `329740a0ae35431256aa2f9ccd979c47f778d13a5af2d8f185a7dd25edb292c1` |
| `assets/roblox-upload/military-tank/preview-side.png` | `5673b878e7d01c1a2f91586cea8b8368ebf2891792450bbbc381543642c5b8ea` |
| `assets/roblox-upload/military-tank/preview-top.png` | `5bf5f4b20ca4e592c90a77c06b6f01ed896073fa9fbfd284edff7918b0e5f982` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.

### military-truck

Version `military-ground-kit-1-rack2`; 728 / 2500 triangles; size [15.2, 12.25, 25.0] studs; pivot `bottom-center`; ID unset.

| File | SHA-256 |
|---|---|
| `assets/roblox-upload/military-truck/checklist.json` | `539681d5fe74d527559a5c09a5a0ced693c630e381caa66fa3cc641ad4bc0e92` |
| `assets/roblox-upload/military-truck/contact-sheet.png` | `1d7bfc71af23a717e6c4dd6771007ddbd08939b6205a9036dc5504fc6ab38683` |
| `assets/roblox-upload/military-truck/military-truck-color.png` | `b4e28ac571eb969088aeb1a8e2010b1154953d6934c96c152750ef6747781349` |
| `assets/roblox-upload/military-truck/military-truck-metalness.png` | `ee8478ffc394c1ca2a4b9e70d3dfb9579b43db1d0e4eb5f83f30cac0eaba855f` |
| `assets/roblox-upload/military-truck/military-truck-normal.png` | `49c6361e5e339e5a6a73f177718faf7cffb3cd604e5e14c455393ca8125a12f2` |
| `assets/roblox-upload/military-truck/military-truck-roughness.png` | `3bccbb4136eca0892cd978bbd8ee3cc2e175d3ea0eff057d4688693324fb06fb` |
| `assets/roblox-upload/military-truck/military-truck.fbx` | `0a951d1bd5d9a1525a279bb757235224cbb2634a24df42f7c50601dbd1745c15` |
| `assets/roblox-upload/military-truck/preview-3q-front-left.png` | `8ec3d2b5b52ca481fa3b1a8155a5750449f9b31614307276b19adde4245e3fdd` |
| `assets/roblox-upload/military-truck/preview-3q-rear-left.png` | `7c79153a4fee22053c85881797c93fed0db2bd63feba1382ca9b1799991b1186` |
| `assets/roblox-upload/military-truck/preview-3q-rear-right.png` | `d22442007aef4b276ae59a97d74d67a7ec1d16f27f0b5100918b477aae40db3f` |
| `assets/roblox-upload/military-truck/preview-3q.png` | `293d6eea4f88c3acf0304a6c7f1f0ce57f32f41704ca5e2c843d15c6bdbaefb2` |
| `assets/roblox-upload/military-truck/preview-back.png` | `86697579bb50b1757ae93394e236921bc2313e1b20d0da7652f0fb868d43e42f` |
| `assets/roblox-upload/military-truck/preview-bottom.png` | `f4688fce257e4b69ec41fe8cffad003d6842284c15531eb2beea8fe486ab114f` |
| `assets/roblox-upload/military-truck/preview-front.png` | `bd24abf96b4273375139a5598f8f25617518784e5323b325ceb0d1f9300e2608` |
| `assets/roblox-upload/military-truck/preview-side-right.png` | `523211a6b6a15f1c9ecbc00af452e634f4f5526a034a930b2293eb56c4e7bad6` |
| `assets/roblox-upload/military-truck/preview-side.png` | `55c200dac900f00a6b32699a4bd8144154633a3b6401bdb48362057ede8dffbc` |
| `assets/roblox-upload/military-truck/preview-top.png` | `3948a1fddea0c1f69099b1fccb2f57b5dcbd75e11db093e0aa83b29872b0cb4a` |

Preview list: `preview-front.png`, `preview-side.png`, `preview-top.png`, `preview-3q.png`, `preview-back.png`, `preview-side-right.png`, `preview-bottom.png`, `preview-3q-front-left.png`, `preview-3q-rear-right.png`, `preview-3q-rear-left.png`. Contact sheet: `contact-sheet.png`.

Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.
