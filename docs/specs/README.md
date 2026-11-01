# Specs from reference footage

Derived specifications for the AC04-structured redesign (D-012). Engineers build each SKYBREAK mission and its world from these files.

| Folder | Contents |
|---|---|
| `missions/` | One file per reference mission (`mNN.md`): segments, objectives and phases, enemy roster, allies, mission length, scoring, radio beats by function, presentation, engine gaps, unknowns. `m10-implementation.md` and `m15-implementation.md` record how those two specs were built. |
| `worlds/` | One file per mission world (`mNN.md`): environment, layout sketch with scale converted to studs (D-016), terrain, landmarks, lighting, mapping to `WorldPlan` and the world kit, unknowns. Each has a `mNN-composition.md` companion with the procedural composition; M01 also has `m01-measurement.md`. |
| `engine/` | Engine plans and verification records: the historical readiness review (`readiness.md`, pinned to the 2026-10-28 tree), the missions 6–18 engine plan, the campaign-switch handoff and Studio verification, the large-world spike and the targeting spec. |
| `story/` | The 18-chapter map, the story routing audit and the voice script for the condensed Broken Relay story (D-011, D-013). |

Cross-mission systems (HUD, scoring and ranks, results, briefing) were never specified in a `systems/` folder; the decisions that shaped them are in `docs/human/decisions.md` and the code is mapped in `docs/architecture/README.md`.

Rules:

- Every claim cites a source timestamp range in the footage indexed by [reference/ledger.md](../../reference/ledger.md). Each spec records the clip it used, how clip time maps to source time, which frames were opened, and what was not inspected.
- Observations, inferences and assumptions are labelled separately. Unreadable values are flagged, not guessed (D-014).
- D-001 applies: reference titles may be used here as cross-references, but dialogue, briefing prose and on-screen text are described by function only. Places and characters are generic. Media (frames, clips, audio, transcripts) stay in gitignored `reference/ac04/` and are never committed.
- Any new Blender asset a spec calls for must pass the AGENTS.md upload safety gate before it reaches Roblox.

Specs exist for all 18 missions. Mission 1 was written on 2026-10-28; missions 2 to 18 on 2026-10-29. All 18 missions are built and live; the per-level status is in `docs/human/levels.html`.

| Mission | Reference title | Mission spec | World spec |
|---|---|---|---|
| 1 | Sitting Duck | [missions/m01.md](missions/m01.md) | [worlds/m01.md](worlds/m01.md), [composition](worlds/m01-composition.md), [measurement](worlds/m01-measurement.md) |
| 2 | Imminent Threat | [missions/m02.md](missions/m02.md) | [worlds/m02.md](worlds/m02.md), [composition](worlds/m02-composition.md) |
| 3 | The Northern Eye | [missions/m03.md](missions/m03.md) | [worlds/m03.md](worlds/m03.md), [composition](worlds/m03-composition.md) |
| 4 | Blockade | [missions/m04.md](missions/m04.md) | [worlds/m04.md](worlds/m04.md), [composition](worlds/m04-composition.md) |
| 5 | Lifeline | [missions/m05.md](missions/m05.md) | [worlds/m05.md](worlds/m05.md), [composition](worlds/m05-composition.md) |
| 6 | Invincible Fleet | [missions/m06.md](missions/m06.md) | [worlds/m06.md](worlds/m06.md), [composition](worlds/m06-composition.md) |
| 7 | Deep Strike | [missions/m07.md](missions/m07.md) | [worlds/m07.md](worlds/m07.md), [composition](worlds/m07-composition.md) |
| 8 | Shattered Skies | [missions/m08.md](missions/m08.md) | [worlds/m08.md](worlds/m08.md), [composition](worlds/m08-composition.md) |
| 9 | Operation Bunker Shot | [missions/m09.md](missions/m09.md) | [worlds/m09.md](worlds/m09.md), [composition](worlds/m09-composition.md) |
| 10 | Tango Line | [missions/m10.md](missions/m10.md), [implementation](missions/m10-implementation.md) | [worlds/m10.md](worlds/m10.md), [composition](worlds/m10-composition.md) |
| 11 | Escort | [missions/m11.md](missions/m11.md) | [worlds/m11.md](worlds/m11.md), [composition](worlds/m11-composition.md) |
| 12 | Stonehenge Offensive | [missions/m12.md](missions/m12.md) | [worlds/m12.md](worlds/m12.md), [composition](worlds/m12-composition.md) |
| 13 | Safe Return | [missions/m13.md](missions/m13.md) | [worlds/m13.md](worlds/m13.md), [composition](worlds/m13-composition.md) |
| 14 | Breaking Arrows | [missions/m14.md](missions/m14.md) | [worlds/m14.md](worlds/m14.md), [composition](worlds/m14-composition.md) |
| 15 | Emancipation | [missions/m15.md](missions/m15.md), [implementation](missions/m15-implementation.md) | [worlds/m15.md](worlds/m15.md), [composition](worlds/m15-composition.md) |
| 16 | Whiskey Corridor | [missions/m16.md](missions/m16.md) | [worlds/m16.md](worlds/m16.md), [composition](worlds/m16-composition.md) |
| 17 | Siege of Farbanti | [missions/m17.md](missions/m17.md) | [worlds/m17.md](worlds/m17.md), [composition](worlds/m17-composition.md) |
| 18 | Megalith | [missions/m18.md](missions/m18.md) | [worlds/m18.md](worlds/m18.md), [composition](worlds/m18-composition.md) |
