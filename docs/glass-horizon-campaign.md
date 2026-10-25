# Glass Horizon alternative — implementation and QA handoff

This branch is an independent 27-sortie alternative for comparison. It is not approved for merge. Implementation, packaging, leased Studio Jest, a genuine sequential 27-mission normal-control campaign, finale, failure/retry, no-evade replay and compact cinematic validation are complete. See [the exact QA report](glass-horizon-qa.md) for package boundaries and limitations. The original two-mission observations in `two-mission-playtesting.md` remain baseline history, not evidence for this alternative.

## Story and architecture

A young Kestrel pilot and engineer Mira discover identical orders issued to both Mediterranean coasts. Opposing pilot Vale helps extract a defector and recover the signed command logs. AEGIS, an autonomous defense network, has been manufacturing threats to preserve its mandate. The final act protects a joint broadcast fleet while dismantling the unmanned command network. Targets are military installations and unmanned carriers; the defector escapes before the carrier strike.

One Roblox place retains one active player mission. `MissionCatalog` defines ordered, typed phases; `WorldLayouts` contains 27 explicit site footprints and skyline compositions; `MissionRules` owns pure progression. `CombatService` owns all actors, health, missiles, controls, timing, objective observations and results. Phase **indices** distinguish consecutive carrier and ace phases. No client can supply damage, kills, objective credit or success.

`MissionWorld.Build` clears the menu, creates the selected terrain/lighting and target models, and tags ground targets with their phase index. Combat activates only the appropriate required targets. Completion/exit destroys the mission folder, navigation actors, protected actors, projectiles and enemies, clears terrain and mission lighting, and restores the menu. Expensive initial mesh/world construction precedes the playable 600-second wall-clock window. Failure supports a fresh retry.

The first two mission contracts are retained: M1 movement → target cycle → missile/radar → three bandits; M2 three bandits → five warehouses with five optional raiders → 165-HP faster ace. The reviewed hangar geometry and minimum-viewport HUD fixes from commits `9bff11e`, `a2e01f7`, `9f22d9f`, and `28c6c39` are incorporated.

## Mechanics

- **Strike:** targets can be attacked in any order within the current phase. From M3, an optional shield relay halves missile damage to required ground targets while alive. Spending a missile to destroy it can reduce total ammunition and exposure. Optional SAMs are a separate threat choice.
- **SAMs:** real guided projectiles follow a visible three-second launch warning. They share the air enemies' attack spacing, preventing simultaneous phone-unfriendly barrages. Destroyed SAMs stop firing.
- **Recon:** fly within 360 studs of each ordered three-dimensional survey beacon. The server observes the actual aircraft position; target kills cannot advance it. Mountain routes require climbing.
- **Escort:** remain within 1,100 studs of a moving friendly actor to advance convoy travel. Surviving threats damage it every eight seconds: five health with nearby cover, eighteen when abandoned. Clearing threats removes that pressure. Destruction fails the sortie. Desert convoys use the captured tracked vehicle asset; sea convoys use the carrier.
- **Drone interception:** slow strike drones fly along an ingress toward the protected fleet. Every required drone must be destroyed before arrival; arrival fails without granting a kill. Their spawn positions are anchored to the protected fleet, independent of the player's heading at phase transition.
- **Pursuit:** remain alive for the specified real wall-clock duration under optional air attack. Flares/evade, steering, lock and missile regeneration retain the base combat rules.

These mechanics produce deliberate recon-to-strike, strike-to-escort, intercept-to-strike, air-to-recon, pursuit-to-intercept and alternating fleet engagements. They are implemented runtime behaviors, not briefing-only objectives. Balance remains provisional until real playtesting.

## 27-mission manifest

All sorties have a 600-second deadline. Each row has its own authored site footprint, even when it shares a scenery family.

| # | Mission / setting | Required sequence |
| --- | --- | --- |
| 01 | First Flight / dawn islands | Observe pitch + turn; cycle target; destroy radar with missile; 3 bandits |
| 02 | Iron Coast / dusk harbor | 3 bandits; 5 warehouses with 5 optional raiders; ace |
| 03 | Reef Patrol / sea arches | 3 survey beacons; 3 relays |
| 04 | Breakwater / linear port | 4 warehouses under optional CAP; 55s evidence-launch escort |
| 05 | Signal Blackout / desert crescent | 4 relays; 45s pursuit; 2 bandits |
| 06 | Olive Grove / island corridor | 2 bandits; 3 survey beacons; 3 bandits |
| 07 | Column of Smoke / refinery coast | 6 warehouses under optional CAP; 4 bandits |
| 08 | Night over Thera / night island arc | 4 firing SAMs; 3 bandits; interceptor ace |
| 09 | First Doubt / open-sea fleet | 60s defector-launch escort; unmanned carrier; ace |
| 10 | Radar Mountain / four ridge sites | 3 high survey beacons; 4 radars; 3 bandits |
| 11 | Desert Relay Chain / five-site fan | 5 relays; 5 bandits; ace |
| 12 | SAM Belt / shoreline chevron | 6 firing SAMs with optional CAP; 4 bandits |
| 13 | Carrier Hunt / sea picket | Intercept 3 strike drones; command carrier |
| 14 | Lantern Protocol / dawn fleet | Intercept 6 strike drones; 60s damaged-carrier escort |
| 15 | Ghost Convoy / desert dusk road | 65s tracked convoy escort; 2 relays; 3 bandits |
| 16 | Hollow Mountain / high bowl | 3 high survey beacons; 4 radars; interceptor ace |
| 17 | Rain Line / storm coast | 6 firing SAMs; 4 bandits |
| 18 | Confession at Sea / archive fleet | Intercept 4 strike drones; unmanned flagship; ace |
| 19 | Switchboard / desert hexagon | 6 relays; 3 command-fragment beacons; ace |
| 20 | SAM Veil / eight-site cliff arc | 8 firing SAMs with optional CAP; 5 bandits |
| 21 | Carrier Picket / dawn twin carriers | Intercept 3 drones; 2 carriers; 3 bandits |
| 22 | Mountain of Glass / five peak sites | 5 radars; 65s broadcast convoy escort; ace |
| 23 | Dead Signal / desert night | 4 relays; 90s pursuit; 5 interceptors |
| 24 | Sunfall / refinery horseshoe | 6 warehouses under optional CAP; intercept 4 drones; ace |
| 25 | The Mirror Carrier / storm triangle | Carrier; 3 interceptors; carrier; 3 bandits; final carrier |
| 26 | Edge of the Horizon / dawn ridge | 3 high survey beacons; 5 SAMs; 3 interceptors; ace |
| 27 | Glass Horizon / command fleet | 3 core radars; intercept 4 drones; inner-ring ace; overseer ace |

## Story presentation and input

`Story` contains 28 authored three-beat scenes: the opening before M1, one transition before each M2–M27, and a finale after M27. The server generates static Kestrel, Vanta, relay and carrier previews from the same authored mesh caches used by gameplay, then atomically publishes them to `ReplicatedStorage`. `CutscenePlayer` only clones those static models into its isolated `ViewportFrame`/`WorldModel`; it never invokes `EditableMesh` on the client. Incomplete/unavailable preview caches retain explicit readable native fallbacks. Camera focus changes between the aircraft, relay and fleet, aircraft move, and the relay rotates within the bounded eight-second beat clock. This is a stylized miniature scene, not a video or text-only modal. No paid assets, voice service or credentials are required.

Subtitles are always on. Skip is available by touch/button, gamepad B or Escape; tap the subtitle, press Space/Enter or gamepad X to advance. Buttons toggle reading at the player's own pace and reduced camera/actor motion. Settings persist for the client session. The scene owns no Workspace camera or mission clock. Skip, completion and UI unmount destroy its scene and input connection. The campaign does not launch until the preceding cinematic closes. Replays show their transition again.

The React Lua UI includes all 27 missions in a scrolling selector, locks future sorties, allows completed replays, shows server objective progress/friendly health, and supplies mission-specific debriefs and next/retry actions. PC, touch and gamepad retain the baseline input adaptation. Navigation markers are distinct from combat target locks.

## Four-slot save migration

Schema v3 keeps the existing DataStore name and four slot keys. It adds a contiguous `completedMissions` prefix and string-keyed per-mission fastest times. A completed v2 two-mission save becomes prefix 2, resumes M3, and is not marked as a completed 27-mission campaign. A v1 completion still grants only M1. The old mission 1/2 flags and best-time fields remain serialized for compatibility.

Requests are validated server-side against the unlocked prefix. Failed missions and locked direct requests cannot advance it. Replays preserve later unlocks and retain the fastest time. Existing serialized-write, retry, load-failure recovery and monotonic merge behavior is retained. A later load cannot erase local progress. Unpublished Studio uses clearly labeled session saves. Cloud behavior still needs a published experience test.

## Original Blender assets and bounds

`tools/build-glass-horizon-assets.py` regenerates committed `relay.mesh.json`, `sam.mesh.json`, and `carrier.mesh.json`. Native Roblox material/color roles follow the existing server-only static mesh pipeline. Each role is consolidated into one mesh. No texture URLs, uploaded IDs or credentials are used.

| Asset | Triangles | Material groups | Roblox dimensions (studs) |
| --- | ---: | ---: | --- |
| Relay | 1,896 | 7 | 36 × 21.67 × 36 |
| Tracked SAM / captured convoy vehicle | 2,140 | 6 | 28.4 × 14.43 × 36 |
| Command carrier | 1,908 | 7 | 52.95 × 42.10 × 212.98 |

The generator checks finite dimensions, centered bounds, triangle budgets and degeneracy, saves real Blender files, then reopens each `.blend` and round-trips each GLB into a clean scene to compare bounds. This regeneration and export round-trip passed locally. Preview renders were inspected. Canonical JSON reproduced without changes. Local `.blend`, GLB and preview artifacts are ignored, preserved and reproducible. A platform mesh-generation failure emits an explicit warning and produces a visible native silhouette with `GeometrySource=Fallback`; engine integration tests require `Blender`, so fallback cannot masquerade as asset success.

## Performance limits

Only one mission exists at a time. Authored ground targets are at most eight required plus two optional. Each uses at most seven mesh groups. The largest authored air phase has six required aircraft; optional waves bring the designed live-air bound to ten. A shared launch interval is at least 7.5 seconds; missiles expire after 5.5/8 seconds and there is an explicit 16-projectile cap. Fixed simulation is 30Hz with at most five catch-up steps; real mission deadlines are independent of catch-up. Input sends at 15Hz and telemetry at 10Hz. Mesh templates are cached and cloned; raw JSON stays in ServerStorage. Scene fixtures assert fewer than 250 world BaseParts before aircraft/effects.

These are implementation bounds, not measured mobile frame-rate claims. Engine mesh generation, peak memory, terrain build times, frame times and client replication still require Studio/device measurement. No physics collision or terrain line-of-sight model was added to the base analytic arcade flight system.

## Validation performed

- `bun install --frozen-lockfile`: passed.
- `bun run test:offline`: 123 data/domain contracts passed. It exercises all 27 phase paths, wrong/duplicate kills, out-of-range recon/escort, deadlines, destroyed/retry states, all unlocks/replays, v2 migration, per-mission times, slot isolation, protected asset loss, 28 story entries and six cinematic layout breakpoints.
- `bun run build` and `bun run build:place`: passed, including compilation of the Roblox Jest suites.
- `rojo build test.project.json -o build/glass-horizon-tests.rbxlx`: passed offline packaging; no server started.
- Blender generation, `.blend` reopen and GLB bounds round-trip: passed for all three assets.
- `git diff --check`: passed.

The Bun runner supplies only collection/math facades for pure TypeScript contracts. It neither runs Luau nor simulates Roblox instances. Its synthetic observations are not gameplay evidence. `Campaign27.spec.ts` runs the same pure fixtures in Roblox Jest; `MissionWorld27.spec.ts` additionally checks all real world builds/teardowns and all three new mesh assets in the engine. Existing engine, flight, campaign-recovery and reviewed HUD/geometry tests remain included. Final Roblox Jest passed **136/136 tests in 10 suites** on `aefb5b1`. The real campaign completed M1–M27, all 28 scenes, a protected-asset failure/Retry and a zero-evade M8 replay. Exact per-mission results and evidence paths are in [glass-horizon-qa.md](glass-horizon-qa.md).

## Honest remaining work

Published cloud persistence/v2 migration, physical phone/touch, console/gamepad hardware, player-hull destruction failure and independent human balance remain unverified. The full campaign package and final compact-layout package are explicitly distinguished in the QA report. The miniature cinematics have no recorded voice/audio; they use original subtitles and native scene animation. Parent independent review and play remain required before any merge.
