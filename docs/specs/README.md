# Specs from reference footage

Derived specifications for the AC04-structured redesign (D-012). Engineers build each SKYBREAK mission and its world from these files.

| Folder | Contents |
|---|---|
| `missions/` | One file per reference mission (`mNN.md`): segments, objectives and phases, enemy roster, allies, mission length, scoring, radio beats by function, presentation, engine gaps, unknowns. |
| `worlds/` | One file per mission world (`mNN.md`): environment, layout sketch with scale converted to studs (D-016), terrain, landmarks, lighting, mapping to `WorldPlan` and the world kit, unknowns. |
| `systems/` | Later: cross-mission systems such as the HUD, scoring and ranks, results screen and briefing. |

Rules:

- Every claim cites a source timestamp range in the footage indexed by [reference/ledger.md](../../reference/ledger.md). Each spec records the clip it used, how clip time maps to source time, which frames were opened, and what was not inspected.
- Observations, inferences and assumptions are labelled separately. Unreadable values are flagged, not guessed (D-014).
- D-001 applies: reference titles may be used here as cross-references, but dialogue, briefing prose and on-screen text are described by function only. Places and characters are generic. Media (frames, clips, audio, transcripts) stay in gitignored `reference/ac04/` and are never committed.
- Any new Blender asset a spec calls for must pass the AGENTS.md upload safety gate before it reaches Roblox.
