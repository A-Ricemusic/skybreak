# Humanoid death investigation and fix — Studio evidence (2026-10-29)

Branch `fix/humanoid-death`. Studio checks only; **no Roblox Player test is claimed.**

## Owner report

While flying, the avatar kept dying even though the jet was not shot down; Roblox's default
top-right health bar read zero and the screen flashed red.

## Code reading (before Studio)

- No `SpawnLocation` exists, so the avatar spawns at the origin on the lobby airbase built
  by `WorldBuilder.Build()` (runway top at Y≈24).
- Every mission world build runs `Workspace.FindFirstChild("World")?.Destroy()` and
  `Workspace.Terrain.Clear()` (`src/server/MissionWorld.ts`), removing the floor under the avatar.
- `CombatService.StartMission` anchors the avatar's `HumanoidRootPart` only **after** the
  world build (which yields for seconds of terrain work) and only for the character that
  exists at that moment. A respawned character is never anchored.
- `Workspace.FallenPartsDestroyHeight` is -500 (`default.project.json`). A part destroyed
  below it kills the Humanoid; Roblox respawns the character after `Players.RespawnTime`
  (5 s) at the origin again, which is now open air or mission sea.
- Nothing in `src/` uses the character: the menu camera and flight camera are
  `Scriptable`, the default PlayerModule controls are disabled, flight is server-owned,
  `StreamingEnabled` is false, and `CombatEffects` only excludes the character from raycasts.
- No code reacts to `Humanoid.Died`; mission ending is unaffected by avatar death.

## Studio reproduction on unmodified origin/main (`088fbfc`)

Place built from a detached worktree of `origin/main`; Studio play-solo; the server logger in
`repro-logger.server.luau` armed from the MCP; practice then mission 1 started with
`launch.client.luau`. Full log: `repro-main-088fbfc.log`.

| Time | What happened | Evidence |
|---|---|---|
| 0 s | Avatar spawned at the origin on the lobby runway, Y≈27, unanchored. `CharacterAutoLoads=true`, `FallenPartsDestroyHeight=-500`. | `POS 0 27 0 anchored false World true` |
| 8.2 s | Practice world build destroyed the lobby `World` folder; the avatar began falling. | `POS 0 23 0 … World false` |
| 13.3 s | `CombatService.StartMission` anchored the root, but only after the build, by which time it was at Y=-286 in the void. | `POS 3 -286 -1 anchored true` |
| 86.4 s | `ReturnToMenu` → `cleanupSession` unanchored the root; it fell below -500 and was destroyed. **Death 1.** | `ROOT REMOVED last Y -506`, `HEALTH 0 state Dead`, `DIED` |
| 93.4 s | Roblox respawned the avatar at the origin after `RespawnTime` (5 s). | `CHARACTER ADDED … World folder present: true` |
| 100.9 s | Mission 1 build destroyed the lobby again; this respawned character was never anchored. **Death 2.** | `ROOT REMOVED last Y -506`, `DIED` |
| 106.3 s | Respawned into the mission world (origin). | `CHARACTER ADDED … World folder present: false` |
| 160.6 s | Mission 1 ended; the session folder was destroyed and terrain cleared under the avatar. **Death 3.** | `ROOT REMOVED last Y -508`, `DIED` |

Each death is what the owner sees: Roblox's Health core GUI shows the bar at zero (then the
slow regeneration 1, 2, 3 … in the `HEALTH` lines while `Dead`) and the red damage overlay
flashes. On a live Player server the mission 1 / mission 2 builds take 10–16 s, longer than
the ~3 s fall to -500, so the avatar also dies during every loading screen, respawns 5 s later
into the same fall, and repeats until the world has something under the origin. The same
loop repeats at every mission end. Nothing in the game logic reacts to the deaths, so the
mission itself continued; only the Roblox default UI was affected.

## Studio verification of the fix (branch `fix/humanoid-death`, commit `adec1f3`)

Place `build/skybreak.rbxlx` from this branch; Studio play-solo; the server watchdog logs any
`CharacterAdded` or `Humanoid` appearing in `Workspace` and every change of
world/session/character state; `verify.server.luau` and `verify.client.luau` checked at the
menu, in flight and after teardown.

| Check | Result |
|---|---|
| Server baseline at the menu | `CharacterAutoLoads=false`, no `Player.Character`, no `Humanoid` in `Workspace` (`VERIFY SERVER OK`). |
| Client baseline at the menu | `GetCoreGuiEnabled(Health)=false`, `Backpack=false`, `LocalPlayer.Character=nil`, camera `Scriptable`, `SkybreakUI` and `SkybreakBackdrop` mounted. Menu renders normally (`01-menu-fixed.jpg`). |
| Practice flight | Built at 52.6 s, ran until 956.6 s of session time (about 15 min including a Studio stall), ended on its own and restored the lobby. Zero character/humanoid events. HUD, radar, instruments and the game's own hull bar all normal; no Roblox health bar or red flash (`02-practice-flight-fixed.jpg`). |
| Mission 1 | Five launches (three short ones crashed into water/terrain from my keyboard piloting, results screen normal: `03-m01-results-fixed.jpg`; the fifth flew 4 min 04 s at up to 3,600 studs with turns until "bombers escaped"). Each launch rebuilt the world and tore it down. Zero character/humanoid events across all five. `04-m01-flight-fixed.jpg`. |
| Mission 2 | Started through the live `CombatService` from an in-memory QA Script (mission 2 is locked on a fresh slot; the script was not saved). Build 17.1 s; flew about 3 min 50 s with climbs and turns, took fighter damage (the game's own bar), then `ReturnToMenu` tore the world down and restored the lobby. Zero character/humanoid events. `05-m02-flight-fixed.jpg`, `06-m02-late-flight-fixed.jpg`. |
| After teardown | Server: `character=nil humanoids=0 autoLoads=false World=true combat=0`. Client: Health and Backpack core GUIs still disabled, `Character=nil`, camera `Scriptable`. |
| Flight input | `UserInputService.InputBegan` received the QA key presses; W/S pitch, A/D turn and LeftShift throttle all moved the server jet, so controls do not depend on the avatar. |

Watchdog event log for the whole fixed-build session (every line; no `CHARACTER ADDED` or
`HUMANOID ADDED` ever fired):

```
[   0.0s] STATE World=true  combat=0 character=nil autoLoads=false   (menu)
[  52.6s] STATE World=false combat=1 character=nil autoLoads=false   (practice built)
[ 956.6s] STATE World=true  combat=0 character=nil autoLoads=false   (practice ended)
[1145.7s] STATE World=false combat=1 character=nil autoLoads=false   (mission 1, run 1)
[1199.1s] STATE World=true  combat=0 character=nil autoLoads=false
[1249.9s] STATE World=false combat=1 character=nil autoLoads=false   (run 2)
[1292.1s] STATE World=true  combat=0 character=nil autoLoads=false
[1318.8s] STATE World=false combat=1 character=nil autoLoads=false   (run 3)
[1357.9s] STATE World=true  combat=0 character=nil autoLoads=false
[1458.3s] STATE World=false combat=1 character=nil autoLoads=false   (run 4)
[1477.0s] STATE World=true  combat=0 character=nil autoLoads=false
[1500.8s] STATE World=false combat=1 character=nil autoLoads=false   (run 5, 4 min)
[1752.3s] STATE World=true  combat=0 character=nil autoLoads=false
--- new play session (QA launcher inserted) ---
[   0.0s] STATE World=true  combat=0 character=nil autoLoads=false
[   1.0s] STATE World=false combat=1 character=nil autoLoads=false   (mission 2 built, 17.1 s)
[ 238.7s] STATE World=true  combat=0 character=nil autoLoads=false   (ReturnToMenu teardown)
```

Known harness artifacts, not product behaviour: Studio's default control module prints
"Player:Move called, but player currently has no character." once at join on both builds;
the QA-launched mission 2 bypassed `CampaignService`, so its client HUD did not receive the
campaign's end-of-mission message after the server session ended.

Limits: Studio desktop only, keyboard piloting through the MCP; no phone, no gamepad, and no
Roblox Player session. Roblox Jest (`bun run test:roblox`, headless Studio, 2026-10-29 19:27–19:31 PDT): 863/863 tests, 88 suites, including `CharacterPolicy.spec` and `CoreGuiPolicy.spec`.
