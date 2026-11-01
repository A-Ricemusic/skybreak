# SKYBREAK architecture map

A navigation guide for agents and humans working in this repository. Read [AGENTS.md](../../AGENTS.md) first: it holds the rules (human docs, asset upload gate, Studio lease, no React agent testing). This file explains where things live and how they connect. It describes the code as of the 18-mission campaign on `main`; when the code and this file disagree, the code wins and this file needs a fix in the same PR.

## Stack

roblox-ts 3.0.0 (TypeScript 5.5) compiled to Luau, Rojo for the place tree, Bun for tooling, React Lua (`@rbxts/react`) for the UI, `@rbxts/jest` for Studio tests, Python for asset and upload tools. `default.project.json` is the production place; `test.project.json` adds `out/tests` and sets `Workspace.SkybreakTestMode = true`, which stops `index.server.ts` and `index.client.tsx` from initialising.

## Repository layout

| Path | What lives there |
|---|---|
| `src/server/` | Server authority: `index.server.ts` creates the remotes and starts services; `CampaignService.ts` (save slots, launch requests, DataStore); `CombatService.ts` (the sortie loop); `CombatSession.ts` (the session record); `CombatSessionFactory.ts` (the only way to build a session); `PhaseDirector.ts` (spawns per phase); `MissionWorld.ts` plus `M01World.ts` to `M18World.ts` (world construction); `GroundTargetFactory.ts` (typed targets and their uploaded-kit decoration); `WorldInstanceBudget.ts` (world instance caps); `*Runtime.ts` adapters for opt-in engine features. |
| `src/shared/` | Pure, Roblox-free rules shared by server, client and tests: `MissionCatalog.ts` and `missions/` (blueprints), `BlueprintRunner.ts` (phase progression), `FlightMath.ts` (the one flight integrator), `*Rules.ts` (feature rules), `M01WorldPlan.ts` to `M18WorldPlan.ts` and `M*Limits.ts` (world geometry and airspace), HUD layout (`UILayout.ts`), `Types.ts` (remote payloads), `RobloxAssetIds.ts` (approved uploaded asset ids), `UploadedAssetSpecs.ts` (generated sizes of uploaded models) and `MilitaryGroundKit.ts` (which ground target types get kit models). Anything here must compile and run in the standalone Luau CLI. |
| `src/client/` | `index.client.tsx` wires remotes, `FlightController.ts` (input, prediction, HUD data), `GameUI.tsx` and `screens/` (React Lua menus and HUD), `CombatEffects.ts`, `Weather.ts`, audio and voice players. The client never decides gameplay outcomes. |
| `src/tests/` | `@rbxts/jest` specs. Pure specs also run offline through `tools/test-relay-offline.ts`; Studio-only specs (anything touching Instances, services or `CombatService`) run only through `bun run test:roblox`. `legacy/` holds frozen captures of the retired 27-mission campaign that several specs still use as fixtures. |
| `tools/` | Bun validation scripts (`validate-offline.ts` is the gate), the Studio test runner, Python asset builders, the Open Cloud upload and publish gate (`roblox_upload.py`, `upload-models.py`, `check-place-assets.py`, `publish-place.sh`, unit tests in `tests/`), `fixtures/` (the frozen catalog snapshot), `verification/` (hand playthrough scripts), `spikes/` (archived performance experiments). |
| `assets/` | Audio cue definitions, voice casting and generated line lists. `roblox-upload/<asset>/` holds each Blender export (FBX, PBR textures, previews, `checklist.json`, and `export-manifest.json` with SHA-256 hashes); `roblox-upload/manifest.json` is the uploaded-asset catalog. Generated media stays out of git. |
| `docs/human/` | Owner-facing status: exactly `README.md`, `shipped.md`, `next.md`, `blockers.md`, `decisions.md` and `levels.html`. See AGENTS.md for the rules. |
| `docs/specs/` | Reference-footage specs: `missions/mNN.md`, `worlds/mNN.md`, `engine/` (feature plans), `story/` (chapter map, voice script). |
| `docs/qa/` | Review evidence: `asset-reviews/decisions/*.json` (authoritative independent safety decisions), `asset-reviews/approvals/*.json` (approved upload hash sets), the review reports they cite, `uploaded-assets.md` (uploaded id ledger), `place-publish-asset-gate.md`, and dated hotfix and playtest notes. |
| `docs/*.md` | Topic references: flight model, special weapons, asset pipelines, controller QA. `docs/broken-relay.md` is the retired campaign's record and still feeds `tools/relay-tables.ts --check`. |
| `.github/workflows/` | `validate.yml` (PRs, no secrets), `publish-roblox.yml` (main pushes: validate then publish), two manual Open Cloud maintenance workflows. See `SECURITY.md`. |

## Runtime data flow

```
client                      ReplicatedStorage.Remotes                    server
GameUI ──CampaignRequest────► RemoteFunction ──────────────────────────► CampaignService.handleRequest
FlightController ──FlightInput─► UnreliableRemoteEvent (60 Hz cap) ────► CombatService: token bucket, clamp, stamp
FlightController ──CombatAction─► RemoteEvent (per-kind rate gate) ────► CombatService: StepGuard.Run(action)
                 ◄─MissionState── RemoteEvent ◄──────────────────────── Loading / Briefing / Finished packets
FlightController ◄─FlightState── UnreliableRemoteEvent (20 Hz) ◄──────── sendFlightState (prediction echo)
FlightController ◄─Telemetry──── UnreliableRemoteEvent (10 Hz) ◄──────── sendTelemetry (TelemetryCodec) + HudState
CombatEffects    ◄─CombatEffect─ RemoteEvent ◄───────────────────────── explosions, hits (cosmetic only)
```

1. **Launch.** `GameUI` invokes `CampaignRequest("StartMission", {slot, missionId, special, difficulty, launchId})`. `CampaignService` rate-limits per player (`CampaignRequestBudget`), validates every field, checks unlock state through `CampaignProgress`, then calls `CombatService.StartMission`.
2. **World.** `StartMission` waits for the shared world gate (`WorldLifecycle`), clears the menu world, and builds the mission world: `MissionWorld.Build(missionId, folder)` dispatches on `MissionCatalog.WorldKey` to `MNNWorld.Build`, which reads the pure `MNNWorldPlan` and writes terrain and parts. Ground targets come from the blueprint's typed target list (`CampaignEncounters`) via `GroundTargetFactory`.
3. **Session.** `CombatSessionFactory.createCombatSession` builds the `CombatSession` record (flight state, armament, scoring, guards). `PhaseDirector.Apply` spawns the opening wave. The session sits in a `LoadingGate` until the client reports `Ready`.
4. **Loop.** `RunService.Heartbeat` drives a fixed 1/30 s step per session (`stepSession`: flight integration through `FlightMath.Step`, enemy AI, missiles, guns, feature runtimes, `BlueprintRunner.Tick`). Every step and every action runs under `StepGuard`, so an error ends that sortie with `internal_error` instead of breaking the server. Pivots are flushed once per Heartbeat.
5. **Outcome.** `BlueprintRunner` decides won/failed; `finish` builds `MissionStats` and `SettlementHooks`, and `CampaignService.OnFinished` records the result through `CampaignRepository` (retrying DataStore `UpdateAsync`). Kills, score, time and completion are computed on the server only; the client receives them.

Server authority in one sentence: the client sends stick/throttle, a handful of action names, a request serial, a target `Model` and a camera frustum; everything else (damage, kills, scoring, unlocks, saves) is decided from server state after type and range checks.

## How a mission is defined

A mission is a `MissionBlueprint` (type in `src/shared/MissionCatalog.ts`) exported as `mission` from `src/shared/missions/mNN.ts` and listed in `src/shared/missions/index.ts`. `missions/practice.ts` is mission 0.

- **Phases.** `blueprint.phases` is an ordered list of `MissionPhaseBlueprint`s. `missions/Phases.ts` has helpers (`fly`, `air`, `ground`, ...). Opt-in features are extra fields on a phase (`rearm`, `scoreThreshold`, `canyonEscape`, `groundProgress`, `protection`, `spatialJamming`, `cruiseIntercept`, `leaderWithdrawal`, `batchD13` for the finale, ...). `BlueprintRunner` advances phases; `PhaseDirector` spawns for them; the matching `*Runtime` module steps the feature each tick.
- **Encounters.** Typed ground targets, fighter arrivals (with triggers), standalone aces and bombers live in `CampaignEncounters.ts` and `BomberEncounter.ts`. Every credited id is unique per mission (`validateEncounterIdentities`).
- **World.** `blueprint.worldKey` names the world. Geometry is authored in the pure `MNNWorldPlan.ts` (so tests can audit it offline) and built by the server `MNNWorld.ts`. Airspace, start pose and spawn limits come from `MNNLimits.ts`.
- **Policy.** `MissionPolicy.ts` defines airspace, start, scoring (`basis: "points" | "rating"`, rank cuts) and countdown; `LEGACY_*` defaults apply when a blueprint omits them.
- **Validation.** `MissionCatalog` validates every blueprint at module load (`validateBlueprintContracts` + `validateBlueprintAuthoring`) and exposes `MissionCatalog.ValidatePolicy` for specs. A bad authoring edit fails the server on boot and the offline gate in CI.

### Feature modules

Shared `*Rules.ts` files are pure and testable offline; server `*Runtime.ts` files adapt them to the session and Instances. The former build-batch names are kept in each file's header for grepping old PRs and specs.

| Feature | Shared rules | Server runtime | Phase fields |
|---|---|---|---|
| Landing, return line, terrain clearance | `LandingRules` | `LandingRuntime` | `landing`, `returnLine`, `update` |
| Score threshold, radar jamming, rearm | `RearmRules` | `RearmRuntime` | `scoreThreshold`, `jamming`, `rearm` |
| Sortie gun and finite stocks | `SortieArmament` | in `RearmRuntime` / `CombatService` | `armament` (blueprint) |
| Naval hulls, surface routes, SAMs | `SurfaceTargetRules` | `SurfaceTargetRuntime` | typed targets with `route`; SAM-armed targets |
| Canyon artillery, area attacks | `ArtilleryRules` | `ArtilleryRuntime` | `canyonEscape`, `armament.areaAttack` |
| Intercept hold (bombers vs a site) | `InterceptHoldRules` | `PhaseDirector`, `BlueprintRunner` | `interceptHold`, `bombers` |
| Ground sectors, carrier rearm, squads | `GroundSectorRules` | `GroundSectorRuntime` | `groundProgress` |
| Large contact inventories, parked handoff | `ContactInventoryRules` | `ContactInventoryRuntime` | `cheapContacts`, `repeatedArtillery`, `parkedSourceId` |
| Protected aircraft | `ProtectedAircraftRules` | `ProtectedAircraftRuntime` | `protection` |
| Ring sweep, elite retreat | `RingSweepRules` | `RingSweepRuntime` | `ringSweep`, `eliteFormation` |
| Airship jammers, jamming corridors | `JammerCorridorRules` | `JammerCorridorRuntime` | `spatialJamming` |
| Cruise-missile intercept | `CruiseMissileRules` | `CruiseMissileRuntime` | `cruiseIntercept` |
| Field repair, zone reserves, cheap armour | `RepairReserveRules` | `RepairReserveRuntime` | `rearm.health`, `reinforceAfterSector` |
| Leader withdrawal, bridge closure | `LeaderWithdrawalRules` | `LeaderWithdrawalRuntime` | `leaderWithdrawal`, `bridgeClosures` |
| Finale vent run and duel | `FinaleDuelRules`, `M18FinaleRules` | `FinaleDuelRuntime`, `M18AscendingRuntime` | `batchD13` |

## Changing or adding a mission: checklist

1. Edit `src/shared/missions/mNN.ts` (and `MNNWorldPlan.ts` / `MNNLimits.ts` / `MNNWorld.ts` for world changes). Adding a 19th mission also means `missions/index.ts`, the `MISSION_COUNT === 18` assertion in `MissionCatalog.ts`, the dispatch in `MissionWorld.ts`, and `tools/test-mission-catalog.ts`'s expected count.
2. `bun run build` then `bun run validate:offline`. If the catalog text or structure changed on purpose, regenerate the frozen fixtures and generated docs in the same PR:
   - `bun tools/test-mission-catalog.ts --update` (catalog snapshot, `tools/fixtures/mission-catalog.campaign18.json`)
   - `bun tools/voice-lines.ts` then `bun tools/story-voice-script.ts` (voice line ids and the story script)
   - `bun tools/world-report.ts` (world counts in `docs/world-realism.md`)
   - `bun tools/relay-tables.ts` only if the legacy tables moved
3. Add or update the mission's spec in `src/tests/MNNMission.spec.ts` and register pure specs once in `MODULES` in `tools/test-relay-offline.ts`.
4. Studio-only runtime specs are run by the orchestrator (`bun run test:roblox`); do not launch Studio from a child agent.
5. Update `docs/human/*` and `docs/human/levels.html` when the mission's status, plan or blockers change.

## Saves and progression

`CampaignRepository.ts` owns the profile format (`GameConfig.Campaign.SaveVersion`, four slots, per-mission best time and score ledger) and migrates v1/v2 records on load. `CampaignProgress.ts` answers unlock questions. `CampaignService` uses the DataStore named in `GameConfig.Campaign.DataStoreName` when the place is published and a session-only store in an unpublished Studio place. Do not change the stored shape without a migration and a spec.

## Uploaded assets and the publish gate

Blender-origin models reach Roblox only through the gate in AGENTS.md. The code path is:

1. **Export.** `tools/assets/build.py` writes `assets/roblox-upload/<asset>/` with the FBX, embedded PBR textures, previews and a moderation `checklist.json`. The review PR adds an `export-manifest.json` beside them that records the creator, export version and a SHA-256 per file.
2. **Independent review.** A reviewer who is not the creator inspects the exact export and records a decision in `docs/qa/asset-reviews/decisions/<asset>.json` (reviewer, creator, review date, policy links, integer score, verdict, source review path). `approvals/<asset>.json` pins the approved upload set. Every decision file under `decisions/` is authoritative; any REJECT or score below 10 that matches the bytes or the export version blocks the upload. See `docs/qa/asset-reviews/upload-approval-format.md`.
3. **Upload.** `tools/upload-models.py` uploads a Model only when the FBX bytes equal the committed `origin/main` export and `tools/roblox_upload.py` finds exactly one matching committed 10/10 APPROVE decision. The journal and HALT files live in the OS account home (`~/.skybreak-roblox-uploads`); a moderation rejection writes the model HALT. Audio and voice uploads are refused in code regardless of HALT files (D-668).
4. **Activate.** After moderation approves, the id goes into `src/shared/RobloxAssetIds.ts` and the catalog entry in `assets/roblox-upload/manifest.json`; `UploadedAssetSpecs.ts` (generated) carries the authored sizes, `WorldAssets.PlaceUploaded` places the model, and `MilitaryGroundKit.ts` maps ground target types to kit models for `GroundTargetFactory.decorateGroundTarget`.
5. **Publish.** `tools/publish-place.sh` runs `tools/check-place-assets.py --publish` on a pinned copy of the built place before every POST. It inventories every embedded blob (StringValue mesh JSON, BinaryString and SharedString bytes) and every `rbxassetid://` reference, requires a committed approval for each blob and a catalog entry for each id, and consults the model HALT only when the embedded bytes differ from the previous `main` tip. `validate:offline` runs the `--inventory` mode, which reports but never authorizes.

**World instance budgets.** `src/server/WorldInstanceBudget.ts` counts a world's descendants in two buckets: base instances (terrain parts, scenery, target proxies, aim roots) against the mission's `descendants` limit, and kit decorations tagged `GroundKitBudgeted`, each bounded at placement to `GROUND_KIT_INSTANCE_ALLOWANCE` instances. `M01World` to `M03World` and `CompositionWorld` assert the budget after building and publish `WorldBaseInstances`, `WorldKitInstances` and `WorldKitModels` attributes for Studio inspection. A kit model that would exceed its allowance is discarded and the procedural visual stays.

## Tests and validation

| Command | What it runs | Studio? |
|---|---|---|
| `bun run build` | `tools/package-aircraft.ts` then `rbxtsc` with `test.project.json` | no |
| `bun run validate:offline` | The PR and publish gate: build the place, inventory its embedded assets (`check-place-assets.py --inventory`, structural only), compile every emitted module in the Luau CLI and check the require graph (`check-luau-modules.ts`), run the offline contract suite (`test-relay-offline.ts`), the catalog snapshot, voice/story/world generated-doc checks, Python unit tests and the audio/voice/radio simulations. Needs `LUAU_BIN` or `build/offline-luau/luau`. | no |
| `bun run test:offline` | Only the offline contract suite | no |
| `bun run test:roblox` | Every `@rbxts/jest` spec inside Roblox Studio. One Studio lease per machine; the orchestrator owns it. | yes |

Constraints to remember:

- **Luau's 200-local limit per function.** `check-luau-modules.ts` compiles every emitted module and fails on it. Module-level imports count as locals, which is why `CombatService.ts` imports feature runtimes as namespaces. Prefer extracting a module over adding imports to a large file.
- **Offline modules must be pure.** A module in `MODULES` may not touch Roblox services or globals (only `GameConfig` and `UploadedAssetSpecs` get shims). Type-only imports are erased; runtime dependencies must be listed too.
- **Frozen fixtures are contracts.** The catalog snapshot and the voice line ids fail validation when mission data changes. Regenerate them deliberately and say so in the PR.
- **Test fixtures use the production factory.** Build sessions with `CombatSessionFactory.createCombatSession` rather than hand-written literals so new session fields cannot silently diverge.

## Conventions

- `src/shared/*Rules.ts`: pure rules with validators. `src/server/*Runtime.ts`: the server adapter for the same feature. `MNN*` prefixes tie files to a mission number.
- Server code never trusts a remote payload: check `typeIs`, finiteness and range before use; rate-limit before validating so bad packets also spend budget.
- One-line header comment per module stating what it owns. Decision ids (`D-123`) in comments refer to `docs/human/decisions.md`.
- Behaviour changes ship with a regression spec and an explicit note in the PR; refactors state that gameplay, save format and fixtures are unchanged.

## Security model

Secrets exist only as GitHub Actions secrets (`SECURITY.md`); PR validation runs without them, external actions are pinned to commit SHAs, tokens are `contents: read`, and checkouts use `persist-credentials: false`. Audio and voice uploads are permanently disabled in code (D-668). Model uploads and place publishing pass only for byte-matched exports with committed independent approvals, as described in the uploaded-assets section above.
