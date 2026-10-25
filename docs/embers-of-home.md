# Embers of Home campaign

## Architecture and story rationale

Embers of Home keeps the proven one-place, single-player architecture. The server owns one combat session, builds the selected mission under a disposable folder, clears its terrain and lighting at recap, and restores the menu airbase. Mission definitions are shared declarative data; server mission rules consume phases and the React Lua client consumes presentation metadata. A client can request a mission, provide controls, cycle a target, fire, or evade. It cannot report damage, kills, phase completion, time, or success.

The emotional arc moves south-to-north with the palette. Warm Caldera teaches rescue and belonging; ash and storms turn loss into anger; cold industrial islands tempt Ember toward revenge. The finale explicitly refuses the revenge target and makes five civilian-bound carriers the real objective. This theme drives the mission mix: rescue, escort, and defense remain mechanically central rather than existing only in dialogue.

Each mission combines a biome, reusable geographic layout, mission-specific target set, unique composition transform, and one of seven authored landmarks. Revisited locations retain geographic memory but change approach lanes and skyline. The 27 composition records are fixed data, not random generation.

## Mission manifest

| # | Chapter | Mission | Environment | Play pattern |
|---:|:---:|---|---|---|
| 01 | I | Last Sunrise | Caldera dawn archipelago | movement/target/missile tutorial, then 3 bandits |
| 02 | I | Smoke Over Caldera | burning warehouse coast | 3 interceptors, 5 warehouses + 5 optional raiders, 165-HP ace |
| 03 | I | Open Water Rescue | warm rescue waters | protect three rescue launches; down 3 raiders |
| 04 | I | Lighthouse Watch | dusk home islands | defend Harbor Watch from 4 raiders |
| 05 | I | Shrike Hunt | cold open sea | 4-fighter channel intercept |
| 06 | I | Thunderhead | storm depot islands | destroy 3 depots under 3 pursuers |
| 07 | I | Reef Pursuit | warm ridge passage | first Grey Albatross duel |
| 08 | I | Harvest | terrace granary coast | destroy 4 captured granaries under 4 pursuers |
| 09 | I | Burning Harbor | burning Caldera | multi-stage evacuation defense finale |
| 10 | II | Cold Launch | cold open sea | 4-fighter northbound intercept |
| 11 | II | Hollow Markers | overcast radar belt | destroy 3 radar towers under 3 pursuers |
| 12 | II | Silent Evacuation | scattered shoals | defend ferry convoy from 5 raiders |
| 13 | II | Fisher's Dawn | warm rescue waters | clear 4 pirates from fishing launches |
| 14 | II | Shear Line | storm open sea | low-visibility 4-fighter intercept |
| 15 | II | The Grey Albatross | cold ridge passage | 185-HP ace rematch |
| 16 | II | Mother's Keep | renewed home islands | defend rebuilding civilians from 5 raiders |
| 17 | II | Breaking Weather | storm convoy coast | destroy 4 convoy holds under 4 pursuers |
| 18 | II | Red Horizon | burning coast | intercept/5-target strike/180-HP ace finale |
| 19 | III | Iron Gale | Iron North radar belt | 3 coastal batteries under 3 pursuers |
| 20 | III | Smokestacks | industrial foundry coast | 5 foundry halls under 4 pursuers |
| 21 | III | The Narrow Sea | cold shoals | 5-fighter carrier escort intercept |
| 22 | III | Grim Weather | storm open sea | survive 240 seconds against 5 attackers |
| 23 | III | Rook's Last Flight | burning rescue waters | defend Rook and rescue launches from 4 raiders |
| 24 | III | Shadowline | Iron North radar belt | 3 command structures under 3 pursuers |
| 25 | III | Albatross Rising | Iron North ridge | 3-fighter elite encounter |
| 26 | III | Harbor of Hollow Stars | industrial flagship harbor | intercept/4-depot strike/190-HP ace |
| 27 | III | Embers of Home | renewed Caldera | protect evacuation ships by downing 5 carrier aircraft |

## Save and cinematic contract

- Save v3 stores 27 completion flags and best times, four isolated slots, cumulative best sortie kills, and the next incomplete mission.
- v1 completion migrates to Mission 1. v2 Mission 1/2 fields migrate into the first two v3 records. Legacy mirror fields remain serialized for rollback visibility.
- A mission is replayable once unlocked. Mission N unlocks only when N-1 is complete.
- Every mission references a unique opening and debrief definition: 54 cinematics, each with one or more camera-shot/subtitle beats. Captions are always present; skip works on touch, mouse, keyboard, and gamepad; camera motion can be disabled.

## Asset and performance bounds

- Kestrel: 3,684 triangles; Vanta: 3,840 triangles.
- Warehouse: 3,632 triangles; radar: 2,152 triangles; new rescue launch: 1,586 triangles. Each runtime mesh has seven or fewer material roles and is cached once per server DataModel before clones are made.
- A mission has at most 25 tiled ocean parts, nine base islands, five combat ground targets, five ordinary hostile aircraft plus an ace, seven landmark props, and three protected or convoy rescue-launch clones. Analytic combat ignores mesh queries.
- Enemy health is 100 in Chapter I, 110 in Chapter II, and 120 in Chapter III; declared ace health is 140–190. Regenerating missiles and staggered hostile fire keep phone play fair while enemy speed rises modestly by chapter.

## Genuine playtest protocol

Roblox Jest must validate all definitions and progression before the campaign run. Then, with an exclusive Studio lease, use a fresh session-only slot and complete Missions 1–27 in order. For each mission:

1. Watch or skip its opening cinematic and confirm camera ownership, subtitles, gamepad focus, reduced-motion toggle, and cleanup.
2. Launch normally. Insert `tools/playtest-campaign.client.luau` as a normal client LocalScript if an automated pilot is desired. The pilot uses normal controller input, targeting, missile, and evade methods and cannot alter authoritative state.
3. Require `Outcome=Completed`, `ResultValid=true`, positive elapsed time below 600, and expected real ground/air objective counts. Record health and missile/evade command counts; do not repair failures by changing health, clocks, kills, or result.
4. Confirm debrief cinematic, unlock of exactly the next mission, replay access to prior missions, retry after one deliberate failure, and world/terrain disposal.

Also inspect 320x240, phone landscape, phone portrait, tablet, keyboard/mouse and gamepad. Published cloud-save behavior remains a separate owner-controlled check; unpublished Studio is intentionally session-only.
