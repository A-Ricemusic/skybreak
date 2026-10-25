# Aurora Line campaign

Aurora Line is a complete 27-sortie alternative campaign in the original single
Roblox place. A courier squadron holds a humanitarian corridor through a polar
war, discovers that Volkov's ceasefire is cover for renewed attacks, and carries
the evidence south. Mission worlds are disposable: launch removes the menu
world, `MissionWorld.Build` creates one bounded sortie, and recap cleanup removes
the mission folder and terrain before rebuilding the menu.

## Architecture

- `AuroraLineManifest.ts` is the static story, objective, environment, debrief,
  and cinematic contract. Mission 1 and Mission 2 retain their original gates.
- `MissionRules.ts` is the pure authoritative objective state machine. Clients
  send controls and actions only; they never submit damage, kills, time, or wins.
- `CombatService.ts` creates required waves from the current objective step.
  Escort/protect missiles damage a real server-owned convoy/refuge model, whose
  health reaching zero fails the sortie. Every mission retains the 600-second
  wall-clock deadline.
- `MissionWorld.ts` applies polar lighting and terrain, creates an explicit
  mission identity landmark, transforms each target compound into a different
  composition, and returns only target/friendly models owned by the session.
- React Lua presents 27 locked/unlocked/replayable sorties, mission-specific
  briefing/debrief copy, and rendered camera cinematics. Cutscenes have visible
  scene actors, subtitles, skip controls, and a reduced-motion camera mode.
- Save schema v3 stores dense completion/best-time records for 27 missions.
  v1 and v2 fields are absorbed monotonically; a completed two-mission v2 save
  starts at Mission 3 and never falsely marks the campaign complete.

## Mission manifest

| # | Codename | Region | Objective chain |
|---:|---|---|---|
| 01 | First Flight | Training coast | movement → target → radar → 3 bandits |
| 02 | Iron Coast | Dusk coast | 3 bandits → 5 warehouses (+5 optional raiders) → ace |
| 03 | White Harbor | Snow coast | intercept → escort → strike |
| 04 | Glass Bluff | Blizzard | intercept → strike |
| 05 | Lantern Run | Aurora night | escort → intercept |
| 06 | Cold Cathedral | Aurora night | intercept → protect → ace KITE |
| 07 | Icebreaker | Polar sea | escort → strike → intercept |
| 08 | Aurora Fence | Aurora night | intercept → beacon strike |
| 09 | Corridor Watch | Aurora night | protect → intercept |
| 10 | Flare Watch | Aurora night | escort → ace EMBER |
| 11 | False Peace | Ceasefire dawn | intercept → radar strike → ace CROWN |
| 12 | Volcanic Watch | Caldera | escort → strike |
| 13 | Ash Veil | Caldera | intercept → protect |
| 14 | Vent Run | Geothermal field | escort → strike → ace CINDER |
| 15 | Forge Light | Caldera forge | intercept → strike |
| 16 | Glacier March | Glacier | escort → intercept |
| 17 | White Wall | Glacier wall | intercept → strike → ace |
| 18 | Crossing | Glacier route | escort → protect |
| 19 | Silence Line | Deep ice | strike → intercept |
| 20 | Cold Crown | Glacier high line | intercept → ace |
| 21 | Port Night | Northern port | intercept → five-target strike |
| 22 | Black Water | Hospital ship port | escort → strike → intercept |
| 23 | Gold Hour | Northern port | protect → ace |
| 24 | Last Corridor | Evacuation road | escort → protect |
| 25 | Sky Trial | Evidence route | intercept → transmitter strike |
| 26 | Aurora Gate | Volkov forward base | intercept → strike → ace |
| 27 | Aurora Line | Ceasefire line | intercept → escort → strike → AURORA ZERO |

The manifest contains an opening, one bridge after each of Missions 1–26, and a
finale: 28 cinematic records total.

## Original Blender assets and bounds

`tools/build-mission-assets.py` generates all mission models. Aurora Line adds:

- Navigation beacon: 1,032 triangles, 552 vertices, six material roles, 54 × 54 × 54 studs.
- Relief convoy: 2,580 triangles, 1,352 vertices, six material roles, 20.4 × 18.4 × 108 studs.

Canonical mesh JSON is committed. `.blend`, `.glb`, and previews are reproducible
inspection outputs and ignored. Runtime uses `EditableMesh` static content with
native Roblox colors; it has no uploaded IDs, API keys, textures, or credentials.

## Performance bounds

Each world uses 25 non-colliding ocean tiles, at most five target models, one
friendly objective, four broad terrain anchors, and one low-part landmark. Each
Blender asset has at most seven material MeshParts and fewer than 5,000 triangles.
Air waves top out at five normal fighters or one ace; destroyed objects are
removed immediately. Only one mission folder exists and cleanup destroys it.

## Validation and lease-gated QA

Offline validation is `bun run build`, `bun run build:place`, Blender generator
validation, and `git diff --check`. Roblox Jest must validate all 27 objective
chains, save v2 migration, cutscene coverage, layout invariants, and existing
engine behavior. The genuine all-27 playthrough must use the normal controller
and authoritative damage/objectives. Studio, `test:roblox`, and Rojo remain
prohibited until the parent grants the exclusive Studio lease. No health, kill,
timer, or success state may be injected during that playthrough.
