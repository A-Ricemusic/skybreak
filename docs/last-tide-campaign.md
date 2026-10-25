# Last Tide campaign architecture

Last Tide keeps the original single-place, single-player contract: the menu
world and one active sortie never coexist. The server removes `Workspace.World`,
clears terrain, builds one catalog-defined mission beneath the combat session,
and owns every target, route gate, timer, missile, damage event, objective
transition, and result. Recap cleanup destroys that folder, clears mission
terrain and lighting, then reconstructs the menu world. No mission claims from
the client are accepted.

The creative spine is deliberately small-scale. Captain Siaosi and mechanic
Chief Varo turn Yurei Atoll's lone Kestrel into a community air wing. Mira Sen,
an Admiralty navigator complicit in the blockade, defects in Mission 9. Trust is
earned through shared flying rather than a single apology: she calls defenses,
guides monsoon routes, helps save the flood wall, and ultimately chooses Yurei
as home. Admiral Reyne's defeat ends at an island tribunal rather than an
execution. The finale converts the same aircraft from a weapon into a mail
plane, giving the campaign a human-scale resolution.

## Runtime layers

- `MissionCatalog` is the immutable 27-mission source of story, environment,
  island shapes, target placement and phase order. Invalid IDs, missing route
  points, or insufficient ground placements fail fast.
- `MissionRules` is pure authoritative progression. Missions 1 and 2 retain
  their original special state machines. Later missions use air, ground, ace,
  ordered navigation and timed hold phases.
- `MissionWorld` turns the selected definition into terrain, one ocean plane,
  authored targets, reef settlements and one of six landmark families under
  one disposable folder. Eleven lighting/weather palettes give the acts distinct
  silhouettes without external skybox or texture IDs.
- `CombatService` observes aircraft position against ordered route gates and
  advances hold time at the fixed server step. Hold/defense objectives are
  elapsed survival encounters with pursuers; they do not simulate damage to a
  protected object. The client only sends bounded stick/throttle samples and
  named fire/target/evade actions.
- `CampaignRepository` stores numeric mission maps in save schema v3. v1
  completion becomes Mission 1 progress; v2 Mission 1/2 flags and best times
  migrate forward. Four slots unlock sequentially and retain per-mission replay
  times. Serialized v2 scalar fields remain for rollback compatibility.
- `CutsceneCatalog` contains an opening, 26 inter-mission transitions and a
  finale. React Lua renders letterboxing, speaker/location captions, subtitles,
  progress and skip/static-camera controls while the camera frames the live 3D
  menu scene. Gameplay controllers are stopped before a cinematic.

## 27-mission manifest

| # | Mission | Environment and gameplay | Story turn |
| ---: | --- | --- | --- |
| 01 | First Flight | Movement/target/missile tutorial, radar, 3 bandits | Yurei forms the Reefwatch wing. |
| 02 | Reefbreak Harbor | 3 bandits, 5 warehouses with 5 optional raiders, 165-HP ace | The eastern supply channel opens. |
| 03 | Shallow Patrol | 3 ordered reef gates, 4 scouts | Patrol geometry reveals a flood-wall survey. |
| 04 | Pearl Lagoon | 3 corvettes, 2-aircraft CAP | Stolen island cutters are stopped before launch. |
| 05 | Monsoon Rising | 4 weather gates, 25-second fleet cover, rear guard | The unknown navigator identifies herself as Mira. |
| 06 | Driftwood Dock | 4 stockyards, 3 scrambled fighters | The western blockade begins running short of fuel. |
| 07 | Bone Reef | 6 escorts and a reef ace | Mira confronts the cost of Admiralty loyalty. |
| 08 | Signal Fire | 4 relays under 6 optional pursuers | The targeting net goes dark for Mira's escape. |
| 09 | Mira's Deal | 2 rendezvous gates, 5 pursuers, ace | Mira defects and reaches Yurei. |
| 10 | Dawn Siren | 3 SAM sites, 4 responders | Mira flies second seat and earns operational trust. |
| 11 | Flood Gate | Survive 35 seconds over the wall, then strike 4 corvettes | Every reef ward stays dry. |
| 12 | Blackwater Yard | 6 drydocks, 2 sequential yard aces | Blockade ship production stops. |
| 13 | Storm Eye | 3 calm-channel gates, 40-second typhoon hold | The island fleet rides out the second monsoon. |
| 14 | Reefline Convoy | 3 shadowing gates, 5 corvettes, 3 escorts | Civilian boats reclaim the strait. |
| 15 | Night Rains | 6 night fighters and an ace | Runway lights remain visible through the rain. |
| 16 | Breakwater Siege | 5 mixed defenses, 4 CAP, siege ace | The last outer wall survives. |
| 17 | Admiral's Shadow | 2 sequential high-health aces | Reyne loses his longest-serving pilots. |
| 18 | The Second Tide | Survive 35 seconds of wall cover, then make an 8-point strike | The warned attack fails at high water. |
| 19 | Carrier Deck | 3 approach gates, 5 escorts, 4 CAP | Reefwatch carries the fight west. |
| 20 | Lone Spire | 6 defenses and a 195-HP ace | The fleet command uplink falls silent. |
| 21 | Twin Horizon | 4 decoy-signal gates, 7-aircraft rush | Three thousand refugees cross safely. |
| 22 | Reef Beacon | 4 batteries and a 220-HP flight lord | The safety beacon turns again. |
| 23 | Monsoon Veil | 5 storm gates, 30-second convoy mask | Mira openly calls Yurei home. |
| 24 | Last Light | 5 supply points, 2 escort aces | The blockade loses its remaining supply chain. |
| 25 | Admiral's Carrier | 2 blind-quarter gates, 8 emplacements, 3 fighters | Reyne abandons his wounded flagship. |
| 26 | Breaking Wave | Survive 40 seconds of evacuation cover, then break a 6-point line | The final civilian ferry clears. |
| 27 | Last Tide | 4 fighters, 4 defenses, 3 escalating aces | Reyne is captured; the blockade ends at a tribunal. |

## Authored asset and performance bounds

All mission meshes use committed Blender Python plus exact runtime mesh JSON.
No uploaded IDs, credentials, image textures or paid assets are required.

| Asset | Vertices | Triangles | Material meshes | Roblox bounds (studs) |
| --- | ---: | ---: | ---: | --- |
| Warehouse | 2,068 | 3,632 | 7 | 65.4 × 40.7 × 95.1 |
| Radar | 1,142 | 2,152 | 7 | 65 × 45.2 × 65 |
| Corvette | 722 | 1,378 | 7 | 18.3 × 28.9 × 78 |
| SAM battery | 592 | 1,112 | 6 | 34 × 18.6 × 34 |

The largest definition places nine terrain islands and eight mission targets.
Static content is built once per material role and cloned thereafter. There is
one 7,600-stud ocean plane, at most six hostile aircraft alive concurrently in
the preserved Mission 2 ace phase, a 30 Hz fixed server combat step, 10 Hz
telemetry, and client input capped at 15 Hz with a 40 Hz server event guard.
Ground combat remains analytic; render meshes have collision, touch and query
disabled. These are authored bounds, not a substitute for device profiling.

## Validation contract

Offline validation is `bun run build`, `bun run build:place` and
`git diff --check`. Roblox Jest must run under an exclusive Studio lease and
covers catalog/cinematic completeness, v1/v2 migration, 27-mission unlocks,
route/hold authority, deadlines, mesh packaging, layout and engine instances.

The Studio pilot in `tools/playtest-campaign.client.luau` steers toward the
replicated target or route marker, uses the same controller methods as normal
touch/keyboard/gamepad play, fires only after a real lock, and evades only on a
real warning. It never edits target position, health, kills, damage, time,
objective progress, or success. For final acceptance, launch each mission from
the real selector, record completion and teardown, verify the next unlock and
replay path, inspect its cinematic/skip behavior, and complete one real 600 s
timeout/retry path. The completed exclusive-lease run and its limitations are
recorded in [last-tide-qa.md](last-tide-qa.md).
